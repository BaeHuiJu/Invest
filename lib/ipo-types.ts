export type IpoStatus = '청약예정' | '청약중' | '상장예정' | '상장완료';

export type IpoCalcStatus = 'pre_ready' | 'final_ready' | 'needs_review';

export type IpoCalcPhase = 'pre_subscription' | 'live_subscription' | 'post_close';

export type IpoCalcConfidence = 'high' | 'medium' | 'low';

export type IpoOfferingPriceSource = 'confirmed' | 'band_high' | 'band_low' | 'unknown';

export type IpoFieldSource = 'dart' | 'thirtyeight' | 'broker_rules' | 'derived' | 'unknown';

export type IpoTrackedField =
  | 'offeringPrice'
  | 'depositRate'
  | 'minSubscriptionShares'
  | 'subscriptionUnit'
  | 'maxSubscriptionShares'
  | 'generalAllocationShares'
  | 'equalAllocationShares'
  | 'proportionalAllocationShares'
  | 'overallCompetitionRate'
  | 'equalCompetitionRate'
  | 'proportionalCompetitionRate'
  | 'feeAmount'
  | 'accountRestrictionText';

export interface IpoSourceTraceEntry {
  field: IpoTrackedField;
  source: IpoFieldSource;
  brokerName?: string | null;
  note?: string | null;
}

export interface IpoBrokerOption {
  brokerName: string;
  normalizedBrokerName: string;
  minSubscriptionShares: number | null;
  subscriptionUnit: number | null;
  maxSubscriptionShares: number | null;
  depositRate: number | null;
  equalAllocationAvailable: boolean | null;
  proportionalAllocationAvailable: boolean | null;
  overallCompetitionRate: number | null;
  equalCompetitionRate: number | null;
  proportionalCompetitionRate: number | null;
  generalAllocationShares: number | null;
  equalAllocationShares: number | null;
  proportionalAllocationShares: number | null;
  accountRestrictionText: string | null;
  feesText: string | null;
  feeAmount: number | null;
  notes: string[];
  fieldSources: Partial<Record<IpoTrackedField, IpoFieldSource>>;
}

export interface IpoCalcReadiness {
  preEstimateReady: boolean;
  finalEstimateReady: boolean;
  blockingFields: string[];
  confidence: IpoCalcConfidence;
  warnings: string[];
}

export interface IpoRecommendation {
  bestBrokerByExpectedShares: string | null;
  bestBrokerByLowestDeposit: string | null;
  reason: string | null;
}

export interface IpoCalculatorData {
  status: IpoCalcStatus;
  calcPhase: IpoCalcPhase;
  calcReadiness: IpoCalcReadiness;
  offeringPrice: number | null;
  offeringPriceSource: IpoOfferingPriceSource;
  brokerOptions: IpoBrokerOption[];
  recommendation: IpoRecommendation;
  sourceTrace: IpoSourceTraceEntry[];
  notes: string[];
}

export interface IpoDeal {
  id: string;
  name: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  refundDate: string | null;
  listingDate: string | null;
  priceBandLow: number | null;
  priceBandHigh: number | null;
  confirmedPrice: number | null;
  underwriter: string;
  competitionRatio: string | null;
  status: IpoStatus;
  detailUrl: string;
  calculator: IpoCalculatorData | null;
}

export interface IpoCalendarResponse {
  ipos: IpoDeal[];
  fetchedAt: string;
  totalCount: number;
}
