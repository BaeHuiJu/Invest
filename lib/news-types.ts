export type NewsSentiment = 'positive' | 'negative' | 'neutral';
export type NewsCategory = 'all' | '금리·통화' | '환율' | '수급' | '실적' | '정책';
export type NewsSource = 'domestic' | 'overseas' | 'main';

export interface MarketNewsItem {
  id: string;
  title: string;
  pressName: string;
  publishedAt: string;
  url: string;
  source: NewsSource;
  sentiment: NewsSentiment;
  sentimentScore: number;
  category: NewsCategory;
  isBreaking: boolean;
  beginnerExplanation: string;
  relatedTickers?: string[];
}

export interface MarketNewsCacheFile {
  generatedAt: string;
  domestic: MarketNewsItem[];
  overseas: MarketNewsItem[];
  main: MarketNewsItem[];
}

export interface MarketNewsApiResponse {
  generatedAt: string;
  items: MarketNewsItem[];
  breakingCount: number;
  totalCount?: number;
  filters?: {
    category: NewsCategory;
    sources: NewsSource[];
    search: string;
    ticker: string;
  };
}
