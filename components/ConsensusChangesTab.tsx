import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  // Fetch top movers (최신 변화 사용)
  useEffect(() => {
    setLoading(true);
    setError(null);
    // 최신 델타의 변화를 사용 (period는 무시하고 항상 최신 델타 표시)
    fetch(`/api/consensus-latest-changes`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          // 최신 변화 데이터를 기존 형식에 맞춰 변환
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

  const renderMoverCard = (mover: TopMover, type: 'strengthening' | 'weakening') => {
    const isStrengthening = type === 'strengthening';
    const bgColor = isStrengthening ? 'bg-green-50' : 'bg-red-50';
    const borderColor = isStrengthening ? 'border-green-200' : 'border-red-200';
    const textColor = isStrengthening ? 'text-green-700' : 'text-red-700';
    const badgeBg = isStrengthening ? 'bg-green-100' : 'bg-red-100';

    return (
      <div
        key={mover.ticker}
        className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition ${bgColor} ${borderColor} ${
          selectedTicker === mover.ticker ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedTicker(mover.ticker)}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-bold text-lg">{mover.name}</div>
            <div className="text-sm text-gray-600">
              {mover.ticker} ({mover.market === 'korea' ? '🇰🇷' : '🇺🇸'})
            </div>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-semibold ${badgeBg} ${textColor}`}>
            {isStrengthening ? '상승' : '하락'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-600">증권사 수</div>
            <div className="font-semibold">
              {mover.currentBrokerCount}{' '}
              <span className={mover.brokerCountChange > 0 ? 'text-green-600' : 'text-red-600'}>
                ({formatChange(mover.brokerCountChange)})
              </span>
            </div>
          </div>

          <div>
            <div className="text-gray-600">Entry Score</div>
            <div className="font-semibold">
              {mover.currentEntryScore}{' '}
              <span className={mover.entryScoreChange > 0 ? 'text-green-600' : 'text-red-600'}>
                ({formatChange(mover.entryScoreChange)})
              </span>
            </div>
          </div>

          <div>
            <div className="text-gray-600">평균 상승여력</div>
            <div className="font-semibold">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">컨센서스 변화 추적</h2>
          <p className="text-gray-600 mt-1">최신 델타 기준 애널리스트 의견 변화 (매일 자동 업데이트)</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          오류: {error}
        </div>
      )}

      {/* Loading */}
      {loading && !movers && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      )}

      {/* Top Movers Grid */}
      {movers && !selectedTicker && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengthening */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-green-700">
              📈 컨센서스 강화 (상위 {movers.strengthening.length}개)
            </h3>
            <div className="space-y-3">
              {movers.strengthening.length === 0 ? (
                <div className="text-center py-8 text-gray-500">데이터가 없습니다</div>
              ) : (
                movers.strengthening.map((mover) => renderMoverCard(mover, 'strengthening'))
              )}
            </div>
          </div>

          {/* Weakening */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-red-700">
              📉 컨센서스 약화 (하위 {movers.weakening.length}개)
            </h3>
            <div className="space-y-3">
              {movers.weakening.length === 0 ? (
                <div className="text-center py-8 text-gray-500">데이터가 없습니다</div>
              ) : (
                movers.weakening.map((mover) => renderMoverCard(mover, 'weakening'))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline View */}
      {selectedTicker && timeline && (
        <div className="bg-white p-6 rounded-lg border shadow">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold">{timeline.name}</h3>
              <p className="text-gray-600">
                {timeline.ticker} ({timeline.market === 'korea' ? '한국' : '미국'})
              </p>
            </div>
            <button
              onClick={() => setSelectedTicker(null)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition"
            >
              목록으로
            </button>
          </div>

          {timeline.history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">타임라인 데이터가 없습니다</div>
          ) : (
            <div className="space-y-8">
              {/* Entry Score Chart */}
              <div>
                <h4 className="font-semibold mb-4">Entry Score 변화</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeline.history}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="entryScore"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Entry Score"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Broker Count Chart */}
              <div>
                <h4 className="font-semibold mb-4">증권사 수 변화</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeline.history}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="brokerCount"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="증권사 수"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Upside Chart */}
              <div>
                <h4 className="font-semibold mb-4">평균 상승여력 변화</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeline.history}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgUpside"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="평균 상승여력 (%)"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Price vs Target Chart */}
              <div>
                <h4 className="font-semibold mb-4">가격 대비 목표가</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeline.history}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="currentPrice"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name="현재가"
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgTargetPrice"
                      stroke="#ec4899"
                      strokeWidth={2}
                      name="평균 목표가"
                      dot={{ r: 4 }}
                      strokeDasharray="5 5"
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
