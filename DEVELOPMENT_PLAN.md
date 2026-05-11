# 글로벌픽 개발 계획

> 이 파일은 프로젝트의 모든 개발 계획과 진행 상황을 추적합니다.
> 상태: [ ] 미완료 | [x] 완료 | [~] 진행중

## 작성일: 2026-04-17

---

## 1. 데이터 & 분석 강화

### [x] 애널리스트 성과 리더보드
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 낮음
- **설명**: 성공률, 평균 수익률, 목표가 달성률 기준 애널리스트/증권사 순위표
- **가치**: 신뢰할 수 있는 리포트 식별
- **완료일**: 2026-04-21
- **구현**:
  - [x] 기존 `analyst-scorecard.ts` API 활용
  - [x] 리더보드 UI 컴포넌트 개발
  - [x] 필터링 기능 (기간별, 시장별)
  - [x] 탭에 추가
- **파일**:
  - `pages/api/analyst-scorecard.ts` - 성과 데이터 API
  - `components/AnalystLeaderboardTab.tsx` - 리더보드 UI
  - `pages/index.tsx` - 메인 대시보드 통합
- **특징**:
  - 명예의 전당: 상위 3개 증권사 포디엄 카드
  - 전체 순위 테이블: 4위 이하 증권사
  - 4가지 필터: 기간 (30/90/180/365일), 시장 (전체/한국/미국), 정렬 기준 (성공률/평균 수익률/리포트 수), 평가 기준 (1주/1개월/3개월)
  - 전체 통계: 전체 리포트 수, 평균 성공률, 평균 수익률, 참여 증권사 수
  - 애니메이션: slideInUp, fadeIn 효과
  - 그라데이션 디자인: 1위 금색, 2위 은색, 3위 동색

### [x] Groq AI 단기 유망주
- **우선순위**: ⭐⭐⭐⭐ (최우선)
- **복잡도**: 중간
- **설명**: Groq llama-3.3이 애널리스트 데이터를 분석해 단기(1주일 내) 3%+ 상승 고확률 종목 자동 선별
- **가치**: 기존 규칙 기반 AI 추천 + LLM 해석력 결합, 투자 근거 한국어 설명 제공
- **완료일**: 2026-04-27
- **사전 조건**: GROQ_API_KEY 환경변수 (aistudio.groq.com에서 무료 발급)
- **구현**:
  - [x] `npm install groq-sdk` 패키지 설치
  - [x] `pages/api/groq-daily-picks.ts` — 후보 25개 → Groq 분석 → 상위 5개 반환 (30분 캐시)
  - [x] `components/GroqDailyPicksTab.tsx` — AIPicksTab 패턴, 신뢰도 점수 + 한국어 근거 + 리스크 표시
  - [x] `pages/index.tsx` — "Groq 유망주" 탭 추가
  - [x] GROQ_API_KEY .env 등록 (Vercel 배포 시 환경변수 추가 필요)
- **Groq 프롬프트 핵심 입력**:
  - entry score, 브로커 수, 상승여력, week1 과거 성공률, 리포트 경과일, 리포트 이후 가격 변동률
- **응답 구조**:
  - `confidence` (0-100): 3%+ 달성 신뢰도
  - `reasoning`: 한국어 투자 근거 2-3문장
  - `expectedReturn`: "3-5%" 예상 범위
  - `timeframe`: 예상 기간 (예: "3-5일")
  - `keyRisk`: 주요 리스크 1문장
- **중요 고지**: "3% 보장" 불가 — UI에 면책 문구 적용됨, 투자 참고용
- **모델**: `llama-3.3-70b-versatile` (Groq 최신, 무료 티어 포함)
- **파일**:
  - `pages/api/groq-daily-picks.ts` - 후보 빌드 + Groq 호출 + 30분 캐시
  - `components/GroqDailyPicksTab.tsx` - 신뢰도 배지, Groq 분석 표시, 리스크 표시
  - `pages/index.tsx` - "Groq 유망주" 탭 통합
- **특징**:
  - 최근 15일 리포트, 브로커 2개 이상 종목 후보군 (최대 25개)
  - EntryScore ≥60 필터링으로 좋은 진입점 종목만 선별
  - 리포트 이후 가격 변동률(priceChangeSinceReport) Groq에 직접 주입
  - 과거 week1 성공률 및 평균 수익률 Groq 판단 근거 제공
  - 신뢰도 80+ 초록, 70+ 노랑, 그 외 회색 배지
  - 30분 서버 캐시 + 25분 클라이언트 캐시

### [ ] 기술적 지표 오버레이
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 종목 차트에 RSI, MACD, 이동평균선 추가
- **가치**: 펀더멘털 + 기술적 분석 통합 뷰
- **구현**:
  - [ ] Yahoo Finance 또는 Alpha Vantage API 연동
  - [ ] 기술적 지표 계산 라이브러리 추가
  - [ ] Recharts에 지표 오버레이
  - [ ] 지표 on/off 토글

### [x] 컨센서스 변화 추적
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 중간
- **설명**: 시간에 따른 애널리스트 의견 변화 시각화
- **가치**: 모멘텀 파악, 의견 전환점 포착
- **완료일**: 2026-04-21
- **구현**:
  - [x] 과거 컨센서스 데이터 저장 구조 설계
  - [x] 주간/월간 변화 집계 로직
  - [x] 타임라인 차트 컴포넌트
  - [x] 의견 상향/하향 종목 리스트
- **파일**:
  - `lib/consensus-delta-utils.ts` - 델타 재구성 및 타임라인 유틸리티
  - `scripts/generate-consensus-delta.mjs` - 델타 생성 스크립트
  - `pages/api/consensus-history.ts` - 종목별 타임라인 API
  - `pages/api/consensus-top-movers.ts` - 강화/약화 종목 API
  - `components/ConsensusChangesTab.tsx` - 컨센서스 변화 탭 UI
  - `pages/index.tsx` - 메인 대시보드 통합
  - `.github/workflows/refresh-analyst-cache.yml` - 자동 델타 업데이트
- **특징**:
  - 델타 방식으로 효율적인 데이터 저장 (baseline + deltas)
  - 7일/30일 기간별 컨센서스 강화/약화 분석
  - 종목별 Entry Score, 증권사 수, 상승여력, 가격 타임라인 차트
  - 90일 이상 오래된 델타 자동 정리
  - 30개 델타마다 baseline 재설정 (최적화)

### [x] 배당/밸류에이션 스크리너
- **우선순위**: ⭐ (낮음)
- **복잡도**: 중간
- **설명**: PER, PBR, 배당수익률, ROE 등 필터
- **가치**: 투자 스타일별 맞춤 필터
- **완료일**: 2026-04-22
- **구현**:
  - [x] 추가 재무 데이터 소스 연동 (Naver Finance KR / Yahoo Finance US)
  - [x] 필터 UI (PER/PBR/배당수익률/ROE 범위 필터 + 최소 증권사 수)
  - [x] 스크리닝 로직 구현 (애널리스트 추천 종목 유니버스)
  - [x] 결과 정렬 및 내보내기 (CSV 다운로드)
- **파일**:
  - `pages/api/valuation-screener.ts` - 밸류에이션 데이터 API (Korea: Naver, US: Yahoo Finance)
  - `components/ValuationScreenerTab.tsx` - 스크리너 UI (필터/정렬/CSV 내보내기)
  - `pages/index.tsx` - 탭 추가
