import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';

import {
  DEFAULT_IPO_FALLBACKS,
  extractKnownBrokerNames,
  getBrokerRule,
  isKnownBrokerName,
  normalizeBrokerName,
} from '@/lib/ipo-broker-rules';
import type {
  IpoBrokerOption,
  IpoCalcConfidence,
  IpoCalcPhase,
  IpoCalcStatus,
  IpoCalculatorData,
  IpoCalendarResponse,
  IpoDeal,
  IpoFieldSource,
  IpoOfferingPriceSource,
  IpoSourceTraceEntry,
  IpoTrackedField,
  IpoStatus,
} from '@/lib/ipo-types';

type RawIpoDeal = Omit<IpoDeal, 'status' | 'refundDate' | 'listingDate' | 'detailUrl' | 'calculator'>;

type ParsedCalculatorFields = {
  brokerNames: string[];
  brokerDetails: Record<string, { generalAllocationShares: number | null; maxSubscriptionShares: number | null; notes: string[] }>;
  minSubscriptionShares: number | null;
  subscriptionUnit: number | null;
  depositRate: number | null;
  offeringPrice: number | null;
  overallCompetitionRate: number | null;
  equalCompetitionRate: number | null;
  proportionalCompetitionRate: number | null;
  generalAllocationShares: number | null;
  equalAllocationShares: number | null;
  proportionalAllocationShares: number | null;
  accountRestrictionText: string | null;
  feesText: string | null;
  feeAmount: number | null;
  notes: string[];
  source: IpoFieldSource;
};

type Detail38Payload = {
  listingDate: string | null;
  refundDate: string | null;
  parsed: ParsedCalculatorFields;
};

type DartDisclosurePayload = {
  corpCode: string;
  reportName: string;
  receiptNumber: string;
  parsed: ParsedCalculatorFields;
} | null;

type CorpCodeEntry = {
  corpCode: string;
  corpName: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const DART_DOC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DART_API_KEY = process.env.OPEN_DART_API_KEY ?? process.env.DART_API_KEY ?? null;

type CacheEntry = { data: IpoCalendarResponse; fetchedAt: number };
type StringCacheEntry = { value: string; fetchedAt: number };

const responseCache = new Map<string, CacheEntry>();
const dartDocumentCache = new Map<string, StringCacheEntry>();
let inflight: Promise<IpoCalendarResponse> | null = null;
let dartCorpMapCache: { entries: CorpCodeEntry[]; fetchedAt: number } | null = null;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://www.38.co.kr/',
};

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function dateToCompact(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  date.setDate(date.getDate() + deltaDays);
  return date.toISOString().split('T')[0];
}

function detailUrl(id: string): string {
  return `https://www.38.co.kr/html/fund/?o=v&no=${id}&l=&page=1`;
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

function deriveCalcPhase(subscriptionStart: string, subscriptionEnd: string, todayStr: string): IpoCalcPhase {
  if (todayStr < subscriptionStart) return 'pre_subscription';
  if (todayStr <= subscriptionEnd) return 'live_subscription';
  return 'post_close';
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
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

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = stripHtml(cellMatch[1]);
      if (text) cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }

  return rows;
}

function rowToText(row: string[]): string {
  return normalizeWhitespace(row.join(' | '));
}

function parseInteger(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d]/g, '');
  return cleaned ? Number.parseInt(cleaned, 10) : null;
}

function parseMaxInteger(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const values = Array.from(raw.matchAll(/\d[\d,]*/g))
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
}

function parseDecimal(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  return cleaned ? Number.parseFloat(cleaned) : null;
}

function parseRate(raw: string | null | undefined): number | null {
  const value = parseDecimal(raw);
  if (!value || value <= 0) return null;
  return value / 100;
}

function parseCompetitionRatio(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/([\d,.]+)\s*(?::|대)\s*1/);
  return parseDecimal(match?.[1] ?? raw);
}

function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return null;
}

export function splitBrokerNames(raw: string): string[] {
  const knownMatches = extractKnownBrokerNames(raw);
  if (knownMatches.length > 0) return knownMatches;

  return Array.from(new Set(
    raw
      .replace(/\([^)]*\)/g, ' ')
      .split(/,|\/|·|ㆍ|\r?\n/)
      .map((name) => normalizeWhitespace(name.replace(/대표주관|공동주관|주간사|주관회사|인수회사/g, '')))
      .filter((name) => Boolean(name) && (isKnownBrokerName(name) || /(증권|금융투자)/.test(name)))
      .map((name) => normalizeBrokerName(name)),
  ));
}

