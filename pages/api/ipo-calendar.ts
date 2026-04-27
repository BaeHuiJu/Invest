import type { NextApiRequest, NextApiResponse } from 'next';

// ── Types ──────────────────────────────────────────────────────────────────

export type IpoStatus = '청약예정' | '청약중' | '상장예정' | '상장완료';

export interface IpoDeal {
  id: string;
  name: string;
  subscriptionStart: string;   // ISO "2026-04-27"
  subscriptionEnd: string;
  refundDate: string | null;
  listingDate: string | null;
  priceBandLow: number | null;
  priceBandHigh: number | null;
  confirmedPrice: number | null;
  underwriter: string;
  competitionRatio: string | null;
  status: IpoStatus;
}

export interface IpoCalendarResponse {
  ipos: IpoDeal[];
  fetchedAt: string;
  totalCount: number;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
type CacheEntry = { data: IpoCalendarResponse; fetchedAt: number };
const responseCache = new Map<string, CacheEntry>();
let inflight: Promise<IpoCalendarResponse> | null = null;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.38.co.kr/',
};

// ── Date helpers ────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const m = raw.match(/(\d{4})[./](\d{2})[./](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function deriveStatus(
  subscriptionStart: string,
  subscriptionEnd: string,
  listingDate: string | null,
  todayStr: string,
): IpoStatus {
  if (listingDate && listingDate <= todayStr) return '상장완료';
  if (subscriptionEnd < todayStr) return '상장예정';
  if (subscriptionStart <= todayStr) return '청약중';
  return '청약예정';
}

// ── Detail page: listing & refund dates ─────────────────────────────────────

async function fetchDetailDates(id: string): Promise<{ listingDate: string | null; refundDate: string | null }> {
  try {
    const url = `https://www.38.co.kr/html/fund/?o=v&no=${id}&l=&page=1`;
    const resp = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
    const buf = await resp.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buf);

    // 상장일: <td ...>상장일</td><td ...>&nbsp; 2026.04.29</td>
    const listingMatch = html.match(/상장일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i);
    const refundMatch  = html.match(/환불일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i);

    return {
      listingDate: listingMatch ? parseDate(listingMatch[1]) : null,
      refundDate:  refundMatch  ? parseDate(refundMatch[1])  : null,
    };
  } catch {
    return { listingDate: null, refundDate: null };
  }
}

// ── Main list scraper ────────────────────────────────────────────────────────

async function scrapeIpoList(): Promise<IpoDeal[]> {
  const resp = await fetch('https://www.38.co.kr/html/fund/index.htm?o=k', {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  const buf = await resp.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buf);

  // tbody of the 공모주 청약일정 table
  const tbodyMatch = html.match(/summary="공모주 청약일정"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const todayStr = today();
  const raw: Omit<IpoDeal, 'status' | 'refundDate' | 'listingDate'>[] = [];

  // Each <tr> row
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
    const row = rowMatch[1];

    // id + name from: href="...?o=v&no=2289..." > <font ...>종목명</font>
    const linkMatch = row.match(/(?:[?&]|&amp;)no=(\d+)[^"]*"[^>]*>\s*<font[^>]*>([^<]+)<\/font>/i);
    if (!linkMatch) continue;
    const id   = linkMatch[1];
    const name = linkMatch[2].trim().replace(/\s+/g, ' ');

    // All <td> text values (strip tags, trim)
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    // tds[0]=종목명, tds[1]=청약기간, tds[2]=확정공모가, tds[3]=희망공모가, tds[4]=경쟁률, tds[5]=주간사

    // 청약기간: "2026.06.17~06.18" or "2026.05.29~06.01"
    const periodRaw = tds[1] ?? '';
    const periodMatch = periodRaw.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})/);
    if (!periodMatch) continue;
    const [, yr, sm, sd, em, ed] = periodMatch;
    const subscriptionStart = `${yr}-${sm}-${sd}`;
    const subscriptionEnd   = `${yr}-${em}-${ed}`;

    // 확정공모가
    const confirmedRaw = (tds[2] ?? '').replace(/[,원\s]/g, '');
    const confirmedPrice = /^\d+$/.test(confirmedRaw) ? parseInt(confirmedRaw, 10) : null;

    // 희망공모가 범위 "12,400~14,800"
    const bandRaw = (tds[3] ?? '').replace(/[원\s]/g, '');
    const bandMatch = bandRaw.match(/([\d,]+)~([\d,]+)/);
    const priceBandLow  = bandMatch ? parseInt(bandMatch[1].replace(/,/g, ''), 10) : null;
    const priceBandHigh = bandMatch ? parseInt(bandMatch[2].replace(/,/g, ''), 10) : null;

    // 청약경쟁률
    const competitionRatio = (tds[4] ?? '').trim() || null;

    // 주간사
    const underwriter = (tds[5] ?? '').trim();

    raw.push({ id, name, subscriptionStart, subscriptionEnd, priceBandLow, priceBandHigh, confirmedPrice, underwriter, competitionRatio });
  }

  // Fetch detail dates for items with completed subscription (max 10 concurrent)
  const needDetail = raw.filter((r) => r.subscriptionEnd < todayStr).slice(0, 10);
  const detailMap = new Map<string, { listingDate: string | null; refundDate: string | null }>();

  await Promise.all(
    needDetail.map(async (r) => {
      const dates = await fetchDetailDates(r.id);
      detailMap.set(r.id, dates);
    }),
  );

  return raw.map((r) => {
    const detail = detailMap.get(r.id) ?? { listingDate: null, refundDate: null };
    return {
      ...r,
      refundDate:  detail.refundDate,
      listingDate: detail.listingDate,
      status: deriveStatus(r.subscriptionStart, r.subscriptionEnd, detail.listingDate, todayStr),
    };
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function buildResponse(): Promise<IpoCalendarResponse> {
  try {
    const ipos = await scrapeIpoList();
    return { ipos, fetchedAt: new Date().toISOString(), totalCount: ipos.length };
  } catch (err) {
    console.error('[ipo-calendar] scrape failed:', err);
    return { ipos: [], fetchedAt: new Date().toISOString(), totalCount: 0 };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IpoCalendarResponse | { error: string }>,
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cacheKey = 'ipo';
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const promise = inflight ?? buildResponse().then((data) => {
      responseCache.set(cacheKey, { data, fetchedAt: Date.now() });
      inflight = null;
      return data;
    }).catch((e) => { inflight = null; throw e; });

    if (!inflight) inflight = promise;
    const result = await promise;
    return res.status(200).json(result);
  } catch (err) {
    inflight = null;
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `IPO 데이터 로딩 실패: ${msg}` });
  }
}