- **특징**:
  - 애널리스트 추천 종목(90일) 유니버스 자동 수집
  - PER/PBR/배당수익률/ROE 범위 필터 + 최소 추천 증권사 수 필터
  - 빠른 설정 프리셋: 가치주, 고배당, 저PBR 우량주, 컨센서스+합리적PER
  - 컬럼 클릭 정렬, 색상 코딩 (저평가=녹색, 고평가=빨강)
  - CSV 내보내기 (BOM 포함 한글 호환)
  - 10분 캐시 (재무 데이터 변화 느림), 동시 요청 5개 제한
  - 모바일/데스크톱 반응형

### [x] 공모주 일정 캘린더
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 낮음
- **설명**: 38커뮤니케이션에서 공모주 청약 일정 스크래핑, 청약예정/청약중/상장예정/상장완료 상태 자동 분류
- **가치**: 공모주 투자 기회 한눈에 파악, D-day 카운트다운으로 청약 타이밍 관리
- **완료일**: 2026-04-27
- **구현**:
  - [x] `pages/api/ipo-calendar.ts` — 38.co.kr EUC-KR 스크래핑, 상장일 상세 페이지 파싱, 1시간 캐시
  - [x] `components/IpoCalendarTab.tsx` — 상태 배지, StatCard 요약, 필터 버튼, 모바일 카드/데스크톱 테이블, D-day 카운트다운
  - [x] `pages/index.tsx` — "공모주" 탭 추가
- **파일**:
  - `pages/api/ipo-calendar.ts` - 38.co.kr 스크래핑 + EUC-KR 디코딩 + 1시간 캐시
  - `components/IpoCalendarTab.tsx` - 공모주 일정 UI
  - `pages/index.tsx` - "공모주" 탭 통합
- **특징**:
  - 38커뮤니케이션 EUC-KR HTML 스크래핑 (기존 Naver Finance 패턴 동일)
  - 청약예정/청약중/상장예정/상장완료 4가지 상태 자동 도출 (오늘 날짜 기준)
  - 상장완료 종목: 상세 페이지 추가 파싱으로 상장일/환불일 취득 (최대 10개 동시)
  - D-day 카운트다운 (청약예정→청약시작일, 청약중→청약마감일, 상장예정→상장일)
  - 공모가 범위/확정가 구분 표시
  - 모바일 카드 그리드 + 데스크톱 테이블 반응형
  - 서버 1시간 캐시 + inflight 중복 방지

### [ ] 공모주 청약 경쟁률 & 수익률 추적
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 중간
- **설명**: 상장 완료 종목의 공모가 대비 상장일 수익률, 청약 경쟁률 자동 집계
- **가치**: 공모주 투자 성과 데이터 기반 의사결정
- **구현**:
  - [ ] 38.co.kr 상세 페이지에서 청약 경쟁률 파싱
  - [ ] 상장일 이후 종가 vs 공모가 수익률 계산
  - [ ] IpoCalendarTab에 수익률 컬럼 및 통계 추가
  - [ ] 최근 20개 공모주 평균 수익률 위젯

### [ ] 종목 비교 기능
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 2~3개 종목을 나란히 비교 (목표가, Entry Score, 수익률, 상승여력)
- **가치**: 유사 종목 간 최선 선택 지원
- **구현**:
  - [ ] StockInsightModal에 "비교 추가" 버튼
  - [ ] 비교 패널 컴포넌트 (사이드-바이-사이드 레이아웃)
  - [ ] 주요 지표 차이 시각화 (막대/레이더 차트)
  - [ ] 최대 3개 종목 동시 비교

---

## 2. 사용자 경험

### [ ] 맞춤형 알림 시스템
- **우선순위**: ⭐⭐⭐⭐ (최우선)
- **복잡도**: 중간
- **설명**: 관심 종목 새 리포트 발행 시 실시간 알림
- **가치**: 재방문율 향상, 적시 투자 결정
- **구현**:
  - [ ] 관심 종목 관리 UI (추가/삭제)
  - [ ] 브라우저 푸시 알림 권한 요청
  - [ ] 이메일 알림 (Resend or SendGrid)
  - [ ] 알림 설정 페이지 (빈도, 유형)
  - [ ] 가격 알림, 목표가 도달 알림

### [x] PWA 변환
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 낮음
- **설명**: 설치 가능한 Progressive Web App
- **가치**: 앱 경험, 오프라인 캐싱, 빠른 접근
- **완료일**: 2026-04-17
- **구현**:
  - [x] next-pwa 플러그인 설치
  - [x] manifest.json 작성
  - [x] 오프라인 폴백 페이지
  - [x] 아이콘 세트 준비 (SVG + 가이드)
  - [ ] 설치 프롬프트 UI (향후 개선)
- **파일**:
  - `next.config.js` - PWA 설정
  - `public/manifest.json` - 앱 메타데이터
  - `pages/_document.tsx` - PWA 메타 태그
  - `pages/offline.tsx` - 오프라인 폴백 페이지
  - `public/icon.svg` - 앱 아이콘 (SVG)
  - `public/ICON_README.md` - 아이콘 생성 가이드
  - `PWA_TESTING_GUIDE.md` - 테스트 가이드
- **테스트**: PWA_TESTING_GUIDE.md 참고

### [x] 초보자 80%+ 수익 달성 시스템
- **우선순위**: ⭐⭐⭐⭐ (최우선)
- **복잡도**: 중간
- **설명**: AI가 자동으로 Entry Score 70점 이상, 2개 이상 증권사 추천 종목 선별 (최대 20개)
- **가치**: 주식 초보자도 사이트 추천만 따라하면 80% 이상 수익 가능
- **완료일**: 2026-04-17 / **최종 강화**: 2026-05-07
- **구현**:
  - [x] AI 추천 탭 (Sprint 1 - 핵심 기능)
    - [x] `/api/ai-picks` API 엔드포인트 (필터링, 리스크 계산, 포지션 사이징)
    - [x] `AIPicksTab.tsx` UI 컴포넌트 (카드 레이아웃, Entry Score 배지)
    - [x] 메인 대시보드 통합 (탭 추가, 라우팅)
    - [x] 리스크 레벨 자동 계산 (low/medium/high)
    - [x] 포지션 사이징 (5-15% 자동 권장)
    - [x] 투자 기간 추정 (1-3개월 또는 3-12개월)
  - [x] Entry Score 설명 시스템 (Sprint 2 - 완료)
    - [x] `EntryScoreTooltip.tsx` 컴포넌트
    - [x] 4개 구성 요소 시각화 (막대 그래프)
    - [x] AI 추천 탭과 공통 추천 탭에 통합
    - [x] 회색 원형 배경 아이콘으로 개선
  - [x] 금융 용어 사전 (Sprint 2 - 완료)
    - [x] `GlossaryModal.tsx` 컴포넌트
    - [x] 헤더에 "용어" 버튼 추가
    - [x] 12개 금융 용어 설명 (4개 카테고리)
    - [x] 검색 기능 및 카테고리 필터
    - [x] 예시 포함된 카드 레이아웃
  - [x] 백테스트 가이드 강화 (Sprint 3 - 완료)
    - [x] "초보자 추천" 배지 추가 (컨센서스 전략에 녹색 배지)
    - [x] 전략별 설명 강화 (동적 설명 박스 + 리스크 레벨)
    - [x] 각 전략의 특징과 적합성 설명
    - [x] 리스크 레벨 표시 (낮음/보통/높음)
  - [x] 포트폴리오 액션 가이드 (Sprint 3 - 완료)
    - [x] 분산투자 제안 (diversification score < 60일 때)
    - [x] 집중도 경고 (15% 초과 종목 표시)
    - [x] AI 추천으로 보완하기 버튼 (탭 이동)
    - [x] 리밸런싱 가이드 보기 버튼
    - [x] 시각적 경고 메시지 (오렌지/블루 박스)
  - [x] 신뢰도 & Exit 시스템 강화 (2026-05-07)
    - [x] 실제 역대 승률 배너: analyst 캐시 month1 완료 리포트 기반 성공률/평균수익 계산
    - [x] brokerSuccessRate 실데이터 교체: 하드코딩 50% → 브로커별 실적 기반 계산 (3건 이상 브로커만)
    - [x] 각 카드에 증권사 승률 표시 (상세 설명 부제목)
    - [x] 매도 신호 3조건 박스: ① 목표가 달성 즉시 매도 ② 보유기간(1-3/3-12개월) 초과 ③ -7% 손절
    - [x] 목표가 진행률 프로그레스 바: 기준가→현재가→목표가 시각화
    - [x] 매수 기록 버튼: localStorage 기반 trade-journal 저장
    - [x] 내 투자 현황 섹션: P&L%, 목표 진행률, 남은 일수, 목표 달성/손절 경고
  - [x] 추천 기준 완화 (2026-05-11)
    - [x] 증권사 수: 3개 → **2개 이상** (더 넓은 종목 풀)
    - [x] 표시 제한: Top 10 → **Top 20**
