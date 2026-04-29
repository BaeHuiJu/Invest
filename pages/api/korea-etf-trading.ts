import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';

type ActionType = '매수' | '단기 테마' | '인버스' | '관망';
type MarketRegime = 'risk_on' | 'rotation' | 'risk_off' | 'chop';
type SetupType = '눌림목' | '돌파추종' | '반등시도' | '회피';
type HoldingWindow = '당일' | '1-2일' | '2-3일';
type EtfType = 'market' | 'leveraged' | 'inverse' | 'sector' | 'theme';

export interface KoreaEtfTradingDecision {
  action: ActionType;
  etf: {
    name: string;
    ticker: string;
  };
  reasons: {
    fundFlow: string;
    strengthRotation: string;
    sustainability: string;
  };
  strategy: {
    entry: string;
    splitBuy: boolean;
    pullbackPercent: number;
  };
  targetStop: {
    targetPercent: number;
    stopPercent: number;
  };
  failurePlan: {
    reentry: string;
    rotation: string;
  };
  confidence: {
    probability: number;
    level: string;
  };
  marketRegime: MarketRegime;
  holdingWindow: HoldingWindow;
  setupType: SetupType;
  scoreSummary: {
    momentum: number;
    flow: number;
    heat: number;
    setup: number;
  };
  whyNotOthers: Array<{
    ticker: string;
    name: string;
    reason: string;
  }>;
  pricePlan: {
    entryZone: {
      low: number;
      high: number;
      reference: number;
      basis: string;
    };
    stopLoss: {
      price: number;
      percent: number;
      basis: string;
    };
    takeProfit: {
      firstPrice: number;
      firstPercent: number;
      finalPrice: number;
      finalPercent: number;
      basis: string;
    };
    riskReward: {
      firstTarget: number;
      finalTarget: number;
    };
    explanation: string;
  } | null;
  marketSnapshot: string;
  generatedAt: string;
  model: string;
}

type CacheEntry = {
  data: KoreaEtfTradingDecision;
  fetchedAt: number;
};

type MarketProxySnapshot = {
  ticker: string;
  name: string;
  value: number;
  changePercent: number;
};

type HistoryRow = {
  date: string;
  close: number;
  volume: number;
};

type EtfSnapshotRow = {
  ticker: string;
  name: string;
  type: EtfType;
  closePrice: number;
  changePrice: number;
  changePercent: number;
  volume: number;
  tradingValue: number;
  recent3dReturn: number;
  recent5dReturn: number;
  twentyDayGapPercent: number;
  volumeMultiple3d: number;
  tradingValueChangePercent: number;
  volatility5d: number;
  momentumScore: number;
  flowScore: number;
  heatScore: number;
  rotationScore: number;
  setupScore: number;
  signalScore: number;
  relativeRankWithinType: number;
};

type PricePlan = NonNullable<KoreaEtfTradingDecision['pricePlan']>;

type MarketSnapshotPayload = {
  generatedAtKst: string;
  note: string;
  marketContext: {
    regimeHint: MarketRegime;
    riskSignal: string;
    proxies: {
      kospi: MarketProxySnapshot | null;
      kosdaq: MarketProxySnapshot | null;
      nasdaq: MarketProxySnapshot | null;
      semis: MarketProxySnapshot | null;
      usdkrw: MarketProxySnapshot | null;
      us10y: MarketProxySnapshot | null;
    };
  };
  etfs: EtfSnapshotRow[];
};

