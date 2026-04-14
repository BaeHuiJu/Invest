import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LoadingState } from '@/components/LoadingState';
import { StatCard } from '@/components/StatCard';

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

type PeriodKey = 'week1' | 'month1' | 'month3';

const formatPrice = (price: number, market: MarketType) =>
  market === 'korea'
    ? `${Math.round(price || 0).toLocaleString()} KRW`
    : `$${(price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

function getStatusBadge(point?: PerformancePoint) {
  if (!point) return { label: '-', className: 'bg-gray-100 text-gray-500' };
  if (point.status === 'pending') return { label: '대기', className: 'bg-amber-100 text-amber-700' };
  if (point.status === 'unavailable') return { label: '제외', className: 'bg-gray-100 text-gray-500' };
  return point.success
    ? { label: '성공', className: 'bg-green-100 text-green-700' }
    : { label: '미달', className: 'bg-red-100 text-red-700' };
}

function calculatePeriodStats(reports: AnalystReport[], period: PeriodKey) {
  const eligible = reports.filter((r) => r.performance?.[period]?.status === 'complete');
  const successCount = eligible.filter((r) => r.performance?.[period]?.success).length;
  const totalReturn = eligible.reduce((sum, r) => sum + (r.performance?.[period]?.returnPct || 0), 0);
  const totalProgress = eligible.reduce(
    (sum, r) => sum + (r.performance?.[period]?.targetProgressPct || 0),
    0
  );

  return {
    eligibleCount: eligible.length,
    successCount,
    successRate: eligible.length > 0 ? (successCount / eligible.length) * 100 : 0,
    avgReturnPct: eligible.length > 0 ? totalReturn / eligible.length : 0,
    avgTargetProgressPct: eligible.length > 0 ? totalProgress / eligible.length : 0,
  };
}

export default function AnalystProfilePage() {
  const router = useRouter();
  const { broker, analyst } = router.query;
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month1');

  const brokerStr = decodeURIComponent((broker as string) || '');
  const analystStr = decodeURIComponent((analyst as string) || '');

  useEffect(() => {
    if (!brokerStr || !analystStr) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all reports for the last 365 days and filter by analyst
        const res = await fetch(`/api/analyst-reports?days=365&market=all`);
        if (!res.ok) throw new Error('Failed to fetch analyst reports');
        const data = (await res.json()) as AnalystReport[];

        // Filter by broker and analyst
        const filtered = data.filter(
          (r) =>
            r.broker === brokerStr &&
            r.analyst === analystStr
        );
        setReports(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        console.error(err);
        setError('애널리스트 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [brokerStr, analystStr]);

  // Calculate statistics
  const week1Stats = calculatePeriodStats(reports, 'week1');
  const month1Stats = calculatePeriodStats(reports, 'month1');
  const month3Stats = calculatePeriodStats(reports, 'month3');

  // Sectors covered
  const sectors = Array.from(new Set(reports.map((r) => r.sector).filter((s): s is string => Boolean(s))));

  // Chart data - success rate by period
  const chartData = [
    { name: '1주', successRate: week1Stats.successRate },
    { name: '1개월', successRate: month1Stats.successRate },
    { name: '3개월', successRate: month3Stats.successRate },
  ];

  // Return chart data
  const returnChartData = [
    { name: '1주', avgReturn: week1Stats.avgReturnPct },
    { name: '1개월', avgReturn: month1Stats.avgReturnPct },
    { name: '3개월', avgReturn: month3Stats.avgReturnPct },
  ];

  const getPeriodLabel = (period: PeriodKey) => {
    if (period === 'week1') return '1주';
    if (period === 'month1') return '1개월';
    return '3개월';
  };

  if (!brokerStr || !analystStr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingState />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {analystStr} ({brokerStr}) - 글로벌픽
        </title>
        <meta name="description" content={`${analystStr} 애널리스트 프로필`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                ← 돌아가기
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
          ) : reports.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
              해당 애널리스트의 리포트를 찾을 수 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Analyst Header */}
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{analystStr}</h1>
                    <p className="mt-1 text-gray-600">{brokerStr}</p>
                    {sectors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sectors.slice(0, 5).map((sector) => (
                          <span
                            key={sector}
                            className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                          >
                            {sector}
                          </span>
                        ))}
                        {sectors.length > 5 && (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                            +{sectors.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{reports.length}</div>
                    <div className="text-sm text-gray-500">발행 리포트</div>
                  </div>
                </div>
              </section>

              {/* Performance Summary */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  label="1주 성공률"
                  value={`${week1Stats.successRate.toFixed(1)}%`}
                  accent="text-green-600"
                />
                <StatCard
                  label="1개월 성공률"
                  value={`${month1Stats.successRate.toFixed(1)}%`}
                  accent="text-green-600"
                />
                <StatCard
                  label="3개월 성공률"
                  value={`${month3Stats.successRate.toFixed(1)}%`}
                  accent="text-green-600"
                />
                <StatCard
                  label="1주 평균 수익"
                  value={formatPct(week1Stats.avgReturnPct)}
                  accent={week1Stats.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}
                />
                <StatCard
                  label="1개월 평균 수익"
                  value={formatPct(month1Stats.avgReturnPct)}
                  accent={month1Stats.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}
                />
                <StatCard
                  label="3개월 평균 수익"
                  value={formatPct(month3Stats.avgReturnPct)}
                  accent={month3Stats.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}
                />
              </div>

              {/* Charts */}
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold">기간별 성공률</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '성공률']} />
                        <Bar dataKey="successRate" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold">기간별 평균 수익률</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={returnChartData}>
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '평균 수익률']} />
                        <Bar dataKey="avgReturn" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              {/* Report History */}
              <section className="rounded-xl bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">추천 히스토리</h2>
                    <p className="text-sm text-gray-500">
                      {getPeriodLabel(selectedPeriod)} 기준 성과입니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap overflow-hidden rounded-lg border">
                    {(['week1', 'month1', 'month3'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 text-sm ${
                          selectedPeriod === period
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {getPeriodLabel(period)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3 p-4 md:hidden">
                  {reports.slice(0, 30).map((report, index) => {
                    const perfPoint = report.performance?.[selectedPeriod];
                    const badge = getStatusBadge(perfPoint);
                    return (
                      <article
                        key={`${report.ticker}-${report.date}-${index}`}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/stocks/${report.market}/${report.ticker}`}
                            className="min-w-0"
                          >
                            <div className="truncate font-semibold text-blue-700 hover:underline">
                              {report.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.ticker} · {report.date}
                            </div>
                          </Link>
                          <span className={`rounded px-2 py-1 text-xs ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs text-gray-500">목표가</div>
                            <div className="mt-1 font-medium">
                              {formatPrice(report.targetPrice, report.market)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <div className="text-xs text-gray-500">Upside</div>
                            <div
                              className={`mt-1 font-medium ${
                                report.upside >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatPct(report.upside)}
                            </div>
                          </div>
                        </div>
                        {perfPoint && perfPoint.status === 'complete' && (
                          <div className="mt-3 rounded-lg bg-white p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {getPeriodLabel(selectedPeriod)} 수익률
                              </span>
                              <span
                                className={`font-medium ${
                                  perfPoint.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {formatPct(perfPoint.returnPct)}
                              </span>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">종목</th>
                        <th className="px-4 py-3 text-left">발행일</th>
                        <th className="px-4 py-3 text-left">의견</th>
                        <th className="px-4 py-3 text-right">목표가</th>
                        <th className="px-4 py-3 text-right">Upside</th>
                        <th className="px-4 py-3 text-right">{getPeriodLabel(selectedPeriod)} 수익</th>
                        <th className="px-4 py-3 text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reports.slice(0, 50).map((report, index) => {
                        const perfPoint = report.performance?.[selectedPeriod];
                        const badge = getStatusBadge(perfPoint);
                        return (
                          <tr
                            key={`${report.ticker}-${report.date}-${index}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <Link href={`/stocks/${report.market}/${report.ticker}`}>
                                <div className="font-medium text-blue-700 hover:underline">
                                  {report.name}
                                </div>
                                <div className="text-xs text-gray-400">{report.ticker}</div>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{report.date}</td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-blue-100 px-2 py-1 text-sm font-medium text-blue-700">
                                {report.opinion}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm">
                              {formatPrice(report.targetPrice, report.market)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right text-sm font-medium ${
                                report.upside >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatPct(report.upside)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right text-sm font-medium ${
                                perfPoint?.status === 'complete'
                                  ? perfPoint.returnPct >= 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                  : 'text-gray-400'
                              }`}
                            >
                              {perfPoint?.status === 'complete'
                                ? formatPct(perfPoint.returnPct)
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded px-2 py-1 text-xs ${badge.className}`}>
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>

        <footer className="mt-8 border-t bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-gray-500">
            <p>데이터 출처: 네이버 금융, Yahoo Finance, Stock Analysis</p>
          </div>
        </footer>
      </div>
    </>
  );
}
