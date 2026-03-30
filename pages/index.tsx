import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type MarketType = 'korea' | 'us';
type MarketFilter = 'all' | MarketType;
type TabType = 'home' | 'watchlist' | 'korea-stock' | 'korea-etf' | 'us-stock' | 'us-etf' | 'analyst' | 'consensus';
type WatchlistCategory = 'stock' | 'etf' | 'analyst';

type Stock = { ticker: string; name: string; currentPrice: number; change: number; changePercent: number; volume?: number; marketCap?: string; high52w?: number; low52w?: number };
type MarketIndex = { ticker: string; name: string; market: MarketType; value: number; change: number; changePercent: number };
type AnalystReport = { date: string; ticker: string; name: string; market: MarketType; broker: string; analyst: string; opinion: string; targetPrice: number; currentPrice: number; basePrice: number; basePriceDate: string; upside: number; reportTitle?: string; sourceUrl?: string; reasonSummary?: string; reasonBullets?: string[] };
type AnalystConsensusItem = { ticker: string; name: string; market: MarketType; brokerCount: number; brokers: string[]; latestReportDate: string; avgUpside: number; currentPrice: number; basePrice: number; basePriceDate: string; reportCount: number; relatedReports: AnalystReport[] };
type InsightSection = { summary: string; bullets: string[]; signal?: 'up' | 'down' | 'flat' | 'mixed' | 'unknown' };
type StockInsight = { ticker: string; name: string; market: MarketType; latestReportDate?: string; latestBroker?: string; latestOpinion?: string; latestTargetPrice?: number; latestCurrentPrice?: number; latestBasePrice?: number; avgUpside?: number; reportCount: number; reasonSummary: string; reasonBullets: string[]; investmentLogic: InsightSection; estimateRevision: InsightSection; valuation: InsightSection; sectorCycle: InsightSection; relatedReports: AnalystReport[] };
type StockInsightResponse = { found: boolean; insight: StockInsight };
type InsightRequest = { ticker: string; name: string; market: MarketType; category: WatchlistCategory; currentPrice?: number; changePercent?: number; high52w?: number; low52w?: number };
type WatchlistItem = { ticker: string; name: string; market: MarketType; category: WatchlistCategory; savedAt: string; currentPrice?: number; changePercent?: number; high52w?: number; low52w?: number };
type ResolvedWatchlistItem = WatchlistItem & { currentPrice?: number; change?: number; changePercent?: number; volume?: number; high52w?: number; low52w?: number };

const ANALYST_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const CONSENSUS_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const INSIGHT_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const WATCHLIST_STORAGE_KEY = 'globalpick.watchlist';
const analystClientCache = new Map<string, { reports: AnalystReport[]; fetchedAt: number }>();
const analystClientInflight = new Map<string, Promise<AnalystReport[]>>();
const consensusClientCache = new Map<string, { items: AnalystConsensusItem[]; fetchedAt: number }>();
const consensusClientInflight = new Map<string, Promise<AnalystConsensusItem[]>>();
const insightClientCache = new Map<string, { insight: StockInsight; fetchedAt: number }>();
const insightClientInflight = new Map<string, Promise<StockInsight>>();

