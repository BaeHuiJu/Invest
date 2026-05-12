export type DashboardTabId =
  | 'home'
  | 'watchlist'
  | 'ai-picks'
  | 'korea-stock'
  | 'korea-etf'
  | 'korea-etf-trading'
  | 'us-stock'
  | 'us-etf'
  | 'analyst'
  | 'consensus'
  | 'consensus-changes'
  | 'scorecard'
  | 'sector-cycle'
  | 'backtest'
  | 'portfolio'
  | 'earnings'
  | 'screener'
  | 'groq-picks'
  | 'ipo'
  | 'calendar'
  | 'risk-analysis';

export type DashboardHomeSectionId =
  | 'market-indices'
  | 'watchlist-preview'
  | 'korea-stocks'
  | 'korea-etfs'
  | 'us-stocks'
  | 'us-etfs';

export type DashboardPresetId = 'default' | 'market-focus' | 'watchlist-focus';
export type DashboardAppliedPresetId = DashboardPresetId | 'custom';

export type DashboardTabDefinition = {
  id: DashboardTabId;
  label: string;
  description: string;
  fixedVisibility?: boolean;
  lockedFirst?: boolean;
  defaultVisible?: boolean;
};

export type DashboardHomeSectionDefinition = {
  id: DashboardHomeSectionId;
  label: string;
  description: string;
  defaultVisible?: boolean;
};

export type DashboardTabConfig = {
  id: DashboardTabId;
  visible: boolean;
  order: number;
};

export type DashboardHomeSectionConfig = {
  id: DashboardHomeSectionId;
  visible: boolean;
  order: number;
};

export type DashboardConfig = {
  version: 1;
  appliedPreset: DashboardAppliedPresetId;
  updatedAt: string;
  tabs: DashboardTabConfig[];
  homeSections: DashboardHomeSectionConfig[];
};

export const DASHBOARD_CONFIG_STORAGE_KEY = 'globalpick.dashboard-config';
const DASHBOARD_CONFIG_VERSION = 1 as const;

export const DASHBOARD_TAB_DEFINITIONS: DashboardTabDefinition[] = [
  { id: 'home', label: '\uD648', description: '\uBA54\uC778 \uB300\uC2DC\uBCF4\uB4DC', fixedVisibility: true, lockedFirst: true },
  { id: 'watchlist', label: '\uAD00\uC2EC', description: '\uC800\uC7A5\uD55C \uAD00\uC2EC \uC885\uBAA9', fixedVisibility: true },
  { id: 'ai-picks', label: 'AI\uCD94\uCC9C', description: 'AI \uCD94\uCC9C \uC885\uBAA9' },
  { id: 'groq-picks', label: 'Groq \uC720\uB9DD\uC8FC', description: 'Groq \uAE30\uBC18 \uCD94\uCC9C' },
  { id: 'korea-etf-trading', label: '\uB2E8\uAE30ETF', description: '\uB2E8\uAE30 ETF \uD2B8\uB808\uC774\uB529' },
  { id: 'analyst', label: '\uC560\uB110\uB9AC\uC2A4\uD2B8', description: '\uCD5C\uC2E0 \uBCF4\uACE0\uC11C' },
  { id: 'consensus', label: '\uACF5\uD1B5\uCD94\uCC9C', description: '\uACF5\uD1B5 \uCD94\uCC9C \uC885\uBAA9' },
  { id: 'consensus-changes', label: '\uCEE8\uC13C\uC11C\uC2A4\uBCC0\uD654', description: '\uCEE8\uC13C\uC11C\uC2A4 \uAC15\uD654/\uC57D\uD654' },
  { id: 'screener', label: '\uBC38\uB958\uC2A4\uD06C\uB9AC\uB108', description: '\uBC38\uB958\uC5D0\uC774\uC158 \uC2A4\uD06C\uB9AC\uB108' },
  { id: 'backtest', label: '\uBC31\uD14C\uC2A4\uD305', description: '\uC804\uB7B5 \uBE44\uAD50' },
  { id: 'portfolio', label: '\uD3EC\uD2B8\uD3F4\uB9AC\uC624', description: '\uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uAC00\uC774\uB4DC' },
  { id: 'sector-cycle', label: '\uC5C5\uC885\uC0AC\uC774\uD074', description: '\uC5C5\uC885 \uC0AC\uC774\uD074 \uBD84\uC11D' },
  { id: 'scorecard', label: '\uC131\uACFC\uBD84\uC11D', description: '\uC560\uB110\uB9AC\uC2A4\uD2B8 \uC131\uACFC' },
  { id: 'korea-stock', label: '\uAD6D\uB0B4\uC8FC\uC2DD', description: '\uAD6D\uB0B4 \uC885\uBAA9 \uBAA9\uB85D' },
  { id: 'korea-etf', label: '\uAD6D\uB0B4ETF', description: '\uAD6D\uB0B4 ETF \uBAA9\uB85D' },
  { id: 'us-stock', label: '\uD574\uC678\uC8FC\uC2DD', description: '\uD574\uC678 \uC885\uBAA9 \uBAA9\uB85D' },
  { id: 'us-etf', label: '\uD574\uC678ETF', description: '\uD574\uC678 ETF \uBAA9\uB85D' },
  { id: 'earnings', label: '\uC2E4\uC801\uCEA8\uB9B0\uB354', description: '\uC2E4\uC801 \uC77C\uC815' },
  { id: 'ipo', label: '\uACF5\uBAA8\uC8FC', description: '\uACF5\uBAA8\uC8FC \uC77C\uC815' },
  { id: 'calendar', label: '\uD22C\uC790\uCE98\uB9B0\uB354', description: '\uACF5\uBAA8\uC8FC\u00B7\uC2E4\uC801 \uD1B5\uD569 \uCE98\uB9B0\uB354' },
  { id: 'risk-analysis', label: '\uB9AC\uC2A4\uD06C\uBD84\uC11D', description: '\uBCA0\uD0C0\u00B7\uBCC0\uB3D9\uC131\u00B7\uC0E4\uD504\u00B7VaR' },
];

