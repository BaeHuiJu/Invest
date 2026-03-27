# ETF 추천 프로그램

해외 및 국내 ETF/주식을 분석하고 추천하는 웹 애플리케이션

## 배포 URL

**https://invest-eight-delta.vercel.app**

## 주요 기능

### 1. 시장 현황 대시보드
실시간 주요 지수 현황 표시
- KOSPI / KOSDAQ
- S&P 500 / NASDAQ / Dow Jones

### 2. 국내 주식/ETF
| 기능 | 설명 |
|------|------|
| 실시간 시세 | 네이버 금융 API 연동 |
| 등락률 표시 | 전일 대비 변동률 |
| 거래량 정보 | 일간 거래량 |
| 정렬/필터 | 등락률, 거래량, 현재가 기준 |

**주요 종목**: 삼성전자, SK하이닉스, LG에너지솔루션, 현대차, NAVER 등
**주요 ETF**: KODEX 200, TIGER 200, KODEX 레버리지, KODEX 반도체 등

### 3. 해외 주식/ETF
| 기능 | 설명 |
|------|------|
| 실시간 시세 | Yahoo Finance API 연동 |
| USD 가격 표시 | 달러 기준 현재가 |
| 52주 고가/저가 | 연간 가격 범위 |

**주요 종목**: Apple, Microsoft, Google, Amazon, NVIDIA, Tesla 등
**주요 ETF**: SPY, QQQ, DIA, SOXX, GLD, TLT 등

### 4. 애널리스트 매수 추천
최근 30일/15일/7일/3일 이내 애널리스트가 매수 추천한 종목 확인

| 표시 정보 | 설명 |
|-----------|------|
| 종목명 | 추천된 주식 이름 |
| 추천일 | 리포트 발행일 |
| 증권사 | 리포트 발행 증권사 |
| 목표가 | 제시된 목표 주가 |
| 현재가 | 실시간 현재 주가 |
| 상승여력 | (목표가 - 현재가) / 현재가 × 100% |
| 투자의견 | 매수/적극매수/Strong Buy 등 |

#### 필터링 옵션
- **기간**: 3일 / 7일 / 15일 / 30일
- **시장**: 전체 / 국내 / 해외
- **정렬**: 상승여력순 / 날짜순

#### 요약 통계
- 총 추천 수
- 평균 상승여력
- 국내/해외 종목 수
- 상승여력 TOP 10 차트

## 기술 스택

### Frontend
- **프레임워크**: Next.js 14.2.3
- **언어**: TypeScript
- **UI 라이브러리**: React 18
- **스타일링**: Tailwind CSS
- **차트**: Recharts

### Backend (API Routes)
- **런타임**: Node.js (Vercel Serverless Functions)
- **데이터 수집**: fetch API

### 배포
- **플랫폼**: Vercel
- **CI/CD**: GitHub 연동 자동 배포

## 프로젝트 구조

```
Invest/
├── pages/
│   ├── index.tsx              # 메인 페이지 (홈, 주식, ETF, 애널리스트 탭)
│   ├── _app.tsx               # Next.js App 설정
│   └── api/
│       ├── korea-stocks.ts    # 국내 주식/ETF API
│       ├── korea-stock.ts     # 국내 개별 종목 API
│       ├── us-stocks.ts       # 해외 주식/ETF API
│       ├── us-stock.ts        # 해외 개별 종목 API
│       ├── market-indices.ts  # 시장 지수 API
│       └── analyst-reports.ts # 애널리스트 추천 API
├── styles/
│   └── globals.css            # 전역 스타일
├── lib/
│   └── etfData.ts             # 데이터 유틸리티
├── src/                       # Python 백엔드 (레거시)
│   ├── data/
│   ├── analysis/
│   └── ui/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/market-indices` | GET | 시장 지수 (KOSPI, S&P500 등) |
| `/api/korea-stocks?type=stock` | GET | 국내 주식 목록 |
| `/api/korea-stocks?type=etf` | GET | 국내 ETF 목록 |
| `/api/us-stocks?type=stock` | GET | 해외 주식 목록 |
| `/api/us-stocks?type=etf` | GET | 해외 ETF 목록 |
| `/api/analyst-reports?days=30&market=all` | GET | 애널리스트 추천 |

## 데이터 소스

| 데이터 | 소스 | 방식 |
|--------|------|------|
| 국내 주식/ETF 시세 | 네이버 금융 | REST API |
| 해외 주식/ETF 시세 | Yahoo Finance | REST API |
| 시장 지수 | Yahoo Finance | REST API |
| 애널리스트 추천 | 네이버 금융 + Yahoo Finance | REST API |

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 배포

```bash
# Vercel CLI로 배포
vercel --prod
```

## 개발 이력

### v1.0.0 (2024-03-27)
- 초기 Python/Streamlit 기반 프로젝트 생성
- ETF 데이터 수집 모듈 구현

### v2.0.0 (2024-03-27)
- Next.js + TypeScript로 전환
- Vercel 배포 설정
- Tailwind CSS 스타일링 적용

### v2.1.0 (2024-03-27)
- 실시간 데이터 API 연동
  - 네이버 금융 (국내)
  - Yahoo Finance (해외)
- 시장 지수 대시보드 추가
- 주식/ETF 목록 페이지 구현

### v2.2.0 (2024-03-27)
- 애널리스트 매수 추천 기능 추가
- 기간별 필터 (3/7/15/30일)
- 시장별 필터 (국내/해외)
- 상승여력 TOP 10 차트
- 요약 통계 카드

## 향후 계획

- [ ] 사용자 투자 성향 분석
- [ ] 포트폴리오 최적화 기능
- [ ] 실시간 알림 기능
- [ ] 백테스팅 기능
- [ ] 종목 상세 페이지
- [ ] 차트 기간 선택 (1개월/3개월/1년)
- [ ] 관심 종목 저장 기능

## 라이선스

MIT License

## 주의사항

본 서비스는 투자 참고용 정보를 제공하며, 투자 결정의 책임은 사용자 본인에게 있습니다.
