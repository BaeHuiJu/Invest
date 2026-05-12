import { useEffect, useState } from 'react';

import type { RiskAnalysisResponse, StockRiskMetrics } from '../pages/api/risk-analysis';

const CLIENT_CACHE_TTL = 8 * 60 * 1000;
let clientCache: { data: RiskAnalysisResponse; fetchedAt: number } | null = null;

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = pct < 35 ? '#22c55e' : pct < 60 ? '#f59e0b' : '#ef4444';
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

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-c-surface-2 p-2.5 text-center">
      <div className="text-[10px] text-c-text-3">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-c-text">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-c-text-3">{sub}</div>}
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

function StockCard({ stock }: { stock: StockRiskMetrics }) {
  const borderColor =
    stock.riskLevel === 'low' ? 'border-green-200' :
    stock.riskLevel === 'medium' ? 'border-amber-200' : 'border-red-200';

  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-c-surface p-4 shadow-sm`}>
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

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricCell
          label="베타 (β)"
          value={stock.beta != null ? stock.beta.toFixed(2) : '-'}
          sub={stock.beta != null ? (stock.beta > 1 ? '시장보다 변동↑' : '시장보다 안정') : '데이터 부족'}
        />
        <MetricCell
          label="변동성 (연간)"
          value={stock.volatility > 0 ? `${stock.volatility.toFixed(1)}%` : '-'}
          sub="표준편차 × √252"
        />
        <MetricCell
          label="샤프 비율"
          value={stock.sharpeRatio != null ? stock.sharpeRatio.toFixed(2) : '-'}
          sub={stock.sharpeRatio != null ? (stock.sharpeRatio > 1 ? '우수' : stock.sharpeRatio > 0 ? '보통' : '미흡') : '-'}
        />
        <MetricCell
          label="1일 VaR (95%)"
          value={stock.var95 > 0 ? `-${stock.var95.toFixed(1)}%` : '-'}
          sub="95% 신뢰 최대손실"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-c-text-3">
        <span>현재가 {stock.currentPrice.toLocaleString()}</span>
        <span>데이터 {stock.dataPoints}일</span>
      </div>
    </div>
  );
}

function PortfolioSummary({ data }: { data: RiskAnalysisResponse }) {
  const p = data.portfolio;
  const total = p.riskLevelDistribution.low + p.riskLevelDistribution.medium + p.riskLevelDistribution.high;

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">포트폴리오 리스크 요약</h3>
        <span className="text-[11px] text-slate-400">데이터 기준: {data.dataRange}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 베타</div>
          <div className="mt-1 text-xl font-bold">{p.avgBeta != null ? p.avgBeta.toFixed(2) : '-'}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">시장 민감도</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 변동성</div>
          <div className="mt-1 text-xl font-bold">{p.avgVolatility > 0 ? `${p.avgVolatility.toFixed(1)}%` : '-'}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">연간 기준</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 샤프</div>
          <div className="mt-1 text-xl font-bold">{p.avgSharpe != null ? p.avgSharpe.toFixed(2) : '-'}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">위험 대비 수익</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur">
          <div className="text-[11px] text-slate-400">평균 VaR (95%)</div>
          <div className="mt-1 text-xl font-bold">{p.portfolioVar95 > 0 ? `-${p.portfolioVar95.toFixed(1)}%` : '-'}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">1일 최대손실</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="mb-2 text-[11px] text-slate-400">시장 분포</div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-300">국내 {p.marketDistribution.korea}개</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              <span className="text-xs text-slate-300">해외 {p.marketDistribution.us}개</span>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-2 flex h-2 overflow-hidden rounded-full">
              <div className="bg-blue-400" style={{ width: `${(p.marketDistribution.korea / total) * 100}%` }} />
              <div className="bg-orange-400" style={{ width: `${(p.marketDistribution.us / total) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="mb-2 text-[11px] text-slate-400">리스크 분포</div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="text-xs text-slate-300">저 {p.riskLevelDistribution.low}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-300">중 {p.riskLevelDistribution.medium}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="text-xs text-slate-300">고 {p.riskLevelDistribution.high}</span>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-2 flex h-2 overflow-hidden rounded-full">
              <div className="bg-green-400" style={{ width: `${(p.riskLevelDistribution.low / total) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(p.riskLevelDistribution.medium / total) * 100}%` }} />
              <div className="bg-red-400" style={{ width: `${(p.riskLevelDistribution.high / total) * 100}%` }} />
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
  const [sortBy, setSortBy] = useState<'riskScore' | 'volatility' | 'sharpe' | 'beta'>('riskScore');
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
    if (sortBy === 'volatility') return b.volatility - a.volatility;
    if (sortBy === 'sharpe') return (b.sharpeRatio ?? -999) - (a.sharpeRatio ?? -999);
    if (sortBy === 'beta') return (b.beta ?? 0) - (a.beta ?? 0);
    return 0;
  }).filter((s) => filterLevel === 'all' || s.riskLevel === filterLevel);

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 p-5 text-white">
        <h2 className="text-xl font-bold">리스크 분석 대시보드</h2>
        <p className="mt-1 text-sm text-slate-300">
          최근 30일 추천 종목의 베타 · 변동성 · 샤프 비율 · VaR을 자동 계산합니다. 과거 3개월 일별 가격 기준.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span>• 베타: 시장 대비 민감도 (1 = 시장과 동일)</span>
          <span>• 샤프 비율: 위험 대비 초과 수익 (1 이상 우수)</span>
          <span>• VaR 95%: 하루에 이 이상 손실 확률 5%</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-c-text-2">
          <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          가격 데이터 수집 및 지표 계산 중... (첫 로드 10~20초 소요)
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
              {([['riskScore', '리스크점수'], ['volatility', '변동성'], ['sharpe', '샤프비율'], ['beta', '베타']] as const).map(([key, label]) => (
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
            ⚠️ 리스크 지표는 과거 데이터 기반 추정치입니다. 투자 결정의 보조 참고 자료로만 활용하세요.
          </div>
        </>
      )}
    </div>
  );
}
