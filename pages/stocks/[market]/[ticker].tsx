import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Area, AreaChart, Bar, BarChart, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { LoadingState } from '@/components/LoadingState';
import { StatCard } from '@/components/StatCard';
import { useToast } from '@/components/Toast';
import { calculateAllIndicators, type TechnicalAnalysis } from '@/lib/technical-indicators';
import { readWatchlistStorage, saveWatchlistStorage } from '@/lib/watchlist-storage';

type MarketType = 'korea' | 'us';
type PerformanceStatus = 'complete' | 'pending' | 'unavailable';
type PerformancePoint = {
  asOfDate: string;
  closePrice: number;
  returnPct: number;
  targetProgressPct: number;
  success: boolean;
  status: PerformanceStatus;
};
type AnalystReportPerformance = {
  week1: PerformancePoint;
  month1: PerformancePoint;
  month3: PerformancePoint;
};
type AnalystReport = {
  date: string;
  ticker: string;
  name: string;
  market: MarketType;
  broker: string;
  analyst: string;
  opinion: string;
  targetPrice: number;
  currentPrice: number;
  basePrice: number;
  basePriceDate: string;
  upside: number;
  reportTitle?: string;
  sourceUrl?: string;
  reasonSummary?: string;
  reasonBullets?: string[];
  sector?: string;
  performance?: AnalystReportPerformance;
};
type InsightSection = {
  summary: string;
  bullets: string[];
  signal?: 'up' | 'down' | 'flat' | 'mixed' | 'unknown';
};
type StockInsight = {
  ticker: string;
  name: string;
  market: MarketType;
  latestReportDate?: string;
  latestBroker?: string;
  latestOpinion?: string;
  latestTargetPrice?: number;
  latestCurrentPrice?: number;
  latestBasePrice?: number;
  avgUpside?: number;
  reportCount: number;
  reasonSummary: string;
  reasonBullets: string[];
  investmentLogic: InsightSection;
  estimateRevision: InsightSection;
  valuation: InsightSection;
  sectorCycle: InsightSection;
  relatedReports: AnalystReport[];
};
type StockInsightResponse = { found: boolean; insight: StockInsight };
type WatchlistItem = {
  ticker: string;
  name: string;
  market: MarketType;
  category: 'stock' | 'etf' | 'analyst';
  savedAt: string;
};

