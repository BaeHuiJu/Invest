import type { NextApiRequest, NextApiResponse } from 'next';

type StockResponse = {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
};

type ApiCacheEntry = {
  data: StockResponse[];
  fetchedAt: number;
};

const API_CACHE_TTL_MS = 2 * 60 * 1000;
const stockApiCache = new Map<string, ApiCacheEntry>();
const stockApiInflight = new Map<string, Promise<StockResponse[]>>();

const KOREA_STOCKS = [
  { ticker: '005930', name: '삼성전자' },
  { ticker: '000660', name: 'SK하이닉스' },
  { ticker: '373220', name: 'LG에너지솔루션' },
  { ticker: '005380', name: '현대차' },
  { ticker: '006400', name: '삼성SDI' },
  { ticker: '035420', name: 'NAVER' },
  { ticker: '000270', name: '기아' },
  { ticker: '035720', name: '카카오' },
  { ticker: '005490', name: 'POSCO홀딩스' },
  { ticker: '051910', name: 'LG화학' },
];

const KOREA_ETFS = [
  { ticker: '069500', name: 'KODEX 200' },
  { ticker: '102110', name: 'TIGER 200' },
  { ticker: '122630', name: 'KODEX 레버리지' },
  { ticker: '252670', name: 'KODEX 200선물인버스2X' },
  { ticker: '091160', name: 'KODEX 반도체' },
  { ticker: '278530', name: 'KODEX 2차전지산업' },
  { ticker: '364980', name: 'KODEX Fn K-뉴딜디지털플러스' },
  { ticker: '139260', name: 'TIGER 200 IT' },
  { ticker: '381180', name: 'TIGER 미국필라델피아반도체나스닥' },
  { ticker: '379810', name: 'KODEX 미국S&P500TR' },
];

async function fetchStockData(ticker: string): Promise<StockResponse | null> {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      ticker,
      name: data.stockName || data.stockNameEng,
      currentPrice: parseInt(data.closePrice?.replace(/,/g, '') || '0', 10),
      change: parseInt(data.compareToPreviousClosePrice?.replace(/,/g, '') || '0', 10),
      changePercent: parseFloat(data.fluctuationsRatio || '0'),
      volume: parseInt(data.accumulatedTradingVolume?.replace(/,/g, '') || '0', 10),
      marketCap: data.marketValue,
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

    const list = type === 'etf' ? KOREA_ETFS : KOREA_STOCKS;
    const request = Promise.all(list.map((item) => fetchStockData(item.ticker)))
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
    console.error('Error fetching Korea stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks data' });
  }
}
