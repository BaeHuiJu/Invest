import type { NextApiRequest, NextApiResponse } from 'next';
import { reconstructStateAtDate, subtractDays, getTrend } from '@/lib/consensus-delta-utils';
import { loadDeltaFile } from './consensus-history';

interface TopMover {
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
}

interface TopMoversResponse {
  strengthening: TopMover[];
  weakening: TopMover[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopMoversResponse | { error: string }>
) {
  const { days = '7' } = req.query;
  const daysNum = parseInt(String(days), 10) || 7;

  try {
    const deltaFile = await loadDeltaFile();

    const today = new Date().toISOString().slice(0, 10);
    const baseline = subtractDays(today, daysNum);

    const currentState = reconstructStateAtDate(deltaFile, today);
    const pastState = reconstructStateAtDate(deltaFile, baseline);

    const pastMap = new Map(pastState.map((s) => [s.ticker, s]));

    // 모든 종목의 변화 계산
    const movers: TopMover[] = currentState
      .map((curr) => {
        const past = pastMap.get(curr.ticker);
        if (!past) return null;

        const brokerCountChange = curr.brokerCount - past.brokerCount;
        const entryScoreChange = curr.entryScore - past.entryScore;
        const avgUpsideChange = parseFloat((curr.avgUpside - past.avgUpside).toFixed(1));

        return {
          ticker: curr.ticker,
          name: curr.name,
          market: curr.market,
          currentBrokerCount: curr.brokerCount,
          brokerCountChange,
          currentEntryScore: curr.entryScore,
          entryScoreChange,
          currentAvgUpside: curr.avgUpside,
          avgUpsideChange,
          trend: getTrend(brokerCountChange, entryScoreChange),
        };
      })
      .filter((m): m is TopMover => m !== null);

    // 컨센서스 강화: 증권사↑ AND 진입점수↑
    const strengthening = movers
      .filter((m) => m.trend === 'strengthening')
      .sort((a, b) => {
        // 변화량 합계로 정렬
        const scoreA = a.brokerCountChange + a.entryScoreChange / 10;
        const scoreB = b.brokerCountChange + b.entryScoreChange / 10;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    // 컨센서스 약화: 증권사↓ OR 진입점수↓
    const weakening = movers
      .filter((m) => m.trend === 'weakening')
      .sort((a, b) => {
        // 변화량 합계로 정렬 (음수이므로 반대)
        const scoreA = a.brokerCountChange + a.entryScoreChange / 10;
        const scoreB = b.brokerCountChange + b.entryScoreChange / 10;
        return scoreA - scoreB;
      })
      .slice(0, 10);

    res.status(200).json({ strengthening, weakening });
  } catch (error) {
    console.error('Error computing top movers:', error);
    res.status(500).json({ error: 'Failed to compute top movers' });
  }
}
