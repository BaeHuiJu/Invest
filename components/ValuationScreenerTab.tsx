import { useEffect, useMemo, useState } from 'react';

import type { ValuationItem, ValuationScreenerResponse } from '../pages/api/valuation-screener';

type MarketType = 'korea' | 'us';
type MarketFilter = 'all' | MarketType;

interface InsightRequest {
  ticker: string;
  name: string;
  market: MarketType;
  category: 'stock' | 'etf' | 'analyst';
  currentPrice?: number;
}
type SortKey = 'name' | 'per' | 'pbr' | 'dividendYield' | 'roe' | 'brokerCount' | 'avgUpside';
type SortDir = 'asc' | 'desc';

interface FilterRange {
  min: string;
  max: string;
}

interface Filters {
  market: MarketFilter;
  per: FilterRange;
  pbr: FilterRange;
  dividendYield: FilterRange;
  roe: FilterRange;
  minBrokers: string;
}

const DEFAULT_FILTERS: Filters = {
  market: 'all',
  per: { min: '', max: '' },
  pbr: { min: '', max: '' },
  dividendYield: { min: '', max: '' },
  roe: { min: '', max: '' },
  minBrokers: '',
};

function inRange(value: number | null, filter: FilterRange): boolean {
  if (value === null) return false;
  if (filter.min !== '' && value < parseFloat(filter.min)) return false;
  if (filter.max !== '' && value > parseFloat(filter.max)) return false;
  return true;
}

function hasAnyFilter(filters: Filters): boolean {
  return (
    filters.market !== 'all' ||
    filters.per.min !== '' ||
    filters.per.max !== '' ||
    filters.pbr.min !== '' ||
    filters.pbr.max !== '' ||
    filters.dividendYield.min !== '' ||
    filters.dividendYield.max !== '' ||
    filters.roe.min !== '' ||
    filters.roe.max !== '' ||
    filters.minBrokers !== ''
  );
}

function fmtVal(v: number | null, digits = 1, suffix = ''): string {
  if (v === null) return 'N/A';
  return `${v.toFixed(digits)}${suffix}`;
}

