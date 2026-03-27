import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type MarketType = 'korea' | 'us';
type MarketFilter = 'all' | MarketType;
type TabType = 'home' | 'korea-stock' | 'korea-etf' | 'us-stock' | 'us-etf' | 'analyst';

type Stock = { ticker: string; name: string; currentPrice: number; change: number; changePercent: number; volume?: number; marketCap?: string; high52w?: number; low52w?: number };
type MarketIndex = { ticker: string; name: string; market: MarketType; value: number; change: number; changePercent: number };
type AnalystReport = { date: string; ticker: string; name: string; market: MarketType; broker: string; analyst: string; opinion: string; targetPrice: number; currentPrice: number; basePrice: number; basePriceDate: string; upside: number; reportTitle?: string; reasonSummary?: string; reasonBullets?: string[] };
type StockInsight = { ticker: string; name: string; market: MarketType; latestReportDate?: string; latestBroker?: string; latestOpinion?: string; latestTargetPrice?: number; latestCurrentPrice?: number; latestBasePrice?: number; avgUpside?: number; reportCount: number; reasonSummary: string; reasonBullets: string[]; relatedReports: AnalystReport[] };
type StockInsightResponse = { found: boolean; insight: StockInsight };
type InsightRequest = { ticker: string; name: string; market: MarketType; currentPrice?: number; changePercent?: number; high52w?: number; low52w?: number };

const ANALYST_CACHE_TTL_MS = 5 * 60 * 1000;
const INSIGHT_CACHE_TTL_MS = 5 * 60 * 1000;
const analystClientCache = new Map<string, { reports: AnalystReport[]; fetchedAt: number }>();
const analystClientInflight = new Map<string, Promise<AnalystReport[]>>();
const insightClientCache = new Map<string, { insight: StockInsight; fetchedAt: number }>();
const insightClientInflight = new Map<string, Promise<StockInsight>>();

