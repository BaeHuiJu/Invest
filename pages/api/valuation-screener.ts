import type { NextApiRequest, NextApiResponse } from 'next';

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
import type { MarketType } from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

export interface ValuationItem {
  ticker: string;
  name: string;
  market: MarketType;
  currentPrice: number;
  per: number | null;
  pbr: number | null;
  dividendYield: number | null;
  roe: number | null;
  eps: number | null;
  marketCap: number | null;
  sector: string | null;
  brokerCount: number;
  avgUpside: number;
  entryScore: number;
}

export interface ValuationScreenerResponse {
  items: ValuationItem[];
  generatedAt: string;
  totalCount: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min (fundamental data changes slowly)
const CONCURRENT_FETCH_LIMIT = 15;

type CacheEntry = { data: ValuationScreenerResponse; fetchedAt: number };
const responseCache = new Map<string, CacheEntry>();
const responseInflight = new Map<string, Promise<ValuationScreenerResponse>>();

async function fetchKoreaFundamentals(ticker: string): Promise<Partial<ValuationItem>> {
  try {
    // Naver Finance polling API: returns EPS, BPS, dividend per share
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${ticker}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return {};

    const data = await res.json() as {
      result?: {
        areas?: Array<{
          datas?: Array<{
            sv?: number;   // current price
            nv?: number;   // previous close
            keps?: number; // trailing EPS (Korean annual)
            eps?: number;  // EPS (may be consensus)
            bps?: number;  // Book value per share
            dv?: number;   // Dividend per share
          }>;
        }>;
      };
    };

    const item = data.result?.areas?.[0]?.datas?.[0];
    if (!item) return {};

    const price = item.sv ?? item.nv ?? 0;
    // eps = annual EPS displayed on Naver Finance page (verified: matches _eps id on sise page)
    // keps = quarterly EPS — do NOT use for PER (gives wrong ~2x higher value)
    const eps = item.eps ?? null;
    const bps = item.bps ?? null;
    const dv = item.dv ?? null;

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      per: eps && eps > 0 && price > 0 ? round2(price / eps) : null,
      pbr: bps && bps > 0 && price > 0 ? round2(price / bps) : null,
      dividendYield: dv && dv > 0 && price > 0 ? round2((dv / price) * 100) : null,
      roe: null, // Not available directly from polling API
      eps: eps,
    };
  } catch {
    return {};
  }
}

async function fetchUSFundamentals(ticker: string): Promise<Partial<ValuationItem>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'assetProfile'],
    });

    const sd = summary?.summaryDetail;
    const ks = summary?.defaultKeyStatistics;
    const ap = summary?.assetProfile;

    if (!sd && !ks) return {};

    const dyRaw: number | null = sd?.dividendYield ?? null;
    const roeRaw: number | null = ks?.returnOnEquity ?? null;

    return {
      per: sd?.trailingPE ?? ks?.forwardPE ?? null,
      pbr: ks?.priceToBook ?? null,
      dividendYield: dyRaw !== null ? Math.round(dyRaw * 10000) / 100 : null,
      roe: roeRaw !== null ? Math.round(roeRaw * 10000) / 100 : null,
      eps: ks?.trailingEps ?? null,
      marketCap: sd?.marketCap ?? null,
      sector: ap?.sector ?? null,
    };
  } catch {
    return {};
  }
}

async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];
  const running: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    const task = queue.shift();
    if (!task) return;
    const result = await task();
    results.push(result);
    await runNext();
  };

  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    running.push(runNext());
  }

  await Promise.all(running);
  return results;
}

async function buildScreenerData(): Promise<ValuationScreenerResponse> {
  const cacheFile = await loadAnalystData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Deduplicate tickers from recent reports
  const tickerMap = new Map<string, { ticker: string; name: string; market: MarketType; brokerCount: number; avgUpside: number; entryScore: number; currentPrice: number; sector: string | null }>();

  for (const report of cacheFile.reports) {
    if (new Date(report.date) < cutoff) continue;
    const key = `${report.market}:${report.ticker}`;
    const existing = tickerMap.get(key);
    if (!existing) {
      tickerMap.set(key, {
        ticker: report.ticker,
        name: report.name,
        market: report.market,
        brokerCount: 1,
        avgUpside: report.upside,
        entryScore: 0,
        currentPrice: report.currentPrice,
        sector: report.sector ?? null,
      });
    } else {
      existing.brokerCount += 1;
      existing.avgUpside = (existing.avgUpside + report.upside) / 2;
      if (report.currentPrice > 0) existing.currentPrice = report.currentPrice;
    }
  }

  // Also enrich with consensus entryScore if available
  for (const [key, insight] of Object.entries(cacheFile.stockInsights ?? {})) {
    const [market, ticker] = key.split(':') as [MarketType, string];
    const mapKey = `${market}:${ticker}`;
    const item = tickerMap.get(mapKey);
    if (item) {
      item.sector = item.sector ?? insight.sectorCycle?.summary ?? null;
    }
  }

  const tickers = Array.from(tickerMap.values());

  // Fetch fundamental data in batches
  const tasks = tickers.map((stock) => async (): Promise<ValuationItem> => {
    const fundamentals =
      stock.market === 'korea'
        ? await fetchKoreaFundamentals(stock.ticker)
        : await fetchUSFundamentals(stock.ticker);

    return {
      ticker: stock.ticker,
      name: stock.name,
      market: stock.market,
      currentPrice: stock.currentPrice,
      per: fundamentals.per ?? null,
      pbr: fundamentals.pbr ?? null,
      dividendYield: fundamentals.dividendYield ?? null,
      roe: fundamentals.roe ?? null,
      eps: fundamentals.eps ?? null,
      marketCap: fundamentals.marketCap ?? null,
      sector: stock.sector ?? fundamentals.sector ?? null,
      brokerCount: stock.brokerCount,
      avgUpside: Math.round(stock.avgUpside * 10) / 10,
      entryScore: stock.entryScore,
    };
  });

  const items = await runWithConcurrencyLimit(tasks, CONCURRENT_FETCH_LIMIT);

  return {
    items,
    generatedAt: new Date().toISOString(),
    totalCount: items.length,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValuationScreenerResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const market = (req.query['market'] as string) || 'all';
  const cacheKey = `screener:${market}`;

  try {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.status(200).json(cached.data);
    }

    const inflight = responseInflight.get(cacheKey);
    const dataPromise =
      inflight ??
      buildScreenerData().then((data) => {
        // Apply market filter after building
        const filtered =
          market === 'all'
            ? data
            : { ...data, items: data.items.filter((item) => item.market === market), totalCount: data.items.filter((item) => item.market === market).length };
        responseCache.set(cacheKey, { data: filtered, fetchedAt: Date.now() });
        responseInflight.delete(cacheKey);
        return filtered;
      });

    if (!inflight) {
      responseInflight.set(cacheKey, dataPromise);
    }

    const result = await dataPromise;
    return res.status(200).json(result);
  } catch (error) {
    responseInflight.delete(cacheKey);
    console.error('Valuation screener error:', error);
    return res.status(500).json({ error: 'Failed to fetch valuation data' });
  }
}