export function parseBrokerDetailsFromRows(rows: string[][]): Record<string, { generalAllocationShares: number | null; maxSubscriptionShares: number | null; notes: string[] }> {
  const details: Record<string, { generalAllocationShares: number | null; maxSubscriptionShares: number | null; notes: string[] }> = {};

  for (const row of rows) {
    if (row.length < 2) continue;
    const brokerName = splitBrokerNames(row[0])[0];
    if (!brokerName) continue;

    const generalAllocationShares = parseMaxInteger(row[1]);
    const maxSubscriptionShares = parseMaxInteger(row[2] ?? null);
    const notes = row.slice(3).map((cell) => normalizeWhitespace(cell)).filter(Boolean);

    details[brokerName] = {
      generalAllocationShares,
      maxSubscriptionShares,
      notes,
    };
  }

  return details;
}

function resolveOfferingPriceSource(deal: RawIpoDeal): {
  offeringPrice: number | null;
  offeringPriceSource: IpoOfferingPriceSource;
} {
  if (deal.confirmedPrice) {
    return { offeringPrice: deal.confirmedPrice, offeringPriceSource: 'confirmed' };
  }
  if (deal.priceBandHigh) {
    return { offeringPrice: deal.priceBandHigh, offeringPriceSource: 'band_high' };
  }
  if (deal.priceBandLow) {
    return { offeringPrice: deal.priceBandLow, offeringPriceSource: 'band_low' };
  }
  return { offeringPrice: null, offeringPriceSource: 'unknown' };
}

function parseOfferingPriceFromText(text: string): number | null {
  return parseInteger(
    findFirstMatch(text, [
      /확정\s*공모가(?:액)?\s*[:|]?\s*([\d,]+)\s*원?/,
      /공모가(?:액)?\s*[:|]?\s*([\d,]+)\s*원?/,
      /모집가액\s*[:|]?\s*([\d,]+)\s*원?/,
    ]),
  );
}

