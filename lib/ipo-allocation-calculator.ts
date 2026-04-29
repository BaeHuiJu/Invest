import type {
  IpoBrokerOption,
  IpoCalcStatus,
} from '@/lib/ipo-types';

export type IpoCalculationOverrides = {
  offeringPrice?: number | null;
  minSubscriptionShares?: number | null;
  subscriptionUnit?: number | null;
  depositRate?: number | null;
  overallCompetitionRate?: number | null;
  equalCompetitionRate?: number | null;
  proportionalCompetitionRate?: number | null;
};

export type IpoCalculationInput = {
  broker: IpoBrokerOption;
  offeringPrice: number | null;
  budget: number;
  requestedShares: number | null;
  overrides?: IpoCalculationOverrides;
};

export type IpoCalculationResult = {
  status: IpoCalcStatus;
  mode: 'pre-estimate' | 'final-estimate';
  minimumDeposit: number | null;
  minimumShares: number | null;
  maximumShares: number | null;
  requestedShares: number | null;
  requiredDeposit: number | null;
  expectedEqualShares: number | null;
  equalOneShareProbability: number | null;
  expectedProportionalShares: number | null;
  expectedOverallShares: number | null;
  expectedTotalShares: number | null;
  blockingFields: string[];
  warnings: string[];
  usedOverallCompetitionProxy: boolean;
};

export type IpoBrokerComparisonRow = {
  broker: IpoBrokerOption;
  result: IpoCalculationResult;
};

export type IpoBrokerRecommendation = {
  bestBrokerByExpectedShares: string | null;
  bestBrokerByLowestDeposit: string | null;
  reason: string | null;
};

type ResolvedBroker = IpoBrokerOption;

function positiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function scoreValue(value: number | null): number {
  return value === null ? -1 : value;
}

export function resolveBrokerOption(
  broker: IpoBrokerOption,
  overrides: IpoCalculationOverrides | undefined,
): ResolvedBroker {
  return {
    ...broker,
    minSubscriptionShares: positiveNumber(overrides?.minSubscriptionShares ?? broker.minSubscriptionShares),
    subscriptionUnit: positiveNumber(overrides?.subscriptionUnit ?? broker.subscriptionUnit),
    maxSubscriptionShares: positiveNumber(broker.maxSubscriptionShares),
    depositRate: positiveNumber(overrides?.depositRate ?? broker.depositRate),
    overallCompetitionRate: positiveNumber(overrides?.overallCompetitionRate ?? broker.overallCompetitionRate),
    equalCompetitionRate: positiveNumber(overrides?.equalCompetitionRate ?? broker.equalCompetitionRate),
    proportionalCompetitionRate: positiveNumber(
      overrides?.proportionalCompetitionRate ?? broker.proportionalCompetitionRate,
    ),
  };
}

