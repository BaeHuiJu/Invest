import type { NextApiRequest, NextApiResponse } from 'next';

import type {
  AnalystReport,
  MarketFilter,
  SectorCycleConfidence,
  SectorCycleItem,
  SectorCyclePhase,
  SectorCycleRecentReport,
  SectorCycleResponse,
} from '../../lib/analyst-types';
import { loadAnalystData } from './analyst-reports';

const SECTOR_CYCLE_CACHE_TTL_MS = 5 * 60 * 1000;

type ResponseCacheEntry = {
  data: SectorCycleResponse;
  fetchedAt: number;
};

type KeywordRule = {
  label: string;
  phase: SectorCyclePhase;
  pattern: string;
  weight: number;
};

const responseCache = new Map<string, ResponseCacheEntry>();
const responseInflight = new Map<string, Promise<SectorCycleResponse>>();

const KEYWORD_RULES: KeywordRule[] = [
  { label: '회복', phase: 'recovery', pattern: '회복', weight: 1.2 },
  { label: '턴어라운드', phase: 'recovery', pattern: '턴어라운드', weight: 1.6 },
  { label: '저점 통과', phase: 'recovery', pattern: '저점통과', weight: 1.8 },
  { label: '바닥 통과', phase: 'recovery', pattern: '바닥통과', weight: 1.8 },
  { label: '반등', phase: 'recovery', pattern: '반등', weight: 1.3 },
  { label: '정상화', phase: 'recovery', pattern: '정상화', weight: 1.2 },
  { label: '재고 정상화', phase: 'recovery', pattern: '재고 정상화', weight: 1.6 },
  { label: 'recovery', phase: 'recovery', pattern: 'recovery', weight: 1.4 },
  { label: 'turnaround', phase: 'recovery', pattern: 'turnaround', weight: 1.6 },
  { label: '성장', phase: 'expansion', pattern: '성장', weight: 1.1 },
  { label: '확대', phase: 'expansion', pattern: '확대', weight: 1.1 },
  { label: '호황', phase: 'expansion', pattern: '호황', weight: 1.7 },
  { label: '증설', phase: 'expansion', pattern: '증설', weight: 1.5 },
  { label: '수주 확대', phase: 'expansion', pattern: '수주', weight: 1.3 },
  { label: '구조적 성장', phase: 'expansion', pattern: '구조적 성장', weight: 1.8 },
  { label: '업사이클', phase: 'expansion', pattern: '업사이클', weight: 1.8 },
  { label: 'growth', phase: 'expansion', pattern: 'growth', weight: 1.2 },
  { label: 'upcycle', phase: 'expansion', pattern: 'upcycle', weight: 1.8 },
  { label: 'expansion', phase: 'expansion', pattern: 'expansion', weight: 1.5 },
  { label: '둔화', phase: 'slowdown', pattern: '둔화', weight: 1.4 },
  { label: '감속', phase: 'slowdown', pattern: '감속', weight: 1.5 },
  { label: '조정', phase: 'slowdown', pattern: '조정', weight: 1.1 },
  { label: '부담', phase: 'slowdown', pattern: '부담', weight: 1.1 },
  { label: '약세', phase: 'slowdown', pattern: '약세', weight: 1.4 },
  { label: '수요 부진', phase: 'slowdown', pattern: '수요 부진', weight: 1.6 },
  { label: '마진 압박', phase: 'slowdown', pattern: '마진', weight: 1.1 },
  { label: 'slowdown', phase: 'slowdown', pattern: 'slowdown', weight: 1.5 },
  { label: 'softening', phase: 'slowdown', pattern: 'softening', weight: 1.5 },
  { label: '침체', phase: 'contraction', pattern: '침체', weight: 1.8 },
  { label: '부진 지속', phase: 'contraction', pattern: '부진', weight: 1.4 },
  { label: '다운사이클', phase: 'contraction', pattern: '다운사이클', weight: 1.9 },
  { label: '적자', phase: 'contraction', pattern: '적자', weight: 1.6 },
  { label: '재고 부담', phase: 'contraction', pattern: '재고 부담', weight: 1.8 },
  { label: '구조조정', phase: 'contraction', pattern: '구조조정', weight: 1.9 },
  { label: '가동률 하락', phase: 'contraction', pattern: '가동률', weight: 1.5 },
  { label: 'contraction', phase: 'contraction', pattern: 'contraction', weight: 1.8 },
  { label: 'downcycle', phase: 'contraction', pattern: 'downcycle', weight: 1.9 },
];

