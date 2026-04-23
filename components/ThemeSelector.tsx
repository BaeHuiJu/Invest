import { useDarkMode, DARK_MODE_ICONS, DARK_MODE_LABELS } from '@/lib/useDarkMode';
import type { DarkModePreference } from '@/lib/useDarkMode';

const OPTIONS: DarkModePreference[] = ['system', 'light', 'dark'];

export function ThemeSelector() {
  const { preference, setPreference } = useDarkMode();

  return (
    <select
      value={preference}
      onChange={(e) => setPreference(e.target.value as DarkModePreference)}
      className="cursor-pointer rounded-lg border border-c-border bg-c-surface
                 text-c-text-2 px-2.5 py-2 text-sm
                 hover:bg-c-surface-2 focus:outline-none focus:ring-2 focus:ring-c-accent
                 transition-colors"
      aria-label="테마 선택"
    >
      {OPTIONS.map((opt) => (
        <option key={opt} value={opt}>
          {DARK_MODE_ICONS[opt]} {DARK_MODE_LABELS[opt]}
        </option>
      ))}
    </select>
  );
}
