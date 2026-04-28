export const WATCHLIST_STORAGE_KEY = 'globalpick.watchlist';

export function readWatchlistStorage<T>(): T[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveWatchlistStorage<T>(watchlist: T[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
}
