import { useState } from 'react';
import Head from 'next/head';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { koreaETFs, usETFs, analystReports, marketIndices, generatePriceHistory, ETF, AnalystReport } from '@/lib/etfData';

type TabType = 'home' | 'korea' | 'us' | 'analyst';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedETF, setSelectedETF] = useState<ETF | null>(null);

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
            <p className="text-sm text-gray-500 mt-1">국내외 ETF 분석 및 추천 서비스</p>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex space-x-1">
              {[
                { id: 'home', label: '홈', icon: '🏠' },
                { id: 'korea', label: '국내 ETF', icon: '🇰🇷' },
                { id: 'us', label: '해외 ETF', icon: '🇺🇸' },
                { id: 'analyst', label: '애널리스트 추천', icon: '📊' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as TabType); setSelectedETF(null); }}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
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
          {activeTab === 'home' && <HomeTab />}
          {activeTab === 'korea' && <ETFList etfs={koreaETFs} title="국내 ETF" onSelect={setSelectedETF} selectedETF={selectedETF} />}
          {activeTab === 'us' && <ETFList etfs={usETFs} title="해외 ETF" onSelect={setSelectedETF} selectedETF={selectedETF} />}
          {activeTab === 'analyst' && <AnalystTab />}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-8">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
            <p>ETF 추천 프로그램 - 투자 참고용 정보이며, 투자 결정의 책임은 본인에게 있습니다.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

