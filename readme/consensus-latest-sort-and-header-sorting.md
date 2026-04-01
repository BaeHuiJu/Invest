# 공통추천 최신순 정렬 및 헤더 정렬 추가

## 변경 개요

- 공통추천 탭 기본 정렬 기준을 진입 점수 우선에서 최신 리포트 일자 우선으로 변경
- 공통추천 데스크톱 테이블 헤더 클릭 시 `asc / desc` 정렬이 가능하도록 개선
- `시장`, `진입 점수` 컬럼 폭과 내부 배지 최소폭을 조정해 가독성 보완

## 최신순 정렬 변경

- 대상 파일: `pages/api/analyst-consensus.ts`
- 공통추천 API 응답 정렬에서 `latestReportDate` 내림차순을 최우선 기준으로 변경
- 날짜가 같을 때만 기존 보조 기준인 `entryScore`, `brokerCount`, `avgUpside` 순으로 비교

## UI 문구 및 컬럼 폭 조정

- 대상 파일: `pages/index.tsx`
- 공통추천 설명 문구를 `진입 점수 순`에서 `최신 리포트 일자 순` 기준으로 수정
- 데스크톱 테이블의 `시장`, `진입 점수` 컬럼에 최소 폭을 부여
- 내부 배지 최소폭을 줄여 과도하게 넓어 보이지 않도록 보정

## 헤더 정렬 추가

- 대상 파일: `pages/index.tsx`
- 공통추천 테이블에 정렬 상태(`sortBy`, `sortOrder`) 추가
- 헤더 클릭 시 같은 컬럼은 오름차순/내림차순 토글
- 다른 컬럼 클릭 시 해당 컬럼 기준으로 기본 방향 정렬
- 정렬 기준은 종목, 시장, 진입 점수, 증권사 수, 기준가 대비 현재가, 현재가, 기준가격, 평균 목표가 괴리율, 리포트 수, 최근 추천일, 증권사까지 지원
- 정렬 결과는 데스크톱 테이블뿐 아니라 모바일 카드 목록과 페이지네이션에도 동일하게 적용

## 검증

- `http://localhost:3000/api/analyst-consensus?days=30&market=all` 응답에서 최신 일자 기준 정렬 확인
- `npm run build` 성공 확인

## 배포

- GitHub `origin/master`에 푸시 완료
- 배포 커밋: `a03a822`
- Vercel 프로덕션 배포 완료
- 배포 URL: `https://vercel-deploy-91iyr3kpq-baehuijus-projects.vercel.app`