const SECTOR_RULES: Array<{ sector: string; patterns: string[] }> = [
  { sector: '반도체', patterns: ['반도체', '메모리', 'hbm', '파운드리', 'semiconductor', 'sk하이닉스', '삼성전자', 'nvidia', 'amd', 'tsmc'] },
  { sector: '2차전지', patterns: ['2차전지', '배터리', 'ess', '양극재', '음극재', '전고체', 'lg에너지솔루션', '삼성sdi', '에코프로'] },
  { sector: '바이오', patterns: ['바이오', '제약', '헬스케어', 'adc', '임상', '신약', '바이오시밀러', '셀트리온', '삼성바이오', '유한양행'] },
  { sector: '인터넷', patterns: ['인터넷', '플랫폼', '커머스', '광고', '클라우드', 'saas', '네이버', 'naver', '카카오', 'meta', 'alphabet'] },
  { sector: '엔터', patterns: ['엔터', '음반', '팬덤', '투어', '아티스트', '앨범', 'md', '하이브', 'jyp', '에스엠', 'sm '] },
  { sector: '게임', patterns: ['게임', '신작', '퍼블리싱', 'mmorpg', '모바일게임', '콘솔', '크래프톤', '넷마블', '엔씨', 'ncsoft'] },
  { sector: '금융', patterns: ['금융', '은행', '증권', '보험', '카드', '여신', '지주', 'kb금융', '신한지주', '하나금융'] },
  { sector: '자동차', patterns: ['자동차', '완성차', '전동화', '모빌리티', '타이어', '기아', '현대차', '현대모비스', 'tesla'] },
  { sector: '화학/정유', patterns: ['석유화학', '화학', '정유', '정제마진', '나프타', '윤활기유', 'lg화학', 's-oil', '에쓰오일'] },
  { sector: '조선/기계', patterns: ['조선', '선박', '해양', '가스선', '기계', '원전', '터빈', '두산에너빌리티', 'hd현대중공업', '한화오션'] },
  { sector: '화장품/소비재', patterns: ['화장품', '소비재', '브랜드', '오리온', '아모레', '코스맥스', '한국콜마', 'cj올리브영'] },
  { sector: '유통/여행', patterns: ['유통', '리테일', '면세점', '호텔', '여행', '카지노', '롯데관광', '신세계', '현대백화점'] },
];

