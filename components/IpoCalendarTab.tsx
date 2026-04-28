import { useEffect, useMemo, useState } from 'react';
import { LoadingState } from './LoadingState';
import type { IpoDeal, IpoCalendarResponse, IpoStatus } from '@/pages/api/ipo-calendar';

const SWISS_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const STATUS_CONFIG: Record<IpoStatus, { badgeClass: string }> = {
  청약중: { badgeClass: 'border-[#002FA7] bg-[#002FA7] text-white' },
  청약예정: { badgeClass: 'border-[#C7D6FF] bg-[#EDF3FF] text-[#002FA7]' },
  상장예정: { badgeClass: 'border-[#D9DDE3] bg-white text-[#111827]' },
  상장완료: { badgeClass: 'border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]' },
};

const FILTER_OPTIONS: [IpoStatus | 'all', string][] = [
  ['all', '전체'],
  ['청약예정', '청약예정'],
  ['청약중', '청약중'],
  ['상장예정', '상장예정'],
  ['상장완료', '상장완료'],
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

type EventKind = 'sub_start' | 'sub_end' | 'listing' | 'refund';

interface CalEvent {
  name: string;
  kind: EventKind;
}

const EVENT_CONFIG: Record<
  EventKind,
  { label: string; pillClass: string; lineClass: string }
> = {
  sub_start: {
    label: '시작',
    pillClass: 'border-[#C7D6FF] bg-[#EDF3FF] text-[#002FA7]',
    lineClass: 'bg-[#002FA7]',
  },
  sub_end: {
    label: '마감',
    pillClass: 'border-[#111827] bg-[#111827] text-white',
    lineClass: 'bg-[#111827]',
  },
  listing: {
    label: '상장',
    pillClass: 'border-[#D9DDE3] bg-white text-[#374151]',
    lineClass: 'bg-[#6B7280]',
  },
  refund: {
    label: '환불',
    pillClass: 'border-[#E5E7EB] bg-[#F7F7F8] text-[#9CA3AF]',
    lineClass: 'bg-[#C7CED8]',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function formatDateFull(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function formatPrice(deal: IpoDeal): string {
  if (deal.confirmedPrice) return `${deal.confirmedPrice.toLocaleString()}원 (확정)`;
  if (deal.priceBandLow && deal.priceBandHigh) {
    return `${deal.priceBandLow.toLocaleString()}~${deal.priceBandHigh.toLocaleString()}원`;
  }
  return '-';
}

function getDday(deal: IpoDeal): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let targetIso: string | null = null;
  if (deal.status === '청약예정') targetIso = deal.subscriptionStart;
  else if (deal.status === '청약중') targetIso = deal.subscriptionEnd;
  else if (deal.status === '상장예정') targetIso = deal.listingDate;

  if (!targetIso) return null;

  const target = new Date(targetIso);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return null;
}

function buildEventMap(ipos: IpoDeal[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();

  function add(iso: string | null, name: string, kind: EventKind) {
    if (!iso) return;
    const list = map.get(iso) ?? [];
    list.push({ name, kind });
    map.set(iso, list);
  }

  for (const deal of ipos) {
    add(deal.subscriptionStart, deal.name, 'sub_start');
    add(deal.subscriptionEnd, deal.name, 'sub_end');
    add(deal.listingDate, deal.name, 'listing');
    add(deal.refundDate, deal.name, 'refund');
  }

  return map;
}

function calendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= lastDate; day++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: IpoStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_CONFIG[status].badgeClass}`}
    >
      {status}
    </span>
  );
}

function SummaryMetric({
  index,
  label,
  value,
  accent = false,
}: {
  index: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium tracking-[0.24em] text-[#9CA3AF]">{index}</span>
        <span className="h-px flex-1 bg-[#E5E7EB]" />
      </div>
      <div className="mt-4 text-sm text-[#6B7280]">{label}</div>
      <div
        className={`mt-1 text-3xl font-semibold tracking-[-0.05em] ${accent ? 'text-[#002FA7]' : 'text-[#111827]'}`}
      >
        {value}
      </div>
    </div>
  );
}

function DetailCell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'muted' }) {
  return (
    <div className="bg-[#F7F7F8] p-3">
      <div className="text-[11px] text-[#9CA3AF]">{label}</div>
      <div
        className={`mt-1 text-sm font-medium ${
          tone === 'accent' ? 'text-[#002FA7]' : tone === 'muted' ? 'text-[#6B7280]' : 'text-[#111827]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function IpoCalendarGrid({
  ipos,
  calMonth,
  onPrev,
  onNext,
  onToday,
}: {
  ipos: IpoDeal[];
  calMonth: { year: number; month: number };
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const { year, month } = calMonth;
  const todayIso = new Date().toISOString().split('T')[0];
  const eventMap = useMemo(() => buildEventMap(ipos), [ipos]);
  const cells = useMemo(() => calendarDays(year, month), [year, month]);
  const monthMeta = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    let eventCount = 0;
    const deals = new Set<string>();

    eventMap.forEach((events, iso) => {
      if (!iso.startsWith(prefix)) return;
      eventCount += events.length;
      events.forEach((event) => deals.add(event.name));
    });

    return { eventCount, dealCount: deals.size };
  }, [eventMap, month, year]);

  return (
    <div className="overflow-hidden border border-[#D9DDE3] bg-white">
      <div className="grid gap-px bg-[#D9DDE3] lg:grid-cols-[minmax(0,1fr)_272px]">
        <div className="bg-[#F7F7F8] p-5 sm:p-6">
          <div className="text-[11px] tracking-[0.18em] text-[#6B7280]">월별 보기</div>
          <div className="mt-4 flex items-end gap-4">
            <div className="text-[4.5rem] font-semibold leading-none tracking-[-0.08em] text-[#111827] sm:text-[5.5rem]">
              {String(month + 1).padStart(2, '0')}
            </div>
            <div className="pb-2">
              <div className="text-base font-semibold text-[#111827]">
                {year}년 {month + 1}월
              </div>
              <div className="mt-1 text-sm text-[#6B7280]">
                {monthMeta.eventCount}개 일정 · {monthMeta.dealCount}개 종목
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[#D9DDE3]">
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]"
            aria-label="이전 달"
          >
            <span>이전</span>
            <span className="text-lg leading-none text-[#111827]">‹</span>
          </button>
          <button
            type="button"
            onClick={onToday}
            className="bg-white px-4 py-4 text-sm font-medium text-[#002FA7] transition hover:bg-[#F7F7F8]"
          >
            이번달
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center justify-between bg-white px-4 py-4 text-sm text-[#6B7280] transition hover:text-[#111827]"
            aria-label="다음 달"
          >
            <span className="text-lg leading-none text-[#111827]">›</span>
            <span>다음</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px border-t border-[#D9DDE3] bg-[#D9DDE3]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-white px-2 py-3 text-left text-[11px] font-medium tracking-[0.18em] text-[#6B7280] sm:px-3"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[#D9DDE3]">
        {cells.map((iso, index) => {
          const isToday = iso === todayIso;
          const events = iso ? eventMap.get(iso) ?? [] : [];
          const visibleEvents = events.slice(0, 2);
          const overflow = events.length - visibleEvents.length;
          const dayNumber = iso ? Number(iso.split('-')[2]) : null;

          return (
            <div
              key={iso ?? `empty-${index}`}
              className={`min-h-[112px] p-2.5 sm:min-h-[132px] sm:p-3 ${
                iso ? 'bg-white' : 'bg-[#F7F7F8]'
              }`}
            >
              {dayNumber !== null && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className={`h-[2px] w-7 ${isToday ? 'bg-[#002FA7]' : 'bg-[#E5E7EB]'}`}
                      />
                      <div
                        className={`mt-2 text-[1.45rem] font-semibold leading-none tracking-[-0.06em] ${
                          isToday ? 'text-[#002FA7]' : 'text-[#111827]'
                        }`}
                      >
                        {String(dayNumber).padStart(2, '0')}
                      </div>
                    </div>
                    {events.length > 0 && (
                      <div className="pt-1 text-[10px] text-[#9CA3AF]">{events.length}건</div>
                    )}
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {visibleEvents.map((event, eventIndex) => {
                      const config = EVENT_CONFIG[event.kind];
                      const shortName = event.name.length > 7 ? `${event.name.slice(0, 6)}…` : event.name;

                      return (
                        <div
                          key={`${iso}-${event.kind}-${eventIndex}`}
                          className={`flex items-center gap-2 rounded-[10px] border px-2 py-1 text-[10px] leading-tight ${config.pillClass}`}
                          title={`${event.name} (${config.label})`}
                        >
                          <span className={`h-2 w-2 flex-none rounded-full ${config.lineClass}`} />
                          <span className="truncate">{shortName}</span>
                          <span className="flex-none">{config.label}</span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div className="text-[10px] text-[#9CA3AF]">+{overflow}개 더 있음</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#D9DDE3] px-4 py-3 sm:px-5">
        {(Object.entries(EVENT_CONFIG) as [EventKind, { label: string; lineClass: string }][]).map(
          ([kind, config]) => (
            <span key={kind} className="inline-flex items-center gap-2 text-[11px] text-[#6B7280]">
              <span className={`h-[2px] w-5 ${config.lineClass}`} />
              {config.label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function IpoCard({ deal }: { deal: IpoDeal }) {
  const dday = getDday(deal);

  return (
    <article className="border border-[#D9DDE3] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] text-[#6B7280]">
            {formatDateFull(deal.subscriptionStart)} - {formatDate(deal.subscriptionEnd)}
          </div>
          <div className="mt-2 truncate text-lg font-semibold tracking-[-0.04em] text-[#111827]">
            {deal.name}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={deal.status} />
          {dday && <span className="text-sm font-semibold text-[#002FA7]">{dday}</span>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px bg-[#D9DDE3]">
        <DetailCell label="공모가" value={formatPrice(deal)} />
        <DetailCell label="주간사" value={deal.underwriter || '-'} tone="muted" />
        <DetailCell label="상장일" value={deal.listingDate ? formatDateFull(deal.listingDate) : '-'} />
        <DetailCell label="경쟁률" value={deal.competitionRatio || '-'} tone={deal.competitionRatio ? 'accent' : 'muted'} />
      </div>
    </article>
  );
}

export function IpoCalendarTab() {
  const [filter, setFilter] = useState<IpoStatus | 'all'>('all');
  const [data, setData] = useState<IpoCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/ipo-calendar')
      .then((res) => {
        if (!res.ok) throw new Error('공모주 일정을 불러올 수 없습니다');
        return res.json() as Promise<IpoCalendarResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : '오류가 발생했습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <div className="rounded-lg bg-c-negative-bg p-4 text-c-negative">{error}</div>;
  if (!data) return null;

  const { ipos, fetchedAt } = data;
  const counts: Record<IpoStatus, number> = {
    청약중: ipos.filter((deal) => deal.status === '청약중').length,
    청약예정: ipos.filter((deal) => deal.status === '청약예정').length,
    상장예정: ipos.filter((deal) => deal.status === '상장예정').length,
    상장완료: ipos.filter((deal) => deal.status === '상장완료').length,
  };
  const filtered = filter === 'all' ? ipos : ipos.filter((deal) => deal.status === filter);

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: SWISS_FONT, fontVariantNumeric: 'tabular-nums' }}
    >
      <div className="grid gap-px border border-[#D9DDE3] bg-[#D9DDE3] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="bg-[#F7F7F8] px-5 py-6 sm:px-6 sm:py-7">
          <div className="text-[11px] tracking-[0.18em] text-[#6B7280]">업데이트 {formatUpdatedAt(fetchedAt)}</div>
          <h2 className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.06em] text-[#111827] sm:text-[2.5rem]">
            공모주 일정
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#6B7280]">
            청약 시작일, 마감일, 환불일, 상장일을 한 화면에서 보고 상태별로 바로 걸러볼 수 있습니다.
          </p>
        </div>
        <div className="grid gap-px bg-[#D9DDE3] sm:grid-cols-2">
          <SummaryMetric index="01" label="청약예정" value={`${counts.청약예정}건`} accent />
          <SummaryMetric index="02" label="청약중" value={`${counts.청약중}건`} accent />
          <SummaryMetric index="03" label="상장예정" value={`${counts.상장예정}건`} />
          <SummaryMetric index="04" label="전체" value={`${ipos.length}건`} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(([id, label]) => {
          const isActive = filter === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-[#002FA7] bg-[#002FA7] text-white'
                  : 'border-[#D9DDE3] bg-white text-[#6B7280] hover:border-[#002FA7] hover:text-[#002FA7]'
              }`}
            >
              <span>{label}</span>
              {id !== 'all' && <span className="ml-1.5 opacity-80">{counts[id as IpoStatus]}</span>}
            </button>
          );
        })}
      </div>

      <IpoCalendarGrid
        ipos={ipos}
        calMonth={calMonth}
        onPrev={() =>
          setCalMonth(({ year, month }) =>
            month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
          )
        }
        onNext={() =>
          setCalMonth(({ year, month }) =>
            month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
          )
        }
        onToday={() => {
          const now = new Date();
          setCalMonth({ year: now.getFullYear(), month: now.getMonth() });
        }}
      />

      {filtered.length === 0 && (
        <div className="border border-[#D9DDE3] bg-white px-4 py-12 text-center text-sm text-[#6B7280]">
          해당 조건의 공모주가 없습니다.
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="grid gap-3 sm:hidden">
            {filtered.map((deal) => (
              <IpoCard key={deal.id} deal={deal} />
            ))}
          </div>

          <div className="hidden overflow-x-auto border border-[#D9DDE3] bg-white sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#D9DDE3] bg-[#F7F7F8] text-left text-[11px] tracking-[0.18em] text-[#6B7280]">
                  <th className="px-4 py-4 font-medium">상태</th>
                  <th className="px-4 py-4 font-medium">종목명</th>
                  <th className="px-4 py-4 font-medium">청약기간</th>
                  <th className="px-4 py-4 font-medium">공모가</th>
                  <th className="px-4 py-4 font-medium">주간사</th>
                  <th className="px-4 py-4 text-right font-medium">D-DAY</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal) => {
                  const dday = getDday(deal);

                  return (
                    <tr key={deal.id} className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F7F7F8]">
                      <td className="px-4 py-4">
                        <StatusBadge status={deal.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#111827]">{deal.name}</div>
                      </td>
                      <td className="px-4 py-4 text-[#6B7280]">
                        {formatDateFull(deal.subscriptionStart)} - {formatDate(deal.subscriptionEnd)}
                      </td>
                      <td className="px-4 py-4 text-[#111827]">{formatPrice(deal)}</td>
                      <td className="max-w-[220px] truncate px-4 py-4 text-[#6B7280]">
                        {deal.underwriter || '-'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {dday ? (
                          <span className="font-semibold text-[#002FA7]">{dday}</span>
                        ) : deal.competitionRatio ? (
                          <span className="text-[#111827]">{deal.competitionRatio}</span>
                        ) : (
                          <span className="text-[#9CA3AF]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
