import type { NextApiRequest, NextApiResponse } from 'next';

type MarketIndexResponse = {
  ticker: string;
  name: string;
  market: string;
  value: number;
  change: number;
  changePercent: number;
};

type ApiCacheEntry = {
  data: MarketIndexResponse[];
  fetchedAt: number;
};

const API_CACHE_TTL_MS = 2 * 60 * 1000;
const indicesApiCache = new Map<string, ApiCacheEntry>();
const indicesApiInflight = new Map<string, Promise<MarketIndexResponse[]>>();

const INDICES = [
  { ticker: '^KS11', name: 'KOSPI', market: 'korea' },
  { ticker: '^KQ11', name: 'KOSDAQ', market: 'korea' },
  { ticker: '^GSPC', name: 'S&P 500', market: 'us' },
  { ticker: '^IXIC', name: 'NASDAQ', market: 'us' },
  { ticker: '^DJI', name: 'Dow Jones', market: 'us' },
];

async function fetchIndexData(
  ticker: string,
  name: string,
  market: string
): Promise<MarketIndexResponse | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const quote = data.chart?.result?.[0];
    const meta = quote?.meta;

    if (!meta) return null;

    const currentPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    return {
      ticker,
      name,
      market,
      value: Math.round(currentPrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cacheKey = 'all';
    const cached = indicesApiCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt <= API_CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }

    const inflight = indicesApiInflight.get(cacheKey);
    if (inflight) {
      const data = await inflight;
      res.status(200).json(data);
      return;
    }

    const request = Promise.all(
      INDICES.map((item) => fetchIndexData(item.ticker, item.name, item.market))
    )
      .then((results) => results.filter((item): item is MarketIndexResponse => item !== null))
      .then((indices) => {
        indicesApiCache.set(cacheKey, {
          data: indices,
          fetchedAt: Date.now(),
        });
        return indices;
      })
      .finally(() => {
        indicesApiInflight.delete(cacheKey);
      });

    indicesApiInflight.set(cacheKey, request);
    const indices = await request;

    res.status(200).json(indices);
  } catch (error) {
    console.error('Error fetching market indices:', error);
    res.status(500).json({ error: 'Failed to fetch indices data' });
  }
}
