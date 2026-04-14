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

type WatchlistItem = {
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  currentPrice?: number;
};

const WATCHLIST_STORAGE_KEY = 'globalpick.watchlist';

function readWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PortfolioTab() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);

  useEffect(() => {
    const items = readWatchlist();
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
    : { label: '-', color: 'text-gray-400' };

  const concentrationLabel = analysis
    ? getConcentrationLabel(analysis.concentrationRisk)
    : { label: '-', color: 'text-gray-400' };

  if (!analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-gray-500">분석 중...</div>
      </div>
    );
  }

  if (analysis.totalCount === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">포트폴리오 분석</h2>
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">관심종목이 없습니다</h3>
          <p className="mt-2 text-sm text-gray-500">
            관심종목을 추가하면 포트폴리오 분석을 시작할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">포트폴리오 분석</h2>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="보유 종목" value={`${analysis.totalCount}종목`} />
        <StatCard
          label="분산도 점수"
          value={`${analysis.diversificationScore}점`}
          accent={diversificationLabel.color}
        />
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">분산도 평가</div>
          <div className={`text-2xl font-bold ${diversificationLabel.color}`}>
            {diversificationLabel.label}
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">집중 리스크</div>
          <div className={`text-2xl font-bold ${concentrationLabel.color}`}>
            {concentrationLabel.label}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sector Pie Chart */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">섹터 배분</h3>
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
                <span className="text-gray-600">{sector.label}</span>
                <span className="font-medium">{sector.weight.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Market Bar Chart */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">시장 배분</h3>
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
                className="flex items-center justify-between rounded-lg bg-gray-50 p-2"
              >
                <span className="text-sm text-gray-700">{market.label}</span>
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
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">개선 제안</h3>
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
                            className="rounded-full bg-white px-2 py-1 text-xs text-gray-600"
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

      {/* Top Holdings */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">보유 종목</h3>
        <div className="space-y-2">
          {analysis.topHoldings.map((holding, idx) => (
            <div
              key={holding.ticker}
              className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                  {idx + 1}
                </span>
                <div>
                  <div className="font-medium text-gray-900">{holding.name}</div>
                  <div className="text-xs text-gray-500">
                    {holding.ticker} | {holding.sector}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900">
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
