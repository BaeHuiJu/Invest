/**
 * Portfolio Analysis Utilities
 * Analyzes diversification, risk, and provides recommendations
 */

import { getSector, SECTOR_COLORS, SECTOR_LABELS, getTickersBySector, type Sector } from './sector-mapping';

export type MarketType = 'korea' | 'us';

export type PortfolioItem = {
  ticker: string;
  name: string;
  market: MarketType;
  currentPrice?: number;
  weight?: number; // If not provided, equal weight is assumed
};

export type SectorAllocation = {
  sector: Sector;
  label: string;
  color: string;
  count: number;
  weight: number;
  tickers: string[];
};

export type MarketAllocation = {
  market: MarketType;
  label: string;
  count: number;
  weight: number;
};

export type ConcentrationRisk = 'low' | 'medium' | 'high';

export type PortfolioSuggestion = {
  type: 'add_sector' | 'reduce_concentration' | 'add_market' | 'diversify';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  tickers?: { ticker: string; name: string; market: MarketType }[];
};

export type PortfolioAnalysis = {
  totalCount: number;
  sectorAllocation: SectorAllocation[];
  marketAllocation: MarketAllocation[];
  concentrationRisk: ConcentrationRisk;
  diversificationScore: number; // 0-100
  suggestions: PortfolioSuggestion[];
  topHoldings: { ticker: string; name: string; sector: Sector; weight: number }[];
};

/**
 * Analyze a portfolio for diversification and risk
 */
