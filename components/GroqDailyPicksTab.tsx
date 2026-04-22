import { useEffect, useState } from 'react';
import type { GroqDailyPick, GroqDailyPicksResponse } from '../pages/api/groq-daily-picks';

type InsightRequest = { ticker: string; name: string; market: 'korea' | 'us'; category: 'stock' | 'etf' | 'analyst'; currentPrice?: number };

// Module-level cache — survives tab switches
let _cached: GroqDailyPicksResponse | null = null;
let _cachedAt = 0;
const CLIENT_TTL = 25 * 60 * 1000;

function fmtPrice(price: number, market: 'korea' | 'us') {
  return market === 'korea'
    ? `${Math.round(price).toLocaleString()}원`
    : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
    value >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      신뢰도 {value}점
    </span>
  );
}

function ChangeChip({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '+' : ''}{value}% (리포트 대비)
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function PickCard({ pick, onOpenInsight }: { pick: GroqDailyPick; onOpenInsight?: (r: InsightRequest) => void }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b p-4 dark:border-gray-700">
        <div className="min-w-0">
          <button
            onClick={() => onOpenInsight?.({ ticker: pick.ticker, name: pick.name, market: pick.market, category: 'stock', currentPrice: pick.currentPrice })}
            className="truncate text-left text-base font-bold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
          >
            {pick.name}
          </button>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{pick.ticker}</span>
            <span>·</span>
            <span>{pick.market === 'korea' ? '🇰🇷 국내' : '🇺🇸 미국'}</span>
            <span>·</span>
            <ChangeChip value={pick.priceChangeSinceReport} />
          </div>
        </div>
        <ConfidenceBadge value={pick.confidence} />
      </div>

      {/* Groq Reasoning */}
      <div className="border-b p-4 dark:border-gray-700">
        <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-400">
          <span>🤖</span> Groq llama-3.3 분석
        </div>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{pick.reasoning}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-px border-b bg-gray-100 dark:border-gray-700 dark:bg-gray-700">
        {[
          ['현재가', fmtPrice(pick.currentPrice, pick.market)],
          ['목표가', fmtPrice(pick.avgTargetPrice, pick.market)],
          ['상승여력', `${pick.avgUpside}%`],
          ['Entry Score', `${pick.entryScore}점`],
        ].map(([label, val]) => (
          <div key={label} className="bg-white px-4 py-3 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{val}</div>
          </div>
        ))}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          예상 수익 {pick.expectedReturn}
        </span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          기간 {pick.timeframe}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {pick.brokerCount}개 증권사
        </span>
        {pick.week1SuccessRate !== null && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            과거 성공률 {pick.week1SuccessRate}%
          </span>
        )}
      </div>

      {/* Risk */}
      <div className="rounded-b-2xl border-t bg-amber-50 px-4 py-2 dark:border-gray-700 dark:bg-amber-900/10">
        <span className="text-xs text-amber-700 dark:text-amber-400">⚠️ {pick.keyRisk}</span>
      </div>
    </div>
  );
}

export function GroqDailyPicksTab({ onOpenInsight }: { onOpenInsight?: (r: InsightRequest) => void }) {
  const [data, setData] = useState<GroqDailyPicksResponse | null>(_cached);
  const [loading, setLoading] = useState(_cached === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (_cached && Date.now() - _cachedAt < CLIENT_TTL) {
      setData(_cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch('/api/groq-daily-picks')
      .then((r) => { if (!r.ok) throw new Error('분석 실패'); return r.json() as Promise<GroqDailyPicksResponse>; })
      .then((d) => { _cached = d; _cachedAt = Date.now(); setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Groq AI가 실시간 데이터를 분석 중입니다…</p>
        <p className="text-xs text-gray-400">최초 분석은 10-20초 소요됩니다</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="font-medium text-red-700 dark:text-red-400">분석 오류: {error}</p>
        <p className="mt-1 text-sm text-red-500">GROQ_API_KEY가 설정되어 있는지 확인하세요</p>
        <button
          onClick={() => { setError(null); setLoading(true); _cached = null;
            fetch('/api/groq-daily-picks')
              .then((r) => r.json() as Promise<GroqDailyPicksResponse>)
              .then((d) => { _cached = d; _cachedAt = Date.now(); setData(d); setLoading(false); })
              .catch((e: Error) => { setError(e.message); setLoading(false); });
          }}
          className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  const avgConfidence = data.picks.length > 0
    ? Math.round(data.picks.reduce((s, p) => s + p.confidence, 0) / data.picks.length)
    : 0;

  const generatedTime = new Date(data.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">🤖 Groq AI 단기 유망주</h2>
            <p className="mt-1 text-sm text-purple-200">
              실시간 애널리스트 데이터 → Groq llama-3.3 분석 → 단기 3%+ 고확률 종목 선별
            </p>
          </div>
          <div className="text-right text-xs text-purple-200">
            <div>분석 시각</div>
            <div className="font-mono text-white">{generatedTime}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-purple-200">
          📡 시장 기준: {data.marketContext}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="분석 후보 종목" value={data.candidateCount} />
        <StatCard label="최종 선별" value={`${data.picks.length}개`} />
        <StatCard label="평균 신뢰도" value={`${avgConfidence}점`} />
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        ⚠️ <strong>투자 참고용입니다.</strong> 주식 투자는 원금 손실 위험이 있으며, AI 분석이 수익을 보장하지 않습니다.
      </div>

      {/* Picks */}
      {data.picks.length === 0 ? (
        <div className="rounded-xl border bg-gray-50 p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">
          현재 선별된 유망주가 없습니다. 잠시 후 다시 확인하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.picks.map((pick) => (
            <PickCard key={pick.ticker} pick={pick} onOpenInsight={onOpenInsight} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="rounded-xl border bg-gray-50 p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <div className="font-medium text-gray-700 dark:text-gray-300">데이터 기준</div>
        <ul className="mt-1.5 space-y-0.5">
          <li>• 최근 15일 이내 애널리스트 리포트, 브로커 2개 이상 종목 대상</li>
          <li>• 현재가·목표가는 실시간 수집값, Groq에게 직접 주입하여 분석</li>
          <li>• 분석 결과는 30분간 캐시됩니다 (다음 갱신: {new Date(new Date(data.generatedAt).getTime() + 30 * 60_000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})</li>
        </ul>
      </div>
    </div>
  );
}
