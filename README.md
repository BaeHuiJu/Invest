# 글로벌픽

국내외 주식, ETF, 애널리스트 리포트, 컨센서스 변화, 일정형 투자 이벤트를 한 화면에서 탐색할 수 있는 Next.js 기반 투자 리서치 대시보드입니다.

운영 주소: `https://invest-eight-delta.vercel.app`

## 소개

글로벌픽은 단순히 종목을 나열하는 사이트가 아니라, 아래 질문에 답하도록 설계된 프로젝트입니다.

- 지금 어떤 종목이 주목받는가
- 여러 증권사가 왜 같은 종목을 추천하는가
- 지금 진입해도 되는가
- 추천 이후 성과와 변화는 어땠는가

현재 서비스는 프론트엔드 대시보드와 Next.js API를 중심으로 동작하며, 일부 데이터는 로컬 JSON 캐시와 GitHub Actions 스케줄러로 갱신합니다.

## 주요 기능

### 시장 및 종목 탐색

- 국내/해외 주식 및 ETF 목록 조회
- 주요 시장 지수 요약
- 글로벌 검색 모달
- 관심 종목 저장 및 빠른 재진입
- 종목 상세 페이지와 인사이트 팝업

### 애널리스트 리포트 기반 분석

- 최근 애널리스트 추천 리포트 조회
- 공통 추천 종목 컨센서스 집계
- 컨센서스 변화 추적
- 애널리스트 성과 리더보드
- 종목별 인사이트 요약 및 관련 리포트 연결
- 백테스트 탭을 통한 전략별 성과 비교

### 확장 분석 기능

- AI 추천 종목 탭
- Groq 기반 단기 유망주 분석
- 국내 ETF 단기 트레이딩 시나리오
- 밸류에이션 스크리너
- 업종 사이클 분석
- 포트폴리오 요약 및 분산 가이드
- 실적 캘린더
- 공모주 일정 캘린더

### 사용자 경험

- PWA 지원
- 다크모드/라이트모드/시스템/자동 테마
- 용어 사전 모달
- 브라우저 알림 권한 및 알림 설정 UI
- 모바일 대응 UI

## 기술 스택

- Frontend: Next.js 14, React 18, TypeScript
- Styling: Tailwind CSS
- Charts: Recharts
- PWA: `next-pwa`
- Data sources: Yahoo Finance, 네이버 금융, Stock Analysis, 38.co.kr
- LLM integration: Groq API
- Automation: GitHub Actions
- Optional legacy tooling: Python, Streamlit, pandas, yfinance, pykrx

## 프로젝트 구조

```text
Invest/
├─ pages/
│  ├─ index.tsx                     # 메인 대시보드
│  ├─ stocks/[market]/[ticker].tsx  # 종목 상세 페이지
│  ├─ analysts/[broker]/[analyst].tsx
│  └─ api/                          # 데이터 집계 및 분석 API
├─ components/                      # 탭 UI, 모달, 공용 컴포넌트
├─ lib/                             # 포맷/캐시/분석/유틸 함수
├─ data/                            # 리포트 캐시, 컨센서스 변화 데이터
├─ scripts/                         # 캐시 생성 및 유지 스크립트
├─ src/                             # Python 기반 초기 분석/수집 코드
├─ tests/                           # Python 테스트
├─ public/                          # PWA manifest, 아이콘, 서비스 워커 산출물
├─ readme/                          # 기능 메모 및 설계 문서
├─ DEVELOPMENT_PLAN.md              # 전체 개발 계획과 진행 현황
└─ .github/workflows/               # 스케줄러 및 자동 갱신 워크플로
```

## 주요 화면/탭

메인 대시보드는 현재 아래 탭 구성을 갖고 있습니다.

- `home`: 시장 요약 및 관심 종목 미리보기
- `watchlist`: 관심 종목 목록
- `ai-picks`: 규칙 기반 AI 추천
- `groq-picks`: Groq 기반 단기 유망주
- `korea-etf-trading`: 국내 ETF 단기 매매 판단
- `analyst`: 애널리스트 추천 리포트
- `consensus`: 공통 추천 종목
- `consensus-changes`: 컨센서스 변화 추적
- `scorecard`: 애널리스트 성과 리더보드
- `sector-cycle`: 업종 사이클 분석
- `backtest`: 전략별 백테스트
- `portfolio`: 관심 종목 기반 포트폴리오 가이드
- `earnings`: 실적 캘린더
- `screener`: 밸류에이션 스크리너
- `ipo`: 공모주 일정
- `korea-stock`, `korea-etf`, `us-stock`, `us-etf`: 종목/ETF 리스트

## 주요 API

대표 API는 다음과 같습니다.

- `/api/market-indices`: 주요 지수 조회
- `/api/korea-stocks`, `/api/us-stocks`: 종목/ETF 리스트 조회
- `/api/analyst-reports`: 애널리스트 리포트 조회
- `/api/analyst-consensus`: 공통 추천 집계
- `/api/consensus-history`, `/api/consensus-top-movers`, `/api/consensus-latest-changes`: 컨센서스 변화 분석
- `/api/analyst-scorecard`: 증권사/시장/섹터별 성과 요약
- `/api/stock-insight`: 종목 인사이트 요약
- `/api/stock-history`: 가격 히스토리 및 기술지표용 데이터
- `/api/ai-picks`: 규칙 기반 AI 추천
- `/api/groq-daily-picks`: Groq 기반 단기 추천
- `/api/korea-etf-trading`: 국내 ETF 단기 트레이딩 판단
- `/api/valuation-screener`: 밸류에이션 스크리닝
- `/api/sector-cycle`: 업종 사이클 분석
- `/api/backtest`: 전략별 백테스트
- `/api/earnings-calendar`: 실적 이벤트 캘린더
- `/api/ipo-calendar`: 공모주 일정 수집
- `/api/search`: 검색 API

