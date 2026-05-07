import { useEffect, useState, useCallback } from 'react';
import { StatCard } from './StatCard';
import { LoadingState } from './LoadingState';
import { EntryScoreTooltip } from './EntryScoreTooltip';
import { addTrade, getTrades, removeTrade, computePnl } from '../lib/trade-journal';
import type { TradeRecord } from '../lib/analyst-types';

type MarketType = 'korea' | 'us';
type RiskLevel = 'low' | 'medium' | 'high';
type TimeHorizon = '1-3mo' | '3-12mo';

interface AiPickExitConditions {
  targetPriceTakeProfit: number;
  timeHorizonDays: number;
  stopLossPct: number;
}

interface AIPick {
  ticker: string;
  name: string;
  market: MarketType;
  entryScore: number;
  entryScoreBreakdown: {
    priceVsBase: number;
    targetGap: number;
    reportCount: number;
    consensusStrength: number;
  };
  brokerCount: number;
  brokers: string[];
  avgUpside: number;
  avgTargetPrice: number;
  currentPrice: number;
  basePrice: number;
  basePriceDate: string;
  targetProgressPct: number;
  recommendedPositionSize: number;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  thesis: string;
  brokerSuccessRate: number;
  exitConditions: AiPickExitConditions;
}

interface AIPicksResponse {
  picks: AIPick[];
  criteria: {
    minEntryScore: number;
    minBrokerCount: number;
    maxDays: number;
  };
  generatedAt: string;
  summary: {
    totalCandidates: number;
    selectedCount: number;
    avgEntryScore: number;
    avgBrokerCount: number;
    historicalSuccessRate: number;
    avgHistoricalReturnPct: number;
    completedReportCount: number;
  };
}

type InsightRequest = {
  ticker: string;
  name: string;
  market: MarketType;
  category: 'stock' | 'etf' | 'analyst';
  currentPrice?: number;
};

type WatchlistItem = {
  ticker: string;
  name: string;
  market: MarketType;
  category: 'stock' | 'etf' | 'analyst';
  currentPrice?: number;
};

const formatPrice = (price: number, market: MarketType) =>
  market === 'korea'
    ? `${Math.round(price).toLocaleString()}원`
    : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const getRiskLevelBadge = (riskLevel: RiskLevel) => {
  switch (riskLevel) {
    case 'low':
      return { label: '낮음', className: 'bg-c-positive-bg text-c-positive' };
    case 'medium':
      return { label: '보통', className: 'bg-c-warning-bg text-c-warning' };
    case 'high':
      return { label: '높음', className: 'bg-c-negative-bg text-c-negative' };
  }
};

const getEntryScoreBadge = (score: number) => {
  if (score >= 80) {
    return { className: 'bg-c-positive-bg text-c-positive' };
  }
  return { className: 'bg-c-warning-bg text-c-warning' };
};

const getTimeHorizonLabel = (horizon: TimeHorizon) =>
  horizon === '1-3mo' ? '1-3개월' : '3-12개월';

