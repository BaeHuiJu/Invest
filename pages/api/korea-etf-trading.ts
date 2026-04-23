import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';

type ActionType = '매수' | '단기 테마' | '인버스' | '관망';

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
  marketSnapshot: string;
  generatedAt: string;
  model: string;
}

type CacheEntry = {
  data: KoreaEtfTradingDecision;
  fetchedAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
let inflight: Promise<KoreaEtfTradingDecision> | null = null;

const ETF_UNIVERSE = [
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

async function fetchNaverEtf(ticker: string) {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      ticker,
      name: data.stockName || data.stockNameEng || ticker,
      closePrice: data.closePrice,
      changePrice: data.compareToPreviousClosePrice,
      changePercent: data.fluctuationsRatio,
      volume: data.accumulatedTradingVolume,
      tradingValue: data.accumulatedTradingValue,
    };
  } catch {
    return null;
  }
}

async function buildMarketSnapshot() {
  const quotes = await Promise.all(ETF_UNIVERSE.map((item) => fetchNaverEtf(item.ticker)));
  const rows = ETF_UNIVERSE.map((item, index) => ({
    ...item,
    quote: quotes[index],
  }));

  return JSON.stringify({
    generatedAtKst: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    note: '네이버 국내 ETF 현재가/등락률/거래량 기반. 해외 선물, 외국인/기관 수급, 뉴스는 모델이 보수적으로 추론하되 확인 불가 시 관망을 우선한다.',
    etfs: rows,
  }, null, 2);
}

function buildPrompt(marketSnapshot: string) {
  return `
나는 한국 ETF로 단기 트레이딩(당일~3일)을 하는 공격적인 투자자다.

오늘 시장에서 "가장 유리한 행동 1개"를 선택해라:

1) 매수 (상승 ETF 1개)
2) 단기 테마 매수 (변동성 ETF 1개)
3) 인버스 매수 (하락 ETF 1개)
4) 관망 (매수 금지)

[핵심 목표]
- 수익보다 "틀리지 않는 선택"을 우선
- 하루짜리 급등이 아니라 "3일 생존 확률" 기준
- 섹터 순환 구간을 반드시 고려

[시장 분석 기준]
- 나스닥 선물 방향 (%)
- 전일 반도체 / AI 흐름
- 코스피 / 코스닥 방향
- 외국인 / 기관 수급 방향
- 거래대금 상위 ETF 변화
- 최근 3일 강했던 섹터가 약해지는지 체크
- 오늘 새롭게 강해지는 섹터 존재 여부
- 뉴스 (전쟁, 정책, 금리, AI 등)

[선택 로직]
1. 최근 3일 가장 강했던 섹터는 "추격 금지"
2. 오늘 새롭게 거래대금 증가 + 수급 유입 있는 ETF 우선
3. 시장 약세 + 방향성 없음 = 관망 또는 인버스
4. 하루만 강한 테마는 "단기 테마 매수"로 구분

[절대 금지]
- 어제 강했던 ETF 그대로 추천 금지
- 상황에 따라 다름 금지
- 애매하면 무조건 관망 또는 인버스

[핵심 원칙]
- "지금 강한 것"보다 "내일도 갈 수 있는 것" 선택
- 하루짜리 테마 vs 지속 섹터 구분
- 틀릴 확률 높으면 무조건 안 들어간다

[현재 ETF 후보 데이터]
${marketSnapshot}

반드시 아래 JSON만 반환해라. 마크다운 금지.
{
  "action": "매수 | 단기 테마 | 인버스 | 관망",
  "etf": { "name": "ETF명 또는 관망", "ticker": "티커 또는 NONE" },
  "reasons": {
    "fundFlow": "자금 흐름 기준 1줄",
    "strengthRotation": "기존 강세 vs 신규 강세 구분 1줄",
    "sustainability": "3일 지속 가능성 1줄"
  },
  "strategy": {
    "entry": "시초가 | 눌림 | 종가 | 진입 금지",
    "splitBuy": true,
    "pullbackPercent": 1.5
  },
  "targetStop": {
    "targetPercent": 3,
    "stopPercent": -1.5
  },
  "failurePlan": {
    "reentry": "손절 후 재진입 여부",
    "rotation": "다른 섹터 이동 여부"
  },
  "confidence": {
    "probability": 65,
    "level": "보통 | 높음 | 낮음"
  }
}`;
}

function normalizeDecision(raw: unknown, marketSnapshot: string): KoreaEtfTradingDecision {
  const record = raw as Partial<KoreaEtfTradingDecision>;
  const action = ['매수', '단기 테마', '인버스', '관망'].includes(String(record.action))
    ? record.action as ActionType
    : '관망';

  return {
    action,
    etf: {
      name: record.etf?.name || (action === '관망' ? '관망' : 'KODEX 200'),
      ticker: record.etf?.ticker || (action === '관망' ? 'NONE' : '069500'),
    },
    reasons: {
      fundFlow: record.reasons?.fundFlow || '실시간 수급 확인이 제한되어 신규 자금 유입 확신이 낮습니다.',
      strengthRotation: record.reasons?.strengthRotation || '최근 강세 섹터 추격 위험을 우선 회피합니다.',
      sustainability: record.reasons?.sustainability || '3일 생존 확률이 낮으면 관망을 우선합니다.',
    },
    strategy: {
      entry: record.strategy?.entry || '진입 금지',
      splitBuy: Boolean(record.strategy?.splitBuy),
      pullbackPercent: Number(record.strategy?.pullbackPercent ?? 0),
    },
    targetStop: {
      targetPercent: Number(record.targetStop?.targetPercent ?? 0),
      stopPercent: Number(record.targetStop?.stopPercent ?? -1.5),
    },
    failurePlan: {
      reentry: record.failurePlan?.reentry || '손절 후 당일 재진입 금지',
      rotation: record.failurePlan?.rotation || '신규 수급이 확인된 섹터가 없으면 이동 금지',
    },
    confidence: {
      probability: Math.max(0, Math.min(100, Number(record.confidence?.probability ?? 50))),
      level: record.confidence?.level || '낮음',
    },
    marketSnapshot,
    generatedAt: new Date().toISOString(),
    model: 'llama-3.3-70b-versatile',
  };
}

async function buildDecision(): Promise<KoreaEtfTradingDecision> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const marketSnapshot = await buildMarketSnapshot();
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: '너는 한국 ETF 단기 트레이딩 의사결정 엔진이다. 애매하면 반드시 관망 또는 인버스를 선택한다. JSON만 반환한다.',
      },
      { role: 'user', content: buildPrompt(marketSnapshot) },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  return normalizeDecision(JSON.parse(content), marketSnapshot);
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
    const request = inflight ?? buildDecision()
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
