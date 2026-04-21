import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';

interface TopMover {
  ticker: string;
  name: string;
  market: string;
  currentBrokerCount: number;
  brokerCountChange: number;
  currentEntryScore: number;
  entryScoreChange: number;
  currentAvgUpside: number;
  avgUpsideChange: number;
  trend: 'strengthening' | 'weakening' | 'stable';
}

interface TopMoversResponse {
  strengthening: TopMover[];
  weakening: TopMover[];
}

interface TimelinePoint {
  date: string;
  brokerCount: number;
  avgUpside: number;
  entryScore: number;
  avgTargetPrice: number;
  currentPrice: number;
  change: {
    brokerCount: number;
    avgUpside: number;
    entryScore: number;
    avgTargetPrice: number;
  } | null;
}

interface HistoryResponse {
  ticker: string;
  name: string;
  market: string;
  history: TimelinePoint[];
}

export default function ConsensusChangesTab() {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [movers, setMovers] = useState<TopMoversResponse | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch top movers
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/consensus-latest-changes`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMovers({
            strengthening: data.strengthening || [],
            weakening: data.weakening || [],
          });
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [period]);

  // Fetch timeline when ticker is selected
  useEffect(() => {
    if (!selectedTicker) {
      setTimeline(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/consensus-history?ticker=${selectedTicker}&days=${period}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTimeline(data);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedTicker, period]);

  const formatChange = (change: number) => {
    if (change > 0) return `+${change}`;
    return change.toString();
  };

  const renderHeroCard = (mover: TopMover, type: 'strengthening' | 'weakening') => {
    const isStrengthening = type === 'strengthening';
    const gradientBg = isStrengthening
      ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600'
      : 'bg-gradient-to-br from-rose-500 via-pink-500 to-orange-600';
    const glowShadow = isStrengthening
      ? 'shadow-emerald-500/30'
      : 'shadow-rose-500/30';

    return (
      <div
        key={mover.ticker}
        className={`relative p-8 rounded-2xl text-white cursor-pointer transition-all duration-500 hover:scale-[1.02] ${gradientBg} shadow-2xl ${glowShadow} ${
          selectedTicker === mover.ticker ? 'ring-4 ring-white ring-offset-4' : ''
        }`}
        onClick={() => setSelectedTicker(mover.ticker)}
        style={{
          animation: 'slideInUp 0.6s ease-out',
        }}
      >
        {/* Overlay Pattern */}
        <div className="absolute inset-0 bg-white/5 rounded-2xl backdrop-blur-sm"></div>

        <div className="relative z-10">
          {/* Label */}
          <div className="flex items-center gap-2 mb-3">
            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-mono font-semibold uppercase tracking-wider">
              {isStrengthening ? '최고 강화' : '최대 약화'}
            </div>
            <div className="text-2xl">
              {isStrengthening ? '📈' : '📉'}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl md:text-5xl font-bold mb-2 leading-tight">{mover.name}</h2>
          <div className="text-white/80 font-mono text-lg mb-6">
            {mover.ticker} {mover.market === 'korea' ? '🇰🇷' : '🇺🇸'}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-6">
            <div className="backdrop-blur-md bg-white/10 rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">증권사</div>
              <div className="text-3xl font-bold font-mono">{mover.currentBrokerCount}</div>
              <div className={`text-sm font-semibold mt-1 ${mover.brokerCountChange > 0 ? 'text-green-200' : 'text-red-200'}`}>
                {formatChange(mover.brokerCountChange)}
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/10 rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">Entry Score</div>
              <div className="text-3xl font-bold font-mono">{mover.currentEntryScore}</div>
              <div className={`text-sm font-semibold mt-1 ${mover.entryScoreChange > 0 ? 'text-green-200' : 'text-red-200'}`}>
                {formatChange(mover.entryScoreChange)}
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/10 rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">상승여력</div>
              <div className="text-3xl font-bold font-mono">{mover.currentAvgUpside.toFixed(1)}%</div>
              <div className={`text-sm font-semibold mt-1 ${mover.avgUpsideChange > 0 ? 'text-green-200' : 'text-red-200'}`}>
                {mover.avgUpsideChange > 0 ? '+' : ''}{mover.avgUpsideChange.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompactCard = (mover: TopMover, type: 'strengthening' | 'weakening', index: number) => {
    const isStrengthening = type === 'strengthening';
    const bgGradient = isStrengthening
      ? 'from-emerald-50 to-teal-50'
      : 'from-rose-50 to-orange-50';
    const borderColor = isStrengthening ? 'border-emerald-200' : 'border-rose-200';
    const accentColor = isStrengthening ? 'text-emerald-700' : 'text-rose-700';

    return (
      <div
        key={mover.ticker}
        className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br ${bgGradient} ${borderColor} ${
          selectedTicker === mover.ticker ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        }`}
        onClick={() => setSelectedTicker(mover.ticker)}
        style={{
          animation: `slideInUp 0.4s ease-out ${index * 0.1}s both`,
        }}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-bold text-lg">{mover.name}</div>
            <div className="text-sm text-gray-600 font-mono">
              {mover.ticker} {mover.market === 'korea' ? '🇰🇷' : '🇺🇸'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-gray-500 text-xs">증권사</div>
            <div className="font-bold font-mono">
              {mover.currentBrokerCount}{' '}
              <span className={mover.brokerCountChange > 0 ? 'text-green-600' : 'text-red-600'}>
                ({formatChange(mover.brokerCountChange)})
              </span>
            </div>
          </div>

          <div>
            <div className="text-gray-500 text-xs">Score</div>
            <div className="font-bold font-mono">
              {mover.currentEntryScore}{' '}
              <span className={mover.entryScoreChange > 0 ? 'text-green-600' : 'text-red-600'}>
                ({formatChange(mover.entryScoreChange)})
              </span>
            </div>
          </div>

          <div>
            <div className="text-gray-500 text-xs">상승여력</div>
            <div className="font-bold font-mono">
              {mover.currentAvgUpside.toFixed(1)}%{' '}
              <span className={mover.avgUpsideChange > 0 ? 'text-green-600' : 'text-red-600'}>
                ({mover.avgUpsideChange > 0 ? '+' : ''}{mover.avgUpsideChange.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-12 bg-gradient-to-b from-purple-400 to-pink-400 rounded-full"></div>
            <h2 className="text-4xl font-bold">컨센서스 변화 추적</h2>
          </div>
          <p className="text-purple-200 text-lg ml-4">
            최신 델타 기준 애널리스트 의견 변화 추이 • 매일 자동 업데이트
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="font-bold">오류 발생</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !movers && (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-6 text-gray-600 text-lg font-semibold">데이터를 불러오는 중...</p>
        </div>
      )}

      {/* Top Movers Grid */}
      {movers && !selectedTicker && (
        <div className="space-y-12">
          {/* Strengthening Section */}
          {movers.strengthening.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">📈</div>
                <h3 className="text-3xl font-bold text-emerald-700">
                  컨센서스 강화
                </h3>
                <div className="ml-auto px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                  {movers.strengthening.length}개 종목
                </div>
              </div>

              {/* Hero Card */}
              {movers.strengthening[0] && renderHeroCard(movers.strengthening[0], 'strengthening')}

              {/* Compact Grid */}
              {movers.strengthening.length > 1 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {movers.strengthening.slice(1).map((mover, idx) =>
                    renderCompactCard(mover, 'strengthening', idx + 1)
                  )}
                </div>
              )}
            </div>
          )}

          {/* Weakening Section */}
          {movers.weakening.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-3xl">📉</div>
                <h3 className="text-3xl font-bold text-rose-700">
                  컨센서스 약화
                </h3>
                <div className="ml-auto px-4 py-2 bg-rose-100 text-rose-700 rounded-full text-sm font-bold">
                  {movers.weakening.length}개 종목
                </div>
              </div>

              {/* Hero Card */}
              {movers.weakening[0] && renderHeroCard(movers.weakening[0], 'weakening')}

              {/* Compact Grid */}
              {movers.weakening.length > 1 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {movers.weakening.slice(1).map((mover, idx) =>
                    renderCompactCard(mover, 'weakening', idx + 1)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {selectedTicker && timeline && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-2xl overflow-hidden">
          {/* Timeline Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-mono opacity-80 mb-1">상세 타임라인</div>
                <h3 className="text-3xl font-bold mb-2">{timeline.name}</h3>
                <p className="text-indigo-200 font-mono">
                  {timeline.ticker} • {timeline.market === 'korea' ? '한국 시장 🇰🇷' : '미국 시장 🇺🇸'}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicker(null)}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                ← 목록으로
              </button>
            </div>
          </div>

          {timeline.history.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">📊</div>
              <div className="text-lg">타임라인 데이터가 없습니다</div>
            </div>
          ) : (
            <div className="p-8 space-y-12">
              {/* Entry Score Chart */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                  <h4 className="text-2xl font-bold text-blue-900">Entry Score 변화</h4>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timeline.history}>
                    <defs>
                      <linearGradient id="colorEntryScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '2px solid #3b82f6',
                        padding: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="entryScore"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="url(#colorEntryScore)"
                      name="Entry Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Broker Count Chart */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-green-500 rounded-full"></div>
                  <h4 className="text-2xl font-bold text-green-900">증권사 수 변화</h4>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timeline.history}>
                    <defs>
                      <linearGradient id="colorBrokerCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '2px solid #10b981',
                        padding: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="brokerCount"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#colorBrokerCount)"
                      name="증권사 수"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Upside Chart */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-amber-500 rounded-full"></div>
                  <h4 className="text-2xl font-bold text-amber-900">평균 상승여력 변화</h4>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={timeline.history}>
                    <defs>
                      <linearGradient id="colorUpside" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '2px solid #f59e0b',
                        padding: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgUpside"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fill="url(#colorUpside)"
                      name="평균 상승여력 (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Price vs Target Chart */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-purple-500 rounded-full"></div>
                  <h4 className="text-2xl font-bold text-purple-900">가격 대비 목표가</h4>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={timeline.history}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '2px solid #a855f7',
                        padding: '12px'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="currentPrice"
                      stroke="#6366f1"
                      strokeWidth={3}
                      name="현재가"
                      dot={{ r: 5, fill: '#6366f1' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgTargetPrice"
                      stroke="#ec4899"
                      strokeWidth={3}
                      name="평균 목표가"
                      dot={{ r: 5, fill: '#ec4899' }}
                      strokeDasharray="8 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
