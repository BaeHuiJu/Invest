import { useEffect, useMemo, useState } from 'react';
import { LoadingState } from '@/components/LoadingState';
import { IpoAllocationCalculatorModal } from '@/components/IpoAllocationCalculatorModal';
import { readWatchlistStorage } from '@/lib/watchlist-storage';
import type { IpoDeal, IpoCalendarResponse } from '@/lib/ipo-types';

// ── Types ─────────────────────────────────────────────────────────────────────

type EarningsEvent = {
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  date: string;
  time: 'BMO' | 'AMC' | 'TBD';
  epsEstimate?: number;
  epsActual?: number;
  surprise?: number;
  isComplete: boolean;
};

type EarningsCalendarResponse = {
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
};

type CalEventKind = 'ipo_start' | 'ipo_end' | 'ipo_listing' | 'ipo_refund' | 'earnings';
type FilterKind   = 'all' | 'watchlist' | CalEventKind;
type ViewMode     = 'monthly' | 'weekly';

type CalEvent = {
  kind: CalEventKind;
  name: string;
  deal?: IpoDeal;
  earnings?: EarningsEvent;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SWISS    = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const WEEK_MON = ['월', '화', '수', '목', '금', '토', '일'] as const;

const EVENT_CFG: Record<CalEventKind, { label: string; pill: string; dot: string }> = {
  ipo_start:   { label: '청약시작', pill: 'bg-[#EDF3FF] text-[#002FA7] border-[#C7D6FF]',  dot: 'bg-[#002FA7]' },
  ipo_end:     { label: '청약마감', pill: 'bg-[#111827] text-white border-[#111827]',        dot: 'bg-[#111827]' },
  ipo_listing: { label: '상장',     pill: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',  dot: 'bg-[#D97706]' },
  ipo_refund:  { label: '환불',     pill: 'bg-[#F7F7F8] text-[#9CA3AF] border-[#E5E7EB]',  dot: 'bg-[#C7CED8]' },
  earnings:    { label: '실적',     pill: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',  dot: 'bg-[#7C3AED]' },
};

const TIME_LABEL: Record<string, string> = { BMO: '장전', AMC: '장후', TBD: '미정' };
const KIND_ORDER: CalEventKind[] = ['ipo_start', 'ipo_end', 'ipo_listing', 'ipo_refund', 'earnings'];

// ── Utils ─────────────────────────────────────────────────────────────────────

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toIso(d);
  });
}

function calendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildEventMap(ipos: IpoDeal[], earnings: EarningsEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  function push(iso: string | null, evt: CalEvent) {
    if (!iso) return;
    const list = map.get(iso) ?? [];
    list.push(evt);
    map.set(iso, list);
  }
  for (const deal of ipos) {
    push(deal.subscriptionStart, { kind: 'ipo_start', name: deal.name, deal });
    push(deal.subscriptionEnd,   { kind: 'ipo_end',   name: deal.name, deal });
    if (deal.listingDate) push(deal.listingDate, { kind: 'ipo_listing', name: deal.name, deal });
    if (deal.refundDate)  push(deal.refundDate,  { kind: 'ipo_refund',  name: deal.name, deal });
  }
  for (const e of earnings) {
    push(e.date, { kind: 'earnings', name: e.name, earnings: e });
  }
  map.forEach((evts, key) => {
    map.set(key, [...evts].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)));
  });
  return map;
}

function shortDate(iso: string | null): string {
  if (!iso) return '-';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function fullKorDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(iso).getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${dow})`;
}

function fmtSurprise(v?: number): string {
  if (v === undefined || v === null) return '-';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function getDday(iso: string, todayIso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - new Date(todayIso).getTime()) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function isWatchlisted(evt: CalEvent, tickers: Set<string>): boolean {
  if (evt.kind === 'earnings') return tickers.has(evt.earnings!.ticker);
  return false;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventPill({
  evt,
  compact = false,
  starred = false,
}: {
  evt: CalEvent;
  compact?: boolean;
  starred?: boolean;
}) {
  const cfg = EVENT_CFG[evt.kind];
  const maxLen = compact ? 5 : 7;
  const short  = evt.name.length > maxLen ? `${evt.name.slice(0, maxLen - 1)}…` : evt.name;
  return (
    <div className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${cfg.pill}`}>
      {starred && <span className="shrink-0 text-[9px]">★</span>}
      <span className="shrink-0">{cfg.label}</span>
      <span className="truncate">{short}</span>
    </div>
  );
}

