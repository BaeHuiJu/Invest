// Consensus Delta Utilities
// 델타 파일 재구성 및 타임라인 생성 유틸리티

export interface ConsensusSnapshot {
  ticker: string;
  name: string;
  market: string;
  brokerCount: number;
  avgUpside: number;
  avgTargetPrice: number;
  currentPrice: number;
  entryScore: number;
  reportCount: number;
}

export interface DeltaEntry {
  date: string;
  added: ConsensusSnapshot[];
  removed: string[]; // ticker strings
  changed: {
    ticker: string;
    name?: string;
    fields: Record<string, { old: number; new: number }>;
  }[];
}

export interface ConsensusDelta {
  baseline: {
    date: string;
    snapshots: ConsensusSnapshot[];
  };
  deltas: DeltaEntry[];
}

export interface ConsensusTimelinePoint extends ConsensusSnapshot {
  date: string;
}

/**
 * 특정 날짜까지의 델타를 적용하여 상태 재구성
 */
export function reconstructStateAtDate(
  deltaFile: ConsensusDelta,
  targetDate: string
): ConsensusSnapshot[] {
  // Start with baseline
  let state = [...deltaFile.baseline.snapshots];

  // Apply deltas up to target date
  const relevantDeltas = deltaFile.deltas.filter((d) => d.date <= targetDate);

  for (const delta of relevantDeltas) {
    // Apply adds
    state.push(...delta.added);

    // Apply removes
    state = state.filter((s) => !delta.removed.includes(s.ticker));

    // Apply changes
    for (const change of delta.changed) {
      const idx = state.findIndex((s) => s.ticker === change.ticker);
      if (idx !== -1) {
        // Update name if provided
        if (change.name) {
          state[idx].name = change.name;
        }

        // Apply field changes
        for (const [key, { new: newVal }] of Object.entries(change.fields)) {
          (state[idx] as any)[key] = newVal;
        }
      }
    }
  }

  return state;
}

/**
 * 특정 종목의 타임라인 데이터 생성
 */
export function buildTimeline(
  deltaFile: ConsensusDelta,
  ticker: string,
  days: number
): ConsensusTimelinePoint[] {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Collect all dates (baseline + deltas within range)
  const allDates: string[] = [];

  if (deltaFile.baseline.date >= startDate && deltaFile.baseline.date <= endDate) {
    allDates.push(deltaFile.baseline.date);
  }

  for (const delta of deltaFile.deltas) {
    if (delta.date >= startDate && delta.date <= endDate) {
      allDates.push(delta.date);
    }
  }

  // Sort dates chronologically
  allDates.sort();

  // Build timeline by reconstructing state at each date
  const timeline: ConsensusTimelinePoint[] = [];

  for (const date of allDates) {
    const state = reconstructStateAtDate(deltaFile, date);
    const tickerSnapshot = state.find((s) => s.ticker === ticker);

    if (tickerSnapshot) {
      timeline.push({
        date,
        ...tickerSnapshot,
      });
    }
  }

  return timeline;
}

/**
 * 날짜 빼기 헬퍼 함수
 */
export function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * 두 스냅샷 간의 변화 계산
 */
export function computeChange(
  current: ConsensusSnapshot,
  previous: ConsensusSnapshot | null
): {
  brokerCount: number;
  avgUpside: number;
  entryScore: number;
  avgTargetPrice: number;
} | null {
  if (!previous) return null;

  return {
    brokerCount: current.brokerCount - previous.brokerCount,
    avgUpside: parseFloat((current.avgUpside - previous.avgUpside).toFixed(1)),
    entryScore: current.entryScore - previous.entryScore,
    avgTargetPrice: Math.round(current.avgTargetPrice - previous.avgTargetPrice),
  };
}

/**
 * 컨센서스 강화/약화 판정
 */
export function getTrend(
  brokerCountChange: number,
  entryScoreChange: number
): 'strengthening' | 'weakening' | 'stable' {
  if (brokerCountChange > 0 && entryScoreChange > 0) {
    return 'strengthening';
  }

  if (brokerCountChange < 0 || entryScoreChange < 0) {
    return 'weakening';
  }

  return 'stable';
}
