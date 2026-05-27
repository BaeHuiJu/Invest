import { useEffect, useState, useCallback } from 'react';
import type { MarketNewsItem, MarketNewsApiResponse, NewsCategory, NewsSource } from '@/lib/news-types';

const CATEGORIES: NewsCategory[] = ['all', '금리·통화', '환율', '수급', '실적', '정책'];
const CATEGORY_LABELS: Record<NewsCategory, string> = {
  all: '전체',
  '금리·통화': '금리·통화',
  '환율': '환율',
  '수급': '수급',
  '실적': '실적',
  '정책': '정책',
};

const SOURCES: Array<{ value: NewsSource; label: string }> = [
  { value: 'domestic', label: '국내' },
  { value: 'overseas', label: '해외' },
  { value: 'main', label: '공시' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'breaking', label: '속보 우선' },
  { value: 'positive', label: '긍정 순' },
  { value: 'negative', label: '부정 순' },
] as const;

const PAGE_SIZE = 6;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function isCurrentlyBreaking(publishedAt: string): boolean {
  return Date.now() - new Date(publishedAt).getTime() < TWO_HOURS_MS;
}

function relativeTime(publishedAt: string): string {
  const diff = Date.now() - new Date(publishedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function SentimentBadge({ sentiment }: { sentiment: MarketNewsItem['sentiment'] }) {
  if (sentiment === 'positive') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-c-positive-bg px-2 py-0.5 text-[11px] font-medium text-c-positive">
        🟢 긍정
      </span>
    );
  }
  if (sentiment === 'negative') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-c-negative-bg px-2 py-0.5 text-[11px] font-medium text-c-negative">
        🔴 부정
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-c-neutral-bg px-2 py-0.5 text-[11px] font-medium text-c-neutral">
      ⚪ 중립
    </span>
  );
}

