export type MarketType = 'korea' | 'us';
export type MarketFilter = 'all' | MarketType;
export type PerformanceStatus = 'complete' | 'pending' | 'unavailable';

export interface PerformancePoint {
  asOfDate: string;
  closePrice: number;
  returnPct: number;
  targetProgressPct: number;
  success: boolean;
  status: PerformanceStatus;
}

export interface AnalystReportPerformance {
  week1: PerformancePoint;
  month1: PerformancePoint;
  month3: PerformancePoint;
}

export interface AnalystReport {
  date: string;
  ticker: string;
  name: string;
  market: MarketType;
  broker: string;
  analyst: string;
  opinion: string;
  targetPrice: number;
  currentPrice: number;
  basePrice: number;
  basePriceDate: string;
  upside: number;
  reportTitle?: string;
  sourceUrl?: string;
  sourceText?: string;
  reasonSummary?: string;
  reasonBullets?: string[];
  sector?: string;
  performance?: AnalystReportPerformance;
}

export interface InsightSection {
  summary: string;
  bullets: string[];
  signal?: 'up' | 'down' | 'flat' | 'mixed' | 'unknown';
}

export interface StockInsight {
  ticker: string;
  name: string;
  market: MarketType;
  latestReportDate?: string;
  latestBroker?: string;
  latestOpinion?: string;
  latestTargetPrice?: number;
  latestCurrentPrice?: number;
  latestBasePrice?: number;
  avgUpside?: number;
  reportCount: number;
  reasonSummary: string;
  reasonBullets: string[];
  investmentLogic: InsightSection;
  estimateRevision: InsightSection;
  valuation: InsightSection;
  sectorCycle: InsightSection;
  relatedReports: AnalystReport[];
}

export interface AnalystConsensusItem {
  ticker: string;
  name: string;
  market: MarketType;
  brokerCount: number;
  brokers: string[];
  latestReportDate: string;
  avgUpside: number;
  currentPrice: number;
  basePrice: number;
  basePriceDate: string;
  avgTargetPrice: number;
  entryScore: number;
  entryScoreBreakdown: {
    priceVsBase: number;
    targetGap: number;
    reportCount: number;
    consensusStrength: number;
  };
  reportCount: number;
  relatedReports: AnalystReport[];
}

export interface AnalystReportCacheFile {
  generatedAt: string;
  maxDays: number;
  reports: AnalystReport[];
  stockInsights: Record<string, StockInsight>;
}

export interface StockInsightResponse {
  found: boolean;
  insight: StockInsight;
}

export interface AnalystScorecardPeriodSummary {
  eligibleCount: number;
  successCount: number;
  declineCount: number;
  pendingCount: number;
  unavailableCount: number;
  successRate: number;
  declineRate: number;
  avgReturnPct: number;
  avgTargetProgressPct: number;
}

export interface AnalystScorecardGroup {
  key: string;
  label: string;
  reportCount: number;
  week1: AnalystScorecardPeriodSummary;
  month1: AnalystScorecardPeriodSummary;
  month3: AnalystScorecardPeriodSummary;
}

export interface AnalystScorecardResponse {
  summary: {
    overall: AnalystScorecardGroup;
    byBroker: AnalystScorecardGroup[];
    byMarket: AnalystScorecardGroup[];
    bySector: AnalystScorecardGroup[];
  };
  reports: AnalystReport[];
}

export type SectorCyclePhase = 'recovery' | 'expansion' | 'slowdown' | 'contraction';
export type SectorCycleConfidence = 'low' | 'medium' | 'high';

export interface SectorCycleRecentReport {
  date: string;
  ticker: string;
  name: string;
  market: MarketType;
  broker: string;
  reasonSummary: string;
  currentPrice: number;
}

export interface SectorCycleItem {
  sector: string;
  phase: SectorCyclePhase;
  phaseScore: number;
  confidence: SectorCycleConfidence;
  reportCount: number;
  latestReportDate: string;
  keywords: string[];
  recentReports: SectorCycleRecentReport[];
}

export interface SectorCycleResponse {
  generatedAt: string;
  days: number;
  market: MarketFilter;
  items: SectorCycleItem[];
}

export type RiskLevel = 'low' | 'medium' | 'high';
export type TimeHorizon = '1-3mo' | '3-12mo';

export interface AIPick {
  ticker: string;
  name: string;
  market: MarketType;
  entryScore: number;
  entryScoreBreakdown: {
    priceVsBase: number;
    targetGap: number;
    reportCount: number;
    consensusStrength: number;
  };
  brokerCount: number;
  brokers: string[];
  avgUpside: number;
  avgTargetPrice: number;
  currentPrice: number;
  recommendedPositionSize: number;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  thesis: string;
  brokerSuccessRate: number;
}

export interface AIPicksResponse {
  picks: AIPick[];
  criteria: {
    minEntryScore: number;
    minBrokerCount: number;
    maxDays: number;
  };
  generatedAt: string;
  summary: {
    totalCandidates: number;
    selectedCount: number;
    avgEntryScore: number;
    avgBrokerCount: number;
  };
}
