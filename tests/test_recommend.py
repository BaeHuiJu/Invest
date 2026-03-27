"""ETF 추천 시스템 테스트"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.data.korea_etf import KoreaETFCollector
from src.data.us_etf import USETFCollector
from src.data.analyst import AnalystReportCollector
from src.analysis.metrics import ETFMetrics
from src.analysis.recommend import ETFRecommender


class TestKoreaETFCollector:
    """국내 ETF 수집기 테스트"""

    def setup_method(self):
        self.collector = KoreaETFCollector()

    def test_get_etf_list(self):
        """ETF 목록 조회 테스트"""
        etf_list = self.collector.get_etf_list()
        assert not etf_list.empty
        assert "ticker" in etf_list.columns
        assert "name" in etf_list.columns

    def test_get_etf_price(self):
        """ETF 가격 조회 테스트"""
        prices = self.collector.get_etf_price("069500", days=30)
        assert not prices.empty
        assert "close" in prices.columns
        assert len(prices) > 0

    def test_get_sector_etfs(self):
        """섹터별 ETF 조회 테스트"""
        sector_etfs = self.collector.get_sector_etfs("반도체")
        # 샘플 데이터에서 반도체 관련 ETF가 있어야 함
        assert isinstance(sector_etfs, type(self.collector.get_etf_list()))


class TestUSETFCollector:
    """미국 ETF 수집기 테스트"""

    def setup_method(self):
        self.collector = USETFCollector()

    def test_get_etf_list(self):
        """ETF 목록 조회 테스트"""
        etf_list = self.collector.get_etf_list()
        assert not etf_list.empty
        assert "ticker" in etf_list.columns

    def test_get_etf_price(self):
        """ETF 가격 조회 테스트"""
        prices = self.collector.get_etf_price("SPY")
        assert not prices.empty
        assert "close" in prices.columns

    def test_get_etf_info(self):
        """ETF 정보 조회 테스트"""
        info = self.collector.get_etf_info("SPY")
        assert "ticker" in info
        assert "name" in info

    def test_get_etfs_by_category(self):
        """카테고리별 ETF 조회 테스트"""
        tech_etfs = self.collector.get_etfs_by_category("sector_tech")
        assert not tech_etfs.empty


class TestAnalystReportCollector:
    """애널리스트 리포트 수집기 테스트"""

    def setup_method(self):
        self.collector = AnalystReportCollector()

    def test_get_recent_buy_recommendations(self):
        """최근 매수 추천 조회 테스트"""
        reports = self.collector.get_recent_buy_recommendations(days=5)
        assert not reports.empty
        assert "ticker" in reports.columns
        assert "name" in reports.columns
        assert "upside" in reports.columns

    def test_filter_by_market(self):
        """시장별 필터링 테스트"""
        korea_reports = self.collector.get_recent_buy_recommendations(
            days=5, market="korea"
        )
        assert all(korea_reports["market"] == "korea")

        us_reports = self.collector.get_recent_buy_recommendations(
            days=5, market="us"
        )
        assert all(us_reports["market"] == "us")

    def test_filter_by_opinion(self):
        """투자의견 필터링 테스트"""
        strong_buy = self.collector.get_recent_buy_recommendations(
            days=5, opinion_filter=["strong_buy"]
        )
        assert all(strong_buy["opinion_type"] == "strong_buy")

    def test_get_top_picks(self):
        """상승여력 상위 종목 조회 테스트"""
        top_picks = self.collector.get_top_picks(n=5)
        assert len(top_picks) <= 5
        # 상승여력 기준 내림차순 정렬 확인
        assert top_picks["upside"].is_monotonic_decreasing


class TestETFMetrics:
    """ETF 지표 계산 테스트"""

    def setup_method(self):
        self.metrics = ETFMetrics()
        # 테스트용 가격 데이터 생성
        import pandas as pd
        import numpy as np

        np.random.seed(42)
        dates = pd.date_range(end="2024-01-01", periods=252, freq="D")
        prices = 100 + np.cumsum(np.random.randn(252) * 1)
        self.prices = pd.Series(prices, index=dates)

    def test_calculate_returns(self):
        """수익률 계산 테스트"""
        returns = self.metrics.calculate_returns(self.prices)
        assert "1m" in returns
        assert "3m" in returns
        assert "1y" in returns

    def test_calculate_volatility(self):
        """변동성 계산 테스트"""
        vol = self.metrics.calculate_volatility(self.prices)
        assert vol >= 0
        assert vol < 100  # 합리적인 범위

    def test_calculate_sharpe_ratio(self):
        """샤프비율 계산 테스트"""
        sharpe = self.metrics.calculate_sharpe_ratio(self.prices)
        assert isinstance(sharpe, float)

    def test_calculate_max_drawdown(self):
        """최대낙폭 계산 테스트"""
        mdd, start, end = self.metrics.calculate_max_drawdown(self.prices)
        assert mdd <= 0  # MDD는 음수 또는 0
        assert mdd >= -100

    def test_calculate_rsi(self):
        """RSI 계산 테스트"""
        rsi = self.metrics.calculate_rsi(self.prices)
        assert 0 <= rsi <= 100


class TestETFRecommender:
    """ETF 추천 시스템 테스트"""

    def setup_method(self):
        self.recommender = ETFRecommender()

    def test_score_etf(self):
        """ETF 점수 계산 테스트"""
        returns = {"1m": 5.0, "3m": 10.0, "6m": 15.0}
        score = self.recommender.score_etf(
            returns, volatility=15.0, sharpe=1.5
        )
        assert 0 <= score <= 100

    def test_recommend_korea_etfs(self):
        """국내 ETF 추천 테스트"""
        recommendations = self.recommender.recommend_korea_etfs(top_n=5)
        assert len(recommendations) <= 5
        if not recommendations.empty:
            assert "score" in recommendations.columns

    def test_recommend_us_etfs(self):
        """해외 ETF 추천 테스트"""
        recommendations = self.recommender.recommend_us_etfs(top_n=5)
        assert len(recommendations) <= 5
        if not recommendations.empty:
            assert "score" in recommendations.columns

    def test_recommend_by_profile(self):
        """투자 성향별 추천 테스트"""
        conservative = self.recommender.recommend_by_profile("conservative")
        assert "korea" in conservative
        assert "us" in conservative
        assert "allocation" in conservative

        aggressive = self.recommender.recommend_by_profile("aggressive")
        # 공격적 포트폴리오는 주식 비중이 높아야 함
        assert aggressive["allocation"]["주식"] > conservative["allocation"]["주식"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
