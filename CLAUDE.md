# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

글로벌픽 is a Next.js-based financial dashboard that aggregates stock and analyst recommendation data from Korean and US markets. It provides a unified interface for comparing stocks, ETFs, and analyst insights.

**Live URL:** https://invest-eight-delta.vercel.app

## Tech Stack

- **Framework:** Next.js 14 (Pages Router)
- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Charts:** Recharts
- **Deployment:** Vercel
- **Data Sources:** Naver Finance (Korea), Yahoo Finance (US), Stock Analysis

## Development Commands

### Running Development Server

```bash
npm run dev              # Start development server on localhost:3000
npm run dev:bg           # Start dev server in background (PowerShell)
```

### Building and Production

```bash
npm run build            # Build production bundle
npm start                # Start production server
npm run lint             # Run ESLint
```

### Cache Management

```bash
npm run generate:analyst-cache   # Generate analyst reports cache file
```

This creates/updates `data/analyst-reports-cache.json` with analyst reports and performance data. The GitHub Actions workflow refreshes this cache every 30 minutes automatically.

## Architecture

### Data Flow

1. **Static Cache Generation** (`scripts/generate-analyst-cache.mjs`)
   - Scrapes analyst reports from Naver Finance and Stock Analysis
   - Fetches historical prices for performance tracking
   - Generates `data/analyst-reports-cache.json` with full report data and stock insights
   - Runs on GitHub Actions every 30 minutes

2. **API Layer** (`pages/api/`)
   - Loads cached data from JSON file (bundled in production, file-based in dev)
   - Enriches with live prices on request
   - Provides filtered/sorted data to frontend
   - In-memory TTL cache (60s) prevents redundant file reads
   - Development mode: auto-refreshes cache every 5 minutes

3. **Frontend** (`pages/` and `components/`)
   - Single-page tabbed interface
   - Client-side caching prevents redundant API calls on tab switches
   - Global search across all tabs

### Cache Architecture

**Three-layer caching strategy:**

1. **Static Cache** (`data/analyst-reports-cache.json`)
   - Pre-generated analyst reports with historical performance
   - Bundled with build, refreshed by GitHub Actions
   - Contains 365 days of data

2. **In-Memory Cache** (API routes)
   - File cache TTL: 60 seconds
   - Live price TTL: 2 minutes
   - Deduplicates concurrent requests with inflight tracking
   - Development: auto-refresh every 5 minutes

3. **Client Cache** (Frontend)
   - Per-tab state preservation
   - Prevents re-fetching on tab navigation
   - Toast notifications with local state

### Data Scraping Strategy

**Korea (Naver Finance):**
- HTML scraping from `finance.naver.com/research/company_list.naver`
- EUC-KR encoding handling with TextDecoder
- Historical prices from `finance.naver.com/item/sise_day.naver`
- Current prices from mobile API `m.stock.naver.com/api/stock/{ticker}/basic`

**US (Stock Analysis):**
- HTML scraping from `stockanalysis.com/stocks/{ticker}/ratings/`
- Extracts embedded JSON data from page source
- Historical/current prices from Yahoo Finance Chart API

**Performance Tracking:**
- Fetches historical close prices at 1-week, 1-month, 3-month intervals
- Calculates return % and target progress %
- Success threshold: ≥70% target progress

### Key Files

**Data Source Logic:**
- `lib/analyst-report-source.mjs` - Core scraping, price fetching, performance calculation
- `lib/analyst-types.ts` - TypeScript types for reports, insights, performance

**API Routes:**
- `pages/api/analyst-reports.ts` - Main reports endpoint with caching logic
- `pages/api/stock-insight.ts` - Stock detail popup data
- `pages/api/analyst-scorecard.ts` - Analyst performance metrics
- `pages/api/analyst-consensus.ts` - Consensus entry scores
- `pages/api/sector-cycle.ts` - Sector cycle analysis
- `pages/api/search.ts` - Global search across markets

**Frontend:**
- `pages/index.tsx` - Main dashboard (large file, ~1500 lines, tab-based UI)
- `components/GlobalSearch.tsx` - Search component with fuzzy matching
- `components/BacktestTab.tsx` - Backtesting interface
- `components/PortfolioTab.tsx` - Portfolio analysis
- `components/EarningsCalendarTab.tsx` - Earnings calendar

## Important Patterns

### Price Handling

**Base Price vs Current Price:**
- `basePrice` - Close price on report publication date (used for target gap calculation)
- `currentPrice` - Latest price (used for upside calculation)
- `targetPrice` - Analyst's target price
- `upside` - Percentage from current price to target
- Base gap - Percentage from base price to target (shown as reference)

### Report Filtering

- Only "Buy" opinions are included (매수, Trading Buy, Buy, etc.)
- Deduplicated by ticker + broker (latest report wins)
- Filtered by date range (3/7/15/30/90/180/365 days)
- Market filter: all, korea, us

### Insight Generation

Stock insights (`buildStockInsight`) aggregate multiple reports per ticker:
- Investment logic extraction from report text
- Estimate revision signal detection (up/down/flat/mixed/unknown)
- Valuation analysis with price metrics
- Sector cycle keywords and sentiment

## File Size Considerations

**Large files that require careful editing:**
- `pages/index.tsx` (~1500 lines) - Main dashboard with 8 tabs
- `lib/analyst-report-source.mjs` (~900 lines) - Core data fetching logic

When editing these files, prefer targeted edits over full rewrites. Use line offsets for reading specific sections.

## External API Rate Limits

- Naver Finance: No explicit rate limit, but be respectful (used by cache generation)
- Yahoo Finance: Public API, no auth required
- Stock Analysis: HTML scraping, avoid excessive requests

## Testing Considerations

No test suite currently exists. When adding tests:
- Mock external fetch calls to Naver/Yahoo/Stock Analysis
- Test cache TTL and deduplication logic
- Test price calculation edge cases (missing data, weekends, holidays)
- Test performance point calculations

## Common Tasks

### Adding a New Data Source

1. Add fetch function to `lib/analyst-report-source.mjs`
2. Map to `AnalystReport` interface
3. Include in `buildAnalystReports()` Promise.all
4. Update cache generation script if needed

### Adding a New Tab

1. Create component in `components/{TabName}Tab.tsx`
2. Add tab state to `pages/index.tsx`
3. Add API route if needed in `pages/api/`
4. Update global search if tab content should be searchable

### Modifying Cache Schema

1. Update types in `lib/analyst-types.ts`
2. Modify cache builder in `lib/analyst-report-source.mjs`
3. Update API routes that consume cache
4. Regenerate cache: `npm run generate:analyst-cache`
5. Test in dev mode (auto-refresh will trigger)

## Path Aliases

TypeScript paths configured in `tsconfig.json`:
- `@/*` maps to project root

## Deployment

Vercel auto-deploys from `master` branch. No special build configuration needed beyond `npm run build`.

The GitHub Actions workflow ensures the analyst cache is always fresh (30-minute refresh cycle).

## Known Limitations

- No real-time price updates (2-minute TTL in dev, static in production between cache refreshes)
- Historical prices may be unavailable for recently listed stocks
- Performance tracking requires historical data (pending until date is reached)
- Scraping-based approach is fragile to upstream HTML changes
