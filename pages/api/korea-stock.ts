import type { NextApiRequest, NextApiResponse } from 'next';

// 네이버 금융에서 국내 주식 데이터 가져오기
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'Ticker is required' });
  }

  try {
    // 네이버 금융 API 호출
    const response = await fetch(
      `https://m.stock.naver.com/api/stock/${ticker}/basic`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch stock data');
    }

    const data = await response.json();

    // 필요한 데이터 추출
    const stockData = {
      ticker: ticker,
      name: data.stockName || data.stockNameEng,
      currentPrice: parseInt(data.closePrice?.replace(/,/g, '') || '0'),
      change: parseInt(data.compareToPreviousClosePrice?.replace(/,/g, '') || '0'),
      changePercent: parseFloat(data.fluctuationsRatio || '0'),
      high: parseInt(data.highPrice?.replace(/,/g, '') || '0'),
      low: parseInt(data.lowPrice?.replace(/,/g, '') || '0'),
      volume: parseInt(data.accumulatedTradingVolume?.replace(/,/g, '') || '0'),
      marketCap: data.marketValue,
      high52w: parseInt(data.high52wPrice?.replace(/,/g, '') || '0'),
      low52w: parseInt(data.low52wPrice?.replace(/,/g, '') || '0'),
    };

    res.status(200).json(stockData);
  } catch (error) {
    console.error('Error fetching Korea stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
