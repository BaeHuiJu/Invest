"""ETF 지표 계산 모듈"""
import pandas as pd
import numpy as np
from typing import Optional, Tuple


class ETFMetrics:
    """ETF 분석 지표를 계산하는 클래스"""

    @staticmethod
    def calculate_returns(prices: pd.Series, periods: dict = None) -> dict:
        """
        기간별 수익률 계산

        Args:
            prices: 종가 시계열
            periods: 기간 딕셔너리 (기본: 1일, 1주, 1개월, 3개월, 6개월, 1년)

        Returns:
            기간별 수익률 딕셔너리
        """
        if periods is None:
            periods = {
                "1d": 1,
                "1w": 5,
                "1m": 21,
                "3m": 63,
                "6m": 126,
                "1y": 252
            }

        current = prices.iloc[-1]
        returns = {}

        for name, days in periods.items():
            if len(prices) > days:
                past = prices.iloc[-(days + 1)]
                returns[name] = round((current - past) / past * 100, 2)
            else:
                returns[name] = None

        return returns

    @staticmethod
    def calculate_volatility(prices: pd.Series, window: int = 21) -> float:
        """
        변동성(표준편차) 계산

        Args:
            prices: 종가 시계열
            window: 계산 기간 (기본 21일)

        Returns:
            연환산 변동성 (%)
        """
        returns = prices.pct_change().dropna()
        daily_vol = returns.tail(window).std()
        annual_vol = daily_vol * np.sqrt(252)
        return round(annual_vol * 100, 2)

    @staticmethod
    def calculate_sharpe_ratio(
        prices: pd.Series,
        risk_free_rate: float = 0.03,
        periods: int = 252
    ) -> float:
        """
        샤프 비율 계산

        Args:
            prices: 종가 시계열
            risk_free_rate: 무위험 수익률 (기본 3%)
            periods: 연환산 기간

        Returns:
            샤프 비율
        """
        returns = prices.pct_change().dropna()

        if len(returns) < 2:
            return 0.0

        excess_return = returns.mean() * periods - risk_free_rate
        volatility = returns.std() * np.sqrt(periods)

        if volatility == 0:
            return 0.0

        return round(excess_return / volatility, 2)

    @staticmethod
    def calculate_max_drawdown(prices: pd.Series) -> Tuple[float, str, str]:
        """
        최대 낙폭(MDD) 계산

        Args:
            prices: 종가 시계열

        Returns:
            (MDD 비율, 시작일, 종료일)
        """
        cummax = prices.cummax()
        drawdown = (prices - cummax) / cummax

        mdd = drawdown.min()
        end_idx = drawdown.idxmin()
        start_idx = prices[:end_idx].idxmax()

        return (
            round(mdd * 100, 2),
            str(start_idx)[:10] if pd.notna(start_idx) else "",
            str(end_idx)[:10] if pd.notna(end_idx) else ""
        )

    @staticmethod
    def calculate_beta(
        etf_prices: pd.Series,
        benchmark_prices: pd.Series
    ) -> float:
        """
        베타 계산

        Args:
            etf_prices: ETF 종가 시계열
            benchmark_prices: 벤치마크 종가 시계열

        Returns:
            베타 값
        """
        etf_returns = etf_prices.pct_change().dropna()
        bench_returns = benchmark_prices.pct_change().dropna()

        # 길이 맞추기
        min_len = min(len(etf_returns), len(bench_returns))
        etf_returns = etf_returns.tail(min_len)
        bench_returns = bench_returns.tail(min_len)

        covariance = np.cov(etf_returns, bench_returns)[0][1]
        variance = np.var(bench_returns)

        if variance == 0:
            return 1.0

        return round(covariance / variance, 2)

    @staticmethod
    def calculate_tracking_error(
        etf_prices: pd.Series,
        benchmark_prices: pd.Series
    ) -> float:
        """
        추적 오차 계산

        Args:
            etf_prices: ETF 종가 시계열
            benchmark_prices: 벤치마크 종가 시계열

        Returns:
            추적 오차 (%)
        """
        etf_returns = etf_prices.pct_change().dropna()
        bench_returns = benchmark_prices.pct_change().dropna()

        min_len = min(len(etf_returns), len(bench_returns))
        diff = etf_returns.tail(min_len).values - bench_returns.tail(min_len).values

        tracking_error = np.std(diff) * np.sqrt(252)
        return round(tracking_error * 100, 2)

    @staticmethod
    def calculate_sortino_ratio(
        prices: pd.Series,
        risk_free_rate: float = 0.03,
        periods: int = 252
    ) -> float:
        """
        소르티노 비율 계산 (하방 변동성만 고려)

        Args:
            prices: 종가 시계열
            risk_free_rate: 무위험 수익률
            periods: 연환산 기간

        Returns:
            소르티노 비율
        """
        returns = prices.pct_change().dropna()
        excess_return = returns.mean() * periods - risk_free_rate

        # 하방 변동성만 계산
        negative_returns = returns[returns < 0]
        downside_vol = negative_returns.std() * np.sqrt(periods)

        if downside_vol == 0:
            return 0.0

        return round(excess_return / downside_vol, 2)

    @staticmethod
    def calculate_moving_averages(
        prices: pd.Series,
        windows: list = None
    ) -> pd.DataFrame:
        """
        이동평균선 계산

        Args:
            prices: 종가 시계열
            windows: 이동평균 기간 리스트

        Returns:
            이동평균선 DataFrame
        """
        if windows is None:
            windows = [5, 20, 60, 120]

        ma_df = pd.DataFrame({"close": prices})

        for window in windows:
            ma_df[f"ma{window}"] = prices.rolling(window=window).mean()

        return ma_df

    @staticmethod
    def calculate_rsi(prices: pd.Series, period: int = 14) -> float:
        """
        RSI(상대강도지수) 계산

        Args:
            prices: 종가 시계열
            period: RSI 기간 (기본 14일)

        Returns:
            RSI 값 (0-100)
        """
        delta = prices.diff()

        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))

        return round(rsi.iloc[-1], 2) if not pd.isna(rsi.iloc[-1]) else 50.0

    @staticmethod
    def get_comprehensive_metrics(prices: pd.Series) -> dict:
        """
        종합 지표 계산

        Args:
            prices: 종가 시계열

        Returns:
            모든 지표를 포함한 딕셔너리
        """
        metrics = ETFMetrics()

        returns = metrics.calculate_returns(prices)
        mdd, mdd_start, mdd_end = metrics.calculate_max_drawdown(prices)

        return {
            "current_price": round(prices.iloc[-1], 2),
            "returns": returns,
            "volatility": metrics.calculate_volatility(prices),
            "sharpe_ratio": metrics.calculate_sharpe_ratio(prices),
            "sortino_ratio": metrics.calculate_sortino_ratio(prices),
            "max_drawdown": mdd,
            "mdd_period": f"{mdd_start} ~ {mdd_end}",
            "rsi": metrics.calculate_rsi(prices),
        }
