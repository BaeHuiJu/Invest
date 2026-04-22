import { useEffect, useState } from 'react';
import { useDarkMode, DARK_MODE_ICONS, DARK_MODE_LABELS } from '@/lib/useDarkMode';
import Head from 'next/head';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useToast } from '@/components/Toast';
import { NotificationSettings } from '@/components/NotificationSettings';
import { BacktestTab } from '@/components/BacktestTab';
import { PortfolioTab } from '@/components/PortfolioTab';
import { EarningsCalendarTab } from '@/components/EarningsCalendarTab';
import { AIPicksTab } from '@/components/AIPicksTab';
import { EntryScoreTooltip } from '@/components/EntryScoreTooltip';
import { GlossaryModal } from '@/components/GlossaryModal';
import { GlobalSearch } from '@/components/GlobalSearch';
import ConsensusChangesTab from '@/components/ConsensusChangesTab';
import { AnalystLeaderboardTab } from '@/components/AnalystLeaderboardTab';
import { ValuationScreenerTab, preWarmScreener } from '@/components/ValuationScreenerTab';

type MarketType = 'korea' | 'us';
type MarketFilter = 'all' | MarketType;
type TabType = 'home' | 'watchlist' | 'ai-picks' | 'korea-stock' | 'korea-etf' | 'us-stock' | 'us-etf' | 'analyst' | 'consensus' | 'consensus-changes' | 'scorecard' | 'sector-cycle' | 'backtest' | 'portfolio' | 'earnings' | 'screener';
type WatchlistCategory = 'stock' | 'etf' | 'analyst';
type PerformanceStatus = 'complete' | 'pending' | 'unavailable';
type SectorCyclePhase = 'recovery' | 'expansion' | 'slowdown' | 'contraction';
type SectorCycleConfidence = 'low' | 'medium' | 'high';

type Stock = { ticker: string; name: string; currentPrice: number; change: number; changePercent: number; volume?: number; marketCap?: string; high52w?: number; low52w?: number };
type MarketIndex = { ticker: string; name: string; market: MarketType; value: number; change: number; changePercent: number };
type PerformancePoint = { asOfDate: string; closePrice: number; returnPct: number; targetProgressPct: number; success: boolean; status: PerformanceStatus };
type AnalystReportPerformance = { week1: PerformancePoint; month1: PerformancePoint; month3: PerformancePoint };
type AnalystReport = { date: string; ticker: string; name: string; market: MarketType; broker: string; analyst: string; opinion: string; targetPrice: number; currentPrice: number; basePrice: number; basePriceDate: string; upside: number; reportTitle?: string; sourceUrl?: string; reasonSummary?: string; reasonBullets?: string[]; sector?: string; performance?: AnalystReportPerformance };
type AnalystConsensusItem = { ticker: string; name: string; market: MarketType; brokerCount: number; brokers: string[]; latestReportDate: string; avgUpside: number; currentPrice: number; basePrice: number; basePriceDate: string; avgTargetPrice: number; entryScore: number; entryScoreBreakdown: { priceVsBase: number; targetGap: number; reportCount: number; consensusStrength: number }; reportCount: number; relatedReports: AnalystReport[] };
type InsightSection = { summary: string; bullets: string[]; signal?: 'up' | 'down' | 'flat' | 'mixed' | 'unknown' };
type StockInsight = { ticker: string; name: string; market: MarketType; latestReportDate?: string; latestBroker?: string; latestOpinion?: string; latestTargetPrice?: number; latestCurrentPrice?: number; latestBasePrice?: number; avgUpside?: number; reportCount: number; reasonSummary: string; reasonBullets: string[]; investmentLogic: InsightSection; estimateRevision: InsightSection; valuation: InsightSection; sectorCycle: InsightSection; relatedReports: AnalystReport[] };
type StockInsightResponse = { found: boolean; insight: StockInsight };
type ScorecardPeriodSummary = { eligibleCount: number; successCount: number; declineCount: number; pendingCount: number; unavailableCount: number; successRate: number; declineRate: number; avgReturnPct: number; avgTargetProgressPct: number };
type ScorecardGroup = { key: string; label: string; reportCount: number; week1: ScorecardPeriodSummary; month1: ScorecardPeriodSummary; month3: ScorecardPeriodSummary };
type AnalystScorecardResponse = { summary: { overall: ScorecardGroup; byBroker: ScorecardGroup[]; byMarket: ScorecardGroup[]; bySector: ScorecardGroup[] }; reports: AnalystReport[] };
type SectorCycleRecentReport = { date: string; ticker: string; name: string; market: MarketType; broker: string; reasonSummary: string; currentPrice: number };
type SectorCycleItem = { sector: string; phase: SectorCyclePhase; phaseScore: number; confidence: SectorCycleConfidence; reportCount: number; latestReportDate: string; keywords: string[]; recentReports: SectorCycleRecentReport[] };
type SectorCycleResponse = { generatedAt: string; days: number; market: MarketFilter; items: SectorCycleItem[] };
type ScorecardPeriodKey = 'week1' | 'month1' | 'month3';
type InsightRequest = { ticker: string; name: string; market: MarketType; category: WatchlistCategory; currentPrice?: number; changePercent?: number; high52w?: number; low52w?: number };
type WatchlistItem = { ticker: string; name: string; market: MarketType; category: WatchlistCategory; savedAt: string; currentPrice?: number; changePercent?: number; high52w?: number; low52w?: number };
type ResolvedWatchlistItem = WatchlistItem & { currentPrice?: number; change?: number; changePercent?: number; volume?: number; high52w?: number; low52w?: number };

const ANALYST_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const CONSENSUS_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const SCORECARD_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const SECTOR_CYCLE_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const INSIGHT_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5 * 60 * 1000;
const WATCHLIST_STORAGE_KEY = 'globalpick.watchlist';
const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 40, 50];
const analystClientCache = new Map<string, { reports: AnalystReport[]; fetchedAt: number }>();
const analystClientInflight = new Map<string, Promise<AnalystReport[]>>();
const consensusClientCache = new Map<string, { items: AnalystConsensusItem[]; fetchedAt: number }>();
const consensusClientInflight = new Map<string, Promise<AnalystConsensusItem[]>>();
const scorecardClientCache = new Map<string, { data: AnalystScorecardResponse; fetchedAt: number }>();
const scorecardClientInflight = new Map<string, Promise<AnalystScorecardResponse>>();
const sectorCycleClientCache = new Map<string, { data: SectorCycleResponse; fetchedAt: number }>();
const sectorCycleClientInflight = new Map<string, Promise<SectorCycleResponse>>();
const insightClientCache = new Map<string, { insight: StockInsight; fetchedAt: number }>();
const insightClientInflight = new Map<string, Promise<StockInsight>>();