function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-lg ${active ? 'text-yellow-500' : 'text-c-text-3 hover:text-yellow-400'}`}
      aria-label={active ? '관심 종목에서 제거' : '관심 종목에 추가'}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

function TargetProgressBar({ currentPrice, basePrice, targetPrice, progressPct }: {
  currentPrice: number;
  basePrice: number;
  targetPrice: number;
  progressPct: number;
}) {
  const clamped = Math.min(100, Math.max(0, progressPct));
  const isNegative = progressPct < 0;
  const barColor = isNegative ? 'bg-c-negative' : progressPct >= 100 ? 'bg-c-positive' : 'bg-c-accent';

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-c-text-2">
        <span>목표가 진행률</span>
        <span className={progressPct >= 100 ? 'font-semibold text-c-positive' : isNegative ? 'text-c-negative' : 'text-c-text'}>
          {progressPct > 0 ? '+' : ''}{progressPct}%
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-c-border">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-c-text-3">
        <span>{formatPrice(basePrice, 'korea').replace('원', '')} (기준)</span>
        <span>{formatPrice(currentPrice, 'korea').replace('원', '')} (현재)</span>
        <span>{formatPrice(targetPrice, 'korea').replace('원', '')} (목표)</span>
      </div>
    </div>
  );
}

function ExitConditionsBox({ exit, timeHorizon }: { exit: AiPickExitConditions; timeHorizon: TimeHorizon }) {
  return (
    <div className="mb-4 rounded-lg border border-c-border bg-c-surface-2 p-3">
      <div className="mb-2 text-xs font-semibold text-c-text">매도 신호 조건</div>
      <ul className="space-y-1.5 text-xs text-c-text-2">
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 shrink-0 text-c-positive">①</span>
          <span>
            목표가 달성 시 즉시 매도
            <span className="ml-1 font-medium text-c-text">
              ({formatPrice(exit.targetPriceTakeProfit, 'korea')})
            </span>
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 shrink-0 text-c-warning">②</span>
          <span>
            리포트 기준 <span className="font-medium text-c-text">{getTimeHorizonLabel(timeHorizon)}</span> 경과 시 매도 검토
            <span className="ml-1 text-c-text-3">({exit.timeHorizonDays}일)</span>
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 shrink-0 text-c-negative">③</span>
          <span>
            현재가 대비 <span className="font-medium text-c-negative">{exit.stopLossPct}%</span> 이하 → 손절 재검토
          </span>
        </li>
      </ul>
    </div>
  );
}

function TradeJournalSection({ picks }: { picks: AIPick[] }) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [recordedTickers, setRecordedTickers] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const active = getTrades();
    setTrades(active);
    setRecordedTickers(new Set(active.map((t) => `${t.market}:${t.ticker}`)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRecord = (pick: AIPick) => {
    addTrade({
      ticker: pick.ticker,
      name: pick.name,
      market: pick.market,
      buyPrice: pick.currentPrice,
      targetPrice: pick.avgTargetPrice,
      entryScore: pick.entryScore,
      timeHorizon: pick.timeHorizon,
      exitConditions: pick.exitConditions,
    });
    refresh();
    showToast(`${pick.name} 매수 기록 완료`);
  };

  const handleRemove = (id: string) => {
    removeTrade(id);
    refresh();
  };

  const activePicks = picks.filter((p) => !recordedTickers.has(`${p.market}:${p.ticker}`));
  const recordedPicks = picks.filter((p) => recordedTickers.has(`${p.market}:${p.ticker}`));

  const profitCount = trades.filter((t) => {
    const pick = picks.find((p) => p.ticker === t.ticker && p.market === t.market);
    if (!pick) return false;
    return computePnl(t, pick.currentPrice).pnlPct > 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Buttons on pick cards — injected via parent; here show journal section */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-c-border bg-c-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-c-text">내 투자 현황</h3>
            <div className="text-xs text-c-text-2">
              {trades.length}건 추적 중 · 수익 중 {profitCount}건
            </div>
          </div>
          <div className="space-y-3">
            {trades.map((trade) => {
              const pick = picks.find((p) => p.ticker === trade.ticker && p.market === trade.market);
              const currentPrice = pick?.currentPrice ?? trade.buyPrice;
              const pnl = computePnl(trade, currentPrice);

              return (
                <div
                  key={trade.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                    pnl.isStopLoss
                      ? 'border-c-negative bg-c-negative-bg'
                      : pnl.isTargetHit
                      ? 'border-c-positive bg-c-positive-bg'
                      : 'border-c-border bg-c-surface-2'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-c-text">{trade.name}</span>
                      {pnl.isTargetHit && <span className="text-c-positive text-xs">🎯 목표 달성</span>}
                      {pnl.isStopLoss && <span className="text-c-negative text-xs">⚠️ 손절 기준 도달</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-c-text-2">
                      <span>매수 {formatPrice(trade.buyPrice, trade.market)}</span>
                      <span>→ 현재 {formatPrice(currentPrice, trade.market)}</span>
                      <span className={pnl.pnlPct >= 0 ? 'font-semibold text-c-positive' : 'font-semibold text-c-negative'}>
                        {formatPct(pnl.pnlPct)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-c-border">
                      <div
                        className={`h-full rounded-full ${pnl.pnlPct >= 0 ? 'bg-c-positive' : 'bg-c-negative'}`}
                        style={{ width: `${pnl.targetProgressPct}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] text-c-text-3">
                      목표까지 {pnl.targetProgressPct}% 달성 · {pnl.daysLeft}일 남음
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(trade.id)}
                    className="shrink-0 rounded p-1 text-c-text-3 hover:bg-c-surface hover:text-c-negative"
                    aria-label="기록 삭제"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-c-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Expose record handler via context-like hack — we pass it back up */}
      <div style={{ display: 'none' }} data-recorded-tickers={Array.from(recordedTickers).join(',')} />
    </div>
  );
}