const formatPrice = (price: number, market: MarketType) =>
  market === 'korea'
    ? `${Math.round(price || 0).toLocaleString()} KRW`
    : `$${(price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

function getSignalColor(signal?: string) {
  if (signal === 'up') return 'text-c-positive';
  if (signal === 'down') return 'text-c-negative';
  if (signal === 'mixed') return 'text-c-warning';
  return 'text-c-text-2';
}

function getSignalIcon(signal?: string) {
  if (signal === 'up') return '▲';
  if (signal === 'down') return '▼';
  if (signal === 'mixed') return '◆';
  return '●';
}

function getStatusBadge(point?: PerformancePoint) {
  if (!point) return { label: '-', className: 'bg-c-surface-2 text-gray-500' };
  if (point.status === 'pending') return { label: '대기', className: 'bg-c-warning-bg text-c-warning' };
  if (point.status === 'unavailable') return { label: '제외', className: 'bg-c-surface-2 text-gray-500' };
  return point.success
    ? { label: '성공', className: 'bg-c-positive-bg text-c-positive' }
    : { label: '미달', className: 'bg-c-negative-bg text-c-negative' };
}

function getPerformanceTone(point?: PerformancePoint) {
  if (!point || point.status !== 'complete') return 'text-c-text-3';
  return point.success ? 'text-c-positive' : 'text-c-negative';
}

export default function StockDetailPage() {
  const router = useRouter();
  const { market, ticker } = router.query;
  const [insight, setInsight] = useState<StockInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [technicalData, setTechnicalData] = useState<{
    analysis: TechnicalAnalysis;
    priceHistory: { date: string; close: number; ma5: number; ma20: number }[];
  } | null>(null);
  const [technicalLoading, setTechnicalLoading] = useState(false);
  const { addToast } = useToast();

  const marketType = market as MarketType;
  const tickerStr = (ticker as string)?.toUpperCase();

  useEffect(() => {
    setWatchlist(readWatchlistStorage<WatchlistItem>());
  }, []);

  useEffect(() => {
    if (!marketType || !tickerStr) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stock-insight?ticker=${encodeURIComponent(tickerStr)}&market=${marketType}`
        );
        if (!res.ok) throw new Error('Failed to fetch stock insight');
        const data = (await res.json()) as StockInsightResponse;
        setInsight(data.insight);
      } catch (err) {
        console.error(err);
        setError('종목 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [marketType, tickerStr]);

  // Fetch technical analysis data
  useEffect(() => {
    if (!marketType || !tickerStr) return;

    async function loadTechnicalData() {
      setTechnicalLoading(true);
      try {
        const res = await fetch(
          `/api/stock-history?ticker=${encodeURIComponent(tickerStr)}&market=${marketType}&range=3mo&interval=1d`
        );
        if (!res.ok) throw new Error('Failed to fetch price history');
        const data = await res.json();

        if (data.data && data.data.length > 0) {
          const prices = data.data.map((d: { close: number }) => d.close);
          const analysis = calculateAllIndicators(prices);

          const priceHistory = data.data.map((d: { date: string; close: number }, i: number) => ({
            date: d.date,
            close: d.close,
            ma5: analysis.ma.ma5[i] || null,
            ma20: analysis.ma.ma20[i] || null,
          }));

          setTechnicalData({ analysis, priceHistory });
        }
      } catch (err) {
        console.error('Technical analysis error:', err);
      } finally {
        setTechnicalLoading(false);
      }
    }

    void loadTechnicalData();
  }, [marketType, tickerStr]);

  const isSaved =
    insight && watchlist.some((item) => item.ticker === insight.ticker && item.market === insight.market);

  const toggleWatchlist = () => {
    if (!insight) return;
    const existing = watchlist.find(
      (item) => item.ticker === insight.ticker && item.market === insight.market
    );
    let newWatchlist: WatchlistItem[];
    if (existing) {
      newWatchlist = watchlist.filter(
        (item) => !(item.ticker === insight.ticker && item.market === insight.market)
      );
      addToast('info', `${insight.name} 관심 종목에서 제거됨`);
    } else {
      newWatchlist = [
        {
          ticker: insight.ticker,
          name: insight.name,
          market: insight.market,
          category: 'stock',
          savedAt: new Date().toISOString(),
        },
        ...watchlist,
      ];
      addToast('success', `${insight.name} 관심 종목에 추가됨`);
    }
    setWatchlist(newWatchlist);
    saveWatchlistStorage(newWatchlist);
  };

  // Build chart data from related reports
  const upsideChartData =
    insight?.relatedReports
      .slice(0, 10)
      .map((report) => ({
        name: report.broker.length > 6 ? report.broker.slice(0, 6) + '…' : report.broker,
        upside: report.upside,
      })) || [];

  if (!marketType || !tickerStr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-bg">
        <LoadingState />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{insight?.name || tickerStr} - 글로벌픽</title>
        <meta name="description" content={`${insight?.name || tickerStr} 종목 상세 정보`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-c-bg">
        {/* Header */}
        <header className="border-b bg-c-surface shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-c-text-3 hover:text-c-text-2">
                ← 돌아가기
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <div className="rounded-lg bg-c-negative-bg p-4 text-c-negative">{error}</div>
          ) : insight ? (
            <div className="space-y-6">
              {/* Stock Header */}
              <section className="rounded-xl bg-c-surface p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-c-text">{insight.name}</h1>
                      <span className="rounded bg-c-surface-2 px-2 py-1 text-sm text-c-text-2">
                        {insight.ticker}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-sm ${
                          insight.market === 'korea' ? 'bg-c-accent-bg text-c-accent' : 'bg-c-info-bg text-c-info'
                        }`}
                      >
                        {insight.market === 'korea' ? '국내' : '해외'}
                      </span>
                    </div>
                    {insight.latestCurrentPrice && (
                      <div className="mt-2 text-xl font-semibold text-c-text">
                        {formatPrice(insight.latestCurrentPrice, insight.market)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={toggleWatchlist}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      isSaved
                        ? 'border-c-warning bg-c-warning-bg text-c-warning'
                        : 'border-gray-300 bg-c-surface text-c-text-2 hover:bg-c-surface-2'
                    }`}
                  >
                    <span className="text-lg">{isSaved ? '★' : '☆'}</span>
                    {isSaved ? '관심 종목' : '관심 등록'}
                  </button>
                </div>
              </section>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                  label="평균 목표가"
                  value={
                    insight.latestTargetPrice
                      ? formatPrice(insight.latestTargetPrice, insight.market)
                      : '-'
                  }
                />
                <StatCard
                  label="평균 Upside"
                  value={insight.avgUpside ? formatPct(insight.avgUpside) : '-'}
                  accent={
                    insight.avgUpside
                      ? insight.avgUpside >= 0
                        ? 'text-c-positive'
                        : 'text-c-negative'
                      : undefined
                  }
                />
                <StatCard label="리포트 수" value={`${insight.reportCount}개`} />
                <StatCard
                  label="최신 의견"
                  value={insight.latestOpinion || '-'}
                  accent="text-c-accent"
                />
              </div>

              {/* Upside Chart */}
              {upsideChartData.length > 0 && (
                <section className="rounded-xl bg-c-surface p-4 shadow-sm sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold">증권사별 목표 Upside</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={upsideChartData}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Upside']} />
                        <Bar dataKey="upside" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {/* Technical Analysis Section */}
              {technicalData && (
                <section className="rounded-xl bg-c-surface p-4 shadow-sm sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold">기술적 분석</h2>

                  {/* Indicator Summary */}
                  <div className="mb-6 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-c-surface-2 p-3">
                      <div className="text-xs text-c-text-2">RSI (14)</div>
                      <div className={`mt-1 text-lg font-semibold ${technicalData.analysis.rsi.signal.color}`}>
                        {isNaN(technicalData.analysis.rsi.current)
                          ? '-'
                          : technicalData.analysis.rsi.current.toFixed(1)}
                      </div>
                      <div className={`text-xs ${technicalData.analysis.rsi.signal.color}`}>
                        {technicalData.analysis.rsi.signal.label}
                      </div>
                    </div>
                    <div className="rounded-lg bg-c-surface-2 p-3">
                      <div className="text-xs text-c-text-2">MACD</div>
                      <div className={`mt-1 text-lg font-semibold ${technicalData.analysis.macd.signal.color}`}>
                        {isNaN(technicalData.analysis.macd.current.histogram)
                          ? '-'
                          : technicalData.analysis.macd.current.histogram.toFixed(2)}
                      </div>
                      <div className={`text-xs ${technicalData.analysis.macd.signal.color}`}>
                        {technicalData.analysis.macd.signal.label}
                      </div>
                    </div>
                    <div className="rounded-lg bg-c-surface-2 p-3">
                      <div className="text-xs text-c-text-2">이동평균</div>
                      <div className={`mt-1 text-lg font-semibold ${technicalData.analysis.ma.arrangement.color}`}>
                        {technicalData.analysis.ma.arrangement.label}
                      </div>
                      <div className={`text-xs ${technicalData.analysis.ma.arrangement.color}`}>
                        {technicalData.analysis.ma.arrangement.description}
                      </div>
                    </div>
                  </div>

                  {/* Price + MA Chart */}
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-c-text-2">가격 및 이동평균선 (3개월)</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={technicalData.priceHistory}>
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v.slice(5)}
                          />
                          <YAxis
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) =>
                              insight.market === 'korea'
                                ? `${(v / 1000).toFixed(0)}k`
                                : `$${v.toFixed(0)}`
                            }
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              formatPrice(value, insight.market),
                              name === 'close' ? '종가' : name,
                            ]}
                            labelFormatter={(label) => `날짜: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="close"
                            fill="#E0E7FF"
                            stroke="#3B82F6"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="ma5"
                            stroke="#F59E0B"
                            strokeWidth={1}
                            dot={false}
                            name="MA5"
                          />
                          <Line
                            type="monotone"
                            dataKey="ma20"
                            stroke="#EF4444"
                            strokeWidth={1}
                            dot={false}
                            name="MA20"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex justify-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-4 rounded bg-blue-500" />
                        종가
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-0.5 w-4 bg-amber-500" />
                        MA5
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-0.5 w-4 bg-c-negative-bg0" />
                        MA20
                      </span>
                    </div>
                  </div>

                  {/* RSI Chart */}
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-c-text-2">RSI (14)</h3>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={technicalData.priceHistory.map((d, i) => ({
                            date: d.date,
                            rsi: technicalData.analysis.rsi.series[i],
                          }))}
                        >
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" />
                          <ReferenceLine y={30} stroke="#22C55E" strokeDasharray="3 3" />
                          <Tooltip formatter={(value: number) => [value?.toFixed(1) || '-', 'RSI']} />
                          <Area
                            type="monotone"
                            dataKey="rsi"
                            stroke="#8B5CF6"
                            fill="#EDE9FE"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 flex justify-center gap-4 text-xs text-c-text-2">
                      <span>과매수: 70 이상</span>
                      <span>과매도: 30 이하</span>
                    </div>
                  </div>
                </section>
              )}

              {technicalLoading && (
                <div className="rounded-xl bg-c-surface p-6 shadow-sm">
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    <span className="ml-3 text-c-text-2">기술적 분석 로딩 중...</span>
                  </div>
                </div>
              )}

              {/* Investment Insight Sections */}
              <div className="grid gap-6 lg:grid-cols-2">
                <InsightSectionCard title="투자 논리" section={insight.investmentLogic} />
                <InsightSectionCard title="실적 전망" section={insight.estimateRevision} />
                <InsightSectionCard title="밸류에이션" section={insight.valuation} />
                <InsightSectionCard title="업종 사이클" section={insight.sectorCycle} />
              </div>

              {/* Analyst Reports Table */}
              {insight.relatedReports.length > 0 && (
                <section className="rounded-xl bg-c-surface shadow-sm">
                  <div className="border-b p-4">
                    <h2 className="text-lg font-semibold">애널리스트 리포트</h2>
                    <p className="text-sm text-c-text-2">최근 발행된 리포트 목록입니다.</p>
                  </div>

                  {/* Mobile Cards */}
                  <div className="space-y-3 p-4 md:hidden">
                    {insight.relatedReports.slice(0, 20).map((report, index) => (
                      <article
                        key={`${report.broker}-${report.date}-${index}`}
                        className="rounded-xl border border-c-border bg-c-surface-2 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-c-text">{report.broker}</div>
                            <div className="text-xs text-c-text-2">
                              {report.analyst} · {report.date}
                            </div>
                          </div>
                          <span className="rounded bg-c-accent-bg px-2 py-1 text-sm font-medium text-blue-700">
                            {report.opinion}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-c-surface p-3">
                            <div className="text-xs text-c-text-2">목표가</div>
                            <div className="mt-1 font-medium">
                              {formatPrice(report.targetPrice, report.market)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-c-surface p-3">
                            <div className="text-xs text-c-text-2">Upside</div>
                            <div
                              className={`mt-1 font-medium ${
                                report.upside >= 0 ? 'text-c-positive' : 'text-c-negative'
                              }`}
                            >
                              {formatPct(report.upside)}
                            </div>
                          </div>
                        </div>
                        {report.performance && (
                          <div className="mt-3 flex gap-2">
                            {[
                              { label: '1W', point: report.performance.week1 },
                              { label: '1M', point: report.performance.month1 },
                              { label: '3M', point: report.performance.month3 },
                            ].map(({ label, point }) => {
                              const badge = getStatusBadge(point);
                              return (
                                <div key={label} className="flex-1 rounded-lg bg-c-surface p-2 text-center">
                                  <div className="text-xs text-c-text-2">{label}</div>
                                  <span className={`rounded px-1.5 py-0.5 text-xs ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead className="bg-c-surface-2 text-xs uppercase text-c-text-2">
                        <tr>
                          <th className="px-4 py-3 text-left">증권사</th>
                          <th className="px-4 py-3 text-left">애널리스트</th>
                          <th className="px-4 py-3 text-left">발행일</th>
                          <th className="px-4 py-3 text-left">의견</th>
                          <th className="px-4 py-3 text-right">목표가</th>
                          <th className="px-4 py-3 text-right">Upside</th>
                          <th className="px-4 py-3 text-center">1W</th>
                          <th className="px-4 py-3 text-center">1M</th>
                          <th className="px-4 py-3 text-center">3M</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-c-border">
                        {insight.relatedReports.slice(0, 20).map((report, index) => {
                          const w1Badge = getStatusBadge(report.performance?.week1);
                          const m1Badge = getStatusBadge(report.performance?.month1);
                          const m3Badge = getStatusBadge(report.performance?.month3);
                          return (
                            <tr
                              key={`${report.broker}-${report.date}-${index}`}
                              className="hover:bg-c-bg"
                            >
                              <td className="px-4 py-3 text-sm font-medium">{report.broker}</td>
                              <td className="px-4 py-3 text-sm text-c-text-2">
                                <Link
                                  href={`/analysts/${encodeURIComponent(report.broker)}/${encodeURIComponent(report.analyst)}`}
                                  className="text-c-accent hover:underline"
                                >
                                  {report.analyst}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-sm text-c-text-2">{report.date}</td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-c-accent-bg px-2 py-1 text-sm font-medium text-blue-700">
                                  {report.opinion}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm">
                                {formatPrice(report.targetPrice, report.market)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right text-sm font-medium ${
                                  report.upside >= 0 ? 'text-c-positive' : 'text-c-negative'
                                }`}
                              >
                                {formatPct(report.upside)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded px-2 py-1 text-xs ${w1Badge.className}`}>
                                  {w1Badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded px-2 py-1 text-xs ${m1Badge.className}`}>
                                  {m1Badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded px-2 py-1 text-xs ${m3Badge.className}`}>
                                  {m3Badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </main>

        <footer className="mt-8 border-t bg-c-surface">
          <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-c-text-2">
            <p>데이터 출처: 네이버 금융, Yahoo Finance, Stock Analysis</p>
          </div>
        </footer>
      </div>
    </>
  );
}

function InsightSectionCard({ title, section }: { title: string; section: InsightSection }) {
  if (!section.summary && section.bullets.length === 0) return null;

  return (
    <div className="rounded-xl bg-c-surface p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-lg ${getSignalColor(section.signal)}`}>{getSignalIcon(section.signal)}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {section.summary && <p className="mb-3 text-sm text-c-text-2">{section.summary}</p>}
      {section.bullets.length > 0 && (
        <ul className="space-y-1 text-sm text-c-text-2">
          {section.bullets.map((bullet, index) => (
            <li key={index} className="flex gap-2">
              <span className="text-c-text-3">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