function ThisWeekWidget({
  rawMap,
  watchlistTickers,
  todayIso,
  onSelectDate,
}: {
  rawMap: Map<string, CalEvent[]>;
  watchlistTickers: Set<string>;
  todayIso: string;
  onSelectDate: (iso: string) => void;
}) {
  const monday   = getMonday(new Date(todayIso));
  const isos     = weekDays(monday);
  const entries: { date: string; evt: CalEvent }[] = [];
  isos.forEach(iso => {
    (rawMap.get(iso) ?? []).forEach(evt => entries.push({ date: iso, evt }));
  });

  return (
    <div className="overflow-hidden border border-[#D9DDE3] bg-white">
      <div className="flex items-center justify-between border-b border-[#D9DDE3] px-4 py-3">
        <div className="text-[11px] font-medium tracking-[0.18em] text-[#6B7280]">이번 주 예정</div>
        <div className="text-sm font-semibold text-[#111827]">{entries.length}건</div>
      </div>
      {entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#9CA3AF]">이번 주 예정된 일정이 없습니다</div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto px-4 py-3"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {entries.map(({ date, evt }, i) => {
            const cfg     = EVENT_CFG[evt.kind];
            const watched = isWatchlisted(evt, watchlistTickers);
            const dday    = getDday(date, todayIso);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectDate(date)}
                className={`flex shrink-0 flex-col gap-1.5 rounded-lg border p-3 text-left transition hover:shadow-sm ${
                  watched
                    ? 'border-[#002FA7] bg-[#EDF3FF] ring-1 ring-[#002FA7]'
                    : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                }`}
                style={{ minWidth: 128 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.pill}`}>
                    {cfg.label}
                  </span>
                  {watched && <span className="text-[10px] text-[#002FA7]">★</span>}
                </div>
                <div className="max-w-[120px] truncate text-sm font-semibold text-[#111827]">
                  {evt.name}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6B7280]">{shortDate(date)}</span>
                  <span className={`text-[11px] font-semibold ${dday === 'D-Day' ? 'text-[#DC2626]' : 'text-[#002FA7]'}`}>
                    {dday}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IpoDetailRow({
  evt,
  onOpenCalculator,
  isWatched,
}: {
  evt: CalEvent;
  onOpenCalculator: (deal: IpoDeal) => void;
  isWatched?: boolean;
}) {
  const deal = evt.deal!;
  const cfg  = EVENT_CFG[evt.kind];
  return (
    <div className="grid gap-px bg-[#D9DDE3] sm:grid-cols-[auto_1fr]">
      <div className="flex items-start justify-between gap-3 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.pill}`}>
            {cfg.label}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#111827]">{deal.name}</span>
              {isWatched && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-[#C7D6FF] bg-[#EDF3FF] px-1.5 py-0.5 text-[10px] font-medium text-[#002FA7]">
                  ★ 관심
                </span>
              )}
            </div>
            <div className="mt-0.5 text-sm text-[#6B7280]">주간사 {deal.underwriter || '-'}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenCalculator(deal)}
          className="shrink-0 rounded-full border border-[#002FA7] px-3 py-1 text-xs font-medium text-[#002FA7] transition hover:bg-[#EDF3FF]"
        >
          배정 계산기
        </button>
      </div>
      <div className="grid grid-cols-3 gap-px bg-[#D9DDE3]">
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">청약기간</div>
          <div className="mt-1 text-sm font-medium text-[#111827]">
            {shortDate(deal.subscriptionStart)}~{shortDate(deal.subscriptionEnd)}
          </div>
        </div>
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">공모가</div>
          <div className="mt-1 text-sm font-medium text-[#111827]">
            {deal.confirmedPrice
              ? `${deal.confirmedPrice.toLocaleString()}원`
              : deal.priceBandLow && deal.priceBandHigh
              ? `${deal.priceBandLow.toLocaleString()}~${deal.priceBandHigh.toLocaleString()}원`
              : '-'}
          </div>
        </div>
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">상태</div>
          <div className="mt-1 text-sm font-medium text-[#111827]">{deal.status}</div>
        </div>
      </div>
    </div>
  );
}

