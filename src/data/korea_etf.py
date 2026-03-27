"""국내 ETF 데이터 수집 모듈"""
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
try:
    from pykrx import stock
except ImportError:
    stock = None


class KoreaETFCollector:
    """국내 ETF 데이터를 수집하는 클래스"""

    SECTOR_MAP = {
        "반도체": ["삼성전자", "SK하이닉스", "반도체"],
        "2차전지": ["2차전지", "배터리", "에코프로"],
        "바이오": ["바이오", "헬스케어", "제약"],
        "금융": ["금융", "은행", "보험"],
        "자동차": ["자동차", "현대차", "기아"],
    }

    def __init__(self):
        self.today = datetime.now().strftime("%Y%m%d")
        self.start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

    def get_etf_list(self) -> pd.DataFrame:
        """전체 ETF 목록 조회"""
        if stock is None:
            return self._get_sample_etf_list()

        try:
            tickers = stock.get_etf_ticker_list(self.today)
            etf_list = []

            for ticker in tickers[:50]:  # 상위 50개만 조회 (성능)
                try:
                    name = stock.get_etf_ticker_name(ticker)
                    etf_list.append({
                        "ticker": ticker,
                        "name": name,
                        "market": "KRX"
                    })
                except Exception:
                    continue

            return pd.DataFrame(etf_list)
        except Exception as e:
            print(f"ETF 목록 조회 실패: {e}")
            return self._get_sample_etf_list()

    def _get_sample_etf_list(self) -> pd.DataFrame:
        """샘플 ETF 목록 반환"""
        sample_data = [
            {"ticker": "069500", "name": "KODEX 200", "market": "KRX"},
            {"ticker": "114800", "name": "KODEX 인버스", "market": "KRX"},
            {"ticker": "122630", "name": "KODEX 레버리지", "market": "KRX"},
            {"ticker": "252670", "name": "KODEX 200선물인버스2X", "market": "KRX"},
            {"ticker": "091160", "name": "KODEX 반도체", "market": "KRX"},
            {"ticker": "091170", "name": "KODEX 은행", "market": "KRX"},
            {"ticker": "117680", "name": "KODEX 철강", "market": "KRX"},
            {"ticker": "102110", "name": "TIGER 200", "market": "KRX"},
            {"ticker": "278530", "name": "KODEX 2차전지산업", "market": "KRX"},
            {"ticker": "364980", "name": "KODEX Fn K-바이오", "market": "KRX"},
            {"ticker": "139260", "name": "TIGER 200 IT", "market": "KRX"},
            {"ticker": "157490", "name": "TIGER 소프트웨어", "market": "KRX"},
            {"ticker": "305720", "name": "KODEX 2차전지산업레버리지", "market": "KRX"},
            {"ticker": "371460", "name": "TIGER 차이나전기차SOLACTIVE", "market": "KRX"},
            {"ticker": "411060", "name": "ACE 미국빅테크TOP7 Plus", "market": "KRX"},
        ]
        return pd.DataFrame(sample_data)

    def get_etf_price(self, ticker: str, days: int = 30) -> pd.DataFrame:
        """ETF 가격 데이터 조회"""
        if stock is None:
            return self._get_sample_price_data(ticker, days)

        try:
            start = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
            df = stock.get_etf_ohlcv_by_date(start, self.today, ticker)
            df = df.reset_index()
            df.columns = ["date", "open", "high", "low", "close", "volume", "value"]
            return df
        except Exception as e:
            print(f"가격 데이터 조회 실패: {e}")
            return self._get_sample_price_data(ticker, days)

    def _get_sample_price_data(self, ticker: str, days: int) -> pd.DataFrame:
        """샘플 가격 데이터 생성"""
        import numpy as np

        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
        base_price = 50000
        prices = base_price + np.cumsum(np.random.randn(days) * 500)

        return pd.DataFrame({
            "date": dates,
            "open": prices * 0.99,
            "high": prices * 1.02,
            "low": prices * 0.98,
            "close": prices,
            "volume": np.random.randint(100000, 1000000, days)
        })

    def get_etf_info(self, ticker: str) -> dict:
        """ETF 상세 정보 조회"""
        if stock is None:
            return self._get_sample_etf_info(ticker)

        try:
            pdf = stock.get_etf_portfolio_deposit_file(ticker, self.today)
            name = stock.get_etf_ticker_name(ticker)

            return {
                "ticker": ticker,
                "name": name,
                "nav": pdf.get("NAV", 0),
                "aum": pdf.get("순자산", 0),
            }
        except Exception:
            return self._get_sample_etf_info(ticker)

    def _get_sample_etf_info(self, ticker: str) -> dict:
        """샘플 ETF 정보 반환"""
        sample_info = {
            "069500": {"name": "KODEX 200", "nav": 35000, "aum": 5000000000000, "expense_ratio": 0.15},
            "122630": {"name": "KODEX 레버리지", "nav": 18000, "aum": 3000000000000, "expense_ratio": 0.64},
            "091160": {"name": "KODEX 반도체", "nav": 15000, "aum": 800000000000, "expense_ratio": 0.45},
            "278530": {"name": "KODEX 2차전지산업", "nav": 12000, "aum": 600000000000, "expense_ratio": 0.45},
        }

        return {
            "ticker": ticker,
            **sample_info.get(ticker, {"name": "Unknown ETF", "nav": 10000, "aum": 100000000000, "expense_ratio": 0.5})
        }

    def get_sector_etfs(self, sector: str) -> pd.DataFrame:
        """섹터별 ETF 목록 조회"""
        etf_list = self.get_etf_list()
        keywords = self.SECTOR_MAP.get(sector, [sector])

        mask = etf_list["name"].apply(
            lambda x: any(kw in x for kw in keywords)
        )
        return etf_list[mask]

    def get_top_etfs_by_volume(self, n: int = 10) -> pd.DataFrame:
        """거래량 상위 ETF 조회"""
        if stock is None:
            return self._get_sample_etf_list().head(n)

        try:
            tickers = stock.get_etf_ticker_list(self.today)
            etf_data = []

            for ticker in tickers[:30]:
                try:
                    ohlcv = stock.get_etf_ohlcv_by_date(self.today, self.today, ticker)
                    if not ohlcv.empty:
                        name = stock.get_etf_ticker_name(ticker)
                        etf_data.append({
                            "ticker": ticker,
                            "name": name,
                            "volume": ohlcv.iloc[-1]["거래량"],
                            "close": ohlcv.iloc[-1]["종가"]
                        })
                except Exception:
                    continue

            df = pd.DataFrame(etf_data)
            return df.nlargest(n, "volume")
        except Exception:
            return self._get_sample_etf_list().head(n)
