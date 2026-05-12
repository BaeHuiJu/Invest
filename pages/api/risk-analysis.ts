import type { NextApiRequest, NextApiResponse } from 'next';

import type { MarketType } from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_STOCKS = 20;
const CANDIDATE_DAYS = 60;

export interface StockRiskMetrics {
  ticker: string;
  name: string;
  market: MarketType;

  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';

  entryScore: number;
  avgUpside: number;
  brokerCount: number;
  brokers: string[];
  reportCount: number;
  latestReportDate: string;

  currentPrice: number;
  avgTargetPrice: number;
  basePrice: number;

  successRate: number | null;
  avgReturnPct: number | null;
  completedCount: number;

  entryScoreBreakdown: {
    priceVsBase: number;
    targetGap: number;
    reportCount: number;
    consensusStrength: number;
  };
}

export interface RiskAnalysisResponse {
  stocks: StockRiskMetrics[];
  portfolio: {
    avgRiskScore: number;
    avgEntryScore: number;
    avgUpside: number;
    successRate: number | null;
    marketDist: { korea: number; us: number };
    riskDist: { low: number; medium: number; high: number };
  };
  generatedAt: string;
  totalCandidates: number;
}

type CacheEntry = { data: RiskAnalysisResponse; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RiskAnalysisResponse>>();

function computeRiskScore(
  entryScore: number,
  avgUpside: number,
  brokerCount: number,
  successRate: number | null
): number {
  // Entry risk (0-35): low entry score = harder to find good entry = risky
  const entryRisk = Math.round(((100 - Math.min(100, entryScore)) / 100) * 35);

  // Upside/volatility risk (0-30): higher target upside = more volatile expected
  const upsideRisk = Math.round(Math.min(1, avgUpside / 80) * 30);

  // Consensus risk (0-20): fewer brokers = weaker consensus = riskier
  const consensusRisk = Math.round(Math.max(0, (5 - Math.min(5, brokerCount)) / 4) * 20);

  // Historical risk (0-15): low success rate = historically risky
  const histRisk =
    successRate != null
      ? Math.round((1 - successRate / 100) * 15)
      : 8; // neutral if no data

  return Math.min(100, entryRisk + upsideRisk + consensusRisk + histRisk);
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 40) return 'low';
  if (score < 65) return 'medium';
  return 'high';
}