function roundWhole(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCacheKey(days: number, market: MarketFilter) {
  return `${days}:${market}`;
}

function filterReports(reports: AnalystReport[], days: number, market: MarketFilter) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return reports
    .filter((report) => market === 'all' || report.market === market)
    .filter((report) => new Date(report.date) >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getCachedResponse(days: number, market: MarketFilter) {
  const cached = responseCache.get(getCacheKey(days, market));
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > SECTOR_CYCLE_CACHE_TTL_MS) {
    responseCache.delete(getCacheKey(days, market));
    return null;
  }

  return cached.data;
}

function normalizeText(parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferSector(report: AnalystReport) {
  if (report.sector && report.sector.trim()) {
    return report.sector.trim();
  }

  const combinedText = normalizeText([
    report.name,
    report.reportTitle,
    report.reasonSummary,
    report.sourceText,
    ...(report.reasonBullets || []),
  ]);

  let bestSector = '기타';
  let bestScore = 0;

  SECTOR_RULES.forEach((rule) => {
    const score = rule.patterns.reduce((sum, pattern) => sum + (combinedText.includes(pattern) ? 1 : 0), 0);
    if (score > bestScore) {
      bestSector = rule.sector;
      bestScore = score;
    }
  });

  return bestSector;
}

function getReportWeight(index: number) {
  return Math.max(0.45, 1 - index * 0.12);
}

function choosePhase(phaseScores: Record<SectorCyclePhase, number>, latestPhaseHits: Record<SectorCyclePhase, number>) {
  const orderedPhases: SectorCyclePhase[] = ['recovery', 'expansion', 'slowdown', 'contraction'];

  return orderedPhases.sort((a, b) => {
    if (phaseScores[b] !== phaseScores[a]) {
      return phaseScores[b] - phaseScores[a];
    }
    return latestPhaseHits[b] - latestPhaseHits[a];
  })[0];
}

function getConfidence(reportCount: number, dominantScore: number): SectorCycleConfidence {
  if (reportCount < 2 || dominantScore <= 0) {
    return 'low';
  }

  if (reportCount >= 4 && dominantScore >= 4) {
    return 'high';
  }

  return 'medium';
}

function buildRecentReports(reports: AnalystReport[]): SectorCycleRecentReport[] {
  return reports.slice(0, 3).map((report) => ({
    date: report.date,
    ticker: report.ticker,
    name: report.name,
    market: report.market,
    broker: report.broker,
    reasonSummary: report.reasonSummary || report.reportTitle || `${report.broker} 리포트 요약이 아직 정리되지 않았습니다.`,
    currentPrice: report.currentPrice,
  }));
}

function buildSectorCycleItem(sector: string, reports: AnalystReport[]): SectorCycleItem {
  const sorted = [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const phaseScores: Record<SectorCyclePhase, number> = {
    recovery: 0,
    expansion: 0,
    slowdown: 0,
    contraction: 0,
  };
  const latestPhaseHits: Record<SectorCyclePhase, number> = {
    recovery: 0,
    expansion: 0,
    slowdown: 0,
    contraction: 0,
  };
  const keywordScores = new Map<string, number>();

  sorted.forEach((report, index) => {
    const reportWeight = getReportWeight(index);
    const combinedText = normalizeText([
      report.reportTitle,
      report.reasonSummary,
      report.sourceText,
      ...(report.reasonBullets || []),
    ]);
    const bulletText = normalizeText(report.reasonBullets || []);

    KEYWORD_RULES.forEach((rule) => {
      if (!combinedText.includes(rule.pattern)) {
        return;
      }

      const bulletBonus = bulletText.includes(rule.pattern) ? reportWeight * rule.weight * 0.6 : 0;
      const score = reportWeight * rule.weight + bulletBonus;

      phaseScores[rule.phase] += score;
      latestPhaseHits[rule.phase] += reportWeight;
      keywordScores.set(rule.label, (keywordScores.get(rule.label) || 0) + score);
    });
  });

  const phase = choosePhase(phaseScores, latestPhaseHits);
  const dominantScore = phaseScores[phase];
  const phaseScore = dominantScore > 0
    ? clamp(roundWhole(dominantScore * 14 + Math.min(sorted.length, 5) * 6), 0, 100)
    : 0;
  const confidence = getConfidence(sorted.length, dominantScore);
  const keywords = Array.from(keywordScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword);

  return {
    sector,
    phase,
    phaseScore,
    confidence,
    reportCount: sorted.length,
    latestReportDate: sorted[0]?.date || '',
    keywords,
    recentReports: buildRecentReports(sorted),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SectorCycleResponse | { error: string }>
) {
  const { days = '30', market = 'all' } = req.query;
  const daysNum = Number.parseInt(String(days), 10) || 30;
  const marketFilter = String(market) as MarketFilter;

  try {
    const cached = getCachedResponse(daysNum, marketFilter);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const cacheKey = getCacheKey(daysNum, marketFilter);
    const inflight = responseInflight.get(cacheKey);
    const response = inflight || (async () => {
      const cacheFile = await loadAnalystData();
      const reports = filterReports(cacheFile.reports, daysNum, marketFilter);
      const grouped = new Map<string, AnalystReport[]>();

      reports.forEach((report) => {
        const key = inferSector(report);
        const existing = grouped.get(key) || [];
        existing.push(report);
        grouped.set(key, existing);
      });

      const items = Array.from(grouped.entries())
        .map(([sector, sectorReports]) => buildSectorCycleItem(sector, sectorReports))
        .filter((item) => item.reportCount > 0)
        .filter((item) => item.sector !== '기타' || item.reportCount >= 2)
        .sort((a, b) => {
          if (b.phaseScore !== a.phaseScore) {
            return b.phaseScore - a.phaseScore;
          }
          if (b.reportCount !== a.reportCount) {
            return b.reportCount - a.reportCount;
          }
          return new Date(b.latestReportDate).getTime() - new Date(a.latestReportDate).getTime();
        });

      return {
        generatedAt: cacheFile.generatedAt,
        days: daysNum,
        market: marketFilter,
        items,
      } satisfies SectorCycleResponse;
    })();

    if (!inflight) {
      responseInflight.set(cacheKey, response);
    }

    const resolved = await response;
    responseCache.set(cacheKey, {
      data: resolved,
      fetchedAt: Date.now(),
    });
    responseInflight.delete(cacheKey);

    res.status(200).json(resolved);
  } catch (error) {
    responseInflight.delete(getCacheKey(daysNum, marketFilter));
    console.error('Error building sector cycle heatmap:', error);
    res.status(500).json({ error: 'Failed to build sector cycle heatmap' });
  }
}