const formatPrice = (price: number, market: MarketType) => market === 'korea' ? `${Math.round(price || 0).toLocaleString()} KRW` : `$${(price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const analystKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const insightKey = (req: InsightRequest) => `${req.market}:${req.ticker}`;

function getCachedAnalystReports(days: number, market: MarketFilter) {
  const cached = analystClientCache.get(analystKey(days, market));
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > ANALYST_CACHE_TTL_MS) {
    analystClientCache.delete(analystKey(days, market));
    return null;
  }
  return cached.reports;
}

async function fetchAnalystReports(days: number, market: MarketFilter) {
  const cached = getCachedAnalystReports(days, market);
  if (cached) return cached;
  const key = analystKey(days, market);
  const inflight = analystClientInflight.get(key);
  if (inflight) return inflight;
  const request = fetch(`/api/analyst-reports?days=${days}&market=${market}`).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch analyst reports');
    const data = await res.json() as AnalystReport[];
    analystClientCache.set(key, { reports: data, fetchedAt: Date.now() });
    return data;
  }).finally(() => analystClientInflight.delete(key));
  analystClientInflight.set(key, request);
  return request;
}

async function fetchStockInsight(request: InsightRequest) {
  const key = insightKey(request);
  const cached = insightClientCache.get(key);
  if (cached && Date.now() - cached.fetchedAt <= INSIGHT_CACHE_TTL_MS) return cached.insight;
  const inflight = insightClientInflight.get(key);
  if (inflight) return inflight;
  const params = new URLSearchParams({ ticker: request.ticker, name: request.name, market: request.market, currentPrice: String(request.currentPrice || 0), changePercent: String(request.changePercent || 0), high52w: String(request.high52w || 0), low52w: String(request.low52w || 0) });
  const promise = fetch(`/api/stock-insight?${params}`).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch stock insight');
    const data = await res.json() as StockInsightResponse;
    insightClientCache.set(key, { insight: data.insight, fetchedAt: Date.now() });
    return data.insight;
  }).finally(() => insightClientInflight.delete(key));
  insightClientInflight.set(key, promise);
  return promise;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [koreaStocks, setKoreaStocks] = useState<Stock[]>([]);
  const [koreaETFs, setKoreaETFs] = useState<Stock[]>([]);
  const [usStocks, setUsStocks] = useState<Stock[]>([]);
  const [usETFs, setUsETFs] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightTarget, setInsightTarget] = useState<InsightRequest | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [a, b, c, d, e] = await Promise.all([fetch('/api/market-indices'), fetch('/api/korea-stocks?type=stock'), fetch('/api/korea-stocks?type=etf'), fetch('/api/us-stocks?type=stock'), fetch('/api/us-stocks?type=etf')]);
        if (![a, b, c, d, e].every((res) => res.ok)) throw new Error('Failed');
        setMarketIndices(await a.json()); setKoreaStocks(await b.json()); setKoreaETFs(await c.json()); setUsStocks(await d.json()); setUsETFs(await e.json());
      } catch (fetchError) {
        console.error(fetchError); setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    const warmup = () => { void fetchAnalystReports(30, 'all').catch(console.error); };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number; cancelIdleCallback?: (handle: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(warmup); return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warmup, 800); return () => window.clearTimeout(id);
  }, []);

  return <>
    <Head><title>글로벌픽</title><meta name="description" content="국내외 종목과 애널리스트 추천 데이터를 비교합니다." /><link rel="icon" href="/favicon.ico" /></Head>
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm"><div className="mx-auto max-w-7xl px-4 py-4"><h1 className="text-2xl font-bold text-gray-900">글로벌픽</h1><p className="mt-1 text-sm text-gray-500">종목을 누르면 기준가격과 간단한 매수 의견을 확인할 수 있습니다.</p></div></header>
      <nav className="border-b bg-white"><div className="mx-auto max-w-7xl px-4"><div className="flex space-x-1 overflow-x-auto">{[
        ['home', '🏠 홈'], ['korea-stock', '🇰🇷 국내 주식'], ['korea-etf', '📦 국내 ETF'], ['us-stock', '🇺🇸 해외 주식'], ['us-etf', '🧾 해외 ETF'], ['analyst', '💡 애널리스트 추천'],
      ].map(([id, label]) => <button key={id} onClick={() => setActiveTab(id as TabType)} className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${activeTab === id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>)}</div></div></nav>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'analyst' ? <AnalystTab onOpenInsight={setInsightTarget} /> : loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <>
          {activeTab === 'home' && <HomeTab marketIndices={marketIndices} koreaStocks={koreaStocks} koreaETFs={koreaETFs} usStocks={usStocks} usETFs={usETFs} />}
          {activeTab === 'korea-stock' && <StockList stocks={koreaStocks} title="국내 주식" market="korea" onOpenInsight={setInsightTarget} />}
          {activeTab === 'korea-etf' && <StockList stocks={koreaETFs} title="국내 ETF" market="korea" onOpenInsight={setInsightTarget} />}
          {activeTab === 'us-stock' && <StockList stocks={usStocks} title="해외 주식" market="us" onOpenInsight={setInsightTarget} />}
          {activeTab === 'us-etf' && <StockList stocks={usETFs} title="해외 ETF" market="us" onOpenInsight={setInsightTarget} />}
        </>}
      </main>
      <footer className="mt-8 border-t bg-white"><div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-gray-500"><p>데이터 출처: 네이버 금융, Yahoo Finance, Stock Analysis</p></div></footer>
    </div>
    <StockInsightModal request={insightTarget} onClose={() => setInsightTarget(null)} />
  </>;
}

function LoadingState() {
  return <div className="flex h-64 items-center justify-center"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /><p className="mt-4 text-gray-500">데이터를 불러오는 중입니다.</p></div></div>;
}

function HomeTab({ marketIndices, koreaStocks, koreaETFs, usStocks, usETFs }: { marketIndices: MarketIndex[]; koreaStocks: Stock[]; koreaETFs: Stock[]; usStocks: Stock[]; usETFs: Stock[] }) {
  return <div className="space-y-6">
    <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">주요 시장 지수</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-5">{marketIndices.map((index) => <div key={index.ticker} className="rounded-lg bg-gray-50 p-4"><div className="text-sm text-gray-500">{index.name}</div><div className="text-xl font-bold">{index.value.toLocaleString()}</div><div className={`text-sm ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)</div></div>)}</div></section>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <QuickList title="국내 주식 TOP 5" stocks={koreaStocks.slice(0, 5)} market="korea" />
      <QuickList title="국내 ETF TOP 5" stocks={koreaETFs.slice(0, 5)} market="korea" />
      <QuickList title="해외 주식 TOP 5" stocks={usStocks.slice(0, 5)} market="us" />
      <QuickList title="해외 ETF TOP 5" stocks={usETFs.slice(0, 5)} market="us" />
    </div>
  </div>;
}

