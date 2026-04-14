/**
 * Technical Analysis Indicators
 * RSI, MACD, SMA, EMA, Bollinger Bands
 */

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }

  return result;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(prices[0]);
    } else if (i < period - 1) {
      // Use SMA for initial values
      const sum = prices.slice(0, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / (i + 1));
    } else if (i === period - 1) {
      // First EMA is SMA
      const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      // EMA = (Close - Previous EMA) * multiplier + Previous EMA
      const ema = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }

  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * Default period: 14
 * Returns values 0-100
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) {
    return prices.map(() => NaN);
  }

  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First RSI value uses SMA
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Fill NaN for initial period
  for (let i = 0; i < period; i++) {
    result.push(NaN);
  }

  // Calculate RSI
  for (let i = period; i < prices.length; i++) {
    if (i > period) {
      // Smoothed averages using Wilder's method
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    }

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}

export type MACDResult = {
  macd: number[];
  signal: number[];
  histogram: number[];
};

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Default: 12-day EMA, 26-day EMA, 9-day Signal
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  // MACD Line = Fast EMA - Slow EMA
  const macd = emaFast.map((fast, i) => fast - emaSlow[i]);

  // Signal Line = 9-day EMA of MACD
  const signal = calculateEMA(
    macd.map((v) => (isNaN(v) ? 0 : v)),
    signalPeriod
  );

  // Histogram = MACD - Signal
  const histogram = macd.map((m, i) => m - signal[i]);

  return { macd, signal, histogram };
}

export type BollingerBandsResult = {
  upper: number[];
  middle: number[];
  lower: number[];
};

/**
 * Calculate Bollinger Bands
 * Default: 20-day SMA with 2 standard deviations
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  const middle = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

/**
 * Get RSI interpretation
 */
export function getRSISignal(rsi: number): {
  label: string;
  color: string;
  description: string;
} {
  if (isNaN(rsi)) {
    return { label: '-', color: 'text-gray-400', description: '데이터 부족' };
  }

  if (rsi >= 70) {
    return { label: '과매수', color: 'text-red-600', description: '매도 신호 가능' };
  } else if (rsi >= 60) {
    return { label: '강세', color: 'text-orange-500', description: '상승 추세' };
  } else if (rsi >= 40) {
    return { label: '중립', color: 'text-gray-600', description: '방향성 없음' };
  } else if (rsi >= 30) {
    return { label: '약세', color: 'text-blue-500', description: '하락 추세' };
  } else {
    return { label: '과매도', color: 'text-green-600', description: '매수 신호 가능' };
  }
}

/**
 * Get MACD interpretation
 */
export function getMACDSignal(
  macd: number,
  signal: number,
  prevMacd: number,
  prevSignal: number
): {
  label: string;
  color: string;
  description: string;
} {
  if (isNaN(macd) || isNaN(signal)) {
    return { label: '-', color: 'text-gray-400', description: '데이터 부족' };
  }

  const histogram = macd - signal;
  const prevHistogram = prevMacd - prevSignal;

  // Golden cross: MACD crosses above signal
  if (prevMacd <= prevSignal && macd > signal) {
    return { label: '골든크로스', color: 'text-green-600', description: '매수 신호' };
  }

  // Dead cross: MACD crosses below signal
  if (prevMacd >= prevSignal && macd < signal) {
    return { label: '데드크로스', color: 'text-red-600', description: '매도 신호' };
  }

  if (histogram > 0 && histogram > prevHistogram) {
    return { label: '상승 강화', color: 'text-green-500', description: '상승 모멘텀 증가' };
  } else if (histogram > 0) {
    return { label: '상승', color: 'text-green-400', description: 'MACD > Signal' };
  } else if (histogram < 0 && histogram < prevHistogram) {
    return { label: '하락 강화', color: 'text-red-500', description: '하락 모멘텀 증가' };
  } else {
    return { label: '하락', color: 'text-red-400', description: 'MACD < Signal' };
  }
}

/**
 * Get Moving Average arrangement
 */
export function getMAArrangement(
  ma5: number,
  ma20: number,
  ma60: number
): {
  label: string;
  color: string;
  description: string;
} {
  if (isNaN(ma5) || isNaN(ma20) || isNaN(ma60)) {
    return { label: '-', color: 'text-gray-400', description: '데이터 부족' };
  }

  if (ma5 > ma20 && ma20 > ma60) {
    return { label: '정배열', color: 'text-green-600', description: '강한 상승 추세' };
  } else if (ma5 < ma20 && ma20 < ma60) {
    return { label: '역배열', color: 'text-red-600', description: '강한 하락 추세' };
  } else {
    return { label: '혼조', color: 'text-yellow-600', description: '추세 전환 가능' };
  }
}

/**
 * Calculate all technical indicators for a price series
 */
export type TechnicalAnalysis = {
  rsi: {
    current: number;
    series: number[];
    signal: ReturnType<typeof getRSISignal>;
  };
  macd: {
    current: { macd: number; signal: number; histogram: number };
    series: MACDResult;
    signal: ReturnType<typeof getMACDSignal>;
  };
  ma: {
    ma5: number[];
    ma20: number[];
    ma60: number[];
    ma120: number[];
    arrangement: ReturnType<typeof getMAArrangement>;
  };
  bollingerBands: BollingerBandsResult;
};

export function calculateAllIndicators(prices: number[]): TechnicalAnalysis {
  const rsiSeries = calculateRSI(prices, 14);
  const currentRSI = rsiSeries[rsiSeries.length - 1];

  const macdResult = calculateMACD(prices);
  const currentMACD = {
    macd: macdResult.macd[macdResult.macd.length - 1],
    signal: macdResult.signal[macdResult.signal.length - 1],
    histogram: macdResult.histogram[macdResult.histogram.length - 1],
  };
  const prevMACD = macdResult.macd[macdResult.macd.length - 2];
  const prevSignal = macdResult.signal[macdResult.signal.length - 2];

  const ma5 = calculateSMA(prices, 5);
  const ma20 = calculateSMA(prices, 20);
  const ma60 = calculateSMA(prices, 60);
  const ma120 = calculateSMA(prices, 120);

  const bollingerBands = calculateBollingerBands(prices, 20, 2);

  return {
    rsi: {
      current: currentRSI,
      series: rsiSeries,
      signal: getRSISignal(currentRSI),
    },
    macd: {
      current: currentMACD,
      series: macdResult,
      signal: getMACDSignal(currentMACD.macd, currentMACD.signal, prevMACD, prevSignal),
    },
    ma: {
      ma5,
      ma20,
      ma60,
      ma120,
      arrangement: getMAArrangement(
        ma5[ma5.length - 1],
        ma20[ma20.length - 1],
        ma60[ma60.length - 1]
      ),
    },
    bollingerBands,
  };
}
