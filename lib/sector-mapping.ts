/**
 * Sector mapping for stocks
 * Used for portfolio analysis and diversification recommendations
 */

export type Sector =
  | 'IT'
  | '반도체'
  | '금융'
  | '소비재'
  | '헬스케어'
  | '에너지'
  | '산업재'
  | '소재'
  | '유틸리티'
  | '부동산'
  | '커뮤니케이션'
  | '기타';

export const SECTOR_LABELS: Record<Sector, string> = {
  IT: '정보기술',
  반도체: '반도체',
  금융: '금융',
  소비재: '소비재',
  헬스케어: '헬스케어',
  에너지: '에너지',
  산업재: '산업재',
  소재: '소재',
  유틸리티: '유틸리티',
  부동산: '부동산',
  커뮤니케이션: '커뮤니케이션',
  기타: '기타',
};

export const SECTOR_COLORS: Record<Sector, string> = {
  IT: '#3B82F6',
  반도체: '#8B5CF6',
  금융: '#10B981',
  소비재: '#F59E0B',
  헬스케어: '#EF4444',
  에너지: '#6366F1',
  산업재: '#EC4899',
  소재: '#14B8A6',
  유틸리티: '#84CC16',
  부동산: '#F97316',
  커뮤니케이션: '#06B6D4',
  기타: '#6B7280',
};

// Korean stocks sector mapping
export const KOREA_SECTOR_MAP: Record<string, Sector> = {
  // IT / Software
  '035720': 'IT', // 카카오
  '035420': 'IT', // NAVER
  '263750': 'IT', // 펄어비스
  '036570': 'IT', // 엔씨소프트
  '251270': 'IT', // 넷마블
  '352820': 'IT', // 하이브

  // Semiconductors
  '005930': '반도체', // 삼성전자
  '000660': '반도체', // SK하이닉스
  '005935': '반도체', // 삼성전자우
  '402340': '반도체', // SK스퀘어

  // Finance
  '105560': '금융', // KB금융
  '055550': '금융', // 신한지주
  '086790': '금융', // 하나금융지주
  '316140': '금융', // 우리금융지주
  '024110': '금융', // 기업은행
  '175330': '금융', // JB금융지주

  // Consumer
  '207940': '소비재', // 삼성바이오로직스
  '051910': '소비재', // LG화학
  '003670': '소비재', // 포스코퓨처엠
  '006400': '소비재', // 삼성SDI
  '373220': '소비재', // LG에너지솔루션
  '012330': '소비재', // 현대모비스

  // Healthcare
  '068270': '헬스케어', // 셀트리온
  '091990': '헬스케어', // 셀트리온헬스케어
  '326030': '헬스케어', // SK바이오팜
  '128940': '헬스케어', // 한미약품
  '000100': '헬스케어', // 유한양행

  // Energy
  '096770': '에너지', // SK이노베이션
  '010950': '에너지', // S-Oil
  '267250': '에너지', // HD현대

  // Industrial
  '005380': '산업재', // 현대차
  '000270': '산업재', // 기아
  '005387': '산업재', // 현대차2우B
  '009150': '산업재', // 삼성전기
  '028260': '산업재', // 삼성물산
  '034730': '산업재', // SK

  // Materials
  '005490': '소재', // POSCO홀딩스
  '010130': '소재', // 고려아연
  '011170': '소재', // 롯데케미칼

  // Utilities
  '015760': '유틸리티', // 한국전력
  '036460': '유틸리티', // 한국가스공사

  // Communications
  '017670': '커뮤니케이션', // SK텔레콤
  '030200': '커뮤니케이션', // KT
  '032640': '커뮤니케이션', // LG유플러스
};

