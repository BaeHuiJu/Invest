import type { NextApiRequest, NextApiResponse } from 'next';

import type { AnalystReport, MarketType } from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

type StockResult = {
  ticker: string;
  name: string;
  market: MarketType;
};

type AnalystResult = {
  analyst: string;
  broker: string;
  reportCount: number;
};

type BrokerResult = {
  broker: string;
  reportCount: number;
};

type ReportResult = {
  ticker: string;
  name: string;
  market: MarketType;
  broker: string;
  analyst: string;
  date: string;
  reportTitle?: string;
};

type SearchResult = {
  stocks: StockResult[];
  analysts: AnalystResult[];
  brokers: BrokerResult[];
  reports: ReportResult[];
};

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim();
}

function matchesQuery(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResult | { error: string }>
) {
  const { q } = req.query;
  const query = normalizeQuery(String(q || ''));

  if (!query || query.length < 2) {
    return res.status(200).json({
      stocks: [],
      analysts: [],
      brokers: [],
      reports: [],
    });
  }

  try {
    const cacheFile = await loadAnalystData();
    const reports = cacheFile.reports;

    const stockMap = new Map<string, StockResult>();
    const analystMap = new Map<string, AnalystResult>();
    const brokerMap = new Map<string, BrokerResult>();
    const matchedReports: ReportResult[] = [];

    for (const report of reports) {
      const stockKey = `${report.market}:${report.ticker}`;
      const analystKey = `${report.broker}:${report.analyst}`;

      const matchesStock = matchesQuery(report.name, query) || matchesQuery(report.ticker, query);
      const matchesAnalyst = matchesQuery(report.analyst, query);
      const matchesBroker = matchesQuery(report.broker, query);
      const matchesTitle = matchesQuery(report.reportTitle, query);

      if (matchesStock) {
        if (!stockMap.has(stockKey)) {
          stockMap.set(stockKey, {
            ticker: report.ticker,
            name: report.name,
            market: report.market,
          });
        }
      }

      if (matchesAnalyst) {
        const existing = analystMap.get(analystKey);
        if (existing) {
          existing.reportCount++;
        } else {
          analystMap.set(analystKey, {
            analyst: report.analyst,
            broker: report.broker,
            reportCount: 1,
          });
        }
      }

      if (matchesBroker) {
        const existing = brokerMap.get(report.broker);
        if (existing) {
          existing.reportCount++;
        } else {
          brokerMap.set(report.broker, {
            broker: report.broker,
            reportCount: 1,
          });
        }
      }

      if (matchesStock || matchesAnalyst || matchesBroker || matchesTitle) {
        matchedReports.push({
          ticker: report.ticker,
          name: report.name,
          market: report.market,
          broker: report.broker,
          analyst: report.analyst,
          date: report.date,
          reportTitle: report.reportTitle,
        });
      }
    }

    const stocks = Array.from(stockMap.values()).slice(0, 10);
    const analysts = Array.from(analystMap.values())
      .sort((a, b) => b.reportCount - a.reportCount)
      .slice(0, 10);
    const brokers = Array.from(brokerMap.values())
      .sort((a, b) => b.reportCount - a.reportCount)
      .slice(0, 10);
    const reportsResult = matchedReports
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    res.status(200).json({
      stocks,
      analysts,
      brokers,
      reports: reportsResult,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}
