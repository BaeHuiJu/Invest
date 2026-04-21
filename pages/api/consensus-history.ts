import type { NextApiRequest, NextApiResponse } from 'next';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  buildTimeline,
  computeChange,
  type ConsensusDelta,
  type ConsensusTimelinePoint,
} from '@/lib/consensus-delta-utils';

// In-memory cache
let deltaCache: { data: ConsensusDelta; loadedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 델타 파일 로드 (캐싱)
 */
export async function loadDeltaFile(): Promise<ConsensusDelta> {
  if (deltaCache && Date.now() - deltaCache.loadedAt < CACHE_TTL) {
    return deltaCache.data;
  }

  const filePath = path.join(process.cwd(), 'data', 'consensus-deltas.json');
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  deltaCache = { data, loadedAt: Date.now() };
  return data;
}

interface HistoryResponse {
  ticker: string;
  name: string;
  market: string;
  history: Array<
    ConsensusTimelinePoint & {
      change: {
        brokerCount: number;
        avgUpside: number;
        entryScore: number;
        avgTargetPrice: number;
      } | null;
    }
  >;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HistoryResponse | { error: string }>
) {
  const { ticker, days = '30' } = req.query;

  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'ticker parameter required' });
  }

  const daysNum = parseInt(String(days), 10) || 30;

  try {
    const deltaFile = await loadDeltaFile();
    const timeline = buildTimeline(deltaFile, ticker, daysNum);

    if (timeline.length === 0) {
      return res.status(404).json({ error: 'No data found for ticker' });
    }

    // 날짜별 변화량 계산
    const history = timeline.map((curr, idx) => {
      const prev = timeline[idx - 1];
      return {
        ...curr,
        change: computeChange(curr, prev || null),
      };
    });

    res.status(200).json({
      ticker,
      name: history[0]?.name || '',
      market: history[0]?.market || '',
      history,
    });
  } catch (error) {
    console.error('Error loading consensus history:', error);
    res.status(500).json({ error: 'Failed to load consensus history' });
  }
}
