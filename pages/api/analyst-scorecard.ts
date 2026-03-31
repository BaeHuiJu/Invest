import type { NextApiRequest, NextApiResponse } from 'next';

import type {
  AnalystReport,
  AnalystScorecardGroup,
  AnalystScorecardPeriodSummary,
  AnalystScorecardResponse,
  MarketFilter,
  PerformancePoint,
} from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

const PERIOD_KEYS = ['week1', 'month1', 'month3'] as const;
const SCORECARD_CACHE_TTL_MS = 5 * 60 * 1000;

type ScorecardCacheEntry = {
  data: AnalystScorecardResponse;
  fetchedAt: number;
};

const responseCache = new Map<string, ScorecardCacheEntry>();
const responseInflight = new Map<string, Promise<AnalystScorecardResponse>>();

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function filterReports(reports: AnalystReport[], days: number, market: MarketFilter) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return reports
    .filter((report) => market === 'all' || report.market === market)
    .filter((report) => new Date(report.date) >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getCacheKey(days: number, market: MarketFilter) {
  return `${days}:${market}`;
}

function getCachedResponse(days: number, market: MarketFilter) {
  const cached = responseCache.get(getCacheKey(days, market));
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > SCORECARD_CACHE_TTL_MS) {
    responseCache.delete(getCacheKey(days, market));
    return null;
  }

  return cached.data;
}

function summarizePeriod(points: PerformancePoint[]): AnalystScorecardPeriodSummary {
  const eligible = points.filter((point) => point.status === 'complete');
  const successCount = eligible.filter((point) => point.success).length;
  const declineCount = eligible.filter((point) => point.returnPct < 0).length;
  const pendingCount = points.filter((point) => point.status === 'pending').length;
  const unavailableCount = points.filter((point) => point.status === 'unavailable').length;
  const avgReturnPct = eligible.length > 0
    ? roundOne(eligible.reduce((sum, point) => sum + point.returnPct, 0) / eligible.length)
    : 0;
  const avgTargetProgressPct = eligible.length > 0
    ? roundOne(eligible.reduce((sum, point) => sum + point.targetProgressPct, 0) / eligible.length)
    : 0;

  return {
    eligibleCount: eligible.length,
    successCount,
    declineCount,
    pendingCount,
    unavailableCount,
    successRate: eligible.length > 0 ? roundOne((successCount / eligible.length) * 100) : 0,
    declineRate: eligible.length > 0 ? roundOne((declineCount / eligible.length) * 100) : 0,
    avgReturnPct,
    avgTargetProgressPct,
  };
}

function buildGroup(key: string, label: string, reports: AnalystReport[]): AnalystScorecardGroup {
  const periodSummary = Object.fromEntries(
    PERIOD_KEYS.map((periodKey) => [
      periodKey,
      summarizePeriod(
        reports
          .map((report) => report.performance?.[periodKey])
          .filter((point): point is PerformancePoint => Boolean(point))
      ),
    ])
  ) as Record<(typeof PERIOD_KEYS)[number], AnalystScorecardPeriodSummary>;

  return {
    key,
    label,
    reportCount: reports.length,
    week1: periodSummary.week1,
    month1: periodSummary.month1,
    month3: periodSummary.month3,
  };
}

function buildGroupedSummary(
  reports: AnalystReport[],
  getKey: (report: AnalystReport) => string,
  getLabel: (report: AnalystReport) => string
) {
  const groups = new Map<string, AnalystReport[]>();

  for (const report of reports) {
    const key = getKey(report);
    const existing = groups.get(key) || [];
    existing.push(report);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => buildGroup(key, getLabel(items[0]), items))
    .sort((a, b) => {
      if (b.month1.successRate !== a.month1.successRate) {
        return b.month1.successRate - a.month1.successRate;
      }
      if (b.month3.successRate !== a.month3.successRate) {
        return b.month3.successRate - a.month3.successRate;
      }
      return b.reportCount - a.reportCount;
    });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalystScorecardResponse | { error: string }>
) {
  const { days = '90', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cached = getCachedResponse(daysNum, marketFilter);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const cacheKey = getCacheKey(daysNum, marketFilter);
    const inflight = responseInflight.get(cacheKey);
    const response = inflight || (async () => {
      const cacheFile = await loadAnalystData();
      const reports = filterReports(cacheFile.reports, daysNum, marketFilter);

      return {
        summary: {
          overall: buildGroup('overall', '\uC804\uCCB4', reports),
          byBroker: buildGroupedSummary(reports, (report) => report.broker, (report) => report.broker),
          byMarket: buildGroupedSummary(
            reports,
            (report) => report.market,
            (report) => (report.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678')
          ),
          bySector: buildGroupedSummary(
            reports,
            (report) => report.sector || '\uAE30\uD0C0',
            (report) => report.sector || '\uAE30\uD0C0'
          ),
        },
        reports,
      } satisfies AnalystScorecardResponse;
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
    responseInflight.delete(getCacheKey(daysNum, marketFilter));
    console.error('Error building analyst scorecard:', error);
    res.status(500).json({ error: 'Failed to build analyst scorecard' });
  }
}