const formatPrice = (price: number, market: MarketType) => market === 'korea'
  ? `${Math.round(price || 0).toLocaleString()} KRW`
  : `$${(price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const analystKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const consensusKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const insightKey = (req: InsightRequest) => `${req.market}:${req.ticker}`;
const watchlistKey = (item: Pick<WatchlistItem, 'market' | 'ticker'>) => `${item.market}:${item.ticker}`;

function readWatchlist() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as WatchlistItem[] : [];
  } catch {
    return [];
  }
}

function resolveWatchlistItems(watchlist: WatchlistItem[], stocksByKey: Map<string, Stock>) {
  return watchlist
    .map((item) => {
      const stock = stocksByKey.get(watchlistKey(item));
      return {
        ...item,
        currentPrice: stock?.currentPrice ?? item.currentPrice,
        change: stock?.change,
        changePercent: stock?.changePercent ?? item.changePercent,
        volume: stock?.volume,
        high52w: stock?.high52w ?? item.high52w,
        low52w: stock?.low52w ?? item.low52w,
      } satisfies ResolvedWatchlistItem;
    })
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

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

function getCachedConsensus(days: number, market: MarketFilter) {
  const cached = consensusClientCache.get(consensusKey(days, market));
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CONSENSUS_CACHE_TTL_MS) {
    consensusClientCache.delete(consensusKey(days, market));
    return null;
  }
  return cached.items;
}

async function fetchAnalystConsensus(days: number, market: MarketFilter) {
  const cached = getCachedConsensus(days, market);
  if (cached) return cached;
  const key = consensusKey(days, market);
  const inflight = consensusClientInflight.get(key);
  if (inflight) return inflight;
  const request = fetch(`/api/analyst-consensus?days=${days}&market=${market}`).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch analyst consensus');
    const data = await res.json() as AnalystConsensusItem[];
    consensusClientCache.set(key, { items: data, fetchedAt: Date.now() });
    return data;
  }).finally(() => consensusClientInflight.delete(key));
  consensusClientInflight.set(key, request);
  return request;
}

async function fetchStockInsight(request: InsightRequest) {
  const key = insightKey(request);
  const cached = insightClientCache.get(key);
  if (cached && Date.now() - cached.fetchedAt <= INSIGHT_CACHE_TTL_MS) return cached.insight;
  const inflight = insightClientInflight.get(key);
  if (inflight) return inflight;
  const params = new URLSearchParams({
    ticker: request.ticker,
    name: request.name,
    market: request.market,
    currentPrice: String(request.currentPrice || 0),
    changePercent: String(request.changePercent || 0),
    high52w: String(request.high52w || 0),
    low52w: String(request.low52w || 0),
  });
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [a, b, c, d, e] = await Promise.all([
          fetch('/api/market-indices'),
          fetch('/api/korea-stocks?type=stock'),
          fetch('/api/korea-stocks?type=etf'),
          fetch('/api/us-stocks?type=stock'),
          fetch('/api/us-stocks?type=etf'),
        ]);
        if (![a, b, c, d, e].every((res) => res.ok)) throw new Error('Failed');
        setMarketIndices(await a.json());
        setKoreaStocks(await b.json());
        setKoreaETFs(await c.json());
        setUsStocks(await d.json());
        setUsETFs(await e.json());
      } catch (fetchError) {
        console.error(fetchError);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const warmup = () => { void fetchAnalystReports(30, 'all').catch(console.error); };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number; cancelIdleCallback?: (handle: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(warmup);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warmup, 800);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    setWatchlist(readWatchlist());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const stockLookup = new Map<string, Stock>();
  koreaStocks.forEach((stock) => stockLookup.set(`korea:${stock.ticker}`, stock));
  koreaETFs.forEach((stock) => stockLookup.set(`korea:${stock.ticker}`, stock));
  usStocks.forEach((stock) => stockLookup.set(`us:${stock.ticker}`, stock));
  usETFs.forEach((stock) => stockLookup.set(`us:${stock.ticker}`, stock));

  const resolvedWatchlist = resolveWatchlistItems(watchlist, stockLookup);
  const watchlistPreview = resolvedWatchlist.slice(0, 5);
  const isSaved = (ticker: string, market: MarketType) => watchlist.some((item) => item.ticker === ticker && item.market === market);
  const toggleWatchlist = (item: Omit<WatchlistItem, 'savedAt'>) => {
    setWatchlist((current) => {
      const existing = current.find((entry) => entry.ticker === item.ticker && entry.market === item.market);
      if (existing) {
        return current.filter((entry) => !(entry.ticker === item.ticker && entry.market === item.market));
      }
      return [{ ...item, savedAt: new Date().toISOString() }, ...current];
    });
  };
  const removeWatchlist = (ticker: string, market: MarketType) => {
    setWatchlist((current) => current.filter((item) => !(item.ticker === ticker && item.market === market)));
  };

  return <>
    <Head>
      <title>글로벌픽</title>
      <meta name="description" content="국내외 종목과 애널리스트 추천 데이터를 비교합니다." />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">글로벌픽</h1>
          <p className="mt-1 text-sm text-gray-500">종목을 누르면 기준가격과 간단한 매수 의견을 확인할 수 있습니다.</p>
        </div>
      </header>
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {[
              ['home', '홈'],
              ['watchlist', '관심 종목'],
              ['korea-stock', '국내 주식'],
              ['korea-etf', '국내 ETF'],
              ['us-stock', '해외 주식'],
              ['us-etf', '해외 ETF'],
              ['analyst', '애널리스트 추천'],
            ].map(([id, label]) => <button key={id} onClick={() => setActiveTab(id as TabType)} className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${activeTab === id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>)}
            <button onClick={() => setActiveTab('consensus')} className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${activeTab === 'consensus' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>공통 추천</button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'analyst'
          ? <AnalystTab onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
          : activeTab === 'consensus'
            ? <ConsensusTab onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
          : loading
            ? <LoadingState />
            : error
              ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
              : <>
                {activeTab === 'home' && <HomeTab marketIndices={marketIndices} koreaStocks={koreaStocks} koreaETFs={koreaETFs} usStocks={usStocks} usETFs={usETFs} watchlistPreview={watchlistPreview} onOpenInsight={setInsightTarget} onOpenWatchlist={() => setActiveTab('watchlist')} />}
                {activeTab === 'watchlist' && <WatchlistTab items={resolvedWatchlist} onOpenInsight={setInsightTarget} onRemove={removeWatchlist} />}
                {activeTab === 'korea-stock' && <StockList stocks={koreaStocks} title="국내 주식" market="korea" category="stock" onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />}
                {activeTab === 'korea-etf' && <StockList stocks={koreaETFs} title="국내 ETF" market="korea" category="etf" onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />}
                {activeTab === 'us-stock' && <StockList stocks={usStocks} title="해외 주식" market="us" category="stock" onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />}
                {activeTab === 'us-etf' && <StockList stocks={usETFs} title="해외 ETF" market="us" category="etf" onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />}
              </>}
      </main>
      <footer className="mt-8 border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-gray-500">
          <p>데이터 출처: 네이버 금융, Yahoo Finance, Stock Analysis</p>
        </div>
      </footer>
    </div>
    <StockInsightModal request={insightTarget} onClose={() => setInsightTarget(null)} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
  </>;
}

function LoadingState() {
  return <div className="flex h-64 items-center justify-center"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /><p className="mt-4 text-gray-500">데이터를 불러오는 중입니다.</p></div></div>;
}

function HomeTab({ marketIndices, koreaStocks, koreaETFs, usStocks, usETFs, watchlistPreview, onOpenInsight, onOpenWatchlist }: { marketIndices: MarketIndex[]; koreaStocks: Stock[]; koreaETFs: Stock[]; usStocks: Stock[]; usETFs: Stock[]; watchlistPreview: ResolvedWatchlistItem[]; onOpenInsight: (request: InsightRequest) => void; onOpenWatchlist: () => void }) {
  return <div className="space-y-6">
    <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">주요 시장 지수</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-5">{marketIndices.map((index) => <div key={index.ticker} className="rounded-lg bg-gray-50 p-4"><div className="text-sm text-gray-500">{index.name}</div><div className="text-xl font-bold">{index.value.toLocaleString()}</div><div className={`text-sm ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)</div></div>)}</div></section>
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">관심 종목</h2>
          <p className="text-sm text-gray-500">저장한 종목 5개를 빠르게 확인할 수 있습니다.</p>
        </div>
        <button type="button" onClick={onOpenWatchlist} className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">전체 보기</button>
      </div>
      {watchlistPreview.length === 0 ? <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-400">아직 저장한 관심 종목이 없습니다.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{watchlistPreview.map((item) => <button key={`${item.market}-${item.ticker}`} type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: item.category, currentPrice: item.currentPrice, changePercent: item.changePercent, high52w: item.high52w, low52w: item.low52w })} className="rounded-lg bg-gray-50 p-4 text-left hover:bg-gray-100"><div className="truncate text-sm font-semibold text-blue-700">{item.name}</div><div className="text-xs text-gray-400">{item.ticker}</div><div className="mt-3 text-sm font-medium text-gray-900">{formatPrice(item.currentPrice || 0, item.market)}</div><div className={`text-xs ${item.changePercent !== undefined && item.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{item.changePercent !== undefined ? formatPct(item.changePercent) : '-'}</div></button>)}</div>}
    </section>
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

function WatchlistTab({ items, onOpenInsight, onRemove }: { items: ResolvedWatchlistItem[]; onOpenInsight: (request: InsightRequest) => void; onRemove: (ticker: string, market: MarketType) => void }) {
  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">관심 종목</h2>
      <p className="mt-1 text-sm text-gray-500">저장한 종목을 한 곳에서 보고, 필요 없는 종목은 바로 삭제할 수 있습니다.</p>
    </div>
    {items.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-gray-400 shadow-sm">저장된 관심 종목이 없습니다.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={`${item.market}-${item.ticker}`} className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: item.category, currentPrice: item.currentPrice, changePercent: item.changePercent, high52w: item.high52w, low52w: item.low52w })} className="min-w-0 text-left"><div className="truncate font-semibold text-blue-700 hover:underline">{item.name}</div><div className="text-xs text-gray-400">{item.ticker} · {item.market === 'korea' ? '국내' : '해외'}</div></button><button type="button" onClick={() => onRemove(item.ticker, item.market)} className="shrink-0 rounded-lg border px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">삭제</button></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">현재가</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.currentPrice || 0, item.market)}</div></div><div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">등락률</div><div className={`mt-1 font-medium ${item.changePercent !== undefined && item.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{item.changePercent !== undefined ? formatPct(item.changePercent) : '-'}</div></div></div><div className="mt-4 text-xs text-gray-400">저장일 {item.savedAt.slice(0, 10)}</div></article>)}</div>}
  </div>;
}