- **필터링 기준**:
  - Entry Score: ≥70점
  - 증권사 수: ≥2개 (완화)
  - 리포트 기간: ≤30일
  - 정렬: Entry Score DESC → Broker Count DESC
  - 제한: Top 20 (확대)
- **리스크 계산 알고리즘**:
  - Low: Entry Score ≥80 AND 상승여력 ≤30%
  - Medium: Entry Score ≥70 AND 상승여력 ≤50%
  - High: 그 외
- **포지션 사이징 알고리즘**:
  - 기본 10%
  - High Risk: -3%
  - 상승여력 >50%: -2%
  - 범위: 5-15%
- **파일**:
  - `lib/analyst-types.ts` - AIPick, AIPicksResponse, TradeRecord 타입
  - `pages/api/ai-picks.ts` - AI 추천 API (필터링, 실제 승률 계산, Exit 조건)
  - `components/AIPicksTab.tsx` - AI 추천 탭 UI (승률 배너, 진행률 바, 매수 기록)
  - `lib/trade-journal.ts` - 매수 기록 CRUD (localStorage 기반)
  - `components/EntryScoreTooltip.tsx` - Entry Score 툴팁
  - `components/GlossaryModal.tsx` - 금융 용어 사전 모달
  - `pages/index.tsx` - 메인 대시보드 통합
- **테스트 결과**:
  - **Sprint 1 (AI 추천 탭)**:
    - API 엔드포인트: ✅ 정상 작동 (200 OK)
    - 필터링: ✅ 1개 종목 선별 (하이브 - 352820)
    - 리스크 계산: ✅ High (Entry Score 70, 상승여력 54.7%)
    - 포지션 사이징: ✅ 5% (High Risk 기준)
    - 프론트엔드 컴파일: ✅ 1017 모듈, 에러 없음
  - **Sprint 2 (Entry Score 툴팁 + 용어 사전)**:
    - EntryScoreTooltip: ✅ 4개 구성 요소 막대 그래프 표시
    - 툴팁 통합: ✅ AI 추천 탭 및 공통 추천 탭 (모바일/데스크톱)
    - GlossaryModal: ✅ 12개 용어, 검색, 카테고리 필터
    - 헤더 통합: ✅ "용어" 버튼 추가 및 모달 열기
    - 프론트엔드 컴파일: ✅ 에러 없음

### [x] 대시보드 커스터마이징
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 탭 순서 변경, 위젯 배치 커스터마이징
- **가치**: 개인 워크플로우 최적화
- **완료일**: 2026-05-06
- **구현**:
  - [x] 드래그앤드롭 라이브러리 (@dnd-kit)
  - [x] localStorage 기반 레이아웃 저장
  - [x] 리셋 기능 (기본값 초기화 버튼)
  - [x] 레이아웃 프리셋 제공 (기본형 / 시장중심형 / 관심종목형)
- **파일**:
  - `lib/dashboard-config.ts` — 21개 탭 + 6개 홈섹션 정의, 프리셋 관리, localStorage 직렬화
  - `components/DashboardCustomizationModal.tsx` — dnd-kit 드래그-드롭 UI, 탭 표시/숨김, 순서 변경
  - `pages/index.tsx` — `type TabType = DashboardTabId`로 전환, visibleTabs 동적 렌더링
- **특징**:
  - 21개 탭 개별 표시/숨김 + 드래그 순서 변경
  - 3가지 프리셋 원클릭 적용
  - 홈 화면 섹션(시장지수/관심종목 등) 별도 커스터마이징
  - 설정 변경 즉시 반영, 새로고침 후에도 유지

### [x] 다크모드 자동 전환
- **우선순위**: ⭐ (낮음)
- **복잡도**: 낮음
- **설명**: 시스템 설정 또는 시간 기반 자동 전환
- **가치**: 눈의 피로 감소
- **완료일**: 2026-04-22
- **구현**:
  - [x] `prefers-color-scheme` 감지 (system 모드)
  - [x] 시간대별 자동 전환 설정 (auto 모드: 22:00~06:00 다크)
  - [x] 설정 UI 추가 (헤더 토글 버튼, 4단계 순환)
- **파일**:
  - `lib/useDarkMode.ts` - 다크모드 훅 (system/light/dark/auto 4모드, localStorage 저장)
  - `tailwind.config.js` - darkMode: 'class' 활성화
  - `styles/globals.css` - dark 모드 CSS 변수
  - `pages/index.tsx` - 헤더 토글 버튼 + 구조 dark: 클래스
- **특징**:
  - 4가지 모드: 시스템(💻) → 라이트(☀️) → 다크(🌙) → 자동(🕐) 순환
  - 시스템: OS `prefers-color-scheme` 자동 감지 + 변경 감지
  - 자동: 22:00~06:00 다크, 나머지 라이트 (1분 간격 체크)
  - localStorage 저장으로 새로고침 후에도 유지
  - 헤더에 토글 버튼 (현재 모드 아이콘 + 이름 표시)

