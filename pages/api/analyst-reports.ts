import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';

import { buildAnalystCacheFile, filterAnalystReports } from '../../lib/analyst-report-source.mjs';
import type { AnalystReport, AnalystReportCacheFile, MarketFilter } from '../../lib/analyst-types';

type CacheFileMemoryEntry = {
  data: AnalystReportCacheFile;
  loadedAt: number;
};

const FILE_CACHE_TTL_MS = 60 * 1000;
const DEV_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
let cacheFileMemory: CacheFileMemoryEntry | null = null;
let cacheFileInflight: Promise<AnalystReportCacheFile> | null = null;
let liveRefreshInflight: Promise<void> | null = null;
let lastLiveRefreshAt = 0;

export async function loadAnalystCacheFile(): Promise<AnalystReportCacheFile> {
  if (cacheFileMemory && Date.now() - cacheFileMemory.loadedAt <= FILE_CACHE_TTL_MS) {
    return cacheFileMemory.data;
  }

  if (cacheFileInflight) {
    return cacheFileInflight;
  }

  const request = readFile(getAnalystCachePath(), 'utf8')
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

function getAnalystCachePath() {
  return path.join(process.cwd(), 'data', 'analyst-reports-cache.json');
}

async function persistAnalystCacheFile(data: AnalystReportCacheFile) {
  await writeFile(getAnalystCachePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function scheduleLiveRefresh(currentData: AnalystReportCacheFile) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  if (liveRefreshInflight) {
    return;
  }

  if (Date.now() - lastLiveRefreshAt < DEV_REFRESH_INTERVAL_MS) {
    return;
  }

  lastLiveRefreshAt = Date.now();
  liveRefreshInflight = buildAnalystCacheFile(30)
    .then((nextData) => nextData as AnalystReportCacheFile)
    .then(async (nextData) => {
      const previous = JSON.stringify(currentData.reports);
      const next = JSON.stringify(nextData.reports);

      if (previous === next) {
        cacheFileMemory = {
          data: {
            ...currentData,
            generatedAt: nextData.generatedAt,
          },
          loadedAt: Date.now(),
        };
        return;
      }

      cacheFileMemory = {
        data: nextData,
        loadedAt: Date.now(),
      };
      await persistAnalystCacheFile(nextData);
    })
    .catch((error) => {
      console.error('Error refreshing analyst reports in development:', error);
    })
    .finally(() => {
      liveRefreshInflight = null;
    });
}

export async function loadAnalystData(): Promise<AnalystReportCacheFile> {
  let cacheFile: AnalystReportCacheFile;

  try {
    cacheFile = await loadAnalystCacheFile();
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }

    const liveData = await buildAnalystCacheFile(30) as AnalystReportCacheFile;
    cacheFileMemory = {
      data: liveData,
      loadedAt: Date.now(),
    };
    await persistAnalystCacheFile(liveData);
    return liveData;
  }

  scheduleLiveRefresh(cacheFile);
  return cacheFile;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AnalystReport[] | { error: string }>) {
  const { days = '30', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cacheFile = await loadAnalystData();
    const reports = filterAnalystReports(cacheFile.reports, daysNum, marketFilter) as AnalystReport[];
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error reading analyst cache file:', error);
    res.status(500).json({ error: 'Failed to read analyst reports cache' });
  }
}