async function buildRiskAnalysis(): Promise<RiskAnalysisResponse> {
  const cacheFile = await loadAnalystData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CANDIDATE_DAYS);

  const reports = cacheFile.reports.filter((r) => new Date(r.date) >= cutoff);

  // Group by market:ticker (same as consensus logic)
  const groups = new Map<string, typeof reports>();
  for (const report of reports) {
    const key = `${report.market}:${report.ticker}`;
    const arr = groups.get(key) ?? [];
    arr.push(report);
    groups.set(key, arr);
  }

  const stocks: StockRiskMetrics[] = [];

  for (const group of Array.from(groups.values())) {
    const sorted = [...group].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const brokers = Array.from(new Set(sorted.map((r) => r.broker)));
    const latest = sorted[0]!;

    const currentPrice = latest.currentPrice;
    const avgTargetPrice =
      sorted.reduce((s, r) => s + r.targetPrice, 0) / sorted.length;
    const avgUpside =
      currentPrice > 0
        ? Math.round(((avgTargetPrice - currentPrice) / currentPrice) * 1000) / 10
        : 0;

    // Entry score (reuse same formula as ai-picks)
    const priceVsBaseRatio =
      latest.basePrice > 0 ? (latest.basePrice - currentPrice) / latest.basePrice : 0;
    const targetGapRatio =
      currentPrice > 0 ? (avgTargetPrice - currentPrice) / currentPrice : 0;

    const scale = (ratio: number, target: number, max: number) =>
      Math.max(0, Math.min(max, (ratio / target) * max));

    const scoreReportCount = (n: number) => {
      if (n <= 1) return 0;
      if (n === 2) return 5;
      if (n === 3) return 10;
      if (n === 4) return 13;
      return 15;
    };
    const scoreConsensus = (n: number) => {
      if (n <= 1) return 0;
      if (n === 2) return 10;
      if (n === 3) return 15;
      if (n === 4) return 18;
      return 20;
    };

    const breakdown = {
      priceVsBase: Math.round(scale(priceVsBaseRatio, 0.15, 30)),
      targetGap: Math.round(scale(targetGapRatio, 0.4, 35)),
      reportCount: Math.round(scoreReportCount(sorted.length)),
      consensusStrength: Math.round(scoreConsensus(brokers.length)),
    };
    const entryScore = Math.min(
      100,
      breakdown.priceVsBase + breakdown.targetGap + breakdown.reportCount + breakdown.consensusStrength
    );

    // Performance stats from completed records
    const completedM1 = sorted
      .map((r) => r.performance?.month1)
      .filter((p): p is NonNullable<typeof p> => p?.status === 'complete');

    const completedCount = completedM1.length;
    const successRate =
      completedCount > 0
        ? Math.round((completedM1.filter((p) => p.success).length / completedCount) * 1000) / 10
        : null;
    const avgReturnPct =
      completedCount > 0
        ? Math.round(
            (completedM1.reduce((s, p) => s + p.returnPct, 0) / completedCount) * 10
          ) / 10
        : null;

    const score = computeRiskScore(entryScore, avgUpside, brokers.length, successRate);

    stocks.push({
      ticker: latest.ticker,
      name: latest.name,
      market: latest.market,
      riskScore: score,
      riskLevel: riskLevel(score),
      entryScore,
      entryScoreBreakdown: breakdown,
      avgUpside,
      brokerCount: brokers.length,
      brokers,
      reportCount: sorted.length,
      latestReportDate: latest.date,
      currentPrice,
      avgTargetPrice: Math.round(avgTargetPrice * 10) / 10,
      basePrice: latest.basePrice,
      successRate,
      avgReturnPct,
      completedCount,
    });
  }

  const top = stocks
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, MAX_STOCKS);

  const withSuccess = top.filter((s) => s.successRate !== null);

  const portfolio = {
    avgRiskScore:
      top.length > 0
        ? Math.round(top.reduce((s, v) => s + v.riskScore, 0) / top.length)
        : 0,
    avgEntryScore:
      top.length > 0
        ? Math.round(top.reduce((s, v) => s + v.entryScore, 0) / top.length)
        : 0,
    avgUpside:
      top.length > 0
        ? Math.round((top.reduce((s, v) => s + v.avgUpside, 0) / top.length) * 10) / 10
        : 0,
    successRate:
      withSuccess.length > 0
        ? Math.round(
            (withSuccess.reduce((s, v) => s + v.successRate!, 0) / withSuccess.length) * 10
          ) / 10
        : null,
    marketDist: {
      korea: top.filter((s) => s.market === 'korea').length,
      us: top.filter((s) => s.market === 'us').length,
    },
    riskDist: {
      low: top.filter((s) => s.riskLevel === 'low').length,
      medium: top.filter((s) => s.riskLevel === 'medium').length,
      high: top.filter((s) => s.riskLevel === 'high').length,
    },
  };

  return {
    stocks: top,
    portfolio,
    generatedAt: new Date().toISOString(),
    totalCandidates: stocks.length,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RiskAnalysisResponse | { error: string }>
) {
  try {
    const key = 'risk-analysis';
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).json(cached.data);
    }

    const existing = inflight.get(key);
    const promise = existing ?? buildRiskAnalysis();
    if (!existing) inflight.set(key, promise);

    const data = await promise;
    cache.set(key, { data, fetchedAt: Date.now() });
    inflight.delete(key);

    return res.status(200).json(data);
  } catch (error) {
    inflight.delete('risk-analysis');
    console.error('Risk analysis error:', error);
    return res.status(500).json({ error: 'Failed to compute risk analysis' });
  }
}