## 설치 방법

### Node.js 앱

권장 버전:

- Node.js 20+
- npm 10+

설치:

```bash
npm install
```

### Python 보조 코드

이 저장소에는 초기 분석/수집용 Python 코드도 포함되어 있습니다. Python 쪽까지 실행하려면 별도 가상환경을 만들고 의존성을 설치하세요.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 실행 방법

개발 서버:

```bash
npm run dev
```

백그라운드 PowerShell 스크립트로 실행:

```bash
npm run dev:bg
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 빌드 방법

프로덕션 빌드:

```bash
npm run build
```

프로덕션 서버 실행:

```bash
npm run start
```

## 데이터 캐시 생성 및 갱신

애널리스트 캐시 생성:

```bash
npm run generate:analyst-cache
```

직접 실행되는 관련 스크립트:

- `scripts/generate-analyst-cache.mjs`
- `scripts/generate-consensus-delta.mjs`

GitHub Actions 워크플로 `.github/workflows/refresh-analyst-cache.yml`은 매일 UTC 00:00에 아래 파일을 갱신합니다.

- `data/analyst-reports-cache.json`
- `data/consensus-deltas.json`

## 환경 변수

기본 대시보드 기능은 별도 환경 변수 없이도 동작할 수 있지만, Groq 연동 기능에는 아래 값이 필요합니다.

```bash
GROQ_API_KEY=your_groq_api_key
```

권장 위치:

- 로컬 개발: `.env.local`
- 배포 환경: Vercel project environment variables

영향 받는 기능:

- Groq 단기 유망주
- 국내 ETF 단기 트레이딩 분석

## 주요 설정

- `next.config.js`
  - `reactStrictMode: true`
  - 개발 환경에서는 `.next-dev`, 운영 빌드에서는 `.next` 사용
  - `next-pwa` 적용, 개발 모드에서는 PWA 비활성화
- `vercel.json`
  - `npm run build` 기반 Next.js 배포
- `tailwind.config.js`
  - 테마 클래스 기반 스타일링

## 사용 방법

일반적인 사용 흐름은 아래와 같습니다.

1. 홈 또는 시장 탭에서 종목군을 확인합니다.
2. 애널리스트/공통추천/컨센서스 변화 탭에서 관심 후보를 좁힙니다.
3. 종목 인사이트 팝업 또는 상세 페이지에서 근거를 확인합니다.
4. AI 추천, Groq 추천, 밸류 스크리너, 업종 사이클을 교차 확인합니다.
5. 관심 종목에 저장한 뒤 포트폴리오 탭과 일정 탭으로 후속 관찰을 이어갑니다.

## 현재 개발 상태

`DEVELOPMENT_PLAN.md` 기준으로 현재 완료된 대표 항목은 다음과 같습니다.

- 애널리스트 성과 리더보드
- Groq AI 단기 유망주
- 컨센서스 변화 추적
- 배당/밸류에이션 스크리너
- 공모주 일정 캘린더
- PWA 변환
- 초보자용 AI 추천/설명 기능
- 다크모드 자동 전환

다음 개발 방향은 크게 아래 축으로 정리되어 있습니다.

- 데이터 & 분석 강화
  - 기술적 지표 오버레이
- 사용자 경험
  - 맞춤형 알림 시스템
  - 캘린더 형식 UI
  - 대시보드 커스터마이징
- 포트폴리오 관리
  - 실시간 추적
  - 리스크 분석
  - 목표 수익률 시뮬레이터
- 기술적 개선
  - 실시간 가격 업데이트
  - 증분 캐시 업데이트
  - 데이터베이스 마이그레이션
  - Public API 제공

## Python 보조 코드

`src/`와 `tests/`에는 Next.js 앱과 별도로, 초기 ETF 추천/수집용 Python 코드가 남아 있습니다.

- `src/ui/app.py`: Streamlit 기반 UI
- `src/data/`: 한국/미국 ETF 및 애널리스트 데이터 수집
- `src/analysis/`: 추천 및 지표 계산
- `tests/test_recommend.py`: Python 분석 로직 테스트

현재 핵심 사용자 경험은 Next.js 앱에 집중되어 있으며, Python 코드는 보조 분석 자산 또는 초기 프로토타입 성격으로 보는 편이 맞습니다.

## 참고 사항

- 이 프로젝트는 투자 판단을 돕는 정보 제공 도구입니다.
- 일부 기능은 외부 웹 페이지 스크래핑 또는 외부 API 응답에 의존합니다.
- 브라우저 알림 설정 UI는 존재하지만, 완전한 알림 전달 시스템은 아직 개발 계획에 포함된 상태입니다.
- 데이터 캐시 파일은 자동 생성되며, 작업 중 충돌이 발생할 수 있으므로 Git 작업 시 주의가 필요합니다.
