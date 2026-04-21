import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DELTA_FILE_PATH = path.join(ROOT_DIR, 'data', 'consensus-deltas.json');
const CACHE_FILE_PATH = path.join(ROOT_DIR, 'data', 'analyst-reports-cache.json');

// Helper functions
function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function roundWhole(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scaleScore(value, maxValue, maxScore) {
  if (value <= 0 || maxValue <= 0 || maxScore <= 0) {
    return 0;
  }
  return (clamp(value, 0, maxValue) / maxValue) * maxScore;
}

function scoreReportCount(reportCount) {
  if (reportCount <= 1) return 0;
  return scaleScore(reportCount - 1, 4, 15);
}

function scoreConsensusStrength(brokerCount) {
  if (brokerCount <= 2) return 10;
  return 10 + scaleScore(brokerCount - 2, 3, 10);
}

function buildEntryScore({ currentPrice, basePrice, avgTargetPrice, reportCount, brokerCount }) {
  const priceVsBaseRatio = basePrice > 0 ? (basePrice - currentPrice) / basePrice : 0;
  const targetGapRatio = currentPrice > 0 ? (avgTargetPrice - currentPrice) / currentPrice : 0;

  const breakdown = {
    priceVsBase: roundWhole(scaleScore(priceVsBaseRatio, 0.15, 30)),
    targetGap: roundWhole(scaleScore(targetGapRatio, 0.4, 35)),
    reportCount: roundWhole(scoreReportCount(reportCount)),
    consensusStrength: roundWhole(scoreConsensusStrength(brokerCount)),
  };

  return clamp(
    breakdown.priceVsBase + breakdown.targetGap + breakdown.reportCount + breakdown.consensusStrength,
    0,
    100
  );
}

// Load analyst cache and compute current consensus
async function computeCurrentConsensus() {
  const content = await readFile(CACHE_FILE_PATH, 'utf-8');
  const cacheFile = JSON.parse(content);

  // Filter reports (30-day window, all markets)
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 29);

  const reports = cacheFile.reports.filter((report) => new Date(report.date) >= cutoff);

  // Group by ticker
  const groups = new Map();
  for (const report of reports) {
    const key = `${report.market}:${report.ticker}`;
    const existing = groups.get(key) || [];
    existing.push(report);
    groups.set(key, existing);
  }

  const snapshots = [];

  for (const [key, group] of groups.entries()) {
    const sorted = [...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const brokers = Array.from(new Set(sorted.map((r) => r.broker)));

    // Skip tickers with < 2 brokers
    if (brokers.length < 2) continue;

    const latest = sorted[0];
    const currentPrice = latest.currentPrice;

    const avgTargetPrice = roundOne(
      sorted.reduce((sum, r) => sum + r.targetPrice, 0) / sorted.length
    );

    const avgUpside = roundOne(
      sorted.reduce((sum, r) => {
        const upside = r.targetPrice > 0 && currentPrice > 0
          ? ((r.targetPrice - currentPrice) / currentPrice) * 100
          : 0;
        return sum + upside;
      }, 0) / sorted.length
    );

    const entryScore = buildEntryScore({
      currentPrice,
      basePrice: latest.basePrice,
      avgTargetPrice,
      reportCount: sorted.length,
      brokerCount: brokers.length,
    });

    snapshots.push({
      ticker: latest.ticker,
      name: latest.name,
      market: latest.market,
      brokerCount: brokers.length,
      avgUpside,
      avgTargetPrice,
      currentPrice,
      entryScore,
      reportCount: sorted.length,
    });
  }

  return snapshots;
}

// Load existing delta file or create baseline
async function loadDeltaFile() {
  if (!existsSync(DELTA_FILE_PATH)) {
    console.log('Delta file not found, creating baseline...');
    const snapshots = await computeCurrentConsensus();
    return {
      baseline: {
        date: today(),
        snapshots,
      },
      deltas: [],
    };
  }

  const content = await readFile(DELTA_FILE_PATH, 'utf-8');
  return JSON.parse(content);
}

// Reconstruct state from baseline + deltas
function reconstructState(deltaFile) {
  let state = [...deltaFile.baseline.snapshots];

  for (const delta of deltaFile.deltas) {
    // Apply adds
    state.push(...delta.added);

    // Apply removes
    state = state.filter((s) => !delta.removed.includes(s.ticker));

    // Apply changes
    for (const change of delta.changed) {
      const idx = state.findIndex((s) => s.ticker === change.ticker);
      if (idx !== -1) {
        for (const [key, { new: newVal }] of Object.entries(change.fields)) {
          state[idx][key] = newVal;
        }
      }
    }
  }

  return state;
}

// Compute delta between old and new state
function computeDelta(oldState, newState) {
  const oldTickers = new Map(oldState.map((s) => [s.ticker, s]));
  const newTickers = new Map(newState.map((s) => [s.ticker, s]));

  // Added tickers
  const added = newState.filter((s) => !oldTickers.has(s.ticker));

  // Removed tickers
  const removed = oldState.filter((s) => !newTickers.has(s.ticker)).map((s) => s.ticker);

  // Changed tickers
  const changed = [];
  for (const [ticker, newSnapshot] of newTickers) {
    const oldSnapshot = oldTickers.get(ticker);
    if (!oldSnapshot) continue;

    const fields = {};
    const keysToCheck = ['brokerCount', 'avgUpside', 'entryScore', 'avgTargetPrice', 'currentPrice', 'reportCount'];

    for (const key of keysToCheck) {
      // Compare with tolerance for floating point
      const oldVal = oldSnapshot[key];
      const newVal = newSnapshot[key];

      if (typeof oldVal === 'number' && typeof newVal === 'number') {
        if (Math.abs(oldVal - newVal) > 0.01) {
          fields[key] = { old: oldVal, new: newVal };
        }
      } else if (oldVal !== newVal) {
        fields[key] = { old: oldVal, new: newVal };
      }
    }

    if (Object.keys(fields).length > 0) {
      changed.push({ ticker, name: newSnapshot.name, fields });
    }
  }

  return { added, removed, changed };
}

// Main function
async function main() {
  console.log(`\n=== Consensus Delta Generation (${today()}) ===\n`);

  // Ensure data directory exists
  await mkdir(path.join(ROOT_DIR, 'data'), { recursive: true });

  // 1. Load current delta file (or create baseline)
  let deltaFile = await loadDeltaFile();
  console.log(`Loaded delta file: baseline date = ${deltaFile.baseline.date}, deltas count = ${deltaFile.deltas.length}`);

  // 2. Compute current consensus
  console.log('Computing current consensus...');
  const currentConsensus = await computeCurrentConsensus();
  console.log(`Current consensus: ${currentConsensus.length} tickers`);

  // 3. Reconstruct last state
  const lastState = reconstructState(deltaFile);
  console.log(`Reconstructed last state: ${lastState.length} tickers`);

  // 4. Compute delta
  const delta = computeDelta(lastState, currentConsensus);
  console.log(`Delta: +${delta.added.length} added, -${delta.removed.length} removed, ~${delta.changed.length} changed`);

  // 5. Add delta (only if there are changes)
  if (delta.added.length > 0 || delta.removed.length > 0 || delta.changed.length > 0) {
    deltaFile.deltas.push({
      date: today(),
      added: delta.added,
      removed: delta.removed,
      changed: delta.changed,
    });
    console.log('Delta added to file');
  } else {
    console.log('No changes detected, skipping delta addition');
  }

  // 6. Remove deltas older than 90 days
  const beforeCleanup = deltaFile.deltas.length;
  deltaFile.deltas = deltaFile.deltas.filter((d) => daysSince(d.date) <= 90);
  if (beforeCleanup !== deltaFile.deltas.length) {
    console.log(`Cleaned up ${beforeCleanup - deltaFile.deltas.length} old deltas (>90 days)`);
  }

  // 7. Reset baseline every 30 deltas (optimization)
  if (deltaFile.deltas.length >= 30) {
    console.log('\n30 deltas reached, resetting baseline...');
    deltaFile.baseline = {
      date: today(),
      snapshots: currentConsensus,
    };
    deltaFile.deltas = [];
    console.log('Baseline reset to current state, deltas cleared');
  }

  // 8. Save
  const outputContent = JSON.stringify(deltaFile, null, 2);
  await writeFile(DELTA_FILE_PATH, outputContent, 'utf-8');
  console.log(`\nDelta file saved: ${DELTA_FILE_PATH}`);
  console.log(`Total size: ${(outputContent.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n=== Generation Complete ===\n');
}

// Run
main().catch((error) => {
  console.error('Error generating consensus delta:', error);
  process.exit(1);
});