export function calculateIpoAllocation(input: IpoCalculationInput): IpoCalculationResult {
  const warnings: string[] = [];
  const resolved = resolveBrokerOption(input.broker, input.overrides);
  const offeringPrice = positiveNumber(input.overrides?.offeringPrice ?? input.offeringPrice);
  const depositRate = resolved.depositRate;
  const subscriptionUnit = resolved.subscriptionUnit;
  const minSubscriptionShares = resolved.minSubscriptionShares;
  const budget = positiveNumber(input.budget);

  const blockingFields: string[] = [];
  if (!offeringPrice) blockingFields.push('공모가');
  if (!depositRate) blockingFields.push('증거금률');
  if (!subscriptionUnit) blockingFields.push('청약 단위');
  if (!minSubscriptionShares) blockingFields.push('최소 청약 수량');

  const minimumDeposit =
    offeringPrice && depositRate && minSubscriptionShares
      ? roundToTwo(offeringPrice * minSubscriptionShares * depositRate)
      : null;
  const maximumShares =
    offeringPrice && depositRate && subscriptionUnit && budget
      ? Math.floor(budget / (offeringPrice * depositRate) / subscriptionUnit) * subscriptionUnit
      : null;
  const cappedMaximumShares =
    maximumShares !== null && resolved.maxSubscriptionShares
      ? Math.min(maximumShares, resolved.maxSubscriptionShares)
      : maximumShares;

  let normalizedRequestedShares = positiveNumber(input.requestedShares) ?? cappedMaximumShares;
  if (normalizedRequestedShares && subscriptionUnit) {
    normalizedRequestedShares =
      Math.floor(normalizedRequestedShares / subscriptionUnit) * subscriptionUnit || normalizedRequestedShares;
  }
  if (normalizedRequestedShares !== null && resolved.maxSubscriptionShares) {
    normalizedRequestedShares = Math.min(normalizedRequestedShares, resolved.maxSubscriptionShares);
  }

  const requiredDeposit =
    offeringPrice && depositRate && normalizedRequestedShares
      ? roundToTwo(offeringPrice * normalizedRequestedShares * depositRate)
      : null;

  if (minimumDeposit && budget && budget < minimumDeposit) {
    warnings.push('입력한 증거금으로는 최소 청약 수량을 충족하지 못합니다.');
  }
  if (normalizedRequestedShares && minSubscriptionShares && normalizedRequestedShares < minSubscriptionShares) {
    warnings.push('입력한 청약 수량이 최소 청약 수량보다 적습니다.');
  }

  const equalCompetitionRate = resolved.equalCompetitionRate;
  const proportionalCompetitionRate = resolved.proportionalCompetitionRate;
  const overallCompetitionRate = resolved.overallCompetitionRate;

  const expectedEqualShares =
    resolved.equalAllocationAvailable === false
      ? 0
      : equalCompetitionRate
        ? roundToTwo(1 / equalCompetitionRate)
        : null;
  const equalOneShareProbability =
    resolved.equalAllocationAvailable === false
      ? 0
      : equalCompetitionRate
        ? roundToTwo(Math.min(1, 1 / equalCompetitionRate))
        : null;

  let usedOverallCompetitionProxy = false;
  const expectedProportionalShares =
    resolved.proportionalAllocationAvailable === false
      ? 0
      : proportionalCompetitionRate && normalizedRequestedShares
        ? roundToTwo(normalizedRequestedShares / proportionalCompetitionRate)
        : null;
  const expectedOverallShares =
    overallCompetitionRate && normalizedRequestedShares
      ? roundToTwo(normalizedRequestedShares / overallCompetitionRate)
      : null;

  let totalShares: number | null = null;
  if (expectedEqualShares !== null || expectedProportionalShares !== null) {
    totalShares = roundToTwo((expectedEqualShares ?? 0) + (expectedProportionalShares ?? 0));
  } else if (expectedOverallShares !== null) {
    totalShares = expectedOverallShares;
    usedOverallCompetitionProxy = true;
    warnings.push('균등/비례 분리 경쟁률이 없어 전체 경쟁률 기준 근사치로 계산했습니다.');
  }

  const preEstimateReady = blockingFields.length === 0;
  const finalEstimateReady =
    preEstimateReady &&
    Boolean(
      equalCompetitionRate ||
        proportionalCompetitionRate ||
        overallCompetitionRate,
    );

  const mode: 'pre-estimate' | 'final-estimate' = finalEstimateReady ? 'final-estimate' : 'pre-estimate';
  const status: IpoCalcStatus = finalEstimateReady ? 'final_ready' : preEstimateReady ? 'pre_ready' : 'needs_review';

  if (preEstimateReady && !finalEstimateReady) {
    warnings.push('경쟁률 확정 전 단계라 최소 증거금과 청약 가능 수량 위주로 자동 계산합니다.');
  }

  return {
    status,
    mode,
    minimumDeposit,
    minimumShares: minSubscriptionShares,
    maximumShares: cappedMaximumShares,
    requestedShares: normalizedRequestedShares,
    requiredDeposit,
    expectedEqualShares,
    equalOneShareProbability,
    expectedProportionalShares,
    expectedOverallShares,
    expectedTotalShares: totalShares,
    blockingFields,
    warnings,
    usedOverallCompetitionProxy,
  };
}

export function compareBrokerOptions(input: {
  brokers: IpoBrokerOption[];
  offeringPrice: number | null;
  budget: number;
  requestedShares: number | null;
  overrides?: IpoCalculationOverrides;
}): { rows: IpoBrokerComparisonRow[]; recommendation: IpoBrokerRecommendation } {
  const rows = input.brokers.map((broker) => ({
    broker,
    result: calculateIpoAllocation({
      broker,
      offeringPrice: input.offeringPrice,
      budget: input.budget,
      requestedShares: input.requestedShares,
      overrides: input.overrides,
    }),
  }));

  const bestByExpectedShares = [...rows]
    .filter((row) => row.result.status !== 'needs_review')
    .sort((left, right) => {
      const shareGap = scoreValue(right.result.expectedTotalShares ?? right.result.expectedOverallShares) -
        scoreValue(left.result.expectedTotalShares ?? left.result.expectedOverallShares);
      if (shareGap !== 0) return shareGap;

      const depositGap = scoreValue(left.result.requiredDeposit ?? left.result.minimumDeposit) -
        scoreValue(right.result.requiredDeposit ?? right.result.minimumDeposit);
      if (depositGap !== 0) return depositGap;

      return scoreValue(left.broker.feeAmount) - scoreValue(right.broker.feeAmount);
    })[0];

  const bestByLowestDeposit = [...rows]
    .filter((row) => row.result.minimumDeposit !== null)
    .sort((left, right) => {
      const depositGap = scoreValue(left.result.minimumDeposit) - scoreValue(right.result.minimumDeposit);
      if (depositGap !== 0) return depositGap;
      return scoreValue(left.broker.feeAmount) - scoreValue(right.broker.feeAmount);
    })[0];

  let reason: string | null = null;
  if (bestByExpectedShares?.broker.brokerName && bestByLowestDeposit?.broker.brokerName) {
    if (bestByExpectedShares.broker.brokerName === bestByLowestDeposit.broker.brokerName) {
      reason = `${bestByExpectedShares.broker.brokerName}이(가) 예상 배정 수량과 최소 증거금 조건을 함께 만족합니다.`;
    } else {
      reason = `${bestByExpectedShares.broker.brokerName}은(는) 예상 배정 수량 기준 추천이고, ${bestByLowestDeposit.broker.brokerName}은(는) 최소 증거금 기준 추천입니다.`;
    }
  }

  return {
    rows,
    recommendation: {
      bestBrokerByExpectedShares: bestByExpectedShares?.broker.brokerName ?? null,
      bestBrokerByLowestDeposit: bestByLowestDeposit?.broker.brokerName ?? null,
      reason,
    },
  };
}
