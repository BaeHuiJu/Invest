export interface AnalystReport {
  date: string;
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  broker: string;
  analyst: string;
  opinion: string;
  targetPrice: number;
  currentPrice: number;
  upside: number;
  reportTitle?: string;
}

export interface AnalystReportCacheFile {
  generatedAt: string;
  maxDays: number;
  reports: AnalystReport[];
}
