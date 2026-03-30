import type { NextApiRequest, NextApiResponse } from 'next';

import { buildFallbackInsight } from '../../lib/analyst-report-source.mjs';
import type { MarketType, StockInsight, StockInsightResponse } from '../../lib/analyst-types';
import { fetchLiveCurrentPrice, loadAnalystData } from './analyst-reports';

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

async function enrichInsightWithLivePrice(insight: StockInsight): Promise<StockInsight> {
  const livePrice = await fetchLiveCurrentPrice(insight.ticker, insight.market);
  if (livePrice <= 0) {
    return insight;
  }

  const relatedReports = insight.relatedReports.map((report) => ({
    ...report,
    currentPrice: livePrice,
    upside: report.targetPrice > 0 ? roundOne(((report.targetPrice - livePrice) / livePrice) * 100) : 0,
  }));

  const avgUpside = relatedReports.length > 0
    ? roundOne(relatedReports.reduce((sum, report) => sum + report.upside, 0) / relatedReports.length)
    : insight.avgUpside;

  return {
    ...insight,
    latestCurrentPrice: livePrice,
    avgUpside,
    relatedReports,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StockInsightResponse | { error: string }>
) {
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  const name = String(req.query.name || '').trim();
  const market = String(req.query.market || '').trim() as MarketType;

  if (!ticker || (market !== 'korea' && market !== 'us')) {
    res.status(400).json({ error: 'ticker and market are required' });
    return;
  }

  try {
    const cacheFile = await loadAnalystData();
    const insightKey = `${market}:${ticker}`;
    const insight = cacheFile.stockInsights[insightKey];

    if (insight) {
      res.status(200).json({ found: true, insight: await enrichInsightWithLivePrice(insight) });
      return;
    }

    const fallback = buildFallbackInsight({
      ticker,
      name: name || ticker,
      market,
      currentPrice: Number.parseFloat(String(req.query.currentPrice || '0')) || 0,
      changePercent: Number.parseFloat(String(req.query.changePercent || '0')) || 0,
      high52w: Number.parseFloat(String(req.query.high52w || '0')) || 0,
      low52w: Number.parseFloat(String(req.query.low52w || '0')) || 0,
    }) as StockInsight;

    res.status(200).json({ found: false, insight: fallback });
  } catch (error) {
    console.error('Error reading stock insight:', error);
    res.status(500).json({ error: 'Failed to read stock insight cache' });
  }
}
