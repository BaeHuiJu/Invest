"""ETF 추천 프로그램 - Streamlit UI"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import sys
from pathlib import Path

# 프로젝트 루트 추가
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.korea_etf import KoreaETFCollector
from src.data.us_etf import USETFCollector
from src.data.analyst import AnalystReportCollector
from src.analysis.metrics import ETFMetrics
from src.analysis.recommend import ETFRecommender

# 페이지 설정
st.set_page_config(
    page_title="ETF 추천 프로그램",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 세션 상태 초기화
if "korea_collector" not in st.session_state:
    st.session_state.korea_collector = KoreaETFCollector()
    st.session_state.us_collector = USETFCollector()
    st.session_state.analyst_collector = AnalystReportCollector()
    st.session_state.recommender = ETFRecommender()
    st.session_state.metrics = ETFMetrics()


def main():
    """메인 함수"""
    st.sidebar.title("📈 ETF 추천 프로그램")

    menu = st.sidebar.radio(
        "메뉴 선택",
        ["🏠 홈", "🇰🇷 국내 ETF", "🇺🇸 해외 ETF", "📊 애널리스트 추천", "🔍 ETF 비교"]
    )

    if menu == "🏠 홈":
        show_home()
    elif menu == "🇰🇷 국내 ETF":
        show_korea_etf()
    elif menu == "🇺🇸 해외 ETF":
        show_us_etf()
    elif menu == "📊 애널리스트 추천":
        show_analyst_recommendations()
    elif menu == "🔍 ETF 비교":
        show_etf_comparison()


def show_home():
    """홈 화면"""
    st.title("ETF 추천 프로그램")
    st.markdown("---")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.subheader("🇰🇷 국내 ETF TOP 5")
        korea_top = st.session_state.recommender.recommend_korea_etfs(top_n=5)
        if not korea_top.empty:
            for _, row in korea_top.iterrows():
                ret_1m = row.get('return_1m', 0) or 0
                color = "🟢" if ret_1m >= 0 else "🔴"
                st.write(f"{color} **{row['name']}**")
                st.write(f"   점수: {row['score']} | 1개월: {ret_1m:+.1f}%")

    with col2:
        st.subheader("🇺🇸 해외 ETF TOP 5")
        us_top = st.session_state.recommender.recommend_us_etfs(top_n=5)
        if not us_top.empty:
            for _, row in us_top.iterrows():
                ret_1m = row.get('return_1m', 0) or 0
                color = "🟢" if ret_1m >= 0 else "🔴"
                st.write(f"{color} **{row['name']}**")
                st.write(f"   점수: {row['score']} | 1개월: {ret_1m:+.1f}%")

    with col3:
        st.subheader("📊 최신 매수 추천")
        reports = st.session_state.analyst_collector.get_recent_buy_recommendations(days=3)
        if not reports.empty:
            for _, row in reports.head(5).iterrows():
                st.write(f"**{row['name']}** ({row['ticker']})")
                st.write(f"   {row['broker']} | 상승여력: {row['upside']:.1f}%")

    st.markdown("---")
    st.subheader("📈 시장 현황")

    # 주요 지수 표시
    indices = {
        "KOSPI 200": "069500",
        "NASDAQ 100": "QQQ",
        "S&P 500": "SPY"
    }

    cols = st.columns(len(indices))
    for i, (name, ticker) in enumerate(indices.items()):
        with cols[i]:
            if ticker.isdigit():
                prices = st.session_state.korea_collector.get_etf_price(ticker, days=30)
            else:
                prices = st.session_state.us_collector.get_etf_price(ticker, period="1mo")

            if not prices.empty:
                current = prices["close"].iloc[-1]
                prev = prices["close"].iloc[-2] if len(prices) > 1 else current
                change = (current - prev) / prev * 100

                st.metric(
                    label=name,
                    value=f"{current:,.0f}",
                    delta=f"{change:+.2f}%"
                )


def show_korea_etf():
    """국내 ETF 페이지"""
    st.title("🇰🇷 국내 ETF 추천")

    # 필터 옵션
    col1, col2 = st.columns(2)
    with col1:
        sector = st.selectbox(
            "섹터 선택",
            ["전체", "반도체", "2차전지", "바이오", "금융", "자동차"]
        )
    with col2:
        top_n = st.slider("추천 개수", 5, 20, 10)

    # ETF 추천 결과
    category = None if sector == "전체" else sector
    recommendations = st.session_state.recommender.recommend_korea_etfs(
        category=category,
        top_n=top_n
    )

    if not recommendations.empty:
        st.subheader("추천 ETF 목록")

        # 테이블 표시
        display_df = recommendations[[
            "ticker", "name", "score", "current_price",
            "return_1m", "return_3m", "volatility", "sharpe_ratio"
        ]].copy()

        display_df.columns = [
            "종목코드", "종목명", "점수", "현재가",
            "1개월수익률", "3개월수익률", "변동성", "샤프비율"
        ]

        st.dataframe(
            display_df.style.format({
                "점수": "{:.1f}",
                "현재가": "{:,.0f}",
                "1개월수익률": "{:+.1f}%",
                "3개월수익률": "{:+.1f}%",
                "변동성": "{:.1f}%",
                "샤프비율": "{:.2f}"
            }),
            use_container_width=True
        )

        # 차트
        st.subheader("수익률 비교")
        fig = px.bar(
            recommendations,
            x="name",
            y="return_1m",
            color="return_1m",
            color_continuous_scale=["red", "gray", "green"],
            labels={"name": "ETF", "return_1m": "1개월 수익률 (%)"}
        )
        st.plotly_chart(fig, use_container_width=True)

        # ETF 상세 정보
        st.subheader("ETF 상세 분석")
        selected_ticker = st.selectbox(
            "ETF 선택",
            recommendations["ticker"].tolist(),
            format_func=lambda x: f"{recommendations[recommendations['ticker']==x]['name'].values[0]} ({x})"
        )

        if selected_ticker:
            prices = st.session_state.korea_collector.get_etf_price(selected_ticker, days=180)
            if not prices.empty:
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=prices["date"],
                    y=prices["close"],
                    mode="lines",
                    name="종가"
                ))
                fig.update_layout(
                    title=f"{selected_ticker} 가격 추이",
                    xaxis_title="날짜",
                    yaxis_title="가격"
                )
                st.plotly_chart(fig, use_container_width=True)
    else:
        st.warning("추천 결과가 없습니다.")


def show_us_etf():
    """해외 ETF 페이지"""
    st.title("🇺🇸 해외 ETF 추천")

    # 필터 옵션
    col1, col2 = st.columns(2)
    with col1:
        category = st.selectbox(
            "카테고리 선택",
            ["전체", "index", "sector_tech", "sector_healthcare",
             "sector_finance", "bond", "commodity", "dividend"]
        )
    with col2:
        top_n = st.slider("추천 개수", 5, 20, 10, key="us_top_n")

    # ETF 추천 결과
    cat = None if category == "전체" else category
    recommendations = st.session_state.recommender.recommend_us_etfs(
        category=cat,
        top_n=top_n
    )

    if not recommendations.empty:
        st.subheader("추천 ETF 목록")

        display_df = recommendations[[
            "ticker", "name", "category", "score",
            "return_1m", "return_3m", "dividend_yield", "expense_ratio"
        ]].copy()

        display_df.columns = [
            "티커", "종목명", "카테고리", "점수",
            "1개월수익률", "3개월수익률", "배당수익률", "운용보수"
        ]

        st.dataframe(
            display_df.style.format({
                "점수": "{:.1f}",
                "1개월수익률": "{:+.1f}%",
                "3개월수익률": "{:+.1f}%",
                "배당수익률": "{:.2f}%",
                "운용보수": "{:.2f}%"
            }),
            use_container_width=True
        )

        # 차트
        st.subheader("수익률 비교")
        fig = px.bar(
            recommendations,
            x="ticker",
            y="return_1m",
            color="return_1m",
            color_continuous_scale=["red", "gray", "green"],
            labels={"ticker": "ETF", "return_1m": "1개월 수익률 (%)"}
        )
        st.plotly_chart(fig, use_container_width=True)

        # ETF 상세
        st.subheader("ETF 상세 분석")
        selected = st.selectbox(
            "ETF 선택",
            recommendations["ticker"].tolist(),
            key="us_select"
        )

        if selected:
            prices = st.session_state.us_collector.get_etf_price(selected, period="6mo")
            if not prices.empty:
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=prices["date"],
                    y=prices["close"],
                    mode="lines",
                    name="Close"
                ))
                fig.update_layout(
                    title=f"{selected} Price Chart",
                    xaxis_title="Date",
                    yaxis_title="Price"
                )
                st.plotly_chart(fig, use_container_width=True)
    else:
        st.warning("추천 결과가 없습니다.")


def show_analyst_recommendations():
    """애널리스트 추천 페이지"""
    st.title("📊 애널리스트 매수 추천")
    st.markdown("최근 5일 이내 애널리스트가 매수 추천한 종목")

    # 필터 옵션
    col1, col2, col3 = st.columns(3)

    with col1:
        days = st.selectbox("기간", [1, 3, 5], index=2, format_func=lambda x: f"{x}일 이내")

    with col2:
        market = st.selectbox("시장", ["all", "korea", "us"],
                             format_func=lambda x: {"all": "전체", "korea": "국내", "us": "해외"}[x])

    with col3:
        opinion = st.multiselect(
            "투자의견",
            ["strong_buy", "buy", "trading_buy"],
            default=["strong_buy", "buy"],
            format_func=lambda x: {"strong_buy": "적극매수", "buy": "매수", "trading_buy": "Trading Buy"}[x]
        )

    # 데이터 조회
    reports = st.session_state.analyst_collector.get_recent_buy_recommendations(
        days=days,
        market=market,
        opinion_filter=opinion if opinion else None
    )

    if not reports.empty:
        # 요약 통계
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("총 추천 수", len(reports))
        with col2:
            avg_upside = reports["upside"].mean()
            st.metric("평균 상승여력", f"{avg_upside:.1f}%")
        with col3:
            korea_count = len(reports[reports["market"] == "korea"])
            st.metric("국내 종목", korea_count)
        with col4:
            us_count = len(reports[reports["market"] == "us"])
            st.metric("해외 종목", us_count)

        st.markdown("---")

        # 정렬 옵션
        sort_by = st.selectbox(
            "정렬 기준",
            ["date", "upside", "target_price"],
            format_func=lambda x: {"date": "날짜순", "upside": "상승여력순", "target_price": "목표가순"}[x]
        )

        reports_sorted = reports.sort_values(sort_by, ascending=(sort_by == "date"))

        # 테이블 표시
        st.subheader("매수 추천 목록")

        display_df = reports_sorted[[
            "date", "name", "ticker", "market", "broker", "analyst",
            "opinion", "target_price", "current_price", "upside"
        ]].copy()

        display_df.columns = [
            "추천일", "종목명", "종목코드", "시장", "증권사", "애널리스트",
            "투자의견", "목표가", "현재가", "상승여력"
        ]

        display_df["시장"] = display_df["시장"].map({"korea": "국내", "us": "해외"})

        st.dataframe(
            display_df.style.format({
                "목표가": "{:,.0f}",
                "현재가": "{:,.0f}",
                "상승여력": "{:.1f}%"
            }).background_gradient(subset=["상승여력"], cmap="RdYlGn"),
            use_container_width=True
        )

        # 상승여력 차트
        st.subheader("상승여력 TOP 10")
        top10 = reports.nlargest(10, "upside")
        fig = px.bar(
            top10,
            x="name",
            y="upside",
            color="market",
            color_discrete_map={"korea": "#1f77b4", "us": "#ff7f0e"},
            labels={"name": "종목", "upside": "상승여력 (%)", "market": "시장"}
        )
        fig.update_layout(xaxis_tickangle=-45)
        st.plotly_chart(fig, use_container_width=True)

        # 상세 리포트
        st.subheader("리포트 상세")
        selected = st.selectbox(
            "종목 선택",
            reports["ticker"].tolist(),
            format_func=lambda x: f"{reports[reports['ticker']==x]['name'].values[0]} ({x})"
        )

        if selected:
            report = reports[reports["ticker"] == selected].iloc[0]
            col1, col2 = st.columns(2)

            with col1:
                st.markdown(f"""
                **{report['name']}** ({report['ticker']})

                - **추천일**: {report['date']}
                - **증권사**: {report['broker']}
                - **애널리스트**: {report['analyst']}
                - **투자의견**: {report['opinion']}
                """)

            with col2:
                st.markdown(f"""
                **가격 정보**

                - **목표가**: {report['target_price']:,}
                - **현재가**: {report['current_price']:,}
                - **상승여력**: {report['upside']:.1f}%
                """)

            st.markdown(f"""
            **투자 포인트**

            {report['summary']}
            """)
    else:
        st.info("조건에 맞는 추천 종목이 없습니다.")


def show_etf_comparison():
    """ETF 비교 페이지"""
    st.title("🔍 ETF 비교")

    market = st.radio("시장 선택", ["국내", "해외"], horizontal=True)

    if market == "국내":
        etf_list = st.session_state.korea_collector.get_etf_list()
        tickers = st.multiselect(
            "비교할 ETF 선택 (최대 5개)",
            etf_list["ticker"].tolist(),
            format_func=lambda x: f"{etf_list[etf_list['ticker']==x]['name'].values[0]} ({x})",
            max_selections=5
        )

        if tickers:
            # 가격 데이터 수집
            price_data = {}
            for ticker in tickers:
                prices = st.session_state.korea_collector.get_etf_price(ticker, days=180)
                if not prices.empty:
                    price_data[ticker] = prices

            if price_data:
                # 가격 비교 차트 (정규화)
                st.subheader("가격 추이 비교 (정규화)")
                fig = go.Figure()

                for ticker, prices in price_data.items():
                    normalized = prices["close"] / prices["close"].iloc[0] * 100
                    name = etf_list[etf_list["ticker"] == ticker]["name"].values[0]
                    fig.add_trace(go.Scatter(
                        x=prices["date"],
                        y=normalized,
                        mode="lines",
                        name=f"{name} ({ticker})"
                    ))

                fig.update_layout(
                    yaxis_title="수익률 (%)",
                    xaxis_title="날짜",
                    hovermode="x unified"
                )
                st.plotly_chart(fig, use_container_width=True)

                # 지표 비교
                st.subheader("지표 비교")
                comparison = []

                for ticker, prices in price_data.items():
                    metrics = st.session_state.metrics.get_comprehensive_metrics(prices["close"])
                    info = st.session_state.korea_collector.get_etf_info(ticker)
                    name = etf_list[etf_list["ticker"] == ticker]["name"].values[0]

                    comparison.append({
                        "종목": f"{name}",
                        "현재가": metrics["current_price"],
                        "1개월": metrics["returns"].get("1m"),
                        "3개월": metrics["returns"].get("3m"),
                        "변동성": metrics["volatility"],
                        "샤프비율": metrics["sharpe_ratio"],
                        "MDD": metrics["max_drawdown"],
                    })

                comp_df = pd.DataFrame(comparison)
                st.dataframe(
                    comp_df.style.format({
                        "현재가": "{:,.0f}",
                        "1개월": "{:+.1f}%",
                        "3개월": "{:+.1f}%",
                        "변동성": "{:.1f}%",
                        "샤프비율": "{:.2f}",
                        "MDD": "{:.1f}%"
                    }),
                    use_container_width=True
                )
    else:
        # 해외 ETF
        etf_list = st.session_state.us_collector.get_etf_list()
        tickers = st.multiselect(
            "비교할 ETF 선택 (최대 5개)",
            etf_list["ticker"].tolist(),
            format_func=lambda x: f"{etf_list[etf_list['ticker']==x]['name'].values[0]} ({x})",
            max_selections=5,
            key="us_compare"
        )

        if tickers:
            price_data = {}
            for ticker in tickers:
                prices = st.session_state.us_collector.get_etf_price(ticker, period="6mo")
                if not prices.empty:
                    price_data[ticker] = prices

            if price_data:
                st.subheader("가격 추이 비교 (정규화)")
                fig = go.Figure()

                for ticker, prices in price_data.items():
                    normalized = prices["close"] / prices["close"].iloc[0] * 100
                    name = etf_list[etf_list["ticker"] == ticker]["name"].values[0]
                    fig.add_trace(go.Scatter(
                        x=prices["date"],
                        y=normalized,
                        mode="lines",
                        name=f"{name} ({ticker})"
                    ))

                fig.update_layout(
                    yaxis_title="Return (%)",
                    xaxis_title="Date",
                    hovermode="x unified"
                )
                st.plotly_chart(fig, use_container_width=True)

                st.subheader("지표 비교")
                comparison = []

                for ticker, prices in price_data.items():
                    metrics = st.session_state.metrics.get_comprehensive_metrics(prices["close"])
                    info = st.session_state.us_collector.get_etf_info(ticker)

                    comparison.append({
                        "Ticker": ticker,
                        "Name": info.get("name", ticker)[:20],
                        "Price": metrics["current_price"],
                        "1M Return": metrics["returns"].get("1m"),
                        "3M Return": metrics["returns"].get("3m"),
                        "Volatility": metrics["volatility"],
                        "Sharpe": metrics["sharpe_ratio"],
                    })

                comp_df = pd.DataFrame(comparison)
                st.dataframe(
                    comp_df.style.format({
                        "Price": "{:.2f}",
                        "1M Return": "{:+.1f}%",
                        "3M Return": "{:+.1f}%",
                        "Volatility": "{:.1f}%",
                        "Sharpe": "{:.2f}"
                    }),
                    use_container_width=True
                )


if __name__ == "__main__":
    main()
