/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 의미 기반 토큰 — CSS 변수 참조
        // 사용법: bg-c-surface, text-c-positive, border-c-border 등
        c: {
          bg:            'var(--c-bg)',
          surface:       'var(--c-surface)',
          'surface-2':   'var(--c-surface-2)',
          border:        'var(--c-border)',
          text:          'var(--c-text)',
          'text-2':      'var(--c-text-2)',
          'text-3':      'var(--c-text-3)',
          accent:        'var(--c-accent)',
          'accent-bg':   'var(--c-accent-bg)',
          positive:      'var(--c-positive)',
          'positive-bg': 'var(--c-positive-bg)',
          negative:      'var(--c-negative)',
          'negative-bg': 'var(--c-negative-bg)',
          warning:       'var(--c-warning)',
          'warning-bg':  'var(--c-warning-bg)',
          neutral:       'var(--c-neutral)',
          'neutral-bg':  'var(--c-neutral-bg)',
          info:          'var(--c-info)',
          'info-bg':     'var(--c-info-bg)',
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    },
  ],
}
