export interface IpoBrokerRule {
  normalizedName: string;
  aliases: string[];
  defaultFeeAmount: number | null;
  defaultFeeText: string | null;
  defaultAccountRestrictionText: string | null;
}

export const DEFAULT_IPO_FALLBACKS = {
  depositRate: 0.5,
  minSubscriptionShares: 10,
  subscriptionUnit: 10,
} as const;

const BROKER_RULES: IpoBrokerRule[] = [
  { normalizedName: 'NH투자증권', aliases: ['NH', '엔에이치투자증권'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: 'KB증권', aliases: ['KB'], defaultFeeAmount: 1500, defaultFeeText: '온라인 청약 수수료 1,500원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '한국투자증권', aliases: ['한투', '한국투자'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '미래에셋증권', aliases: ['미래에셋'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '신한투자증권', aliases: ['신한', '신한금융투자'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '하나증권', aliases: ['하나금융투자'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '삼성증권', aliases: ['삼성'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '키움증권', aliases: ['키움'], defaultFeeAmount: 0, defaultFeeText: '온라인 청약 수수료 면제 또는 이벤트 여부 확인 필요', defaultAccountRestrictionText: null },
  { normalizedName: '대신증권', aliases: ['대신'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '유안타증권', aliases: ['유안타'], defaultFeeAmount: 3000, defaultFeeText: '온라인 청약 수수료 3,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '유진투자증권', aliases: ['유진'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: 'IBK투자증권', aliases: ['IBK'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '한화투자증권', aliases: ['한화'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '현대차증권', aliases: ['현대차'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: 'SK증권', aliases: ['SK'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '신영증권', aliases: ['신영'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: 'LS증권', aliases: ['이베스트투자증권', '이베스트', 'LS'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '교보증권', aliases: ['교보'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: 'DB증권', aliases: ['DB금융투자', '동부증권', 'DB'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '메리츠증권', aliases: ['메리츠'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '우리투자증권', aliases: ['우리'], defaultFeeAmount: 2000, defaultFeeText: '온라인 청약 수수료 2,000원 기준', defaultAccountRestrictionText: null },
  { normalizedName: '카카오페이증권', aliases: ['카카오페이증권'], defaultFeeAmount: 0, defaultFeeText: '모바일 전용 수수료 정책 확인 필요', defaultAccountRestrictionText: null },
];

function cleanupBrokerName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, '')
    .replace(/대표주관|공동주관|주간사|주관회사|인수회사/g, '')
    .trim();
}

export function normalizeBrokerName(name: string): string {
  const cleaned = cleanupBrokerName(name);
  const matchedRule = BROKER_RULES.find((rule) =>
    [rule.normalizedName, ...rule.aliases].some((alias) => cleanupBrokerName(alias) === cleaned),
  );

  return matchedRule?.normalizedName ?? (cleaned || name.trim());
}

export function isKnownBrokerName(name: string): boolean {
  const cleaned = cleanupBrokerName(name);
  return BROKER_RULES.some((rule) =>
    [rule.normalizedName, ...rule.aliases].some((alias) => cleanupBrokerName(alias) === cleaned),
  );
}

export function extractKnownBrokerNames(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, ' ');
  const matched = BROKER_RULES.filter((rule) =>
    [rule.normalizedName, ...rule.aliases].some((alias) => cleaned.includes(alias)),
  ).map((rule) => rule.normalizedName);

  return Array.from(new Set(matched));
}

export function getBrokerRule(name: string): IpoBrokerRule | null {
  const normalized = normalizeBrokerName(name);
  return BROKER_RULES.find((rule) => rule.normalizedName === normalized) ?? null;
}
