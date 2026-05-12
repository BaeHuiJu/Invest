import type { NextApiRequest, NextApiResponse } from 'next';

export interface CurrentPricesResponse {
  prices: Record<string, number>; // "ticker:market" → price
  fetchedAt: string;
}

const CACHE_TTL = 2 * 60 * 1000;
const cache = new Map<string, { price: number; fetchedAt: number }>();

async function fetchKoreaPrice(ticker: string): Promise<number> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const data = await res.json() as { closePrice?: string };
    return parseInt(data.closePrice?.replace(/,/g, '') ?? '0', 10);
  } catch {
    return 0;
  }
}

async function fetchUsPrice(ticker: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const data = await res.json() as { quoteResponse?: { result?: Array<{ regularMarketPrice?: number }> } };
    return data.quoteResponse?.result?.[0]?.regularMarketPrice ?? 0;
  } catch {
    return 0;
  }
}

async function getPrice(ticker: string, market: 'korea' | 'us'): Promise<number> {
  const key = `${ticker}:${market}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.price;

  const price = market === 'korea' ? await fetchKoreaPrice(ticker) : await fetchUsPrice(ticker);
  cache.set(key, { price, fetchedAt: Date.now() });
  return price;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CurrentPricesResponse | { error: string }>
) {
  // ?tickers=005930:korea,AAPL:us
  const raw = typeof req.query.tickers === 'string' ? req.query.tickers : '';
  if (!raw) return res.status(400).json({ error: 'tickers param required' });

  const pairs = raw.split(',').map((s) => {
    const [ticker, market] = s.trim().split(':');
    return { ticker: ticker ?? '', market: (market ?? 'korea') as 'korea' | 'us' };
  }).filter((p) => p.ticker);

  const results = await Promise.all(
    pairs.map(async ({ ticker, market }) => ({
      key: `${ticker}:${market}`,
      price: await getPrice(ticker, market),
    }))
  );

  const prices: Record<string, number> = {};
  for (const { key, price } of results) prices[key] = price;

  return res.status(200).json({ prices, fetchedAt: new Date().toISOString() });
}