export const DASHBOARD_HOME_SECTION_DEFINITIONS: DashboardHomeSectionDefinition[] = [
  { id: 'market-indices', label: '\uC8FC\uC694 \uC2DC\uC7A5 \uC9C0\uC218', description: '\uAD6D\uB0B4\uC678 \uC8FC\uC694 \uC9C0\uC218 \uC694\uC57D' },
  { id: 'watchlist-preview', label: '\uAD00\uC2EC \uC885\uBAA9 \uBBF8\uB9AC\uBCF4\uAE30', description: '\uC800\uC7A5 \uC885\uBAA9 5\uAC1C \uBE60\uB978 \uD655\uC778' },
  { id: 'korea-stocks', label: '\uAD6D\uB0B4 \uC8FC\uC2DD TOP 5', description: '\uAD6D\uB0B4 \uC8FC\uC2DD \uBE60\uB978 \uBAA9\uB85D' },
  { id: 'korea-etfs', label: '\uAD6D\uB0B4 ETF TOP 5', description: '\uAD6D\uB0B4 ETF \uBE60\uB978 \uBAA9\uB85D' },
  { id: 'us-stocks', label: '\uD574\uC678 \uC8FC\uC2DD TOP 5', description: '\uD574\uC678 \uC8FC\uC2DD \uBE60\uB978 \uBAA9\uB85D' },
  { id: 'us-etfs', label: '\uD574\uC678 ETF TOP 5', description: '\uD574\uC678 ETF \uBE60\uB978 \uBAA9\uB85D' },
];

export const DASHBOARD_PRESET_OPTIONS: Array<{
  id: DashboardPresetId;
  label: string;
  description: string;
}> = [
  { id: 'default', label: '\uAE30\uBCF8\uD615', description: '\uD604\uC7AC \uB300\uC2DC\uBCF4\uB4DC\uC640 \uAC00\uC7A5 \uBE44\uC2B7\uD55C \uADE0\uD615\uD615 \uAD6C\uC131\uC785\uB2C8\uB2E4.' },
  { id: 'market-focus', label: '\uC2DC\uC7A5\uC911\uC2EC\uD615', description: '\uC2DC\uC7A5/\uC885\uBAA9/ETF \uD750\uB984\uC744 \uC55E\uCABD\uC5D0 \uBC30\uCE58\uD569\uB2C8\uB2E4.' },
  { id: 'watchlist-focus', label: '\uAD00\uC2EC\uC885\uBAA9\uD615', description: '\uAD00\uC2EC \uC885\uBAA9\uACFC \uCD94\uCC9C \uD0ED\uC744 \uB354 \uBA3C\uC800 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.' },
];

