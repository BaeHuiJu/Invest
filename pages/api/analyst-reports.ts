import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';

import { filterAnalystReports } from '../../lib/analyst-report-source.mjs';
import type { AnalystReport, AnalystReportCacheFile, MarketFilter } from '../../lib/analyst-types';

type CacheFileMemoryEntry = {
  data: AnalystReportCacheFile;
  loadedAt: number;
};

const FILE_CACHE_TTL_MS = 60 * 1000;
let cacheFileMemory: CacheFileMemoryEntry | null = null;
let cacheFileInflight: Promise<AnalystReportCacheFile> | null = null;

export async function loadAnalystCacheFile(): Promise<AnalystReportCacheFile> {
  if (cacheFileMemory && Date.now() - cacheFileMemory.loadedAt <= FILE_CACHE_TTL_MS) {
    return cacheFileMemory.data;
  }

  if (cacheFileInflight) {
    return cacheFileInflight;
  }

  const request = readFile(path.join(process.cwd(), 'data', 'analyst-reports-cache.json'), 'utf8')
    .then((raw) => JSON.parse(raw) as AnalystReportCacheFile)
    .then((data) => {
      cacheFileMemory = {
        data,
        loadedAt: Date.now(),
      };
      return data;
    })
    .finally(() => {
      cacheFileInflight = null;
    });

  cacheFileInflight = request;
  return request;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AnalystReport[] | { error: string }>) {
  const { days = '30', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cacheFile = await loadAnalystCacheFile();
    const reports = filterAnalystReports(cacheFile.reports, daysNum, marketFilter) as AnalystReport[];
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error reading analyst cache file:', error);
    res.status(500).json({ error: 'Failed to read analyst reports cache' });
  }
}
