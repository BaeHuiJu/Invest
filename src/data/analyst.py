"""애널리스트 리포트 수집 모듈"""
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List
import requests
from bs4 import BeautifulSoup
import json


class AnalystReportCollector:
    """애널리스트 매수 추천 리포트를 수집하는 클래스"""

    OPINION_TYPES = {
        "strong_buy": "적극매수",
        "buy": "매수",
        "trading_buy": "Trading Buy",
        "hold": "보유",
        "sell": "매도"
    }

    def __init__(self):
        self.today = datetime.now()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

    def get_recent_buy_recommendations(
        self,
        days: int = 5,
        market: str = "all",
        opinion_filter: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        최근 매수 추천 종목 조회

        Args:
            days: 조회 기간 (기본 5일)
            market: 시장 구분 (all, korea, us)
            opinion_filter: 투자의견 필터 (strong_buy, buy, trading_buy)

        Returns:
            매수 추천 종목 DataFrame
        """
        # 실제 구현에서는 네이버 증권, 한경 컨센서스 등에서 크롤링
        # 여기서는 샘플 데이터 반환
        reports = self._get_sample_reports(days, market)

        if opinion_filter:
            reports = reports[reports["opinion_type"].isin(opinion_filter)]

        return reports.sort_values("date", ascending=False)

    def _get_sample_reports(self, days: int, market: str) -> pd.DataFrame:
        """샘플 리포트 데이터 생성"""
        sample_korea = [
            {
                "date": (self.today - timedelta(days=0)).strftime("%Y-%m-%d"),
                "ticker": "005930",
                "name": "삼성전자",
                "market": "korea",
                "broker": "삼성증권",
                "analyst": "김OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 95000,
                "current_price": 78000,
                "upside": 21.8,
                "summary": "AI 반도체 수요 증가에 따른 HBM 매출 성장 기대"
            },
            {
                "date": (self.today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "ticker": "000660",
                "name": "SK하이닉스",
                "market": "korea",
                "broker": "한국투자증권",
                "analyst": "이OO",
                "opinion": "적극매수",
                "opinion_type": "strong_buy",
                "target_price": 250000,
                "current_price": 195000,
                "upside": 28.2,
                "summary": "HBM3E 양산 본격화, AI 서버 수요 급증"
            },
            {
                "date": (self.today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "ticker": "373220",
                "name": "LG에너지솔루션",
                "market": "korea",
                "broker": "KB증권",
                "analyst": "박OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 480000,
                "current_price": 380000,
                "upside": 26.3,
                "summary": "북미 IRA 수혜 지속, 신규 수주 모멘텀"
            },
            {
                "date": (self.today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "ticker": "035420",
                "name": "NAVER",
                "market": "korea",
                "broker": "미래에셋증권",
                "analyst": "최OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 250000,
                "current_price": 195000,
                "upside": 28.2,
                "summary": "AI 검색 서비스 확대, 광고 매출 회복"
            },
            {
                "date": (self.today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "ticker": "051910",
                "name": "LG화학",
                "market": "korea",
                "broker": "대신증권",
                "analyst": "정OO",
                "opinion": "Trading Buy",
                "opinion_type": "trading_buy",
                "target_price": 420000,
                "current_price": 350000,
                "upside": 20.0,
                "summary": "석유화학 업황 바닥 통과 기대"
            },
            {
                "date": (self.today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "ticker": "006400",
                "name": "삼성SDI",
                "market": "korea",
                "broker": "신한투자증권",
                "analyst": "강OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 520000,
                "current_price": 420000,
                "upside": 23.8,
                "summary": "전고체 배터리 기술 선도, 프리미엄 시장 공략"
            },
            {
                "date": (self.today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "ticker": "055550",
                "name": "신한지주",
                "market": "korea",
                "broker": "하나증권",
                "analyst": "윤OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 55000,
                "current_price": 45000,
                "upside": 22.2,
                "summary": "NIM 안정화, 배당 매력 부각"
            },
            {
                "date": (self.today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "ticker": "035720",
                "name": "카카오",
                "market": "korea",
                "broker": "NH투자증권",
                "analyst": "조OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 65000,
                "current_price": 48000,
                "upside": 35.4,
                "summary": "AI 서비스 출시, 광고 수익 다변화"
            },
            {
                "date": (self.today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "ticker": "028260",
                "name": "삼성물산",
                "market": "korea",
                "broker": "유안타증권",
                "analyst": "한OO",
                "opinion": "적극매수",
                "opinion_type": "strong_buy",
                "target_price": 180000,
                "current_price": 140000,
                "upside": 28.6,
                "summary": "지배구조 개선 기대, 자사주 매입"
            },
            {
                "date": (self.today - timedelta(days=5)).strftime("%Y-%m-%d"),
                "ticker": "207940",
                "name": "삼성바이오로직스",
                "market": "korea",
                "broker": "키움증권",
                "analyst": "송OO",
                "opinion": "매수",
                "opinion_type": "buy",
                "target_price": 950000,
                "current_price": 780000,
                "upside": 21.8,
                "summary": "바이오시밀러 파이프라인 확대"
            },
        ]

        sample_us = [
            {
                "date": (self.today - timedelta(days=0)).strftime("%Y-%m-%d"),
                "ticker": "NVDA",
                "name": "NVIDIA",
                "market": "us",
                "broker": "Goldman Sachs",
                "analyst": "Toshiya Hari",
                "opinion": "Buy",
                "opinion_type": "buy",
                "target_price": 180,
                "current_price": 140,
                "upside": 28.6,
                "summary": "Data center demand remains robust"
            },
            {
                "date": (self.today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "ticker": "AAPL",
                "name": "Apple Inc.",
                "market": "us",
                "broker": "Morgan Stanley",
                "analyst": "Erik Woodring",
                "opinion": "Overweight",
                "opinion_type": "buy",
                "target_price": 250,
                "current_price": 210,
                "upside": 19.0,
                "summary": "iPhone 16 cycle to drive growth"
            },
            {
                "date": (self.today - timedelta(days=1)).strftime("%Y-%m-%d"),
                "ticker": "MSFT",
                "name": "Microsoft",
                "market": "us",
                "broker": "JP Morgan",
                "analyst": "Mark Murphy",
                "opinion": "Buy",
                "opinion_type": "buy",
                "target_price": 500,
                "current_price": 420,
                "upside": 19.0,
                "summary": "Azure AI integration accelerating"
            },
            {
                "date": (self.today - timedelta(days=2)).strftime("%Y-%m-%d"),
                "ticker": "GOOGL",
                "name": "Alphabet Inc.",
                "market": "us",
                "broker": "Bank of America",
                "analyst": "Justin Post",
                "opinion": "Buy",
                "opinion_type": "buy",
                "target_price": 200,
                "current_price": 165,
                "upside": 21.2,
                "summary": "Search AI monetization potential"
            },
            {
                "date": (self.today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "ticker": "AMZN",
                "name": "Amazon.com",
                "market": "us",
                "broker": "Citi",
                "analyst": "Ronald Josey",
                "opinion": "Buy",
                "opinion_type": "buy",
                "target_price": 230,
                "current_price": 185,
                "upside": 24.3,
                "summary": "AWS growth reaccelerating"
            },
            {
                "date": (self.today - timedelta(days=3)).strftime("%Y-%m-%d"),
                "ticker": "META",
                "name": "Meta Platforms",
                "market": "us",
                "broker": "Barclays",
                "analyst": "Ross Sandler",
                "opinion": "Overweight",
                "opinion_type": "buy",
                "target_price": 650,
                "current_price": 520,
                "upside": 25.0,
                "summary": "Reels monetization improving"
            },
            {
                "date": (self.today - timedelta(days=4)).strftime("%Y-%m-%d"),
                "ticker": "TSM",
                "name": "Taiwan Semiconductor",
                "market": "us",
                "broker": "UBS",
                "analyst": "Sunny Lin",
                "opinion": "Buy",
                "opinion_type": "buy",
                "target_price": 200,
                "current_price": 165,
                "upside": 21.2,
                "summary": "Advanced node demand strong"
            },
            {
                "date": (self.today - timedelta(days=5)).strftime("%Y-%m-%d"),
                "ticker": "AMD",
                "name": "Advanced Micro Devices",
                "market": "us",
                "broker": "Wells Fargo",
                "analyst": "Aaron Rakers",
                "opinion": "Overweight",
                "opinion_type": "buy",
                "target_price": 200,
                "current_price": 155,
                "upside": 29.0,
                "summary": "MI300 AI chip ramp"
            },
        ]

        all_data = sample_korea + sample_us

        df = pd.DataFrame(all_data)

        # 날짜 필터링
        cutoff_date = (self.today - timedelta(days=days)).strftime("%Y-%m-%d")
        df = df[df["date"] >= cutoff_date]

        # 시장 필터링
        if market == "korea":
            df = df[df["market"] == "korea"]
        elif market == "us":
            df = df[df["market"] == "us"]

        return df

    def get_consensus(self, ticker: str) -> dict:
        """종목 컨센서스 조회"""
        # 샘플 컨센서스 데이터
        consensus_data = {
            "005930": {
                "strong_buy": 15,
                "buy": 20,
                "hold": 5,
                "sell": 0,
                "avg_target": 92000,
                "high_target": 110000,
                "low_target": 75000
            },
            "000660": {
                "strong_buy": 18,
                "buy": 12,
                "hold": 3,
                "sell": 0,
                "avg_target": 235000,
                "high_target": 280000,
                "low_target": 200000
            },
            "NVDA": {
                "strong_buy": 35,
                "buy": 10,
                "hold": 3,
                "sell": 0,
                "avg_target": 165,
                "high_target": 200,
                "low_target": 120
            }
        }

        return consensus_data.get(ticker, {
            "strong_buy": 0,
            "buy": 0,
            "hold": 0,
            "sell": 0,
            "avg_target": 0,
            "high_target": 0,
            "low_target": 0
        })

    def get_top_picks(self, n: int = 10, market: str = "all") -> pd.DataFrame:
        """상승여력 상위 종목"""
        df = self.get_recent_buy_recommendations(days=5, market=market)
        return df.nlargest(n, "upside")

    def get_reports_by_sector(self, sector: str) -> pd.DataFrame:
        """섹터별 리포트 조회"""
        sector_keywords = {
            "반도체": ["삼성전자", "SK하이닉스", "NVIDIA", "AMD", "TSM", "Semiconductor"],
            "2차전지": ["LG에너지솔루션", "삼성SDI", "LG화학"],
            "IT": ["NAVER", "카카오", "Apple", "Microsoft", "Google", "Meta"],
            "금융": ["신한지주", "KB금융", "하나금융"],
        }

        df = self.get_recent_buy_recommendations(days=5)
        keywords = sector_keywords.get(sector, [])

        if keywords:
            mask = df["name"].apply(lambda x: any(kw in x for kw in keywords))
            return df[mask]

        return df

    def get_broker_recommendations(self, broker: str) -> pd.DataFrame:
        """증권사별 리포트 조회"""
        df = self.get_recent_buy_recommendations(days=5)
        return df[df["broker"].str.contains(broker, case=False)]

    def format_report_summary(self, report: dict) -> str:
        """리포트 요약 포맷팅"""
        return f"""
[{report['date']}] {report['name']} ({report['ticker']})
증권사: {report['broker']} | 애널리스트: {report['analyst']}
투자의견: {report['opinion']} | 목표가: {report['target_price']:,}
현재가: {report['current_price']:,} | 상승여력: {report['upside']:.1f}%
요약: {report['summary']}
"""