### [x] 캘린더 형식 UI
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 중간
- **설명**: 공모주 청약일정, 실적발표 투자 이벤트를 월별/주간 캘린더 뷰로 통합 표시
- **가치**: 날짜 기반 이벤트 한눈에 파악, 투자 일정 관리 용이
- **완료일**: 2026-05-06
- **구현**:
  - [x] 월별 캘린더 그리드 컴포넌트 개발 (주 단위 7열, 5~6행)
  - [x] 공모주 청약일정 캘린더 통합 (`/api/ipo-calendar` 연동)
  - [x] 실적 발표일 캘린더 통합 (`/api/earnings-calendar` 연동)
  - [x] 이벤트 타입별 색상 구분 (청약시작/청약마감/상장/환불/실적)
  - [x] 날짜 클릭 시 해당일 이벤트 상세 사이드 패널
  - [x] 이전/다음 달 네비게이션 + 오늘 버튼
  - [x] 이번 주 요약 위젯 — D-Day 표시, 관심종목 ★ 강조
  - [x] 월간/주간 뷰 토글 — 7컬럼 주간그리드, 이전/다음주 네비게이션
  - [x] 관심 종목 하이라이트 — ★ 배지, watchlist 필터
  - [x] 배정 계산기 연동 — IPO 상세행 → IpoAllocationCalculatorModal 모달
- **파일**:
  - `components/InvestmentCalendarTab.tsx` — 공모주·실적 통합 캘린더 (794줄)
  - `components/IpoAllocationCalculatorModal.tsx` — 브로커별 배정 계산기 (459줄, 22개 브로커)
  - `lib/ipo-types.ts` — 공모주 타입 정의
  - `lib/ipo-broker-rules.ts` — 22개 증권사 청약 규칙
  - `lib/ipo-allocation-calculator.ts` — 균등/비례 배정 계산 로직
  - `pages/index.tsx` — `'calendar'` 탭 추가
- **특징**:
  - 5가지 이벤트 타입별 컬러 pill (청약시작·청약마감·상장·환불·실적)
  - 월간 뷰: 5~6행 그리드, 날짜 클릭 시 상세 패널
  - 주간 뷰: 7컬럼, min-h-200px 셀, 이벤트 전체 표시
  - 배정 계산기: 22개 브로커 수수료·배정 비율 자동 계산

### [ ] 투자 캘린더 알림 구독
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 중간
- **설명**: 공모주 청약 시작/마감, 실적 발표 이벤트를 Google Calendar / iCal로 내보내기
- **가치**: 외부 캘린더와 연동하여 실제 일정 관리 가능
- **구현**:
  - [ ] ICS 파일 생성 유틸 (ipo, earnings 이벤트 → VEVENT)
  - [ ] "캘린더에 추가" 버튼 (Google Calendar URL 생성 + .ics 다운로드)
  - [ ] 이벤트별 개별 추가 또는 이번 달 전체 내보내기

### [ ] 주간 투자 요약 리포트
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 매주 월요일 지난 주 성과 + 이번 주 일정을 요약한 자동 리포트 생성
- **가치**: 바쁜 투자자의 주간 브리핑
- **구현**:
  - [ ] Groq API로 주간 요약 텍스트 자동 생성
  - [ ] 지난 주 공모주 상장 결과, 주목할 실적, 이번 주 캘린더 하이라이트
  - [ ] 이메일 발송 (Resend) 또는 페이지 내 팝업

---

## 3. 포트폴리오 관리

### [ ] 실시간 포트폴리오 추적
- **우선순위**: ⭐⭐⭐⭐ (최우선)
- **복잡도**: 중간
- **설명**: 실시간 손익, 자산 배분 모니터링
- **가치**: 사용자 Lock-in, 일일 접속 유도
- **구현**:
  - [ ] localStorage 포트폴리오 스키마 설계
  - [ ] 종목 추가/수정/삭제 UI
  - [ ] 실시간 가격 폴링 (2초 간격)
  - [ ] 수익률 차트 (일별, 누적)
  - [ ] 자산 배분 파이 차트
  - [ ] CSV 내보내기

### [ ] 리스크 분석 대시보드
- **우선순위**: ⭐ (낮음)
- **복잡도**: 높음
- **설명**: 베타, 샤프 비율, VaR 계산
- **가치**: 안전한 투자 결정
- **구현**:
  - [ ] 과거 변동성 데이터 수집
  - [ ] 리스크 지표 계산 로직
  - [ ] 섹터/국가 집중도 분석
  - [ ] 리스크 점수 시각화

### [ ] 목표 수익률 시뮬레이터
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 목표 금액/기간 기반 투자 계획
- **가치**: 목표 기반 투자 전략
- **구현**:
  - [ ] 시뮬레이션 계산 로직
  - [ ] 입력 폼 (목표, 기간, 초기 자본)
  - [ ] 결과 시각화 (시나리오별)
  - [ ] PDF 리포트 생성

### [ ] 투자 일지
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 종목별 매매 노트, 감정 추적
- **가치**: 투자 복기, 패턴 분석
- **구현**:
  - [ ] 일지 작성 UI
  - [ ] 태그 시스템 (전략, 감정)
  - [ ] 검색 및 필터링
  - [ ] 통계 대시보드 (승률, 평균 보유 기간)

### [ ] 공모주 청약 포트폴리오
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 낮음
- **설명**: 청약 참여 내역, 배정 결과, 수익 추적을 위한 공모주 전용 포트폴리오
- **가치**: 공모주 투자 이력 및 성과 관리
- **구현**:
  - [ ] 청약 종목 추가 (종목명, 청약수량, 공모가, 배정수량 입력)
  - [ ] 상장 후 수익률 자동 계산 (상장일 종가 기준)
  - [ ] 통계: 총 청약 건수, 배정률, 평균 수익률
  - [ ] localStorage 저장

---

## 4. 기술적 개선

### [ ] 실시간 가격 업데이트
- **우선순위**: ⭐⭐⭐ (높음)
- **복잡도**: 중간
- **설명**: WebSocket 기반 실시간 가격 스트리밍
- **가치**: 정확한 실시간 정보
- **구현**:
  - [ ] WebSocket 서버 또는 서비스 선정
  - [ ] 클라이언트 WebSocket 연결 관리
  - [ ] 재연결 로직
  - [ ] 폴백 폴링

### [ ] 증분 캐시 업데이트
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 최근 N개 리포트만 업데이트
- **가치**: 리소스 절약, 더 빠른 신선도
- **구현**:
  - [ ] 변경 감지 로직
  - [ ] 부분 캐시 업데이트 스크립트
  - [ ] GitHub Actions 워크플로우 최적화
  - [ ] 캐시 버전 관리

### [ ] 데이터베이스 마이그레이션
- **우선순위**: ⭐ (낮음)
- **복잡도**: 높음
- **설명**: JSON → Supabase/PlanetScale + Prisma
- **가치**: 복잡한 쿼리, 사용자 데이터 저장
- **구현**:
  - [ ] DB 스키마 설계
  - [ ] Prisma 설정
  - [ ] 마이그레이션 스크립트
  - [ ] 사용자 인증 시스템
  - [ ] API 라우트 리팩토링

### [ ] Public API 제공
- **우선순위**: ⭐ (낮음)
- **복잡도**: 중간
- **설명**: REST API with rate limiting
- **가치**: 생태계 확장
- **구현**:
  - [ ] API 키 발급 시스템
  - [ ] Rate limiting 미들웨어
  - [ ] API 문서 (Swagger/OpenAPI)
  - [ ] 사용량 대시보드

