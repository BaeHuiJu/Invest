# 글로벌픽

국내외 주식, ETF, 애널리스트 추천 데이터를 한 화면에서 비교하는 Next.js 기반 대시보드입니다.

운영 주소: `https://invest-eight-delta.vercel.app`

## 현재 기능

### 시장 대시보드
- 주요 지수 표시
  - 국내: KOSPI, KOSDAQ
  - 해외: S&P 500, NASDAQ, Dow Jones
- 홈 화면에서 국내/해외 주식, ETF 상위 종목 요약 제공

### 국내/해외 주식 및 ETF 목록
- 국내 주식/ETF 데이터 조회
- 해외 주식/ETF 데이터 조회
- 종목명 또는 티커 검색
- 등락률, 거래량, 현재가 기준 정렬
- 모바일 카드형 목록 지원

### 애널리스트 추천
- 최근 `3일 / 7일 / 15일 / 30일` 기준 추천 리포트 조회
- `전체 / 국내 / 해외` 시장 필터
- `날짜순 / 상승여력순` 정렬
- 증권사 필터
- 투자의견 필터
- 페이지네이션
- 기준가격 표시
  - 증권사 공시일 기준 종가
- 상승여력 TOP 10 차트
- 모바일 최적화 카드 UI

### 종목 인사이트 팝업
- 종목 클릭 시 팝업 표시
- 왜 사야 하는지에 대한 요약 의견 제공
- 핵심 근거 bullet 표시
- 목표가, 기준가격, 현재가, 평균 상승여력 표시
- 관련 리포트 요약 제공

### 성능 개선
- 메뉴 전환 시 클라이언트 캐시 사용
- 애널리스트 추천 데이터 사전 생성 캐시 사용
- 동일 조건 중복 요청 dedupe
- 개발/배포 환경에서 빠른 재진입 응답

## 기술 스택

- Frontend: Next.js 14, React 18, TypeScript
- Styling: Tailwind CSS
- Chart: Recharts
- Runtime: Node.js
- Deploy: Vercel
- Scheduler: GitHub Actions

## 프로젝트 구조

```text
Invest/
├─ pages/
│  ├─ index.tsx
│  ├─ _app.tsx
│  └─ api/
│     ├─ analyst-reports.ts
│     ├─ korea-stock.ts
│     ├─ korea-stocks.ts
│     ├─ market-indices.ts
│     ├─ stock-insight.ts
│     ├─ us-stock.ts
│     └─ us-stocks.ts
├─ lib/
│  ├─ analyst-report-source.mjs
│  └─ analyst-types.ts
├─ data/
│  └─ analyst-reports-cache.json
├─ scripts/
│  └─ generate-analyst-cache.mjs
├─ styles/
│  └─ globals.css
└─ .github/
   └─ workflows/
      └─ refresh-analyst-cache.yml
```

## API

### `GET /api/market-indices`
- 주요 시장 지수 반환

### `GET /api/korea-stocks?type=stock|etf`
- 국내 주식 또는 ETF 목록 반환

### `GET /api/us-stocks?type=stock|etf`
- 해외 주식 또는 ETF 목록 반환

### `GET /api/analyst-reports?days={number}&market={all|korea|us}`
- 애널리스트 추천 리포트 목록 반환

### `GET /api/stock-insight?ticker=...&market=...`
- 종목 클릭 팝업용 인사이트 반환

## 데이터 소스

- 네이버 금융
- Yahoo Finance
- Stock Analysis

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 빌드

```bash
npm run build
npm start
```

## 애널리스트 캐시 생성

```bash
npm run generate:analyst-cache
```

- 생성 결과는 `data/analyst-reports-cache.json`
- GitHub Actions가 주기적으로 캐시를 갱신

## 배포

```bash
vercel --prod
```

## 아직 구현하지 않은 항목

- 사용자 성향 분석
- 포트폴리오 최적화 기능
- 실시간 알림 기능
- 백테스팅 기능
- 별도 종목 상세 페이지
- 차트 기간 선택 기능
- 관심 종목 저장 기능

## 주의

이 서비스는 투자 참고용 정보 제공 목적이며, 최종 투자 판단과 책임은 사용자 본인에게 있습니다.