export function analyzePortfolio(items: PortfolioItem[]): PortfolioAnalysis {
  if (items.length === 0) {
    return {
      totalCount: 0,
      sectorAllocation: [],
      marketAllocation: [],
      concentrationRisk: 'low',
      diversificationScore: 0,
      suggestions: [
        {
          type: 'diversify',
          severity: 'info',
          message: '관심종목을 추가하여 포트폴리오 분석을 시작하세요.',
        },
      ],
      topHoldings: [],
    };
  }

  // Calculate equal weights if not provided
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  const normalizedItems = items.map((item) => ({
    ...item,
    weight: ((item.weight || 1) / totalWeight) * 100,
    sector: getSector(item.ticker, item.market),
  }));

  // Sector allocation
  const sectorMap = new Map<Sector, { count: number; weight: number; tickers: string[] }>();
  for (const item of normalizedItems) {
    const existing = sectorMap.get(item.sector) || { count: 0, weight: 0, tickers: [] };
    existing.count++;
    existing.weight += item.weight;
    existing.tickers.push(item.ticker);
    sectorMap.set(item.sector, existing);
  }

  const sectorAllocation: SectorAllocation[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      label: SECTOR_LABELS[sector],
      color: SECTOR_COLORS[sector],
      count: data.count,
      weight: Number(data.weight.toFixed(1)),
      tickers: data.tickers,
    }))
    .sort((a, b) => b.weight - a.weight);

  // Market allocation
  const marketMap = new Map<MarketType, { count: number; weight: number }>();
  for (const item of normalizedItems) {
    const existing = marketMap.get(item.market) || { count: 0, weight: 0 };
    existing.count++;
    existing.weight += item.weight;
    marketMap.set(item.market, existing);
  }

  const marketAllocation: MarketAllocation[] = Array.from(marketMap.entries())
    .map(([market, data]) => ({
      market,
      label: market === 'korea' ? '한국' : '미국',
      count: data.count,
      weight: Number(data.weight.toFixed(1)),
    }))
    .sort((a, b) => b.weight - a.weight);

  // Calculate concentration risk
  const topSectorWeight = sectorAllocation[0]?.weight || 0;
  const uniqueSectors = sectorAllocation.length;

  let concentrationRisk: ConcentrationRisk = 'low';
  if (topSectorWeight >= 60 || uniqueSectors <= 2) {
    concentrationRisk = 'high';
  } else if (topSectorWeight >= 40 || uniqueSectors <= 3) {
    concentrationRisk = 'medium';
  }

  // Calculate diversification score (0-100)
  let diversificationScore = 0;

  // Sector diversity (up to 40 points)
  const sectorPoints = Math.min(40, uniqueSectors * 8);
  diversificationScore += sectorPoints;

  // Market diversity (up to 20 points)
  const marketCount = marketAllocation.length;
  const marketBalance = marketCount === 2
    ? Math.min(20, 20 - Math.abs(marketAllocation[0].weight - marketAllocation[1].weight) / 5)
    : marketCount === 1 ? 10 : 0;
  diversificationScore += marketBalance;

  // Concentration penalty (up to 40 points)
  const concentrationPenalty = topSectorWeight >= 50 ? 0 : (50 - topSectorWeight);
  diversificationScore += Math.min(40, concentrationPenalty);

  diversificationScore = Math.round(Math.min(100, Math.max(0, diversificationScore)));

  // Generate suggestions
  const suggestions: PortfolioSuggestion[] = [];

  // Check for over-concentrated sectors
  for (const sector of sectorAllocation) {
    if (sector.weight >= 50) {
      suggestions.push({
        type: 'reduce_concentration',
        severity: 'critical',
        message: `${sector.label} 섹터 비중이 ${sector.weight.toFixed(1)}%로 과도합니다. 분산을 권장합니다.`,
      });
    } else if (sector.weight >= 35) {
      suggestions.push({
        type: 'reduce_concentration',
        severity: 'warning',
        message: `${sector.label} 섹터 비중이 ${sector.weight.toFixed(1)}%로 높습니다.`,
      });
    }
  }

  // Check for missing sectors
  const missingSectors: Sector[] = ['금융', '헬스케어', '소비재', '에너지'].filter(
    (s) => !sectorMap.has(s as Sector)
  ) as Sector[];

  if (missingSectors.length > 0 && items.length >= 3) {
    for (const sector of missingSectors.slice(0, 2)) {
      const recommendations = getTickersBySector(sector)
        .slice(0, 3)
        .map((ticker) => ({
          ticker,
          name: ticker, // Would need name lookup
          market: (ticker.length <= 4 ? 'us' : 'korea') as MarketType,
        }));

      suggestions.push({
        type: 'add_sector',
        severity: 'info',
        message: `${SECTOR_LABELS[sector]} 섹터 종목 추가를 고려해보세요.`,
        tickers: recommendations,
      });
    }
  }

  // Check for market imbalance
  if (marketCount === 1) {
    const missingMarket = marketAllocation[0].market === 'korea' ? 'us' : 'korea';
    suggestions.push({
      type: 'add_market',
      severity: 'info',
      message: `${missingMarket === 'korea' ? '한국' : '미국'} 시장 종목을 추가하여 지역 분산을 고려해보세요.`,
    });
  } else if (marketCount === 2 && Math.abs(marketAllocation[0].weight - marketAllocation[1].weight) >= 40) {
    suggestions.push({
      type: 'add_market',
      severity: 'info',
      message: `시장 배분이 불균형합니다. 비중이 낮은 시장의 종목 추가를 고려해보세요.`,
    });
  }

  // Top holdings
  const topHoldings = normalizedItems
    .map((item) => ({
      ticker: item.ticker,
      name: item.name,
      sector: item.sector,
      weight: item.weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return {
    totalCount: items.length,
    sectorAllocation,
    marketAllocation,
    concentrationRisk,
    diversificationScore,
    suggestions,
    topHoldings,
  };
}

/**
 * Get diversification score label
 */
export function getDiversificationLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { label: '우수', color: 'text-green-600' };
  } else if (score >= 60) {
    return { label: '양호', color: 'text-blue-600' };
  } else if (score >= 40) {
    return { label: '보통', color: 'text-yellow-600' };
  } else {
    return { label: '미흡', color: 'text-red-600' };
  }
}

/**
 * Get concentration risk label
 */
export function getConcentrationLabel(risk: ConcentrationRisk): {
  label: string;
  color: string;
} {
  switch (risk) {
    case 'low':
      return { label: '낮음', color: 'text-green-600' };
    case 'medium':
      return { label: '보통', color: 'text-yellow-600' };
    case 'high':
      return { label: '높음', color: 'text-red-600' };
  }
}
