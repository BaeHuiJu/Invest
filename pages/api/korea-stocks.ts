import type { NextApiRequest, NextApiResponse } from 'next';

// 국내 주요 종목 목록
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

// 국내 주요 ETF 목록
const KOREA_ETFS = [
  { ticker: '069500', name: 'KODEX 200' },
  { ticker: '102110', name: 'TIGER 200' },
  { ticker: '122630', name: 'KODEX 레버리지' },
  { ticker: '252670', name: 'KODEX 200선물인버스2X' },
  { ticker: '091160', name: 'KODEX 반도체' },
  { ticker: '278530', name: 'KODEX 2차전지산업' },
  { ticker: '364980', name: 'KODEX Fn K-바이오' },
  { ticker: '139260', name: 'TIGER 200 IT' },
  { ticker: '381180', name: 'TIGER 미국테크TOP10 INDXX' },
  { ticker: '379810', name: 'KODEX 미국S&P500TR' },
];

async function fetchStockData(ticker: string) {
  try {
    const response = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/basic`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      ticker,
      name: data.stockName || data.stockNameEng,
      currentPrice: parseInt(data.closePrice?.replace(/,/g, '') || '0'),
      change: parseInt(data.compareToPreviousClosePrice?.replace(/,/g, '') || '0'),
      changePercent: parseFloat(data.fluctuationsRatio || '0'),
      volume: parseInt(data.accumulatedTradingVolume?.replace(/,/g, '') || '0'),
      marketCap: data.marketValue,
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type = 'stock' } = req.query;

  try {
    const list = type === 'etf' ? KOREA_ETFS : KOREA_STOCKS;

    // 병렬로 데이터 가져오기
    const promises = list.map((item) => fetchStockData(item.ticker));
    const results = await Promise.all(promises);

    // null 제거
    const stocks = results.filter((item) => item !== null);

    res.status(200).json(stocks);
  } catch (error) {
    console.error('Error fetching Korea stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks data' });
  }
}
