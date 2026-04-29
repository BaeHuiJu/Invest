import { useEffect, useMemo, useState } from 'react';

import {
  calculateIpoAllocation,
  compareBrokerOptions,
  resolveBrokerOption,
  type IpoCalculationOverrides,
} from '@/lib/ipo-allocation-calculator';
import type {
  IpoCalcConfidence,
  IpoCalcPhase,
  IpoCalcStatus,
  IpoDeal,
  IpoFieldSource,
} from '@/lib/ipo-types';

type IpoAllocationCalculatorModalProps = {
  deal: IpoDeal | null;
  onClose: () => void;
};

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return `${Math.round(value).toLocaleString()}원`;
}

function formatShareValue(value: number | null): string {
  if (value === null) return '-';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}주`;
}

function formatRatePercent(value: number | null): string {
  if (value === null) return '-';
  return `${(value * 100).toFixed(0)}%`;
}

function formatCompetition(value: number | null): string {
  if (value === null) return '-';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}:1`;
}

function parsePositiveNumber(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function statusLabel(status: IpoCalcStatus): string {
  if (status === 'final_ready') return '마감 후 자동 계산';
  if (status === 'pre_ready') return '사전 자동 계산';
  return '데이터 보강 필요';
}

function statusClass(status: IpoCalcStatus): string {
  if (status === 'final_ready') return 'border-[#D1FAE5] bg-[#ECFDF5] text-[#047857]';
  if (status === 'pre_ready') return 'border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]';
  return 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]';
}

function phaseLabel(phase: IpoCalcPhase): string {
  if (phase === 'pre_subscription') return '청약 전';
  if (phase === 'live_subscription') return '청약 진행중';
  return '청약 종료 후';
}

function confidenceLabel(confidence: IpoCalcConfidence): string {
  if (confidence === 'high') return '신뢰도 높음';
  if (confidence === 'medium') return '신뢰도 보통';
  return '신뢰도 낮음';
}

function sourceLabel(source: IpoFieldSource): string {
  if (source === 'dart') return 'DART';
  if (source === 'thirtyeight') return '38.co.kr';
  if (source === 'broker_rules') return '주간사 규칙';
  if (source === 'derived') return '유도 규칙';
  return '기타';
}

function ResultCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#111827]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#9CA3AF]">{hint}</div>}
    </div>
  );
}

function ManualField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-[#374151]">{label}</div>
      <div className="flex items-center overflow-hidden rounded-xl border border-[#D1D5DB] bg-white">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-3 py-2 text-sm outline-none"
          min="0"
          step="any"
        />
        {suffix && <span className="px-3 text-sm text-[#6B7280]">{suffix}</span>}
      </div>
    </label>
  );
}

function buildDefaultBudget(deal: IpoDeal): string {
  const firstBroker = deal.calculator.brokerOptions[0];
  if (!firstBroker || !deal.calculator.offeringPrice) return '1000000';

  const minimumDeposit =
    (firstBroker.depositRate ?? 0) *
    (firstBroker.minSubscriptionShares ?? 0) *
    deal.calculator.offeringPrice;

  return minimumDeposit > 0 ? String(Math.ceil(minimumDeposit / 10000) * 10000) : '1000000';
}

