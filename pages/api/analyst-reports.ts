import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';

import { buildAnalystCacheFile, enrichReportsWithPerformance, filterAnalystReports } from '../../lib/analyst-report-source.mjs';
import type { AnalystReport, AnalystReportCacheFile, MarketFilter } from '../../lib/analyst-types';

type CacheFileMemoryEntry = {
  data: AnalystReportCacheFile;
  loadedAt: number;
};

const FILE_CACHE_TTL_MS = 60 * 1000;
const DEV_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_PRICE_TTL_MS = 2 * 60 * 1000;
let cacheFileMemory: CacheFileMemoryEntry | null = null;
let cacheFileInflight: Promise<AnalystReportCacheFile> | null = null;
let liveRefreshInflight: Promise<void> | null = null;
let performanceEnrichmentInflight: Promise<AnalystReportCacheFile> | null = null;
let lastLiveRefreshAt = 0;
const livePriceCache = new Map<string, { price: number; fetchedAt: number }>();
const livePriceInflight = new Map<string, Promise<number>>();

export async function loadAnalystCacheFile(): Promise<AnalystReportCacheFile> {
  if (cacheFileMemory && Date.now() - cacheFileMemory.loadedAt <= FILE_CACHE_TTL_MS) {
    return cacheFileMemory.data;
  }

  if (cacheFileInflight) {
    return cacheFileInflight;
  }

  const request = readFile(getAnalystCachePath(), 'utf8')
    .then((raw) => JSON.parse(raw) as AnalystReportCacheFile)
    .then((data) => {
      cacheFileMemory = {
        data,
        loadedAt: Date.now(),
      };
      return data;
    })
    .finally(() => {
      cacheFileInflight = null;
    });

  cacheFileInflight = request;
  return request;
}

function getAnalystCachePath() {
  return path.join(process.cwd(), 'data', 'analyst-reports-cache.json');
}

async function persistAnalystCacheFile(data: AnalystReportCacheFile) {
  await writeFile(getAnalystCachePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function scheduleLiveRefresh(currentData: AnalystReportCacheFile) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  if (liveRefreshInflight) {
    return;
  }

  if (Date.now() - lastLiveRefreshAt < DEV_REFRESH_INTERVAL_MS) {
    return;
  }

  lastLiveRefreshAt = Date.now();
  liveRefreshInflight = buildAnalystCacheFile(365)
    .then((nextData) => nextData as AnalystReportCacheFile)
    .then(async (nextData) => {
      const previous = JSON.stringify(currentData.reports);
      const next = JSON.stringify(nextData.reports);

      if (previous === next) {
        cacheFileMemory = {
          data: {
            ...currentData,
            generatedAt: nextData.generatedAt,
          },
          loadedAt: Date.now(),
        };
        return;
      }

      cacheFileMemory = {
        data: nextData,
        loadedAt: Date.now(),
      };
      await persistAnalystCacheFile(nextData);
    })
    .catch((error) => {
      console.error('Error refreshing analyst reports in development:', error);
    })
    .finally(() => {
      liveRefreshInflight = null;
    });
}

export async function loadAnalystData(): Promise<AnalystReportCacheFile> {
  let cacheFile: AnalystReportCacheFile;

  try {
    cacheFile = await loadAnalystCacheFile();
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }

    const liveData = await buildAnalystCacheFile(365) as AnalystReportCacheFile;
    cacheFileMemory = {
      data: liveData,
      loadedAt: Date.now(),
    };
    await persistAnalystCacheFile(liveData);
    return liveData;
  }

  const missingPerformance = cacheFile.reports.some((report) => !report.performance);
  if (missingPerformance) {
    if (!performanceEnrichmentInflight) {
      performanceEnrichmentInflight = enrichReportsWithPerformance(cacheFile.reports)
        .then(async (enrichedReports) => {
          const enrichedCacheFile = {
            ...cacheFile,
            reports: enrichedReports,
          };

          cacheFileMemory = {
            data: enrichedCacheFile,
            loadedAt: Date.now(),
          };
          await persistAnalystCacheFile(enrichedCacheFile);
          return enrichedCacheFile;
        })
        .finally(() => {
          performanceEnrichmentInflight = null;
        });
    }

    cacheFile = await performanceEnrichmentInflight;
  }

  scheduleLiveRefresh(cacheFile);
  return cacheFile;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

async function fetchKoreaLivePrice(ticker: string): Promise<number> {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return Number.parseInt(String(data.closePrice || '0').replace(/,/g, ''), 10) || 0;
  } catch {
    return 0;
  }
}

async function fetchUsLivePrice(ticker: string): Promise<number> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice || 0;
    return Math.round(price * 100) / 100;
  } catch {
    return 0;
  }
}

export async function fetchLiveCurrentPrice(ticker: string, market: AnalystReport['market']): Promise<number> {
  const key = `${market}:${ticker}`;
  const cached = livePriceCache.get(key);
  if (cached && Date.now() - cached.fetchedAt <= LIVE_PRICE_TTL_MS) {
    return cached.price;
  }

  const inflight = livePriceInflight.get(key);
  if (inflight) {
    return inflight;
  }

  const request = (market === 'korea' ? fetchKoreaLivePrice(ticker) : fetchUsLivePrice(ticker))
    .then((price) => {
      livePriceCache.set(key, { price, fetchedAt: Date.now() });
      return price;
    })
    .finally(() => {
      livePriceInflight.delete(key);
    });

  livePriceInflight.set(key, request);
  return request;
}

export async function enrichReportsWithLivePrices(reports: AnalystReport[]): Promise<AnalystReport[]> {
  const uniqueKeys = Array.from(new Set(reports.map((report) => `${report.market}:${report.ticker}`)));
  const livePrices = new Map<string, number>();

  await Promise.all(uniqueKeys.map(async (key) => {
    const [market, ticker] = key.split(':');
    const price = await fetchLiveCurrentPrice(ticker, market as AnalystReport['market']);
    livePrices.set(key, price);
  }));

  return reports.map((report) => {
    const livePrice = livePrices.get(`${report.market}:${report.ticker}`) || 0;
    if (livePrice <= 0) {
      return report;
    }

    return {
      ...report,
      currentPrice: livePrice,
      upside: report.targetPrice > 0 ? roundOne(((report.targetPrice - livePrice) / livePrice) * 100) : 0,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AnalystReport[] | { error: string }>) {
  const { days = '30', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cacheFile = await loadAnalystData();
    const cachedReports = filterAnalystReports(cacheFile.reports, daysNum, marketFilter) as AnalystReport[];
    const reports = await enrichReportsWithLivePrices(cachedReports);
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error reading analyst cache file:', error);
    res.status(500).json({ error: 'Failed to read analyst reports cache' });
  }
}

