# ETF 추천 프로그램

해외 및 국내 ETF를 분석하고 추천하는 프로그램

## 기능

### 국내 ETF
- KOSPI/KOSDAQ 기반 ETF 분석
- 섹터별 ETF 추천 (반도체, 2차전지, 바이오 등)
- 배당 ETF 추천
- 레버리지/인버스 ETF 정보

### 해외 ETF
- 미국 시장 ETF (S&P500, NASDAQ, 다우존스)
- 섹터별 ETF (기술, 헬스케어, 금융 등)
- 채권 ETF
- 원자재 ETF
- 글로벌/신흥국 ETF

### 애널리스트 매수 추천
최근 5일 이내 애널리스트가 매수 추천한 종목을 실시간으로 확인

| 표시 정보 | 설명 |
|-----------|------|
| 종목명 | 추천된 주식/ETF 이름 |
| 추천일 | 애널리스트 리포트 발행일 |
| 증권사 | 리포트 발행 증권사 |
| 애널리스트 | 담당 애널리스트명 |
| 목표가 | 제시된 목표 주가 |
| 현재가 | 현재 주가 |
| 상승여력 | (목표가 - 현재가) / 현재가 × 100% |
| 투자의견 | 매수/적극매수/Trading Buy 등 |
| 리포트 요약 | 핵심 투자 포인트 요약 |

#### 필터링 옵션
- 기간: 1일 / 3일 / 5일 이내
- 시장: 국내 / 해외 / 전체
- 투자의견: 적극매수 / 매수 / Trading Buy
- 섹터별 필터링
- 상승여력 기준 정렬

## 추천 기준

| 기준 | 설명 |
|------|------|
| 수익률 | 1개월, 3개월, 6개월, 1년 수익률 |
| 운용보수 | 총보수비율(TER) |
| 거래량 | 일평균 거래량 |
| 순자산 | 운용자산규모(AUM) |
| 추적오차 | 벤치마크 대비 오차 |
| 배당수익률 | 연간 배당수익률 |

## 기술 스택

- **언어**: Python 3.10+
- **데이터 수집**: yfinance, pykrx, requests
- **데이터 분석**: pandas, numpy
- **시각화**: matplotlib, plotly
- **웹 프레임워크**: Streamlit 또는 FastAPI

## 프로젝트 구조

```
Invest/
├── README.md
├── requirements.txt
├── src/
│   ├── __init__.py
│   ├── data/
│   │   ├── korea_etf.py      # 국내 ETF 데이터 수집
│   │   ├── us_etf.py         # 해외 ETF 데이터 수집
│   │   └── analyst.py        # 애널리스트 리포트 수집
│   ├── analysis/
│   │   ├── metrics.py        # 지표 계산
│   │   └── recommend.py      # 추천 알고리즘
│   └── ui/
│       └── app.py            # 웹 인터페이스
├── data/
│   └── etf_list.json         # ETF 목록
└── tests/
    └── test_recommend.py
```

## 설치 및 실행

```bash
# 의존성 설치
pip install -r requirements.txt

# 프로그램 실행
python -m src.ui.app
```

## 데이터 소스

- **국내 ETF**: KRX 정보데이터시스템, 네이버 금융
- **해외 ETF**: Form N-PORT, Yahoo Finance, ETF.com
- **애널리스트 리포트**:
  - 국내: 네이버 증권 리서치, 한경 컨센서스, 세종기업데이터
  - 해외: TipRanks, Zacks, MarketBeat

## 향후 계획

- [ ] 사용자 투자 성향 분석
- [ ] 포트폴리오 최적화 기능
- [ ] 실시간 알림 기능
- [ ] 백테스팅 기능
