// ETF 데이터 타입 정의
export interface ETF {
  ticker: string;
  name: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
  return1m: number;
  return3m: number;
  return6m: number;
  volume: number;
  aum?: number;
  expenseRatio?: number;
  dividendYield?: number;
}

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
  summary: string;
}

// 국내 ETF 샘플 데이터
export const koreaETFs: ETF[] = [
  { ticker: "069500", name: "KODEX 200", category: "대형주", price: 35420, change: 280, changePercent: 0.80, return1m: 2.5, return3m: 5.8, return6m: 12.3, volume: 5234000, aum: 5000000000000, expenseRatio: 0.15 },
  { ticker: "122630", name: "KODEX 레버리지", category: "레버리지", price: 18750, change: 450, changePercent: 2.46, return1m: 5.2, return3m: 11.5, return6m: 24.8, volume: 8920000, aum: 3000000000000, expenseRatio: 0.64 },
  { ticker: "091160", name: "KODEX 반도체", category: "반도체", price: 15230, change: -120, changePercent: -0.78, return1m: -1.2, return3m: 8.5, return6m: 32.1, volume: 2340000, aum: 800000000000, expenseRatio: 0.45 },
  { ticker: "278530", name: "KODEX 2차전지산업", category: "2차전지", price: 12450, change: 180, changePercent: 1.47, return1m: 3.8, return3m: -2.5, return6m: -15.2, volume: 1560000, aum: 600000000000, expenseRatio: 0.45 },
  { ticker: "364980", name: "KODEX Fn K-바이오", category: "바이오", price: 8920, change: 65, changePercent: 0.73, return1m: 1.5, return3m: 4.2, return6m: -8.5, volume: 890000, aum: 200000000000, expenseRatio: 0.40 },
  { ticker: "102110", name: "TIGER 200", category: "대형주", price: 35180, change: 260, changePercent: 0.74, return1m: 2.4, return3m: 5.6, return6m: 12.0, volume: 3450000, aum: 4500000000000, expenseRatio: 0.05 },
  { ticker: "139260", name: "TIGER 200 IT", category: "IT", price: 28650, change: 320, changePercent: 1.13, return1m: 4.2, return3m: 12.8, return6m: 28.5, volume: 1230000, aum: 350000000000, expenseRatio: 0.40 },
  { ticker: "411060", name: "ACE 미국빅테크TOP7 Plus", category: "해외", price: 18920, change: 280, changePercent: 1.50, return1m: 5.8, return3m: 18.2, return6m: 42.5, volume: 2100000, aum: 250000000000, expenseRatio: 0.30 },
];

