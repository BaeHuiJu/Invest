import type { NextApiRequest, NextApiResponse } from 'next';

// Yahoo Finance API에서 해외 주식 데이터 가져오기
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'Ticker is required' });
  }

  try {
    // Yahoo Finance API 호출
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
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
    const quote = data.chart?.result?.[0];
    const meta = quote?.meta;
    const price = quote?.indicators?.quote?.[0];

    if (!meta) {
      throw new Error('No data available');
    }

    const currentPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    const stockData = {
      ticker: ticker.toUpperCase(),
      name: meta.shortName || meta.longName || ticker,
      currentPrice: Math.round(currentPrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      high: meta.regularMarketDayHigh || 0,
      low: meta.regularMarketDayLow || 0,
      volume: meta.regularMarketVolume || 0,
      high52w: meta.fiftyTwoWeekHigh || 0,
      low52w: meta.fiftyTwoWeekLow || 0,
      currency: meta.currency || 'USD',
    };

    res.status(200).json(stockData);
  } catch (error) {
    console.error('Error fetching US stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
