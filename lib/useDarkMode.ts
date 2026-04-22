import { useCallback, useEffect, useState } from 'react';

export type DarkModePreference = 'system' | 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'globalpick.darkMode';
const PREFERENCE_ORDER: DarkModePreference[] = ['system', 'light', 'dark', 'auto'];

function getAutoIsDark(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(pref: DarkModePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (pref === 'auto') return getAutoIsDark();
  return getSystemIsDark(); // 'system'
}

function readStoredPreference(): DarkModePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as DarkModePreference | null;
  return PREFERENCE_ORDER.includes(stored as DarkModePreference) ? (stored as DarkModePreference) : 'system';
}

export function useDarkMode() {
  const [preference, setPreference] = useState<DarkModePreference>(readStoredPreference);
  const [isDark, setIsDark] = useState(() => resolveIsDark(readStoredPreference()));

  useEffect(() => {
    const update = () => {
      const dark = resolveIsDark(preference);
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    };

    update();
    localStorage.setItem(STORAGE_KEY, preference);

    // Listen to OS preference changes when in system mode
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqlChange = () => { if (preference === 'system') update(); };
    mql.addEventListener('change', onMqlChange);

    // Poll every minute for time-based mode
    const timer = preference === 'auto' ? setInterval(update, 60_000) : null;

    return () => {
      mql.removeEventListener('change', onMqlChange);
      if (timer !== null) clearInterval(timer);
    };
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((prev) => {
      const idx = PREFERENCE_ORDER.indexOf(prev);
      return PREFERENCE_ORDER[(idx + 1) % PREFERENCE_ORDER.length];
    });
  }, []);

  return { preference, isDark, cycle };
}

export const DARK_MODE_LABELS: Record<DarkModePreference, string> = {
  system: '시스템',
  light: '라이트',
  dark: '다크',
  auto: '자동(시간)',
};

export const DARK_MODE_ICONS: Record<DarkModePreference, string> = {
  system: '💻',
  light: '☀️',
  dark: '🌙',
  auto: '🕐',
};
