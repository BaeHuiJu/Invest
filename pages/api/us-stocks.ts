import type { NextApiRequest, NextApiResponse } from 'next';

// 해외 주요 종목 목록
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

// 해외 주요 ETF 목록
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

async function fetchStockData(ticker: string, name: string) {
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

  try {
    const list = type === 'etf' ? US_ETFS : US_STOCKS;

    // 병렬로 데이터 가져오기
    const promises = list.map((item) => fetchStockData(item.ticker, item.name));
    const results = await Promise.all(promises);

    // null 제거
    const stocks = results.filter((item) => item !== null);

    res.status(200).json(stocks);
  } catch (error) {
    console.error('Error fetching US stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks data' });
  }
}
