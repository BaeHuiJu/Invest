import type { NextApiRequest, NextApiResponse } from 'next';
import type { AnalystReport } from '@/lib/analyst-types';
import fs from 'fs';
import path from 'path';

type BacktestStrategy = 'follow_all' | 'top_broker' | 'high_entry_score' | 'consensus_only';
type PerformancePeriod = 'week1' | 'month1' | 'month3';
type MarketFilter = 'all' | 'korea' | 'us';

type BacktestTrade = {
  date: string;
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  broker: string;
  analyst: string;
  entryPrice: number;
  targetPrice: number;
  exitPrice: number;
  returnPct: number;
  targetProgressPct: number;
  success: boolean;
};

type BacktestResult = {
  strategy: BacktestStrategy;
  period: PerformancePeriod;
  market: MarketFilter;
  filters: {
    minEntryScore?: number;
    brokers?: string[];
    days: number;
  };
  summary: {
    totalTrades: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgReturn: number;
    totalReturn: number;
    maxReturn: number;
    minReturn: number;
    avgTargetProgress: number;
  };
  byBroker: {
    broker: string;
    trades: number;
    winRate: number;
    avgReturn: number;
  }[];
  trades: BacktestTrade[];
  equityCurve: { date: string; cumReturn: number }[];
};

type ErrorResponse = {
  error: string;
};

