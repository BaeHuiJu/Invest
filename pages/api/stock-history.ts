import type { NextApiRequest, NextApiResponse } from 'next';

type MarketType = 'korea' | 'us';

type OHLCData = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type StockHistoryResponse = {
  ticker: string;
  market: MarketType;
  range: string;
  interval: string;
  data: OHLCData[];
};

type ErrorResponse = {
  error: string;
};

// Cache for historical data (5 minute TTL)
const historyCache = new Map<string, { data: StockHistoryResponse; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchYahooHistory(
  ticker: string,
  range: string,
  interval: string
): Promise<OHLCData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }

  const json = await response.json();
  const result = json.chart?.result?.[0];

  if (!result) {
    throw new Error('No data returned from Yahoo Finance');
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const data: OHLCData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    // Skip entries with missing data
    if (open == null || high == null || low == null || close == null) {
      continue;
    }

    data.push({
      date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: volume || 0,
    });
  }

  return data;
}

async function fetchNaverHistory(
  ticker: string,
  range: string
): Promise<OHLCData[]> {
  // Naver Finance chart API
  // Range mapping: 1mo -> 30, 3mo -> 90, 6mo -> 180, 1y -> 365
  const days =
    range === '1mo' ? 30 : range === '3mo' ? 90 : range === '6mo' ? 180 : 365;

  const url = `https://m.stock.naver.com/api/stock/${ticker}/price?pageSize=${days}&page=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Naver Finance API error: ${response.status}`);
  }

  const json = await response.json();
  const prices = json || [];

  const data: OHLCData[] = [];
  for (const item of prices) {
    if (!item.localTradedAt) continue;

    data.push({
      date: item.localTradedAt.split('T')[0],
      open: Number(item.openPrice) || Number(item.closePrice) || 0,
      high: Number(item.highPrice) || 0,
      low: Number(item.lowPrice) || 0,
      close: Number(item.closePrice) || 0,
      volume: Number(item.accumulatedTradingVolume) || 0,
    });
  }

  // Naver returns newest first, reverse to oldest first
  return data.reverse();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StockHistoryResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ticker, market, range = '3mo', interval = '1d' } = req.query;

  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'ticker parameter is required' });
  }

  if (!market || (market !== 'korea' && market !== 'us')) {
    return res.status(400).json({ error: 'market must be "korea" or "us"' });
  }

  const validRanges = ['1mo', '3mo', '6mo', '1y'];
  const validIntervals = ['1d', '1wk'];

  if (!validRanges.includes(range as string)) {
    return res.status(400).json({ error: `range must be one of: ${validRanges.join(', ')}` });
  }

  if (!validIntervals.includes(interval as string)) {
    return res.status(400).json({ error: `interval must be one of: ${validIntervals.join(', ')}` });
  }

  const cacheKey = `${market}:${ticker}:${range}:${interval}`;
  const cached = historyCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    let data: OHLCData[];

    if (market === 'korea') {
      data = await fetchNaverHistory(ticker, range as string);
    } else {
      data = await fetchYahooHistory(ticker, range as string, interval as string);
    }

    const result: StockHistoryResponse = {
      ticker,
      market: market as MarketType,
      range: range as string,
      interval: interval as string,
      data,
    };

    historyCache.set(cacheKey, { data: result, fetchedAt: Date.now() });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Stock history fetch error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch stock history',
    });
  }
}
