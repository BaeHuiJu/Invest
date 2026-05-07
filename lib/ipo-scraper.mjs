/**
 * IPO scraper — plain JS so it can run in GitHub Actions (Node 20, no tsx needed).
 * Mirrors the core logic from pages/api/ipo-calendar.ts.
 */

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://www.38.co.kr/',
};

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return normalizeWhitespace(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

function extractTableRows(html) {
  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = stripHtml(cellMatch[1]);
      if (text) cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseInteger(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function deriveStatus(subscriptionStart, subscriptionEnd, listingDate, todayStr) {
  if (listingDate && listingDate <= todayStr) return '상장완료';
  if (subscriptionEnd < todayStr) return '상장예정';
  if (subscriptionStart <= todayStr) return '청약중';
  return '청약예정';
}

function detailUrl(id) {
  return `https://www.38.co.kr/html/fund/?o=v&no=${id}&l=&page=1`;
}

async function fetch38Detail(id) {
  try {
    const response = await fetch(detailUrl(id), {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buffer);

    const listingDate = parseDate(
      (html.match(/상장일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i) ?? [])[1],
    );
    const refundDate = parseDate(
      (html.match(/환불일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i) ?? [])[1],
    );
    return { listingDate, refundDate };
  } catch {
    return { listingDate: null, refundDate: null };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function scrapeIpoList() {
  const response = await fetch('https://www.38.co.kr/html/fund/index.htm?o=k', {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  const buffer = await response.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buffer);
  const tbodyMatch = html.match(/summary="공모주 청약일정"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);

  if (!tbodyMatch) throw new Error('38.co.kr 테이블 파싱 실패');

  const rawDeals = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
    const rowHtml = rowMatch[1];
    const linkMatch = rowHtml.match(/(?:[?&]|&amp;)no=(\d+)[^"]*"[^>]*>\s*<font[^>]*>([^<]+)<\/font>/i);
    if (!linkMatch) continue;

    const id = linkMatch[1];
    const name = normalizeWhitespace(linkMatch[2]);
    const cells = extractTableRows(`<table><tr>${rowHtml}</tr></table>`)[0] ?? [];
    const periodRaw = cells[1] ?? '';
    const periodMatch = periodRaw.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})/);
    if (!periodMatch) continue;

    const [, year, startMonth, startDay, endMonth, endDay] = periodMatch;
    rawDeals.push({
      id,
      name,
      subscriptionStart: `${year}-${startMonth}-${startDay}`,
      subscriptionEnd: `${year}-${endMonth}-${endDay}`,
      confirmedPrice: parseInteger(cells[2] ?? ''),
      priceBandLow: null,
      priceBandHigh: null,
      underwriter: normalizeWhitespace(cells[5] ?? ''),
      competitionRatio: normalizeWhitespace(cells[4] ?? '') || null,
    });
  }

  const todayStr = today();
  // Only fetch detail pages for deals within 60 days of today (skips old 상장완료)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const enriched = await mapWithConcurrency(rawDeals, 3, async (deal) => {
    let listingDate = null;
    let refundDate = null;

    if (deal.subscriptionEnd >= cutoffStr) {
      const detail = await fetch38Detail(deal.id);
      listingDate = detail.listingDate;
      refundDate = detail.refundDate;
    }

    return {
      ...deal,
      listingDate,
      refundDate,
      detailUrl: detailUrl(deal.id),
      status: deriveStatus(deal.subscriptionStart, deal.subscriptionEnd, listingDate, todayStr),
      calculator: null, // not needed for calendar view; computed on demand in API if needed
    };
  });

  return { ipos: enriched, fetchedAt: new Date().toISOString(), totalCount: enriched.length };
}