// 홈 탭 컴포넌트
function HomeTab() {
  return (
    <div className="space-y-6">
      {/* 시장 현황 */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">📈 시장 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {marketIndices.map((index) => (
            <div key={index.name} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">{index.name}</div>
              <div className="text-xl font-bold">{index.value.toLocaleString()}</div>
              <div className={`text-sm ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOP ETF */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* 국내 ETF TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">🇰🇷 국내 ETF TOP 5</h2>
          <div className="space-y-3">
            {koreaETFs.slice(0, 5).map((etf, idx) => (
              <div key={etf.ticker} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-xs text-gray-400 mr-2">#{idx + 1}</span>
                  <span className="font-medium text-sm">{etf.name}</span>
                </div>
                <span className={`text-sm font-medium ${etf.return1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {etf.return1m >= 0 ? '+' : ''}{etf.return1m}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 해외 ETF TOP 5 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">🇺🇸 해외 ETF TOP 5</h2>
          <div className="space-y-3">
            {usETFs.slice(0, 5).map((etf, idx) => (
              <div key={etf.ticker} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-xs text-gray-400 mr-2">#{idx + 1}</span>
                  <span className="font-medium text-sm">{etf.name}</span>
                </div>
                <span className={`text-sm font-medium ${etf.return1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {etf.return1m >= 0 ? '+' : ''}{etf.return1m}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 최신 매수 추천 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">📊 최신 매수 추천</h2>
          <div className="space-y-3">
            {analystReports.slice(0, 5).map((report) => (
              <div key={`${report.ticker}-${report.date}`} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-sm">{report.name}</span>
                    <div className="text-xs text-gray-500 mt-1">{report.broker}</div>
                  </div>
                  <span className="text-green-600 font-medium text-sm">
                    +{report.upside.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 수익률 차트 */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">📊 주요 ETF 1개월 수익률</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...koreaETFs.slice(0, 4), ...usETFs.slice(0, 4)]} layout="vertical">
              <XAxis type="number" domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="ticker" width={80} />
              <Tooltip formatter={(value: number) => [`${value}%`, '1개월 수익률']} />
              <Bar dataKey="return1m" radius={[0, 4, 4, 0]}>
                {[...koreaETFs.slice(0, 4), ...usETFs.slice(0, 4)].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.return1m >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

// ETF 목록 컴포넌트
function ETFList({ etfs, title, onSelect, selectedETF }: { etfs: ETF[]; title: string; onSelect: (etf: ETF) => void; selectedETF: ETF | null }) {
  const [sortBy, setSortBy] = useState<'return1m' | 'return3m' | 'volume'>('return1m');
  const [category, setCategory] = useState<string>('전체');

  const categories = ['전체', ...Array.from(new Set(etfs.map(e => e.category)))];
  const filteredETFs = category === '전체' ? etfs : etfs.filter(e => e.category === category);
  const sortedETFs = [...filteredETFs].sort((a, b) => b[sortBy] - a[sortBy]);

  const priceHistory = selectedETF ? generatePriceHistory(selectedETF.price) : [];

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-sm text-gray-500 mr-2">카테고리:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 mr-2">정렬:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="return1m">1개월 수익률</option>
            <option value="return3m">3개월 수익률</option>
            <option value="volume">거래량</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ETF 목록 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">종목</th>
                  <th className="px-4 py-3 text-right">현재가</th>
                  <th className="px-4 py-3 text-right">등락률</th>
                  <th className="px-4 py-3 text-right">1개월</th>
                  <th className="px-4 py-3 text-right">3개월</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedETFs.map((etf) => (
                  <tr
                    key={etf.ticker}
                    onClick={() => onSelect(etf)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedETF?.ticker === etf.ticker ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{etf.name}</div>
                      <div className="text-xs text-gray-400">{etf.ticker}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {etf.price.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${etf.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {etf.changePercent >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 text-right ${etf.return1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {etf.return1m >= 0 ? '+' : ''}{etf.return1m}%
                    </td>
                    <td className={`px-4 py-3 text-right ${etf.return3m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {etf.return3m >= 0 ? '+' : ''}{etf.return3m}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ETF 상세 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {selectedETF ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedETF.name}</h3>
                <p className="text-sm text-gray-500">{selectedETF.ticker} | {selectedETF.category}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">현재가</div>
                  <div className="font-bold">{selectedETF.price.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">등락률</div>
                  <div className={`font-bold ${selectedETF.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedETF.changePercent >= 0 ? '+' : ''}{selectedETF.changePercent}%
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">1개월 수익률</div>
                  <div className={`font-bold ${selectedETF.return1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedETF.return1m >= 0 ? '+' : ''}{selectedETF.return1m}%
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">3개월 수익률</div>
                  <div className={`font-bold ${selectedETF.return3m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedETF.return3m >= 0 ? '+' : ''}{selectedETF.return3m}%
                  </div>
                </div>
              </div>

              {/* 가격 차트 */}
              <div>
                <h4 className="text-sm font-medium mb-2">가격 추이 (30일)</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <XAxis dataKey="date" tick={false} />
                      <YAxis domain={['dataMin', 'dataMax']} hide />
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), '가격']}
                        labelFormatter={(label) => label}
                      />
                      <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {selectedETF.expenseRatio !== undefined && (
                <div className="text-sm">
                  <span className="text-gray-500">운용보수:</span> {selectedETF.expenseRatio}%
                </div>
              )}
              {selectedETF.dividendYield !== undefined && selectedETF.dividendYield > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500">배당수익률:</span> {selectedETF.dividendYield}%
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p>ETF를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 애널리스트 탭 컴포넌트
function AnalystTab() {
  const [market, setMarket] = useState<'all' | 'korea' | 'us'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'upside'>('upside');

  const filteredReports = market === 'all'
    ? analystReports
    : analystReports.filter(r => r.market === market);

  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
    return b.upside - a.upside;
  });

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">총 추천 수</div>
          <div className="text-2xl font-bold">{filteredReports.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">평균 상승여력</div>
          <div className="text-2xl font-bold text-green-600">
            +{(filteredReports.reduce((a, b) => a + b.upside, 0) / filteredReports.length).toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">국내 종목</div>
          <div className="text-2xl font-bold">{analystReports.filter(r => r.market === 'korea').length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">해외 종목</div>
          <div className="text-2xl font-bold">{analystReports.filter(r => r.market === 'us').length}</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
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
      </div>

      {/* 리포트 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">📊 애널리스트 매수 추천</h2>
          <p className="text-sm text-gray-500">최근 5일 이내 발행된 리포트</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">추천일</th>
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
              {sortedReports.map((report, idx) => (
                <tr key={`${report.ticker}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{report.date}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{report.name}</div>
                    <div className="text-xs text-gray-400">{report.ticker}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {report.market === 'korea' ? '국내' : '해외'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{report.broker}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {report.targetPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {report.currentPrice.toLocaleString()}
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
      </div>

      {/* 상승여력 차트 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">상승여력 TOP 10</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedReports.slice(0, 10)} layout="vertical">
              <XAxis type="number" domain={[0, 'dataMax + 5']} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '상승여력']} />
              <Bar dataKey="upside" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