const formatPrice = (price: number, market: MarketType) => market === 'korea'
  ? `${Math.round(price || 0).toLocaleString()} KRW`
  : `$${(price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const formatScore = (value: number) => `${Math.round(value)}점`;
const analystKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const consensusKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const scorecardKey = (days: number, market: MarketFilter) => `${days}:${market}`;
const sectorCycleKey = (days: number, market: MarketFilter) => `${days}:${market}`;
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

function getCachedScorecard(days: number, market: MarketFilter) {
  const cached = scorecardClientCache.get(scorecardKey(days, market));
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > SCORECARD_CACHE_TTL_MS) {
    scorecardClientCache.delete(scorecardKey(days, market));
    return null;
  }
  return cached.data;
}

async function fetchAnalystScorecard(days: number, market: MarketFilter) {
  const cached = getCachedScorecard(days, market);
  if (cached) return cached;
  const key = scorecardKey(days, market);
  const inflight = scorecardClientInflight.get(key);
  if (inflight) return inflight;
  const request = fetch(`/api/analyst-scorecard?days=${days}&market=${market}`).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch analyst scorecard');
    const data = await res.json() as AnalystScorecardResponse;
    scorecardClientCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  }).finally(() => scorecardClientInflight.delete(key));
  scorecardClientInflight.set(key, request);
  return request;
}

function getCachedSectorCycle(days: number, market: MarketFilter) {
  const cached = sectorCycleClientCache.get(sectorCycleKey(days, market));
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > SECTOR_CYCLE_CACHE_TTL_MS) {
    sectorCycleClientCache.delete(sectorCycleKey(days, market));
    return null;
  }
  return cached.data;
}

async function fetchSectorCycle(days: number, market: MarketFilter) {
  const cached = getCachedSectorCycle(days, market);
  if (cached) return cached;
  const key = sectorCycleKey(days, market);
  const inflight = sectorCycleClientInflight.get(key);
  if (inflight) return inflight;
  const request = fetch(`/api/sector-cycle?days=${days}&market=${market}`).then(async (res) => {
    if (!res.ok) throw new Error('Failed to fetch sector cycle');
    const data = await res.json() as SectorCycleResponse;
    sectorCycleClientCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  }).finally(() => sectorCycleClientInflight.delete(key));
  sectorCycleClientInflight.set(key, request);
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
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const { addToast } = useToast();
  const { preference: darkPref, cycle: cycleDark } = useDarkMode();

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
    const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback) => number; cancelIdleCallback?: (handle: number) => void };
    const warm = () => preWarmScreener();
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(warm);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    setWatchlist(readWatchlist());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stockLookup = new Map<string, Stock>();
  koreaStocks.forEach((stock) => stockLookup.set(`korea:${stock.ticker}`, stock));
  koreaETFs.forEach((stock) => stockLookup.set(`korea:${stock.ticker}`, stock));
  usStocks.forEach((stock) => stockLookup.set(`us:${stock.ticker}`, stock));
  usETFs.forEach((stock) => stockLookup.set(`us:${stock.ticker}`, stock));

  const resolvedWatchlist = resolveWatchlistItems(watchlist, stockLookup);
  const watchlistPreview = resolvedWatchlist.slice(0, 5);
  const isSaved = (ticker: string, market: MarketType) => watchlist.some((item) => item.ticker === ticker && item.market === market);
  const toggleWatchlist = (item: Omit<WatchlistItem, 'savedAt'>) => {
    const existing = watchlist.find((entry) => entry.ticker === item.ticker && entry.market === item.market);
    setWatchlist((current) => {
      if (existing) {
        return current.filter((entry) => !(entry.ticker === item.ticker && entry.market === item.market));
      }
      return [{ ...item, savedAt: new Date().toISOString() }, ...current];
    });
    if (existing) {
      addToast('info', `${item.name} 관심 종목에서 제거됨`);
    } else {
      addToast('success', `${item.name} 관심 종목에 추가됨`);
    }
  };
  const removeWatchlist = (ticker: string, market: MarketType) => {
    const item = watchlist.find((entry) => entry.ticker === ticker && entry.market === market);
    setWatchlist((current) => current.filter((entry) => !(entry.ticker === ticker && entry.market === market)));
    if (item) {
      addToast('info', `${item.name} 관심 종목에서 삭제됨`);
    }
  };

  return <>
    <Head>
      <title>글로벌픽</title>
      <meta name="description" content="국내외 종목과 애널리스트 추천 데이터를 비교합니다." />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">글로벌픽</h1>
              <p className="mt-0.5 hidden text-sm text-gray-500 sm:block dark:text-gray-400">종목을 누르면 기준가격과 간단한 매수 의견을 확인할 수 있습니다.</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                aria-label="검색"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">검색</span>
              </button>
              <button
                type="button"
                onClick={() => setNotificationSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                aria-label="알림 설정"
              >
                <span className="text-base sm:text-lg">🔔</span>
                <span className="hidden sm:inline">알림</span>
              </button>
              <button
                type="button"
                onClick={() => setGlossaryOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                aria-label="용어 사전"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">용어</span>
              </button>
              <button
                type="button"
                onClick={cycleDark}
                className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-50 sm:px-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                title={DARK_MODE_LABELS[darkPref]}
                aria-label="다크모드 전환"
              >
                <span className="text-base">{DARK_MODE_ICONS[darkPref]}</span>
                <span className="hidden sm:inline">{DARK_MODE_LABELS[darkPref]}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <nav className="border-b bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="mx-auto max-w-7xl">
          <div className="scrollbar-hide flex overflow-x-auto px-2 sm:px-4" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {(
              [
                ['home', '홈'],
                ['watchlist', '관심'],
                ['ai-picks', 'AI추천'],
                ['analyst', '애널리스트'],
                ['consensus', '공통추천'],
                ['consensus-changes', '컨센서스변화'],
                ['screener', '밸류스크리너'],
                ['backtest', '백테스팅'],
                ['portfolio', '포트폴리오'],
                ['sector-cycle', '업종사이클'],
                ['scorecard', '성과분석'],
                ['korea-stock', '국내주식'],
                ['korea-etf', '국내ETF'],
                ['us-stock', '해외주식'],
                ['us-etf', '해외ETF'],
                ['earnings', '실적캘린더'],
              ] as [TabType, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-shrink-0 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                  activeTab === id
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {activeTab === 'ai-picks'
          ? <AIPicksTab onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
          : activeTab === 'analyst'
          ? <AnalystTab onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
          : activeTab === 'sector-cycle'
            ? <SectorCycleTab onOpenInsight={setInsightTarget} />
          : activeTab === 'scorecard'
            ? <AnalystLeaderboardTab />
          : activeTab === 'consensus'
            ? <ConsensusTab onOpenInsight={setInsightTarget} isSaved={isSaved} onToggleWatchlist={toggleWatchlist} />
          : activeTab === 'consensus-changes'
            ? <ConsensusChangesTab />
          : activeTab === 'backtest'
            ? <BacktestTab />
          : activeTab === 'portfolio'
            ? <PortfolioTab onNavigateToAIPicks={() => setActiveTab('ai-picks')} />
          : activeTab === 'earnings'
            ? <EarningsCalendarTab />
          : activeTab === 'screener'
            ? <ValuationScreenerTab onOpenInsight={setInsightTarget} />
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
    <NotificationSettings isOpen={notificationSettingsOpen} onClose={() => setNotificationSettingsOpen(false)} />
    <GlossaryModal isOpen={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
  </>;
}

function LoadingState() {
  return <div className="flex h-64 items-center justify-center"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /><p className="mt-4 text-gray-500">데이터를 불러오는 중입니다.</p></div></div>;
}

function HomeTab({ marketIndices, koreaStocks, koreaETFs, usStocks, usETFs, watchlistPreview, onOpenInsight, onOpenWatchlist }: { marketIndices: MarketIndex[]; koreaStocks: Stock[]; koreaETFs: Stock[]; usStocks: Stock[]; usETFs: Stock[]; watchlistPreview: ResolvedWatchlistItem[]; onOpenInsight: (request: InsightRequest) => void; onOpenWatchlist: () => void }) {
  return <div className="space-y-6">
    <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">주요 시장 지수</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{marketIndices.map((index) => <div key={index.ticker} className="rounded-lg bg-gray-50 p-4"><div className="text-sm text-gray-500">{index.name}</div><div className="text-xl font-bold">{index.value.toLocaleString()}</div><div className={`text-sm ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)</div></div>)}</div></section>
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