function QuickList({ title, stocks, market }: { title: string; stocks: Stock[]; market: MarketType }) {
  return <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="space-y-3">{stocks.map((stock) => <div key={stock.ticker} className="flex items-center justify-between rounded-lg bg-gray-50 p-3"><div><div className="text-sm font-medium">{stock.name}</div><div className="text-xs text-gray-400">{stock.ticker}</div></div><div className="text-right"><div className="text-sm font-medium">{formatPrice(stock.currentPrice, market)}</div><div className={`text-xs ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</div></div></div>)}</div></section>;
}

function AnalystTab({ onOpenInsight }: { onOpenInsight: (request: InsightRequest) => void }) {
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState<MarketFilter>('all');
  const [sortBy, setSortBy] = useState<'upside' | 'date'>('date');
  const [broker, setBroker] = useState('all');
  const [opinion, setOpinion] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => { void (async () => {
    const cached = getCachedAnalystReports(days, market); setLoading(!cached); setError(null);
    try { if (cached) setReports(cached); setReports(await fetchAnalystReports(days, market)); } catch (fetchError) { console.error(fetchError); setError('애널리스트 데이터를 불러오는 중 오류가 발생했습니다.'); } finally { setLoading(false); }
  })(); }, [days, market]);
  useEffect(() => setPage(1), [days, market, sortBy, broker, opinion]);

  const brokers = Array.from(new Set(reports.map((r) => r.broker))).sort();
  const opinions = Array.from(new Set(reports.map((r) => r.opinion))).sort();
  const filtered = [...reports].filter((r) => broker === 'all' || r.broker === broker).filter((r) => opinion === 'all' || r.opinion === opinion).sort((a, b) => sortBy === 'upside' ? b.upside - a.upside : new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const avgUpside = filtered.length ? filtered.reduce((sum, r) => sum + r.upside, 0) / filtered.length : 0;
  const topUpside = [...filtered].sort((a, b) => b.upside - a.upside).slice(0, 10);

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-4">
      <div><label className="mr-2 text-sm text-gray-500">기간</label><div className="inline-flex overflow-hidden rounded-lg border">{[3, 7, 15, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}일</button>)}</div></div>
      <SimpleSelect label="시장" value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '전체'], ['korea', '국내'], ['us', '해외']]} />
      <SimpleSelect label="정렬" value={sortBy} onChange={(value) => setSortBy(value as 'upside' | 'date')} options={[['date', '최신순'], ['upside', '상승여력순']]} />
      <SimpleSelect label="증권사" value={broker} onChange={setBroker} options={[['all', '전체'], ...brokers.map((value) => [value, value] as [string, string])]} />
      <SimpleSelect label="의견" value={opinion} onChange={setOpinion} options={[['all', '전체'], ...opinions.map((value) => [value, value] as [string, string])]} />
    </div></div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="추천 리포트 수" value={String(filtered.length)} />
      <StatCard label="평균 상승여력" value={formatPct(avgUpside)} accent="text-green-600" />
      <StatCard label="국내 리포트" value={String(filtered.filter((r) => r.market === 'korea').length)} />
      <StatCard label="해외 리포트" value={String(filtered.filter((r) => r.market === 'us').length)} />
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="text-lg font-semibold">애널리스트 추천 종목</h2><p className="text-sm text-gray-500">종목명을 누르면 기준가격과 간단한 매수 의견을 확인할 수 있습니다.</p></div>
        {filtered.length === 0 ? <div className="p-8 text-center text-gray-400">조건에 맞는 추천 리포트가 없습니다.</div> : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">날짜</th><th className="px-4 py-3">종목</th><th className="px-4 py-3">시장</th><th className="px-4 py-3">증권사</th><th className="px-4 py-3 text-right">목표가</th><th className="px-4 py-3 text-right">기준가격</th><th className="px-4 py-3 text-right">현재가</th><th className="px-4 py-3 text-right">상승여력</th><th className="px-4 py-3">의견</th></tr></thead><tbody className="divide-y">{paginated.map((report, index) => <tr key={`${report.market}-${report.ticker}-${index}`} className="hover:bg-gray-50"><td className="px-4 py-3 text-sm">{report.date}</td><td className="px-4 py-3"><button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, currentPrice: report.currentPrice })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{report.name}</div><div className="text-xs text-gray-400">{report.ticker}</div></button></td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '국내' : '해외'}</span></td><td className="px-4 py-3 text-sm">{report.broker}</td><td className="px-4 py-3 text-right font-medium">{formatPrice(report.targetPrice, report.market)}</td><td className="px-4 py-3 text-right"><div className="font-medium">{formatPrice(report.basePrice, report.market)}</div><div className="text-xs text-gray-400">{report.basePriceDate} 종가</div></td><td className="px-4 py-3 text-right">{formatPrice(report.currentPrice, report.market)}</td><td className="px-4 py-3 text-right font-medium text-green-600">{formatPct(report.upside)}</td><td className="px-4 py-3"><span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">{report.opinion}</span></td></tr>)}</tbody></table></div>}
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-4 py-3"><div className="text-sm text-gray-500">총 {filtered.length}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)}건</div><div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">이전</button><span className="text-sm text-gray-600">{page} / {totalPages}</span><button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">다음</button></div></div>
      <div className="rounded-xl bg-white p-6 shadow-sm"><h3 className="mb-4 text-lg font-semibold">상승여력 TOP 10</h3><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={topUpside} layout="vertical"><XAxis type="number" domain={[0, 'dataMax + 10']} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '상승여력']} /><Bar dataKey="upside" fill="#22c55e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
    </>}
  </div>;
}

function SimpleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <div><label className="mr-2 text-sm text-gray-500">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function StockList({ stocks, title, market, onOpenInsight }: { stocks: Stock[]; title: string; market: MarketType; onOpenInsight: (request: InsightRequest) => void }) {
  const [sortBy, setSortBy] = useState<'changePercent' | 'volume' | 'currentPrice'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = stocks.filter((stock) => !q || stock.name.toLowerCase().includes(q) || stock.ticker.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => { const av = a[sortBy] || 0; const bv = b[sortBy] || 0; return sortOrder === 'desc' ? bv - av : av - bv; });
  const formatVolume = (volume: number) => volume >= 1000000 ? `${(volume / 1000000).toFixed(1)}M` : volume >= 1000 ? `${(volume / 1000).toFixed(1)}K` : volume.toString();

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="min-w-[220px] flex-1"><label className="mr-2 text-sm text-gray-500">검색</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 티커" className="w-full rounded-lg border px-3 py-2 text-sm md:w-64" /></div>
      <SimpleSelect label="정렬" value={sortBy} onChange={(value) => setSortBy(value as 'changePercent' | 'volume' | 'currentPrice')} options={[['changePercent', '등락률'], ['volume', '거래량'], ['currentPrice', '현재가']]} />
      <SimpleSelect label="순서" value={sortOrder} onChange={(value) => setSortOrder(value as 'asc' | 'desc')} options={[['desc', '내림차순'], ['asc', '오름차순']]} />
      <div className="ml-auto text-sm text-gray-400">총 {filtered.length}건</div>
    </div>
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-gray-500">종목명을 누르면 간단한 매수 의견 팝업이 열립니다.</p></div>
      {stocks.length === 0 ? <div className="p-8 text-center text-gray-400">데이터가 없습니다.</div> : filtered.length === 0 ? <div className="p-8 text-center text-gray-400">검색 결과가 없습니다.</div> : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3 text-left">종목</th><th className="px-4 py-3 text-right">현재가</th><th className="px-4 py-3 text-right">변동금액</th><th className="px-4 py-3 text-right">등락률</th><th className="px-4 py-3 text-right">거래량</th></tr></thead><tbody className="divide-y">{sorted.map((stock) => <tr key={stock.ticker} className="hover:bg-gray-50"><td className="px-4 py-3"><button type="button" onClick={() => onOpenInsight({ ticker: stock.ticker, name: stock.name, market, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{stock.name}</div><div className="text-xs text-gray-400">{stock.ticker}</div></button></td><td className="px-4 py-3 text-right font-medium">{formatPrice(stock.currentPrice, market)}</td><td className={`px-4 py-3 text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.change >= 0 ? '+' : ''}{market === 'korea' ? Math.round(stock.change).toLocaleString() : stock.change.toFixed(2)}</td><td className={`px-4 py-3 text-right font-medium ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</td><td className="px-4 py-3 text-right text-gray-500">{stock.volume ? formatVolume(stock.volume) : '-'}</td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}

function StockInsightModal({ request, onClose }: { request: InsightRequest | null; onClose: () => void }) {
  const [insight, setInsight] = useState<StockInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) { setInsight(null); setError(null); return; }
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(null);
      try { const data = await fetchStockInsight(request); if (!cancelled) setInsight(data); }
      catch (fetchError) { console.error(fetchError); if (!cancelled) setError('종목 의견을 불러오지 못했습니다.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onClose]);

  if (!request) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b p-5"><div><h2 className="text-xl font-semibold text-gray-900">{request.name}</h2><p className="text-sm text-gray-500">{request.ticker} · {request.market === 'korea' ? '국내' : '해외'}</p></div><button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100">닫기</button></div>
      {loading ? <div className="p-8"><LoadingState /></div> : error ? <div className="p-6 text-red-600">{error}</div> : insight ? <div className="space-y-6 p-6">
        <section className="space-y-3"><div className="rounded-xl bg-blue-50 p-4"><div className="text-sm text-blue-700">한줄 의견</div><p className="mt-1 text-sm text-gray-800">{insight.reasonSummary}</p></div><div className="rounded-xl bg-gray-50 p-4"><div className="mb-2 text-sm font-medium text-gray-700">왜 봐야 하나</div><ul className="space-y-2 text-sm text-gray-700">{insight.reasonBullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" /><span>{bullet}</span></li>)}</ul></div></section>
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="현재가" value={formatPrice(insight.latestCurrentPrice || request.currentPrice || 0, request.market)} />
          <MetricCard label="기준가격" value={formatPrice(insight.latestBasePrice || 0, request.market)} subLabel={insight.latestReportDate ? `${insight.latestReportDate} 종가` : undefined} />
          <MetricCard label="목표가" value={formatPrice(insight.latestTargetPrice || 0, request.market)} />
          <MetricCard label="평균 상승여력" value={insight.avgUpside !== undefined ? formatPct(insight.avgUpside) : '-'} accent="text-green-600" />
        </section>
        <section className="rounded-xl border p-4"><div className="mb-3 text-sm font-medium text-gray-700">최신 리포트 요약</div><div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2"><div>증권사: <span className="font-medium">{insight.latestBroker || '없음'}</span></div><div>의견: <span className="font-medium">{insight.latestOpinion || '없음'}</span></div><div>리포트 일자: <span className="font-medium">{insight.latestReportDate || '-'}</span></div><div>캐시된 매수 리포트 수: <span className="font-medium">{insight.reportCount}</span></div></div></section>
        {insight.relatedReports.length > 0 && <section className="rounded-xl border p-4"><div className="mb-3 text-sm font-medium text-gray-700">관련 리포트</div><div className="space-y-3">{insight.relatedReports.map((report) => <div key={`${report.market}-${report.ticker}-${report.broker}-${report.date}`} className="rounded-lg bg-gray-50 p-3"><div className="text-sm font-medium text-gray-900">{report.reportTitle || `${report.broker} 리포트`}</div><div className="mt-1 text-xs text-gray-500">{report.date} · {report.broker} · {report.opinion}</div></div>)}</div></section>}
      </div> : null}
    </div>
  </div>;
}

function MetricCard({ label, value, subLabel, accent }: { label: string; value: string; subLabel?: string; accent?: string }) {
  return <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><div className="text-sm text-gray-500">{label}</div><div className={`mt-1 text-lg font-semibold ${accent || 'text-gray-900'}`}>{value}</div>{subLabel ? <div className="mt-1 text-xs text-gray-400">{subLabel}</div> : null}</div>;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-xl bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">{label}</div><div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div></div>;
}
