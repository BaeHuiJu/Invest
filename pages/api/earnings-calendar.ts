import type { NextApiRequest, NextApiResponse } from 'next';

type MarketType = 'korea' | 'us';
type EarningsTime = 'BMO' | 'AMC' | 'TBD'; // Before Market Open / After Market Close / To Be Determined

type EarningsEvent = {
  ticker: string;
  name: string;
  market: MarketType;
  date: string;
  time: EarningsTime;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  surprise?: number;
  isComplete: boolean;
};

type EarningsCalendarResponse = {
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
  watchlistTickers: string[];
};

type ErrorResponse = {
  error: string;
};

// Major US stocks earnings data (sample/static for demo)
const SAMPLE_US_EARNINGS: EarningsEvent[] = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'us',
    date: '2026-04-24',
    time: 'AMC',
    epsEstimate: 1.52,
    isComplete: false,
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corp.',
    market: 'us',
    date: '2026-04-22',
    time: 'AMC',
    epsEstimate: 2.83,
    epsActual: 2.94,
    surprise: 3.89,
    isComplete: true,
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    market: 'us',
    date: '2026-04-25',
    time: 'AMC',
    epsEstimate: 1.89,
    isComplete: false,
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    market: 'us',
    date: '2026-04-30',
    time: 'AMC',
    epsEstimate: 1.15,
    isComplete: false,
  },
  {
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    market: 'us',
    date: '2026-04-23',
    time: 'AMC',
    epsEstimate: 4.72,
    epsActual: 5.16,
    surprise: 9.32,
    isComplete: true,
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corp.',
    market: 'us',
    date: '2026-05-21',
    time: 'AMC',
    epsEstimate: 5.59,
    isComplete: false,
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    market: 'us',
    date: '2026-04-21',
    time: 'AMC',
    epsEstimate: 0.42,
    epsActual: 0.45,
    surprise: 7.14,
    isComplete: true,
  },
];

// Major Korean stocks earnings data (sample/static for demo)
const SAMPLE_KOREA_EARNINGS: EarningsEvent[] = [
  {
    ticker: '005930',
    name: '삼성전자',
    market: 'korea',
    date: '2026-04-25',
    time: 'BMO',
    epsEstimate: 1850,
    isComplete: false,
  },
  {
    ticker: '000660',
    name: 'SK하이닉스',
    market: 'korea',
    date: '2026-04-24',
    time: 'BMO',
    epsEstimate: 4200,
    epsActual: 4520,
    surprise: 7.62,
    isComplete: true,
  },
  {
    ticker: '373220',
    name: 'LG에너지솔루션',
    market: 'korea',
    date: '2026-04-28',
    time: 'BMO',
    epsEstimate: 2100,
    isComplete: false,
  },
  {
    ticker: '005380',
    name: '현대차',
    market: 'korea',
    date: '2026-04-24',
    time: 'BMO',
    epsEstimate: 18500,
    epsActual: 19200,
    surprise: 3.78,
    isComplete: true,
  },
  {
    ticker: '035420',
    name: 'NAVER',
    market: 'korea',
    date: '2026-04-26',
    time: 'AMC',
    epsEstimate: 1580,
    isComplete: false,
  },
  {
    ticker: '035720',
    name: '카카오',
    market: 'korea',
    date: '2026-05-08',
    time: 'BMO',
    epsEstimate: 420,
    isComplete: false,
  },
];

async function fetchYahooEarnings(ticker: string): Promise<EarningsEvent | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents,earningsHistory`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const calendarEvents = json.quoteSummary?.result?.[0]?.calendarEvents;

    if (!calendarEvents?.earnings) return null;

    const earnings = calendarEvents.earnings;
    const earningsDate = earnings.earningsDate?.[0]?.fmt;

    if (!earningsDate) return null;

    return {
      ticker,
      name: ticker, // Would need separate lookup
      market: 'us',
      date: earningsDate,
      time: 'TBD',
      epsEstimate: earnings.earningsAverage?.raw,
      isComplete: false,
    };
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EarningsCalendarResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { market = 'all', tickers } = req.query;
  const watchlistTickers = tickers ? (tickers as string).split(',') : [];

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Combine all earnings data
    let allEarnings: EarningsEvent[] = [...SAMPLE_US_EARNINGS, ...SAMPLE_KOREA_EARNINGS];

    // Filter by market
    if (market === 'korea') {
      allEarnings = allEarnings.filter((e) => e.market === 'korea');
    } else if (market === 'us') {
      allEarnings = allEarnings.filter((e) => e.market === 'us');
    }

    // If watchlist tickers provided, fetch their earnings
    if (watchlistTickers.length > 0) {
      // Check which watchlist tickers are already in our data
      const existingTickers = new Set(allEarnings.map((e) => e.ticker));
      const missingTickers = watchlistTickers.filter((t) => !existingTickers.has(t));

      // For US tickers not in our data, try to fetch from Yahoo
      for (const ticker of missingTickers) {
        if (ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
          const earnings = await fetchYahooEarnings(ticker);
          if (earnings) {
            allEarnings.push(earnings);
          }
        }
      }
    }

    // Split into upcoming and recent
    const upcoming = allEarnings
      .filter((e) => e.date >= todayStr && !e.isComplete)
      .sort((a, b) => a.date.localeCompare(b.date));

    const recent = allEarnings
      .filter((e) => e.isComplete || e.date < todayStr)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    return res.status(200).json({
      upcoming,
      recent,
      watchlistTickers,
    });
  } catch (error) {
    console.error('Earnings calendar error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch earnings',
    });
  }
}
