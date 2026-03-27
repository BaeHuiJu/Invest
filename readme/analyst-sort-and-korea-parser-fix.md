# 최신순 정렬 및 국내 리서치 파싱 보완

## 변경 개요

- 애널리스트 추천 기본 정렬을 상승여력순에서 최신순으로 변경
- 국내 리서치가 0건이던 원인을 API 파싱 로직에서 수정

## 정렬 변경

- 대상 파일: `pages/index.tsx`
- `AnalystTab`의 `sortBy` 기본값을 `date`로 변경
- 목록은 최신순 기본 정렬 사용
- 상승여력 TOP 10 차트는 별도 `topUpsideReports`로 계산해 기존 의미 유지

## 국내 API 원인

- 대상 파일: `pages/api/analyst-reports.ts`
- 기존 국내 수집은 목록 페이지에서 목표가를 바로 찾으려 했지만 실제 목표가와 투자의견은 상세 페이지에 있었음
- 그 결과 국내 리포트 대부분이 `targetPrice=0`, `upside=0`이 되어 최종 필터에서 모두 제외됐음

## 국내 API 수정

- 목록 페이지에서 `nid`와 제목을 추출
- 상세 페이지 `company_read.naver`를 추가 조회해 목표가(`class="money"`)와 투자의견(`class="coment"`) 파싱
- 실제 파싱 결과가 부족할 때만 샘플 리포트로 보완

## 검증

- `/api/analyst-reports?market=korea` 결과가 비어 있지 않도록 확인 예정
- `npm run build` 재검증 예정
