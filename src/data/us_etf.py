"""해외 ETF 데이터 수집 모듈"""
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
try:
    import yfinance as yf
except ImportError:
    yf = None


class USETFCollector:
    """미국 ETF 데이터를 수집하는 클래스"""

    # 주요 ETF 카테고리
    ETF_CATEGORIES = {
        "index": {
            "name": "지수추종",
            "etfs": ["SPY", "QQQ", "DIA", "IWM", "VTI"]
        },
        "sector_tech": {
            "name": "기술",
            "etfs": ["XLK", "VGT", "SOXX", "SMH", "ARKK"]
        },
        "sector_healthcare": {
            "name": "헬스케어",
            "etfs": ["XLV", "VHT", "IBB", "XBI"]
        },
        "sector_finance": {
            "name": "금융",
            "etfs": ["XLF", "VFH", "KBE", "KRE"]
        },
        "sector_energy": {
            "name": "에너지",
            "etfs": ["XLE", "VDE", "OIH", "XOP"]
        },
        "bond": {
            "name": "채권",
            "etfs": ["BND", "AGG", "TLT", "IEF", "SHY"]
        },
        "commodity": {
            "name": "원자재",
            "etfs": ["GLD", "SLV", "USO", "UNG", "DBA"]
        },
        "international": {
            "name": "글로벌/신흥국",
            "etfs": ["VEA", "EFA", "VWO", "EEM", "IEMG"]
        },
        "dividend": {
            "name": "배당",
            "etfs": ["VYM", "SCHD", "DVY", "HDV", "SPHD"]
        },
        "growth": {
            "name": "성장",
            "etfs": ["VUG", "IWF", "SCHG", "MGK", "SPYG"]
        }
    }

    # 인기 ETF 목록
    POPULAR_ETFS = [
        {"ticker": "SPY", "name": "SPDR S&P 500 ETF", "category": "지수추종"},
        {"ticker": "QQQ", "name": "Invesco QQQ Trust", "category": "기술"},
        {"ticker": "VTI", "name": "Vanguard Total Stock Market", "category": "지수추종"},
        {"ticker": "VOO", "name": "Vanguard S&P 500", "category": "지수추종"},
        {"ticker": "IWM", "name": "iShares Russell 2000", "category": "지수추종"},
        {"ticker": "DIA", "name": "SPDR Dow Jones Industrial", "category": "지수추종"},
        {"ticker": "XLK", "name": "Technology Select Sector SPDR", "category": "기술"},
        {"ticker": "SOXX", "name": "iShares Semiconductor", "category": "반도체"},
        {"ticker": "SMH", "name": "VanEck Semiconductor", "category": "반도체"},
        {"ticker": "ARKK", "name": "ARK Innovation ETF", "category": "혁신"},
        {"ticker": "XLF", "name": "Financial Select Sector SPDR", "category": "금융"},
        {"ticker": "XLV", "name": "Health Care Select Sector SPDR", "category": "헬스케어"},
        {"ticker": "XLE", "name": "Energy Select Sector SPDR", "category": "에너지"},
        {"ticker": "GLD", "name": "SPDR Gold Shares", "category": "금"},
        {"ticker": "TLT", "name": "iShares 20+ Year Treasury Bond", "category": "채권"},
        {"ticker": "VWO", "name": "Vanguard FTSE Emerging Markets", "category": "신흥국"},
        {"ticker": "EEM", "name": "iShares MSCI Emerging Markets", "category": "신흥국"},
        {"ticker": "SCHD", "name": "Schwab US Dividend Equity", "category": "배당"},
        {"ticker": "VYM", "name": "Vanguard High Dividend Yield", "category": "배당"},
        {"ticker": "NVDA", "name": "NVIDIA Corporation", "category": "반도체"},
    ]

    def __init__(self):
        self.today = datetime.now()

    def get_etf_list(self, category: Optional[str] = None) -> pd.DataFrame:
        """ETF 목록 조회"""
        if category and category in self.ETF_CATEGORIES:
            tickers = self.ETF_CATEGORIES[category]["etfs"]
            return pd.DataFrame([
                {"ticker": t, "category": self.ETF_CATEGORIES[category]["name"]}
                for t in tickers
            ])

        return pd.DataFrame(self.POPULAR_ETFS)

    def get_etf_price(self, ticker: str, period: str = "1mo") -> pd.DataFrame:
        """ETF 가격 데이터 조회"""
        if yf is None:
            return self._get_sample_price_data(ticker, 30)

        try:
            etf = yf.Ticker(ticker)
            df = etf.history(period=period)
            df = df.reset_index()
            df.columns = [c.lower() for c in df.columns]
            return df[["date", "open", "high", "low", "close", "volume"]]
        except Exception as e:
            print(f"가격 데이터 조회 실패: {e}")
            return self._get_sample_price_data(ticker, 30)

    def _get_sample_price_data(self, ticker: str, days: int) -> pd.DataFrame:
        """샘플 가격 데이터 생성"""
        import numpy as np

        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')

        base_prices = {
            "SPY": 500, "QQQ": 450, "DIA": 400, "IWM": 200,
            "XLK": 200, "SOXX": 250, "GLD": 190, "TLT": 95
        }
        base = base_prices.get(ticker, 100)
        prices = base + np.cumsum(np.random.randn(days) * 2)

        return pd.DataFrame({
            "date": dates,
            "open": prices * 0.99,
            "high": prices * 1.01,
            "low": prices * 0.98,
            "close": prices,
            "volume": np.random.randint(1000000, 50000000, days)
        })

    def get_etf_info(self, ticker: str) -> dict:
        """ETF 상세 정보 조회"""
        if yf is None:
            return self._get_sample_etf_info(ticker)

        try:
            etf = yf.Ticker(ticker)
            info = etf.info

            return {
                "ticker": ticker,
                "name": info.get("longName", info.get("shortName", ticker)),
                "category": info.get("category", "N/A"),
                "expense_ratio": info.get("annualReportExpenseRatio", 0) * 100 if info.get("annualReportExpenseRatio") else None,
                "aum": info.get("totalAssets", 0),
                "52w_high": info.get("fiftyTwoWeekHigh", 0),
                "52w_low": info.get("fiftyTwoWeekLow", 0),
                "dividend_yield": info.get("yield", 0) * 100 if info.get("yield") else 0,
                "beta": info.get("beta3Year", 1.0),
                "pe_ratio": info.get("trailingPE", None),
            }
        except Exception as e:
            print(f"ETF 정보 조회 실패: {e}")
            return self._get_sample_etf_info(ticker)

    def _get_sample_etf_info(self, ticker: str) -> dict:
        """샘플 ETF 정보 반환"""
        sample_data = {
            "SPY": {
                "name": "SPDR S&P 500 ETF Trust",
                "category": "Large Blend",
                "expense_ratio": 0.09,
                "aum": 500000000000,
                "dividend_yield": 1.3,
                "beta": 1.0
            },
            "QQQ": {
                "name": "Invesco QQQ Trust",
                "category": "Large Growth",
                "expense_ratio": 0.20,
                "aum": 250000000000,
                "dividend_yield": 0.5,
                "beta": 1.1
            },
            "SOXX": {
                "name": "iShares Semiconductor ETF",
                "category": "Technology",
                "expense_ratio": 0.35,
                "aum": 10000000000,
                "dividend_yield": 0.7,
                "beta": 1.4
            },
        }

        return {
            "ticker": ticker,
            **sample_data.get(ticker, {
                "name": f"{ticker} ETF",
                "category": "Unknown",
                "expense_ratio": 0.5,
                "aum": 1000000000,
                "dividend_yield": 1.0,
                "beta": 1.0
            })
        }

    def get_etfs_by_category(self, category: str) -> pd.DataFrame:
        """카테고리별 ETF 목록"""
        if category in self.ETF_CATEGORIES:
            tickers = self.ETF_CATEGORIES[category]["etfs"]
            results = []

            for ticker in tickers:
                info = self.get_etf_info(ticker)
                results.append(info)

            return pd.DataFrame(results)

        return pd.DataFrame()

    def get_etf_returns(self, ticker: str) -> dict:
        """ETF 수익률 계산"""
        df = self.get_etf_price(ticker, period="1y")

        if df.empty:
            return {}

        current = df["close"].iloc[-1]

        returns = {"ticker": ticker, "current_price": current}

        # 기간별 수익률 계산
        periods = {"1d": 1, "1w": 5, "1m": 21, "3m": 63, "6m": 126, "1y": 252}

        for name, days in periods.items():
            if len(df) > days:
                past_price = df["close"].iloc[-(days + 1)]
                returns[f"return_{name}"] = round((current - past_price) / past_price * 100, 2)
            else:
                returns[f"return_{name}"] = None

        return returns

    def compare_etfs(self, tickers: list) -> pd.DataFrame:
        """여러 ETF 비교"""
        results = []

        for ticker in tickers:
            info = self.get_etf_info(ticker)
            returns = self.get_etf_returns(ticker)
            combined = {**info, **returns}
            results.append(combined)

        return pd.DataFrame(results)