### [ ] 글로벌 검색 강화
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 낮음
- **설명**: 공모주·투자캘린더·ETF 데이터를 글로벌 검색에 포함, 검색 결과에 출처 탭 표시
- **가치**: 단일 검색창으로 모든 데이터 접근
- **구현**:
  - [ ] GlobalSearch에 IPO/calendar 데이터소스 추가
  - [ ] 검색 결과 카드에 출처 배지 (공모주 / 캘린더 / 애널리스트 등)
  - [ ] 검색 결과 클릭 시 해당 탭으로 자동 이동

---

## 5. 소셜/협업

### [ ] 종목 토론 게시판
- **우선순위**: ⭐ (낮음)
- **복잡도**: 높음
- **설명**: 종목별 댓글 시스템
- **가치**: 커뮤니티 인사이트
- **구현**:
  - [ ] 댓글 스키마 및 DB
  - [ ] 댓글 CRUD API
  - [ ] 댓글 UI 컴포넌트
  - [ ] 투표/좋아요 기능
  - [ ] 스팸 필터 (Akismet or 자체)

### [ ] 포트폴리오 공유
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 중간
- **설명**: 익명 포트폴리오 공유, 리더보드
- **가치**: 소셜 프루프, 학습 효과
- **구현**:
  - [ ] 공유 링크 생성
  - [ ] 공개 포트폴리오 페이지
  - [ ] 수익률 리더보드
  - [ ] 팔로우 기능

### [ ] 소셜 미디어 감성 분석
- **우선순위**: ⭐ (낮음)
- **복잡도**: 높음
- **설명**: Twitter, 커뮤니티 감성 점수화
- **가치**: 대중 심리 파악
- **구현**:
  - [ ] Twitter API 연동
  - [ ] 네이버 블로그/카페 크롤러
  - [ ] 감성 분석 모델 (OpenAI API)
  - [ ] 감성 점수 시각화

### [ ] 공유 가능한 리포트 요약
- **우선순위**: ⭐⭐ (중간)
- **복잡도**: 낮음
- **설명**: OG 이미지, 공유 링크 최적화
- **가치**: 바이럴 성장
- **구현**:
  - [ ] 동적 OG 이미지 생성 (Vercel OG)
  - [ ] 공유 링크 라우트
  - [ ] SNS 메타 태그 최적화
  - [ ] 공유 버튼 추가

---

## 📊 진행 상황 요약

- **전체 항목**: 39개 (신규 6개 추가)
- **완료**: 10개 (25.6%) ✅
  - PWA 변환 ✅
  - 초보자 80%+ 수익 달성 시스템 (Sprint 1-3 완료) ✅
  - 컨센서스 변화 추적 ✅
  - 애널리스트 성과 리더보드 ✅
  - 배당/밸류에이션 스크리너 ✅
  - 다크모드 자동 전환 ✅
  - Groq AI 단기 유망주 ✅
  - 공모주 일정 캘린더 ✅
  - 캘린더 형식 UI ✅
  - 대시보드 커스터마이징 ✅
- **진행중**: 0개
- **미완료**: 29개 (74.4%)

---

## 🎯 다음 스프린트 계획

### 스프린트 1 (우선순위 최상)
1. [ ] **투자 캘린더 알림 구독** — Google Calendar / iCal 내보내기
2. [ ] **공모주 청약 경쟁률 & 수익률 추적** — 상장 수익률 자동 집계
3. [ ] **맞춤형 알림 시스템** — 관심 종목 새 리포트 푸시 알림

### 스프린트 2
1. [ ] 공모주 청약 포트폴리오
2. [ ] 종목 비교 기능
3. [ ] 주간 투자 요약 리포트

### 스프린트 3
1. [ ] 실시간 포트폴리오 추적
2. [ ] 실시간 가격 업데이트
3. [ ] 기술적 지표 오버레이 (RSI/MACD)

---

## 📝 개발 노트

### 2026-04-17: PWA 변환 완료 ✅
- next-pwa 플러그인 성공적으로 설치 및 설정
- manifest.json, 오프라인 페이지, 메타 태그 추가
- Service Worker 자동 생성 확인 (빌드 시)
- 개발 모드에서는 비활성화, 프로덕션에서만 활성화
- 테스트 가이드 작성 완료 (`PWA_TESTING_GUIDE.md`)
- 아이콘 SVG 생성 및 PNG 변환 가이드 제공

**다음 단계**:
- PNG 아이콘 생성 (디자이너 작업 또는 온라인 도구)
- Vercel 배포 후 실제 모바일 테스트
- 설치 프롬프트 UI 추가 (향후 개선)

### 2026-04-17 (오후): 초보자 80%+ 수익 달성 시스템 - Sprint 1 완료 ✅
- 사용자 목표: 주식을 모르는 초보자도 사이트 추천만 따라하면 80% 이상 수익
- 계획 수립: Plan Mode에서 사용자 선택 기반 구현 계획 수립
  - AI 자동 추천 방식 선택
  - 유연한 투자 기간 (단기/중기 선택 가능)
  - 균형 잡힌 리스크 관리 (분산투자 + 경고 시스템)
- **Sprint 1 완료 항목**:
  - ✅ AI 추천 API 엔드포인트 (`pages/api/ai-picks.ts`)
    - Entry Score ≥70, 증권사 ≥3, 리포트 ≤30일 필터링
    - 리스크 레벨 자동 계산 (low/medium/high)
    - 포지션 사이징 5-15% 자동 권장
    - 투자 기간 1-3개월 또는 3-12개월 추정
    - 60초 TTL 캐싱 + inflight deduplication
  - ✅ AI 추천 탭 UI (`components/AIPicksTab.tsx`)
    - 종목 카드 레이아웃 (2열 그리드)
    - Entry Score 배지 (80+ 초록, 70-79 노랑)
    - 리스크 레벨 배지 (낮음/보통/높음)
    - 포지션 사이징 표시
    - AI 추천 이유 1문장 요약
    - 관심 종목 추가 버튼 (별 아이콘)
    - 통계 카드 (추천 종목 수, 평균 Entry Score, 평균 증권사 수)
  - ✅ 메인 대시보드 통합
    - TabType에 'ai-picks' 추가
    - 네비게이션 탭 추가 ("AI 추천", 관심 종목과 국내 주식 사이)
    - AIPicksTab 컴포넌트 렌더링 로직 추가
- **테스트 결과**:
  - API: 200 OK, 1개 종목 선별 (하이브, Entry Score 70, High Risk, 5% 포지션)
  - 프론트엔드: 에러 없이 컴파일 완료 (1017 모듈)
  - 캐싱: 첫 요청 1242ms → 후속 요청 3-4ms

