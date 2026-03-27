# 애널리스트 필터 기능 설계

## 개요

애널리스트 매수 추천 화면에 증권사 필터와 투자의견 필터를 추가해 사용자가 원하는 리포트만 빠르게 좁혀볼 수 있도록 한다. 이 설계는 현재 [`D:\Invest\pages\index.tsx`](D:\Invest\pages\index.tsx) 의 `AnalystTab` 구현 상태를 기준으로 정리한다.

## 대상 화면

- 애널리스트 매수 추천 탭
- 구현 위치: [`D:\Invest\pages\index.tsx`](D:\Invest\pages\index.tsx)

## 현재 필터 구성

- 기간: `3일 / 7일 / 15일 / 30일`
- 시장: `전체 / 국내 / 해외`
- 정렬: `상승여력순 / 날짜순`
- 증권사: `전체 + 현재 응답 데이터의 broker 고유값`
- 투자의견: `전체 + 현재 응답 데이터의 opinion 고유값`

기간과 시장은 API 요청 파라미터로 반영되고, 정렬·증권사·투자의견은 클라이언트에서 후처리한다.

## 상태 및 파생 데이터

`AnalystTab` 내부 상태와 파생 데이터는 다음과 같다.

```ts
const [days, setDays] = useState<number>(30);
const [market, setMarket] = useState<'all' | 'korea' | 'us'>('all');
const [sortBy, setSortBy] = useState<'upside' | 'date'>('upside');
const [broker, setBroker] = useState<string>('all');
const [opinion, setOpinion] = useState<string>('all');

const brokers = [...new Set(reports.map((r) => r.broker))].sort();
const opinions = [...new Set(reports.map((r) => r.opinion))].sort();
```

- `broker`, `opinion` 기본값은 모두 `all`
- 옵션 목록은 고정 상수가 아니라 현재 `reports` 응답에서 동적으로 생성
- 별도 API 스키마 변경은 없음

## 필터링 규칙

데이터 흐름은 아래 순서를 따른다.

1. `days`, `market` 변경 시 `/api/analyst-reports?days={days}&market={market}` 재호출
2. 응답 데이터 `reports`에서 증권사/투자의견 옵션 목록 추출
3. `broker`, `opinion` 조건으로 필터링
4. `sortBy` 기준으로 정렬

구현 기준 로직은 다음과 같다.

```ts
const filteredReports = [...reports]
  .filter((r) => broker === 'all' || r.broker === broker)
  .filter((r) => opinion === 'all' || r.opinion === opinion)
  .sort((a, b) => {
    if (sortBy === 'upside') return b.upside - a.upside;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
```

### 동작 원칙

- `all` 선택 시 해당 필터는 미적용
- 증권사와 투자의견은 복합 적용
- 결과 0건이면 빈 상태 메시지 표시
- TOP 10 차트는 `filteredReports.slice(0, 10)` 기준으로 표시

## UI 구성

필터 영역에는 기존 기간/시장/정렬 컨트롤과 함께 아래 select box 두 개를 추가한다.

- 증권사 select
  - 라벨: `증권사`
  - 옵션: `전체` + `brokers`
- 투자의견 select
  - 라벨: `투자의견`
  - 옵션: `전체` + `opinions`

요약 카드와 테이블, 차트는 모두 동일한 `filteredReports`를 기준으로 렌더링한다.

## 요약 통계 반영 기준

요약 카드는 원본 `reports`가 아니라 필터 적용 후 결과를 사용한다.

```ts
const koreaCount = filteredReports.filter((r) => r.market === 'korea').length;
const usCount = filteredReports.filter((r) => r.market === 'us').length;
const avgUpside =
  filteredReports.length > 0
    ? filteredReports.reduce((sum, r) => sum + r.upside, 0) / filteredReports.length
    : 0;
```

반영 항목:

- 총 추천 수
- 평균 상승여력
- 국내 종목 수
- 해외 종목 수

## API 및 타입 영향

외부 인터페이스 변경은 없다.

- API 유지: `/api/analyst-reports?days={number}&market={all|korea|us}`
- `AnalystReport` 사용 필드:
  - `date`
  - `name`
  - `ticker`
  - `market`
  - `broker`
  - `opinion`
  - `targetPrice`
  - `currentPrice`
  - `upside`

## 검증 기준

다음 시나리오를 수동 검증 대상으로 본다.

1. 기본값(`broker=all`, `opinion=all`)에서 기존 전체 결과가 유지된다.
2. 특정 증권사 선택 시 테이블, 요약 카드, 차트가 모두 동일한 결과로 줄어든다.
3. 특정 투자의견 선택 시 동일하게 필터가 반영된다.
4. 증권사 + 투자의견 복합 선택 시 교집합만 남는다.
5. 기간/시장 변경 후 옵션 목록이 새 응답 기준으로 다시 구성된다.
6. 결과가 0건일 때 빈 상태 메시지가 표시되고 화면이 깨지지 않는다.

## 가정 및 제한

- 증권사/투자의견 지원 목록은 고정 관리하지 않고 API 응답 데이터에 의존한다.
- 새 데이터셋에 현재 선택값이 없어도 별도 자동 초기화 로직은 두지 않는다.
- 이번 변경 범위는 프론트엔드 필터 UX와 파생 통계 반영까지이며 API 확장이나 서버 측 필터링 추가는 포함하지 않는다.
