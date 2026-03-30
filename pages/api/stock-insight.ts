import type { NextApiRequest, NextApiResponse } from 'next';

import { buildFallbackInsight } from '../../lib/analyst-report-source.mjs';
import type { MarketType, StockInsightResponse } from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

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
      res.status(200).json({ found: true, insight });
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
    });

    res.status(200).json({ found: false, insight: fallback });
  } catch (error) {
    console.error('Error reading stock insight:', error);
    res.status(500).json({ error: 'Failed to read stock insight cache' });
  }
}
