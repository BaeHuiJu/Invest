import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from './StatCard';
import { LoadingState } from './LoadingState';
import { SimpleSelect } from './SimpleSelect';

type BacktestStrategy = 'follow_all' | 'top_broker' | 'high_entry_score' | 'consensus_only';
type PerformancePeriod = 'week1' | 'month1' | 'month3';
type MarketFilter = 'all' | 'korea' | 'us';

type BacktestTrade = {
  date: string;
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  broker: string;
  analyst: string;
  entryPrice: number;
  targetPrice: number;
  exitPrice: number;
  returnPct: number;
  targetProgressPct: number;
  success: boolean;
};

type BacktestResult = {
  strategy: BacktestStrategy;
  period: PerformancePeriod;
  market: MarketFilter;
  filters: {
    minEntryScore?: number;
    brokers?: string[];
    days: number;
  };
  summary: {
    totalTrades: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgReturn: number;
    totalReturn: number;
    maxReturn: number;
    minReturn: number;
    avgTargetProgress: number;
  };
  byBroker: {
    broker: string;
    trades: number;
    winRate: number;
    avgReturn: number;
  }[];
  trades: BacktestTrade[];
  equityCurve: { date: string; cumReturn: number }[];
};

const STRATEGY_LABELS: Record<BacktestStrategy, string> = {
  follow_all: '모든 추천',
  top_broker: '상위 증권사',
  high_entry_score: '고 Entry Score',
  consensus_only: '컨센서스 종목',
};

const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  week1: '1주',
  month1: '1개월',
  month3: '3개월',
};

const MARKET_LABELS: Record<MarketFilter, string> = {
  all: '전체',
  korea: '한국',
  us: '미국',
};

