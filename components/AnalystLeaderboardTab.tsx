import { useState, useEffect } from 'react';

interface PeriodSummary {
  eligibleCount: number;
  successCount: number;
  declineCount: number;
  pendingCount: number;
  unavailableCount: number;
  successRate: number;
  declineRate: number;
  avgReturnPct: number;
  avgTargetProgressPct: number;
}

interface ScorecardGroup {
  key: string;
  label: string;
  reportCount: number;
  week1: PeriodSummary;
  month1: PeriodSummary;
  month3: PeriodSummary;
}

interface ScorecardResponse {
  summary: {
    overall: ScorecardGroup;
    byBroker: ScorecardGroup[];
    byMarket: ScorecardGroup[];
    bySector: ScorecardGroup[];
  };
}

type SortKey = 'successRate' | 'avgReturnPct' | 'reportCount';
type PeriodKey = 'week1' | 'month1' | 'month3';

export function AnalystLeaderboardTab() {
  const [days, setDays] = useState<number>(90);
  const [market, setMarket] = useState<'all' | 'korea' | 'us'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('successRate');
  const [periodKey, setPeriodKey] = useState<PeriodKey>('month1');
  const [data, setData] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/analyst-scorecard?days=${days}&market=${market}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [days, market]);

  const sortedBrokers = data?.summary.byBroker
    ? [...data.summary.byBroker].sort((a, b) => {
        const aPeriod = a[periodKey];
        const bPeriod = b[periodKey];
        if (sortKey === 'successRate') {
          return bPeriod.successRate - aPeriod.successRate;
        } else if (sortKey === 'avgReturnPct') {
          return bPeriod.avgReturnPct - aPeriod.avgReturnPct;
        } else {
          return b.reportCount - a.reportCount;
        }
      })
    : [];

  const top3 = sortedBrokers.slice(0, 3);
  const restBrokers = sortedBrokers.slice(3);

  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  // 토스 스타일 순위 배지
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-blue-600', text: '1위' };
    if (rank === 2) return { bg: 'bg-gray-600', text: '2위' };
    if (rank === 3) return { bg: 'bg-gray-500', text: '3위' };
    return { bg: 'bg-gray-400', text: `${rank}위` };
  };

  // Top 3 카드 렌더링 (토스 스타일)
  const renderTopCard = (broker: ScorecardGroup, rank: number) => {
    const period = broker[periodKey];
    const badge = getRankBadge(rank);
    const isFirst = rank === 1;

    return (
      <div
        key={broker.key}
        className={`bg-white rounded-2xl border border-gray-200 p-6 ${
          isFirst ? 'shadow-lg' : 'shadow-sm'
        } hover:shadow-md transition-shadow`}
      >
        {/* 순위 배지 */}
        <div className="flex items-center justify-between mb-4">
          <span className={`${badge.bg} text-white text-sm font-bold px-3 py-1 rounded-full`}>
            {badge.text}
          </span>
          <span className="text-sm text-gray-500">{broker.reportCount}개 리포트</span>
        </div>

        {/* 증권사명 */}
        <h3 className={`font-bold text-gray-900 mb-6 ${isFirst ? 'text-2xl' : 'text-xl'}`}>
          {broker.label}
        </h3>

        {/* 핵심 지표 */}
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">성공률</div>
            <div className={`font-bold ${isFirst ? 'text-3xl' : 'text-2xl'} text-blue-600`}>
              {formatPercent(period.successRate)}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div>
              <div className="text-sm text-gray-600 mb-1">평균 수익률</div>
              <div className={`font-bold text-lg ${
                period.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercent(period.avgReturnPct)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">목표가 달성</div>
              <div className="font-bold text-lg text-gray-900">
                {formatPercent(period.avgTargetProgressPct)}
              </div>
            </div>
          </div>

          {isFirst && (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">성공</span>
                <span className="font-semibold text-green-600">{period.successCount}건</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">하락</span>
                <span className="font-semibold text-red-600">{period.declineCount}건</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 나머지 순위 행 렌더링 (토스 스타일)
  const renderRankRow = (broker: ScorecardGroup, rank: number) => {
    const period = broker[periodKey];
    const badge = getRankBadge(rank);

    return (
      <div
        key={broker.key}
        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
      >
        {/* 왼쪽: 순위 + 증권사명 */}
        <div className="flex items-center gap-4">
          <span className={`${badge.bg} text-white text-xs font-bold px-2 py-1 rounded`}>
            {rank}
          </span>
          <div>
            <div className="font-semibold text-gray-900">{broker.label}</div>
            <div className="text-sm text-gray-500">{broker.reportCount}개</div>
          </div>
        </div>

        {/* 오른쪽: 핵심 지표 */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">성공률</div>
            <div className="font-bold text-blue-600">{formatPercent(period.successRate)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">수익률</div>
            <div className={`font-bold ${
              period.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(period.avgReturnPct)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">애널리스트 성과</h2>
        <p className="text-gray-600">신뢰할 수 있는 증권사를 확인하세요</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 기간 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">기간</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
            >
              <option value={30}>30일</option>
              <option value={90}>90일</option>
              <option value={180}>180일</option>
              <option value={365}>1년</option>
            </select>
          </div>

          {/* 시장 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">시장</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as 'all' | 'korea' | 'us')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
            >
              <option value="all">전체</option>
              <option value="korea">한국</option>
              <option value="us">미국</option>
            </select>
          </div>

          {/* 정렬 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">정렬</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
            >
              <option value="successRate">성공률순</option>
              <option value="avgReturnPct">수익률순</option>
              <option value="reportCount">리포트순</option>
            </select>
          </div>

          {/* 평가 기간 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">평가 기준</label>
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
            >
              <option value="week1">1주</option>
              <option value="month1">1개월</option>
              <option value="month3">3개월</option>
            </select>
          </div>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* 로딩 */}
      {loading && !data && (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">불러오는 중...</p>
        </div>
      )}

      {/* Top 3 */}
      {data && top3.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">상위 3개 증권사</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {top3.map((broker, idx) => renderTopCard(broker, idx + 1))}
          </div>
        </div>
      )}

      {/* 전체 순위 */}
      {data && restBrokers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">전체 순위</h3>
          </div>
          <div>
            {restBrokers.map((broker, idx) => renderRankRow(broker, idx + 4))}
          </div>
        </div>
      )}

      {/* 전체 통계 */}
      {data && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">전체 통계</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">리포트</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.summary.overall.reportCount}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">평균 성공률</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatPercent(data.summary.overall[periodKey].successRate)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">평균 수익률</div>
              <div className={`text-2xl font-bold ${
                data.summary.overall[periodKey].avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercent(data.summary.overall[periodKey].avgReturnPct)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">증권사</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.summary.byBroker.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