export function IpoAllocationCalculatorModal({
  deal,
  onClose,
}: IpoAllocationCalculatorModalProps) {
  const [selectedBrokerName, setSelectedBrokerName] = useState('');
  const [budget, setBudget] = useState('');
  const [requestedShares, setRequestedShares] = useState('');
  const [offeringPrice, setOfferingPrice] = useState('');
  const [depositRate, setDepositRate] = useState('');
  const [minSubscriptionShares, setMinSubscriptionShares] = useState('');
  const [subscriptionUnit, setSubscriptionUnit] = useState('');
  const [overallCompetitionRate, setOverallCompetitionRate] = useState('');
  const [equalCompetitionRate, setEqualCompetitionRate] = useState('');
  const [proportionalCompetitionRate, setProportionalCompetitionRate] = useState('');

  useEffect(() => {
    if (!deal) return;
    setSelectedBrokerName(deal.calculator.brokerOptions[0]?.brokerName ?? '');
    setBudget(buildDefaultBudget(deal));
    setRequestedShares('');
    setOfferingPrice('');
    setDepositRate('');
    setMinSubscriptionShares('');
    setSubscriptionUnit('');
    setOverallCompetitionRate('');
    setEqualCompetitionRate('');
    setProportionalCompetitionRate('');
  }, [deal]);

  useEffect(() => {
    if (!deal) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deal, onClose]);

  const overrides = useMemo<IpoCalculationOverrides>(() => {
    const depositRateValue = parsePositiveNumber(depositRate);
    return {
      offeringPrice: parsePositiveNumber(offeringPrice),
      depositRate: depositRateValue ? depositRateValue / 100 : null,
      minSubscriptionShares: parsePositiveNumber(minSubscriptionShares),
      subscriptionUnit: parsePositiveNumber(subscriptionUnit),
      overallCompetitionRate: parsePositiveNumber(overallCompetitionRate),
      equalCompetitionRate: parsePositiveNumber(equalCompetitionRate),
      proportionalCompetitionRate: parsePositiveNumber(proportionalCompetitionRate),
    };
  }, [
    depositRate,
    equalCompetitionRate,
    minSubscriptionShares,
    offeringPrice,
    overallCompetitionRate,
    proportionalCompetitionRate,
    subscriptionUnit,
  ]);

  if (!deal) return null;

  const budgetValue = parsePositiveNumber(budget) ?? 0;
  const requestedSharesValue = parsePositiveNumber(requestedShares);
  const comparison = compareBrokerOptions({
    brokers: deal.calculator.brokerOptions,
    offeringPrice: deal.calculator.offeringPrice,
    budget: budgetValue,
    requestedShares: requestedSharesValue,
    overrides,
  });
  const selectedRow =
    comparison.rows.find((row) => row.broker.brokerName === selectedBrokerName) ??
    comparison.rows[0];
  const selectedBroker = selectedRow?.broker ?? null;
  const result = selectedRow?.result ?? null;
  const resolvedBroker = selectedBroker ? resolveBrokerOption(selectedBroker, overrides) : null;

  const needsOfferingPrice = !deal.calculator.offeringPrice;
  const needsDepositRate = !resolvedBroker?.depositRate;
  const needsMinShares = !resolvedBroker?.minSubscriptionShares;
  const needsSubscriptionUnit = !resolvedBroker?.subscriptionUnit;
  const needsAnyCompetition =
    !resolvedBroker?.overallCompetitionRate &&
    !resolvedBroker?.equalCompetitionRate &&
    !resolvedBroker?.proportionalCompetitionRate;

  const topTrace = deal.calculator.sourceTrace.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs tracking-[0.18em] text-[#9CA3AF]">IPO AUTO ALLOCATION</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#111827]">{deal.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(deal.calculator.status)}`}>
                  {statusLabel(deal.calculator.status)}
                </span>
                <span className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-xs text-[#6B7280]">
                  {phaseLabel(deal.calculator.calcPhase)}
                </span>
                <span className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-xs text-[#6B7280]">
                  {confidenceLabel(deal.calculator.calcReadiness.confidence)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E5E7EB] p-2 text-[#6B7280] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
              aria-label="닫기"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <path d="M5 5L15 15M15 5L5 15" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#4B5563]">
            청약 전에는 최소 증거금과 청약 가능 수량을 자동 계산하고, 경쟁률이 확보되면 예상 배정 수량까지 자동 계산합니다.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ResultCard label="청약 시작" value={deal.subscriptionStart} />
            <ResultCard label="청약 마감" value={deal.subscriptionEnd} />
            <ResultCard label="공모가 기준" value={formatCurrency(deal.calculator.offeringPrice)} />
            <ResultCard label="현재 경쟁률" value={deal.competitionRatio ?? '-'} />
          </div>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-[#111827]">주간사 비교</h4>
                <a
                  href={deal.detailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[#002FA7] hover:underline"
                >
                  38.co.kr 상세 열기
                </a>
              </div>
              <div className="grid gap-3">
                {comparison.rows.map((row) => {
                  const isSelected = row.broker.brokerName === selectedBrokerName;
                  const isBestByExpected = comparison.recommendation.bestBrokerByExpectedShares === row.broker.brokerName;
                  const isBestByDeposit = comparison.recommendation.bestBrokerByLowestDeposit === row.broker.brokerName;

                  return (
                    <button
                      key={row.broker.brokerName}
                      type="button"
                      onClick={() => setSelectedBrokerName(row.broker.brokerName)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected ? 'border-[#002FA7] bg-[#EDF3FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C7D6FF]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-[#111827]">{row.broker.brokerName}</span>
                            {isBestByExpected && (
                              <span className="rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#047857]">
                                예상 배정 추천
                              </span>
                            )}
                            {isBestByDeposit && (
                              <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                                최소 증거금 추천
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-[#6B7280]">
                            최소 {formatShareValue(row.result.minimumShares)} · 증거금률 {formatRatePercent(row.broker.depositRate)}
                          </div>
                        </div>
                        <div className="grid gap-2 text-right sm:grid-cols-3 sm:text-left">
                          <div>
                            <div className="text-xs text-[#6B7280]">최소 증거금</div>
                            <div className="mt-1 font-medium text-[#111827]">{formatCurrency(row.result.minimumDeposit)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#6B7280]">최대 청약</div>
                            <div className="mt-1 font-medium text-[#111827]">{formatShareValue(row.result.maximumShares)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#6B7280]">총 예상 배정</div>
                            <div className="mt-1 font-medium text-[#111827]">
                              {formatShareValue(row.result.expectedTotalShares ?? row.result.expectedOverallShares)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <h4 className="text-lg font-semibold text-[#111827]">추천 요약</h4>
                <div className="mt-3 space-y-2 text-sm text-[#4B5563]">
                  <div>예상 배정 추천: {comparison.recommendation.bestBrokerByExpectedShares ?? '-'}</div>
                  <div>최소 증거금 추천: {comparison.recommendation.bestBrokerByLowestDeposit ?? '-'}</div>
                  <div>{comparison.recommendation.reason ?? '입력 금액 기준으로 주간사 비교를 완료하면 추천이 갱신됩니다.'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <h4 className="text-lg font-semibold text-[#111827]">입력</h4>
                <div className="mt-4 grid gap-3">
                  <ManualField label="투입 예정 증거금" value={budget} onChange={setBudget} suffix="원" />
                  <ManualField label="청약 예정 주수" value={requestedShares} onChange={setRequestedShares} suffix="주" />
                </div>
              </div>

              {(needsOfferingPrice || needsDepositRate || needsMinShares || needsSubscriptionUnit || needsAnyCompetition) && (
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <div className="text-sm font-semibold text-[#111827]">자동 수집 실패 시 보완 입력</div>
                  <div className="mt-1 text-xs text-[#6B7280]">자동값이 없는 항목만 직접 넣으면 즉시 재계산됩니다.</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {needsOfferingPrice && (
                      <ManualField label="공모가" value={offeringPrice} onChange={setOfferingPrice} suffix="원" />
                    )}
                    {needsDepositRate && (
                      <ManualField label="증거금률" value={depositRate} onChange={setDepositRate} suffix="%" />
                    )}
                    {needsMinShares && (
                      <ManualField label="최소 청약 수량" value={minSubscriptionShares} onChange={setMinSubscriptionShares} suffix="주" />
                    )}
                    {needsSubscriptionUnit && (
                      <ManualField label="청약 단위" value={subscriptionUnit} onChange={setSubscriptionUnit} suffix="주" />
                    )}
                    {needsAnyCompetition && (
                      <ManualField label="전체 경쟁률" value={overallCompetitionRate} onChange={setOverallCompetitionRate} suffix=":1" />
                    )}
                    {needsAnyCompetition && (
                      <ManualField label="균등 경쟁률" value={equalCompetitionRate} onChange={setEqualCompetitionRate} suffix=":1" />
                    )}
                    {needsAnyCompetition && (
                      <ManualField label="비례 경쟁률" value={proportionalCompetitionRate} onChange={setProportionalCompetitionRate} suffix=":1" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {selectedBroker && result && resolvedBroker && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-[#111827]">{selectedBroker.brokerName} 계산 결과</h4>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(result.status)}`}>
                  {result.mode === 'final-estimate' ? '경쟁률 반영 자동 계산' : '사전 자동 계산'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ResultCard label="최소 청약 증거금" value={formatCurrency(result.minimumDeposit)} />
                <ResultCard label="최대 청약 가능 수량" value={formatShareValue(result.maximumShares)} />
                <ResultCard label="입력 기준 청약 수량" value={formatShareValue(result.requestedShares)} />
                <ResultCard label="필요 증거금" value={formatCurrency(result.requiredDeposit)} />
                <ResultCard label="균등 예상 배정" value={formatShareValue(result.expectedEqualShares)} hint={`1주 배정 확률 ${result.equalOneShareProbability !== null ? `${(result.equalOneShareProbability * 100).toFixed(1)}%` : '-'}`} />
                <ResultCard label="비례 예상 배정" value={formatShareValue(result.expectedProportionalShares)} />
                <ResultCard label="전체 경쟁률 기준" value={formatShareValue(result.expectedOverallShares)} hint={result.usedOverallCompetitionProxy ? '균등/비례 분리값 부재 시 사용' : undefined} />
                <ResultCard label="총 예상 배정" value={formatShareValue(result.expectedTotalShares)} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#4B5563]">
                  <div className="text-sm font-semibold text-[#111827]">선택 주간사 메타데이터</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>증거금률: {formatRatePercent(resolvedBroker.depositRate)}</div>
                    <div>최소 청약 수량: {formatShareValue(resolvedBroker.minSubscriptionShares)}</div>
                    <div>청약 단위: {formatShareValue(resolvedBroker.subscriptionUnit)}</div>
                    <div>전체 경쟁률: {formatCompetition(resolvedBroker.overallCompetitionRate)}</div>
                    <div>균등 경쟁률: {formatCompetition(resolvedBroker.equalCompetitionRate)}</div>
                    <div>비례 경쟁률: {formatCompetition(resolvedBroker.proportionalCompetitionRate)}</div>
                    <div>수수료: {selectedBroker.feesText ?? formatCurrency(selectedBroker.feeAmount)}</div>
                    <div>계좌 조건: {selectedBroker.accountRestrictionText ?? '-'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#4B5563]">
                  <div className="text-sm font-semibold text-[#111827]">자동 수집 출처</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topTrace.map((entry, index) => (
                      <span
                        key={`${entry.field}-${entry.brokerName ?? 'deal'}-${index}`}
                        className="rounded-full border border-[#D1D5DB] bg-white px-3 py-1 text-xs"
                      >
                        {entry.brokerName ? `${entry.brokerName} · ` : ''}
                        {entry.field} · {sourceLabel(entry.source)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {(result.blockingFields.length > 0 || result.warnings.length > 0 || deal.calculator.calcReadiness.warnings.length > 0) && (
                <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
                  <div className="font-semibold">확인 필요</div>
                  <div className="mt-2 space-y-1">
                    {result.blockingFields.map((field) => (
                      <div key={field}>- 자동 계산 차단 필드: {field}</div>
                    ))}
                    {deal.calculator.calcReadiness.warnings.map((warning) => (
                      <div key={warning}>- {warning}</div>
                    ))}
                    {result.warnings.map((warning) => (
                      <div key={warning}>- {warning}</div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
