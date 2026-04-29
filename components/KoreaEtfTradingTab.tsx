import { useEffect, useState } from 'react';
import type { KoreaEtfTradingDecision } from '../pages/api/korea-etf-trading';

let cachedDecision: KoreaEtfTradingDecision | null = null;
let cachedAt = 0;
const CLIENT_TTL_MS = 10 * 60 * 1000;

function ActionBadge({ action }: { action: KoreaEtfTradingDecision['action'] }) {
  const className =
    action === '매수' ? 'bg-c-positive-bg text-c-positive' :
    action === '단기 테마' ? 'bg-c-info-bg text-c-info' :
    action === '인버스' ? 'bg-c-negative-bg text-c-negative' :
    'bg-c-neutral-bg text-c-neutral';

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${className}`}>
      {action}
    </span>
  );
}

function RegimeBadge({ regime }: { regime: KoreaEtfTradingDecision['marketRegime'] }) {
  const className =
    regime === 'risk_on' ? 'bg-c-positive-bg text-c-positive' :
    regime === 'rotation' ? 'bg-c-info-bg text-c-info' :
    regime === 'risk_off' ? 'bg-c-negative-bg text-c-negative' :
    'bg-c-neutral-bg text-c-neutral';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${className}`}>
      {regime}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-4">
      <div className="text-xs font-medium text-c-text-2">{label}</div>
      <div className="mt-1 text-base font-semibold text-c-text">{value}</div>
    </div>
  );
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function formatRatio(value: number) {
  return `${value.toFixed(2)}:1`;
}