function parseCalculatorFieldsFromText(
  rawText: string,
  fallbackBrokerNames: string[],
  source: IpoFieldSource,
  overallCompetitionText?: string | null,
): ParsedCalculatorFields {
  const brokerLineMatch = rawText.match(
    /(?:대표)?주관(?:회사|사)?\s*[:|]?\s*([\s\S]*?)(?=주식수\s*:|청약한도|인수회사|공모청약일정|수요예측|신규상장|$)/,
  ) ?? rawText.match(
    /주간사\s*[:|]?\s*([\s\S]*?)(?=주식수\s*:|청약한도|인수회사|공모청약일정|수요예측|신규상장|$)/,
  ) ?? rawText.match(
    /인수회사\s*[:|]?\s*([\s\S]*?)(?=주식수\s*:|청약한도|공모청약일정|수요예측|신규상장|$)/,
  );
  const text = normalizeWhitespace(rawText);
  const brokerNames = splitBrokerNames(
    normalizeWhitespace(brokerLineMatch?.[1] ?? '') || fallbackBrokerNames.join(','),
  );

  const minSubscriptionShares = parseInteger(
    findFirstMatch(text, [
      /최소\s*청약\s*(?:수량|주수)\s*[:|]?\s*([\d,]+)\s*주?/,
      /일반청약\s*최소\s*([\d,]+)\s*주?/,
      /최저청약주수\s*[:|]?\s*([\d,]+)\s*주?/,
    ]),
  );
  const subscriptionUnit = parseInteger(
    findFirstMatch(text, [
      /청약\s*단위\s*[:|]?\s*([\d,]+)\s*주?/,
      /청약단위\s*[:|]?\s*([\d,]+)\s*주?/,
    ]),
  );
  const depositRate = parseRate(
    findFirstMatch(text, [
      /청약증거금(?:률|율)?\s*[:|]?\s*([\d.]+)\s*%/,
      /증거금(?:률|율)?\s*[:|]?\s*([\d.]+)\s*%/,
    ]),
  );
  const equalCompetitionRate = parseCompetitionRatio(
    findFirstMatch(text, [
      /균등(?:배정)?\s*경쟁률\s*[:|]?\s*([\d,.:대 ]+1)/,
      /균등\s*[:|]?\s*([\d,.:대 ]+1)/,
    ]),
  );
  const proportionalCompetitionRate = parseCompetitionRatio(
    findFirstMatch(text, [
      /비례(?:배정)?\s*경쟁률\s*[:|]?\s*([\d,.:대 ]+1)/,
      /비례\s*[:|]?\s*([\d,.:대 ]+1)/,
    ]),
  );
  const overallCompetitionRate = parseCompetitionRatio(overallCompetitionText) ?? parseCompetitionRatio(
    findFirstMatch(text, [
      /청약경쟁률\s*[:|]?\s*([\d,.:대 ]+1)/,
      /경쟁률\s*[:|]?\s*([\d,.:대 ]+1)/,
    ]),
  );
  const generalAllocationShares = parseInteger(
    findFirstMatch(text, [
      /일반청약(?:자)?\s*배정(?:수량|주식수)?\s*[:|]?\s*([\d,]+)\s*주?/,
      /일반공모\s*배정(?:수량|주식수)?\s*[:|]?\s*([\d,]+)\s*주?/,
    ]),
  );
  const equalAllocationShares = parseInteger(
    findFirstMatch(text, [
      /균등(?:배정)?\s*(?:수량|주식수)\s*[:|]?\s*([\d,]+)\s*주?/,
      /균등배정분\s*[:|]?\s*([\d,]+)\s*주?/,
    ]),
  );
  const proportionalAllocationShares = parseInteger(
    findFirstMatch(text, [
      /비례(?:배정)?\s*(?:수량|주식수)\s*[:|]?\s*([\d,]+)\s*주?/,
      /비례배정분\s*[:|]?\s*([\d,]+)\s*주?/,
    ]),
  );
  const accountRestrictionText = findFirstMatch(text, [
    /청약자격\s*[:|]?\s*([^\n]+)/,
    /계좌개설\s*[:|]?\s*([^\n]+)/,
    /청약한도\s*[:|]?\s*([^\n]+)/,
  ]);
  const feesText = findFirstMatch(text, [
    /청약수수료\s*[:|]?\s*([^\n]+)/,
    /수수료\s*[:|]?\s*([^\n]+)/,
  ]);
  const feeAmount = parseInteger(feesText);
  const offeringPrice = parseOfferingPriceFromText(text);

  const notes: string[] = [];
  if (depositRate) notes.push(`증거금률 ${Math.round(depositRate * 100)}%`);
  if (minSubscriptionShares) notes.push(`최소 청약 ${minSubscriptionShares.toLocaleString()}주`);
  if (subscriptionUnit) notes.push(`청약 단위 ${subscriptionUnit.toLocaleString()}주`);
  if (overallCompetitionRate) notes.push(`전체 경쟁률 ${overallCompetitionRate.toLocaleString()}:1`);
  if (equalCompetitionRate) notes.push(`균등 경쟁률 ${equalCompetitionRate.toLocaleString()}:1`);
  if (proportionalCompetitionRate) notes.push(`비례 경쟁률 ${proportionalCompetitionRate.toLocaleString()}:1`);

  return {
    brokerNames: brokerNames.length > 0 ? brokerNames : fallbackBrokerNames,
    brokerDetails: {},
    minSubscriptionShares,
    subscriptionUnit,
    depositRate,
    offeringPrice,
    overallCompetitionRate,
    equalCompetitionRate,
    proportionalCompetitionRate,
    generalAllocationShares,
    equalAllocationShares,
    proportionalAllocationShares,
    accountRestrictionText,
    feesText,
    feeAmount,
    notes,
    source,
  };
}

function createEmptyParsedFields(source: IpoFieldSource, brokerNames: string[]): ParsedCalculatorFields {
  return {
    brokerNames,
    brokerDetails: {},
    minSubscriptionShares: null,
    subscriptionUnit: null,
    depositRate: null,
    offeringPrice: null,
    overallCompetitionRate: null,
    equalCompetitionRate: null,
    proportionalCompetitionRate: null,
    generalAllocationShares: null,
    equalAllocationShares: null,
    proportionalAllocationShares: null,
    accountRestrictionText: null,
    feesText: null,
    feeAmount: null,
    notes: [],
    source,
  };
}

function pickValue<T>(
  candidates: Array<{ value: T | null | undefined; source: IpoFieldSource; note?: string | null }>,
): { value: T | null; source: IpoFieldSource; note?: string | null } {
  for (const candidate of candidates) {
    if (candidate.value !== null && candidate.value !== undefined && candidate.value !== '') {
      return { value: candidate.value, source: candidate.source, note: candidate.note ?? null };
    }
  }
  return { value: null, source: 'unknown', note: null };
}