// US stocks sector mapping
export const US_SECTOR_MAP: Record<string, Sector> = {
  // IT / Software
  AAPL: 'IT',
  MSFT: 'IT',
  GOOGL: 'IT',
  GOOG: 'IT',
  META: 'IT',
  CRM: 'IT',
  ADBE: 'IT',
  ORCL: 'IT',
  NOW: 'IT',
  INTU: 'IT',

  // Semiconductors
  NVDA: '반도체',
  AMD: '반도체',
  INTC: '반도체',
  AVGO: '반도체',
  QCOM: '반도체',
  TXN: '반도체',
  MU: '반도체',
  AMAT: '반도체',
  LRCX: '반도체',
  KLAC: '반도체',
  TSM: '반도체',
  ASML: '반도체',

  // Finance
  JPM: '금융',
  BAC: '금융',
  WFC: '금융',
  GS: '금융',
  MS: '금융',
  C: '금융',
  BLK: '금융',
  SCHW: '금융',
  V: '금융',
  MA: '금융',

  // Consumer
  AMZN: '소비재',
  TSLA: '소비재',
  HD: '소비재',
  MCD: '소비재',
  NKE: '소비재',
  SBUX: '소비재',
  TGT: '소비재',
  COST: '소비재',
  WMT: '소비재',

  // Healthcare
  JNJ: '헬스케어',
  UNH: '헬스케어',
  PFE: '헬스케어',
  ABBV: '헬스케어',
  MRK: '헬스케어',
  LLY: '헬스케어',
  TMO: '헬스케어',
  ABT: '헬스케어',
  DHR: '헬스케어',

  // Energy
  XOM: '에너지',
  CVX: '에너지',
  COP: '에너지',
  SLB: '에너지',
  EOG: '에너지',

  // Industrial
  CAT: '산업재',
  BA: '산업재',
  HON: '산업재',
  UPS: '산업재',
  RTX: '산업재',
  GE: '산업재',
  MMM: '산업재',
  LMT: '산업재',

  // Materials
  LIN: '소재',
  APD: '소재',
  SHW: '소재',
  ECL: '소재',
  DD: '소재',

  // Utilities
  NEE: '유틸리티',
  DUK: '유틸리티',
  SO: '유틸리티',
  D: '유틸리티',

  // Real Estate
  AMT: '부동산',
  PLD: '부동산',
  CCI: '부동산',
  EQIX: '부동산',

  // Communications
  NFLX: '커뮤니케이션',
  DIS: '커뮤니케이션',
  CMCSA: '커뮤니케이션',
  T: '커뮤니케이션',
  VZ: '커뮤니케이션',
  TMUS: '커뮤니케이션',
};

/**
 * Get sector for a given ticker
 */
export function getSector(ticker: string, market: 'korea' | 'us'): Sector {
  if (market === 'korea') {
    return KOREA_SECTOR_MAP[ticker] || '기타';
  } else {
    return US_SECTOR_MAP[ticker.toUpperCase()] || '기타';
  }
}

/**
 * Get all tickers for a given sector
 */
export function getTickersBySector(sector: Sector, market?: 'korea' | 'us'): string[] {
  const tickers: string[] = [];

  if (!market || market === 'korea') {
    for (const [ticker, s] of Object.entries(KOREA_SECTOR_MAP)) {
      if (s === sector) tickers.push(ticker);
    }
  }

  if (!market || market === 'us') {
    for (const [ticker, s] of Object.entries(US_SECTOR_MAP)) {
      if (s === sector) tickers.push(ticker);
    }
  }

  return tickers;
}

/**
 * Get recommended diversification sectors based on current holdings
 */
export function getRecommendedSectors(currentSectors: Sector[]): Sector[] {
  const sectorCounts = new Map<Sector, number>();
  currentSectors.forEach((s) => {
    sectorCounts.set(s, (sectorCounts.get(s) || 0) + 1);
  });

  const allSectors: Sector[] = [
    'IT',
    '반도체',
    '금융',
    '소비재',
    '헬스케어',
    '에너지',
    '산업재',
    '소재',
    '유틸리티',
    '커뮤니케이션',
  ];

  // Return sectors not in current portfolio or underweight
  return allSectors.filter((s) => !sectorCounts.has(s) || sectorCounts.get(s)! < 2);
}