// 해외 ETF 샘플 데이터
export const usETFs: ETF[] = [
  { ticker: "SPY", name: "SPDR S&P 500 ETF", category: "S&P500", price: 528.45, change: 3.25, changePercent: 0.62, return1m: 3.2, return3m: 8.5, return6m: 15.2, volume: 45000000, aum: 500000000000, expenseRatio: 0.09, dividendYield: 1.3 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", category: "NASDAQ", price: 454.80, change: 5.60, changePercent: 1.25, return1m: 5.8, return3m: 12.5, return6m: 22.8, volume: 35000000, aum: 250000000000, expenseRatio: 0.20, dividendYield: 0.5 },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial", category: "다우존스", price: 398.20, change: 1.80, changePercent: 0.45, return1m: 2.1, return3m: 5.2, return6m: 10.5, volume: 3500000, aum: 35000000000, expenseRatio: 0.16, dividendYield: 1.8 },
  { ticker: "IWM", name: "iShares Russell 2000", category: "중소형주", price: 205.30, change: 2.10, changePercent: 1.03, return1m: 4.2, return3m: 6.8, return6m: 12.0, volume: 25000000, aum: 65000000000, expenseRatio: 0.19, dividendYield: 1.2 },
  { ticker: "SOXX", name: "iShares Semiconductor", category: "반도체", price: 252.60, change: 4.80, changePercent: 1.94, return1m: 8.5, return3m: 22.5, return6m: 48.2, volume: 5200000, aum: 12000000000, expenseRatio: 0.35, dividendYield: 0.7 },
  { ticker: "XLK", name: "Technology Select SPDR", category: "기술", price: 215.40, change: 2.90, changePercent: 1.36, return1m: 5.2, return3m: 14.8, return6m: 28.5, volume: 8500000, aum: 65000000000, expenseRatio: 0.10, dividendYield: 0.6 },
  { ticker: "GLD", name: "SPDR Gold Shares", category: "금", price: 218.50, change: -0.80, changePercent: -0.36, return1m: 2.8, return3m: 8.2, return6m: 15.8, volume: 6800000, aum: 58000000000, expenseRatio: 0.40, dividendYield: 0 },
  { ticker: "TLT", name: "iShares 20+ Year Treasury", category: "채권", price: 92.30, change: 0.45, changePercent: 0.49, return1m: -1.2, return3m: -5.8, return6m: -12.5, volume: 18000000, aum: 42000000000, expenseRatio: 0.15, dividendYield: 3.8 },
  { ticker: "VWO", name: "Vanguard Emerging Markets", category: "신흥국", price: 44.80, change: 0.35, changePercent: 0.79, return1m: 2.5, return3m: 4.8, return6m: 8.2, volume: 12000000, aum: 85000000000, expenseRatio: 0.08, dividendYield: 2.8 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity", category: "배당", price: 82.60, change: 0.55, changePercent: 0.67, return1m: 1.8, return3m: 4.2, return6m: 8.5, volume: 5500000, aum: 55000000000, expenseRatio: 0.06, dividendYield: 3.4 },
];

// 애널리스트 리포트 샘플 데이터
export const analystReports: AnalystReport[] = [
  { date: "2024-03-25", ticker: "005930", name: "삼성전자", market: "korea", broker: "삼성증권", analyst: "김현수", opinion: "매수", targetPrice: 95000, currentPrice: 72500, upside: 31.0, summary: "AI 반도체 수요 확대로 HBM 매출 성장 기대" },
  { date: "2024-03-25", ticker: "000660", name: "SK하이닉스", market: "korea", broker: "미래에셋증권", analyst: "이정민", opinion: "적극매수", targetPrice: 220000, currentPrice: 178000, upside: 23.6, summary: "HBM3E 양산 본격화, AI 서버향 수요 폭증" },
  { date: "2024-03-24", ticker: "NVDA", name: "NVIDIA", market: "us", broker: "Goldman Sachs", analyst: "Toshiya Hari", opinion: "Buy", targetPrice: 1100, currentPrice: 950, upside: 15.8, summary: "Blackwell architecture driving next growth phase" },
  { date: "2024-03-24", ticker: "035420", name: "NAVER", market: "korea", broker: "KB증권", analyst: "박성민", opinion: "매수", targetPrice: 280000, currentPrice: 195000, upside: 43.6, summary: "검색 광고 회복 및 커머스 성장 가속화" },
  { date: "2024-03-23", ticker: "AAPL", name: "Apple Inc", market: "us", broker: "Morgan Stanley", analyst: "Erik Woodring", opinion: "Overweight", targetPrice: 220, currentPrice: 178, upside: 23.6, summary: "iPhone 16 cycle and Services growth momentum" },
  { date: "2024-03-23", ticker: "373220", name: "LG에너지솔루션", market: "korea", broker: "신한투자증권", analyst: "최원석", opinion: "매수", targetPrice: 480000, currentPrice: 385000, upside: 24.7, summary: "북미 IRA 수혜 및 ESS 시장 확대" },
  { date: "2024-03-22", ticker: "MSFT", name: "Microsoft", market: "us", broker: "JP Morgan", analyst: "Mark Murphy", opinion: "Overweight", targetPrice: 480, currentPrice: 428, upside: 12.1, summary: "Azure AI services driving cloud growth acceleration" },
  { date: "2024-03-22", ticker: "006400", name: "삼성SDI", market: "korea", broker: "하나증권", analyst: "김준성", opinion: "매수", targetPrice: 520000, currentPrice: 395000, upside: 31.6, summary: "46시리즈 배터리 양산 본격화" },
];

// 시장 현황 데이터
export const marketIndices = [
  { name: "KOSPI", value: 2678.42, change: 18.25, changePercent: 0.69 },
  { name: "KOSDAQ", value: 892.15, change: -3.42, changePercent: -0.38 },
  { name: "S&P 500", value: 5234.18, change: 32.45, changePercent: 0.62 },
  { name: "NASDAQ", value: 16428.82, change: 145.28, changePercent: 0.89 },
];

// 가격 히스토리 생성 함수
export function generatePriceHistory(basePrice: number, days: number = 30): { date: string; price: number }[] {
  const history: { date: string; price: number }[] = [];
  let price = basePrice * 0.9;

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    price = price * (1 + (Math.random() - 0.48) * 0.03);
    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(price * 100) / 100
    });
  }

  return history;
}