// Cache for analyst reports
let reportsCache: { data: AnalystReport[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

function loadAnalystReports(): AnalystReport[] {
  if (reportsCache && Date.now() - reportsCache.loadedAt < CACHE_TTL_MS) {
    return reportsCache.data;
  }

  const cachePath = path.join(process.cwd(), 'data', 'analyst-reports-cache.json');
  const raw = fs.readFileSync(cachePath, 'utf-8');
  const cache = JSON.parse(raw);

  reportsCache = {
    data: cache.reports || [],
    loadedAt: Date.now(),
  };

  return reportsCache.data;
}

// Top performing brokers (can be dynamic based on scorecard)
const TOP_BROKERS = ['삼성증권', 'NH투자증권', '한국투자증권', '미래에셋증권', 'KB증권'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BacktestResult | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    strategy = 'follow_all',
    period = 'month1',
    market = 'all',
    days = '90',
    minEntryScore,
    brokers,
  } = req.query;

  const validStrategies: BacktestStrategy[] = ['follow_all', 'top_broker', 'high_entry_score', 'consensus_only'];
  const validPeriods: PerformancePeriod[] = ['week1', 'month1', 'month3'];

  if (!validStrategies.includes(strategy as BacktestStrategy)) {
    return res.status(400).json({ error: `strategy must be one of: ${validStrategies.join(', ')}` });
  }

  if (!validPeriods.includes(period as PerformancePeriod)) {
    return res.status(400).json({ error: `period must be one of: ${validPeriods.join(', ')}` });
  }

  try {
    const allReports = loadAnalystReports();
    const daysNum = parseInt(days as string, 10) || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Filter reports by date and market
    let reports = allReports.filter((r) => {
      if (r.date < cutoffStr) return false;
      if (market !== 'all' && r.market !== market) return false;
      return true;
    });

    // Apply strategy filters
    if (strategy === 'top_broker') {
      reports = reports.filter((r) => TOP_BROKERS.includes(r.broker));
    } else if (strategy === 'high_entry_score') {
      const minScore = minEntryScore ? parseInt(minEntryScore as string, 10) : 70;
      // Would need entryScore in report data - for now use upside as proxy
      reports = reports.filter((r) => (r.upside || 0) >= 20);
    } else if (strategy === 'consensus_only') {
      // Group by ticker and only include tickers with 2+ brokers
      const tickerBrokers = new Map<string, Set<string>>();
      reports.forEach((r) => {
        if (!tickerBrokers.has(r.ticker)) {
          tickerBrokers.set(r.ticker, new Set());
        }
        tickerBrokers.get(r.ticker)!.add(r.broker);
      });
      const consensusTickers = new Set(
        Array.from(tickerBrokers.entries())
          .filter(([, brokers]) => brokers.size >= 2)
          .map(([ticker]) => ticker)
      );
      reports = reports.filter((r) => consensusTickers.has(r.ticker));
    }

    // Apply broker filter if specified
    if (brokers && typeof brokers === 'string') {
      const brokerList = brokers.split(',').map((b) => b.trim());
      reports = reports.filter((r) => brokerList.includes(r.broker));
    }

    // Build trades from reports with complete performance data
    const periodKey = period as PerformancePeriod;
    const trades: BacktestTrade[] = [];

    for (const report of reports) {
      const perf = report.performance?.[periodKey];
      if (!perf || perf.status !== 'complete') continue;
      if (perf.returnPct == null || perf.targetProgressPct == null) continue;

      const exitPrice = report.basePrice * (1 + perf.returnPct / 100);

      trades.push({
        date: report.date,
        ticker: report.ticker,
        name: report.name,
        market: report.market,
        broker: report.broker,
        analyst: report.analyst,
        entryPrice: report.basePrice,
        targetPrice: report.targetPrice,
        exitPrice: Number(exitPrice.toFixed(2)),
        returnPct: perf.returnPct,
        targetProgressPct: perf.targetProgressPct,
        success: perf.targetProgressPct >= 70,
      });
    }

    // Sort trades by date
    trades.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary statistics
    const winCount = trades.filter((t) => t.success).length;
    const lossCount = trades.length - winCount;
    const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
    const avgReturn = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length
      : 0;
    const totalReturn = trades.reduce((sum, t) => sum + t.returnPct, 0);
    const returns = trades.map((t) => t.returnPct);
    const maxReturn = returns.length > 0 ? Math.max(...returns) : 0;
    const minReturn = returns.length > 0 ? Math.min(...returns) : 0;
    const avgTargetProgress = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.targetProgressPct, 0) / trades.length
      : 0;

    // Calculate by broker
    const brokerStats = new Map<string, { trades: number; wins: number; totalReturn: number }>();
    for (const trade of trades) {
      const stats = brokerStats.get(trade.broker) || { trades: 0, wins: 0, totalReturn: 0 };
      stats.trades++;
      if (trade.success) stats.wins++;
      stats.totalReturn += trade.returnPct;
      brokerStats.set(trade.broker, stats);
    }

    const byBroker = Array.from(brokerStats.entries())
      .map(([broker, stats]) => ({
        broker,
        trades: stats.trades,
        winRate: (stats.wins / stats.trades) * 100,
        avgReturn: stats.totalReturn / stats.trades,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    // Build equity curve (cumulative return by date)
    const equityCurve: { date: string; cumReturn: number }[] = [];
    let cumReturn = 0;
    const dailyReturns = new Map<string, number>();

    for (const trade of trades) {
      const existing = dailyReturns.get(trade.date) || 0;
      dailyReturns.set(trade.date, existing + trade.returnPct);
    }

    const sortedDates = Array.from(dailyReturns.keys()).sort();
    for (const date of sortedDates) {
      cumReturn += dailyReturns.get(date)!;
      equityCurve.push({ date, cumReturn: Number(cumReturn.toFixed(2)) });
    }

    const result: BacktestResult = {
      strategy: strategy as BacktestStrategy,
      period: periodKey,
      market: market as MarketFilter,
      filters: {
        minEntryScore: minEntryScore ? parseInt(minEntryScore as string, 10) : undefined,
        brokers: brokers ? (brokers as string).split(',') : undefined,
        days: daysNum,
      },
      summary: {
        totalTrades: trades.length,
        winCount,
        lossCount,
        winRate: Number(winRate.toFixed(1)),
        avgReturn: Number(avgReturn.toFixed(2)),
        totalReturn: Number(totalReturn.toFixed(2)),
        maxReturn: Number(maxReturn.toFixed(2)),
        minReturn: Number(minReturn.toFixed(2)),
        avgTargetProgress: Number(avgTargetProgress.toFixed(1)),
      },
      byBroker,
      trades: trades.slice(-100), // Return last 100 trades
      equityCurve,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Backtest error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to run backtest',
    });
  }
}
