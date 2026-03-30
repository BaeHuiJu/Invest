export type MarketType = 'korea' | 'us';
export type MarketFilter = 'all' | MarketType;

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
