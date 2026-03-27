import type { NextApiRequest, NextApiResponse } from 'next';

type StockResponse = {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume?: number;
  high52w?: number;
  low52w?: number;
};

type ApiCacheEntry = {
  data: StockResponse[];
  fetchedAt: number;
};

const API_CACHE_TTL_MS = 2 * 60 * 1000;
const stockApiCache = new Map<string, ApiCacheEntry>();
const stockApiInflight = new Map<string, Promise<StockResponse[]>>();

const US_STOCKS = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'V', name: 'Visa' },
];

const US_ETFS = [
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust' },
  { ticker: 'DIA', name: 'SPDR Dow Jones Industrial' },
  { ticker: 'IWM', name: 'iShares Russell 2000' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market' },
  { ticker: 'VOO', name: 'Vanguard S&P 500' },
  { ticker: 'SOXX', name: 'iShares Semiconductor' },
  { ticker: 'XLK', name: 'Technology Select SPDR' },
  { ticker: 'XLF', name: 'Financial Select SPDR' },
  { ticker: 'GLD', name: 'SPDR Gold Shares' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury' },
  { ticker: 'VWO', name: 'Vanguard Emerging Markets' },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity' },
  { ticker: 'ARKK', name: 'ARK Innovation ETF' },
];

async function fetchStockData(ticker: string, name: string): Promise<StockResponse | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`,
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
      ticker: ticker.toUpperCase(),
      name: meta.shortName || meta.longName || name,
      currentPrice: Math.round(currentPrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: meta.regularMarketVolume || 0,
      high52w: meta.fiftyTwoWeekHigh || 0,
      low52w: meta.fiftyTwoWeekLow || 0,
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type = 'stock' } = req.query;
  const cacheKey = String(type);

  try {
    const cached = stockApiCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt <= API_CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }

    const inflight = stockApiInflight.get(cacheKey);
    if (inflight) {
      const data = await inflight;
      res.status(200).json(data);
      return;
    }

    const list = type === 'etf' ? US_ETFS : US_STOCKS;
    const request = Promise.all(list.map((item) => fetchStockData(item.ticker, item.name)))
      .then((results) => results.filter((item): item is StockResponse => item !== null))
      .then((stocks) => {
        stockApiCache.set(cacheKey, {
          data: stocks,
          fetchedAt: Date.now(),
        });
        return stocks;
      })
      .finally(() => {
        stockApiInflight.delete(cacheKey);
      });

    stockApiInflight.set(cacheKey, request);
    const stocks = await request;

    res.status(200).json(stocks);
  } catch (error) {
    console.error('Error fetching US stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks data' });
  }
}