export function AIPicksTab({
  onOpenInsight,
  isSaved,
  onToggleWatchlist,
}: {
  onOpenInsight: (request: InsightRequest) => void;
  isSaved: (ticker: string, market: MarketType) => boolean;
  onToggleWatchlist: (item: Omit<WatchlistItem, 'savedAt'>) => void;
}) {
  const [data, setData] = useState<AIPicksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/ai-picks');
        if (!response.ok) throw new Error('Failed to fetch AI picks');
        const json = (await response.json()) as AIPicksResponse;
        setData(json);
      } catch (fetchError) {
        console.error(fetchError);
        setError('AI 추천 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
    setTrades(getTrades());
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRecord = (pick: AIPick) => {
    addTrade({
      ticker: pick.ticker,
      name: pick.name,
      market: pick.market,
      buyPrice: pick.currentPrice,
      targetPrice: pick.avgTargetPrice,
      entryScore: pick.entryScore,
      timeHorizon: pick.timeHorizon,
      exitConditions: pick.exitConditions,
    });
    setTrades(getTrades());
    showToast(`${pick.name} 매수 기록 완료`);
  };

  const handleRemoveTrade = (id: string) => {
    removeTrade(id);
    setTrades(getTrades());
  };

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="rounded-lg bg-c-negative-bg p-4 text-c-negative">{error}</div>
    );
  }

  if (!data) return null;

  const { picks, criteria, summary } = data;
  const recordedSet = new Set(trades.map((t) => `${t.market}:${t.ticker}`));
  const profitCount = trades.filter((t) => {
    const pick = picks.find((p) => p.ticker === t.ticker && p.market === t.market);
    if (!pick) return false;
    return computePnl(t, pick.currentPrice).pnlPct > 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Success Rate Banner */}
      {summary.completedReportCount > 0 && (
        <div className="rounded-xl border border-c-positive bg-c-positive-bg px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-c-positive">
                {summary.historicalSuccessRate}%
              </span>
              <span className="text-sm text-c-positive opacity-80">실제 승률</span>
            </div>
            <div className="h-8 w-px bg-c-positive opacity-20 hidden sm:block" />
            <div className="text-sm text-c-text-2">
              평균 수익&nbsp;
              <span className={`font-semibold ${summary.avgHistoricalReturnPct >= 0 ? 'text-c-positive' : 'text-c-negative'}`}>
                {formatPct(summary.avgHistoricalReturnPct)}
              </span>
              &nbsp;(1개월 기준)
            </div>
            <div className="text-xs text-c-text-3">
              완료된 추천 {summary.completedReportCount}건 기반
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="rounded-xl border border-c-border bg-c-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-c-text">AI가 선정한 오늘의 유망 종목</h2>
            <p className="mt-2 text-sm text-c-text-2">
              Entry Score {criteria.minEntryScore}점 이상, {criteria.minBrokerCount}개 이상 증권사 추천 종목을 자동 선별했습니다
            </p>
          </div>
          <div className="text-right text-xs text-c-text-3">
            <div>마지막 업데이트</div>
            <div>{new Date(data.generatedAt).toLocaleString('ko-KR')}</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="AI 추천 종목" value={String(summary.selectedCount)} />
        <StatCard label="평균 Entry Score" value={`${summary.avgEntryScore}점`} accent="text-c-accent" />
        <StatCard label="평균 증권사 수" value={`${summary.avgBrokerCount}개`} />
        <StatCard label="전체 후보 종목" value={String(summary.totalCandidates)} />
      </div>

      {/* My Portfolio Section */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-c-border bg-c-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-c-text">내 투자 현황</h3>
            <div className="text-xs text-c-text-2">
              {trades.length}건 추적 중 · 수익 중 {profitCount}건
            </div>
          </div>
          <div className="space-y-3">
            {trades.map((trade) => {
              const pick = picks.find((p) => p.ticker === trade.ticker && p.market === trade.market);
              const currentPrice = pick?.currentPrice ?? trade.buyPrice;
              const pnl = computePnl(trade, currentPrice);

              return (
                <div
                  key={trade.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                    pnl.isStopLoss
                      ? 'border-c-negative bg-c-negative-bg'
                      : pnl.isTargetHit
                      ? 'border-c-positive bg-c-positive-bg'
                      : 'border-c-border bg-c-surface-2'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-c-text">{trade.name}</span>
                      {pnl.isTargetHit && <span className="text-xs text-c-positive">🎯 목표 달성</span>}
                      {pnl.isStopLoss && !pnl.isTargetHit && <span className="text-xs text-c-negative">⚠️ 손절 기준 도달</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-c-text-2">
                      <span>매수 {formatPrice(trade.buyPrice, trade.market)}</span>
                      <span>→ 현재 {formatPrice(currentPrice, trade.market)}</span>
                      <span className={pnl.pnlPct >= 0 ? 'font-semibold text-c-positive' : 'font-semibold text-c-negative'}>
                        {formatPct(pnl.pnlPct)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-c-border">
                      <div
                        className={`h-full rounded-full ${pnl.pnlPct >= 0 ? 'bg-c-positive' : 'bg-c-negative'}`}
                        style={{ width: `${pnl.targetProgressPct}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] text-c-text-3">
                      목표까지 {pnl.targetProgressPct}% 달성 · {pnl.daysLeft}일 남음
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTrade(trade.id)}
                    className="shrink-0 rounded p-1 text-c-text-3 hover:bg-c-surface hover:text-c-negative"
                    aria-label="기록 삭제"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Picks Grid */}
      {picks.length === 0 ? (
        <div className="rounded-xl border border-c-border bg-c-surface p-8 text-center">
          <div className="mb-4 text-4xl">📊</div>
          <h3 className="mb-2 text-lg font-semibold text-c-text">오늘은 AI 추천 기준을 충족하는 종목이 없습니다</h3>
          <p className="text-sm text-c-text-2">
            Entry Score {criteria.minEntryScore}점 이상, {criteria.minBrokerCount}개 증권사 이상 추천, {criteria.maxDays}일 이내 리포트 조건이 필요합니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {picks.map((pick) => {
            const entryScoreBadge = getEntryScoreBadge(pick.entryScore);
            const riskBadge = getRiskLevelBadge(pick.riskLevel);
            const isRecorded = recordedSet.has(`${pick.market}:${pick.ticker}`);

            return (
              <article
                key={`${pick.market}-${pick.ticker}`}
                className="rounded-xl border border-c-border bg-c-surface p-5 shadow-sm transition hover:shadow-md"
              >
                {/* Header: Stock name + Entry Score */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenInsight({
                          ticker: pick.ticker,
                          name: pick.name,
                          market: pick.market,
                          category: 'analyst',
                          currentPrice: pick.currentPrice,
                        })
                      }
                      className="text-left"
                    >
                      <h3 className="truncate text-lg font-bold text-c-accent hover:underline">
                        {pick.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-c-text-2">
                        <span>{pick.ticker}</span>
                        <span>·</span>
                        <span className="rounded bg-c-surface-2 px-2 py-0.5">
                          {pick.market === 'korea' ? '국내' : '해외'}
                        </span>
                        <span>·</span>
                        <span>증권사 승률 <strong>{pick.brokerSuccessRate}%</strong></span>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${entryScoreBadge.className}`}>
                        {pick.entryScore}점
                      </span>
                      <EntryScoreTooltip
                        score={pick.entryScore}
                        breakdown={pick.entryScoreBreakdown}
                        size="sm"
                      />
                    </div>
                    <FavoriteButton
                      active={isSaved(pick.ticker, pick.market)}
                      onClick={() =>
                        onToggleWatchlist({
                          ticker: pick.ticker,
                          name: pick.name,
                          market: pick.market,
                          category: 'analyst',
                          currentPrice: pick.currentPrice,
                        })
                      }
                    />
                  </div>
                </div>

                {/* AI Thesis */}
                <div className="mb-3 rounded-lg bg-c-accent-bg p-3">
                  <div className="mb-1 text-xs font-semibold text-c-text">AI 추천 이유</div>
                  <p className="text-sm text-c-text-2">{pick.thesis}</p>
                </div>

                {/* Target Progress Bar */}
                {pick.basePrice > 0 && (
                  <TargetProgressBar
                    currentPrice={pick.currentPrice}
                    basePrice={pick.basePrice}
                    targetPrice={pick.avgTargetPrice}
                    progressPct={pick.targetProgressPct}
                  />
                )}

                {/* Key Metrics */}
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-c-text-2">현재가</div>
                    <div className="mt-1 font-semibold text-c-text">
                      {formatPrice(pick.currentPrice, pick.market)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-c-text-2">목표가 (평균)</div>
                    <div className="mt-1 font-semibold text-c-text">
                      {formatPrice(pick.avgTargetPrice, pick.market)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-c-text-2">상승여력</div>
                    <div className="mt-1 font-semibold text-c-positive">
                      {formatPct(pick.avgUpside)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-c-text-2">증권사</div>
                    <div className="mt-1 font-semibold text-c-text">{pick.brokerCount}개</div>
                  </div>
                </div>

                {/* Exit Conditions */}
                <ExitConditionsBox exit={pick.exitConditions} timeHorizon={pick.timeHorizon} />

                {/* Badges: Risk, Position Size, Time Horizon */}
                <div className="mb-4 flex flex-wrap gap-2 border-t border-c-border pt-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadge.className}`}>
                    리스크: {riskBadge.label}
                  </span>
                  <span className="rounded-full bg-c-info-bg px-2.5 py-1 text-xs font-medium text-c-info">
                    포트폴리오의 {pick.recommendedPositionSize}%
                  </span>
                  <span className="rounded-full bg-c-surface-2 px-2.5 py-1 text-xs font-medium text-c-text-2">
                    {getTimeHorizonLabel(pick.timeHorizon)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenInsight({
                        ticker: pick.ticker,
                        name: pick.name,
                        market: pick.market,
                        category: 'analyst',
                        currentPrice: pick.currentPrice,
                      })
                    }
                    className="flex-1 rounded-lg border border-c-accent py-2.5 text-sm font-semibold text-c-accent transition hover:bg-c-accent-bg"
                  >
                    상세 정보
                  </button>
                  <button
                    type="button"
                    disabled={isRecorded}
                    onClick={() => handleRecord(pick)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                      isRecorded
                        ? 'cursor-default bg-c-surface-2 text-c-text-3'
                        : 'bg-c-accent text-white hover:opacity-90'
                    }`}
                  >
                    {isRecorded ? '기록됨' : '매수 기록'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Info Footer */}
      <div className="rounded-lg border border-c-border bg-c-surface-2 p-4 text-sm text-c-text-2">
        <div className="mb-2 font-semibold text-c-text">💡 AI 추천 기준</div>
        <ul className="space-y-1">
          <li>• Entry Score {criteria.minEntryScore}점 이상 (강력한 매수 신호)</li>
          <li>• {criteria.minBrokerCount}개 이상 증권사 동시 추천 (컨센서스 강도)</li>
          <li>• 최근 {criteria.maxDays}일 이내 발행된 리포트 (신선도)</li>
          <li>• 포지션 사이징: 리스크에 따라 5-15% 자동 계산</li>
          <li>• 매도 조건: ① 목표가 달성 ② 보유기간 초과 ③ -7% 손절</li>
        </ul>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-c-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
