import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MarketType } from '../lib/analyst-types';

type StockResult = {
  ticker: string;
  name: string;
  market: MarketType;
};

type AnalystResult = {
  analyst: string;
  broker: string;
  reportCount: number;
};

type BrokerResult = {
  broker: string;
  reportCount: number;
};

type SearchResult = {
  stocks: StockResult[];
  analysts: AnalystResult[];
  brokers: BrokerResult[];
};

type GlobalSearchProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectBroker?: (broker: string) => void;
};

export function GlobalSearch({ isOpen, onClose, onSelectBroker }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleStockClick = (stock: StockResult) => {
    onClose();
    router.push(`/stocks/${stock.market}/${stock.ticker}`);
  };

  const handleAnalystClick = (analyst: AnalystResult) => {
    onClose();
    router.push(`/analysts/${encodeURIComponent(analyst.broker)}/${encodeURIComponent(analyst.analyst)}`);
  };

  const handleBrokerClick = (broker: BrokerResult) => {
    onClose();
    if (onSelectBroker) {
      onSelectBroker(broker.broker);
    }
  };

  if (!isOpen) return null;

  const hasResults = results && (
    results.stocks.length > 0 ||
    results.analysts.length > 0 ||
    results.brokers.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-[10vh] max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-c-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-c-border p-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목, 애널리스트, 증권사 검색..."
            className="w-full rounded-lg border-0 bg-c-surface-2 py-3 pl-12 pr-12 text-base text-c-text placeholder:text-c-text-3 focus:outline-none focus:ring-2 focus:ring-c-accent"
          />
          <svg
            className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-c-text-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-c-text-3 hover:bg-c-surface-2 hover:text-c-text-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-c-accent border-t-transparent" />
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="py-8 text-center text-c-text-2">
              검색 결과가 없습니다.
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="py-8 text-center text-c-text-3">
              2글자 이상 입력해주세요.
            </div>
          )}

          {!loading && hasResults && (
            <div className="space-y-6">
              {results.stocks.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-c-text-2">
                    <span>종목</span>
                    <span className="rounded-full bg-c-surface-2 px-2 py-0.5 text-xs">{results.stocks.length}</span>
                  </div>
                  <div className="space-y-1">
                    {results.stocks.map((stock) => (
                      <button
                        key={`${stock.market}-${stock.ticker}`}
                        type="button"
                        onClick={() => handleStockClick(stock)}
                        className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-c-surface-2"
                      >
                        <span className="text-lg">{stock.market === 'korea' ? '🇰🇷' : '🇺🇸'}</span>
                        <div>
                          <div className="font-medium text-c-text">{stock.name}</div>
                          <div className="text-sm text-c-text-2">{stock.ticker}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.analysts.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-c-text-2">
                    <span>애널리스트</span>
                    <span className="rounded-full bg-c-surface-2 px-2 py-0.5 text-xs">{results.analysts.length}</span>
                  </div>
                  <div className="space-y-1">
                    {results.analysts.map((analyst) => (
                      <button
                        key={`${analyst.broker}-${analyst.analyst}`}
                        type="button"
                        onClick={() => handleAnalystClick(analyst)}
                        className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-c-surface-2"
                      >
                        <div>
                          <div className="font-medium text-c-text">{analyst.analyst}</div>
                          <div className="text-sm text-c-text-2">{analyst.broker}</div>
                        </div>
                        <span className="text-sm text-c-text-3">{analyst.reportCount}건</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.brokers.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-c-text-2">
                    <span>증권사</span>
                    <span className="rounded-full bg-c-surface-2 px-2 py-0.5 text-xs">{results.brokers.length}</span>
                  </div>
                  <div className="space-y-1">
                    {results.brokers.map((broker) => (
                      <button
                        key={broker.broker}
                        type="button"
                        onClick={() => handleBrokerClick(broker)}
                        className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-c-surface-2"
                      >
                        <div className="font-medium text-c-text">{broker.broker}</div>
                        <span className="text-sm text-c-text-3">{broker.reportCount}건</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-c-border bg-c-surface-2 px-4 py-3 text-center text-sm text-c-text-2">
          <kbd className="rounded bg-c-border px-2 py-0.5 font-mono text-xs">ESC</kbd>
          <span className="ml-2">를 눌러 닫기</span>
        </div>
      </div>
    </div>
  );
}