type QuoteRow = {
  ticker: string;
  name: string;
  closePrice: number;
  changePrice: number;
  changePercent: number;
  volume: number;
  tradingValue: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
let inflight: Promise<KoreaEtfTradingDecision> | null = null;

const ETF_UNIVERSE: Array<{ ticker: string; name: string; type: EtfType }> = [
  { ticker: '069500', name: 'KODEX 200', type: 'market' },
  { ticker: '102110', name: 'TIGER 200', type: 'market' },
  { ticker: '229200', name: 'KODEX 코스닥150', type: 'market' },
  { ticker: '233740', name: 'KODEX 코스닥150레버리지', type: 'leveraged' },
  { ticker: '122630', name: 'KODEX 레버리지', type: 'leveraged' },
  { ticker: '252670', name: 'KODEX 200선물인버스2X', type: 'inverse' },
  { ticker: '114800', name: 'KODEX 인버스', type: 'inverse' },
  { ticker: '091160', name: 'KODEX 반도체', type: 'sector' },
  { ticker: '139260', name: 'TIGER 200 IT', type: 'sector' },
  { ticker: '305720', name: 'KODEX 2차전지산업', type: 'theme' },
  { ticker: '364980', name: 'TIGER 2차전지테마', type: 'theme' },
  { ticker: '266360', name: 'KODEX 미디어&엔터테인먼트', type: 'theme' },
  { ticker: '228790', name: 'TIGER 화장품', type: 'theme' },
  { ticker: '140710', name: 'KODEX 운송', type: 'sector' },
  { ticker: '117700', name: 'KODEX 건설', type: 'sector' },
  { ticker: '117680', name: 'KODEX 철강', type: 'sector' },
  { ticker: '157490', name: 'TIGER 소프트웨어', type: 'theme' },
];

const MARKET_PROXIES = {
  kospi: { ticker: '^KS11', name: 'KOSPI' },
  kosdaq: { ticker: '^KQ11', name: 'KOSDAQ' },
  nasdaq: { ticker: '^IXIC', name: 'NASDAQ' },
  semis: { ticker: 'SOXX', name: 'SOXX' },
  usdkrw: { ticker: 'KRW=X', name: 'USD/KRW' },
  us10y: { ticker: '^TNX', name: 'US 10Y' },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundPrice(value: number): number {
  if (value >= 100000) return Math.round(value / 100) * 100;
  if (value >= 10000) return Math.round(value / 10) * 10;
  return Math.round(value);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${round(value, 1)}%`;
}

function entryMode(entry: string): 'open' | 'pullback' | 'close' | 'avoid' {
  if (entry.includes('눌림')) return 'pullback';
  if (entry.includes('종가')) return 'close';
  if (entry.includes('진입 금지')) return 'avoid';
  return 'open';
}

function buildPricePlan(decision: KoreaEtfTradingDecision, etf: EtfSnapshotRow | undefined): PricePlan | null {
  if (!etf || decision.action === '관망' || decision.etf.ticker === 'NONE') {
    return null;
  }

  const mode = entryMode(decision.strategy.entry);
  if (mode === 'avoid') {
    return null;
  }

  const currentPrice = etf.closePrice;
  const pullbackPercent = clamp(decision.strategy.pullbackPercent || 0, 0, 5);
  const volatility = clamp(etf.volatility5d || 0, 0.2, 4.5);
  const heatPenalty = Math.max(0, (decision.scoreSummary.heat - 70) * 0.01);
  const setupBonus = Math.max(0, (decision.scoreSummary.setup - 55) * 0.008);

  let referencePrice = currentPrice;
  let zoneWidthPercent = 0.35;
  let entryBasis = '현재가 기준 시초 강도 확인 구간';

  if (mode === 'pullback') {
    referencePrice = currentPrice * (1 - pullbackPercent / 100);
    zoneWidthPercent = clamp(0.35 + volatility * 0.12, 0.35, 0.95);
    entryBasis = `현재가 대비 ${round(pullbackPercent, 1)}% 눌림 구간`;
  } else if (mode === 'close') {
    referencePrice = currentPrice * (1 - Math.min(pullbackPercent, 0.4) / 100);
    zoneWidthPercent = clamp(0.22 + volatility * 0.08, 0.22, 0.55);
    entryBasis = '종가 확인 후 추세 유지 구간';
  } else {
    zoneWidthPercent = clamp(0.25 + volatility * 0.08, 0.25, 0.6);
  }

  const entryLow = roundPrice(referencePrice * (1 - zoneWidthPercent / 100));
  const entryHigh = roundPrice(referencePrice * (1 + zoneWidthPercent / 100));
  const entryReference = roundPrice(referencePrice);

  const baseStopPercent = Math.abs(decision.targetStop.stopPercent || -1.5);
  const stopPercent = clamp(baseStopPercent + volatility * 0.45 + setupBonus - heatPenalty, 0.9, 3.5);
  const stopPrice = roundPrice(entryReference * (1 - stopPercent / 100));

  let finalTargetPercent = Math.max(decision.targetStop.targetPercent || 0, stopPercent * 1.8, 2.4);
  let firstTargetPercent = Math.max(round(finalTargetPercent * 0.55, 1), round(stopPercent * 1.2, 1), 1.4);

  if (firstTargetPercent >= finalTargetPercent) {
    firstTargetPercent = round(finalTargetPercent - 0.6, 1);
  }
  if (firstTargetPercent < 0.8) {
    firstTargetPercent = 0.8;
  }

  finalTargetPercent = round(finalTargetPercent, 1);
  const firstPrice = roundPrice(entryReference * (1 + firstTargetPercent / 100));
  const finalPrice = roundPrice(entryReference * (1 + finalTargetPercent / 100));
  const firstRiskReward = round(firstTargetPercent / stopPercent, 2);
  const finalRiskReward = round(finalTargetPercent / stopPercent, 2);

  return {
    entryZone: {
      low: Math.min(entryLow, entryHigh),
      high: Math.max(entryLow, entryHigh),
      reference: entryReference,
      basis: entryBasis,
    },
    stopLoss: {
      price: stopPrice,
      percent: round(stopPercent, 1),
      basis: `5일 변동성 ${round(volatility, 2)}%와 과열도/진입 적합도를 반영한 동적 손절`,
    },
    takeProfit: {
      firstPrice,
      firstPercent: firstTargetPercent,
      finalPrice,
      finalPercent: finalTargetPercent,
      basis: '1차 분할 익절 후 최종 목표가까지 추세를 보는 2단계 매도',
    },
    riskReward: {
      firstTarget: firstRiskReward,
      finalTarget: finalRiskReward,
    },
    explanation:
      mode === 'pullback'
        ? `눌림 구간 ${entryLow.toLocaleString('ko-KR')}원~${entryHigh.toLocaleString('ko-KR')}원에서 분할 진입하고, 이탈 시 ${stopPrice.toLocaleString('ko-KR')}원 손절을 기준으로 봅니다.`
        : mode === 'close'
          ? `종가 기준으로 ${entryLow.toLocaleString('ko-KR')}원~${entryHigh.toLocaleString('ko-KR')}원 구간을 확인하고, 추세 유지 시 진입합니다.`
          : `시초 강도 유지 시 ${entryLow.toLocaleString('ko-KR')}원~${entryHigh.toLocaleString('ko-KR')}원 구간을 진입 범위로 보고 ${stopPrice.toLocaleString('ko-KR')}원 이탈 시 정리합니다.`,
  };
}

function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function fetchNaverEtf(ticker: string): Promise<QuoteRow | null> {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      ticker,
      name: data.stockName || data.stockNameEng || ticker,
      closePrice: parseNumericValue(data.closePrice),
      changePrice: parseNumericValue(data.compareToPreviousClosePrice),
      changePercent: parseNumericValue(data.fluctuationsRatio),
      volume: parseNumericValue(data.accumulatedTradingVolume),
      tradingValue: parseNumericValue(data.accumulatedTradingValue),
    };
  } catch {
    return null;
  }
}

async function fetchNaverEtfHistory(ticker: string, days = 25): Promise<HistoryRow[]> {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/price?pageSize=${days}&page=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return rows
      .map((row) => ({
        date: String(row.localTradedAt ?? '').split('T')[0],
        close: parseNumericValue(row.closePrice),
        volume: parseNumericValue(row.accumulatedTradingVolume),
      }))
      .filter((row) => row.date && row.close > 0)
      .reverse();
  } catch {
    return [];
  }
}

async function fetchYahooProxy(ticker: string, name: string): Promise<MarketProxySnapshot | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const value = Number(meta.regularMarketPrice ?? meta.previousClose ?? 0);
    const previousClose = Number(meta.previousClose ?? meta.chartPreviousClose ?? value);
    const changePercent = previousClose > 0 ? ((value - previousClose) / previousClose) * 100 : 0;

    return {
      ticker,
      name,
      value: round(value, 2),
      changePercent: round(changePercent, 2),
    };
  } catch {
    return null;
  }
}

function computeRecentReturn(closes: number[], periods: number): number {
  if (closes.length <= periods) return 0;
  const current = closes[closes.length - 1];
  const base = closes[closes.length - 1 - periods];
  return base > 0 ? round(((current - base) / base) * 100, 2) : 0;
}

function computeVolatility5d(closes: number[]): number {
  if (closes.length < 6) return 0;
  const returns = closes.slice(-6).map((close, index, arr) => {
    if (index === 0) return null;
    const prev = arr[index - 1];
    return prev > 0 ? ((close - prev) / prev) * 100 : 0;
  }).filter((value): value is number => value !== null);

  return round(standardDeviation(returns), 2);
}

function computeEtfScores(input: {
  quote: QuoteRow;
  history: HistoryRow[];
  type: EtfType;
}): Omit<EtfSnapshotRow, 'relativeRankWithinType'> {
  const closes = input.history.map((row) => row.close);
  const volumes = input.history.map((row) => row.volume);
  const recent3dReturn = computeRecentReturn(closes, 3);
  const recent5dReturn = computeRecentReturn(closes, 5);
  const twentyDayHigh = closes.length > 0 ? Math.max(...closes.slice(-20)) : input.quote.closePrice;
  const twentyDayGapPercent =
    twentyDayHigh > 0 ? round(((input.quote.closePrice - twentyDayHigh) / twentyDayHigh) * 100, 2) : 0;
  const averagePrev3Volume = mean(volumes.slice(-4, -1).filter((value) => value > 0));
  const volumeMultiple3d =
    averagePrev3Volume > 0 ? round(input.quote.volume / averagePrev3Volume, 2) : 1;
  const historicalTradingValues = input.history
    .slice(-4, -1)
    .map((row) => row.close * row.volume)
    .filter((value) => value > 0);
  const averagePrev3TradingValue = mean(historicalTradingValues);
  const tradingValueChangePercent =
    averagePrev3TradingValue > 0
      ? round(((input.quote.tradingValue - averagePrev3TradingValue) / averagePrev3TradingValue) * 100, 2)
      : 0;
  const volatility5d = computeVolatility5d(closes);

  const momentumScore = clamp(
    45 +
      recent3dReturn * 6 +
      recent5dReturn * 4 +
      input.quote.changePercent * 3 -
      Math.max(0, -recent3dReturn) * 5,
    0,
    100,
  );
  const flowScore = clamp(
    40 + (volumeMultiple3d - 1) * 22 + tradingValueChangePercent * 0.25,
    0,
    100,
  );
  const heatScore = clamp(
    Math.max(0, input.quote.changePercent) * 10 +
      Math.max(0, recent3dReturn - 3) * 6 +
      Math.max(0, 4 + twentyDayGapPercent) * 7,
    0,
    100,
  );
  const rotationScore = clamp(
    50 +
      input.quote.changePercent * 8 +
      (volumeMultiple3d - 1) * 12 -
      Math.max(0, recent5dReturn - 6) * 5 +
      (input.type === 'theme' || input.type === 'sector' ? 6 : 0),
    0,
    100,
  );
  const setupScore = clamp(
    52 +
      momentumScore * 0.18 +
      flowScore * 0.24 -
      heatScore * 0.28 +
      (twentyDayGapPercent <= -1.5 && twentyDayGapPercent >= -7 ? 12 : 0) +
      (input.quote.changePercent > 0 && input.quote.changePercent < 2.5 ? 6 : 0),
    0,
    100,
  );
  const signalScore = clamp(
    momentumScore * 0.27 +
      flowScore * 0.25 +
      rotationScore * 0.23 +
      setupScore * 0.3 -
      heatScore * 0.2,
    0,
    100,
  );

  return {
    ticker: input.quote.ticker,
    name: input.quote.name,
    type: input.type,
    closePrice: input.quote.closePrice,
    changePrice: input.quote.changePrice,
    changePercent: input.quote.changePercent,
    volume: input.quote.volume,
    tradingValue: input.quote.tradingValue,
    recent3dReturn,
    recent5dReturn,
    twentyDayGapPercent,
    volumeMultiple3d,
    tradingValueChangePercent,
    volatility5d,
    momentumScore: round(momentumScore, 1),
    flowScore: round(flowScore, 1),
    heatScore: round(heatScore, 1),
    rotationScore: round(rotationScore, 1),
    setupScore: round(setupScore, 1),
    signalScore: round(signalScore, 1),
  };
}

function determineMarketRegime(proxies: MarketSnapshotPayload['marketContext']['proxies']): {
  regimeHint: MarketRegime;
  riskSignal: string;
} {
  const kospi = proxies.kospi?.changePercent ?? 0;
  const kosdaq = proxies.kosdaq?.changePercent ?? 0;
  const nasdaq = proxies.nasdaq?.changePercent ?? 0;
  const semis = proxies.semis?.changePercent ?? 0;
  const usdkrw = proxies.usdkrw?.changePercent ?? 0;
  const us10y = proxies.us10y?.changePercent ?? 0;
  const koreaAverage = (kospi + kosdaq) / 2;

  if (koreaAverage <= -0.9 || nasdaq <= -1 || (usdkrw >= 0.7 && us10y >= 0.5)) {
    return {
      regimeHint: 'risk_off',
      riskSignal: '위험회피 우위. 지수와 성장주 프록시가 동반 약세여서 인버스 우선 검토 구간입니다.',
    };
  }

  if (koreaAverage >= 0.7 && nasdaq >= 0.4 && semis >= 0.4) {
    return {
      regimeHint: 'risk_on',
      riskSignal: '위험선호 우위. 국내 지수와 미국 기술주 프록시가 동반 강세입니다.',
    };
  }

  if (Math.abs(koreaAverage) <= 0.5 && Math.abs(nasdaq) <= 0.5) {
    return {
      regimeHint: 'chop',
      riskSignal: '방향성 약함. 추격보다 눌림과 거래대금 확인이 중요한 박스권 구간입니다.',
    };
  }

  return {
    regimeHint: 'rotation',
    riskSignal: '지수 전체보다는 섹터 순환 우위. 신규 거래대금 유입 테마를 선별해야 하는 구간입니다.',
  };
}

async function buildMarketSnapshot(): Promise<{
  snapshot: string;
  payload: MarketSnapshotPayload;
}> {
  const [quotes, histories, kospi, kosdaq, nasdaq, semis, usdkrw, us10y] = await Promise.all([
    Promise.all(ETF_UNIVERSE.map((item) => fetchNaverEtf(item.ticker))),
    Promise.all(ETF_UNIVERSE.map((item) => fetchNaverEtfHistory(item.ticker))),
    fetchYahooProxy(MARKET_PROXIES.kospi.ticker, MARKET_PROXIES.kospi.name),
    fetchYahooProxy(MARKET_PROXIES.kosdaq.ticker, MARKET_PROXIES.kosdaq.name),
    fetchYahooProxy(MARKET_PROXIES.nasdaq.ticker, MARKET_PROXIES.nasdaq.name),
    fetchYahooProxy(MARKET_PROXIES.semis.ticker, MARKET_PROXIES.semis.name),
    fetchYahooProxy(MARKET_PROXIES.usdkrw.ticker, MARKET_PROXIES.usdkrw.name),
    fetchYahooProxy(MARKET_PROXIES.us10y.ticker, MARKET_PROXIES.us10y.name),
  ]);

  const scored = ETF_UNIVERSE.map((item, index) => {
    const quote = quotes[index];
    if (!quote) return null;
    return computeEtfScores({
      quote,
      history: histories[index],
      type: item.type,
    });
  }).filter((row): row is Omit<EtfSnapshotRow, 'relativeRankWithinType'> => row !== null);

  const relativeRankMap = new Map<string, number>();
  for (const type of Array.from(new Set(scored.map((row) => row.type)))) {
    scored
      .filter((row) => row.type === type)
      .sort((left, right) => right.signalScore - left.signalScore)
      .forEach((row, index) => {
        relativeRankMap.set(row.ticker, index + 1);
      });
  }

  const etfs: EtfSnapshotRow[] = scored.map((row) => ({
    ...row,
    relativeRankWithinType: relativeRankMap.get(row.ticker) ?? 1,
  }));

  const regime = determineMarketRegime({ kospi, kosdaq, nasdaq, semis, usdkrw, us10y });
  const payload: MarketSnapshotPayload = {
    generatedAtKst: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    note: '네이버 ETF 시세/거래량과 Yahoo 프록시 지수 기반. 나스닥 선물, 반도체, 환율, 금리는 프록시로 대체합니다.',
    marketContext: {
      regimeHint: regime.regimeHint,
      riskSignal: regime.riskSignal,
      proxies: { kospi, kosdaq, nasdaq, semis, usdkrw, us10y },
    },
    etfs: etfs.sort((left, right) => right.signalScore - left.signalScore),
  };

  return {
    payload,
    snapshot: JSON.stringify(payload, null, 2),
  };
}

function buildPrompt(marketSnapshot: string): string {
  return `현재 시각 기준 한국 ETF 1~3일 스윙 판단을 내려라.

[역할]
- 너는 한국 ETF 단기 트레이딩 의사결정 엔진이다.
- 목표는 "수익 공격성"을 높이되, 무리한 추격보다 다음 1~3일 이어질 가능성이 높은 선택을 1개 고르는 것이다.

[시장 레짐 분류]
- risk_on: 지수와 성장 프록시가 동반 강세
- rotation: 지수보다는 섹터/테마 순환이 강한 장
- risk_off: 약세/환율 부담/금리 부담이 커서 방어가 우선인 장
- chop: 방향이 약하고 확신이 낮은 횡보 장

[행동 선택 규칙]
1. risk_on 또는 rotation이면 상위 후보 중 setupScore >= 60, flowScore >= 55, heatScore <= 78를 만족하는 ETF가 있으면 관망보다 진입을 우선해라.
2. risk_off면 inverse ETF를 우선 검토하되, inverse 후보의 signalScore가 55 미만이면 관망 가능하다.
3. chop이라도 거래대금 증가율과 volumeMultiple3d가 뚜렷한 신규 강세 후보가 있으면 단기 테마 또는 매수를 허용한다.
4. 최근 5일 급등 + heatScore 85 이상 + flowScore 둔화인 후보는 추천 금지다.
5. leveraged/theme ETF는 최근 1일 강세만으로 고르지 말고, recent3dReturn과 flowScore가 같이 살아 있어야 한다.

[후보 판독법]
- momentumScore: 단기 수익률과 가격 탄성
- flowScore: 거래량 배수와 거래대금 증가율
- heatScore: 과열/추격 리스크
- rotationScore: 기존 강세 추격이 아니라 새 자금이 붙는지
- setupScore: 눌림/돌파 포함 실제 진입 적합도
- signalScore: 최종 종합 점수

[출력 규칙]
- 반드시 JSON object 하나만 반환
- etf.ticker는 입력 후보 내 값만 허용
- whyNotOthers는 선택하지 않은 상위 후보 1~2개를 적어라
- 관망은 상위 후보 모두 기준 미달이거나 risk_off/chop에서 확신이 부족할 때만 선택해라

[입력 데이터]
${marketSnapshot}

반드시 아래 스키마를 지켜라.
{
  "action": "매수 | 단기 테마 | 인버스 | 관망",
  "etf": { "name": "ETF명 또는 관망", "ticker": "티커 또는 NONE" },
  "reasons": {
    "fundFlow": "자금 흐름 기준 1줄",
    "strengthRotation": "기존 강세와 신규 강세 구분 1줄",
    "sustainability": "1~3일 지속 가능성 1줄"
  },
  "strategy": {
    "entry": "시초가 | 눌림 | 종가 | 진입 금지",
    "splitBuy": true,
    "pullbackPercent": 1.2
  },
  "targetStop": {
    "targetPercent": 3.5,
    "stopPercent": -1.7
  },
  "failurePlan": {
    "reentry": "손절 후 재진입 규칙",
    "rotation": "다른 섹터 이동 기준"
  },
  "confidence": {
    "probability": 68,
    "level": "보통 | 높음 | 낮음"
  },
  "marketRegime": "risk_on | rotation | risk_off | chop",
  "holdingWindow": "당일 | 1-2일 | 2-3일",
  "setupType": "눌림목 | 돌파추종 | 반등시도 | 회피",
  "scoreSummary": {
    "momentum": 72,
    "flow": 78,
    "heat": 44,
    "setup": 69
  },
  "whyNotOthers": [
    { "ticker": "000000", "name": "ETF명", "reason": "탈락 이유" }
  ]
}`;
}

function normalizeMarketRegime(value: unknown): MarketRegime {
  return ['risk_on', 'rotation', 'risk_off', 'chop'].includes(String(value))
    ? (value as MarketRegime)
    : 'chop';
}

function normalizeSetupType(value: unknown): SetupType {
  return ['눌림목', '돌파추종', '반등시도', '회피'].includes(String(value))
    ? (value as SetupType)
    : '회피';
}

function normalizeHoldingWindow(value: unknown): HoldingWindow {
  return ['당일', '1-2일', '2-3일'].includes(String(value))
    ? (value as HoldingWindow)
    : '1-2일';
}

function normalizeAction(value: unknown): ActionType {
  return ['매수', '단기 테마', '인버스', '관망'].includes(String(value))
    ? (value as ActionType)
    : '관망';
}

function normalizeDecision(raw: unknown, marketSnapshot: string): KoreaEtfTradingDecision {
  const record = raw as Partial<KoreaEtfTradingDecision>;
  const action = normalizeAction(record.action);
  const allowedTickers = new Set(ETF_UNIVERSE.map((item) => item.ticker));
  const rawTicker = String(record.etf?.ticker ?? '');
  const rawName = String(record.etf?.name ?? '');
  const validTicker = action === '관망' ? 'NONE' : allowedTickers.has(rawTicker) ? rawTicker : '069500';
  const fallbackEtf = ETF_UNIVERSE.find((item) => item.ticker === validTicker);

  const whyNotOthers = Array.isArray(record.whyNotOthers)
    ? record.whyNotOthers
        .map((entry) => ({
          ticker: String((entry as { ticker?: unknown }).ticker ?? ''),
          name: String((entry as { name?: unknown }).name ?? ''),
          reason: String((entry as { reason?: unknown }).reason ?? ''),
        }))
        .filter((entry) => entry.ticker && entry.name && entry.reason)
        .slice(0, 2)
    : [];

  return {
    action,
    etf: {
      name: action === '관망' ? '관망' : rawName || fallbackEtf?.name || 'KODEX 200',
      ticker: validTicker,
    },
    reasons: {
      fundFlow: record.reasons?.fundFlow || '거래대금 증가율과 거래량 배수 기준으로 신규 자금 유입 강도를 비교했습니다.',
      strengthRotation: record.reasons?.strengthRotation || '최근 강세 추격보다 새롭게 거래가 붙는 ETF를 우선했습니다.',
      sustainability: record.reasons?.sustainability || '과열 점수와 1~3일 지속 가능성을 함께 평가했습니다.',
    },
    strategy: {
      entry: record.strategy?.entry || (action === '관망' ? '진입 금지' : '눌림'),
      splitBuy: Boolean(record.strategy?.splitBuy),
      pullbackPercent: Number(record.strategy?.pullbackPercent ?? (action === '관망' ? 0 : 1.2)),
    },
    targetStop: {
      targetPercent: Number(record.targetStop?.targetPercent ?? (action === '관망' ? 0 : 3)),
      stopPercent: Number(record.targetStop?.stopPercent ?? -1.5),
    },
    failurePlan: {
      reentry: record.failurePlan?.reentry || '손절 후 같은 날 재진입은 금지합니다.',
      rotation: record.failurePlan?.rotation || '상위 후보의 거래대금 증가가 유지될 때만 섹터 이동을 허용합니다.',
    },
    confidence: {
      probability: clamp(Number(record.confidence?.probability ?? 55), 0, 100),
      level: record.confidence?.level || '보통',
    },
    marketRegime: normalizeMarketRegime(record.marketRegime),
    holdingWindow: normalizeHoldingWindow(record.holdingWindow),
    setupType: normalizeSetupType(record.setupType),
    scoreSummary: {
      momentum: clamp(Number(record.scoreSummary?.momentum ?? 50), 0, 100),
      flow: clamp(Number(record.scoreSummary?.flow ?? 50), 0, 100),
      heat: clamp(Number(record.scoreSummary?.heat ?? 50), 0, 100),
      setup: clamp(Number(record.scoreSummary?.setup ?? 50), 0, 100),
    },
    whyNotOthers,
    pricePlan: null,
    marketSnapshot,
    generatedAt: new Date().toISOString(),
    model: 'llama-3.3-70b-versatile',
  };
}

async function buildDecision(): Promise<KoreaEtfTradingDecision> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const { snapshot, payload } = await buildMarketSnapshot();
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          '너는 한국 ETF 단기 트레이딩 의사결정 엔진이다. 관망을 남발하지 말고, 수치 기준을 통과하는 후보가 있으면 1~3일 진입을 선택하라. JSON object만 반환한다.',
      },
      { role: 'user', content: buildPrompt(snapshot) },
    ],
    temperature: 0.25,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const decision = normalizeDecision(JSON.parse(content), snapshot);
  const selectedEtf = payload.etfs.find((etf) => etf.ticker === decision.etf.ticker);
  const enrichedDecision: KoreaEtfTradingDecision = {
    ...decision,
    pricePlan: buildPricePlan(decision, selectedEtf),
  };

  if (decision.action === '관망' && payload.marketContext.regimeHint !== 'risk_off') {
    const topCandidate = payload.etfs.find(
      (etf) => etf.setupScore >= 60 && etf.flowScore >= 55 && etf.heatScore <= 78 && etf.type !== 'inverse',
    );

    if (topCandidate) {
      return {
        ...decision,
        action: topCandidate.type === 'theme' ? '단기 테마' : '매수',
        etf: {
          name: topCandidate.name,
          ticker: topCandidate.ticker,
        },
        reasons: {
          fundFlow: `${topCandidate.name}은(는) 거래대금 변화율 ${formatPercent(topCandidate.tradingValueChangePercent)}와 거래량 배수 ${round(topCandidate.volumeMultiple3d, 1)}배가 확인되었습니다.`,
          strengthRotation: `${topCandidate.name}은(는) ${topCandidate.type} 그룹 내 상대순위 ${topCandidate.relativeRankWithinType}위이며 신규 강세 축으로 분류됩니다.`,
          sustainability: `setupScore ${topCandidate.setupScore}점과 heatScore ${topCandidate.heatScore}점으로 추격 부담보다 지속 가능성이 우위입니다.`,
        },
        strategy: {
          entry: topCandidate.changePercent >= 1.5 ? '눌림' : '시초가',
          splitBuy: true,
          pullbackPercent: 1.2,
        },
        targetStop: {
          targetPercent: 3.2,
          stopPercent: -1.7,
        },
        confidence: {
          probability: clamp(Math.round(topCandidate.signalScore), 55, 75),
          level: topCandidate.signalScore >= 70 ? '높음' : '보통',
        },
        marketRegime: payload.marketContext.regimeHint,
        holdingWindow: '1-2일',
        setupType: topCandidate.twentyDayGapPercent <= -2 ? '눌림목' : '돌파추종',
        scoreSummary: {
          momentum: topCandidate.momentumScore,
          flow: topCandidate.flowScore,
          heat: topCandidate.heatScore,
          setup: topCandidate.setupScore,
        },
        whyNotOthers: payload.etfs
          .filter((etf) => etf.ticker !== topCandidate.ticker)
          .slice(0, 2)
          .map((etf) => ({
            ticker: etf.ticker,
            name: etf.name,
            reason: etf.heatScore > 78
              ? '단기 과열 점수가 높아 추격 부담이 큽니다.'
              : '거래대금 유입과 진입 점수가 더 강한 후보에 밀렸습니다.',
          })),
      };
    }
  }

  return decision;
}

async function buildDecisionWithPricePlan(): Promise<KoreaEtfTradingDecision> {
  const baseDecision = await buildDecision();

  const payload = JSON.parse(baseDecision.marketSnapshot) as MarketSnapshotPayload;
  const selectedEtf = payload.etfs.find((etf) => etf.ticker === baseDecision.etf.ticker);

  if (baseDecision.action === '관망' && baseDecision.marketRegime !== 'risk_off') {
    const topCandidate = payload.etfs.find(
      (etf) => etf.setupScore >= 60 && etf.flowScore >= 55 && etf.heatScore <= 78 && etf.type !== 'inverse',
    );

    if (topCandidate) {
      const fallbackDecision: KoreaEtfTradingDecision = {
        ...baseDecision,
        action: topCandidate.type === 'theme' ? '단기 테마' : '매수',
        etf: {
          name: topCandidate.name,
          ticker: topCandidate.ticker,
        },
        reasons: {
          fundFlow: `${topCandidate.name}은 거래대금이 ${formatPercent(topCandidate.tradingValueChangePercent)} 늘었고 거래량도 최근 3일 평균 대비 ${round(topCandidate.volumeMultiple3d, 1)}배 수준입니다.`,
          strengthRotation: `${topCandidate.type} 그룹 안에서 상대강도가 높고 최근 자금 순환에서도 상위권을 유지하고 있습니다.`,
          sustainability: `setup ${topCandidate.setupScore}, heat ${topCandidate.heatScore} 기준으로 단기 과열은 과하지 않고 1~3일 추세 지속 가능성이 남아 있습니다.`,
        },
        strategy: {
          entry: topCandidate.changePercent >= 1.5 ? '눌림' : '시초가',
          splitBuy: true,
          pullbackPercent: 1.2,
        },
        targetStop: {
          targetPercent: 3.2,
          stopPercent: -1.7,
        },
        failurePlan: {
          reentry: '손절 후 같은 날 재진입은 피하고, 다음 지지 구간 재확인 후 다시 본다.',
          rotation: '추천 종목이 무너지면 자금이 더 강한 ETF로 순환되는지 확인한다.',
        },
        confidence: {
          probability: clamp(Math.round(topCandidate.signalScore), 55, 75),
          level: topCandidate.signalScore >= 70 ? '높음' : '보통',
        },
        marketRegime: payload.marketContext.regimeHint,
        holdingWindow: '1-2일',
        setupType: topCandidate.twentyDayGapPercent <= -2 ? '눌림목' : '돌파추종',
        scoreSummary: {
          momentum: topCandidate.momentumScore,
          flow: topCandidate.flowScore,
          heat: topCandidate.heatScore,
          setup: topCandidate.setupScore,
        },
        whyNotOthers: payload.etfs
          .filter((etf) => etf.ticker !== topCandidate.ticker)
          .slice(0, 2)
          .map((etf) => ({
            ticker: etf.ticker,
            name: etf.name,
            reason:
              etf.heatScore > 78
                ? '단기 과열 점수가 높아 추격 매수 리스크가 더 큽니다.'
                : '자금 유입과 진입 적합도가 이번 추천 종목보다 약합니다.',
          })),
        pricePlan: null,
        marketSnapshot: baseDecision.marketSnapshot,
        generatedAt: new Date().toISOString(),
        model: baseDecision.model,
      };

      return {
        ...fallbackDecision,
        pricePlan: buildPricePlan(fallbackDecision, topCandidate),
      };
    }
  }

  return {
    ...baseDecision,
    pricePlan: buildPricePlan(baseDecision, selectedEtf),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KoreaEtfTradingDecision | { error: string }>,
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cached = cache.get('daily');
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const request =
      inflight ??
      buildDecisionWithPricePlan()
        .then((data) => {
          cache.set('daily', { data, fetchedAt: Date.now() });
          inflight = null;
          return data;
        })
        .catch((error) => {
          inflight = null;
          throw error;
        });

    if (!inflight) inflight = request;
    const result = await request;
    return res.status(200).json(result);
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
