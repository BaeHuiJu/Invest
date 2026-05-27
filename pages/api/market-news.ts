import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';

import bundledNewsCache from '../../data/news-cache.json';
import type { MarketNewsCacheFile, MarketNewsApiResponse, NewsCategory, NewsSource } from '../../lib/news-types';

type CacheEntry = {
  data: MarketNewsCacheFile;
  loadedAt: number;
};

const FILE_CACHE_TTL_MS = 60 * 1000;
let cacheMemory: CacheEntry | null = null;
let cacheInflight: Promise<MarketNewsCacheFile> | null = null;

function getBundledCache(): MarketNewsCacheFile {
  return bundledNewsCache as MarketNewsCacheFile;
}

async function readNewsCacheFile(): Promise<MarketNewsCacheFile> {
  if (process.env.NODE_ENV !== 'development') {
    return getBundledCache();
  }
  try {
    const raw = await readFile(path.join(process.cwd(), 'data', 'news-cache.json'), 'utf8');
    return JSON.parse(raw) as MarketNewsCacheFile;
  } catch {
    return getBundledCache();
  }
}

async function loadNewsCache(): Promise<MarketNewsCacheFile> {
  if (cacheMemory && Date.now() - cacheMemory.loadedAt <= FILE_CACHE_TTL_MS) {
    return cacheMemory.data;
  }
  if (cacheInflight) {
    return cacheInflight;
  }
  const request = readNewsCacheFile()
    .then((data) => {
      cacheMemory = { data, loadedAt: Date.now() };
      return data;
    })
    .finally(() => {
      cacheInflight = null;
    });
  cacheInflight = request;
  return request;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// 검색 쿼리로 뉴스 아이템 필터링 (제목, 설명 포함)
function matchesSearchQuery(item: any, query: string): boolean {
  if (!query || query.length === 0) return true;

  const queryLower = query.toLowerCase().trim();
  const titleMatch = item.title.toLowerCase().includes(queryLower);
  const explanationMatch = item.beginnerExplanation.toLowerCase().includes(queryLower);

  return titleMatch || explanationMatch;
}

// 소스 필터 (single 또는 comma-separated)
function parseSourceFilter(sourceParam: string | string[] | undefined): NewsSource[] {
  if (!sourceParam) return ['domestic', 'overseas', 'main'];

  const sourceStr = Array.isArray(sourceParam) ? sourceParam[0] : sourceParam;
  const sources = sourceStr.split(',').map(s => s.trim().toLowerCase()) as NewsSource[];

  return sources.filter((s): s is NewsSource =>
    ['domestic', 'overseas', 'main'].includes(s)
  );
}

export interface MarketNewsApiResponseExtended extends MarketNewsApiResponse {
  totalCount: number;
  filters: {
    category: NewsCategory;
    sources: NewsSource[];
    search: string;
    ticker: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketNewsApiResponseExtended | { error: string }>
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const cache = await loadNewsCache();

    // 쿼리 파라미터 파싱
    const category = (req.query.category as NewsCategory) || 'all';
    const sources = parseSourceFilter(req.query.source as string | string[] | undefined);
    const search = (req.query.search as string || '').trim();
    const ticker = (req.query.ticker as string || '').trim().toUpperCase();
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    // 모든 뉴스 통합 (중복 제거)
    const allItems = [
      ...cache.domestic,
      ...cache.overseas,
      ...cache.main,
    ].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 1단계: 소스 필터
    let filtered = allItems.filter((item) => sources.includes(item.source));

    // 2단계: 카테고리 필터
    if (category !== 'all') {
      filtered = filtered.filter((item) => item.category === category);
    }

    // 3단계: 티커 필터 (relatedTickers 배열에서 검색)
    if (ticker) {
      filtered = filtered.filter((item: any) => {
        if (!item.relatedTickers || item.relatedTickers.length === 0) return false;
        return item.relatedTickers.some((t: string) => t.toUpperCase().includes(ticker));
      });
    }

    // 4단계: 검색 쿼리 필터 (제목, 설명)
    if (search) {
      filtered = filtered.filter((item) => matchesSearchQuery(item, search));
    }

    // Breaking news 개수 (필터 적용 전 모든 항목 기준)
    const now = Date.now();
    const breakingCount = allItems.filter(
      (item) => now - new Date(item.publishedAt).getTime() < TWO_HOURS_MS
    ).length;

    // 페이지네이션
    const totalCount = filtered.length;
    const paginatedItems = filtered.slice(offset, offset + limit);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json({
      generatedAt: cache.generatedAt,
      items: paginatedItems,
      breakingCount,
      totalCount,
      filters: {
        category,
        sources,
        search,
        ticker,
      },
    });
  } catch (err) {
    console.error('market-news API error:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
}