function normalizeCorpName(name: string): string {
  return name
    .replace(/\(주\)|주식회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .toLowerCase();
}

function unzipFirstEntry(buffer: Buffer): string | null {
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return buffer.toString('utf-8');
  }

  const compressionMethod = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const fileNameLength = buffer.readUInt16LE(26);
  const extraFieldLength = buffer.readUInt16LE(28);
  const dataOffset = 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataOffset + compressedSize;
  if (dataEnd > buffer.length) return null;

  const payload = buffer.subarray(dataOffset, dataEnd);
  if (compressionMethod === 0) return payload.toString('utf-8');
  if (compressionMethod === 8) return inflateRawSync(payload).toString('utf-8');
  return null;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }
  return response.text();
}

async function loadDartCorpCodes(): Promise<CorpCodeEntry[]> {
  if (!DART_API_KEY) return [];
  if (dartCorpMapCache && Date.now() - dartCorpMapCache.fetchedAt < DART_DOC_CACHE_TTL_MS) {
    return dartCorpMapCache.entries;
  }

  const response = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_API_KEY}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`DART corpCode fetch failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const xml = unzipFirstEntry(buffer);
  if (!xml) return [];

  const entries: CorpCodeEntry[] = [];
  const listRegex = /<list>([\s\S]*?)<\/list>/g;
  let match: RegExpExecArray | null;
  while ((match = listRegex.exec(xml)) !== null) {
    const corpCode = match[1].match(/<corp_code>([^<]+)<\/corp_code>/)?.[1]?.trim();
    const corpName = match[1].match(/<corp_name>([^<]+)<\/corp_name>/)?.[1]?.trim();
    if (corpCode && corpName) {
      entries.push({ corpCode, corpName });
    }
  }

  dartCorpMapCache = { entries, fetchedAt: Date.now() };
  return entries;
}

async function resolveDartCorpCode(companyName: string): Promise<string | null> {
  const entries = await loadDartCorpCodes();
  if (entries.length === 0) return null;

  const normalized = normalizeCorpName(companyName);
  const exact = entries.find((entry) => normalizeCorpName(entry.corpName) === normalized);
  if (exact) return exact.corpCode;

  const loose = entries
    .filter((entry) => normalizeCorpName(entry.corpName).includes(normalized) || normalized.includes(normalizeCorpName(entry.corpName)))
    .sort((left, right) => left.corpName.length - right.corpName.length)[0];

  return loose?.corpCode ?? null;
}

async function fetchDartDisclosureDocument(receiptNumber: string): Promise<string | null> {
  const cached = dartDocumentCache.get(receiptNumber);
  if (cached && Date.now() - cached.fetchedAt < DART_DOC_CACHE_TTL_MS) {
    return cached.value;
  }
  if (!DART_API_KEY) return null;

  const response = await fetch(
    `https://opendart.fss.or.kr/api/document.xml?crtfc_key=${DART_API_KEY}&rcept_no=${receiptNumber}`,
    { signal: AbortSignal.timeout(12000) },
  );
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  const xml = unzipFirstEntry(buffer);
  if (!xml) return null;

  dartDocumentCache.set(receiptNumber, { value: xml, fetchedAt: Date.now() });
  return xml;
}