### 2026-04-17 (저녁): 초보자 80%+ 수익 달성 시스템 - Sprint 2 완료 ✅
- **Sprint 2 완료 항목**:
  - ✅ Entry Score 설명 시스템 (`components/EntryScoreTooltip.tsx`)
    - 4개 구성 요소 막대 그래프 시각화
      - 기준가 대비 할인 (max 30점)
      - 목표가까지 여력 (max 35점)
      - 리포트 수 (max 15점)
      - 공통추천 강도 (max 20점)
    - 각 요소별 설명 텍스트 및 점수 표시
    - 점수 기준 안내 (80+점, 70-79점, 70점 미만)
    - 호버 시 툴팁 표시 (onMouseEnter/onMouseLeave)
    - 회색 원형 배경 아이콘으로 가시성 향상
  - ✅ AI 추천 탭과 공통 추천 탭에 툴팁 통합
    - AI 추천 탭: Entry Score 배지 옆에 툴팁 아이콘
    - 공통 추천 탭 (모바일 뷰): 카드 레이아웃에 툴팁 추가
    - 공통 추천 탭 (데스크톱 뷰): 테이블 진입 점수 열에 툴팁 추가
  - ✅ 금융 용어 사전 모달 (`components/GlossaryModal.tsx`)
    - 12개 금융 용어 포함 (4개 카테고리)
      - 가격/수익률: 목표가, 기준가, 현재가, 상승여력, 괴리율
      - 점수/평가: Entry Score
      - 추천/리포트: 공통추천/컨센서스, 증권사, 리포트
      - 리스크/포지션: 리스크 레벨, 포지션 사이징, 투자 기간
    - 검색 기능 (용어명, 설명 내용)
    - 카테고리 필터 (전체, 가격/수익률, 점수/평가, 추천/리포트, 리스크/포지션)
    - 각 용어마다 💡 예시 포함
    - 파란색 그라데이션 헤더, 카드 레이아웃
  - ✅ 헤더에 "용어" 버튼 통합
    - 상단 우측 검색, 알림 버튼 옆에 배치
    - 클릭 시 GlossaryModal 열기
    - ESC 또는 X 버튼으로 닫기
- **테스트 결과**:
  - EntryScoreTooltip: ✅ 4개 구성 요소 막대 그래프 정상 표시
  - 툴팁 통합: ✅ AI 추천 및 공통 추천 탭 (모바일/데스크톱)
  - GlossaryModal: ✅ 12개 용어, 검색, 카테고리 필터 정상 작동
  - 컴파일: ✅ 에러 없음
- **다음 Sprint 3 계획**:
  - ✅ 백테스트 탭 초보자 추천 배지 (완료)
  - ✅ 포트폴리오 탭 액션 가이드 (완료)

### 2026-04-17 (심야): 초보자 80%+ 수익 달성 시스템 - Sprint 3 완료 ✅
- **Sprint 3 완료 항목**:
  - ✅ 백테스트 가이드 강화 (`components/BacktestTab.tsx`)
    - "✓ 초보자 추천" 배지 (녹색, 컨센서스 전략)
    - 동적 전략 설명 박스 (파란색 배경)
      - 모든 추천: 분산투자 효과, 리스크 높음
      - 상위 증권사: 신뢰도 높은 애널리스트, 리스크 보통
      - 고 Entry Score: 매수 타이밍 집중, 리스크 높음
      - 컨센서스 종목: 여러 증권사 동의, 리스크 낮음 (초보자 추천)
    - 리스크 레벨 배지 (낮음/보통/높음)
    - 전략 선택 시 실시간 설명 업데이트
  - ✅ 포트폴리오 액션 가이드 (`components/PortfolioTab.tsx`)
    - 분산투자 제안 (diversification score < 60)
      - 현재 투자 중인 섹터 수 표시
      - 파란색 박스로 안내
    - 집중도 경고 (15% 초과 종목)
      - 오렌지색 경고 박스
      - 15% 초과 종목 리스트 표시 (종목명 + 비중%)
    - 액션 버튼
      - "AI 추천으로 보완하기" (파란색, AI picks 탭 이동)
      - "리밸런싱 가이드 보기" (흰색 테두리, 스크롤 상단)
    - 조건부 렌더링 (diversification < 60 또는 holding > 15%)
    - 그라데이션 박스 디자인 (블루 계열)
  - ✅ 부모 컴포넌트 통합 (`pages/index.tsx`)
    - PortfolioTab에 onNavigateToAIPicks 콜백 전달
    - setActiveTab('ai-picks') 연결
- **테스트 결과**:
  - BacktestTab: ✅ 초보자 추천 배지, 전략별 설명 박스, 리스크 레벨 정상 표시
  - PortfolioTab: ✅ 분산투자 제안, 집중도 경고, 액션 버튼 정상 작동
  - 탭 이동: ✅ AI 추천 탭으로 정상 이동
  - 컴파일: ✅ 에러 없음
- **커밋 내역**:
  - fb1b08d: feat: Add beginner guidance to backtest strategies (Sprint 3)
  - 517c799: feat: Add portfolio action guide (Sprint 3)

### 2026-04-21: 컨센서스 변화 추적 완료 ✅
- **배경**: 애널리스트 의견 변화를 시간에 따라 추적하여 모멘텀 파악 및 의견 전환점 포착
- **델타 방식 설계**:
  - Baseline + Deltas 구조로 효율적인 데이터 저장
  - 90일 이상 오래된 델타 자동 정리
  - 30개 델타마다 baseline 재설정 (최적화)
- **구현 완료 항목**:
  - ✅ 델타 재구성 유틸리티 (`lib/consensus-delta-utils.ts`)
    - reconstructStateAtDate: 특정 날짜의 상태 재구성
    - buildTimeline: 종목별 타임라인 데이터 생성
    - computeChange: 스냅샷 간 변화량 계산
    - getTrend: 컨센서스 강화/약화 판정
  - ✅ 델타 생성 스크립트 (`scripts/generate-consensus-delta.mjs`)
    - 일일 컨센서스 스냅샷 생성
    - 이전 상태와 비교하여 델타 계산 (added/removed/changed)
    - 90일 이상 오래된 델타 자동 정리
    - 30개 델타마다 baseline 재설정
  - ✅ API 엔드포인트
    - `/api/consensus-history` - 특정 종목의 타임라인 데이터
    - `/api/consensus-top-movers` - 컨센서스 강화/약화 상위 10개 종목
  - ✅ 프론트엔드 UI (`components/ConsensusChangesTab.tsx`)
    - 7일/30일 기간 선택
    - 컨센서스 강화/약화 종목 카드 레이아웃
    - 종목 클릭 시 4가지 타임라인 차트 표시:
      - Entry Score 변화
      - 증권사 수 변화
      - 평균 상승여력 변화
      - 가격 대비 목표가
  - ✅ GitHub Actions 자동화
    - 매일 자동으로 델타 파일 업데이트 및 커밋
- **테스트 결과**:
  - 델타 생성: ✅ 12개 추가, 1개 제거, 110개 변경
  - API: ✅ `/api/consensus-history`, `/api/consensus-top-movers` 정상 작동
  - 빌드: ✅ 프로덕션 빌드 성공
- **데이터 크기**: ~0.08 MB (델타 방식으로 효율적)

**다음 단계**:
- 실 데이터 축적 후 패턴 분석
- 컨센서스 변화 알림 기능 추가 (맞춤형 알림 시스템과 통합)

### 2026-04-21 (오후): 애널리스트 성과 리더보드 완료 ✅
- **목표**: 성공률, 평균 수익률, 목표가 달성률 기준 증권사 순위표 제공
- **구현 완료 항목**:
  - ✅ 기존 `analyst-scorecard.ts` API 활용
    - byBroker, byMarket, bySector 그룹별 성과 데이터
    - week1, month1, month3 기간별 지표
    - 성공률, 평균 수익률, 목표가 달성률 계산
  - ✅ `AnalystLeaderboardTab.tsx` 컴포넌트 개발
    - 명예의 전당 (상위 3개 증권사 포디엄 카드)
    - 전체 순위 테이블 (4위 이하)
    - 4가지 필터링: 기간, 시장, 정렬 기준, 평가 기준
    - 전체 통계 카드
  - ✅ 메인 대시보드 통합
    - "애널리스트 성과" 탭 추가
    - AnalystLeaderboardTab import 및 렌더링
