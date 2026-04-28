import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis } from 'recharts';
import { StatCard } from './StatCard';
import {
  analyzePortfolio,
  getDiversificationLabel,
  getConcentrationLabel,
  type PortfolioItem,
  type PortfolioAnalysis,
} from '@/lib/portfolio-analyzer';
import { SECTOR_COLORS } from '@/lib/sector-mapping';
import { readWatchlistStorage } from '@/lib/watchlist-storage';

type WatchlistItem = {
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  currentPrice?: number;
};

interface PortfolioTabProps {
  onNavigateToAIPicks?: () => void;
}

export function PortfolioTab({ onNavigateToAIPicks }: PortfolioTabProps = {}) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);

  useEffect(() => {
    const items = readWatchlistStorage<WatchlistItem>();
    setWatchlist(items);

    const portfolioItems: PortfolioItem[] = items.map((item) => ({
      ticker: item.ticker,
      name: item.name,
      market: item.market,
      currentPrice: item.currentPrice,
    }));

    const result = analyzePortfolio(portfolioItems);
    setAnalysis(result);
  }, []);

  const diversificationLabel = analysis
    ? getDiversificationLabel(analysis.diversificationScore)
    : { label: '-', color: 'text-c-text-3' };

  const concentrationLabel = analysis
    ? getConcentrationLabel(analysis.concentrationRisk)
    : { label: '-', color: 'text-c-text-3' };

  if (!analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-c-text-2">분석 중...</div>
      </div>
    );
  }

  if (analysis.totalCount === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-c-text">포트폴리오 분석</h2>
        <div className="rounded-xl bg-c-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-c-surface-2 flex items-center justify-center">
            <svg className="h-8 w-8 text-c-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-c-text">관심종목이 없습니다</h3>
          <p className="mt-2 text-sm text-c-text-2">
            관심종목을 추가하면 포트폴리오 분석을 시작할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-c-text">포트폴리오 분석</h2>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="보유 종목" value={`${analysis.totalCount}종목`} />
        <StatCard
          label="분산도 점수"
          value={`${analysis.diversificationScore}점`}
          accent={diversificationLabel.color}
        />
        <div className="rounded-xl bg-c-surface p-4 shadow-sm">
          <div className="text-sm text-c-text-2">분산도 평가</div>
          <div className={`text-2xl font-bold ${diversificationLabel.color}`}>
            {diversificationLabel.label}
          </div>
        </div>
        <div className="rounded-xl bg-c-surface p-4 shadow-sm">
          <div className="text-sm text-c-text-2">집중 리스크</div>
          <div className={`text-2xl font-bold ${concentrationLabel.color}`}>
            {concentrationLabel.label}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sector Pie Chart */}
        <div className="rounded-xl bg-c-surface p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-c-text-2">섹터 배분</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis.sectorAllocation}
                  dataKey="weight"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ label, weight }) => `${label} ${weight.toFixed(0)}%`}
                  labelLine={false}
                >
                  {analysis.sectorAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, '비중']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.sectorAllocation.map((sector) => (
              <div key={sector.sector} className="flex items-center gap-1 text-xs">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-c-text-2">{sector.label}</span>
                <span className="font-medium">{sector.weight.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Market Bar Chart */}
        <div className="rounded-xl bg-c-surface p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-c-text-2">시장 배분</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analysis.marketAllocation}
                layout="vertical"
                margin={{ left: 50 }}
              >
                <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" width={60} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '비중']} />
                <Bar dataKey="weight" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {analysis.marketAllocation.map((market) => (
              <div
                key={market.market}
                className="flex items-center justify-between rounded-lg bg-c-surface-2 p-2"
              >
                <span className="text-sm text-c-text-2">{market.label}</span>
                <span className="text-sm font-medium">
                  {market.count}종목 ({market.weight.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="rounded-xl bg-c-surface p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-c-text-2">개선 제안</h3>
          <div className="space-y-3">
            {analysis.suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 ${
                  suggestion.severity === 'critical'
                    ? 'bg-red-50 border-l-4 border-red-500'
                    : suggestion.severity === 'warning'
                    ? 'bg-yellow-50 border-l-4 border-yellow-500'
                    : 'bg-blue-50 border-l-4 border-blue-500'
                }`}
              >
                <div className="flex items-start gap-2">
                  {suggestion.severity === 'critical' && (
                    <span className="text-red-500">⚠️</span>
                  )}
                  {suggestion.severity === 'warning' && (
                    <span className="text-yellow-500">⚡</span>
                  )}
                  {suggestion.severity === 'info' && (
                    <span className="text-blue-500">💡</span>
                  )}
                  <div>
                    <p
                      className={`text-sm ${
                        suggestion.severity === 'critical'
                          ? 'text-red-700'
                          : suggestion.severity === 'warning'
                          ? 'text-yellow-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {suggestion.message}
                    </p>
                    {suggestion.tickers && suggestion.tickers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestion.tickers.map((t) => (
                          <span
                            key={t.ticker}
                            className="rounded-full bg-c-surface px-2 py-1 text-xs text-c-text-2"
                          >
                            {t.ticker}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Guide */}
      {(analysis.diversificationScore < 60 || analysis.topHoldings.some(h => h.weight > 15)) && (
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-blue-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900">포트폴리오 개선 가이드</h3>
              <p className="mt-2 text-sm text-blue-700">
                {analysis.diversificationScore < 60 && analysis.topHoldings.some(h => h.weight > 15)
                  ? '분산도가 낮고 일부 종목에 집중되어 있습니다. 리스크를 낮추기 위해 추가 종목 투자를 권장합니다.'
                  : analysis.diversificationScore < 60
                  ? '분산도가 낮습니다. 다양한 섹터의 종목을 추가하여 리스크를 분산시키세요.'
                  : '일부 종목 비중이 높습니다. 15% 이하로 조정하는 것을 권장합니다.'}
              </p>

              {analysis.topHoldings.some(h => h.weight > 15) && (
                <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-orange-900">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    집중도 경고
                  </div>
                  <div className="mt-2 text-sm text-orange-700">
                    다음 종목의 비중이 15%를 초과합니다:
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.topHoldings
                      .filter(h => h.weight > 15)
                      .map(h => (
                        <span key={h.ticker} className="rounded-full bg-c-surface px-3 py-1 text-sm font-medium text-orange-800">
                          {h.name} ({h.weight.toFixed(1)}%)
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {analysis.diversificationScore < 60 && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-c-surface p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    분산투자 제안
                  </div>
                  <div className="mt-2 text-sm text-blue-700">
                    다양한 섹터와 시장의 종목을 추가하면 리스크를 줄이고 안정성을 높일 수 있습니다.
                    {analysis.sectorAllocation.length < 3 && ' 현재 ' + analysis.sectorAllocation.length + '개 섹터에만 투자 중입니다.'}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {onNavigateToAIPicks && (
                  <button
                    onClick={onNavigateToAIPicks}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI 추천으로 보완하기
                  </button>
                )}
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-2 rounded-lg border border-c-border bg-c-surface px-4 py-2.5 text-sm font-medium text-c-text-2 transition hover:bg-c-surface-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  리밸런싱 가이드 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Holdings */}
      <div className="rounded-xl bg-c-surface p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-c-text-2">보유 종목</h3>
        <div className="space-y-2">
          {analysis.topHoldings.map((holding, idx) => (
            <div
              key={holding.ticker}
              className="flex items-center justify-between rounded-lg bg-c-surface-2 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-c-border text-sm font-medium text-c-text-2">
                  {idx + 1}
                </span>
                <div>
                  <div className="font-medium text-c-text">{holding.name}</div>
                  <div className="text-xs text-c-text-2">
                    {holding.ticker} | {holding.sector}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-c-text">
                  {holding.weight.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
