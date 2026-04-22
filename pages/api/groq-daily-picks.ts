import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';
import { loadAnalystData } from './analyst-reports';
import type { AnalystReport } from '../../lib/analyst-types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroqDailyPick {
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  currentPrice: number;
  avgTargetPrice: number;
  avgUpside: number;
  entryScore: number;
  brokerCount: number;
  brokers: string[];
  // Real-time computed fields
  priceChangeSinceReport: number;   // % change: currentPrice vs basePrice
  daysSinceLatestReport: number;
  week1SuccessRate: number | null;  // historical success rate
  avgWeek1Return: number | null;    // historical avg return
  // Groq analysis
  confidence: number;               // 0-100
  reasoning: string;                // Korean explanation
  expectedReturn: string;           // e.g. "3-6%"
  timeframe: string;                // e.g. "3-7일"
  keyRisk: string;                  // one-line risk
}

export interface GroqDailyPicksResponse {
  picks: GroqDailyPick[];
  generatedAt: string;
  model: string;
  candidateCount: number;
  marketContext: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_CANDIDATES = 25;
const MIN_BROKER_COUNT = 2;
const MIN_ENTRY_SCORE = 60;
const MAX_DAYS = 15; // 단기 초점: 최근 15일

type CacheEntry = { data: GroqDailyPicksResponse; fetchedAt: number };
const responseCache = new Map<string, CacheEntry>();
let inflight: Promise<GroqDailyPicksResponse> | null = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function getMarketContext(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[now.getDay()];
  const timeOfDay = hour < 9 ? '장전' : hour < 15 ? '장중' : '장후';
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${day}요일 ${timeOfDay} (KST ${hour}:${String(now.getMinutes()).padStart(2,'0')})`;
}

// ── Candidate builder ───────────────────────────────────────────────────────

interface Candidate {
  ticker: string;
  name: string;
  market: 'korea' | 'us';
  currentPrice: number;
  basePrice: number;
  avgTargetPrice: number;
  avgUpside: number;
  entryScore: number;
  brokerCount: number;
  brokers: string[];
  latestReportDate: string;
  priceChangeSinceReport: number;
  daysSinceLatestReport: number;
  week1SuccessRate: number | null;
  avgWeek1Return: number | null;
}

function buildCandidates(reports: AnalystReport[]): Candidate[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS);

  const groups = new Map<string, AnalystReport[]>();
  for (const r of reports) {
    if (new Date(r.date) < cutoff) continue;
    const key = `${r.market}:${r.ticker}`;
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const candidates: Candidate[] = [];

  for (const group of Array.from(groups.values())) {
    const sorted = [...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const brokers = Array.from(new Set(sorted.map((r) => r.broker)));
    if (brokers.length < MIN_BROKER_COUNT) continue;

    const latest = sorted[0];
    const currentPrice = latest.currentPrice;
    const avgTargetPrice = sorted.reduce((s, r) => s + r.targetPrice, 0) / sorted.length;
    const avgUpside = currentPrice > 0 ? ((avgTargetPrice - currentPrice) / currentPrice) * 100 : 0;

    // Entry score (same formula as ai-picks.ts)
    const priceVsBaseRatio = latest.basePrice > 0 ? (latest.basePrice - currentPrice) / latest.basePrice : 0;
    const targetGapRatio = currentPrice > 0 ? (avgTargetPrice - currentPrice) / currentPrice : 0;
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
    const entryScore = Math.round(
      clamp((priceVsBaseRatio / 0.15) * 30, 30) +
      clamp((targetGapRatio / 0.4) * 35, 35) +
      ([0, 0, 5, 10, 13, 15][Math.min(sorted.length, 5)] ?? 15) +
      ([0, 0, 10, 15, 18, 20][Math.min(brokers.length, 5)] ?? 20)
    );

    if (entryScore < MIN_ENTRY_SCORE) continue;

    // Historical week1 performance
    const week1Reports = sorted.filter((r) => r.performance?.week1?.status === 'complete');
    const week1SuccessRate = week1Reports.length > 0
      ? Math.round((week1Reports.filter((r) => (r.performance!.week1!.returnPct ?? 0) >= 3).length / week1Reports.length) * 100)
      : null;
    const avgWeek1Return = week1Reports.length > 0
      ? Math.round((week1Reports.reduce((s, r) => s + (r.performance!.week1!.returnPct ?? 0), 0) / week1Reports.length) * 10) / 10
      : null;

    const priceChangeSinceReport = latest.basePrice > 0
      ? Math.round(((currentPrice - latest.basePrice) / latest.basePrice) * 1000) / 10
      : 0;

    candidates.push({
      ticker: latest.ticker,
      name: latest.name,
      market: latest.market,
      currentPrice,
      basePrice: latest.basePrice,
      avgTargetPrice: Math.round(avgTargetPrice * 10) / 10,
      avgUpside: Math.round(avgUpside * 10) / 10,
      entryScore,
      brokerCount: brokers.length,
      brokers,
      latestReportDate: latest.date,
      priceChangeSinceReport,
      daysSinceLatestReport: daysBetween(latest.date),
      week1SuccessRate,
      avgWeek1Return,
    });
  }

  // Sort by entry score desc, take top N
  return candidates.sort((a, b) => b.entryScore - a.entryScore).slice(0, MAX_CANDIDATES);
}

// ── Groq prompt ─────────────────────────────────────────────────────────────

function buildPrompt(candidates: Candidate[], marketContext: string): string {
  const dataJson = JSON.stringify(
    candidates.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      market: c.market === 'korea' ? '국내' : '미국',
      // 실시간 가격 데이터
      currentPrice: c.currentPrice,
      avgTargetPrice: c.avgTargetPrice,
      avgUpside: `${c.avgUpside}%`,
      priceChangeSinceReport: `${c.priceChangeSinceReport > 0 ? '+' : ''}${c.priceChangeSinceReport}%`,
      // 진입 타이밍
      entryScore: c.entryScore,
      daysSinceLatestReport: `${c.daysSinceLatestReport}일 전`,
      // 컨센서스
      brokerCount: c.brokerCount,
      brokers: c.brokers,
      // 과거 성과 (null이면 데이터 부족)
      week1SuccessRate: c.week1SuccessRate !== null ? `${c.week1SuccessRate}%` : '데이터없음',
      avgWeek1Return: c.avgWeek1Return !== null ? `${c.avgWeek1Return}%` : '데이터없음',
    })),
    null,
    2
  );

  return `현재 시각: ${marketContext}

아래는 실시간으로 수집된 주식 데이터입니다.
- currentPrice: 현재 실시간 시장가
- avgTargetPrice: 애널리스트 평균 목표가
- avgUpside: 현재가 기준 목표가까지 상승여력
- priceChangeSinceReport: 리포트 발행 이후 현재까지 가격 변동률 (양수=상승, 음수=하락)
- entryScore: 매수 타이밍 점수 (100점 만점, 높을수록 좋은 진입점)
- daysSinceLatestReport: 최신 리포트로부터 경과 일수 (낮을수록 신선)
- brokers: 이 종목을 추천한 증권사 목록
- week1SuccessRate: 해당 종목/증권사들의 과거 1주 내 3%+ 달성 성공률
- avgWeek1Return: 과거 1주 평균 실제 수익률

분석 데이터:
${dataJson}`;
}

// ── Groq call ────────────────────────────────────────────────────────────────

interface GroqPickResult {
  ticker: string;
  confidence: number;
  reasoning: string;
  expectedReturn: string;
  timeframe: string;
  keyRisk: string;
}

async function callGroq(candidates: Candidate[], marketContext: string): Promise<GroqPickResult[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const groq = new Groq({ apiKey });

  const systemPrompt = `당신은 한국 주식 시장 전문 퀀트 애널리스트입니다.
제공된 실시간 데이터를 바탕으로 단기(1주일 이내) 3% 이상 상승 가능성이 가장 높은 상위 5개 종목을 선별하십시오.

선별 기준 (중요도 순):
1. entryScore가 높을수록 현재 가격이 좋은 진입점
2. priceChangeSinceReport가 소폭 하락(-5%~0%)이면 반등 여력 높음
3. daysSinceLatestReport가 짧을수록(0-3일) 정보 신선도 높음
4. brokerCount가 많을수록 컨센서스 신뢰도 높음
5. week1SuccessRate가 높을수록 과거 적중률 검증됨
6. avgUpside가 10-30% 범위면 현실적 목표 (너무 높으면 리스크)

반드시 다음 JSON 배열 형식으로만 응답하십시오 (다른 텍스트 없이):
[
  {
    "ticker": "종목코드",
    "confidence": 85,
    "reasoning": "한국어로 2-3문장 투자 근거. 구체적 수치 포함.",
    "expectedReturn": "3-5%",
    "timeframe": "3-5일",
    "keyRisk": "주요 리스크 1문장"
  }
]`;

  const userPrompt = buildPrompt(candidates, marketContext);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content ?? '[]';

  // response_format json_object wraps in object; handle both array and {picks:[...]}
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq returned invalid JSON');
  }

  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>).picks)
    ? ((parsed as Record<string, unknown>).picks as unknown[])
    : Object.values(parsed as Record<string, unknown>).find(Array.isArray) as unknown[] ?? [];

  return (arr as GroqPickResult[]).slice(0, 5);
}

// ── Main builder ─────────────────────────────────────────────────────────────

async function buildGroqPicks(): Promise<GroqDailyPicksResponse> {
  const cacheFile = await loadAnalystData();
  const candidates = buildCandidates(cacheFile.reports);
  const marketContext = getMarketContext();
  const groqResults = await callGroq(candidates, marketContext);

  const candidateMap = new Map(candidates.map((c) => [c.ticker, c]));

  const picks: GroqDailyPick[] = groqResults
    .map((gr) => {
      const c = candidateMap.get(gr.ticker);
      if (!c) return null;
      return {
        ticker: c.ticker,
        name: c.name,
        market: c.market,
        currentPrice: c.currentPrice,
        avgTargetPrice: c.avgTargetPrice,
        avgUpside: c.avgUpside,
        entryScore: c.entryScore,
        brokerCount: c.brokerCount,
        brokers: c.brokers,
        priceChangeSinceReport: c.priceChangeSinceReport,
        daysSinceLatestReport: c.daysSinceLatestReport,
        week1SuccessRate: c.week1SuccessRate,
        avgWeek1Return: c.avgWeek1Return,
        confidence: Math.max(0, Math.min(100, gr.confidence)),
        reasoning: gr.reasoning,
        expectedReturn: gr.expectedReturn,
        timeframe: gr.timeframe,
        keyRisk: gr.keyRisk,
      } satisfies GroqDailyPick;
    })
    .filter((p): p is GroqDailyPick => p !== null);

  return {
    picks,
    generatedAt: new Date().toISOString(),
    model: 'llama-3.3-70b-versatile',
    candidateCount: candidates.length,
    marketContext,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GroqDailyPicksResponse | { error: string }>,
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cached = responseCache.get('groq');
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const promise = inflight ?? buildGroqPicks().then((data) => {
      responseCache.set('groq', { data, fetchedAt: Date.now() });
      inflight = null;
      return data;
    }).catch((e) => { inflight = null; throw e; });

    if (!inflight) inflight = promise;

    const result = await promise;
    return res.status(200).json(result);
  } catch (error) {
    inflight = null;
    console.error('Groq daily picks error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Groq 분석 실패: ${msg}` });
  }
}