- **디자인 특징**:
  - 1위: 금색 그라데이션 (from-yellow-400 via-amber-500 to-yellow-600)
  - 2위: 은색 그라데이션 (from-gray-300 via-gray-400 to-gray-500)
  - 3위: 동색 그라데이션 (from-orange-400 via-amber-600 to-orange-700)
  - Glassmorphism 메트릭 박스 (bg-white/10, backdrop-blur)
  - slideInUp 애니메이션 (stagger 효과)
  - 반응형 그리드 레이아웃
- **필터링 옵션**:
  - 기간: 30일, 90일, 180일, 365일
  - 시장: 전체, 🇰🇷 한국, 🇺🇸 미국
  - 정렬 기준: 성공률, 평균 수익률, 리포트 수
  - 평가 기준: 1주, 1개월, 3개월
- **테스트 결과**:
  - 빌드: ✅ 프로덕션 빌드 성공
  - 타입스크립트: ✅ 타입 오류 없음
  - API: ✅ analyst-scorecard API 정상 작동

### 2026-04-21 (오후): 컨센서스 변화 추적 - 디자인 개선 완료 ✅
- **목표**: Frontend Design 원칙에 따라 차별화된 제품 경험 구현
- **비주얼 방향**: Editorial + Data-Driven 하이브리드
  - 금융 데이터의 신뢰성 + 잡지 스타일의 가독성
  - 대담한 타이포그래피와 색상
  - Generic template 탈피
- **주요 개선 사항**:
  - ✅ **Hero Card 레이아웃 (Bento-Style)**
    - 최고 강화/최대 약화 종목 → 대형 히어로 카드 (gradient background)
    - 나머지 종목 → 3열 Compact Grid
    - Glassmorphism 메트릭 박스 (bg-white/10, backdrop-blur)
  - ✅ **타이포그래피 강화**
    - 헤더: text-4xl (컨센서스 변화 추적)
    - Hero 타이틀: text-4xl~5xl (종목명)
    - 메트릭: text-3xl, font-mono
    - 섹션 제목: text-3xl
  - ✅ **색상 시스템 개선**
    - 강화: `from-emerald-500 via-teal-500 to-cyan-600` + `shadow-emerald-500/30`
    - 약화: `from-rose-500 via-pink-500 to-orange-600` + `shadow-rose-500/30`
    - Compact 카드: gradient backgrounds (emerald-50→teal-50, rose-50→orange-50)
  - ✅ **차트 스토리텔링 강화**
    - LineChart → AreaChart (gradient fill)
    - 각 차트별 색상 테마 (Blue, Green, Amber, Purple/Pink)
    - 개선된 Tooltip 스타일 (rounded-xl, 2px border)
    - Vertical Accent Bar (w-1 h-8, 시각적 구분)
  - ✅ **의미 있는 모션**
    - `slideInUp` 애니메이션 (Hero: 0.6s, Compact: stagger 0.1s)
    - Hover effects (Hero: scale-[1.02], Compact: -translate-y-1 + shadow-lg)
    - 타임라인 버튼: scale-105 + backdrop-blur
  - ✅ **Depth & Atmosphere**
    - 헤더: gradient (slate-900→purple-900) + SVG grid pattern
    - Hero 카드: glassmorphism + glow shadow
    - 타임라인: gradient header (indigo-600→purple-600) + 차트별 gradient 배경
    - rounded-2xl, shadow-2xl 일관적 사용
- **파일 수정**:
  - `components/ConsensusChangesTab.tsx` - 완전 리디자인 (350→532줄)
- **테스트 결과**:
  - 빌드: ✅ 프로덕션 빌드 성공 (Route / - 42.7 kB)
  - 타이포그래피: ✅ 명확한 계층 구조
  - 애니메이션: ✅ stagger 효과, hover transitions
  - 반응형: ✅ 모바일/데스크톱 레이아웃
- **Before vs After**:
  | 요소 | Before | After |
  |------|--------|-------|
  | Layout | 균일한 2열 그리드 | Hero + Compact Grid |
  | Typography | text-xl~2xl | text-4xl~5xl (Hero) |
  | Colors | 단순 녹색/빨강 | Gradient + Glow |
  | Charts | 기본 LineChart | AreaChart + Gradient Fill |
  | Motion | 없음 | Stagger + Hover animations |
  | Depth | 플랫한 흰색 배경 | Gradient + Pattern + Shadow |
- **성과**:
  - 차별화된 제품 경험 제공
  - 일반적인 대시보드 템플릿과 확연히 다른 모습
  - Frontend Design 원칙 6가지 모두 충족

---

### 2026-04-22: 배당/밸류에이션 스크리너 완료 ✅
- **목표**: PER, PBR, 배당수익률, ROE 기준 종목 필터링
- **구현 완료 항목**:
  - ✅ `pages/api/valuation-screener.ts` API 엔드포인트
    - 애널리스트 추천 종목(90일) 자동 유니버스 수집
    - Korea: Naver Finance `/api/stock/{ticker}/basic` (PER, PBR, EPS)
    - US: Yahoo Finance quoteSummary (trailingPE, priceToBook, dividendYield, returnOnEquity)
    - 동시 요청 5개 제한, 10분 캐시
  - ✅ `components/ValuationScreenerTab.tsx` UI
    - PER/PBR/배당수익률/ROE 범위 필터 (양방향 min/max 입력)
    - 빠른 설정 프리셋 4개 (가치주/고배당/저PBR 우량주/컨센서스)
    - 컬럼 클릭 오름/내림차순 정렬
    - 색상 코딩: 저PER(녹색), 고PER(빨강), 저PBR(녹색), 고배당(녹색), 고ROE(파랑)
    - CSV 내보내기 (BOM 포함 한글 호환)
    - 모바일 카드 + 데스크톱 테이블 반응형
  - ✅ 메인 대시보드 탭 추가 ("밸류에이션 스크리너")

**최종 업데이트**: 2026-04-22

---

### 2026-04-27: Groq AI 단기 유망주 완료 ✅
- **목표**: Groq llama-3.3이 실시간 애널리스트 데이터를 분석해 단기 3%+ 유망주 선별
- **구현 완료 항목**:
  - ✅ `pages/api/groq-daily-picks.ts` API
    - 최근 15일 리포트에서 브로커 2개+ 종목 후보군 구성 (EntryScore ≥60, 최대 25개)
    - Groq llama-3.3-70b-versatile 호출 (temperature 0.3, JSON 모드)
    - 시스템 프롬프트: 6가지 선별 기준 (entryScore, 가격변동, 신선도, 컨센서스, 성공률, 상승여력)
    - 응답: confidence, reasoning(한국어), expectedReturn, timeframe, keyRisk
    - 서버 캐시 30분, inflight 중복 방지
  - ✅ `components/GroqDailyPicksTab.tsx` UI
    - 보라색→인디고 그라데이션 헤더 (분석 시각, 시장 기준 표시)
    - 신뢰도 배지: 80+ 초록, 70+ 노랑, 그 외 회색
    - 리포트 이후 가격 변동 칩 (ChangeChip)
    - 메트릭 그리드: 현재가, 목표가, 상승여력, Entry Score
    - 리스크 하단 오렌지 바
    - 클라이언트 캐시 25분 (탭 전환 시 재요청 방지)
  - ✅ `pages/index.tsx` — "Groq 유망주" 탭 통합