function EarningsDetailRow({
  evt,
  isWatched,
}: {
  evt: CalEvent;
  isWatched?: boolean;
}) {
  const e        = evt.earnings!;
  const cfg      = EVENT_CFG.earnings;
  const surpVal  = e.surprise ?? 0;
  const surpColor =
    e.surprise === undefined
      ? 'text-[#111827]'
      : surpVal > 0
      ? 'text-[#059669]'
      : surpVal < 0
      ? 'text-[#DC2626]'
      : 'text-[#111827]';
  return (
    <div className="grid gap-px bg-[#D9DDE3] sm:grid-cols-[auto_1fr]">
      <div className="flex items-start gap-3 bg-white p-4 sm:p-5">
        <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.pill}`}>
          {cfg.label}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#111827]">{e.name}</span>
            {isWatched && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-[#C7D6FF] bg-[#EDF3FF] px-1.5 py-0.5 text-[10px] font-medium text-[#002FA7]">
                ★ 관심
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-[#6B7280]">
            {e.ticker} · {e.market === 'korea' ? '한국' : '미국'} · {TIME_LABEL[e.time] ?? e.time}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-[#D9DDE3]">
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">EPS 예상</div>
          <div className="mt-1 text-sm font-medium text-[#111827]">
            {e.epsEstimate !== undefined ? `$${e.epsEstimate.toFixed(2)}` : '-'}
          </div>
        </div>
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">EPS 실제</div>
          <div className="mt-1 text-sm font-medium text-[#111827]">
            {e.epsActual !== undefined ? `$${e.epsActual.toFixed(2)}` : '-'}
          </div>
        </div>
        <div className="bg-[#F7F7F8] p-3">
          <div className="text-[11px] text-[#9CA3AF]">서프라이즈</div>
          <div className={`mt-1 text-sm font-medium ${surpColor}`}>{fmtSurprise(e.surprise)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function InvestmentCalendarTab() {
  const today    = new Date();
  const todayIso = toIso(today);

  // ── state ───────────────────────────────────────────
  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth());
  const [weekStart, setWeekStart]     = useState<Date>(() => getMonday(today));
  const [viewMode, setViewMode]       = useState<ViewMode>('monthly');
  const [ipos, setIpos]               = useState<IpoDeal[]>([]);
  const [earnings, setEarnings]       = useState<EarningsEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDate, setSelected]   = useState<string | null>(null);
  const [filter, setFilter]           = useState<FilterKind>('all');
  const [watchlistTickers, setWlTickers] = useState<Set<string>>(new Set());
  const [calculatorDeal, setCalcDeal] = useState<IpoDeal | null>(null);

  // ── data fetch ──────────────────────────────────────
  useEffect(() => {
    const items = readWatchlistStorage<{ ticker: string }>();
    setWlTickers(new Set(items.map(i => i.ticker)));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/ipo-calendar').then(r => r.json() as Promise<IpoCalendarResponse>),
      fetch('/api/earnings-calendar').then(r => r.json() as Promise<EarningsCalendarResponse>),
    ])
      .then(([ipoData, earData]) => {
        setIpos(ipoData.ipos ?? []);
        setEarnings([...(earData.upcoming ?? []), ...(earData.recent ?? [])]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── memos ───────────────────────────────────────────
  const rawMap = useMemo(() => buildEventMap(ipos, earnings), [ipos, earnings]);

  const eventMap = useMemo(() => {
    if (filter === 'all') return rawMap;
    const m = new Map<string, CalEvent[]>();
    rawMap.forEach((evts, date) => {
      let filtered: CalEvent[];
      if (filter === 'watchlist') {
        filtered = evts.filter(e => isWatchlisted(e, watchlistTickers));
      } else {
        filtered = evts.filter(e => e.kind === filter);
      }
      if (filtered.length > 0) m.set(date, filtered);
    });
    return m;
  }, [rawMap, filter, watchlistTickers]);

  const cells      = useMemo(() => calendarDays(year, month), [year, month]);
  const weekIsos   = useMemo(() => weekDays(weekStart), [weekStart]);

  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    let ipoEvt = 0, earEvt = 0;
    rawMap.forEach((evts, iso) => {
      if (!iso.startsWith(prefix)) return;
      evts.forEach(e => { if (e.kind === 'earnings') earEvt++; else ipoEvt++; });
    });
    return { ipoEvt, earEvt };
  }, [rawMap, year, month]);

  const selectedEvents = selectedDate ? (eventMap.get(selectedDate) ?? []) : [];

  // ── navigation ──────────────────────────────────────
  function prevMonth() {
    setSelected(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    setSelected(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goThisMonth() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(todayIso);
  }
  function prevWeek() {
    setSelected(null);
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setSelected(null);
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goThisWeek() {
    setWeekStart(getMonday(today));
    setSelected(todayIso);
  }
  function handleSelectDate(iso: string) {
    if (viewMode === 'weekly') {
      setSelected(prev => (prev === iso ? null : iso));
    } else {
      const evts = eventMap.get(iso) ?? [];
      if (evts.length > 0) setSelected(prev => (prev === iso ? null : iso));
    }
  }

  // ── week header label ────────────────────────────────
  const weekLabel = useMemo(() => {
    const s = shortDate(weekIsos[0]);
    const e = shortDate(weekIsos[6]);
    return `${s} ~ ${e}`;
  }, [weekIsos]);

  if (loading) return <LoadingState />;

  // ── shared header sub-section ────────────────────────
  const viewToggle = (
    <div className="flex overflow-hidden rounded border border-[#D9DDE3] text-xs font-medium">
      <button
        type="button"
        onClick={() => setViewMode('monthly')}
        className={`px-3 py-1.5 transition ${
          viewMode === 'monthly' ? 'bg-[#111827] text-white' : 'bg-white text-[#6B7280] hover:bg-[#F7F7F8]'
        }`}
      >
        월간
      </button>
      <button
        type="button"
        onClick={() => setViewMode('weekly')}
        className={`border-l border-[#D9DDE3] px-3 py-1.5 transition ${
          viewMode === 'weekly' ? 'bg-[#111827] text-white' : 'bg-white text-[#6B7280] hover:bg-[#F7F7F8]'
        }`}
      >
        주간
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: SWISS }} className="space-y-4">

      {/* ── 이번 주 요약 위젯 ─────────────────────────── */}
      <ThisWeekWidget
        rawMap={rawMap}
        watchlistTickers={watchlistTickers}
        todayIso={todayIso}
        onSelectDate={(iso) => {
          if (viewMode === 'monthly') {
            const [y, m] = iso.split('-').map(Number);
            setYear(y); setMonth(m - 1);
          }
          setSelected(iso);
        }}
      />

      {/* ── 캘린더 카드 ───────────────────────────────── */}
      <div className="overflow-hidden border border-[#D9DDE3] bg-white">

        {/* 헤더: 월/주 정보 + 네비게이션 */}
        <div className="grid gap-px bg-[#D9DDE3] sm:grid-cols-[1fr_auto]">
          <div className="bg-[#F7F7F8] p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="text-[11px] tracking-[0.18em] text-[#6B7280]">투자 일정 캘린더</div>
              {viewToggle}
            </div>
            {viewMode === 'monthly' ? (
              <div className="mt-4 flex items-end gap-4">
                <div className="text-[4rem] font-semibold leading-none tracking-[-0.08em] text-[#111827] sm:text-[5rem]">
                  {String(month + 1).padStart(2, '0')}
                </div>
                <div className="pb-1.5">
                  <div className="text-base font-semibold text-[#111827]">{year}년 {month + 1}월</div>
                  <div className="mt-1 flex gap-2 text-sm text-[#6B7280]">
                    <span>공모주 {monthStats.ipoEvt}건</span>
                    <span>·</span>
                    <span>실적 {monthStats.earEvt}건</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-2xl font-semibold tracking-[-0.04em] text-[#111827]">{weekLabel}</div>
                <div className="mt-1 text-sm text-[#6B7280]">주간 보기</div>
              </div>
            )}
          </div>

          {/* 네비게이션 버튼 */}
          <div className="grid grid-cols-3 gap-px bg-[#D9DDE3] sm:min-w-[240px]">
            {viewMode === 'monthly' ? (
              <>
                <button type="button" onClick={prevMonth}
                  className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]">
                  <span>이전</span><span className="text-xl leading-none">‹</span>
                </button>
                <button type="button" onClick={goThisMonth}
                  className="bg-white px-3 py-4 text-sm font-medium text-[#002FA7] transition hover:bg-[#F7F7F8]">
                  이번달
                </button>
                <button type="button" onClick={nextMonth}
                  className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]">
                  <span className="text-xl leading-none">›</span><span>다음</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={prevWeek}
                  className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]">
                  <span>이전</span><span className="text-xl leading-none">‹</span>
                </button>
                <button type="button" onClick={goThisWeek}
                  className="bg-white px-3 py-4 text-sm font-medium text-[#002FA7] transition hover:bg-[#F7F7F8]">
                  이번주
                </button>
                <button type="button" onClick={nextWeek}
                  className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]">
                  <span className="text-xl leading-none">›</span><span>다음</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#D9DDE3] bg-white px-4 py-3">
          <button type="button" onClick={() => setFilter('all')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === 'all' ? 'border-[#111827] bg-[#111827] text-white' : 'border-[#D9DDE3] text-[#6B7280] hover:border-[#6B7280]'
            }`}>
            전체
          </button>
          <button type="button" onClick={() => setFilter('watchlist')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === 'watchlist'
                ? 'border-[#002FA7] bg-[#EDF3FF] text-[#002FA7]'
                : 'border-[#D9DDE3] text-[#6B7280] hover:border-[#9CA3AF]'
            }`}>
            <span>★</span>관심 종목
          </button>
          {(Object.entries(EVENT_CFG) as [CalEventKind, (typeof EVENT_CFG)[CalEventKind]][]).map(([kind, cfg]) => (
            <button key={kind} type="button" onClick={() => setFilter(kind)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === kind ? `${cfg.pill}` : 'border-[#D9DDE3] text-[#6B7280] hover:border-[#9CA3AF]'
              }`}>
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </button>
          ))}
        </div>

        {/* ── 월간 뷰 ───────────────────────────────────── */}
        {viewMode === 'monthly' && (
          <>
            <div className="grid grid-cols-7 gap-px border-t border-[#D9DDE3] bg-[#D9DDE3]">
              {WEEKDAYS.map(d => (
                <div key={d} className="bg-white px-2 py-2.5 text-[11px] font-medium tracking-[0.18em] text-[#6B7280] sm:px-3">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-[#D9DDE3]">
              {cells.map((iso, idx) => {
                const evts    = iso ? (eventMap.get(iso) ?? []) : [];
                const isToday = iso === todayIso;
                const isSel   = iso === selectedDate;
                const dayNum  = iso ? Number(iso.split('-')[2]) : null;
                const visible = evts.slice(0, 2);
                const overflow = evts.length - visible.length;

                return (
                  <div
                    key={iso ?? `empty-${idx}`}
                    onClick={() => iso && handleSelectDate(iso)}
                    className={[
                      'min-h-[96px] p-2 sm:min-h-[116px] sm:p-2.5',
                      !iso ? 'bg-[#F7F7F8]' :
                      isSel ? 'bg-[#EEF3FF] outline outline-1 -outline-offset-1 outline-[#002FA7]' :
                      evts.length > 0 ? 'cursor-pointer bg-white hover:bg-[#F7F7F8]' : 'bg-white',
                    ].join(' ')}
                  >
                    {dayNum !== null && (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className={`h-[2px] w-5 ${isToday ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`} />
                            <div className={`mt-1.5 text-lg font-semibold leading-none tracking-[-0.05em] sm:text-xl ${
                              isToday ? 'text-[#002FA7]' : 'text-[#111827]'
                            }`}>
                              {String(dayNum).padStart(2, '0')}
                            </div>
                          </div>
                          {evts.length > 0 && (
                            <div className="pt-0.5 text-[10px] text-[#9CA3AF]">{evts.length}건</div>
                          )}
                        </div>
                        {evts.length > 0 && (
                          <div className="mt-2.5 space-y-1">
                            {visible.map((evt, i) => (
                              <EventPill
                                key={i}
                                evt={evt}
                                compact
                                starred={isWatchlisted(evt, watchlistTickers)}
                              />
                            ))}
                            {overflow > 0 && (
                              <div className="text-[10px] text-[#9CA3AF]">+{overflow}건 더</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── 주간 뷰 ───────────────────────────────────── */}
        {viewMode === 'weekly' && (
          <>
            <div className="grid grid-cols-7 gap-px border-t border-[#D9DDE3] bg-[#D9DDE3]">
              {weekIsos.map((iso, i) => {
                const dayNum  = Number(iso.split('-')[2]);
                const isToday = iso === todayIso;
                return (
                  <div key={iso} className="bg-white px-2 py-2.5 sm:px-3">
                    <div className="text-[11px] font-medium tracking-[0.18em] text-[#6B7280]">{WEEK_MON[i]}</div>
                    <div className={`mt-0.5 text-sm font-semibold ${isToday ? 'text-[#002FA7]' : 'text-[#111827]'}`}>
                      {shortDate(iso)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-px bg-[#D9DDE3]">
              {weekIsos.map(iso => {
                const evts    = eventMap.get(iso) ?? [];
                const isToday = iso === todayIso;
                const isSel   = iso === selectedDate;
                return (
                  <div
                    key={iso}
                    onClick={() => handleSelectDate(iso)}
                    className={[
                      'min-h-[200px] cursor-pointer p-2 sm:p-3',
                      isSel ? 'bg-[#EEF3FF] outline outline-1 -outline-offset-1 outline-[#002FA7]' :
                      isToday ? 'bg-[#F8FAFF]' : 'bg-white hover:bg-[#F7F7F8]',
                    ].join(' ')}
                  >
                    {evts.length === 0 ? (
                      <div className="mt-2 text-[10px] text-[#E5E7EB]">—</div>
                    ) : (
                      <div className="space-y-1.5">
                        {evts.map((evt, i) => {
                          const cfg     = EVENT_CFG[evt.kind];
                          const watched = isWatchlisted(evt, watchlistTickers);
                          return (
                            <div
                              key={i}
                              className={`rounded border px-1.5 py-1 text-[10px] font-medium leading-tight ${cfg.pill} ${
                                watched ? 'ring-1 ring-[#002FA7]' : ''
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                {watched && <span className="text-[9px]">★</span>}
                                <span className="shrink-0 font-semibold">{cfg.label}</span>
                              </div>
                              <div className="mt-0.5 truncate">{evt.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── 일정 상세 패널 ────────────────────────────── */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="overflow-hidden border border-[#D9DDE3] bg-white">
          <div className="flex items-center justify-between border-b border-[#D9DDE3] px-5 py-4">
            <div>
              <div className="text-[11px] tracking-[0.18em] text-[#6B7280]">일정 상세</div>
              <div className="mt-0.5 text-lg font-semibold text-[#111827]">{fullKorDate(selectedDate)}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full p-1 text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              aria-label="닫기"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {selectedEvents.map((evt, i) =>
              evt.kind === 'earnings' ? (
                <EarningsDetailRow
                  key={i}
                  evt={evt}
                  isWatched={isWatchlisted(evt, watchlistTickers)}
                />
              ) : (
                <IpoDetailRow
                  key={i}
                  evt={evt}
                  onOpenCalculator={setCalcDeal}
                  isWatched={isWatchlisted(evt, watchlistTickers)}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ── 배정 계산기 모달 ──────────────────────────── */}
      <IpoAllocationCalculatorModal
        deal={calculatorDeal}
        onClose={() => setCalcDeal(null)}
      />
    </div>
  );
}
