import type { NextApiRequest, NextApiResponse } from 'next';

// 주요 시장 지수
const INDICES = [
  { ticker: '^KS11', name: 'KOSPI', market: 'korea' },
  { ticker: '^KQ11', name: 'KOSDAQ', market: 'korea' },
  { ticker: '^GSPC', name: 'S&P 500', market: 'us' },
  { ticker: '^IXIC', name: 'NASDAQ', market: 'us' },
  { ticker: '^DJI', name: 'Dow Jones', market: 'us' },
];

async function fetchIndexData(ticker: string, name: string, market: string) {
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
    // 병렬로 데이터 가져오기
    const promises = INDICES.map((item) =>
      fetchIndexData(item.ticker, item.name, item.market)
    );
    const results = await Promise.all(promises);

    // null 제거
    const indices = results.filter((item) => item !== null);

    res.status(200).json(indices);
  } catch (error) {
    console.error('Error fetching market indices:', error);
    res.status(500).json({ error: 'Failed to fetch indices data' });
  }
}
