import type { NextApiRequest, NextApiResponse } from 'next';

import type { AnalystConsensusItem, AnalystReport, MarketFilter } from '../../lib/analyst-types';
import { fetchLiveCurrentPrice, loadAnalystData } from './analyst-reports';

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function sortByLatestDateDesc(a: AnalystReport, b: AnalystReport) {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function filterReports(reports: AnalystReport[], days: number, market: MarketFilter) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return reports
    .filter((report) => market === 'all' || report.market === market)
    .filter((report) => new Date(report.date) >= cutoff);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalystConsensusItem[] | { error: string }>
) {
  const { days = '30', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cacheFile = await loadAnalystData();
    const reports = filterReports(cacheFile.reports, daysNum, marketFilter);
    const groups = new Map<string, AnalystReport[]>();

    for (const report of reports) {
      const key = `${report.market}:${report.ticker}`;
      const existing = groups.get(key) || [];
      existing.push(report);
      groups.set(key, existing);
    }

    const items = await Promise.all(
      Array.from(groups.values()).map(async (group) => {
        const sorted = [...group].sort(sortByLatestDateDesc);
        const brokers = Array.from(new Set(sorted.map((report) => report.broker)));
        if (brokers.length < 2) {
          return null;
        }

        const latest = sorted[0];
        const livePrice = await fetchLiveCurrentPrice(latest.ticker, latest.market);
        const currentPrice = livePrice > 0 ? livePrice : latest.currentPrice;
        const relatedReports = sorted.map((report) => ({
          ...report,
          currentPrice,
          upside: report.targetPrice > 0 && currentPrice > 0
            ? roundOne(((report.targetPrice - currentPrice) / currentPrice) * 100)
            : 0,
        }));
        const avgUpside = relatedReports.length > 0
          ? roundOne(relatedReports.reduce((sum, report) => sum + report.upside, 0) / relatedReports.length)
          : 0;

        return {
          ticker: latest.ticker,
          name: latest.name,
          market: latest.market,
          brokerCount: brokers.length,
          brokers,
          latestReportDate: latest.date,
          avgUpside,
          currentPrice,
          basePrice: latest.basePrice,
          basePriceDate: latest.basePriceDate,
          reportCount: relatedReports.length,
          relatedReports,
        } satisfies AnalystConsensusItem;
      })
    );

    const consensusItems = items
      .filter((item): item is AnalystConsensusItem => item !== null)
      .sort((a, b) => {
        if (b.brokerCount !== a.brokerCount) {
          return b.brokerCount - a.brokerCount;
        }
        const dateDiff = new Date(b.latestReportDate).getTime() - new Date(a.latestReportDate).getTime();
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return b.avgUpside - a.avgUpside;
      });

    res.status(200).json(consensusItems);
  } catch (error) {
    console.error('Error building analyst consensus:', error);
    res.status(500).json({ error: 'Failed to build analyst consensus' });
  }
}
