import { useState, useEffect } from 'react';
import Head from 'next/head';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// 타입 정의
interface Stock {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
  high52w?: number;
  low52w?: number;
}

interface MarketIndex {
  ticker: string;
  name: string;
  market: string;
  value: number;
  change: number;
  changePercent: number;
}

interface AnalystReport {
  date: string;
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  broker: string;
  analyst: string;
  opinion: string;
  targetPrice: number;
  currentPrice: number;
  upside: number;
}

type TabType = 'home' | 'korea-stock' | 'korea-etf' | 'us-stock' | 'us-etf' | 'analyst';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [koreaStocks, setKoreaStocks] = useState<Stock[]>([]);
  const [koreaETFs, setKoreaETFs] = useState<Stock[]>([]);
  const [usStocks, setUsStocks] = useState<Stock[]>([]);
  const [usETFs, setUsETFs] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [indicesRes, koreaStocksRes, koreaETFsRes, usStocksRes, usETFsRes] = await Promise.all([
          fetch('/api/market-indices'),
          fetch('/api/korea-stocks?type=stock'),
          fetch('/api/korea-stocks?type=etf'),
          fetch('/api/us-stocks?type=stock'),
          fetch('/api/us-stocks?type=etf'),
        ]);

        if (indicesRes.ok) {
          const indices = await indicesRes.json();
          setMarketIndices(indices);
        }

        if (koreaStocksRes.ok) {
          const stocks = await koreaStocksRes.json();
          setKoreaStocks(stocks);
        }

        if (koreaETFsRes.ok) {
          const etfs = await koreaETFsRes.json();
          setKoreaETFs(etfs);
        }

        if (usStocksRes.ok) {
          const stocks = await usStocksRes.json();
          setUsStocks(stocks);
        }

        if (usETFsRes.ok) {
          const etfs = await usETFsRes.json();
          setUsETFs(etfs);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <>
      <Head>
        <title>ETF 추천 프로그램</title>
        <meta name="description" content="국내외 ETF 분석 및 추천 서비스" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-900">ETF 추천 프로그램</h1>
            <p className="text-sm text-gray-500 mt-1">실시간 국내외 주식/ETF 데이터</p>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex space-x-1 overflow-x-auto">
              {[
                { id: 'home', label: '홈', icon: '🏠' },
                { id: 'korea-stock', label: '국내 주식', icon: '🇰🇷' },
                { id: 'korea-etf', label: '국내 ETF', icon: '📊' },
                { id: 'us-stock', label: '해외 주식', icon: '🇺🇸' },
                { id: 'us-etf', label: '해외 ETF', icon: '📈' },
                { id: 'analyst', label: '애널리스트 추천', icon: '💡' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {activeTab === 'analyst' ? (
            <AnalystTab />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
          ) : (
            <>
              {activeTab === 'home' && (
                <HomeTab
                  marketIndices={marketIndices}
                  koreaStocks={koreaStocks}
                  koreaETFs={koreaETFs}
                  usStocks={usStocks}
                  usETFs={usETFs}
                />
              )}
              {activeTab === 'korea-stock' && <StockList stocks={koreaStocks} title="국내 주식" currency="KRW" />}
              {activeTab === 'korea-etf' && <StockList stocks={koreaETFs} title="국내 ETF" currency="KRW" />}
              {activeTab === 'us-stock' && <StockList stocks={usStocks} title="해외 주식" currency="USD" />}
              {activeTab === 'us-etf' && <StockList stocks={usETFs} title="해외 ETF" currency="USD" />}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-8">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
            <p>실시간 데이터 제공: 네이버 금융, Yahoo Finance</p>
            <p className="mt-1">투자 참고용 정보이며, 투자 결정의 책임은 본인에게 있습니다.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

// 애널리스트 탭 컴포넌트
function AnalystTab() {
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [market, setMarket] = useState<'all' | 'korea' | 'us'>('all');
  const [sortBy, setSortBy] = useState<'upside' | 'date'>('upside');
  const [broker, setBroker] = useState<string>('all');
  const [opinion, setOpinion] = useState<string>('all');

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/analyst-reports?days=${days}&market=${market}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data);
        } else {
          throw new Error('Failed to fetch');
        }
      } catch (err) {
        console.error('Error fetching analyst reports:', err);
        setError('애널리스트 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [days, market]);

  // 현재 데이터에서 고유한 증권사/투자의견 추출
  const brokers = Array.from(new Set(reports.map(r => r.broker))).sort();
  const opinions = Array.from(new Set(reports.map(r => r.opinion))).sort();

  useEffect(() => {
    if (broker !== 'all' && !brokers.includes(broker)) {
      setBroker('all');
    }
  }, [broker, brokers]);

  useEffect(() => {
    if (opinion !== 'all' && !opinions.includes(opinion)) {
      setOpinion('all');
    }
  }, [opinion, opinions]);

  // 필터링 적용
  const filteredReports = [...reports]
    .filter(r => broker === 'all' || r.broker === broker)
    .filter(r => opinion === 'all' || r.opinion === opinion)
    .sort((a, b) => {
      if (sortBy === 'upside') return b.upside - a.upside;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  // 요약 통계 (필터링된 데이터 기준)
  const koreaCount = filteredReports.filter(r => r.market === 'korea').length;
  const usCount = filteredReports.filter(r => r.market === 'us').length;
  const avgUpside = filteredReports.length > 0
    ? filteredReports.reduce((sum, r) => sum + r.upside, 0) / filteredReports.length
    : 0;

  const formatPrice = (price: number, market: string) => {
    if (market === 'korea') {
      return price.toLocaleString() + '원';
    }
    return '$' + price.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm text-gray-500 mr-2">기간:</label>
            <div className="inline-flex rounded-lg border overflow-hidden">
              {[3, 7, 15, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-2 text-sm ${
                    days === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 mr-2">시장:</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">전체</option>
              <option value="korea">국내</option>
              <option value="us">해외</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mr-2">정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="upside">상승여력순</option>
              <option value="date">날짜순</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mr-2">증권사:</label>
            <select
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">전체</option>
              {brokers.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mr-2">투자의견:</label>
            <select
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">전체</option>
              {opinions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">총 추천 수</div>
          <div className="text-2xl font-bold">{filteredReports.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">평균 상승여력</div>
          <div className="text-2xl font-bold text-green-600">+{avgUpside.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">국내 종목</div>
          <div className="text-2xl font-bold">{koreaCount}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">해외 종목</div>
          <div className="text-2xl font-bold">{usCount}</div>
        </div>
      </div>

      {/* 리포트 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">데이터를 불러오는 중...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">💡 애널리스트 매수 추천</h2>
              <p className="text-sm text-gray-500">최근 {days}일 이내 매수 추천 리포트</p>
            </div>
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-gray-400">선택한 조건에 맞는 매수 추천이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">날짜</th>
                      <th className="px-4 py-3 text-left">종목</th>
                      <th className="px-4 py-3 text-left">시장</th>
                      <th className="px-4 py-3 text-left">증권사</th>
                      <th className="px-4 py-3 text-right">목표가</th>
                      <th className="px-4 py-3 text-right">현재가</th>
                      <th className="px-4 py-3 text-right">상승여력</th>
                      <th className="px-4 py-3 text-left">투자의견</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReports.map((report, idx) => (
                      <tr key={`${report.ticker}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{report.date}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{report.name}</div>
                          <div className="text-xs text-gray-400">{report.ticker}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              report.market === 'korea'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {report.market === 'korea' ? '국내' : '해외'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{report.broker}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatPrice(report.targetPrice, report.market)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatPrice(report.currentPrice, report.market)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">
                          +{report.upside.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                            {report.opinion}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 상승여력 TOP 10 차트 */}
          {filteredReports.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">상승여력 TOP 10</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredReports.slice(0, 10)} layout="vertical">
                    <XAxis type="number" domain={[0, 'dataMax + 10']} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '상승여력']}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="upside" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 홈 탭 컴포넌트
function HomeTab({
  marketIndices,
  koreaStocks,
  koreaETFs,
  usStocks,
  usETFs,
}: {
  marketIndices: MarketIndex[];
  koreaStocks: Stock[];
  koreaETFs: Stock[];
  usStocks: Stock[];
  usETFs: Stock[];
}) {
  return (
    <div className="space-y-6">
      {/* 시장 현황 */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">📈 시장 현황</h2>
        {marketIndices.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {marketIndices.map((index) => (
              <div key={index.ticker} className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">{index.name}</div>
                <div className="text-xl font-bold">{index.value.toLocaleString()}</div>
                <div className={`text-sm ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {index.change >= 0 ? '+' : ''}
                  {index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}
                  {index.changePercent.toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">시장 데이터를 불러올 수 없습니다.</p>
        )}
      </section>

      {/* 주식/ETF 목록 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 국내 주식 TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">🇰🇷 국내 주식</h2>
          <StockMiniList stocks={koreaStocks.slice(0, 5)} currency="KRW" />
        </section>

        {/* 국내 ETF TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">📊 국내 ETF</h2>
          <StockMiniList stocks={koreaETFs.slice(0, 5)} currency="KRW" />
        </section>

        {/* 해외 주식 TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">🇺🇸 해외 주식</h2>
          <StockMiniList stocks={usStocks.slice(0, 5)} currency="USD" />
        </section>

        {/* 해외 ETF TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">📈 해외 ETF</h2>
          <StockMiniList stocks={usETFs.slice(0, 5)} currency="USD" />
        </section>
      </div>

      {/* 등락률 차트 */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">📊 등락률 비교</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...koreaStocks.slice(0, 5), ...usStocks.slice(0, 5)]}
              layout="vertical"
            >
              <XAxis
                type="number"
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis type="category" dataKey="ticker" width={80} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, '등락률']} />
              <Bar dataKey="changePercent" radius={[0, 4, 4, 0]}>
                {[...koreaStocks.slice(0, 5), ...usStocks.slice(0, 5)].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.changePercent >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

// 미니 주식 목록 컴포넌트
function StockMiniList({ stocks, currency }: { stocks: Stock[]; currency: string }) {
  if (stocks.length === 0) {
    return <p className="text-gray-400 text-sm">데이터 없음</p>;
  }

  const formatPrice = (price: number) => {
    if (currency === 'KRW') {
      return price.toLocaleString() + '원';
    }
    return '$' + price.toLocaleString();
  };

  return (
    <div className="space-y-3">
      {stocks.map((stock) => (
        <div key={stock.ticker} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-sm">{stock.name}</div>
            <div className="text-xs text-gray-400">{stock.ticker}</div>
          </div>
          <div className="text-right">
            <div className="font-medium text-sm">{formatPrice(stock.currentPrice)}</div>
            <div className={`text-xs ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stock.changePercent >= 0 ? '+' : ''}
              {stock.changePercent.toFixed(2)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 주식 목록 컴포넌트
function StockList({ stocks, title, currency }: { stocks: Stock[]; title: string; currency: string }) {
  const [sortBy, setSortBy] = useState<'changePercent' | 'volume' | 'currentPrice'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedStocks = [...stocks].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const formatPrice = (price: number) => {
    if (currency === 'KRW') {
      return price.toLocaleString() + '원';
    }
    return '$' + price.toLocaleString();
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return (volume / 1000000).toFixed(1) + 'M';
    }
    if (volume >= 1000) {
      return (volume / 1000).toFixed(1) + 'K';
    }
    return volume.toString();
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-sm text-gray-500 mr-2">정렬:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="changePercent">등락률</option>
            <option value="volume">거래량</option>
            <option value="currentPrice">현재가</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 mr-2">순서:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="desc">내림차순</option>
            <option value="asc">오름차순</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-400">총 {stocks.length}개</div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {stocks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">데이터를 불러올 수 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">종목</th>
                  <th className="px-4 py-3 text-right">현재가</th>
                  <th className="px-4 py-3 text-right">전일대비</th>
                  <th className="px-4 py-3 text-right">등락률</th>
                  <th className="px-4 py-3 text-right">거래량</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedStocks.map((stock) => (
                  <tr key={stock.ticker} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{stock.name}</div>
                      <div className="text-xs text-gray-400">{stock.ticker}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(stock.currentPrice)}</td>
                    <td className={`px-4 py-3 text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stock.change >= 0 ? '+' : ''}
                      {currency === 'KRW' ? stock.change.toLocaleString() : stock.change.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stock.changePercent >= 0 ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {stock.volume ? formatVolume(stock.volume) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등락률 차트 */}
      {stocks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">등락률 차트</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedStocks} layout="vertical">
                <XAxis
                  type="number"
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis type="category" dataKey="ticker" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, '등락률']} />
                <Bar dataKey="changePercent" radius={[0, 4, 4, 0]}>
                  {sortedStocks.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.changePercent >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