function PaginationControls({ totalCount, page, pageSize, totalPages, onPageChange }: { totalCount: number; page: number; pageSize: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalCount === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return <div className="flex flex-col gap-3 rounded-xl border bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="text-sm text-gray-500">{'\uCD1D'} {totalCount}{'\uAC74 \uC911'} {start}-{end}{'\uAC74'}</div>
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">{'\uC774\uC804'}</button>
      <span className="text-sm text-gray-600">{page} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded border bg-white px-3 py-1.5 text-sm disabled:opacity-50">{'\uB2E4\uC74C'}</button>
    </div>
  </div>;
}

function WatchlistTab({ items, onOpenInsight, onRemove }: { items: ResolvedWatchlistItem[]; onOpenInsight: (request: InsightRequest) => void; onRemove: (ticker: string, market: MarketType) => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginated = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{'\uAD00\uC2EC \uC885\uBAA9 \uBAA9\uB85D'}</h2>
      <p className="mt-1 text-sm text-gray-500">{'\uC800\uC7A5\uD55C \uC885\uBAA9\uC744 \uD55C\uACF3\uC5D0\uC11C \uBAA8\uC544 \uBCF4\uACE0, \uC885\uBAA9 \uD074\uB9AD \uD6C4 \uC758\uACAC \uD31D\uC5C5\uC73C\uB85C \uBC14\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
    </div>
    {items.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-gray-400 shadow-sm">{'\uC800\uC7A5\uB41C \uAD00\uC2EC \uC885\uBAA9\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
      <div className="flex justify-end">
        <SimpleSelect label={'\uD398\uC774\uC9C0 \uD06C\uAE30'} value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((option) => [String(option), String(option)] as [string, string])} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{paginated.map((item) => <article key={`${item.market}-${item.ticker}`} className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: item.category, currentPrice: item.currentPrice, changePercent: item.changePercent, high52w: item.high52w, low52w: item.low52w })} className="min-w-0 text-left"><div className="truncate font-semibold text-blue-700 hover:underline">{item.name}</div><div className="text-xs text-gray-400">{item.ticker} {'\u00B7'} {item.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}</div></button><button type="button" onClick={() => onRemove(item.ticker, item.market)} className="shrink-0 rounded-lg border px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">{'\uC0AD\uC81C'}</button></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{'\uD604\uC7AC\uAC00'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.currentPrice || 0, item.market)}</div></div><div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{'\uB4F1\uB77D\uB960'}</div><div className={`mt-1 font-medium ${item.changePercent !== undefined && item.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{item.changePercent !== undefined ? formatPct(item.changePercent) : '-'}</div></div></div><div className="mt-4 text-xs text-gray-400">{'\uC800\uC7A5\uC77C'} {item.savedAt.slice(0, 10)}</div></article>)}</div>
      <PaginationControls totalCount={items.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} />
    </>}
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
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { void (async () => {
    const cached = getCachedAnalystReports(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setReports(cached);
      setReports(await fetchAnalystReports(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('\uC560\uB110\uB9AC\uC2A4\uD2B8 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);
  useEffect(() => setPage(1), [days, market, sortBy, broker, opinion, pageSize, searchQuery]);

  const brokers = Array.from(new Set(reports.map((r) => r.broker))).sort();
  const opinions = Array.from(new Set(reports.map((r) => r.opinion))).sort();
  const filtered = [...reports]
    .filter((r) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) ||
        r.ticker.toLowerCase().includes(q) ||
        r.broker.toLowerCase().includes(q) ||
        r.analyst.toLowerCase().includes(q) ||
        (r.reportTitle?.toLowerCase().includes(q) ?? false);
    })
    .filter((r) => broker === 'all' || r.broker === broker)
    .filter((r) => opinion === 'all' || r.opinion === opinion)
    .sort((a, b) => sortBy === 'upside' ? b.upside - a.upside : new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const avgUpside = filtered.length ? filtered.reduce((sum, r) => sum + r.upside, 0) / filtered.length : 0;
  const topUpside = [...filtered].sort((a, b) => b.upside - a.upside).slice(0, 10);

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="종목명, 티커, 증권사, 애널리스트 검색..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && <div className="mt-2 text-sm text-gray-500">검색 결과: {filtered.length}건</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">{'\uAE30\uAC04'}</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[3, 7, 15, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}{'\uC77C'}</button>)}
          </div>
        </div>
        <SimpleSelect label={'\uC2DC\uC7A5'} value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '\uC804\uCCB4'], ['korea', '\uAD6D\uB0B4'], ['us', '\uD574\uC678']]} />
        <SimpleSelect label={'\uC815\uB82C'} value={sortBy} onChange={(value) => setSortBy(value as 'upside' | 'date')} options={[['date', '\uCD5C\uC2E0\uC21C'], ['upside', '\uC0C1\uC2B9\uC5EC\uB825\uC21C']]} />
        <SimpleSelect label={'\uC99D\uAD8C\uC0AC'} value={broker} onChange={setBroker} options={[['all', '\uC804\uCCB4'], ...brokers.map((value) => [value, value] as [string, string])]} />
        <SimpleSelect label={'\uC758\uACAC'} value={opinion} onChange={setOpinion} options={[['all', '\uC804\uCCB4'], ...opinions.map((value) => [value, value] as [string, string])]} />
        <SimpleSelect label={'\uD398\uC774\uC9C0 \uD06C\uAE30'} value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((option) => [String(option), String(option)] as [string, string])} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label={'\uCD94\uCC9C \uB9AC\uD3EC\uD2B8 \uC218'} value={String(filtered.length)} />
      <StatCard label={'\uD3C9\uADE0 \uC0C1\uC2B9\uC5EC\uB825'} value={formatPct(avgUpside)} accent="text-green-600" />
      <StatCard label={'\uAD6D\uB0B4 \uB9AC\uD3EC\uD2B8'} value={String(filtered.filter((r) => r.market === 'korea').length)} />
      <StatCard label={'\uD574\uC678 \uB9AC\uD3EC\uD2B8'} value={String(filtered.filter((r) => r.market === 'us').length)} />
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">{'\uC560\uB110\uB9AC\uC2A4\uD2B8 \uCD94\uCC9C \uC885\uBAA9'}</h2>
          <p className="text-sm text-gray-500">{'\uC885\uBAA9\uBA85\uC744 \uB204\uB974\uBA74 \uAE30\uC900\uAC00\uACA9\uACFC \uAC04\uB2E8\uD55C \uB9E4\uC218 \uC758\uACAC\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
        </div>
        {filtered.length === 0 ? <div className="p-8 text-center text-gray-400">{'\uC870\uAC74\uC5D0 \uB9DE\uB294 \uCD94\uCC9C \uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
          <div className="space-y-2.5 p-3 md:hidden">
            {paginated.map((report, index) => <article key={`${report.market}-${report.ticker}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2.5">
                <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="min-w-0 text-left">
                  <div className="truncate text-sm font-semibold text-blue-700">{report.name}</div>
                  <div className="text-[11px] text-gray-400">{report.ticker}</div>
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="h-6 w-6 text-sm" />
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                <span>{report.date}</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-700">{report.opinion}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">{'\uC99D\uAD8C\uC0AC'}</div><div className="mt-1 text-[12px] font-medium text-gray-900">{report.broker}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">{'\uC0C1\uC2B9\uC5EC\uB825'}</div><div className="mt-1 text-[12px] font-semibold text-green-600">{formatPct(report.upside)}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">{'\uBAA9\uD45C\uAC00'}</div><div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.targetPrice, report.market)}</div></div>
                <div className="rounded-md bg-white p-2.5"><div className="text-[11px] text-gray-500">{'\uD604\uC7AC\uAC00'}</div><div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.currentPrice, report.market)}</div></div>
              </div>
              <div className="mt-2.5 rounded-md bg-white p-2.5 text-xs">
                <div className="text-[11px] text-gray-500">{'\uAE30\uC900\uAC00\uACA9'}</div>
                <div className="mt-1 text-[12px] font-medium text-gray-900">{formatPrice(report.basePrice, report.market)}</div>
                <div className="mt-1 text-[11px] text-gray-400">{report.basePriceDate} {'\uC885\uAC00'}</div>
              </div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">{'\uB0A0\uC9DC'}</th>
                  <th className="px-4 py-3">{'\uC885\uBAA9'}</th>
                  <th className="px-4 py-3">{'\uC2DC\uC7A5'}</th>
                  <th className="px-4 py-3">{'\uC99D\uAD8C\uC0AC'}</th>
                  <th className="px-4 py-3 text-right">{'\uBAA9\uD45C\uAC00'}</th>
                  <th className="px-4 py-3 text-right">{'\uAE30\uC900\uAC00\uACA9'}</th>
                  <th className="px-4 py-3 text-right">{'\uD604\uC7AC\uAC00'}</th>
                  <th className="px-4 py-3 text-right">{'\uC0C1\uC2B9\uC5EC\uB825'}</th>
                  <th className="px-4 py-3">{'\uC758\uACAC'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((report, index) => <tr key={`${report.market}-${report.ticker}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{report.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="text-left">
                        <div className="font-medium text-blue-700 hover:underline">{report.name}</div>
                        <div className="text-xs text-gray-400">{report.ticker}</div>
                      </button>
                      <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} />
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}</span></td>
                  <td className="px-4 py-3 text-sm">{report.broker}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(report.targetPrice, report.market)}</td>
                  <td className="px-4 py-3 text-right"><div className="font-medium">{formatPrice(report.basePrice, report.market)}</div><div className="text-xs text-gray-400">{report.basePriceDate} {'\uC885\uAC00'}</div></td>
                  <td className="px-4 py-3 text-right">{formatPrice(report.currentPrice, report.market)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatPct(report.upside)}</td>
                  <td className="px-4 py-3"><span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">{report.opinion}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </div>
      <PaginationControls totalCount={filtered.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} />
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6"><h3 className="mb-4 text-lg font-semibold">{'\uC0C1\uC2B9\uC5EC\uB825 TOP 10'}</h3><div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={topUpside} layout="vertical"><XAxis type="number" domain={[0, 'dataMax + 10']} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '\uC0C1\uC2B9\uC5EC\uB825']} /><Bar dataKey="upside" fill="#22c55e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
    </>}
  </div>;
}

function getPerformanceLabel(point?: PerformancePoint) {
  if (!point) return '-';
  if (point.status === 'pending') return '\uB300\uAE30';
  if (point.status === 'unavailable') return '\uC81C\uC678';
  return `${point.targetProgressPct.toFixed(1)}% / ${formatPct(point.returnPct)}`;
}

function getPerformanceTone(point?: PerformancePoint) {
  if (!point || point.status !== 'complete') return 'text-gray-400';
  return point.success ? 'text-green-600' : 'text-red-600';
}

function getReturnMetric(point?: PerformancePoint) {
  if (!point) return '-';
  if (point.status === 'pending') return '\uB300\uAE30';
  if (point.status === 'unavailable') return '\uC81C\uC678';
  return `${point.returnPct >= 0 ? '\uC0C1\uC2B9\uB960' : '\uD558\uB77D\uB960'} ${formatPct(point.returnPct)}`;
}

function getProgressMetric(point?: PerformancePoint) {
  if (!point) return '-';
  if (point.status === 'pending') return '\uB300\uAE30';
  if (point.status === 'unavailable') return '\uC81C\uC678';
  return `\uBAA9\uD45C\uAC00 \uC811\uADFC\uB960 ${point.targetProgressPct.toFixed(1)}%`;
}

function getStatusBadge(point?: PerformancePoint) {
  if (!point) return { label: '-', className: 'bg-gray-100 text-gray-500' };
  if (point.status === 'pending') return { label: '\uB300\uAE30', className: 'bg-amber-100 text-amber-700' };
  if (point.status === 'unavailable') return { label: '\uC81C\uC678', className: 'bg-gray-100 text-gray-500' };
  return point.success
    ? { label: '\uC131\uACF5', className: 'bg-green-100 text-green-700' }
    : { label: '\uBBF8\uB2EC', className: 'bg-red-100 text-red-700' };
}

function getScorecardPeriodLabel(period: ScorecardPeriodKey) {
  if (period === 'week1') return '1\uC8FC';
  if (period === 'month1') return '1\uAC1C\uC6D4';
  return '3\uAC1C\uC6D4';
}

function getScorecardDetailReports(reports: AnalystReport[], broker: string, period: ScorecardPeriodKey) {
  const scoped = reports
    .filter((report) => report.broker === broker)
    .map((report) => ({
      report,
      point: report.performance?.[period],
    }));

  const rising = scoped
    .filter(({ point }) => point?.status === 'complete' && (point.returnPct ?? 0) >= 0)
    .sort((a, b) => (b.point?.returnPct ?? 0) - (a.point?.returnPct ?? 0));
  const falling = scoped
    .filter(({ point }) => point?.status === 'complete' && (point.returnPct ?? 0) < 0)
    .sort((a, b) => (a.point?.returnPct ?? 0) - (b.point?.returnPct ?? 0));
  const pending = scoped.filter(({ point }) => point?.status === 'pending');

  return { rising, falling, pending };
}

function ScorecardTab({ onOpenInsight, isSaved, onToggleWatchlist }: { onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  const [data, setData] = useState<AnalystScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [market, setMarket] = useState<MarketFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [selectedBrokerPeriod, setSelectedBrokerPeriod] = useState<ScorecardPeriodKey>('month1');
  const [chartPeriod, setChartPeriod] = useState<ScorecardPeriodKey>('month1');

  useEffect(() => { void (async () => {
    const cached = getCachedScorecard(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setData(cached);
      setData(await fetchAnalystScorecard(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('\uCD94\uCC9C \uD6C4 \uC131\uC801\uD45C \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);

  useEffect(() => {
    setPage(1);
  }, [days, market, pageSize]);

  useEffect(() => {
    const nextBroker = data?.summary.byBroker?.[0]?.key || null;
    setSelectedBroker(nextBroker);
    setSelectedBrokerPeriod('month1');
  }, [data, days, market]);

  const overall = data?.summary.overall;
  const reports = data?.reports || [];
  const selectedBrokerGroup = data?.summary.byBroker.find((item) => item.key === selectedBroker) || null;
  const selectedBrokerDetails = selectedBroker ? getScorecardDetailReports(reports, selectedBroker, selectedBrokerPeriod) : null;
  const totalPages = Math.max(1, Math.ceil(reports.length / pageSize));
  const paginated = reports.slice((page - 1) * pageSize, page * pageSize);
  const brokerChartData = (data?.summary.byBroker || []).slice(0, 8).map((item) => ({
    name: item.label,
    successRate: item[chartPeriod].successRate,
  }));
  const periodChartData = overall ? [
    { name: '1W', avgReturnPct: overall.week1.avgReturnPct },
    { name: '1M', avgReturnPct: overall.month1.avgReturnPct },
    { name: '3M', avgReturnPct: overall.month3.avgReturnPct },
  ] : [];

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">{'\uAE30\uAC04'}</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}{'\uC77C'}</button>)}
          </div>
        </div>
        <SimpleSelect label={'\uC2DC\uC7A5'} value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '\uC804\uCCB4'], ['korea', '\uAD6D\uB0B4'], ['us', '\uD574\uC678']]} />
        <div className="text-sm text-gray-400 md:pb-2">{'\uBAA9\uD45C\uAC00 \uB3C4\uB2EC \uAC70\uB9AC \uAE30\uC900 70% \uC811\uADFC \uC2DC \uC131\uACF5'}</div>
      </div>
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : data && overall ? <>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{'\uCD94\uCC9C \uD6C4 \uC131\uC801\uD45C'}</h2>
        <p className="mt-1 text-sm text-gray-500">{'\uCD94\uCC9C\uC77C \uAE30\uC900\uAC00\uACA9\uC5D0\uC11C \uBAA9\uD45C\uAC00\uAE4C\uC9C0 \uAC70\uB9AC\uB97C \uC5BC\uB9C8\uB098 \uC904\uC600\uB294\uC9C0 \uAE30\uC900\uC73C\uB85C 1\uC8FC, 1\uAC1C\uC6D4, 3\uAC1C\uC6D4 \uC131\uACFC\uB97C \uC9D1\uACC4\uD569\uB2C8\uB2E4.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={'1\uC8FC \uC131\uACF5\uB960'} value={`${overall.week1.successRate.toFixed(1)}%`} accent="text-green-600" />
        <StatCard label={'1\uC8FC \uD558\uB77D\uB960'} value={`${overall.week1.declineRate.toFixed(1)}%`} accent="text-red-600" />
        <StatCard label={'1\uAC1C\uC6D4 \uC131\uACF5\uB960'} value={`${overall.month1.successRate.toFixed(1)}%`} accent="text-green-600" />
        <StatCard label={'1\uAC1C\uC6D4 \uD558\uB77D\uB960'} value={`${overall.month1.declineRate.toFixed(1)}%`} accent="text-red-600" />
        <StatCard label={'3\uAC1C\uC6D4 \uC131\uACF5\uB960'} value={`${overall.month3.successRate.toFixed(1)}%`} accent="text-green-600" />
        <StatCard label={'3\uAC1C\uC6D4 \uD558\uB77D\uB960'} value={`${overall.month3.declineRate.toFixed(1)}%`} accent="text-red-600" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">증권사별 {getScorecardPeriodLabel(chartPeriod)} 성공률 TOP 8</h3>
            <div className="flex flex-wrap overflow-hidden rounded-lg border">
              {(['week1', 'month1', 'month3'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1.5 text-sm ${chartPeriod === period ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {getScorecardPeriodLabel(period)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brokerChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '\uC131\uACF5\uB960']} />
                <Bar dataKey="successRate" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">{'\uAE30\uAC04\uBCC4 \uD3C9\uADE0 \uC218\uC775\uB960'}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodChartData}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '\uD3C9\uADE0 \uC218\uC775\uB960']} />
                <Bar dataKey="avgReturnPct" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <ScorecardGroupCard title={'\uC99D\uAD8C\uC0AC\uBCC4 \uC131\uC801'} items={data.summary.byBroker.slice(0, 6)} activeKey={selectedBroker} onSelect={setSelectedBroker} selectable />
        <ScorecardGroupCard title={'\uC5C5\uC885\uBCC4 \uC131\uC801'} items={data.summary.bySector.slice(0, 6)} />
        <ScorecardGroupCard title={'\uC2DC\uC7A5\uBCC4 \uBE44\uAD50'} items={data.summary.byMarket.slice(0, 6)} />
      </div>
      {selectedBrokerGroup && selectedBrokerDetails ? <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{selectedBrokerGroup.label} {'\uC0C1\uC138 \uC131\uC801'}</h3>
            <p className="text-sm text-gray-500">{getScorecardPeriodLabel(selectedBrokerPeriod)} {'\uAE30\uC900 \uC0C1\uC2B9/\uD558\uB77D \uC885\uBAA9 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uC885\uBAA9\uBA85\uC744 \uB204\uB974\uBA74 \uC778\uC0AC\uC774\uD2B8 \uD31D\uC5C5\uC744 \uC5FD\uB2C8\uB2E4.'}</p>
          </div>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {(['week1', 'month1', 'month3'] as const).map((period) => <button key={period} type="button" onClick={() => setSelectedBrokerPeriod(period)} className={`px-4 py-2 text-sm ${selectedBrokerPeriod === period ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{getScorecardPeriodLabel(period)}</button>)}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ScorecardReportList title={'\uC0C1\uC2B9 \uC885\uBAA9'} tone="up" items={selectedBrokerDetails.rising} onOpenInsight={onOpenInsight} isSaved={isSaved} onToggleWatchlist={onToggleWatchlist} emptyText={'\uC774 \uAE30\uAC04\uC5D0 \uC0C1\uC2B9 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'} />
          <ScorecardReportList title={'\uD558\uB77D \uC885\uBAA9'} tone="down" items={selectedBrokerDetails.falling} onOpenInsight={onOpenInsight} isSaved={isSaved} onToggleWatchlist={onToggleWatchlist} emptyText={'\uC774 \uAE30\uAC04\uC5D0 \uD558\uB77D \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'} />
        </div>
        {selectedBrokerDetails.pending.length > 0 ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          {'\uB300\uAE30 \uC911'} {selectedBrokerDetails.pending.length}{'\uAC74'}: {selectedBrokerDetails.pending.slice(0, 8).map(({ report }) => report.name).join(', ')}
        </div> : null}
      </section> : null}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{'\uAC1C\uBCC4 \uCD94\uCC9C \uC774\uB825'}</h3>
              <p className="text-sm text-gray-500">{'\uD589\uC744 \uB204\uB974\uBA74 \uC885\uBAA9 \uC778\uC0AC\uC774\uD2B8 \uD31D\uC5C5\uC744 \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
            </div>
            <SimpleSelect label={'\uD398\uC774\uC9C0 \uD06C\uAE30'} value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((option) => [String(option), String(option)] as [string, string])} />
          </div>
        </div>
        {reports.length === 0 ? <div className="p-8 text-center text-gray-400">{'\uC9D1\uACC4\uD560 \uCD94\uCC9C \uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
          <div className="space-y-3 p-4 md:hidden">
            {paginated.map((report, index) => {
              const week1 = report.performance?.week1;
              const month1 = report.performance?.month1;
              const month3 = report.performance?.month3;
              return <article key={`${report.market}-${report.ticker}-${report.broker}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="min-w-0 text-left">
                    <div className="truncate font-semibold text-blue-700">{report.name}</div>
                    <div className="text-xs text-gray-400">{report.ticker} {'\u00B7'} {report.broker}</div>
                  </button>
                  <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="h-7 w-7 text-base" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'\uAE30\uC900\uAC00\uACA9'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(report.basePrice, report.market)}</div></div>
                  <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'\uBAA9\uD45C\uAC00'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(report.targetPrice, report.market)}</div></div>
                </div>
                <div className="mt-3 space-y-2">
                  {[{ label: '1\uC8FC', point: week1 }, { label: '1\uAC1C\uC6D4', point: month1 }, { label: '3\uAC1C\uC6D4', point: month3 }].map(({ label, point }) => {
                    const badge = getStatusBadge(point);
                    return <div key={`${report.ticker}-${label}`} className="rounded-lg bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-700">{label}</div>
                        <span className={`rounded px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className={`mt-2 text-sm font-medium ${getPerformanceTone(point)}`}>{getReturnMetric(point)}</div>
                      <div className="mt-1 text-xs text-gray-500">{getProgressMetric(point)}</div>
                    </div>;
                  })}
                </div>
              </article>;
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{'\uC885\uBAA9'}</th>
                  <th className="px-4 py-3 text-left">{'\uC99D\uAD8C\uC0AC'}</th>
                  <th className="px-4 py-3 text-left">{'\uCD94\uCC9C\uC77C'}</th>
                  <th className="px-4 py-3 text-right">{'\uAE30\uC900\uAC00\uACA9'}</th>
                  <th className="px-4 py-3 text-right">{'\uBAA9\uD45C\uAC00'}</th>
                  <th className="px-4 py-3 text-left">{'1W'}</th>
                  <th className="px-4 py-3 text-left">{'1M'}</th>
                  <th className="px-4 py-3 text-left">{'3M'}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((report, index) => <tr key={`${report.market}-${report.ticker}-${report.broker}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="text-left">
                        <div className="font-medium text-blue-700 hover:underline">{report.name}</div>
                        <div className="text-xs text-gray-400">{report.ticker}</div>
                      </button>
                      <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{report.broker}</td>
                  <td className="px-4 py-3 text-sm">{report.date}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(report.basePrice, report.market)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(report.targetPrice, report.market)}</td>
                  {(['week1', 'month1', 'month3'] as const).map((key) => {
                    const point = report.performance?.[key];
                    const badge = getStatusBadge(point);
                    return <td key={`${report.ticker}-${key}`} className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span>
                        <span className={`text-sm font-medium ${getPerformanceTone(point)}`}>{getReturnMetric(point)}</span>
                        <span className="text-xs text-gray-500">{getProgressMetric(point)}</span>
                      </div>
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="p-4 pt-0">
            <PaginationControls totalCount={reports.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>}
      </div>
    </> : null}
  </div>;
}

function ScorecardGroupCard({ title, items, activeKey, onSelect, selectable = false }: { title: string; items: ScorecardGroup[]; activeKey?: string | null; onSelect?: (key: string) => void; selectable?: boolean }) {
  return <section className="rounded-xl bg-white p-4 shadow-sm">
    <h3 className="mb-4 text-lg font-semibold">{title}</h3>
    <div className="space-y-3">
      {items.length === 0 ? <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-400">{'\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : items.map((item) => {
        const active = selectable && activeKey === item.key;
        const body = <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-400">{'\uB9AC\uD3EC\uD2B8'} {item.reportCount}{'\uAC74'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-green-600">{item.month1.successRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">{'1M \uC131\uACF5\uB960'}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-white p-2"><div className="text-gray-500">{'1W'}</div><div className="mt-1 font-medium text-gray-900">{item.week1.successRate.toFixed(1)}%</div><div className="mt-1 text-red-500">{'\uD558\uB77D'} {item.week1.declineRate.toFixed(1)}%</div></div>
            <div className="rounded bg-white p-2"><div className="text-gray-500">{'1M'}</div><div className="mt-1 font-medium text-gray-900">{item.month1.successRate.toFixed(1)}%</div><div className="mt-1 text-red-500">{'\uD558\uB77D'} {item.month1.declineRate.toFixed(1)}%</div></div>
            <div className="rounded bg-white p-2"><div className="text-gray-500">{'3M'}</div><div className="mt-1 font-medium text-gray-900">{item.month3.successRate.toFixed(1)}%</div><div className="mt-1 text-red-500">{'\uD558\uB77D'} {item.month3.declineRate.toFixed(1)}%</div></div>
          </div>
        </>;

        return selectable ? <button key={`${title}-${item.key}`} type="button" onClick={() => onSelect?.(item.key)} className={`w-full rounded-lg p-4 text-left transition ${active ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
          {body}
        </button> : <div key={`${title}-${item.key}`} className="rounded-lg bg-gray-50 p-4">{body}</div>;
      })}
    </div>
  </section>;
}

function ScorecardReportList({ title, tone, items, onOpenInsight, isSaved, onToggleWatchlist, emptyText }: { title: string; tone: 'up' | 'down'; items: { report: AnalystReport; point?: PerformancePoint }[]; onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void; emptyText: string }) {
  return <section className="rounded-xl border p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h4 className={`text-base font-semibold ${tone === 'up' ? 'text-green-700' : 'text-red-700'}`}>{title}</h4>
      <span className="text-sm text-gray-400">{items.length}{'\uAC74'}</span>
    </div>
    {items.length === 0 ? <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-400">{emptyText}</div> : <div className="space-y-3">
      {items.map(({ report, point }) => <div key={`${title}-${report.market}-${report.ticker}-${report.date}`} className="rounded-lg bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="min-w-0 text-left">
            <div className="truncate font-medium text-blue-700 hover:underline">{report.name}</div>
            <div className="text-xs text-gray-400">{report.ticker} {'\u00B7'} {report.date}</div>
          </button>
          <div className="flex items-center gap-2">
            <FavoriteButton active={isSaved(report.ticker, report.market)} onClick={() => onToggleWatchlist({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} />
            <span className={`text-sm font-semibold ${tone === 'up' ? 'text-green-600' : 'text-red-600'}`}>{point ? formatPct(point.returnPct) : '-'}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded bg-white px-2 py-1">{report.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}</span>
          <span className="rounded bg-white px-2 py-1">{report.broker}</span>
          <span className="rounded bg-white px-2 py-1">{point ? getProgressMetric(point) : '-'}</span>
        </div>
      </div>)}
    </div>}
  </section>;
}

function SimpleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <div className="w-full sm:w-auto"><label className="mb-1 block text-sm text-gray-500">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm sm:min-w-[140px]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function ConsensusTab({ onOpenInsight, isSaved, onToggleWatchlist }: { onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  type ConsensusSortKey = 'name' | 'market' | 'entryScore' | 'brokerCount' | 'priceVsBase' | 'currentPrice' | 'basePrice' | 'avgUpside' | 'reportCount' | 'latestReportDate' | 'brokers';
  const [items, setItems] = useState<AnalystConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState<MarketFilter>('all');
  const [sortBy, setSortBy] = useState<ConsensusSortKey>('latestReportDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { void (async () => {
    const cached = getCachedConsensus(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setItems(cached);
      setItems(await fetchAnalystConsensus(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('\uACF5\uD1B5 \uCD94\uCC9C \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);
  useEffect(() => setPage(1), [days, market, sortBy, sortOrder, pageSize, searchQuery]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) ||
      item.ticker.toLowerCase().includes(q) ||
      item.brokers.join(' ').toLowerCase().includes(q);
  });
  const avgUpside = filteredItems.length ? filteredItems.reduce((sum, item) => sum + item.avgUpside, 0) / filteredItems.length : 0;
  const avgEntryScore = filteredItems.length ? filteredItems.reduce((sum, item) => sum + item.entryScore, 0) / filteredItems.length : 0;
  const topEntryScore = filteredItems.reduce((max, item) => Math.max(max, item.entryScore), 0);
  const sortedItems = [...filteredItems].sort((a, b) => {
    const priceVsBaseA = a.basePrice > 0 ? ((a.currentPrice - a.basePrice) / a.basePrice) * 100 : 0;
    const priceVsBaseB = b.basePrice > 0 ? ((b.currentPrice - b.basePrice) / b.basePrice) * 100 : 0;
    const getValue = (item: AnalystConsensusItem) => {
      switch (sortBy) {
        case 'name': return item.name.toLowerCase();
        case 'market': return item.market;
        case 'entryScore': return item.entryScore;
        case 'brokerCount': return item.brokerCount;
        case 'priceVsBase': return item.basePrice > 0 ? ((item.currentPrice - item.basePrice) / item.basePrice) * 100 : 0;
        case 'currentPrice': return item.currentPrice;
        case 'basePrice': return item.basePrice;
        case 'avgUpside': return item.avgUpside;
        case 'reportCount': return item.reportCount;
        case 'latestReportDate': return new Date(item.latestReportDate).getTime();
        case 'brokers': return item.brokers.join(', ').toLowerCase();
      }
    };

    const av = getValue(a);
    const bv = getValue(b);

    if (typeof av === 'string' && typeof bv === 'string') {
      const compared = av.localeCompare(bv, 'ko');
      if (compared !== 0) return sortOrder === 'desc' ? -compared : compared;
    } else if (av !== bv) {
      return sortOrder === 'desc' ? Number(bv) - Number(av) : Number(av) - Number(bv);
    }

    const fallbackDate = new Date(b.latestReportDate).getTime() - new Date(a.latestReportDate).getTime();
    if (fallbackDate !== 0) return fallbackDate;
    if (b.entryScore !== a.entryScore) return b.entryScore - a.entryScore;
    if (b.brokerCount !== a.brokerCount) return b.brokerCount - a.brokerCount;
    const fallbackPriceVsBase = priceVsBaseB - priceVsBaseA;
    if (fallbackPriceVsBase !== 0) return fallbackPriceVsBase;
    return b.avgUpside - a.avgUpside;
  });
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginated = sortedItems.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key: ConsensusSortKey) => {
    if (sortBy === key) {
      setSortOrder((current) => current === 'desc' ? 'asc' : 'desc');
      return;
    }

    setSortBy(key);
    setSortOrder(key === 'name' || key === 'market' || key === 'brokers' ? 'asc' : 'desc');
  };
  const sortIndicator = (key: ConsensusSortKey) => sortBy === key ? (sortOrder === 'desc' ? '▼' : '▲') : '';
  const renderSortableHeader = (label: string, key: ConsensusSortKey, className: string) => (
    <th className={className}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700">
        <span>{label}</span>
        <span className={`text-[10px] ${sortBy === key ? 'text-gray-700' : 'text-gray-300'}`}>{sortIndicator(key) || '↕'}</span>
      </button>
    </th>
  );

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="종목명, 티커, 증권사 검색..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && <div className="mt-2 text-sm text-gray-500">검색 결과: {filteredItems.length}건</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">{'\uAE30\uAC04'}</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[3, 7, 15, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}{'\uC77C'}</button>)}
          </div>
        </div>
        <div className="min-w-[220px]">
          <SimpleSelect label={'\uC2DC\uC7A5'} value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '\uC804\uCCB4'], ['korea', '\uAD6D\uB0B4'], ['us', '\uD574\uC678']]} />
        </div>
        <div className="text-sm text-gray-400 md:pb-2">{'\uC11C\uB85C \uB2E4\uB978 \uC99D\uAD8C\uC0AC 2\uACF3 \uC774\uC0C1 \uCD94\uCC9C \uC885\uBAA9\uB9CC \uD45C\uC2DC'}</div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      <StatCard label={'\uACF5\uD1B5 \uCD94\uCC9C \uC885\uBAA9'} value={String(filteredItems.length)} />
      <StatCard label={'\uD3C9\uADE0 \uC9C4\uC785 \uC810\uC218'} value={formatScore(avgEntryScore)} accent="text-blue-600" />
      <StatCard label={'\uCD5C\uACE0 \uC9C4\uC785 \uC810\uC218'} value={formatScore(topEntryScore)} accent="text-blue-700" />
      <StatCard label={'\uAD6D\uB0B4 \uC885\uBAA9'} value={String(filteredItems.filter((item) => item.market === 'korea').length)} />
      <StatCard label={'\uD574\uC678 \uC885\uBAA9'} value={String(filteredItems.filter((item) => item.market === 'us').length)} />
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="text-lg font-semibold">{'\uC560\uB110\uB9AC\uC2A4\uD2B8 \uACF5\uD1B5 \uCD94\uCC9C \uC885\uBAA9'}</h2><p className="text-sm text-gray-500">{'\uC120\uD0DD\uD55C \uAE30\uAC04 \uB0B4 \uC5EC\uB7EC \uC99D\uAD8C\uC0AC\uAC00 \uD568\uAED8 \uCD94\uCC9C\uD55C \uC885\uBAA9\uC744 \uCD5C\uC2E0 \uB9AC\uD3EC\uD2B8 \uC77C\uC790 \uC21C\uC73C\uB85C \uBE44\uAD50\uD569\uB2C8\uB2E4.'}</p></div>
      {filteredItems.length > 0 && <div className="flex justify-end px-4 pt-4"><SimpleSelect label={'\uD398\uC774\uC9C0 \uD06C\uAE30'} value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((option) => [String(option), String(option)] as [string, string])} /></div>}
      {filteredItems.length === 0 ? <div className="p-8 text-center text-gray-400">{searchQuery ? '검색 결과가 없습니다.' : '\uC870\uAC74\uC5D0 \uB9DE\uB294 \uACF5\uD1B5 \uCD94\uCC9C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
        <div className="space-y-3 p-4 md:hidden">
          {paginated.map((item) => <article key={`${item.market}-${item.ticker}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="min-w-0 text-left">
                <div className="truncate font-semibold text-blue-700">{item.name}</div>
                <div className="text-xs text-gray-400">{item.ticker}</div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <FavoriteButton active={isSaved(item.ticker, item.market)} onClick={() => onToggleWatchlist({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="h-7 w-7 text-base" />
                <div className="flex items-center gap-1">
                  <span className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">{formatScore(item.entryScore)}</span>
                  <EntryScoreTooltip score={item.entryScore} breakdown={item.entryScoreBreakdown} size="sm" />
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">{'\uAE30\uC900\uAC00 \uB300\uBE44 \uD604\uC7AC\uAC00'}</div><div className={`mt-1 font-semibold ${item.currentPrice <= item.basePrice ? 'text-green-600' : 'text-red-600'}`}>{formatPct(((item.currentPrice - item.basePrice) / item.basePrice) * 100)}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">{'\uD3C9\uADE0 \uBAA9\uD45C\uAC00 \uAD34\uB9AC\uC728'}</div><div className="mt-1 font-semibold text-green-600">{formatPct(item.avgUpside)}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">{'\uD604\uC7AC\uAC00'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.currentPrice, item.market)}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">{'\uAE30\uC900\uAC00\uACA9'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(item.basePrice, item.market)}</div><div className="mt-1 text-[11px] text-gray-400">{item.basePriceDate} {'\uC885\uAC00'}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-[11px] text-gray-500">{'\uCD5C\uADFC \uCD94\uCC9C\uC77C'}</div><div className="mt-1 font-medium text-gray-900">{item.latestReportDate}</div><div className="mt-1 text-[11px] text-gray-400">{'\uB9AC\uD3EC\uD2B8'} {item.reportCount}{'\uAC74'} {'\u00B7'} {item.brokerCount}{'\uACF3'}</div></div>
            </div>
            <div className="mt-3 rounded-lg bg-white p-3 text-xs text-gray-600">
              <div className="font-medium text-gray-700">{'\uC810\uC218 \uAD6C\uC131'}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>{'\uAE30\uC900\uAC00 \uB9E4\uB825'} {item.entryScoreBreakdown.priceVsBase}{'\uC810'}</div>
                <div>{'\uBAA9\uD45C\uAC00 \uC5EC\uB825'} {item.entryScoreBreakdown.targetGap}{'\uC810'}</div>
                <div>{'\uB9AC\uD3EC\uD2B8 \uC218'} {item.entryScoreBreakdown.reportCount}{'\uC810'}</div>
                <div>{'\uACF5\uD1B5\uCD94\uCC9C \uAC15\uB3C4'} {item.entryScoreBreakdown.consensusStrength}{'\uC810'}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">{item.brokers.join(', ')}</div>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                {renderSortableHeader('\uC885\uBAA9', 'name', 'px-4 py-3')}
                {renderSortableHeader('\uC2DC\uC7A5', 'market', 'min-w-[84px] px-4 py-3')}
                {renderSortableHeader('\uC9C4\uC785 \uC810\uC218', 'entryScore', 'min-w-[100px] px-4 py-3 text-right')}
                {renderSortableHeader('\uC99D\uAD8C\uC0AC \uC218', 'brokerCount', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uAE30\uC900\uAC00 \uB300\uBE44 \uD604\uC7AC\uAC00', 'priceVsBase', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uD604\uC7AC\uAC00', 'currentPrice', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uAE30\uC900\uAC00\uACA9', 'basePrice', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uD3C9\uADE0 \uBAA9\uD45C\uAC00 \uAD34\uB9AC\uC728', 'avgUpside', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uB9AC\uD3EC\uD2B8 \uC218', 'reportCount', 'px-4 py-3 text-right')}
                {renderSortableHeader('\uCD5C\uADFC \uCD94\uCC9C\uC77C', 'latestReportDate', 'px-4 py-3')}
                {renderSortableHeader('\uC99D\uAD8C\uC0AC', 'brokers', 'px-4 py-3')}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((item) => <tr key={`${item.market}-${item.ticker}`} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{item.name}</div><div className="text-xs text-gray-400">{item.ticker}</div></button><FavoriteButton active={isSaved(item.ticker, item.market)} onClick={() => onToggleWatchlist({ ticker: item.ticker, name: item.name, market: item.market, category: 'analyst', currentPrice: item.currentPrice })} /></div></td>
                <td className="min-w-[84px] px-4 py-3"><span className={`inline-flex min-w-[44px] justify-center rounded px-2 py-1 text-xs ${item.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{item.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}</span></td>
                <td className="min-w-[100px] px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <span className="inline-flex min-w-[56px] justify-center rounded bg-sky-100 px-2 py-1 text-sm font-semibold text-sky-700">{formatScore(item.entryScore)}</span>
                    <EntryScoreTooltip score={item.entryScore} breakdown={item.entryScoreBreakdown} size="sm" />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium">{item.brokerCount}</td>
                <td className={`px-4 py-3 text-right font-medium ${item.currentPrice <= item.basePrice ? 'text-green-600' : 'text-red-600'}`}>{formatPct(((item.currentPrice - item.basePrice) / item.basePrice) * 100)}</td>
                <td className="px-4 py-3 text-right">{formatPrice(item.currentPrice, item.market)}</td>
                <td className="px-4 py-3 text-right"><div className="font-medium">{formatPrice(item.basePrice, item.market)}</div><div className="text-xs text-gray-400">{item.basePriceDate} {'\uC885\uAC00'}</div></td>
                <td className="px-4 py-3 text-right font-medium text-green-600">{formatPct(item.avgUpside)}</td>
                <td className="px-4 py-3 text-right font-medium">{item.reportCount}</td>
                <td className="px-4 py-3 text-sm">{item.latestReportDate}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.brokers.join(', ')}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="p-4 pt-0"><PaginationControls totalCount={filteredItems.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} /></div>
      </>}
    </div>}
  </div>;
}

function getSectorPhaseLabel(phase: SectorCyclePhase) {
  if (phase === 'recovery') return '회복';
  if (phase === 'expansion') return '확장';
  if (phase === 'slowdown') return '둔화';
  return '침체';
}

function getSectorPhaseBadgeClass(phase: SectorCyclePhase) {
  if (phase === 'recovery') return 'bg-blue-100 text-blue-700';
  if (phase === 'expansion') return 'bg-green-100 text-green-700';
  if (phase === 'slowdown') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function getSectorConfidenceLabel(confidence: SectorCycleConfidence) {
  if (confidence === 'high') return '고신뢰';
  if (confidence === 'medium') return '보통';
  return '저신뢰';
}

function getSectorConfidenceClass(confidence: SectorCycleConfidence) {
  if (confidence === 'high') return 'bg-emerald-50 text-emerald-700';
  if (confidence === 'medium') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-400';
}

function getSectorCardStyle(item: SectorCycleItem) {
  const color = item.phase === 'recovery'
    ? '59, 130, 246'
    : item.phase === 'expansion'
      ? '34, 197, 94'
      : item.phase === 'slowdown'
        ? '245, 158, 11'
        : '239, 68, 68';
  const intensity = Math.min(0.46, 0.12 + item.phaseScore / 220);
  const opacity = item.confidence === 'low' ? Math.max(0.08, intensity - 0.08) : intensity;

  return {
    backgroundColor: `rgba(${color}, ${opacity.toFixed(2)})`,
    borderColor: `rgba(${color}, ${Math.min(0.65, opacity + 0.18).toFixed(2)})`,
  };
}

function SectorCycleTab({ onOpenInsight }: { onOpenInsight: (request: InsightRequest) => void }) {
  const [data, setData] = useState<SectorCycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState<MarketFilter>('all');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  useEffect(() => { void (async () => {
    const cached = getCachedSectorCycle(days, market);
    setLoading(!cached);
    setError(null);
    try {
      if (cached) setData(cached);
      setData(await fetchSectorCycle(days, market));
    } catch (fetchError) {
      console.error(fetchError);
      setError('업종 사이클 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  })(); }, [days, market]);

  useEffect(() => {
    const firstSector = data?.items[0]?.sector || null;
    if (!selectedSector || !data?.items.some((item) => item.sector === selectedSector)) {
      setSelectedSector(firstSector);
    }
  }, [data, selectedSector]);

  const items = data?.items || [];
  const selectedItem = items.find((item) => item.sector === selectedSector) || items[0] || null;
  const recoveryCount = items.filter((item) => item.phase === 'recovery').length;
  const expansionCount = items.filter((item) => item.phase === 'expansion').length;
  const slowdownCount = items.filter((item) => item.phase === 'slowdown').length;
  const contractionCount = items.filter((item) => item.phase === 'contraction').length;

  return <div className="space-y-6">
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="w-full">
          <label className="mb-1 block text-sm text-gray-500">{'기간'}</label>
          <div className="flex flex-wrap overflow-hidden rounded-lg border">
            {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)} className={`flex-1 px-3 py-2 text-sm ${days === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{value}{'일'}</button>)}
          </div>
        </div>
        <SimpleSelect label={'시장'} value={market} onChange={(value) => setMarket(value as MarketFilter)} options={[['all', '전체'], ['korea', '국내'], ['us', '해외']]} />
        <div className="text-sm text-gray-400 md:pb-2">{'최근 리포트 키워드 기준 업종 국면을 색상으로 정리합니다.'}</div>
      </div>
    </div>
    {loading ? <LoadingState /> : error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={'회복 업종'} value={String(recoveryCount)} accent="text-blue-600" />
        <StatCard label={'확장 업종'} value={String(expansionCount)} accent="text-green-600" />
        <StatCard label={'둔화 업종'} value={String(slowdownCount)} accent="text-amber-600" />
        <StatCard label={'침체 업종'} value={String(contractionCount)} accent="text-red-600" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <section className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{'업종 사이클 히트맵'}</h2>
              <p className="mt-1 text-sm text-gray-500">{'업종 카드를 누르면 최근 리포트 근거와 대표 키워드를 확인할 수 있습니다.'}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{'업종'} {items.length}{'개'}</div>
              <div>{'기준일'} {data?.generatedAt ? data.generatedAt.slice(0, 10) : '-'}</div>
            </div>
          </div>
          {items.length === 0 ? <div className="rounded-xl bg-gray-50 p-8 text-center text-gray-400">{'조건에 맞는 업종 사이클 데이터가 없습니다.'}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const isActive = item.sector === selectedItem?.sector;
              return <button
                key={item.sector}
                type="button"
                onClick={() => setSelectedSector(item.sector)}
                className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-sm'} ${item.confidence === 'low' ? 'opacity-80' : ''}`}
                style={getSectorCardStyle(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{item.sector}</div>
                    <div className="mt-1 text-xs text-gray-600">{item.latestReportDate}</div>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium ${getSectorPhaseBadgeClass(item.phase)}`}>{getSectorPhaseLabel(item.phase)}</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-gray-600">{'강도 점수'}</div>
                    <div className="text-2xl font-bold text-gray-900">{item.phaseScore}</div>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <div>{'리포트'} {item.reportCount}{'건'}</div>
                    <div>{getSectorConfidenceLabel(item.confidence)}</div>
                  </div>
                </div>
              </button>;
            })}
          </div>}
        </section>
        <aside className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
          {!selectedItem ? <div className="rounded-xl bg-gray-50 p-8 text-center text-gray-400">{'선택된 업종이 없습니다.'}</div> : <>
            <div className="border-b pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{selectedItem.sector}</h2>
                <span className={`rounded px-2 py-1 text-xs font-medium ${getSectorPhaseBadgeClass(selectedItem.phase)}`}>{getSectorPhaseLabel(selectedItem.phase)}</span>
                <span className={`rounded px-2 py-1 text-xs ${getSectorConfidenceClass(selectedItem.confidence)}`}>{getSectorConfidenceLabel(selectedItem.confidence)}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{'최근 리포트 키워드를 기준으로 업종 국면을 분류했습니다. 저신뢰 업종은 표본 수가 적거나 키워드 일치도가 낮습니다.'}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{'최근 추천일'}</div><div className="mt-1 font-medium text-gray-900">{selectedItem.latestReportDate}</div></div>
                <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{'리포트 수'}</div><div className="mt-1 font-medium text-gray-900">{selectedItem.reportCount}{'건'}</div></div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700">{'대표 키워드'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedItem.keywords.length > 0 ? selectedItem.keywords.map((keyword) => <span key={`${selectedItem.sector}-${keyword}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{keyword}</span>) : <span className="text-sm text-gray-400">{'대표 키워드를 추출하지 못했습니다.'}</span>}
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-3 text-sm font-medium text-gray-700">{'최근 리포트 3건'}</div>
              <div className="space-y-3">
                {selectedItem.recentReports.map((report) => <article key={`${selectedItem.sector}-${report.market}-${report.ticker}-${report.date}-${report.broker}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => onOpenInsight({ ticker: report.ticker, name: report.name, market: report.market, category: 'analyst', currentPrice: report.currentPrice })} className="min-w-0 text-left">
                      <div className="truncate font-medium text-blue-700 hover:underline">{report.name}</div>
                      <div className="mt-1 text-xs text-gray-400">{report.ticker} {'·'} {report.broker} {'·'} {report.date}</div>
                    </button>
                    <span className={`shrink-0 rounded px-2 py-1 text-[11px] ${report.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{report.market === 'korea' ? '국내' : '해외'}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-700">{report.reasonSummary}</p>
                </article>)}
              </div>
            </div>
          </>}
        </aside>
      </div>
    </>}
  </div>;
}

function StockList({ stocks, title, market, category, onOpenInsight, isSaved, onToggleWatchlist }: { stocks: Stock[]; title: string; market: MarketType; category: WatchlistCategory; onOpenInsight: (request: InsightRequest) => void; isSaved: (ticker: string, market: MarketType) => boolean; onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void }) {
  const [sortBy, setSortBy] = useState<'changePercent' | 'volume' | 'currentPrice'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = query.trim().toLowerCase();
  const filtered = stocks.filter((stock) => !q || stock.name.toLowerCase().includes(q) || stock.ticker.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => { const av = a[sortBy] || 0; const bv = b[sortBy] || 0; return sortOrder === 'desc' ? bv - av : av - bv; });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
  const formatVolume = (volume: number) => volume >= 1000000 ? `${(volume / 1000000).toFixed(1)}M` : volume >= 1000 ? `${(volume / 1000).toFixed(1)}K` : volume.toString();

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, sortOrder, pageSize, stocks.length]);

  return <div className="space-y-6">
    <div className="grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,0.8fr))_auto] md:items-end">
      <div className="w-full"><label className="mb-1 block text-sm text-gray-500">{'\uAC80\uC0C9\uC5B4'}</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'\uC885\uBAA9\uBA85 \uB610\uB294 \uD2F0\uCEE4'} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
      <SimpleSelect label={'\uC815\uB82C \uAE30\uC900'} value={sortBy} onChange={(value) => setSortBy(value as 'changePercent' | 'volume' | 'currentPrice')} options={[['changePercent', '\uB4F1\uB77D\uB960'], ['volume', '\uAC70\uB798\uB7C9'], ['currentPrice', '\uD604\uC7AC\uAC00']]} />
      <SimpleSelect label={'\uC815\uB82C \uC21C\uC11C'} value={sortOrder} onChange={(value) => setSortOrder(value as 'asc' | 'desc')} options={[['desc', '\uB192\uC740 \uC21C'], ['asc', '\uB0AE\uC740 \uC21C']]} />
      <div className="flex items-end gap-3 md:justify-self-end"><div className="text-sm text-gray-400">{'\uCD1D'} {filtered.length}{'\uAC74'}</div><SimpleSelect label={'\uD398\uC774\uC9C0 \uD06C\uAE30'} value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={PAGE_SIZE_OPTIONS.map((option) => [String(option), String(option)] as [string, string])} /></div>
    </div>
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b p-4"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-gray-500">{'\uC885\uBAA9\uC744 \uB204\uB974\uBA74 \uAE30\uBCF8 \uC758\uACAC\uACFC \uD575\uC2EC \uC9C0\uD45C\uB97C \uD31D\uC5C5\uC73C\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p></div>
      {stocks.length === 0 ? <div className="p-8 text-center text-gray-400">{'\uB370\uC774\uD130\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : filtered.length === 0 ? <div className="p-8 text-center text-gray-400">{'\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
        <div className="space-y-3 p-4 md:hidden">
          {paginated.map((stock) => <article key={stock.ticker} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
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
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'\uD604\uC7AC\uAC00'}</div><div className="mt-1 font-medium text-gray-900">{formatPrice(stock.currentPrice, market)}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'\uC804\uC77C \uB300\uBE44'}</div><div className={`mt-1 font-medium ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.change >= 0 ? '+' : ''}{market === 'korea' ? Math.round(stock.change).toLocaleString() : stock.change.toFixed(2)}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'\uAC70\uB798\uB7C9'}</div><div className="mt-1 font-medium text-gray-900">{stock.volume ? formatVolume(stock.volume) : '-'}</div></div>
                <div className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{'52\uC8FC \uBC94\uC704'}</div><div className="mt-1 font-medium text-gray-900">{stock.low52w || stock.high52w ? `${formatPrice(stock.low52w || 0, market)} - ${formatPrice(stock.high52w || 0, market)}` : '-'}</div></div>
              </div>
            </button>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3 text-left">{'\uC885\uBAA9'}</th><th className="px-4 py-3 text-right">{'\uD604\uC7AC\uAC00'}</th><th className="px-4 py-3 text-right">{'\uC804\uC77C \uB300\uBE44'}</th><th className="px-4 py-3 text-right">{'\uB4F1\uB77D\uB960'}</th><th className="px-4 py-3 text-right">{'\uAC70\uB798\uB7C9'}</th></tr></thead><tbody className="divide-y">{paginated.map((stock) => <tr key={stock.ticker} className="hover:bg-gray-50"><td className="px-4 py-3"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenInsight({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} className="text-left"><div className="font-medium text-blue-700 hover:underline">{stock.name}</div><div className="text-xs text-gray-400">{stock.ticker}</div></button><FavoriteButton active={isSaved(stock.ticker, market)} onClick={() => onToggleWatchlist({ ticker: stock.ticker, name: stock.name, market, category, currentPrice: stock.currentPrice, changePercent: stock.changePercent, high52w: stock.high52w, low52w: stock.low52w })} /></div></td><td className="px-4 py-3 text-right font-medium">{formatPrice(stock.currentPrice, market)}</td><td className={`px-4 py-3 text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.change >= 0 ? '+' : ''}{market === 'korea' ? Math.round(stock.change).toLocaleString() : stock.change.toFixed(2)}</td><td className={`px-4 py-3 text-right font-medium ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</td><td className="px-4 py-3 text-right text-gray-500">{stock.volume ? formatVolume(stock.volume) : '-'}</td></tr>)}</tbody></table></div>
      </>}
    </div>
    {filtered.length > 0 && <PaginationControls totalCount={sorted.length} page={page} pageSize={pageSize} totalPages={totalPages} onPageChange={setPage} />}
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
        if (!cancelled) setError('\uC885\uBAA9 \uC758\uACAC\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onClose]);

  if (!request) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-3 sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">{request.name}</h2>
            <p className="text-sm text-gray-500">
              {request.ticker} {'\u00B7'} {request.market === 'korea' ? '\uAD6D\uB0B4' : '\uD574\uC678'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteButton
              active={isSaved(request.ticker, request.market)}
              onClick={() =>
                onToggleWatchlist({
                  ticker: request.ticker,
                  name: request.name,
                  market: request.market,
                  category: request.category,
                  currentPrice: request.currentPrice,
                  changePercent: request.changePercent,
                  high52w: request.high52w,
                  low52w: request.low52w,
                })
              }
              className="h-9 w-9 text-xl"
            />
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
            >
              {'\uB2EB\uAE30'}
            </button>
          </div>
        </div>
        <div className="border-b px-4 py-2 sm:px-5">
          <Link
            href={`/stocks/${request.market}/${request.ticker}`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            상세 페이지 열기 →
          </Link>
        </div>
        {loading ? (
          <div className="p-6 sm:p-8">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="p-4 text-red-600 sm:p-6">{error}</div>
        ) : insight ? (
          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            <section className="space-y-3">
              <div className="rounded-xl bg-blue-50 p-4">
                <div className="text-sm text-blue-700">{'\uC694\uC57D \uC758\uACAC'}</div>
                <p className="mt-1 text-sm text-gray-800">{insight.reasonSummary}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-2 text-sm font-medium text-gray-700">{'\uD575\uC2EC \uADFC\uAC70'}</div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {insight.reasonBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <MetricCard
                label={'\uD604\uC7AC\uAC00'}
                value={formatPrice(insight.latestCurrentPrice || request.currentPrice || 0, request.market)}
              />
              <MetricCard
                label={'\uAE30\uC900\uAC00\uACA9'}
                value={formatPrice(insight.latestBasePrice || 0, request.market)}
                subLabel={insight.latestReportDate ? `${insight.latestReportDate} \uC885\uAC00` : undefined}
              />
              <MetricCard label={'\uBAA9\uD45C\uAC00'} value={formatPrice(insight.latestTargetPrice || 0, request.market)} />
              <MetricCard
                label={'\uD3C9\uADE0 \uC0C1\uC2B9\uC5EC\uB825'}
                value={insight.avgUpside !== undefined ? formatPct(insight.avgUpside) : '-'}
                accent="text-green-600"
              />
            </section>
            <section className="rounded-xl border p-4">
              <div className="mb-3 text-sm font-medium text-gray-700">{'\uCD5C\uC2E0 \uB9AC\uD3EC\uD2B8 \uC815\uBCF4'}</div>
              <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  {'\uC99D\uAD8C\uC0AC'}: <span className="font-medium">{insight.latestBroker || '\uC5C6\uC74C'}</span>
                </div>
                <div>
                  {'\uC758\uACAC'}: <span className="font-medium">{insight.latestOpinion || '\uC5C6\uC74C'}</span>
                </div>
                <div>
                  {'\uB9AC\uD3EC\uD2B8 \uC77C\uC790'}: <span className="font-medium">{insight.latestReportDate || '-'}</span>
                </div>
                <div>
                  {'\uB204\uC801 \uB9AC\uD3EC\uD2B8 \uC218'}: <span className="font-medium">{insight.reportCount}</span>
                </div>
              </div>
            </section>
            {insight.relatedReports.length > 0 && (
              <section className="rounded-xl border p-4">
                <div className="mb-3 text-sm font-medium text-gray-700">{'\uAD00\uB828 \uB9AC\uD3EC\uD2B8'}</div>
                <div className="space-y-3">
                  {insight.relatedReports.map((report) => (
                    <div
                      key={`${report.market}-${report.ticker}-${report.broker}-${report.date}`}
                      className="rounded-lg bg-gray-50 p-3"
                    >
                      {report.sourceUrl ? (
                        <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="text-sm font-medium text-blue-700">
                            {report.reportTitle || `${report.broker} \uB9AC\uD3EC\uD2B8`}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {report.date} {'\u00B7'} {report.broker} {'\u00B7'} {report.opinion}
                          </div>
                          <div className="mt-2 text-xs text-gray-400">{'\uB9AC\uD3EC\uD2B8 \uBCF4\uB7EC\uAC00\uAE30'}</div>
                        </a>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-gray-900">
                            {report.reportTitle || `${report.broker} \uB9AC\uD3EC\uD2B8`}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {report.date} {'\u00B7'} {report.broker} {'\u00B7'} {report.opinion}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="grid gap-4 lg:grid-cols-2">
              <InsightSectionCard title={'1. \uC65C \uCD94\uCC9C\uD558\uB294\uC9C0 \uB17C\uB9AC'} section={insight.investmentLogic} />
              <InsightSectionCard title={'2. \uC2E4\uC801 \uCD94\uC815\uCE58 \uBCC0\uD654'} section={insight.estimateRevision} />
              <InsightSectionCard title={'3. \uBC38\uB958\uC5D0\uC774\uC158'} section={insight.valuation} />
              <InsightSectionCard title={'4. \uC5C5\uC885 \uC0AC\uC774\uD074'} section={insight.sectorCycle} />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
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