const formatPrice = (price: number, market: 'korea' | 'us') =>
  market === 'korea'
    ? `${Math.round(price).toLocaleString()}원`
    : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export function BacktestTab() {
  const [strategy, setStrategy] = useState<BacktestStrategy>('follow_all');
  const [period, setPeriod] = useState<PerformancePeriod>('month1');
  const [market, setMarket] = useState<MarketFilter>('all');
  const [days, setDays] = useState(90);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runBacktest() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          strategy,
          period,
          market,
          days: String(days),
        });

        const res = await fetch(`/api/backtest?${params}`);
        if (!res.ok) throw new Error('백테스트 실행 실패');

        const data = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    }

    runBacktest();
  }, [strategy, period, market, days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">백테스팅</h2>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">시뮬레이션 설정</h3>
        <div className="space-y-4">
          {/* Strategy Selection — full width */}
          <div>
            <label className="mb-2 block text-sm text-gray-500">전략</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STRATEGY_LABELS) as BacktestStrategy[]).map((s) => (
                <div key={s} className="relative">
                  {s === 'consensus_only' && (
                    <span className="absolute -top-2 -right-2 z-10 rounded-full bg-green-500 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm whitespace-nowrap">
                      ✓ 추천
                    </span>
                  )}
                  <button
                    onClick={() => setStrategy(s)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      strategy === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {STRATEGY_LABELS[s]}
                  </button>
                </div>
              ))}
            </div>

            {/* Strategy Description */}
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-blue-900">
                    {strategy === 'follow_all' && '모든 추천 따라하기'}
                    {strategy === 'top_broker' && '실적 우수 증권사'}
                    {strategy === 'high_entry_score' && '높은 Entry Score'}
                    {strategy === 'consensus_only' && '컨센서스 종목 (초보자 추천)'}
                  </div>
                  <div className="mt-1 text-blue-700">
                    {strategy === 'follow_all' && '모든 애널리스트 추천을 따라 매수합니다. 가장 많은 종목에 투자하지만, 분산투자 효과가 있습니다.'}
                    {strategy === 'top_broker' && '과거 성과가 우수한 증권사의 추천만 따릅니다. 신뢰도 높은 애널리스트를 선별하여 투자합니다.'}
                    {strategy === 'high_entry_score' && 'Entry Score 80점 이상인 종목만 선택합니다. 매수 타이밍이 좋은 종목에 집중 투자합니다.'}
                    {strategy === 'consensus_only' && '2개 이상 증권사가 동시에 추천하는 종목만 매수합니다. 여러 전문가의 의견이 일치하여 리스크가 낮습니다.'}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    <span className="font-medium text-blue-800">리스크:</span>
                    <span className={`rounded-full px-2 py-0.5 ${
                      strategy === 'consensus_only' ? 'bg-green-100 text-green-700' :
                      strategy === 'top_broker' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {strategy === 'consensus_only' ? '낮음' : strategy === 'top_broker' ? '보통' : '높음'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Period / Market / Days — 3-col grid below strategy */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SimpleSelect
              label="평가 기간"
              value={period}
              onChange={(v) => setPeriod(v as PerformancePeriod)}
              options={[
                ['week1', '1주 후'],
                ['month1', '1개월 후'],
                ['month3', '3개월 후'],
              ]}
            />
            <SimpleSelect
              label="시장"
              value={market}
              onChange={(v) => setMarket(v as MarketFilter)}
              options={[
                ['all', '전체'],
                ['korea', '한국'],
                ['us', '미국'],
              ]}
            />
            <div className="col-span-2 sm:col-span-1">
              <SimpleSelect
                label="데이터 기간"
                value={String(days)}
                onChange={(v) => setDays(parseInt(v, 10))}
                options={[
                  ['30', '최근 30일'],
                  ['60', '최근 60일'],
                  ['90', '최근 90일'],
                  ['180', '최근 180일'],
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && <LoadingState />}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      )}

      {result && !loading && (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="총 거래 수"
              value={`${result.summary.totalTrades}건`}
            />
            <StatCard
              label="승률"
              value={`${result.summary.winRate.toFixed(1)}%`}
              accent={
                result.summary.winRate >= 60
                  ? 'text-green-600'
                  : result.summary.winRate >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }
            />
            <StatCard
              label="평균 수익률"
              value={formatPct(result.summary.avgReturn)}
              accent={
                result.summary.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'
              }
            />
            <StatCard
              label="누적 수익률"
              value={formatPct(result.summary.totalReturn)}
              accent={
                result.summary.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
              }
            />
          </div>

          {/* Additional Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="승/패"
              value={`${result.summary.winCount} / ${result.summary.lossCount}`}
            />
            <StatCard
              label="최대 수익"
              value={formatPct(result.summary.maxReturn)}
              accent="text-green-600"
            />
            <StatCard
              label="최대 손실"
              value={formatPct(result.summary.minReturn)}
              accent="text-red-600"
            />
          </div>

          {/* Equity Curve Chart */}
          {result.equityCurve.length > 0 && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                누적 수익률 추이
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equityCurve}>
                    <defs>
                      <linearGradient id="cumReturnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '누적 수익률']}
                      labelFormatter={(label) => `날짜: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumReturn"
                      stroke="#3B82F6"
                      fill="url(#cumReturnGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By Broker Chart */}
          {result.byBroker.length > 0 && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                증권사별 성과
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.byBroker.slice(0, 10)}>
                    <XAxis
                      dataKey="broker"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'winRate' ? `${value.toFixed(1)}%` : `${value.toFixed(2)}%`,
                        name === 'winRate' ? '승률' : '평균 수익률',
                      ]}
                    />
                    <Bar dataKey="winRate" fill="#3B82F6" name="winRate" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Trade History Table */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              최근 거래 내역 ({result.trades.length}건)
            </h3>

            {/* Mobile View */}
            <div className="space-y-3 md:hidden">
              {result.trades.slice(0, 20).map((trade, idx) => (
                <article
                  key={`${trade.date}-${trade.ticker}-${idx}`}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{trade.name}</div>
                      <div className="text-xs text-gray-500">
                        {trade.ticker} | {trade.broker}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        trade.success
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {trade.success ? '성공' : '실패'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">수익률: </span>
                      <span
                        className={
                          trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatPct(trade.returnPct)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">진행률: </span>
                      <span>{trade.targetProgressPct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{trade.date}</div>
                </article>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">날짜</th>
                    <th className="px-4 py-3 text-left">종목</th>
                    <th className="px-4 py-3 text-left">증권사</th>
                    <th className="px-4 py-3 text-right">진입가</th>
                    <th className="px-4 py-3 text-right">청산가</th>
                    <th className="px-4 py-3 text-right">수익률</th>
                    <th className="px-4 py-3 text-center">결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.trades.slice(0, 50).map((trade, idx) => (
                    <tr
                      key={`${trade.date}-${trade.ticker}-${idx}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-500">{trade.date}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{trade.name}</div>
                        <div className="text-xs text-gray-400">{trade.ticker}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{trade.broker}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatPrice(trade.entryPrice, trade.market)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatPrice(trade.exitPrice, trade.market)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatPct(trade.returnPct)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            trade.success
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {trade.success ? '성공' : '실패'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