function fmtPrice(price: number, market: 'korea' | 'us'): string {
  if (market === 'korea') return `${Math.round(price).toLocaleString()}원`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function exportCSV(items: ValuationItem[]) {
  const headers = ['종목명', '티커', '시장', '현재가', 'PER', 'PBR', '배당수익률(%)', 'ROE(%)', '추천 증권사', '상승여력(%)'];
  const rows = items.map((item) => [
    item.name,
    item.ticker,
    item.market === 'korea' ? '국내' : '해외',
    item.currentPrice,
    item.per ?? '',
    item.pbr ?? '',
    item.dividendYield ?? '',
    item.roe ?? '',
    item.brokerCount,
    item.avgUpside,
  ]);
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valuation-screener-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RangeInput({
  label,
  filter,
  onChange,
  placeholder,
}: {
  label: string;
  filter: FilterRange;
  onChange: (range: FilterRange) => void;
  placeholder?: { min: string; max: string };
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-c-text-2">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          placeholder={placeholder?.min ?? '최소'}
          value={filter.min}
          onChange={(e) => onChange({ ...filter, min: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <span className="text-c-text-3">~</span>
        <input
          type="number"
          placeholder={placeholder?.max ?? '최대'}
          value={filter.max}
          onChange={(e) => onChange({ ...filter, max: e.target.value })}
          className="w-full rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function MetricBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${color}`}>
      <div className="text-xs text-c-text-2">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

// Module-level cache: survives tab switches within a session
let _cachedScreenerData: ValuationScreenerResponse | null = null;
let _cachedAt = 0;
const CLIENT_CACHE_TTL_MS = 25 * 60 * 1000; // 25 min (slightly under server 30 min TTL)

let _inflight: Promise<ValuationScreenerResponse> | null = null;

function fetchScreenerData(): Promise<ValuationScreenerResponse> {
  if (_inflight) return _inflight;
  _inflight = fetch('/api/valuation-screener?market=all')
    .then((res) => {
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      return res.json() as Promise<ValuationScreenerResponse>;
    })
    .then((d) => {
      _cachedScreenerData = d;
      _cachedAt = Date.now();
      _inflight = null;
      return d;
    })
    .catch((e) => {
      _inflight = null;
      throw e;
    });
  return _inflight;
}

export function preWarmScreener(): void {
  if (_cachedScreenerData && Date.now() - _cachedAt < CLIENT_CACHE_TTL_MS) return;
  if (_inflight) return;
  fetchScreenerData().catch(() => {});
}

export function ValuationScreenerTab({ onOpenInsight }: { onOpenInsight?: (req: InsightRequest) => void }) {
  const [data, setData] = useState<ValuationScreenerResponse | null>(_cachedScreenerData);
  const [loading, setLoading] = useState(_cachedScreenerData === null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('brokerCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    if (_cachedScreenerData && Date.now() - _cachedAt < CLIENT_CACHE_TTL_MS) {
      setData(_cachedScreenerData);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchScreenerData()
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.items;

    if (filters.market !== 'all') {
      items = items.filter((item) => item.market === filters.market);
    }

    const activeFilter = hasAnyFilter(filters);
    if (!activeFilter) return items;

    return items.filter((item) => {
      if (filters.per.min !== '' || filters.per.max !== '') {
        if (!inRange(item.per, filters.per)) return false;
      }
      if (filters.pbr.min !== '' || filters.pbr.max !== '') {
        if (!inRange(item.pbr, filters.pbr)) return false;
      }
      if (filters.dividendYield.min !== '' || filters.dividendYield.max !== '') {
        if (!inRange(item.dividendYield, filters.dividendYield)) return false;
      }
      if (filters.roe.min !== '' || filters.roe.max !== '') {
        if (!inRange(item.roe, filters.roe)) return false;
      }
      if (filters.minBrokers !== '') {
        if (item.brokerCount < parseInt(filters.minBrokers)) return false;
      }
      return true;
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const diff = typeof av === 'string'
        ? av.localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-c-text-3">↕</span>;
    return <span className="ml-1 text-blue-600">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-c-text-2 uppercase tracking-wider cursor-pointer hover:text-c-text select-none whitespace-nowrap';
  const tdClass = 'px-4 py-3 text-sm';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-c-text-2">밸류에이션 데이터를 불러오는 중입니다…</p>
          <p className="mt-1 text-xs text-c-text-3">종목별 PER/PBR/배당 데이터를 수집 중입니다. 잠시 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-600">
        <p className="font-medium">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const statsItems = data?.items ?? [];
  const withPer = statsItems.filter((i) => i.per !== null);
  const withDy = statsItems.filter((i) => i.dividendYield !== null && i.dividendYield > 0);
  const avgPer = withPer.length > 0 ? withPer.reduce((s, i) => s + i.per!, 0) / withPer.length : null;
  const avgDy = withDy.length > 0 ? withDy.reduce((s, i) => s + i.dividendYield!, 0) / withDy.length : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-c-text">배당/밸류에이션 스크리너</h2>
          <p className="mt-1 text-sm text-c-text-2">
            애널리스트 추천 종목 중 PER, PBR, 배당수익률, ROE 기준으로 필터링
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text-2 hover:bg-c-surface-2"
          >
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button
            type="button"
            onClick={() => exportCSV(sorted)}
            className="rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text-2 hover:bg-c-surface-2"
            disabled={sorted.length === 0}
          >
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricBadge label="분석 종목 수" value={`${statsItems.length}개`} color="bg-blue-50" />
        <MetricBadge label="필터 결과" value={`${sorted.length}개`} color="bg-indigo-50" />
        <MetricBadge label="평균 PER" value={fmtVal(avgPer, 1, '배')} color="bg-amber-50" />
        <MetricBadge label="평균 배당수익률" value={fmtVal(avgDy, 2, '%')} color="bg-green-50" />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-c-border bg-c-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-c-text-2">필터 조건</h3>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-blue-600 hover:underline"
            >
              초기화
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {/* Market */}
            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-2">시장</label>
              <select
                value={filters.market}
                onChange={(e) => setFilters((f) => ({ ...f, market: e.target.value as MarketFilter }))}
                className="w-full rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">전체</option>
                <option value="korea">🇰🇷 국내</option>
                <option value="us">🇺🇸 해외</option>
              </select>
            </div>

            <RangeInput
              label="PER (배)"
              filter={filters.per}
              onChange={(v) => setFilters((f) => ({ ...f, per: v }))}
              placeholder={{ min: '예: 5', max: '예: 20' }}
            />
            <RangeInput
              label="PBR (배)"
              filter={filters.pbr}
              onChange={(v) => setFilters((f) => ({ ...f, pbr: v }))}
              placeholder={{ min: '예: 0.5', max: '예: 3' }}
            />
            <RangeInput
              label="배당수익률 (%)"
              filter={filters.dividendYield}
              onChange={(v) => setFilters((f) => ({ ...f, dividendYield: v }))}
              placeholder={{ min: '예: 2', max: '예: 8' }}
            />
            <RangeInput
              label="ROE (%)"
              filter={filters.roe}
              onChange={(v) => setFilters((f) => ({ ...f, roe: v }))}
              placeholder={{ min: '예: 10', max: '예: 30' }}
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-c-text-2">최소 추천 증권사</label>
              <input
                type="number"
                min={1}
                placeholder="예: 3"
                value={filters.minBrokers}
                onChange={(e) => setFilters((f) => ({ ...f, minBrokers: e.target.value }))}
                className="w-full rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-c-text-2 self-center">빠른 설정:</span>
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, per: { min: '', max: '15' }, roe: { min: '10', max: '' } })}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
            >
              가치주 (PER&lt;15, ROE&gt;10%)
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, dividendYield: { min: '3', max: '' } })}
              className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 hover:bg-green-100"
            >
              고배당 (배당수익률&gt;3%)
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, pbr: { min: '', max: '1' }, roe: { min: '8', max: '' } })}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
            >
              저PBR 우량주 (PBR&lt;1, ROE&gt;8%)
            </button>
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, minBrokers: '3', per: { min: '', max: '20' } })}
              className="rounded-full bg-purple-50 px-3 py-1 text-xs text-purple-700 hover:bg-purple-100"
            >
              컨센서스+합리적PER
            </button>
          </div>
        </div>
      )}

      {/* Result count */}
      <div className="text-sm text-c-text-2">
        총 {data?.totalCount ?? 0}개 종목 중 <span className="font-semibold text-c-text">{sorted.length}개</span> 조건 충족
        {data && <span className="ml-2 text-xs text-c-text-3">(기준: {new Date(data.generatedAt).toLocaleTimeString('ko-KR')} 수집)</span>}
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-c-surface-2">
              <tr>
                <th className={thClass} onClick={() => toggleSort('name')}>
                  종목 <SortIcon col="name" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-c-text-2">시장</th>
                <th className={thClass} onClick={() => toggleSort('per')}>
                  PER <SortIcon col="per" />
                </th>
                <th className={thClass} onClick={() => toggleSort('pbr')}>
                  PBR <SortIcon col="pbr" />
                </th>
                <th className={thClass} onClick={() => toggleSort('dividendYield')}>
                  배당수익률 <SortIcon col="dividendYield" />
                </th>
                <th className={thClass} onClick={() => toggleSort('roe')}>
                  ROE <SortIcon col="roe" />
                </th>
                <th className={thClass} onClick={() => toggleSort('brokerCount')}>
                  추천 증권사 <SortIcon col="brokerCount" />
                </th>
                <th className={thClass} onClick={() => toggleSort('avgUpside')}>
                  상승여력 <SortIcon col="avgUpside" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-c-text-2">
                  섹터
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-c-text-3">
                    조건에 맞는 종목이 없습니다. 필터를 조정해 보세요.
                  </td>
                </tr>
              ) : sorted.map((item) => (
                <tr
                  key={`${item.market}-${item.ticker}`}
                  className={`hover:bg-blue-50 ${onOpenInsight ? 'cursor-pointer' : ''}`}
                  onClick={() => onOpenInsight?.({ ticker: item.ticker, name: item.name, market: item.market, category: 'stock', currentPrice: item.currentPrice })}
                >
                  <td className={tdClass}>
                    <div className="font-medium text-blue-700 hover:underline">{item.name}</div>
                    <div className="text-xs text-c-text-3">{item.ticker} · {fmtPrice(item.currentPrice, item.market)}</div>
                  </td>
                  <td className={tdClass}>
                    <span className="rounded-full bg-c-surface-2 px-2 py-0.5 text-xs">
                      {item.market === 'korea' ? '🇰🇷 국내' : '🇺🇸 해외'}
                    </span>
                  </td>
                  <td className={`${tdClass} font-mono`}>
                    {item.per !== null ? (
                      <span className={item.per < 15 ? 'text-green-600 font-medium' : item.per > 30 ? 'text-red-500' : ''}>
                        {item.per.toFixed(1)}x
                      </span>
                    ) : <span className="text-c-text-3">N/A</span>}
                  </td>
                  <td className={`${tdClass} font-mono`}>
                    {item.pbr !== null ? (
                      <span className={item.pbr < 1 ? 'text-green-600 font-medium' : ''}>
                        {item.pbr.toFixed(2)}x
                      </span>
                    ) : <span className="text-c-text-3">N/A</span>}
                  </td>
                  <td className={`${tdClass} font-mono`}>
                    {item.dividendYield !== null && item.dividendYield > 0 ? (
                      <span className={item.dividendYield >= 3 ? 'text-green-600 font-medium' : ''}>
                        {item.dividendYield.toFixed(2)}%
                      </span>
                    ) : <span className="text-c-text-3">N/A</span>}
                  </td>
                  <td className={`${tdClass} font-mono`}>
                    {item.roe !== null ? (
                      <span className={item.roe >= 15 ? 'text-blue-600 font-medium' : item.roe < 0 ? 'text-red-500' : ''}>
                        {item.roe.toFixed(1)}%
                      </span>
                    ) : <span className="text-c-text-3">N/A</span>}
                  </td>
                  <td className={tdClass}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${item.brokerCount >= 5 ? 'bg-green-100 text-green-700' : item.brokerCount >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-c-surface-2 text-c-text-2'}`}>
                      {item.brokerCount}개
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className={`font-medium ${item.avgUpside >= 20 ? 'text-green-600' : item.avgUpside < 0 ? 'text-red-500' : 'text-c-text-2'}`}>
                      {item.avgUpside >= 0 ? '+' : ''}{item.avgUpside.toFixed(1)}%
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="text-xs text-c-text-2 truncate max-w-24 block">{item.sector ?? '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {sorted.length === 0 ? (
          <div className="rounded-xl bg-c-surface-2 p-6 text-center text-sm text-c-text-3">
            조건에 맞는 종목이 없습니다.
          </div>
        ) : sorted.map((item) => (
          <button
            key={`${item.market}-${item.ticker}`}
            type="button"
            className="w-full rounded-xl border border-c-border bg-c-surface p-4 shadow-sm text-left hover:border-c-accent hover:shadow-md transition-shadow"
            onClick={() => onOpenInsight?.({ ticker: item.ticker, name: item.name, market: item.market, category: 'stock', currentPrice: item.currentPrice })}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-blue-700">{item.name}</div>
                <div className="text-xs text-c-text-3">{item.ticker} · {item.market === 'korea' ? '🇰🇷' : '🇺🇸'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fmtPrice(item.currentPrice, item.market)}</div>
                <div className={`text-xs font-medium ${item.avgUpside >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  목표 {item.avgUpside >= 0 ? '+' : ''}{item.avgUpside.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-xs text-c-text-3">PER</div>
                <div className={`text-sm font-medium ${item.per !== null && item.per < 15 ? 'text-green-600' : ''}`}>
                  {item.per !== null ? `${item.per.toFixed(1)}x` : 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-c-text-3">PBR</div>
                <div className={`text-sm font-medium ${item.pbr !== null && item.pbr < 1 ? 'text-green-600' : ''}`}>
                  {item.pbr !== null ? `${item.pbr.toFixed(2)}x` : 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-c-text-3">배당</div>
                <div className={`text-sm font-medium ${item.dividendYield !== null && item.dividendYield >= 3 ? 'text-green-600' : ''}`}>
                  {item.dividendYield !== null && item.dividendYield > 0 ? `${item.dividendYield.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-c-text-3">ROE</div>
                <div className={`text-sm font-medium ${item.roe !== null && item.roe >= 15 ? 'text-blue-600' : ''}`}>
                  {item.roe !== null ? `${item.roe.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.brokerCount >= 5 ? 'bg-green-100 text-green-700' : item.brokerCount >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-c-surface-2 text-c-text-2'}`}>
                증권사 {item.brokerCount}개
              </span>
              {item.sector && (
                <span className="text-xs text-c-text-3">{item.sector}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-c-surface-2 p-3 text-xs text-c-text-2">
        <span className="font-medium">색상 기준:</span>
        {' '}
        <span className="text-green-600">● PER&lt;15배 / PBR&lt;1배 / 배당수익률≥3% / ROE≥15%</span>
        {' '}·
        {' '}
        <span className="text-blue-600">● ROE≥15%</span>
        {' '}·
        {' '}
        <span className="text-red-500">● PER&gt;30배 / ROE&lt;0%</span>
        {' '}· N/A = 해당 데이터 미제공
      </div>
    </div>
  );
}