export function KoreaEtfTradingTab() {
  const [data, setData] = useState<KoreaEtfTradingDecision | null>(cachedDecision);
  const [loading, setLoading] = useState(cachedDecision === null);
  const [error, setError] = useState<string | null>(null);

  const load = (force = false) => {
    if (!force && cachedDecision && Date.now() - cachedAt < CLIENT_TTL_MS) {
      setData(cachedDecision);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch('/api/korea-etf-trading')
      .then((response) => {
        if (!response.ok) throw new Error('단기 ETF 추천을 불러오지 못했습니다.');
        return response.json() as Promise<KoreaEtfTradingDecision>;
      })
      .then((decision) => {
        cachedDecision = decision;
        cachedAt = Date.now();
        setData(decision);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-c-accent border-t-transparent" />
        <p className="text-sm text-c-text-2">오늘의 한국 ETF 단기 행동을 분석 중입니다.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-c-border bg-c-negative-bg p-6 text-center">
        <p className="font-semibold text-c-negative">{error}</p>
        <p className="mt-1 text-sm text-c-negative">GROQ_API_KEY 설정 또는 네트워크 상태를 확인하세요.</p>
        <button
          type="button"
          onClick={() => load(true)}
          className="mt-4 rounded-lg bg-c-negative px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          다시 분석
        </button>
      </div>
    );
  }

  if (!data) return null;

  const generatedAt = new Date(data.generatedAt).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ActionBadge action={data.action} />
              <RegimeBadge regime={data.marketRegime} />
              <span className="text-xs text-c-text-2">생성 {generatedAt}</span>
            </div>
            <h2 className="text-2xl font-bold text-c-text">오늘의 한국 ETF 단기 행동</h2>
            <p className="mt-1 text-sm text-c-text-2">
              당일~3일 기준, 틀리지 않는 선택을 우선하는 공격형 ETF 의사결정입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="rounded-lg border border-c-border bg-c-surface-2 px-4 py-2 text-sm font-medium text-c-text hover:bg-c-surface"
          >
            새로 분석
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="선택 ETF" value={`${data.etf.name} (${data.etf.ticker})`} />
        <Field label="진입" value={data.strategy.entry} />
        <Field label="분할 매수" value={data.strategy.splitBuy ? 'YES' : 'NO'} />
        <Field label="신뢰도" value={`${data.confidence.probability}% / ${data.confidence.level}`} />
        <Field label="보유 기간" value={data.holdingWindow} />
        <Field label="세팅 유형" value={data.setupType} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">선정 이유</h3>
          <div className="mt-3 space-y-3 text-sm text-c-text-2">
            <p><span className="font-semibold text-c-text">자금 흐름:</span> {data.reasons.fundFlow}</p>
            <p><span className="font-semibold text-c-text">강세 구분:</span> {data.reasons.strengthRotation}</p>
            <p><span className="font-semibold text-c-text">지속성:</span> {data.reasons.sustainability}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">매수 전략</h3>
          <div className="mt-3 space-y-3 text-sm text-c-text-2">
            <p><span className="font-semibold text-c-text">진입:</span> {data.strategy.entry}</p>
            <p><span className="font-semibold text-c-text">분할 매수:</span> {data.strategy.splitBuy ? 'YES' : 'NO'}</p>
            <p><span className="font-semibold text-c-text">눌림 기준:</span> -{data.strategy.pullbackPercent}%</p>
          </div>
        </div>

        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">목표 & 손절</h3>
          <div className="mt-3 space-y-3 text-sm text-c-text-2">
            <p><span className="font-semibold text-c-text">목표:</span> {formatSignedPercent(data.targetStop.targetPercent)}</p>
            <p><span className="font-semibold text-c-text">손절:</span> {formatSignedPercent(data.targetStop.stopPercent)}</p>
            <p><span className="font-semibold text-c-text">기간:</span> 3일 기준</p>
          </div>
        </div>
      </div>

      {data.pricePlan ? (
        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-bold text-c-text">가격 가이드</h3>
              <p className="mt-1 text-sm text-c-text-2">{data.pricePlan.explanation}</p>
            </div>
            <p className="text-xs text-c-text-2">{data.pricePlan.entryZone.basis}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Field
              label="진입 구간"
              value={`${formatCurrency(data.pricePlan.entryZone.low)} ~ ${formatCurrency(data.pricePlan.entryZone.high)}`}
            />
            <Field label="기준 진입가" value={formatCurrency(data.pricePlan.entryZone.reference)} />
            <Field
              label="손절가"
              value={`${formatCurrency(data.pricePlan.stopLoss.price)} (${formatSignedPercent(-data.pricePlan.stopLoss.percent)})`}
            />
            <Field
              label="1차 매도가"
              value={`${formatCurrency(data.pricePlan.takeProfit.firstPrice)} (${formatSignedPercent(data.pricePlan.takeProfit.firstPercent)})`}
            />
            <Field
              label="최종 매도가"
              value={`${formatCurrency(data.pricePlan.takeProfit.finalPrice)} (${formatSignedPercent(data.pricePlan.takeProfit.finalPercent)})`}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-c-surface-2 p-4 text-sm text-c-text-2">
              <p><span className="font-semibold text-c-text">손절 기준:</span> {data.pricePlan.stopLoss.basis}</p>
              <p className="mt-2"><span className="font-semibold text-c-text">매도 기준:</span> {data.pricePlan.takeProfit.basis}</p>
            </div>
            <div className="rounded-xl bg-c-surface-2 p-4 text-sm text-c-text-2">
              <p><span className="font-semibold text-c-text">1차 손익비:</span> {formatRatio(data.pricePlan.riskReward.firstTarget)}</p>
              <p className="mt-2"><span className="font-semibold text-c-text">최종 손익비:</span> {formatRatio(data.pricePlan.riskReward.finalTarget)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">가격 가이드</h3>
          <p className="mt-2 text-sm text-c-text-2">
            현재 추천은 진입 대기 상태입니다. 매수 신호가 확정되면 진입 구간, 손절가, 1차/최종 목표가를 함께 표시합니다.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-c-border bg-c-warning-bg p-5">
        <h3 className="font-bold text-c-warning">실패 시 대응</h3>
        <div className="mt-3 space-y-2 text-sm text-c-warning">
          <p><span className="font-semibold">재진입:</span> {data.failurePlan.reentry}</p>
          <p><span className="font-semibold">섹터 이동:</span> {data.failurePlan.rotation}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">점수 요약</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-c-text-2">
            <p><span className="font-semibold text-c-text">모멘텀:</span> {data.scoreSummary.momentum}</p>
            <p><span className="font-semibold text-c-text">자금 유입:</span> {data.scoreSummary.flow}</p>
            <p><span className="font-semibold text-c-text">과열도:</span> {data.scoreSummary.heat}</p>
            <p><span className="font-semibold text-c-text">진입 적합도:</span> {data.scoreSummary.setup}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <h3 className="font-bold text-c-text">탈락 후보</h3>
          <div className="mt-3 space-y-3 text-sm text-c-text-2">
            {data.whyNotOthers.length > 0 ? (
              data.whyNotOthers.map((item) => (
                <div key={`${item.ticker}-${item.name}`}>
                  <p className="font-semibold text-c-text">{item.name} ({item.ticker})</p>
                  <p className="mt-1">{item.reason}</p>
                </div>
              ))
            ) : (
              <p>비교 후보 설명이 없거나 관망 선택이라 상위 후보 탈락 사유가 비어 있습니다.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-c-border bg-c-surface-2 p-4 text-xs leading-relaxed text-c-text-2">
        이 메뉴는 국내 ETF 현재가에 더해 코스피·코스닥·나스닥·반도체·환율·금리 프록시와 ETF 최근 수익률, 변동성, 거래대금 변화를 함께 넣어 분석합니다.
        애매한 장에서도 점수 기준을 통과하는 후보가 있으면 진입을 허용하고, 기준 미달일 때만 관망을 선택하도록 프롬프트를 조정했습니다.
      </div>
    </div>
  );
}
