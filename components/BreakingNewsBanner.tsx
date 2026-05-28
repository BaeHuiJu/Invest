import { useEffect, useState } from 'react';
import type { MarketNewsItem, MarketNewsApiResponse } from '@/lib/news-types';

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

export function BreakingNewsBanner() {
  const [items, setItems] = useState<MarketNewsItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/market-news?limit=10')
      .then((r) => r.json())
      .then((data: MarketNewsApiResponse) => {
        if (data.items?.length) setItems(data.items.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  if (!items.length) return null;

  const hasBreaking = items.some((item) => isCurrentlyBreaking(item.publishedAt));
  const expanded = expandedId ? items.find((i) => i.id === expandedId) : null;

  return (
    <div className="border-b border-c-border bg-c-surface">
      <div
        className={`flex items-center gap-0 overflow-hidden ${hasBreaking ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
      >
        <div className={`flex-shrink-0 px-3 py-2 text-xs font-bold ${hasBreaking ? 'text-c-negative' : 'text-c-text-2'}`}>
          {hasBreaking ? '🔴 속보' : '📰 뉴스'}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...items, ...items].map((item, i) => {
              const breaking = isCurrentlyBreaking(item.publishedAt);
              return (
                <button
                  key={`${item.id}-${i}`}
                  type="button"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs text-c-text-2 hover:text-c-text"
                >
                  {breaking && (
                    <span className="inline-block rounded bg-c-negative px-1.5 py-0.5 text-[10px] font-bold text-white">
                      속보
                    </span>
                  )}
                  <span className={`${item.sentiment === 'positive' ? 'text-c-positive' : item.sentiment === 'negative' ? 'text-c-negative' : 'text-c-text-2'}`}>
                    {item.sentiment === 'positive' ? '▲' : item.sentiment === 'negative' ? '▼' : '—'}
                  </span>
                  <span className="max-w-xs truncate">{item.title}</span>
                  <span className="text-c-text-3">{relativeTime(item.publishedAt)}</span>
                  <span className="text-c-border">|</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-c-border bg-c-surface-2 px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-c-text">{expanded.title}</p>
              <p className="mt-1 text-xs text-c-text-2">{expanded.beginnerExplanation}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-c-text-3">{expanded.pressName}</span>
                <span className="text-xs text-c-text-3">{relativeTime(expanded.publishedAt)}</span>
                <a
                  href={expanded.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-c-accent hover:underline"
                >
                  원문 보기 →
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="flex-shrink-0 text-c-text-3 hover:text-c-text"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
