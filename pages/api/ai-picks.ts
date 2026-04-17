import type { NextApiRequest, NextApiResponse } from 'next';

import type {
  AIPick,
  AIPicksResponse,
  AnalystConsensusItem,
  AnalystScorecardResponse,
  RiskLevel,
  TimeHorizon,
} from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const MIN_ENTRY_SCORE = 70;
const MIN_BROKER_COUNT = 3;
const MAX_DAYS = 30;
const TOP_PICKS_LIMIT = 10;

type CacheEntry = {
  data: AIPicksResponse;
  fetchedAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const responseInflight = new Map<string, Promise<AIPicksResponse>>();

function getCacheKey() {
  return 'ai-picks';
}

function getCachedResponse() {
  const cached = responseCache.get(getCacheKey());
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    responseCache.delete(getCacheKey());
    return null;
  }

  return cached.data;
}

function calculateRiskLevel(entryScore: number, avgUpside: number): RiskLevel {
  if (entryScore >= 80 && avgUpside <= 30) {
    return 'low';
  }
  if (entryScore >= 70 && avgUpside <= 50) {
    return 'medium';
  }
  return 'high';
}

function calculatePositionSize(riskLevel: RiskLevel, avgUpside: number): number {
  let positionSize = 10; // Base 10%

  if (riskLevel === 'high') {
    positionSize -= 3;
  }

  if (avgUpside > 50) {
    positionSize -= 2;
  }

  return Math.max(5, Math.min(15, positionSize)); // Clamp to 5-15%
}

function estimateTimeHorizon(avgUpside: number): TimeHorizon {
  if (avgUpside <= 30) {
    return '1-3mo'; // Short-term
  }
  return '3-12mo'; // Mid-term
}

function generateThesis(brokerCount: number, entryScore: number, avgUpside: number): string {
  return `${brokerCount}개 증권사가 ${entryScore}점 Entry Score로 추천, 목표가 상승여력 ${avgUpside.toFixed(1)}%`;
}

async function fetchConsensusData(): Promise<AnalystConsensusItem[]> {
  // Reuse consensus API logic
  const cacheFile = await loadAnalystData();
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (MAX_DAYS - 1));

  const reports = cacheFile.reports.filter((report) => new Date(report.date) >= cutoff);

  const groups = new Map<string, typeof reports>();

  for (const report of reports) {
    const key = `${report.market}:${report.ticker}`;
    const existing = groups.get(key) || [];
    existing.push(report);
    groups.set(key, existing);
  }

  const items: AnalystConsensusItem[] = [];

  for (const group of Array.from(groups.values())) {
    const sorted = [...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const brokers = Array.from(new Set(sorted.map((report) => report.broker)));

    // Must have at least 2 brokers (consensus requirement)
    if (brokers.length < 2) {
      continue;
    }

    const latest = sorted[0];
    const currentPrice = latest.currentPrice;
    const avgTargetPrice =
      sorted.reduce((sum, report) => sum + report.targetPrice, 0) / sorted.length;
    const avgUpside =
      currentPrice > 0 ? ((avgTargetPrice - currentPrice) / currentPrice) * 100 : 0;

    // Calculate entry score
    const priceVsBaseRatio = latest.basePrice > 0 ? (latest.basePrice - currentPrice) / latest.basePrice : 0;
    const targetGapRatio = currentPrice > 0 ? (avgTargetPrice - currentPrice) / currentPrice : 0;

    const scaleScore = (ratio: number, target: number, maxPoints: number) => {
      const score = (ratio / target) * maxPoints;
      return Math.max(0, Math.min(maxPoints, score));
    };

    const scoreReportCount = (count: number) => {
      if (count === 1) return 0;
      if (count === 2) return 5;
      if (count === 3) return 10;
      if (count === 4) return 13;
      return 15;
    };

    const scoreConsensusStrength = (count: number) => {
      if (count <= 1) return 0;
      if (count === 2) return 10;
      if (count === 3) return 15;
      if (count === 4) return 18;
      return 20;
    };

    const breakdown = {
      priceVsBase: Math.round(scaleScore(priceVsBaseRatio, 0.15, 30)),
      targetGap: Math.round(scaleScore(targetGapRatio, 0.4, 35)),
      reportCount: Math.round(scoreReportCount(sorted.length)),
      consensusStrength: Math.round(scoreConsensusStrength(brokers.length)),
    };

    const entryScore = Math.max(
      0,
      Math.min(
        100,
        breakdown.priceVsBase + breakdown.targetGap + breakdown.reportCount + breakdown.consensusStrength
      )
    );

    items.push({
      ticker: latest.ticker,
      name: latest.name,
      market: latest.market,
      brokerCount: brokers.length,
      brokers,
      latestReportDate: latest.date,
      avgUpside: Math.round(avgUpside * 10) / 10,
      currentPrice,
      basePrice: latest.basePrice,
      basePriceDate: latest.basePriceDate,
      avgTargetPrice: Math.round(avgTargetPrice * 10) / 10,
      entryScore,
      entryScoreBreakdown: breakdown,
      reportCount: sorted.length,
      relatedReports: sorted,
    });
  }

  return items;
}