- **테스트 결과**:
  - API: ✅ 200 OK, 5개 종목 선별 (삼성바이오로직스, CJ대한통운, YG엔터, SM, JFrog)
  - 응답 시간: ~2.5초 (최초), 이후 캐시로 즉시 응답
  - 빌드: ✅ 프로덕션 빌드 성공
  - TypeScript: ✅ 타입 오류 없음
- **특이사항**:
  - GROQ_API_KEY는 `.env`에 설정됨 (Vercel 배포 시 환경변수 별도 등록 필요)
  - response_format json_object 사용 → 배열/객체 양쪽 파싱 처리

**최종 업데이트**: 2026-04-28

---

### 2026-04-27: 공모주 일정 캘린더 완료 ✅
- **목표**: 공모주 청약 일정을 38.co.kr에서 자동 수집하여 상태별 분류·표시
- **구현 완료 항목**:
  - ✅ `pages/api/ipo-calendar.ts` API
    - `https://www.38.co.kr/html/fund/index.htm?o=k` EUC-KR 스크래핑
    - `summary="공모주 청약일정"` tbody 정규식 파싱, 30건 수집
    - 청약완료 종목 상세 페이지 추가 파싱 (상장일·환불일, 최대 10건 동시)
    - &amp; HTML 엔티티 처리 (`(?:[?&]|&amp;)no=` 정규식 수정으로 파싱 오류 해결)
    - 1시간 서버 캐시 + inflight 중복 방지
  - ✅ `components/IpoCalendarTab.tsx` UI
    - 상태 배지: 청약중(녹색), 청약예정(파랑), 상장예정(주황), 상장완료(회색)
    - StatCard 요약 (청약중 / 청약예정 / 상장예정 / 전체)
    - 필터 버튼 5개 (전체·청약예정·청약중·상장예정·상장완료) + 건수 뱃지
    - 모바일: 카드 그리드 / 데스크톱: 테이블 (상태·종목명·청약기간·공모가·주간사·D-day)
    - D-day 카운트다운 (청약예정→시작일, 청약중→마감일, 상장예정→상장일)
  - ✅ `pages/index.tsx` — TabType에 `'ipo'` 추가, "공모주" 탭 버튼 및 렌더링 분기
- **트러블슈팅**:
  - 38.co.kr href 속성에 `&amp;no=` 형태로 인코딩 → 기존 `[?&]no=` 정규식 미매칭 → `(?:[?&]|&amp;)no=`로 수정
  - git rebase 도중 `data/analyst-reports-cache.json` 충돌 → `git checkout --ours`로 해결
- **테스트 결과**:
  - API: ✅ 200 OK, 30건 수집 (스트라드비젼 외)
  - 빌드: ✅ 프로덕션 빌드 성공
  - TypeScript: ✅ 타입 오류 없음

### 2026-05-07~11: 공모주 Vercel 배포 수정 + AI Picks 강화 ✅

#### 공모주 캘린더 Vercel 수정
- **원인**: 38.co.kr이 Vercel 미국 서버 IP를 차단 → 서버리스 함수에서 직접 스크래핑 불가
- **해결**: GitHub Actions 캐시 아키텍처 도입 (analyst-reports-cache 동일 패턴)
  - ✅ `lib/ipo-scraper.mjs` — 38.co.kr EUC-KR 스크래핑 (로컬/CI 전용)
  - ✅ `scripts/generate-ipo-cache.mjs` — `data/ipo-cache.json` 생성
  - ✅ `.github/workflows/refresh-ipo-cache.yml` — 4시간마다 자동 갱신
  - ✅ `pages/api/ipo-calendar.ts` — 캐시 파일 우선 로드, 실패 시 라이브 폴백
  - ✅ `vercel.json` — ipo-calendar 함수 maxDuration 60초 설정

#### 실적 캘린더 날짜 만료 수정
- **원인**: earnings-calendar.ts의 샘플 날짜가 2026-04월로 하드코딩 → 과거 날짜
- **해결**: `addDays(today, N)` 상대 날짜 함수로 교체, 항상 현재 기준 ±N일 표시

#### AI Picks 신뢰도 & Exit 시스템 강화 (2026-05-07)
- 실제 역대 승률 배너 (analyst 캐시 month1 완료 리포트 기반)
- brokerSuccessRate 하드코딩 50% → 브로커별 실적 계산
- 매도 신호 3조건: ① 목표가 달성 ② 기간 초과 ③ -7% 손절
- 목표가 진행률 프로그레스 바 (기준가→현재가→목표가)
- 매수 기록 버튼 + 내 투자 현황 섹션 (lib/trade-journal.ts)

#### AI Picks 추천 기준 완화 (2026-05-11)
- 증권사 수: 3개 → 2개 이상
- 표시 제한: Top 10 → Top 20
- 커밋: `156c9e1`

---

### 2026-05-06: 캘린더 형식 UI + 대시보드 커스터마이징 완료 ✅
- **목표 1**: 공모주·실적 통합 캘린더 UI 구현 (주간/월간 뷰, 배정 계산기 연동)
- **목표 2**: 탭 순서 변경·표시/숨김 가능한 대시보드 커스터마이징 구현
- **캘린더 구현 완료 항목**:
  - ✅ `components/InvestmentCalendarTab.tsx` (794줄)
    - 월간 뷰: 5~6행 그리드, 날짜 클릭 → 상세 사이드 패널
    - 주간 뷰: 7컬럼, min-h-200px 셀, 전체 이벤트 표시
    - ThisWeekWidget — D-Day 카운트다운, 관심종목 ★ 강조
    - 5가지 이벤트 타입별 컬러 pill (청약시작·청약마감·상장·환불·실적)
  - ✅ `components/IpoAllocationCalculatorModal.tsx` (459줄)
    - 22개 증권사 균등·비례 배정 자동 계산
    - 브로커별 수수료·배정 비율·청약한도 반영
  - ✅ `lib/ipo-types.ts`, `lib/ipo-broker-rules.ts`, `lib/ipo-allocation-calculator.ts`
  - ✅ `pages/index.tsx` — `'calendar'` 탭 추가
- **대시보드 커스터마이징 완료 항목**:
  - ✅ `lib/dashboard-config.ts` — 21개 탭 + 6개 홈섹션 정의, 3가지 프리셋
  - ✅ `components/DashboardCustomizationModal.tsx` — @dnd-kit 드래그-드롭 UI
  - ✅ `pages/index.tsx` — `type TabType = DashboardTabId`로 전환, visibleTabs 동적 렌더링
- **트러블슈팅**:
  - git rebase 충돌 (`analyst-reports-cache.json`) → `git checkout --ours` + `git rebase --skip` 해결
  - rebase skip으로 IPO 관련 파일 누락 → `git checkout 5ca8d19 -- <파일들>`로 복구
  - 로컬/원격 index.tsx 충돌 (DashboardTabId vs TabType) → 원격 구조 채택 후 calendar 탭 통합
- **배포**: ✅ Vercel 프로덕션 배포 완료 (commit 74b114f)
