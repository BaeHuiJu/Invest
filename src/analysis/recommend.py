"""ETF 추천 알고리즘 모듈"""
import pandas as pd
import numpy as np
from typing import List, Optional
from ..data.korea_etf import KoreaETFCollector
from ..data.us_etf import USETFCollector
from .metrics import ETFMetrics


class ETFRecommender:
    """ETF 추천 알고리즘을 제공하는 클래스"""

    def __init__(self):
        self.korea_collector = KoreaETFCollector()
        self.us_collector = USETFCollector()
        self.metrics = ETFMetrics()

    def score_etf(
        self,
        returns: dict,
        volatility: float,
        sharpe: float,
        expense_ratio: float = 0.5,
        volume_score: float = 0.5
    ) -> float:
        """
        ETF 점수 계산

        가중치:
        - 수익률: 40%
        - 샤프비율: 25%
        - 변동성(낮을수록 좋음): 15%
        - 비용(낮을수록 좋음): 10%
        - 거래량: 10%
        """
        # 수익률 점수 (1개월, 3개월, 6개월 가중평균)
        return_score = 0
        weights = {"1m": 0.3, "3m": 0.4, "6m": 0.3}

        for period, weight in weights.items():
            ret = returns.get(period, 0) or 0
            return_score += min(max(ret / 10, -1), 1) * weight  # -10~10% -> -1~1

        return_score = (return_score + 1) / 2 * 100  # 0~100 정규화

        # 샤프비율 점수
        sharpe_score = min(max(sharpe, 0), 3) / 3 * 100

        # 변동성 점수 (낮을수록 좋음)
        vol_score = max(0, 100 - volatility * 2)

        # 비용 점수 (낮을수록 좋음)
        cost_score = max(0, 100 - expense_ratio * 50)

        # 거래량 점수
        vol_trade_score = volume_score * 100

        # 종합 점수
        total = (
            return_score * 0.40 +
            sharpe_score * 0.25 +
            vol_score * 0.15 +
            cost_score * 0.10 +
            vol_trade_score * 0.10
        )

        return round(total, 1)

    def recommend_korea_etfs(
        self,
        category: Optional[str] = None,
        top_n: int = 5,
        min_volume: int = 100000
    ) -> pd.DataFrame:
        """
        국내 ETF 추천

        Args:
            category: 카테고리 필터 (반도체, 2차전지, 바이오 등)
            top_n: 추천 개수
            min_volume: 최소 거래량

        Returns:
            추천 ETF DataFrame
        """
        if category:
            etf_list = self.korea_collector.get_sector_etfs(category)
        else:
            etf_list = self.korea_collector.get_etf_list()

        results = []

        for _, row in etf_list.iterrows():
            ticker = row["ticker"]

            try:
                prices = self.korea_collector.get_etf_price(ticker, days=180)
                if prices.empty:
                    continue

                info = self.korea_collector.get_etf_info(ticker)
                metrics = self.metrics.get_comprehensive_metrics(prices["close"])

                expense = info.get("expense_ratio", 0.5)
                avg_volume = prices["volume"].mean()
                volume_score = min(avg_volume / 1000000, 1)

                score = self.score_etf(
                    metrics["returns"],
                    metrics["volatility"],
                    metrics["sharpe_ratio"],
                    expense,
                    volume_score
                )

                results.append({
                    "ticker": ticker,
                    "name": row.get("name", info.get("name", "")),
                    "score": score,
                    "current_price": metrics["current_price"],
                    "return_1m": metrics["returns"].get("1m"),
                    "return_3m": metrics["returns"].get("3m"),
                    "volatility": metrics["volatility"],
                    "sharpe_ratio": metrics["sharpe_ratio"],
                    "expense_ratio": expense,
                    "avg_volume": int(avg_volume)
                })
            except Exception as e:
                continue

        df = pd.DataFrame(results)
        if df.empty:
            return df

        return df.nlargest(top_n, "score")

    def recommend_us_etfs(
        self,
        category: Optional[str] = None,
        top_n: int = 5
    ) -> pd.DataFrame:
        """
        해외(미국) ETF 추천

        Args:
            category: 카테고리 (index, sector_tech, bond 등)
            top_n: 추천 개수

        Returns:
            추천 ETF DataFrame
        """
        etf_list = self.us_collector.get_etf_list(category)
        results = []

        for _, row in etf_list.iterrows():
            ticker = row["ticker"]

            try:
                prices = self.us_collector.get_etf_price(ticker, period="6mo")
                if prices.empty:
                    continue

                info = self.us_collector.get_etf_info(ticker)
                metrics = self.metrics.get_comprehensive_metrics(prices["close"])

                expense = info.get("expense_ratio", 0.5)
                avg_volume = prices["volume"].mean()
                volume_score = min(avg_volume / 10000000, 1)

                score = self.score_etf(
                    metrics["returns"],
                    metrics["volatility"],
                    metrics["sharpe_ratio"],
                    expense,
                    volume_score
                )

                results.append({
                    "ticker": ticker,
                    "name": info.get("name", row.get("name", ticker)),
                    "category": info.get("category", row.get("category", "")),
                    "score": score,
                    "current_price": metrics["current_price"],
                    "return_1m": metrics["returns"].get("1m"),
                    "return_3m": metrics["returns"].get("3m"),
                    "volatility": metrics["volatility"],
                    "sharpe_ratio": metrics["sharpe_ratio"],
                    "dividend_yield": info.get("dividend_yield", 0),
                    "expense_ratio": expense,
                })
            except Exception as e:
                continue

        df = pd.DataFrame(results)
        if df.empty:
            return df

        return df.nlargest(top_n, "score")

    def recommend_by_profile(
        self,
        risk_tolerance: str = "moderate",
        investment_horizon: str = "medium",
        preference: List[str] = None
    ) -> dict:
        """
        투자 성향별 ETF 추천

        Args:
            risk_tolerance: 위험 선호도 (conservative, moderate, aggressive)
            investment_horizon: 투자 기간 (short, medium, long)
            preference: 선호 섹터 리스트

        Returns:
            추천 포트폴리오 딕셔너리
        """
        portfolio = {
            "conservative": {
                "korea": ["069500"],  # KODEX 200
                "us": ["BND", "AGG", "VTI"],
                "allocation": {"주식": 40, "채권": 50, "기타": 10}
            },
            "moderate": {
                "korea": ["069500", "091160"],
                "us": ["SPY", "QQQ", "BND"],
                "allocation": {"주식": 60, "채권": 30, "기타": 10}
            },
            "aggressive": {
                "korea": ["122630", "091160", "278530"],
                "us": ["QQQ", "SOXX", "ARKK"],
                "allocation": {"주식": 85, "채권": 5, "기타": 10}
            }
        }

        base = portfolio.get(risk_tolerance, portfolio["moderate"])

        # 선호 섹터 반영
        if preference:
            sector_etfs = {
                "반도체": {"korea": "091160", "us": "SOXX"},
                "2차전지": {"korea": "278530", "us": "LIT"},
                "바이오": {"korea": "364980", "us": "XBI"},
                "금융": {"korea": "091170", "us": "XLF"},
                "기술": {"korea": "139260", "us": "XLK"},
            }

            for pref in preference:
                if pref in sector_etfs:
                    base["korea"].append(sector_etfs[pref]["korea"])
                    base["us"].append(sector_etfs[pref]["us"])

        # 중복 제거
        base["korea"] = list(set(base["korea"]))
        base["us"] = list(set(base["us"]))

        return base

    def get_similar_etfs(self, ticker: str, market: str = "korea", n: int = 5) -> pd.DataFrame:
        """
        유사 ETF 찾기

        Args:
            ticker: 기준 ETF 티커
            market: 시장 구분
            n: 반환 개수

        Returns:
            유사 ETF DataFrame
        """
        if market == "korea":
            etf_list = self.korea_collector.get_etf_list()
            get_price = self.korea_collector.get_etf_price
        else:
            etf_list = self.us_collector.get_etf_list()
            get_price = lambda t: self.us_collector.get_etf_price(t, "6mo")

        # 기준 ETF 수익률 계산
        base_prices = get_price(ticker)
        if base_prices.empty:
            return pd.DataFrame()

        base_returns = base_prices["close"].pct_change().dropna()

        similarities = []

        for _, row in etf_list.iterrows():
            comp_ticker = row["ticker"]
            if comp_ticker == ticker:
                continue

            try:
                comp_prices = get_price(comp_ticker)
                if comp_prices.empty:
                    continue

                comp_returns = comp_prices["close"].pct_change().dropna()

                # 상관관계 계산
                min_len = min(len(base_returns), len(comp_returns))
                if min_len < 20:
                    continue

                corr = np.corrcoef(
                    base_returns.tail(min_len).values,
                    comp_returns.tail(min_len).values
                )[0, 1]

                similarities.append({
                    "ticker": comp_ticker,
                    "name": row.get("name", ""),
                    "correlation": round(corr, 3)
                })
            except Exception:
                continue

        df = pd.DataFrame(similarities)
        if df.empty:
            return df

        return df.nlargest(n, "correlation")

    def generate_report(self, ticker: str, market: str = "korea") -> str:
        """
        ETF 분석 리포트 생성

        Args:
            ticker: ETF 티커
            market: 시장 구분

        Returns:
            분석 리포트 문자열
        """
        if market == "korea":
            collector = self.korea_collector
            prices = collector.get_etf_price(ticker, days=252)
            info = collector.get_etf_info(ticker)
        else:
            collector = self.us_collector
            prices = collector.get_etf_price(ticker, period="1y")
            info = collector.get_etf_info(ticker)

        if prices.empty:
            return "데이터를 불러올 수 없습니다."

        metrics = self.metrics.get_comprehensive_metrics(prices["close"])

        report = f"""
{'='*50}
ETF 분석 리포트: {info.get('name', ticker)} ({ticker})
{'='*50}

[기본 정보]
- 현재가: {metrics['current_price']:,.0f}
- 운용보수: {info.get('expense_ratio', 'N/A')}%

[수익률]
- 1개월: {metrics['returns'].get('1m', 'N/A')}%
- 3개월: {metrics['returns'].get('3m', 'N/A')}%
- 6개월: {metrics['returns'].get('6m', 'N/A')}%
- 1년: {metrics['returns'].get('1y', 'N/A')}%

[위험 지표]
- 변동성: {metrics['volatility']}%
- 샤프비율: {metrics['sharpe_ratio']}
- 소르티노비율: {metrics['sortino_ratio']}
- 최대낙폭(MDD): {metrics['max_drawdown']}%
- MDD 기간: {metrics['mdd_period']}

[기술적 지표]
- RSI(14): {metrics['rsi']}

{'='*50}
"""
        return report
