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
  reasonSummary?: string;
  reasonBullets?: string[];
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