function NewsCard({ item }: { item: MarketNewsItem }) {
  const breaking = isCurrentlyBreaking(item.publishedAt);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border p-4 transition-colors hover:bg-c-surface-2 ${breaking ? 'border-c-negative/30 bg-c-negative-bg/20' : 'border-c-border bg-c-surface'}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {breaking && (
          <span className="rounded bg-c-negative px-1.5 py-0.5 text-[10px] font-bold text-white">
            속보
          </span>
        )}
        <SentimentBadge sentiment={item.sentiment} />
        {item.category !== 'all' && (
          <span className="rounded-full bg-c-accent-bg px-2 py-0.5 text-[11px] font-medium text-c-accent">
            {item.category}
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug text-c-text">{item.title}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-c-text-3">{item.beginnerExplanation}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-c-text-3">
        <span>{item.pressName}</span>
        <span>·</span>
        <span>{relativeTime(item.publishedAt)}</span>
      </div>
    </a>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-c-border bg-c-surface p-4">
      <div className="mb-2 flex gap-2">
        <div className="h-5 w-12 rounded-full bg-c-surface-2" />
        <div className="h-5 w-16 rounded-full bg-c-surface-2" />
      </div>
      <div className="mb-1 h-4 w-full rounded bg-c-surface-2" />
      <div className="h-4 w-3/4 rounded bg-c-surface-2" />
      <div className="mt-3 h-3 w-1/2 rounded bg-c-surface-2" />
    </div>
  );
}

export function MarketNewsSection() {
  const [allItems, setAllItems] = useState<MarketNewsItem[]>([]);
  const [category, setCategory] = useState<NewsCategory>('all');
  const [sources, setSources] = useState<NewsSource[]>(['domestic', 'overseas', 'main']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]['value']>('latest');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // API 호출
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        source: sources.join(','),
        search: searchQuery,
        limit: '100',
      });

      const response = await fetch(`/api/market-news?${params.toString()}`);
      const data: MarketNewsApiResponse = await response.json();

      if (data.items) {
        setAllItems(data.items);
        setGeneratedAt(data.generatedAt);
        setTotalCount(data.totalCount || data.items.length);
      }
    } catch {
      console.error('Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, [category, sources, searchQuery]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // 정렬 로직
  const sortedItems = [...allItems].sort((a, b) => {
    switch (sortBy) {
      case 'breaking':
        const aBreaking = isCurrentlyBreaking(a.publishedAt) ? 1 : 0;
        const bBreaking = isCurrentlyBreaking(b.publishedAt) ? 1 : 0;
        if (aBreaking !== bBreaking) return bBreaking - aBreaking;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      case 'positive':
        return (b.sentimentScore || 0) - (a.sentimentScore || 0);
      case 'negative':
        return (a.sentimentScore || 0) - (b.sentimentScore || 0);
      case 'latest':
      default:
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
  });

  const displayed = sortedItems.slice(0, displayCount);
  const canShowMore = displayed.length < sortedItems.length;

  const breakingCount = allItems.filter((i) => isCurrentlyBreaking(i.publishedAt)).length;

  const cacheAge = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000)
    : null;

  return (
    <section className="rounded-2xl border border-c-border bg-c-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-c-text sm:text-lg">📰 주린이 뉴스</h2>
          {breakingCount > 0 && (
            <span className="rounded-full bg-c-negative px-2 py-0.5 text-[10px] font-bold text-white">
              속보 {breakingCount}
            </span>
          )}
        </div>
        {cacheAge !== null && (
          <span className="text-[11px] text-c-text-3">
            {cacheAge < 1 ? '방금 업데이트' : `${cacheAge}분 전 업데이트`}
          </span>
        )}
      </div>

      {/* 검색 입력창 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="뉴스 검색... (제목, 설명)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setDisplayCount(PAGE_SIZE);
          }}
          className="w-full rounded-lg border border-c-border bg-c-surface-2 px-3 py-2 text-sm text-c-text placeholder-c-text-3 focus:border-c-accent focus:outline-none"
        />
      </div>

      {/* 필터 및 정렬 버튼 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 소스 필터 */}
        <div className="flex gap-1.5">
          {SOURCES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSources((prev) =>
                  prev.includes(value)
                    ? prev.filter((s) => s !== value)
                    : [...prev, value]
                );
                setDisplayCount(PAGE_SIZE);
              }}
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                sources.includes(value)
                  ? 'bg-c-accent text-white'
                  : 'bg-c-surface-2 text-c-text-2 hover:bg-c-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 정렬 옵션 */}
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as typeof SORT_OPTIONS[number]['value']);
            setDisplayCount(PAGE_SIZE);
          }}
          className="flex-shrink-0 rounded-lg border border-c-border bg-c-surface-2 px-2.5 py-1 text-xs font-medium text-c-text focus:border-c-accent focus:outline-none"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 카테고리 필터 */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(cat);
              setDisplayCount(PAGE_SIZE);
            }}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-c-accent text-white'
                : 'bg-c-surface-2 text-c-text-2 hover:bg-c-border'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 검색 결과 정보 */}
      {(searchQuery || sources.length < 3) && (
        <div className="mb-3 text-xs text-c-text-3">
          {totalCount > 0 ? `${totalCount}개 뉴스 중` : '0개 뉴스'}
          {searchQuery && ` "${searchQuery}"`}
          {sources.length < 3 && ` (${sources.map(s => SOURCES.find(src => src.value === s)?.label).join(', ')})`}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <NewsCardSkeleton key={i} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-c-border bg-c-surface-2 py-10 text-center">
          <p className="text-sm text-c-text-2">
            {searchQuery ? '검색 결과가 없어요.' : '해당 조건의 뉴스가 없어요.'}
          </p>
          <p className="mt-1 text-xs text-c-text-3">
            {searchQuery
              ? '다른 검색어를 시도해 보세요.'
              : '필터를 조정하거나 잠시 후 다시 확인해 주세요.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {displayed.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
          {canShowMore && (
            <button
              type="button"
              onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
              className="mt-4 w-full rounded-xl border border-c-border py-2.5 text-sm text-c-text-2 transition-colors hover:bg-c-surface-2"
            >
              더보기 ({sortedItems.length - displayCount}개 남음)
            </button>
          )}
        </>
      )}
    </section>
  );
}