const TAB_PRESET_ORDER: Record<DashboardPresetId, DashboardTabId[]> = {
  'default': [
    'home',
    'watchlist',
    'ai-picks',
    'groq-picks',
    'korea-etf-trading',
    'analyst',
    'consensus',
    'consensus-changes',
    'screener',
    'backtest',
    'portfolio',
    'sector-cycle',
    'scorecard',
    'korea-stock',
    'korea-etf',
    'us-stock',
    'us-etf',
    'earnings',
    'ipo',
  ],
  'market-focus': [
    'home',
    'watchlist',
    'korea-etf-trading',
    'korea-stock',
    'korea-etf',
    'ai-picks',
    'groq-picks',
    'analyst',
    'consensus',
    'sector-cycle',
    'scorecard',
    'screener',
    'portfolio',
    'backtest',
    'consensus-changes',
    'us-stock',
    'us-etf',
    'earnings',
    'ipo',
  ],
  'watchlist-focus': [
    'home',
    'watchlist',
    'ai-picks',
    'groq-picks',
    'portfolio',
    'korea-etf-trading',
    'consensus',
    'analyst',
    'consensus-changes',
    'korea-stock',
    'korea-etf',
    'us-stock',
    'us-etf',
    'sector-cycle',
    'scorecard',
    'screener',
    'backtest',
    'earnings',
    'ipo',
  ],
};

const HOME_PRESET_ORDER: Record<DashboardPresetId, DashboardHomeSectionId[]> = {
  'default': ['market-indices', 'watchlist-preview', 'korea-stocks', 'korea-etfs', 'us-stocks', 'us-etfs'],
  'market-focus': ['market-indices', 'korea-stocks', 'korea-etfs', 'us-stocks', 'us-etfs', 'watchlist-preview'],
  'watchlist-focus': ['watchlist-preview', 'market-indices', 'korea-stocks', 'us-stocks', 'korea-etfs', 'us-etfs'],
};

type OrderedItem<Id extends string> = {
  id: Id;
  visible: boolean;
  order: number;
};

function nowIso() {
  return new Date().toISOString();
}

function sortByOrder<T extends OrderedItem<string>>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function normalizeOrder<T extends OrderedItem<string>>(items: T[]): T[] {
  return sortByOrder(items).map((item, index) => ({ ...item, order: index }));
}

function reorderByIds<Id extends string, T extends OrderedItem<Id>>(
  definitions: Array<{ id: Id }>,
  items: T[],
  orderedIds: Id[],
): T[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const uniqueIds = Array.from(new Set([...orderedIds, ...definitions.map((definition) => definition.id)]));

  return uniqueIds
    .map((id, index) => {
      const item = itemMap.get(id);
      if (!item) return null;
      return { ...item, order: index };
    })
    .filter((item): item is T => item !== null);
}

function enforceHomeFirst(tabs: DashboardTabConfig[]): DashboardTabConfig[] {
  const sorted = sortByOrder(tabs);
  const home = sorted.find((tab) => tab.id === 'home');
  if (!home) return sorted;
  const others = sorted.filter((tab) => tab.id !== 'home');
  return [{ ...home, visible: true, order: 0 }, ...others].map((tab, index) => ({ ...tab, order: index }));
}

function ensureTabConfigIntegrity(tabs: DashboardTabConfig[]): DashboardTabConfig[] {
  const currentMap = new Map(tabs.map((tab) => [tab.id, tab]));

  const merged = DASHBOARD_TAB_DEFINITIONS.map((definition, index) => {
    const current = currentMap.get(definition.id);
    return {
      id: definition.id,
      visible: definition.fixedVisibility ? true : current?.visible ?? definition.defaultVisible ?? true,
      order: current?.order ?? index,
    };
  });

  return enforceHomeFirst(normalizeOrder(merged));
}

function ensureHomeSectionConfigIntegrity(sections: DashboardHomeSectionConfig[]): DashboardHomeSectionConfig[] {
  const currentMap = new Map(sections.map((section) => [section.id, section]));
  const merged = DASHBOARD_HOME_SECTION_DEFINITIONS.map((definition, index) => ({
    id: definition.id,
    visible: currentMap.get(definition.id)?.visible ?? definition.defaultVisible ?? true,
    order: currentMap.get(definition.id)?.order ?? index,
  }));
  return normalizeOrder(merged);
}

export function createDefaultDashboardConfig(): DashboardConfig {
  return {
    version: DASHBOARD_CONFIG_VERSION,
    appliedPreset: 'default',
    updatedAt: nowIso(),
    tabs: ensureTabConfigIntegrity(
      TAB_PRESET_ORDER['default'].map((id, index) => ({
        id,
        visible: true,
        order: index,
      })),
    ),
    homeSections: ensureHomeSectionConfigIntegrity(
      HOME_PRESET_ORDER['default'].map((id, index) => ({
        id,
        visible: true,
        order: index,
      })),
    ),
  };
}