async function fetchDartDisclosure(deal: RawIpoDeal): Promise<DartDisclosurePayload> {
  if (!DART_API_KEY) return null;

  try {
    const corpCode = await resolveDartCorpCode(deal.name);
    if (!corpCode) return null;

    const beginDate = dateToCompact(shiftIsoDate(deal.subscriptionStart, -365));
    const endDate = dateToCompact(shiftIsoDate(deal.subscriptionEnd, 30));
    const url =
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}` +
      `&corp_code=${corpCode}&bgn_de=${beginDate}&end_de=${endDate}` +
      '&last_reprt_at=Y&sort=date&sort_mth=desc&page_count=100';
    const jsonText = await fetchText(url);
    const payload = JSON.parse(jsonText) as {
      status?: string;
      list?: Array<{ report_nm?: string; rcept_no?: string; rcept_dt?: string }>;
    };

    if (payload.status && payload.status !== '000') return null;

    const filing = payload.list?.find((entry) => /증권신고서|정정증권신고서|소액공모/.test(entry.report_nm ?? ''));
    if (!filing?.rcept_no) return null;

    const xml = await fetchDartDisclosureDocument(filing.rcept_no);
    if (!xml) return null;

    const parsed = parseCalculatorFieldsFromText(stripHtml(xml), splitBrokerNames(deal.underwriter), 'dart');
    return {
      corpCode,
      reportName: filing.report_nm ?? '증권신고서',
      receiptNumber: filing.rcept_no,
      parsed,
    };
  } catch {
    return null;
  }
}

async function fetch38DetailData(deal: RawIpoDeal): Promise<Detail38Payload> {
  try {
    const response = await fetch(detailUrl(deal.id), {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buffer);
    const rows = extractTableRows(html);
    const lines = rows.map(rowToText);
    const text = lines.join('\n');

    const listingDate = parseDate(
      findFirstMatch(html, [/상장일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i]),
    );
    const refundDate = parseDate(
      findFirstMatch(html, [/환불일<\/td>\s*<td[^>]*>[^<]*?([\d.]+)\s*(?:<br>)?<\/td>/i]),
    );

    return {
      listingDate,
      refundDate,
      parsed: (() => {
        const parsed = parseCalculatorFieldsFromText(text, splitBrokerNames(deal.underwriter), 'thirtyeight', deal.competitionRatio);
        return {
          ...parsed,
          brokerDetails: parseBrokerDetailsFromRows(rows),
          notes: lines.slice(0, 8),
        };
      })(),
    };
  } catch {
    return {
      listingDate: null,
      refundDate: null,
      parsed: createEmptyParsedFields('thirtyeight', splitBrokerNames(deal.underwriter)),
    };
  }
}

function computeFieldSourceConfidence(brokers: IpoBrokerOption[], offeringPriceSource: IpoFieldSource): IpoCalcConfidence {
  const derivedCount = brokers.reduce((count, broker) => {
    const sources = Object.values(broker.fieldSources);
    return count + sources.filter((source) => source === 'derived').length;
  }, offeringPriceSource === 'derived' ? 1 : 0);

  if (derivedCount >= 4) return 'low';
  if (derivedCount >= 1) return 'medium';
  return 'high';
}

function computeDefaultRecommendation(offeringPrice: number | null, brokers: IpoBrokerOption[]): {
  bestBrokerByExpectedShares: string | null;
  bestBrokerByLowestDeposit: string | null;
  reason: string | null;
} {
  if (!offeringPrice) {
    return {
      bestBrokerByExpectedShares: null,
      bestBrokerByLowestDeposit: null,
      reason: null,
    };
  }

  const bestByLowestDeposit = [...brokers]
    .filter((broker) => broker.depositRate && broker.minSubscriptionShares)
    .sort((left, right) => {
      const leftDeposit = (left.depositRate ?? 0) * (left.minSubscriptionShares ?? 0) * offeringPrice;
      const rightDeposit = (right.depositRate ?? 0) * (right.minSubscriptionShares ?? 0) * offeringPrice;
      if (leftDeposit !== rightDeposit) return leftDeposit - rightDeposit;
      return (left.feeAmount ?? 0) - (right.feeAmount ?? 0);
    })[0];

  return {
    bestBrokerByExpectedShares: null,
    bestBrokerByLowestDeposit: bestByLowestDeposit?.brokerName ?? null,
    reason: bestByLowestDeposit
      ? `${bestByLowestDeposit.brokerName}이(가) 최소 청약 증거금 기준 기본 추천입니다.`
      : null,
  };
}

function buildCalculatorData(
  deal: RawIpoDeal,
  detail38: Detail38Payload,
  dartDisclosure: DartDisclosurePayload,
  todayStr: string,
): IpoCalculatorData {
  const brokerNames = Array.from(
    new Set([
      ...splitBrokerNames(deal.underwriter),
      ...detail38.parsed.brokerNames,
      ...(dartDisclosure?.parsed.brokerNames ?? []),
    ]),
  );

  const offeringPricePicked = pickValue<number>([
    { value: dartDisclosure?.parsed.offeringPrice, source: 'dart', note: dartDisclosure?.reportName ?? null },
    { value: detail38.parsed.offeringPrice, source: 'thirtyeight', note: '38.co.kr 상세' },
    { value: resolveOfferingPriceSource(deal).offeringPrice, source: 'derived', note: '공모가 밴드 또는 확정 공모가' },
  ]);

  const brokerOptions: IpoBrokerOption[] = brokerNames.map((brokerName) => {
    const rule = getBrokerRule(brokerName);
    const normalizedBrokerName = normalizeBrokerName(brokerName);

    const depositRatePicked = pickValue<number>([
      { value: detail38.parsed.depositRate, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.depositRate, source: 'dart', note: dartDisclosure?.reportName ?? null },
      { value: DEFAULT_IPO_FALLBACKS.depositRate, source: 'derived', note: '국내 IPO 기본 증거금률 50%' },
    ]);
    const minSharesPicked = pickValue<number>([
      { value: detail38.parsed.minSubscriptionShares, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.minSubscriptionShares, source: 'dart', note: dartDisclosure?.reportName ?? null },
      { value: DEFAULT_IPO_FALLBACKS.minSubscriptionShares, source: 'derived', note: '기본 최소 청약 수량 10주' },
    ]);
    const unitPicked = pickValue<number>([
      { value: detail38.parsed.subscriptionUnit, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.subscriptionUnit, source: 'dart', note: dartDisclosure?.reportName ?? null },
      { value: minSharesPicked.value ?? DEFAULT_IPO_FALLBACKS.subscriptionUnit, source: 'derived', note: '기본 청약 단위 10주' },
    ]);
    const overallCompetitionPicked = pickValue<number>([
      { value: detail38.parsed.overallCompetitionRate, source: 'thirtyeight' },
      { value: parseCompetitionRatio(deal.competitionRatio), source: 'thirtyeight', note: '목록 경쟁률' },
    ]);
    const equalCompetitionPicked = pickValue<number>([
      { value: detail38.parsed.equalCompetitionRate, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.equalCompetitionRate, source: 'dart', note: dartDisclosure?.reportName ?? null },
    ]);
    const proportionalCompetitionPicked = pickValue<number>([
      { value: detail38.parsed.proportionalCompetitionRate, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.proportionalCompetitionRate, source: 'dart', note: dartDisclosure?.reportName ?? null },
    ]);
    const generalSharesPicked = pickValue<number>([
      { value: detail38.parsed.generalAllocationShares, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.generalAllocationShares, source: 'dart', note: dartDisclosure?.reportName ?? null },
    ]);
    const equalSharesPicked = pickValue<number>([
      { value: detail38.parsed.equalAllocationShares, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.equalAllocationShares, source: 'dart', note: dartDisclosure?.reportName ?? null },
    ]);
    const proportionalSharesPicked = pickValue<number>([
      { value: detail38.parsed.proportionalAllocationShares, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.proportionalAllocationShares, source: 'dart', note: dartDisclosure?.reportName ?? null },
    ]);
    const feeAmountPicked = pickValue<number>([
      { value: detail38.parsed.feeAmount, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.feeAmount, source: 'dart' },
      { value: rule?.defaultFeeAmount, source: 'broker_rules', note: '주간사 기본 수수료 규칙' },
    ]);
    const feesTextPicked = pickValue<string>([
      { value: detail38.parsed.feesText, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.feesText, source: 'dart' },
      { value: rule?.defaultFeeText, source: 'broker_rules', note: '주간사 기본 수수료 규칙' },
    ]);
    const accountRestrictionPicked = pickValue<string>([
      { value: detail38.parsed.accountRestrictionText, source: 'thirtyeight' },
      { value: dartDisclosure?.parsed.accountRestrictionText, source: 'dart' },
      { value: rule?.defaultAccountRestrictionText, source: 'broker_rules' },
    ]);

    const fieldSources: Partial<Record<IpoTrackedField, IpoFieldSource>> = {
      depositRate: depositRatePicked.source,
      minSubscriptionShares: minSharesPicked.source,
      subscriptionUnit: unitPicked.source,
      maxSubscriptionShares: detail38.parsed.brokerDetails[normalizedBrokerName]?.maxSubscriptionShares !== null && detail38.parsed.brokerDetails[normalizedBrokerName]?.maxSubscriptionShares !== undefined ? 'thirtyeight' : 'unknown',
      overallCompetitionRate: overallCompetitionPicked.source,
      equalCompetitionRate: equalCompetitionPicked.source,
      proportionalCompetitionRate: proportionalCompetitionPicked.source,
      generalAllocationShares: generalSharesPicked.source,
      equalAllocationShares: equalSharesPicked.source,
      proportionalAllocationShares: proportionalSharesPicked.source,
      feeAmount: feeAmountPicked.source,
      accountRestrictionText: accountRestrictionPicked.source,
    };

    const notes = Array.from(
      new Set(
        [
          ...detail38.parsed.notes,
          ...(dartDisclosure?.parsed.notes ?? []),
          feeAmountPicked.note,
          accountRestrictionPicked.note,
        ].filter((note): note is string => Boolean(note)),
      ),
    );

    return {
      brokerName: normalizedBrokerName,
      normalizedBrokerName,
      minSubscriptionShares: minSharesPicked.value,
      subscriptionUnit: unitPicked.value,
      maxSubscriptionShares: detail38.parsed.brokerDetails[normalizedBrokerName]?.maxSubscriptionShares ?? null,
      depositRate: depositRatePicked.value,
      equalAllocationAvailable:
        equalSharesPicked.value !== null || equalCompetitionPicked.value !== null ? true : true,
      proportionalAllocationAvailable:
        proportionalSharesPicked.value !== null || proportionalCompetitionPicked.value !== null ? true : true,
      overallCompetitionRate: overallCompetitionPicked.value,
      equalCompetitionRate: equalCompetitionPicked.value,
      proportionalCompetitionRate: proportionalCompetitionPicked.value,
      generalAllocationShares: detail38.parsed.brokerDetails[normalizedBrokerName]?.generalAllocationShares ?? generalSharesPicked.value,
      equalAllocationShares: equalSharesPicked.value,
      proportionalAllocationShares: proportionalSharesPicked.value,
      accountRestrictionText: accountRestrictionPicked.value,
      feesText: feesTextPicked.value,
      feeAmount: feeAmountPicked.value,
      notes,
      fieldSources,
    };
  });

  const blockingFields: string[] = [];
  if (!offeringPricePicked.value) blockingFields.push('공모가');
  if (!brokerOptions.some((option) => option.depositRate)) blockingFields.push('증거금률');
  if (!brokerOptions.some((option) => option.minSubscriptionShares)) blockingFields.push('최소 청약 수량');
  if (!brokerOptions.some((option) => option.subscriptionUnit)) blockingFields.push('청약 단위');

  const preEstimateReady = blockingFields.length === 0;
  const finalEstimateReady =
    preEstimateReady &&
    brokerOptions.some(
      (option) =>
        option.overallCompetitionRate !== null ||
        option.equalCompetitionRate !== null ||
        option.proportionalCompetitionRate !== null,
    );

  const phase = deriveCalcPhase(deal.subscriptionStart, deal.subscriptionEnd, todayStr);
  const warnings: string[] = [];
  if (!DART_API_KEY) {
    warnings.push('DART API 키가 없어 38.co.kr과 기본 규칙으로 자동 계산을 보강합니다.');
  } else if (!dartDisclosure) {
    warnings.push('DART 증권신고서를 찾지 못해 38.co.kr과 기본 규칙으로 계산합니다.');
  }
  if (preEstimateReady && !finalEstimateReady) {
    warnings.push('경쟁률 세부값이 없어 사전 자동 계산 중심으로 제공합니다.');
  }

  const confidence = computeFieldSourceConfidence(brokerOptions, offeringPricePicked.source) as IpoCalcConfidence;
  const status: IpoCalcStatus = finalEstimateReady ? 'final_ready' : preEstimateReady ? 'pre_ready' : 'needs_review';

  const sourceTrace: IpoSourceTraceEntry[] = [
    {
      field: 'offeringPrice',
      source: offeringPricePicked.source,
      brokerName: null,
      note: offeringPricePicked.note ?? null,
    },
    ...brokerOptions.flatMap((broker) =>
      (Object.entries(broker.fieldSources) as Array<[IpoTrackedField, IpoFieldSource]>).map(([field, source]) => ({
        field,
        source,
        brokerName: broker.brokerName,
        note: null,
      })),
    ),
  ];

  return {
    status,
    calcPhase: phase,
    calcReadiness: {
      preEstimateReady,
      finalEstimateReady,
      blockingFields,
      confidence,
      warnings,
    },
    offeringPrice: offeringPricePicked.value,
    offeringPriceSource: resolveOfferingPriceSource(deal).offeringPriceSource,
    brokerOptions,
    recommendation: computeDefaultRecommendation(offeringPricePicked.value, brokerOptions),
    sourceTrace,
    notes: Array.from(
      new Set(
        [
          ...detail38.parsed.notes,
          ...(dartDisclosure ? [`DART ${dartDisclosure.reportName}`] : []),
        ],
      ),
    ),
  };
}

function formatUnderwriterLabel(rawUnderwriter: string, brokers: IpoBrokerOption[]): string {
  const normalized = Array.from(
    new Set(
      brokers
        .map((broker) => broker.brokerName.trim())
        .filter(Boolean),
    ),
  );

  if (normalized.length > 0) {
    return normalized.join(', ');
  }

  const fallback = splitBrokerNames(rawUnderwriter);
  return fallback.join(', ');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function enrichDeal(deal: RawIpoDeal, todayStr: string): Promise<IpoDeal> {
  // Skip expensive detail fetching for deals that closed more than 20 days ago
  // (they are definitively 상장완료 and don't need calculator data)
  const cutoffDate = shiftIsoDate(todayStr, -20);
  if (deal.subscriptionEnd < cutoffDate) {
    const emptyDetail: Detail38Payload = {
      listingDate: null,
      refundDate: null,
      parsed: createEmptyParsedFields('thirtyeight', splitBrokerNames(deal.underwriter)),
    };
    const calculator = buildCalculatorData(deal, emptyDetail, null, todayStr);
    return {
      ...deal,
      underwriter: deal.underwriter,
      refundDate: null,
      listingDate: null,
      detailUrl: detailUrl(deal.id),
      status: '상장완료',
      calculator,
    };
  }

  const [detail38, dartDisclosure] = await Promise.all([fetch38DetailData(deal), fetchDartDisclosure(deal)]);
  const calculator = buildCalculatorData(deal, detail38, dartDisclosure, todayStr);

  return {
    ...deal,
    underwriter: formatUnderwriterLabel(deal.underwriter, calculator.brokerOptions),
    refundDate: detail38.refundDate,
    listingDate: detail38.listingDate,
    detailUrl: detailUrl(deal.id),
    status: deriveStatus(deal.subscriptionStart, deal.subscriptionEnd, detail38.listingDate, todayStr),
    calculator,
  };
}

async function scrapeIpoList(): Promise<IpoDeal[]> {
  const response = await fetch('https://www.38.co.kr/html/fund/index.htm?o=k', {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  const buffer = await response.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buffer);
  const tbodyMatch = html.match(/summary="공모주 청약일정"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);

  if (!tbodyMatch) return [];

  const rows: RawIpoDeal[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

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
    const confirmedPrice = parseInteger(cells[2] ?? '');
    const bandMatch = (cells[3] ?? '').match(/([\d,]+)\s*~\s*([\d,]+)/);
    const priceBandLow = bandMatch ? parseInteger(bandMatch[1]) : null;
    const priceBandHigh = bandMatch ? parseInteger(bandMatch[2]) : null;

    rows.push({
      id,
      name,
      subscriptionStart: `${year}-${startMonth}-${startDay}`,
      subscriptionEnd: `${year}-${endMonth}-${endDay}`,
      priceBandLow,
      priceBandHigh,
      confirmedPrice,
      underwriter: cells[5] ?? '',
      competitionRatio: normalizeWhitespace(cells[4] ?? '') || null,
    });
  }

  const todayStr = today();
  return mapWithConcurrency(rows, 4, (deal) => enrichDeal(deal, todayStr));
}

async function loadFromCacheFile(): Promise<IpoCalendarResponse | null> {
  try {
    const cachePath = path.join(process.cwd(), 'data', 'ipo-cache.json');
    const raw = await readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as IpoCalendarResponse;
    // Recompute status fields based on today's date (cache may be from yesterday)
    const todayStr = today();
    const ipos = parsed.ipos.map((deal) => ({
      ...deal,
      status: deriveStatus(deal.subscriptionStart, deal.subscriptionEnd, deal.listingDate, todayStr),
    }));
    return { ...parsed, ipos };
  } catch {
    return null;
  }
}

async function buildResponse(): Promise<IpoCalendarResponse> {
  // 1. Try static cache file (populated by GitHub Actions)
  const cached = await loadFromCacheFile();
  if (cached) return cached;

  // 2. Fallback: live scrape (works in local dev where 38.co.kr is accessible)
  try {
    const ipos = await scrapeIpoList();
    return { ipos, fetchedAt: new Date().toISOString(), totalCount: ipos.length };
  } catch (error) {
    console.error('[ipo-calendar] scrape failed:', error);
    return { ipos: [], fetchedAt: new Date().toISOString(), totalCount: 0 };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IpoCalendarResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cached = responseCache.get('ipo');
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const promise =
      inflight ??
      buildResponse()
        .then((data) => {
          responseCache.set('ipo', { data, fetchedAt: Date.now() });
          inflight = null;
          return data;
        })
        .catch((error) => {
          inflight = null;
          throw error;
        });

    if (!inflight) inflight = promise;
    const result = await promise;
    return res.status(200).json(result);
  } catch (error) {
    inflight = null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `IPO 데이터 로딩 실패: ${message}` });
  }
}
