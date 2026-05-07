import type { AiPickExitConditions, MarketType, TimeHorizon, TradeRecord } from './analyst-types';

const STORAGE_KEY = 'trade_journal_v1';

function loadAll(): TradeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TradeRecord[];
  } catch {
    return [];
  }
}

function saveAll(records: TradeRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function addTrade(params: {
  ticker: string;
  name: string;
  market: MarketType;
  buyPrice: number;
  targetPrice: number;
  entryScore: number;
  timeHorizon: TimeHorizon;
  exitConditions: AiPickExitConditions;
}): TradeRecord {
  const record: TradeRecord = {
    id: `${params.ticker}-${Date.now()}`,
    ticker: params.ticker,
    name: params.name,
    market: params.market,
    buyPrice: params.buyPrice,
    buyDate: new Date().toISOString().split('T')[0]!,
    targetPrice: params.targetPrice,
    entryScore: params.entryScore,
    timeHorizon: params.timeHorizon,
    exitConditions: params.exitConditions,
  };
  const all = loadAll();
  saveAll([...all, record]);
  return record;
}

export function getTrades(): TradeRecord[] {
  return loadAll().filter((r) => !r.closedAt);
}

export function closeTrade(id: string, sellPrice: number): void {
  const all = loadAll().map((r) =>
    r.id === id ? { ...r, closedAt: new Date().toISOString(), sellPrice } : r
  );
  saveAll(all);
}

export function removeTrade(id: string): void {
  saveAll(loadAll().filter((r) => r.id !== id));
}

export function computePnl(record: TradeRecord, currentPrice: number): {
  pnlPct: number;
  targetProgressPct: number;
  isStopLoss: boolean;
  isTargetHit: boolean;
  daysHeld: number;
  daysLeft: number;
} {
  const pnlPct = record.buyPrice > 0
    ? Math.round(((currentPrice - record.buyPrice) / record.buyPrice) * 1000) / 10
    : 0;

  const gap = record.targetPrice - record.buyPrice;
  const targetProgressPct = gap > 0
    ? Math.round(((currentPrice - record.buyPrice) / gap) * 100)
    : 0;

  const msHeld = Date.now() - new Date(record.buyDate).getTime();
  const daysHeld = Math.floor(msHeld / 86400000);
  const daysLeft = Math.max(0, record.exitConditions.timeHorizonDays - daysHeld);

  return {
    pnlPct,
    targetProgressPct: Math.min(100, Math.max(0, targetProgressPct)),
    isStopLoss: pnlPct <= record.exitConditions.stopLossPct,
    isTargetHit: currentPrice >= record.exitConditions.targetPriceTakeProfit,
    daysHeld,
    daysLeft,
  };
}
