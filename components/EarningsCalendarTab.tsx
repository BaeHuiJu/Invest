import { useEffect, useState } from 'react';
import { LoadingState } from './LoadingState';
import { StatCard } from './StatCard';
import { SimpleSelect } from './SimpleSelect';

type MarketType = 'korea' | 'us';
type EarningsTime = 'BMO' | 'AMC' | 'TBD';

type EarningsEvent = {
  ticker: string;
  name: string;
  market: MarketType;
  date: string;
  time: EarningsTime;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  surprise?: number;
  isComplete: boolean;
};

type EarningsCalendarResponse = {
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
  watchlistTickers: string[];
};

const TIME_LABELS: Record<EarningsTime, string> = {
  BMO: '장전',
  AMC: '장후',
  TBD: '미정',
};

const formatPrice = (price: number, market: MarketType) =>
  market === 'korea'
    ? `${Math.round(price).toLocaleString()}원`
    : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

const getDaysUntil = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff < 0) return `${Math.abs(diff)}일 전`;
  return `${diff}일 후`;
};

export function EarningsCalendarTab() {
  const [market, setMarket] = useState<'all' | MarketType>('all');
  const [data, setData] = useState<EarningsCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEarnings() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ market });
        const res = await fetch(`/api/earnings-calendar?${params}`);
        if (!res.ok) throw new Error('실적 일정을 불러올 수 없습니다');

        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchEarnings();
  }, [market]);

  if (loading) return <LoadingState />;

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>;
  }

  if (!data) return null;

  // Group upcoming by date
  const upcomingByDate = new Map<string, EarningsEvent[]>();
  for (const event of data.upcoming) {
    const existing = upcomingByDate.get(event.date) || [];
    existing.push(event);
    upcomingByDate.set(event.date, existing);
  }

  const upcomingDates = Array.from(upcomingByDate.keys()).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">실적 캘린더</h2>
        <SimpleSelect
          label=""
          value={market}
          onChange={(v) => setMarket(v as 'all' | MarketType)}
          options={[
            ['all', '전체'],
            ['korea', '한국'],
            ['us', '미국'],
          ]}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="예정된 발표" value={`${data.upcoming.length}건`} />
        <StatCard
          label="이번주 발표"
          value={`${data.upcoming.filter((e) => {
            const days = Math.ceil(
              (new Date(e.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            return days >= 0 && days <= 7;
          }).length}건`}
        />
        <StatCard label="최근 발표" value={`${data.recent.length}건`} />
      </div>

      {/* Upcoming Earnings */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">발표 예정</h3>

        {upcomingDates.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            예정된 실적 발표가 없습니다.
          </div>
        ) : (
          <div className="space-y-6">
            {upcomingDates.map((date) => (
              <div key={date}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {formatDate(date)}
                  </span>
                  <span className="text-sm text-gray-500">{getDaysUntil(date)}</span>
                </div>
                <div className="space-y-2">
                  {upcomingByDate.get(date)?.map((event) => (
                    <div
                      key={`${event.date}-${event.ticker}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <span className="text-xs font-medium text-gray-600">
                            {event.market === 'korea' ? '🇰🇷' : '🇺🇸'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{event.name}</div>
                          <div className="text-xs text-gray-500">
                            {event.ticker} | {TIME_LABELS[event.time]} 발표
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {event.epsEstimate && (
                          <div className="text-sm">
                            <span className="text-gray-500">EPS 예상: </span>
                            <span className="font-medium">
                              {formatPrice(event.epsEstimate, event.market)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Earnings */}
      {data.recent.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">최근 발표 결과</h3>
          <div className="space-y-2">
            {data.recent.map((event) => (
              <div
                key={`${event.date}-${event.ticker}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-xs font-medium text-gray-600">
                      {event.market === 'korea' ? '🇰🇷' : '🇺🇸'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{event.name}</div>
                    <div className="text-xs text-gray-500">
                      {event.ticker} | {formatDate(event.date)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {event.epsActual && event.epsEstimate && (
                    <div className="text-sm">
                      <span className="text-gray-500">EPS: </span>
                      <span className="font-medium">
                        {formatPrice(event.epsActual, event.market)}
                      </span>
                      <span className="text-gray-400"> vs </span>
                      <span className="text-gray-500">
                        {formatPrice(event.epsEstimate, event.market)}
                      </span>
                    </div>
                  )}
                  {event.surprise != null && (
                    <div
                      className={`text-sm font-medium ${
                        event.surprise >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {event.surprise >= 0 ? '서프라이즈' : '미스'}{' '}
                      {event.surprise >= 0 ? '+' : ''}
                      {event.surprise.toFixed(1)}%
                      {event.surprise >= 0 ? ' 📈' : ' 📉'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