async function fetchScorecardData(): Promise<AnalystScorecardResponse | null> {
  try {
    // This would normally call the scorecard API, but for simplicity we'll skip it
    // and use a default broker success rate
    return null;
  } catch {
    return null;
  }
}

function getBrokerSuccessRate(
  brokers: string[],
  scorecard: AnalystScorecardResponse | null
): number {
  if (!scorecard) {
    return 50; // Default 50% if no scorecard data
  }

  const brokerGroups = scorecard.summary.byBroker.filter((group) =>
    brokers.includes(group.label)
  );

  if (brokerGroups.length === 0) {
    return 50;
  }

  const avgSuccessRate =
    brokerGroups.reduce((sum, group) => sum + group.month1.successRate, 0) /
    brokerGroups.length;

  return Math.round(avgSuccessRate * 10) / 10;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIPicksResponse | { error: string }>
) {
  try {
    // Check cache
    const cached = getCachedResponse();
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    // Check inflight
    const cacheKey = getCacheKey();
    const inflight = responseInflight.get(cacheKey);
    const response =
      inflight ||
      (async () => {
        // Fetch consensus data
        const consensusItems = await fetchConsensusData();

        // Filter by AI criteria
        const filteredItems = consensusItems.filter(
          (item) => item.entryScore >= MIN_ENTRY_SCORE && item.brokerCount >= MIN_BROKER_COUNT
        );

        // Fetch scorecard for broker success rates
        const scorecard = await fetchScorecardData();

        // Build AI picks
        const picks: AIPick[] = filteredItems
          .map((item) => {
            const riskLevel = calculateRiskLevel(item.entryScore, item.avgUpside);
            const positionSize = calculatePositionSize(riskLevel, item.avgUpside);
            const timeHorizon = estimateTimeHorizon(item.avgUpside);
            const thesis = generateThesis(item.brokerCount, item.entryScore, item.avgUpside);
            const brokerSuccessRate = getBrokerSuccessRate(item.brokers, scorecard);

            return {
              ticker: item.ticker,
              name: item.name,
              market: item.market,
              entryScore: item.entryScore,
              entryScoreBreakdown: item.entryScoreBreakdown,
              brokerCount: item.brokerCount,
              brokers: item.brokers,
              avgUpside: item.avgUpside,
              avgTargetPrice: item.avgTargetPrice,
              currentPrice: item.currentPrice,
              recommendedPositionSize: positionSize,
              riskLevel,
              timeHorizon,
              thesis,
              brokerSuccessRate,
            };
          })
          .sort((a, b) => {
            // Primary sort: Entry Score DESC
            if (b.entryScore !== a.entryScore) {
              return b.entryScore - a.entryScore;
            }
            // Secondary sort: Broker Count DESC
            return b.brokerCount - a.brokerCount;
          })
          .slice(0, TOP_PICKS_LIMIT);

        const result: AIPicksResponse = {
          picks,
          criteria: {
            minEntryScore: MIN_ENTRY_SCORE,
            minBrokerCount: MIN_BROKER_COUNT,
            maxDays: MAX_DAYS,
          },
          generatedAt: new Date().toISOString(),
          summary: {
            totalCandidates: consensusItems.length,
            selectedCount: picks.length,
            avgEntryScore:
              picks.length > 0
                ? Math.round(picks.reduce((sum, pick) => sum + pick.entryScore, 0) / picks.length)
                : 0,
            avgBrokerCount:
              picks.length > 0
                ? Math.round(
                    (picks.reduce((sum, pick) => sum + pick.brokerCount, 0) / picks.length) * 10
                  ) / 10
                : 0,
          },
        };

        return result;
      })();

    if (!inflight) {
      responseInflight.set(cacheKey, response);
    }

    const resolved = await response;
    responseCache.set(cacheKey, {
      data: resolved,
      fetchedAt: Date.now(),
    });
    responseInflight.delete(cacheKey);

    res.status(200).json(resolved);
  } catch (error) {
    responseInflight.delete(getCacheKey());
    console.error('Error building AI picks:', error);
    res.status(500).json({ error: 'Failed to build AI picks' });
  }
}
