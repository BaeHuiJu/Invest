import { useEffect, useState } from 'react';

import type { RiskAnalysisResponse, StockRiskMetrics } from '../pages/api/risk-analysis';

const CLIENT_CACHE_TTL = 8 * 60 * 1000;
let clientCache: { data: RiskAnalysisResponse; fetchedAt: number } | null = null;

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = pct < 40 ? '#22c55e' : pct < 65 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="36" cy="36" r="28" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cfg = {
    low: { label: '저위험', cls: 'bg-green-100 text-green-700' },
    medium: { label: '중위험', cls: 'bg-amber-100 text-amber-700' },
    high: { label: '고위험', cls: 'bg-red-100 text-red-700' },
  }[level];
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-c-text-3">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[10px] font-medium text-c-text-2">{value}</span>
    </div>
  );
}

function StockCard({ stock }: { stock: StockRiskMetrics }) {
  const [open, setOpen] = useState(false);
  const borderColor =
    stock.riskLevel === 'low' ? 'border-green-200' :
    stock.riskLevel === 'medium' ? 'border-amber-200' : 'border-red-200';

  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-c-surface p-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-c-text">{stock.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${stock.market === 'korea' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
              {stock.market === 'korea' ? '국내' : '해외'}
            </span>
            <span className="text-[11px] text-c-text-3">{stock.ticker}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <RiskGauge score={stock.riskScore} />
          <RiskBadge level={stock.riskLevel} />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <div className="rounded-lg bg-c-surface-2 p-2.5 text-center">
          <div className="text-[10px] text-c-text-3">진입점수</div>
          <div className="mt-0.5 text-sm font-semibold text-c-text">{stock.entryScore}</div>
          <div className="mt-0.5 text-[10px] text-c-text-3">/100</div>
        </div>
        <div className="rounded-lg bg-c-surface-2 p-2.5 text-center">
          <div className="text-[10px] text-c-text-3">평균 상승여력</div>
          <div className={`mt-0.5 text-sm font-semibold ${stock.avgUpside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stock.avgUpside >= 0 ? '+' : ''}{stock.avgUpside.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[10px] text-c-text-3">목표가 기준</div>
        </div>
        <div className="rounded-lg bg-c-surface-2 p-2.5 text-center">
          <div className="text-[10px] text-c-text-3">리포트 / 브로커</div>
          <div className="mt-0.5 text-sm font-semibold text-c-text">
            {stock.reportCount}<span className="text-[10px] font-normal text-c-text-3">건</span>
            {' / '}
            {stock.brokerCount}<span className="text-[10px] font-normal text-c-text-3">사</span>
          </div>
          <div className="mt-0.5 text-[10px] text-c-text-3">{stock.latestReportDate.slice(0, 10)}</div>
        </div>
        <div className="rounded-lg bg-c-surface-2 p-2.5 text-center">
          <div className="text-[10px] text-c-text-3">1개월 성공률</div>
          {stock.successRate !== null ? (
            <>
              <div className={`mt-0.5 text-sm font-semibold ${stock.successRate >= 60 ? 'text-green-600' : stock.successRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {stock.successRate.toFixed(0)}%
              </div>
              <div className="mt-0.5 text-[10px] text-c-text-3">{stock.completedCount}건 완료</div>
            </>
          ) : (
            <>
              <div className="mt-0.5 text-sm font-semibold text-c-text-3">-</div>
              <div className="mt-0.5 text-[10px] text-c-text-3">데이터 없음</div>
            </>
          )}
        </div>
      </div>

      {/* Avg return */}
      {stock.avgReturnPct !== null && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-c-surface-2 px-3 py-1.5 text-xs">
          <span className="text-c-text-3">평균 1개월 수익률</span>
          <span className={`font-semibold ${stock.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stock.avgReturnPct >= 0 ? '+' : ''}{stock.avgReturnPct.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Entry breakdown toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="mt-2 flex w-full items-center justify-between text-[11px] text-c-text-3 hover:text-c-text-2"
      >
        <span>진입점수 세부 항목</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-c-surface-2 p-3">
          <BreakdownBar label="가격 vs 기준" value={stock.entryScoreBreakdown.priceVsBase} max={30} />
          <BreakdownBar label="목표가 갭" value={stock.entryScoreBreakdown.targetGap} max={35} />
          <BreakdownBar label="리포트 수" value={stock.entryScoreBreakdown.reportCount} max={15} />
          <BreakdownBar label="컨센서스" value={stock.entryScoreBreakdown.consensusStrength} max={20} />
        </div>
      )}

      {/* Price footer */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-c-text-3">
        <span>현재가 {stock.currentPrice.toLocaleString()}</span>
        <span>목표 {stock.avgTargetPrice.toLocaleString()}</span>
      </div>
    </div>
  );
}

function PortfolioSummary({ data }: { data: RiskAnalysisResponse }) {
  const p = data.portfolio;
  const total = p.riskDist.low + p.riskDist.medium + p.riskDist.high;

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">포트폴리오 리스크 요약</h3>
        <span className="text-[11px] text-slate-400">후보 {data.totalCandidates}개 중 상위 {data.stocks.length}개</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 리스크</div>
          <div className="mt-1 text-xl font-bold">{p.avgRiskScore}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">/100점</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 진입점수</div>
          <div className="mt-1 text-xl font-bold">{p.avgEntryScore}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">/100점</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 상승여력</div>
          <div className="mt-1 text-xl font-bold">{p.avgUpside.toFixed(1)}%</div>
          <div className="mt-0.5 text-[10px] text-slate-400">목표가 기준</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">1개월 성공률</div>
          <div className="mt-1 text-xl font-bold">
            {p.successRate !== null ? `${p.successRate.toFixed(0)}%` : '-'}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">완료 건 기준</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="mb-2 text-[11px] text-slate-400">시장 분포</div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-300">국내 {p.marketDist.korea}개</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              <span className="text-xs text-slate-300">해외 {p.marketDist.us}개</span>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-2 flex h-2 overflow-hidden rounded-full">
              <div className="bg-blue-400" style={{ width: `${(p.marketDist.korea / total) * 100}%` }} />
              <div className="bg-orange-400" style={{ width: `${(p.marketDist.us / total) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="mb-2 text-[11px] text-slate-400">리스크 분포</div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300">저 {p.riskDist.low}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-300">중 {p.riskDist.medium}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="text-xs text-slate-300">고 {p.riskDist.high}</span>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-2 flex h-2 overflow-hidden rounded-full">
              <div className="bg-green-400" style={{ width: `${(p.riskDist.low / total) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(p.riskDist.medium / total) * 100}%` }} />
              <div className="bg-red-400" style={{ width: `${(p.riskDist.high / total) * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RiskAnalysisTab() {
  const [data, setData] = useState<RiskAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'riskScore' | 'entryScore' | 'avgUpside' | 'successRate'>('riskScore');
  const [filterLevel, setFilterLevel] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  useEffect(() => {
    if (clientCache && Date.now() - clientCache.fetchedAt < CLIENT_CACHE_TTL) {
      setData(clientCache.data);
      setLoading(false);
      return;
    }
    fetch('/api/risk-analysis')
      .then((r) => r.json())
      .then((json) => {
        clientCache = { data: json as RiskAnalysisResponse, fetchedAt: Date.now() };
        setData(json as RiskAnalysisResponse);
        setLoading(false);
      })
      .catch(() => {
        setError('리스크 분석 데이터를 불러오지 못했습니다.');
        setLoading(false);
      });
  }, []);

  const sorted = [...(data?.stocks ?? [])].sort((a, b) => {
    if (sortBy === 'riskScore') return b.riskScore - a.riskScore;
    if (sortBy === 'entryScore') return b.entryScore - a.entryScore;
    if (sortBy === 'avgUpside') return b.avgUpside - a.avgUpside;
    if (sortBy === 'successRate') return (b.successRate ?? -1) - (a.successRate ?? -1);
    return 0;
  }).filter((s) => filterLevel === 'all' || s.riskLevel === filterLevel);

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 p-5 text-white">
        <h2 className="text-xl font-bold">리스크 분석 대시보드</h2>
        <p className="mt-1 text-sm text-slate-300">
          최근 60일 애널리스트 추천 종목의 리스크를 진입점수·상승여력·컨센서스·성공률로 분석합니다.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span>• 리스크점수: 낮을수록 안전 (0–39 저위험 / 40–64 중위험 / 65+ 고위험)</span>
          <span>• 진입점수: 높을수록 현재 진입 타이밍이 유리</span>
          <span>• 성공률: 과거 추천 후 1개월 목표가 70% 이상 달성 비율</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-c-text-2">
          <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          리스크 분석 중...
        </div>
      )}
      {!loading && error && <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>}

      {!loading && data && (
        <>
          <PortfolioSummary data={data} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border text-sm">
              {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  className={`px-3 py-1.5 ${filterLevel === level ? 'bg-blue-600 text-white' : 'bg-c-surface text-c-text-2 hover:bg-c-surface-2'}`}
                >
                  {{ all: '전체', high: '고위험', medium: '중위험', low: '저위험' }[level]}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-lg border text-sm">
              {([['riskScore', '리스크'], ['entryScore', '진입점수'], ['avgUpside', '상승여력'], ['successRate', '성공률']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-3 py-1.5 ${sortBy === key ? 'bg-slate-700 text-white' : 'bg-c-surface text-c-text-2 hover:bg-c-surface-2'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-c-text-3">{sorted.length}개 종목</span>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-lg bg-c-surface-2 p-8 text-center text-c-text-3">
              조건에 맞는 종목이 없습니다. 최근 추천 리포트가 충분하지 않을 수 있습니다.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sorted.map((stock) => (
                <StockCard key={`${stock.market}-${stock.ticker}`} stock={stock} />
              ))}
            </div>
          )}

          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            ⚠️ 리스크 지표는 과거 애널리스트 리포트 기반 추정치입니다. 투자 결정의 보조 참고 자료로만 활용하세요.
          </div>
        </>
      )}
    </div>
  );
}