function AnalystTab({ onOpenInsight, isSaved, onToggleWatchlist }: { onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
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
    const cached = getCachedAnalystReports(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setReports(cached);
      setReports(await fetchAnalystReports(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('애널리스트 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);
  useEffect(() => setPage(1), [days, market, sortBy, broker, opinion]);

  const brokers = Array.from(new Set(reports.map((r) => r.broker))).sort();
  const opinions = Array.from(new Set(reports.map((r) => r.opinion))).sort();
  const filtered = [...reports]
    .filter((r) => broker === 'all' || r.broker === broker)
    .filter((r) => opinion === 'all' || r.opinion === opinion)
    .sort((a, b) => sortBy === 'upside' ? b.upside - a.upside : new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const avgUpside = filtered.length ? filtered.reduce((sum, r) => sum + r.upside, 0) / filtered.length : 0;
  const topUpside = [...filtered].sort((a, b) => b.upside - a.upside).slice(0, 10);

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">기간</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[3, 7, 15, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}일</button>)}
          </div>
        </div>
        <SimpleSelect label="시장" value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '전체'], ['korea', '국내'], ['us', '해외']]} />
        <SimpleSelect label="정렬" value={sortBy} onChange={(value) => setSortBy(value as 'upside' | 'date')} options={[['date', '최신순'], ['upside', '상승여력순']]} />
        <SimpleSelect label="증권사" value={broker} onChange={setBroker} options={[['all', '전체'], ...brokers.map((value) => [value, value] as [string, string])]} />
        <SimpleSelect label="의견" value={opinion} onChange={setOpinion} options={[['all', '전체'], ...opinions.map((value) => [value, value] as [string, string])]} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="추천 리포트 수" value={String(filtered.length)} />
      <StatCard label="평균 상승여력" value={formatPct(avgUpside)} accent="text-green-600" />
      <StatCard label="국내 리포트" value={String(filtered.filter((r) => r.market === 'korea').length)} />
      <StatCard label="해외 리포트" value={String(filtered.filter((r) => r.market === 'us').length)} />
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="text-lg font-semibold">애널리스트 추천 종목</h2><p className="text-sm text-gray-500">종목명을 누르면 기준가격과 간단한 매수 의견을 확인할 수 있습니다.</p></div>
        {filtered.length === 0 ? <div className="p-8 text-center text-gray-400">조건에 맞는 추천 리포트가 없습니다.</div> : <>
          <div className="space-y-2.5 p-3 md:hidden">
            {paginated.map((report, index) => <article key={`${report.market}-${report.ticker}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2.5">
                <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="min-w-0 text-left">
                  <div className="truncate text-sm font-semibold text-blue-700">{report.name}</div>
                  <div className="text-[11px] text-gray-400">{report.ticker}</div>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="h-6 w-6 text-sm" />
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '국내' : '해외'}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                <span>{report.date}</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-700">{report.opinion}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">증권사</div><div className="mt-1 text-[12px] font-medium text-gray-900">{report.broker}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">상승여력</div><div className="mt-1 text-[12px] font-semibold text-green-600">{formatPct(report.upside)}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">목표가</div><div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.targetPrice, report.market)}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">현재가</div><div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.currentPrice, report.market)}</div></div>
              </div>
              <div className="mt-2.5 rounded-md bg-white p-2.5 text-xs">
                <div className="text-[11px] text-gray-500">기준가격</div>
                <div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.basePrice, report.market)}</div>
                <div className="mt-1 text-[11px] text-gray-400">{report.basePriceDate} 종가</div>
              </div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3">종목</th>
                  <th className="px-4 py-3">시장</th>
                  <th className="px-4 py-3">증권사</th>
                  <th className="px-4 py-3 text-right">목표가</th>
                  <th className="px-4 py-3 text-right">기준가격</th>
                  <th className="px-4 py-3 text-right">현재가</th>
                  <th className="px-4 py-3 text-right">상승여력</th>
                  <th className="px-4 py-3">의견</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((report, index) => <tr key={`${report.market}-${report.ticker}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{report.date}</td>
                  <td className="px-4 py-3"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{report.name}</div><div className="text-xs text-gray-400">{report.ticker}</div></button><FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} /></div></td>
                  <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '국내' : '해외'}</span></td>
                  <td className="px-4 py-3 text-sm">{report.broker}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(report.targetPrice, report.market)}</td>
                  <td className="px-4 py-3 text-right"><div className="font-medium">{formatPrice(report.basePrice, report.market)}</div><div className="text-xs text-gray-400">{report.basePriceDate} 종가</div></td>
                  <td className="px-4 py-3 text-right">{formatPrice(report.currentPrice, report.market)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatPct(report.upside)}</td>
                  <td className="px-4 py-3"><span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">{report.opinion}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-500">총 {filtered.length}건 중 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)}건</div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">이전</button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">다음</button>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6"><h3 className="mb-4 text-lg font-semibold">상승여력 TOP 10</h3><div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={topUpside} layout="vertical"><XAxis type="number" domain={[0, 'dataMax + 10']} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '상승여력']} /><Bar dataKey="upside" fill="#22c55e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
    </>}
  </div>;
}

function SimpleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <div className="w-full sm:w-auto"><label className="mb-1 block text-sm text-gray-500">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm sm:min-w-[140px]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function ConsensusTab({ onOpenInsight, isSaved, onToggleWatchlist }: { onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  const [items, setItems] = useState<AnalystConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState<MarketFilter>('all');

  useEffect(() => { void (async () => {
    const cached = getCachedConsensus(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setItems(cached);
      setItems(await fetchAnalystConsensus(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('공통 추천 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);

  const avgUpside = items.length ? items.reduce((sum, item) => sum + item.avgUpside, 0) / items.length : 0;

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">기간</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[3, 7, 15, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}일</button>)}
          </div>
        </div>
        <SimpleSelect label="시장" value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '전체'], ['korea', '국내'], ['us', '해외']]} />
        <div className="text-sm text-gray-400 md:pb-2">서로 다른 증권사 2곳 이상 추천 종목만 표시</div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="공통 추천 종목" value={String(items.length)} />
      <StatCard label="평균 상승여력" value={formatPct(avgUpside)} accent="text-green-600" />
      <StatCard label="국내 종목" value={String(items.filter((item) => item.market === 'korea').length)} />
      <StatCard label="해외 종목" value={String(items.filter((item) => item.market === 'us').length)} />
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="text-lg font-semibold">애널리스트 공통 추천 종목</h2><p className="text-sm text-gray-500">선택한 기간 내 여러 증권사가 함께 추천한 종목만 따로 모아서 보여줍니다.</p></div>
      {items.length === 0 ? <div className="p-8 text-center text-gray-400">조건에 맞는 공통 추천 종목이 없습니다.</div> : <>
        <div className="space-y-3 p-4 md:hidden">
          {items.map((item) => <article key={`${item.market}-${item.ticker}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="min-w-0 text-left">
                <div className="truncate font-semibold text-blue-700">{item.name}</div>
                <div className="text-xs text-gray-400">{item.ticker}</div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton active={isSaved(item.ticker, item.market)} onClick={() => onToggleWatchlist({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="h-7 w-7 text-base" />
                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">{item.brokerCount}곳</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">현재가</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.currentPrice, item.market)}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">평균 상승여력</div><div className="mt-1 font-semibold text-green-600">{formatPct(item.avgUpside)}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">기준가격</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.basePrice, item.market)}</div><div className="mt-1 text-[11px] text-gray-400">{item.basePriceDate} 종가</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">최근 추천일</div><div className="mt-1 font-medium text-gray-900">{item.latestReportDate}</div><div className="mt-1 text-[11px] text-gray-400">리포트 {item.reportCount}건</div></div>
            </div>
            <div className="mt-3 text-xs text-gray-500">{item.brokers.join(', ')}</div>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">종목</th>
                <th className="px-4 py-3">시장</th>
                <th className="px-4 py-3 text-right">증권사 수</th>
                <th className="px-4 py-3 text-right">현재가</th>
                <th className="px-4 py-3 text-right">기준가격</th>
                <th className="px-4 py-3 text-right">평균 상승여력</th>
                <th className="px-4 py-3">최근 추천일</th>
                <th className="px-4 py-3">증권사</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => <tr key={`${item.market}-${item.ticker}`} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{item.name}</div><div className="text-xs text-gray-400">{item.ticker}</div></button><FavoriteButton active={isSaved(item.ticker, item.market)} onClick={() => onToggleWatchlist({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} /></div></td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${item.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{item.market === 'korea' ? '국내' : '해외'}</span></td>
                <td className="px-4 py-3 text-right font-medium">{item.brokerCount}</td>
                <td className="px-4 py-3 text-right">{formatPrice(item.currentPrice, item.market)}</td>
                <td className="px-4 py-3 text-right"><div className="font-medium">{formatPrice(item.basePrice, item.market)}</div><div className="text-xs text-gray-400">{item.basePriceDate} 종가</div></td>
                <td className="px-4 py-3 text-right font-medium text-green-600">{formatPct(item.avgUpside)}</td>
                <td className="px-4 py-3 text-sm">{item.latestReportDate}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.brokers.join(', ')}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </div>}
  </div>;
}

function StockList({ stocks, title, market, category, onOpenInsight, isSaved, onToggleWatchlist }: { stocks: Stock[]; title: string; market: MarketType; category: WatchlistCategory; onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  const [sortBy, setSortBy] = useState<'changePercent' | 'volume' | 'currentPrice'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = stocks.filter((stock) => !q || stock.name.toLowerCase().includes(q) || stock.ticker.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => { const av = a[sortBy] || 0; const bv = b[sortBy] || 0; return sortOrder === 'desc' ? bv - av : av - bv; });
  const formatVolume = (volume: number) => volume >= 1000000 ? `${(volume / 1000000).toFixed(1)}M` : volume >= 1000 ? `${(volume / 1000).toFixed(1)}K` : volume.toString();

  return <div className="space-y-6">
    <div className="grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,0.8fr))_auto] md:items-end">
      <div className="w-full"><label className="mb-1 block text-sm text-gray-500">검색</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 티커" className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
      <SimpleSelect label="정렬" value={sortBy} onChange={(value) => setSortBy(value as 'changePercent' | 'volume' | 'currentPrice')} options={[['changePercent', '등락률'], ['volume', '거래량'], ['currentPrice', '현재가']]} />
      <SimpleSelect label="순서" value={sortOrder} onChange={(value) => setSortOrder(value as 'asc' | 'desc')} options={[['desc', '내림차순'], ['asc', '오름차순']]} />
      <div className="text-sm text-gray-400 md:justify-self-end">총 {filtered.length}건</div>
    </div>
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-gray-500">종목명을 누르면 간단한 매수 의견 팝업이 열립니다.</p></div>
      {stocks.length === 0 ? <div className="p-8 text-center text-gray-400">데이터가 없습니다.</div> : filtered.length === 0 ? <div className="p-8 text-center text-gray-400">검색 결과가 없습니다.</div> : <>
        <div className="space-y-3 p-4 md:hidden">
          {sorted.map((stock) => <article key={stock.ticker} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpenInsight({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="min-w-0 text-left">
                <div className="truncate font-semibold text-blue-700">{stock.name}</div>
                <div className="text-xs text-gray-400">{stock.ticker}</div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <FavoriteButton active={isSaved(stock.ticker, market)} onClick={() => onToggleWatchlist({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="h-7 w-7 text-base" />
                <div className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</div>
              </div>
            </div>
            <button type="button" onClick={() => onOpenInsight({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="mt-4 block w-full text-left">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">현재가</div><div className="mt-1 font-medium text-gray-900">{formatPrice(stock.currentPrice, market)}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">변동금액</div><div className={`mt-1 font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.change >= 0 ? '+' : ''}{market === 'korea' ? Math.round(stock.change).toLocaleString() : stock.change.toFixed(2)}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">거래량</div><div className="mt-1 font-medium text-gray-900">{stock.volume ? formatVolume(stock.volume) : '-'}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">52주 범위</div><div className="mt-1 font-medium text-gray-900">{stock.low52w || stock.high52w ? `${formatPrice(stock.low52w || 0, market)} - ${formatPrice(stock.high52w || 0, market)}` : '-'}</div></div>
              </div>
            </button>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3 text-left">종목</th><th className="px-4 py-3 text-right">현재가</th><th className="px-4 py-3 text-right">변동금액</th><th className="px-4 py-3 text-right">등락률</th><th className="px-4 py-3 text-right">거래량</th></tr></thead><tbody className="divide-y">{sorted.map((stock) => <tr key={stock.ticker} className="hover:bg-gray-50"><td className="px-4 py-3"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{stock.name}</div><div className="text-xs text-gray-400">{stock.ticker}</div></button><FavoriteButton active={isSaved(stock.ticker, market)} onClick={() => onToggleWatchlist({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} /></div></td><td className="px-4 py-3 text-right font-medium">{formatPrice(stock.currentPrice, market)}</td><td className={`px-4 py-3 text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.change >= 0 ? '+' : ''}{market === 'korea' ? Math.round(stock.change).toLocaleString() : stock.change.toFixed(2)}</td><td className={`px-4 py-3 text-right font-medium ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</td><td className="px-4 py-3 text-right text-gray-500">{stock.volume ? formatVolume(stock.volume) : '-'}</td></tr>)}</tbody></table></div>
      </>}
    </div>
  </div>;
}

function StockInsightModal({ request, onClose, isSaved, onToggleWatchlist }: { request: InsightRequest | null; onClose: () => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  const [insight, setInsight] = useState<StockInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      setInsight(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStockInsight(request);
        if (!cancelled) setInsight(data);
      } catch (fetchError) {
        console.error(fetchError);
        if (!cancelled) setError('종목 의견을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
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
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-3 sm:items-center sm:px-4 sm:py-6" onClick={onClose}>
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">{request.name}</h2><p className="text-sm text-gray-500">{request.ticker} · {request.market === 'korea' ? '국내' : '해외'}</p></div><div className="flex items-center gap-2"><FavoriteButton active={isSaved(request.ticker, request.market)} onClick={() => onToggleWatchlist({ ticker: request.ticker, name: request.name, market: request.market, category: request.category, currentPrice: request.currentPrice, changePercent: request.changePercent, high52w: request.high52w, low52w: request.low52w })} className="h-9 w-9 text-xl" /><button type="button" onClick={onClose} className="shrink-0 rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100">닫기</button></div></div>
      {loading ? <div className="p-6 sm:p-8"><LoadingState /></div> : error ? <div className="p-4 text-red-600 sm:p-6">{error}</div> : insight ? <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <section className="space-y-3"><div className="rounded-xl bg-blue-50 p-4"><div className="text-sm text-blue-700">요약 의견</div><p className="mt-1 text-sm text-gray-800">{insight.reasonSummary}</p></div><div className="rounded-xl bg-gray-50 p-4"><div className="mb-2 text-sm font-medium text-gray-700">핵심 근거</div><ul className="space-y-2 text-sm text-gray-700">{insight.reasonBullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" /><span>{bullet}</span></li>)}</ul></div></section>
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard label="현재가" value={formatPrice(insight.latestCurrentPrice || request.currentPrice || 0, request.market)} />
          <MetricCard label="기준가격" value={formatPrice(insight.latestBasePrice || 0, request.market)} subLabel={insight.latestReportDate ? `${insight.latestReportDate} 종가` : undefined} />
          <MetricCard label="목표가" value={formatPrice(insight.latestTargetPrice || 0, request.market)} />
          <MetricCard label="평균 상승여력" value={insight.avgUpside !== undefined ? formatPct(insight.avgUpside) : '-'} accent="text-green-600" />
        </section>
        <section className="rounded-xl border p-4"><div className="mb-3 text-sm font-medium text-gray-700">최신 리포트 정보</div><div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2"><div>증권사: <span className="font-medium">{insight.latestBroker || '없음'}</span></div><div>의견: <span className="font-medium">{insight.latestOpinion || '없음'}</span></div><div>리포트 일자: <span className="font-medium">{insight.latestReportDate || '-'}</span></div><div>누적 리포트 수: <span className="font-medium">{insight.reportCount}</span></div></div></section>
        {insight.relatedReports.length > 0 && <section className="rounded-xl border p-4"><div className="mb-3 text-sm font-medium text-gray-700">ê´€ë ¨ ë¦¬í¬íŠ¸</div><div className="space-y-3">{insight.relatedReports.map((report) => <div key={`${report.market}-${report.ticker}-${report.broker}-${report.date}`} className="rounded-lg bg-gray-50 p-3">{report.sourceUrl ? <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="block"><div className="text-sm font-medium text-blue-700">{report.reportTitle || `${report.broker} ë¦¬í¬íŠ¸`}</div><div className="mt-1 text-xs text-gray-500">{report.date} Â· {report.broker} Â· {report.opinion}</div><div className="mt-2 text-xs text-gray-400">ë¦¬í¬íŠ¸ ë³´ëŸ¬ê°€ê¸°</div></a> : <><div className="text-sm font-medium text-gray-900">{report.reportTitle || `${report.broker} ë¦¬í¬íŠ¸`}</div><div className="mt-1 text-xs text-gray-500">{report.date} Â· {report.broker} Â· {report.opinion}</div></>}</div>)}</div></section>}
        {insight && <section className="grid gap-4 lg:grid-cols-2">
          <InsightSectionCard title="1. 왜 추천하는지 논리" section={insight.investmentLogic} />
          <InsightSectionCard title="2. 실적 추정치 변화" section={insight.estimateRevision} />
          <InsightSectionCard title="3. 밸류에이션" section={insight.valuation} />
          <InsightSectionCard title="4. 업종 사이클" section={insight.sectorCycle} />
        </section>}
      </div> : null}
    </div>
  </div>;
}

function MetricCard({ label, value, subLabel, accent }: { label: string; value: string; subLabel?: string; accent?: string }) {
  return <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><div className="text-sm text-gray-500">{label}</div><div className={`mt-1 text-lg font-semibold ${accent || 'text-gray-900'}`}>{value}</div>{subLabel ? <div className="mt-1 text-xs text-gray-400">{subLabel}</div> : null}</div>;
}

function InsightSectionCard({ title, section }: { title: string; section: InsightSection }) {
  return <section className="rounded-xl border p-4">
    <div className="text-sm font-medium text-gray-700">{title}</div>
    <p className="mt-2 text-sm text-gray-800">{section.summary}</p>
    {section.bullets.length > 0 && <ul className="mt-3 space-y-2 text-sm text-gray-700">{section.bullets.map((bullet) => <li key={`${title}-${bullet}`} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" /><span>{bullet}</span></li>)}</ul>}
  </section>;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-xl bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">{label}</div><div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div></div>;
}

function FavoriteButton({ active, onClick, className = '' }: { active: boolean; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={active ? '관심 종목 해제' : '관심 종목 저장'} className={`inline-flex h-8 w-8 items-center justify-center text-xl leading-none transition ${active ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'} ${className}`}>{active ? '★' : '☆'}</button>;
}
