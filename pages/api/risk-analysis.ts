import type { NextApiRequest, NextApiResponse } from 'next';

import type { MarketType } from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

const CACHE_TTL_MS = 10 * 60 * 1000;
const RISK_FREE_RATE_ANNUAL = 0.03;
const TRADING_DAYS = 252;
const MAX_STOCKS = 15;
const MIN_DATA_POINTS = 20;

export interface StockRiskMetrics {
  ticker: string;
  name: string;
  market: MarketType;
  beta: number | null;
  volatility: number;
  sharpeRatio: number | null;
  var95: number;
  avgDailyReturn: number;
  currentPrice: number;
  dataPoints: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RiskAnalysisResponse {
  stocks: StockRiskMetrics[];
  portfolio: {
    avgBeta: number | null;
    avgVolatility: number;
    avgSharpe: number | null;
    portfolioVar95: number;
    marketDistribution: { korea: number; us: number };
    riskLevelDistribution: { low: number; medium: number; high: number };
  };
  generatedAt: string;
  dataRange: string;
}

type CacheEntry = { data: RiskAnalysisResponse; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RiskAnalysisResponse>>();

async function fetchClosePrices(
  ticker: string,
  market: MarketType
): Promise<number[]> {
  try {
    if (market === 'korea') {
      const url = `https://m.stock.naver.com/api/stock/${ticker}/price?pageSize=90&page=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json as Array<{ closePrice?: string }>)
        .map((item) => Number(item.closePrice))
        .filter((v) => v > 0)
        .reverse();
    } else {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      return (closes as (number | null)[]).filter((v): v is number => v != null);
    }
  } catch {
    return [];
  }
}

function dailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function covariance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len < 2) return 0;
  const ma = mean(a.slice(0, len));
  const mb = mean(b.slice(0, len));
  return (
    a.slice(0, len).reduce((s, v, i) => s + (v - ma) * (b[i]! - mb), 0) /
    (len - 1)
  );
}

function computeMetrics(
  prices: number[],
  benchmarkReturns: number[]
): Omit<StockRiskMetrics, 'ticker' | 'name' | 'market' | 'currentPrice' | 'riskScore' | 'riskLevel'> {
  const returns = dailyReturns(prices);
  const dataPoints = returns.length;

  if (dataPoints < MIN_DATA_POINTS) {
    return { beta: null, volatility: 0, sharpeRatio: null, var95: 0, avgDailyReturn: 0, dataPoints };
  }

  const mu = mean(returns);
  const sigma = stdDev(returns);
  const volatility = Math.round(sigma * Math.sqrt(TRADING_DAYS) * 1000) / 10;

  const rfDaily = RISK_FREE_RATE_ANNUAL / TRADING_DAYS;
  const annualReturn = mu * TRADING_DAYS;
  const sharpeRatio =
    sigma > 0
      ? Math.round(((annualReturn - RISK_FREE_RATE_ANNUAL) / (sigma * Math.sqrt(TRADING_DAYS))) * 100) / 100
      : null;

  const benchLen = Math.min(returns.length, benchmarkReturns.length);
  const varBench = stdDev(benchmarkReturns.slice(0, benchLen)) ** 2;
  const beta =
    varBench > 0 && benchLen >= MIN_DATA_POINTS
      ? Math.round((covariance(returns, benchmarkReturns) / varBench) * 100) / 100
      : null;

  const var95 = Math.round((-(mu - 1.645 * sigma) * 100) * 10) / 10;

  return {
    beta,
    volatility,
    sharpeRatio,
    var95: Math.max(0, var95),
    avgDailyReturn: Math.round(mu * 10000) / 100,
    dataPoints,
  };
}

function riskScore(volatility: number, beta: number | null, var95: number): number {
  const volScore = Math.min(40, (volatility / 80) * 40);
  const betaScore = beta != null ? Math.min(30, (Math.abs(beta) / 2) * 30) : 15;
  const varScore = Math.min(30, (var95 / 5) * 30);
  return Math.round(volScore + betaScore + varScore);
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 35) return 'low';
  if (score < 60) return 'medium';
  return 'high';
}

async function buildRiskAnalysis(): Promise<RiskAnalysisResponse> {
  const cacheFile = await loadAnalystData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Deduplicate: take the highest-scoring ticker per market
  const byKey = new Map<string, { ticker: string; name: string; market: MarketType; currentPrice: number; entryScore: number }>();
  for (const report of cacheFile.reports) {
    if (new Date(report.date) < cutoff) continue;
    const key = `${report.market}:${report.ticker}`;
    const existing = byKey.get(key);
    if (!existing || report.currentPrice > 0) {
      byKey.set(key, {
        ticker: report.ticker,
        name: report.name,
        market: report.market,
        currentPrice: report.currentPrice,
        entryScore: 0,
      });
    }
  }

  const candidates = Array.from(byKey.values()).slice(0, MAX_STOCKS);

  // Fetch benchmark returns
  const [kospiPrices, spPrices] = await Promise.all([
    fetchClosePrices('%5EKS11', 'us'),
    fetchClosePrices('%5EGSPC', 'us'),
  ]);
  const kospiReturns = dailyReturns(kospiPrices);
  const spReturns = dailyReturns(spPrices);

  // Fetch all stock prices in parallel
  const priceResults = await Promise.all(
    candidates.map((c) => fetchClosePrices(c.ticker, c.market))
  );

  const stocks: StockRiskMetrics[] = candidates.map((c, i) => {
    const prices = priceResults[i]!;
    const benchReturns = c.market === 'korea' ? kospiReturns : spReturns;
    const metrics = computeMetrics(prices, benchReturns);
    const currentPrice = prices.length > 0 ? (prices[prices.length - 1] ?? c.currentPrice) : c.currentPrice;
    const score = riskScore(metrics.volatility, metrics.beta, metrics.var95);
    return {
      ticker: c.ticker,
      name: c.name,
      market: c.market,
      currentPrice,
      riskScore: score,
      riskLevel: riskLevel(score),
      ...metrics,
    };
  }).filter((s) => s.dataPoints >= MIN_DATA_POINTS);

  const withBeta = stocks.filter((s) => s.beta !== null);
  const withSharpe = stocks.filter((s) => s.sharpeRatio !== null);

  const portfolio = {
    avgBeta:
      withBeta.length > 0
        ? Math.round((withBeta.reduce((s, v) => s + v.beta!, 0) / withBeta.length) * 100) / 100
        : null,
    avgVolatility:
      stocks.length > 0
        ? Math.round((stocks.reduce((s, v) => s + v.volatility, 0) / stocks.length) * 10) / 10
        : 0,
    avgSharpe:
      withSharpe.length > 0
        ? Math.round((withSharpe.reduce((s, v) => s + v.sharpeRatio!, 0) / withSharpe.length) * 100) / 100
        : null,
    portfolioVar95:
      stocks.length > 0
        ? Math.round((stocks.reduce((s, v) => s + v.var95, 0) / stocks.length) * 10) / 10
        : 0,
    marketDistribution: {
      korea: stocks.filter((s) => s.market === 'korea').length,
      us: stocks.filter((s) => s.market === 'us').length,
    },
    riskLevelDistribution: {
      low: stocks.filter((s) => s.riskLevel === 'low').length,
      medium: stocks.filter((s) => s.riskLevel === 'medium').length,
      high: stocks.filter((s) => s.riskLevel === 'high').length,
    },
  };

  return {
    stocks: stocks.sort((a, b) => b.riskScore - a.riskScore),
    portfolio,
    generatedAt: new Date().toISOString(),
    dataRange: '90일',
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RiskAnalysisResponse | { error: string }>
) {
  try {
    const cacheKey = 'risk-analysis';
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).json(cached.data);
    }

    const existing = inflight.get(cacheKey);
    const promise = existing ?? buildRiskAnalysis();
    if (!existing) inflight.set(cacheKey, promise);

    const data = await promise;
    cache.set(cacheKey, { data, fetchedAt: Date.now() });
    inflight.delete(cacheKey);

    return res.status(200).json(data);
  } catch (error) {
    inflight.delete('risk-analysis');
    console.error('Risk analysis error:', error);
    return res.status(500).json({ error: 'Failed to compute risk analysis' });
  }
}