export function ensureDashboardConfig(config: DashboardConfig): DashboardConfig {
  return {
    version: DASHBOARD_CONFIG_VERSION,
    appliedPreset: config.appliedPreset,
    updatedAt: config.updatedAt || nowIso(),
    tabs: ensureTabConfigIntegrity(config.tabs),
    homeSections: ensureHomeSectionConfigIntegrity(config.homeSections),
  };
}

export function readDashboardConfigStorage(): DashboardConfig {
  if (typeof window === 'undefined') return createDefaultDashboardConfig();
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CONFIG_STORAGE_KEY);
    if (!raw) return createDefaultDashboardConfig();
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    if (parsed.version !== DASHBOARD_CONFIG_VERSION || !Array.isArray(parsed.tabs) || !Array.isArray(parsed.homeSections)) {
      return createDefaultDashboardConfig();
    }
    return ensureDashboardConfig({
      version: DASHBOARD_CONFIG_VERSION,
      appliedPreset: parsed.appliedPreset ?? 'custom',
      updatedAt: parsed.updatedAt ?? nowIso(),
      tabs: parsed.tabs as DashboardTabConfig[],
      homeSections: parsed.homeSections as DashboardHomeSectionConfig[],
    });
  } catch {
    return createDefaultDashboardConfig();
  }
}

export function saveDashboardConfigStorage(config: DashboardConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DASHBOARD_CONFIG_STORAGE_KEY, JSON.stringify(ensureDashboardConfig(config)));
}

export function sortDashboardItems<T extends OrderedItem<string>>(items: T[]): T[] {
  return sortByOrder(items);
}

export function moveDashboardItem<Id extends string, T extends OrderedItem<Id>>(
  items: T[],
  activeId: Id,
  overId: Id,
): T[] {
  if (activeId === overId) return normalizeOrder(items);
  const sorted = sortByOrder(items);
  const activeIndex = sorted.findIndex((item) => item.id === activeId);
  const overIndex = sorted.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1) return normalizeOrder(items);

  const next = [...sorted];
  const [moved] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, moved);
  return normalizeOrder(next);
}

export function updateDashboardConfig(
  config: DashboardConfig,
  patch: Partial<Pick<DashboardConfig, 'tabs' | 'homeSections' | 'appliedPreset'>>,
): DashboardConfig {
  return ensureDashboardConfig({
    ...config,
    ...patch,
    appliedPreset: patch.appliedPreset ?? 'custom',
    updatedAt: nowIso(),
  });
}

export function setDashboardTabVisibility(
  tabs: DashboardTabConfig[],
  id: DashboardTabId,
  visible: boolean,
): DashboardTabConfig[] {
  const definition = DASHBOARD_TAB_DEFINITIONS.find((item) => item.id === id);
  if (definition?.fixedVisibility) return ensureTabConfigIntegrity(tabs);
  return ensureTabConfigIntegrity(
    tabs.map((tab) => (tab.id === id ? { ...tab, visible } : tab)),
  );
}

export function setDashboardHomeSectionVisibility(
  sections: DashboardHomeSectionConfig[],
  id: DashboardHomeSectionId,
  visible: boolean,
): DashboardHomeSectionConfig[] {
  return ensureHomeSectionConfigIntegrity(
    sections.map((section) => (section.id === id ? { ...section, visible } : section)),
  );
}

export function applyDashboardPreset(config: DashboardConfig, presetId: DashboardPresetId): DashboardConfig {
  const tabs = reorderByIds(DASHBOARD_TAB_DEFINITIONS, ensureTabConfigIntegrity(config.tabs), TAB_PRESET_ORDER[presetId])
    .map((tab) => ({ ...tab, visible: true }));
  const homeSections = reorderByIds(
    DASHBOARD_HOME_SECTION_DEFINITIONS,
    ensureHomeSectionConfigIntegrity(config.homeSections),
    HOME_PRESET_ORDER[presetId],
  ).map((section) => ({ ...section, visible: true }));

  return ensureDashboardConfig({
    version: DASHBOARD_CONFIG_VERSION,
    appliedPreset: presetId,
    updatedAt: nowIso(),
    tabs,
    homeSections,
  });
}
