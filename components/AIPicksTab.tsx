import { useEffect, useState } from 'react';
import { StatCard } from './StatCard';
import { LoadingState } from './LoadingState';
import { EntryScoreTooltip } from './EntryScoreTooltip';

type MarketType = 'korea' | 'us';
type RiskLevel = 'low' | 'medium' | 'high';
type TimeHorizon = '1-3mo' | '3-12mo';

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
  recommendedPositionSize: number;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  thesis: string;
  brokerSuccessRate: number;
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
      return { label: '낮음', className: 'bg-green-100 text-green-700' };
    case 'medium':
      return { label: '보통', className: 'bg-yellow-100 text-yellow-700' };
    case 'high':
      return { label: '높음', className: 'bg-red-100 text-red-700' };
  }
};

const getEntryScoreBadge = (score: number) => {
  if (score >= 80) {
    return { className: 'bg-green-100 text-green-700' };
  }
  return { className: 'bg-yellow-100 text-yellow-700' };
};

const getTimeHorizonLabel = (horizon: TimeHorizon) => {
  return horizon === '1-3mo' ? '1-3개월' : '3-12개월';
};

function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-lg ${active ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
      aria-label={active ? '관심 종목에서 제거' : '관심 종목에 추가'}
    >
      {active ? '★' : '☆'}
    </button>
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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/ai-picks');
        if (!response.ok) {
          throw new Error('Failed to fetch AI picks');
        }
        const json = (await response.json()) as AIPicksResponse;
        setData(json);
      } catch (fetchError) {
        console.error(fetchError);
        setError('AI 추천 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { picks, criteria, summary } = data;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI가 선정한 오늘의 유망 종목</h2>
            <p className="mt-2 text-sm text-gray-600">
              Entry Score {criteria.minEntryScore}점 이상, {criteria.minBrokerCount}개 이상 증권사 추천 종목을 자동 선별했습니다
            </p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <div>마지막 업데이트</div>
            <div>{new Date(data.generatedAt).toLocaleString('ko-KR')}</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="AI 추천 종목" value={String(summary.selectedCount)} />
        <StatCard label="평균 Entry Score" value={`${summary.avgEntryScore}점`} accent="text-blue-600" />
        <StatCard label="평균 증권사 수" value={`${summary.avgBrokerCount}개`} />
        <StatCard label="전체 후보 종목" value={String(summary.totalCandidates)} />
      </div>

      {/* Picks Grid */}
      {picks.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <div className="mb-4 text-4xl">📊</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">오늘은 AI 추천 기준을 충족하는 종목이 없습니다</h3>
          <p className="text-sm text-gray-500">
            Entry Score {criteria.minEntryScore}점 이상, {criteria.minBrokerCount}개 증권사 이상 추천, {criteria.maxDays}일 이내 리포트 조건이 필요합니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {picks.map((pick) => {
            const entryScoreBadge = getEntryScoreBadge(pick.entryScore);
            const riskBadge = getRiskLevelBadge(pick.riskLevel);

            return (
              <article
                key={`${pick.market}-${pick.ticker}`}
                className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md"
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
                      <h3 className="truncate text-lg font-bold text-blue-700 hover:underline">
                        {pick.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span>{pick.ticker}</span>
                        <span>·</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {pick.market === 'korea' ? '국내' : '해외'}
                        </span>
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
                <div className="mb-4 rounded-lg bg-blue-50 p-3">
                  <div className="mb-1 text-xs font-semibold text-blue-900">AI 추천 이유</div>
                  <p className="text-sm text-blue-700">{pick.thesis}</p>
                </div>

                {/* Key Metrics */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">현재가</div>
                    <div className="mt-1 font-semibold text-gray-900">
                      {formatPrice(pick.currentPrice, pick.market)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">목표가 (평균)</div>
                    <div className="mt-1 font-semibold text-gray-900">
                      {formatPrice(pick.avgTargetPrice, pick.market)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">상승여력</div>
                    <div className="mt-1 font-semibold text-green-600">
                      {formatPct(pick.avgUpside)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">증권사</div>
                    <div className="mt-1 font-semibold text-gray-900">{pick.brokerCount}개</div>
                  </div>
                </div>

                {/* Badges: Risk, Position Size, Time Horizon */}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadge.className}`}>
                    리스크: {riskBadge.label}
                  </span>
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                    포트폴리오의 {pick.recommendedPositionSize}%
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {getTimeHorizonLabel(pick.timeHorizon)}
                  </span>
                </div>

                {/* Action Button */}
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
                  className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  상세 정보 보기
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Info Footer */}
      <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
        <div className="mb-2 font-semibold text-gray-900">💡 AI 추천 기준</div>
        <ul className="space-y-1">
          <li>• Entry Score {criteria.minEntryScore}점 이상 (강력한 매수 신호)</li>
          <li>• {criteria.minBrokerCount}개 이상 증권사 동시 추천 (컨센서스 강도)</li>
          <li>• 최근 {criteria.maxDays}일 이내 발행된 리포트 (신선도)</li>
          <li>• 포지션 사이징: 리스크에 따라 5-15% 자동 계산</li>
        </ul>
      </div>
    </div>
  );
}
