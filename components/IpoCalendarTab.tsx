import { useEffect, useState } from 'react';
import { LoadingState } from './LoadingState';
import { StatCard } from './StatCard';
import type { IpoDeal, IpoCalendarResponse, IpoStatus } from '@/pages/api/ipo-calendar';

const STATUS_CONFIG: Record<IpoStatus, { badge: string; label: string }> = {
  '청약중':   { badge: 'bg-c-positive-bg text-c-positive',  label: '청약중'   },
  '청약예정': { badge: 'bg-c-info-bg text-c-info',          label: '청약예정' },
  '상장예정': { badge: 'bg-c-warning-bg text-c-warning',    label: '상장예정' },
  '상장완료': { badge: 'bg-c-neutral-bg text-c-neutral',    label: '상장완료' },
};

const FILTER_OPTIONS: [IpoStatus | 'all', string][] = [
  ['all',    '전체'],
  ['청약예정', '청약예정'],
  ['청약중',  '청약중'],
  ['상장예정', '상장예정'],
  ['상장완료', '상장완료'],
];

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function formatDateFull(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
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

function StatusBadge({ status }: { status: IpoStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

function IpoCard({ deal }: { deal: IpoDeal }) {
  const dday = getDday(deal);
  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-semibold text-c-text">{deal.name}</div>
        <StatusBadge status={deal.status} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-c-text-2">청약기간</span>
          <span className="text-c-text">
            {formatDateFull(deal.subscriptionStart)} ~ {formatDate(deal.subscriptionEnd)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-c-text-2">공모가</span>
          <span className="text-c-text">{formatPrice(deal)}</span>
        </div>
        {deal.listingDate && (
          <div className="flex justify-between">
            <span className="text-c-text-2">상장일</span>
            <span className="text-c-text">{formatDateFull(deal.listingDate)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-c-text-2">주간사</span>
          <span className="truncate text-c-text">{deal.underwriter || '-'}</span>
        </div>
        {deal.competitionRatio && (
          <div className="flex justify-between">
            <span className="text-c-text-2">경쟁률</span>
            <span className="font-medium text-c-positive">{deal.competitionRatio}</span>
          </div>
        )}
      </div>
      {dday && (
        <div className="mt-3 text-right text-xs font-bold text-c-accent">{dday}</div>
      )}
    </div>
  );
}

export function IpoCalendarTab() {
  const [filter, setFilter] = useState<IpoStatus | 'all'>('all');
  const [data, setData] = useState<IpoCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState />;

  if (error) {
    return <div className="rounded-lg bg-c-negative-bg p-4 text-c-negative">{error}</div>;
  }

  if (!data) return null;

  const { ipos, fetchedAt } = data;

  const counts = {
    '청약중':   ipos.filter((d) => d.status === '청약중').length,
    '청약예정': ipos.filter((d) => d.status === '청약예정').length,
    '상장예정': ipos.filter((d) => d.status === '상장예정').length,
  };

  const filtered = filter === 'all' ? ipos : ipos.filter((d) => d.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-c-text">공모주 일정</h2>
        <span className="text-xs text-c-text-2">
          업데이트: {new Date(fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="청약중" value={`${counts['청약중']}건`} />
        <StatCard label="청약예정" value={`${counts['청약예정']}건`} />
        <StatCard label="상장예정" value={`${counts['상장예정']}건`} />
        <StatCard label="전체" value={`${ipos.length}건`} />
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === id
                ? 'bg-c-accent text-white'
                : 'bg-c-surface-2 text-c-text-2 hover:bg-c-surface-3'
            }`}
          >
            {label}
            {id !== 'all' && (
              <span className="ml-1 opacity-70">
                {ipos.filter((d) => d.status === id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-c-border bg-c-surface py-12 text-center text-c-text-2">
          해당 조건의 공모주가 없습니다.
        </div>
      )}

      {/* Mobile: Card Grid */}
      {filtered.length > 0 && (
        <>
          <div className="grid gap-3 sm:hidden">
            {filtered.map((deal) => (
              <IpoCard key={deal.id} deal={deal} />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-c-border bg-c-surface shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-c-border bg-c-surface-2 text-left text-xs text-c-text-2">
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">종목명</th>
                  <th className="px-4 py-3 font-medium">청약기간</th>
                  <th className="px-4 py-3 font-medium">공모가</th>
                  <th className="px-4 py-3 font-medium">주간사</th>
                  <th className="px-4 py-3 text-right font-medium">D-day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-c-border">
                {filtered.map((deal) => {
                  const dday = getDday(deal);
                  return (
                    <tr key={deal.id} className="hover:bg-c-surface-2">
                      <td className="px-4 py-3">
                        <StatusBadge status={deal.status} />
                      </td>
                      <td className="px-4 py-3 font-medium text-c-text">{deal.name}</td>
                      <td className="px-4 py-3 text-c-text-2">
                        {formatDateFull(deal.subscriptionStart)} ~ {formatDate(deal.subscriptionEnd)}
                      </td>
                      <td className="px-4 py-3 text-c-text">{formatPrice(deal)}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-c-text-2">
                        {deal.underwriter || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dday ? (
                          <span className="font-bold text-c-accent">{dday}</span>
                        ) : deal.competitionRatio ? (
                          <span className="text-c-positive">{deal.competitionRatio}</span>
                        ) : (
                          <span className="text-c-text-3">-</span>
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
