import type { NextApiRequest, NextApiResponse } from 'next';
import { getTrend } from '@/lib/consensus-delta-utils';
import { loadDeltaFile } from './consensus-history';

interface LatestChange {
  ticker: string;
  name: string;
  market: string;
  currentBrokerCount: number;
  brokerCountChange: number;
  currentEntryScore: number;
  entryScoreChange: number;
  currentAvgUpside: number;
  avgUpsideChange: number;
  trend: 'strengthening' | 'weakening' | 'stable';
  changeType: 'added' | 'changed';
}

interface LatestChangesResponse {
  date: string;
  strengthening: LatestChange[];
  weakening: LatestChange[];
  added: LatestChange[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LatestChangesResponse | { error: string }>
) {
  try {
    const deltaFile = await loadDeltaFile();

    // 최신 델타가 없으면 빈 결과 반환
    if (deltaFile.deltas.length === 0) {
      return res.status(200).json({
        date: deltaFile.baseline.date,
        strengthening: [],
        weakening: [],
        added: [],
      });
    }

    const latestDelta = deltaFile.deltas[deltaFile.deltas.length - 1];

    // 변경된 종목들 (changed)
    const changedItems: LatestChange[] = latestDelta.changed.map((change) => {
      const brokerCountChange = change.fields.brokerCount
        ? change.fields.brokerCount.new - change.fields.brokerCount.old
        : 0;
      const entryScoreChange = change.fields.entryScore
        ? change.fields.entryScore.new - change.fields.entryScore.old
        : 0;
      const avgUpsideChange = change.fields.avgUpside
        ? change.fields.avgUpside.new - change.fields.avgUpside.old
        : 0;

      return {
        ticker: change.ticker,
        name: change.name || '',
        market: 'korea', // 델타에 market 정보가 없으면 기본값
        currentBrokerCount: change.fields.brokerCount?.new || 0,
        brokerCountChange,
        currentEntryScore: change.fields.entryScore?.new || 0,
        entryScoreChange,
        currentAvgUpside: change.fields.avgUpside?.new || 0,
        avgUpsideChange,
        trend: getTrend(brokerCountChange, entryScoreChange),
        changeType: 'changed' as const,
      };
    });

    // 추가된 종목들 (added)
    const addedItems: LatestChange[] = latestDelta.added.map((snapshot) => ({
      ticker: snapshot.ticker,
      name: snapshot.name,
      market: snapshot.market,
      currentBrokerCount: snapshot.brokerCount,
      brokerCountChange: snapshot.brokerCount,
      currentEntryScore: snapshot.entryScore,
      entryScoreChange: snapshot.entryScore,
      currentAvgUpside: snapshot.avgUpside,
      avgUpsideChange: snapshot.avgUpside,
      trend: 'strengthening' as const,
      changeType: 'added' as const,
    }));

    // 강화/약화 분류
    const strengthening = changedItems
      .filter((item) => item.trend === 'strengthening')
      .sort((a, b) => {
        const scoreA = a.brokerCountChange + a.entryScoreChange / 10;
        const scoreB = b.brokerCountChange + b.entryScoreChange / 10;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    const weakening = changedItems
      .filter((item) => item.trend === 'weakening')
      .sort((a, b) => {
        const scoreA = a.brokerCountChange + a.entryScoreChange / 10;
        const scoreB = b.brokerCountChange + b.entryScoreChange / 10;
        return scoreA - scoreB;
      })
      .slice(0, 10);

    const added = addedItems.slice(0, 10);

    res.status(200).json({
      date: latestDelta.date,
      strengthening,
      weakening,
      added,
    });
  } catch (error) {
    console.error('Error computing latest changes:', error);
    res.status(500).json({ error: 'Failed to compute latest changes' });
  }
}
