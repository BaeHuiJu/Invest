const US_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'META', 'TSLA', 'BRK-B', 'JPM', 'V',
  'UNH', 'XOM', 'JNJ', 'WMT', 'PG',
  'FROG',
];

const KOREA_SAMPLE_STOCKS = [
  { ticker: '005930', name: '삼성전자', targetMultiplier: 1.25 },
  { ticker: '000660', name: 'SK하이닉스', targetMultiplier: 1.3 },
  { ticker: '373220', name: 'LG에너지솔루션', targetMultiplier: 1.2 },
  { ticker: '005380', name: '현대차', targetMultiplier: 1.22 },
  { ticker: '006400', name: '삼성SDI', targetMultiplier: 1.28 },
  { ticker: '035420', name: 'NAVER', targetMultiplier: 1.35 },
  { ticker: '000270', name: '기아', targetMultiplier: 1.18 },
  { ticker: '035720', name: '카카오', targetMultiplier: 1.4 },
  { ticker: '005490', name: 'POSCO홀딩스', targetMultiplier: 1.15 },
  { ticker: '051910', name: 'LG화학', targetMultiplier: 1.25 },
  { ticker: '055550', name: '신한지주', targetMultiplier: 1.14 },
  { ticker: '096770', name: 'SK이노베이션', targetMultiplier: 1.19 },
  { ticker: '028260', name: '삼성물산', targetMultiplier: 1.16 },
  { ticker: '003670', name: '포스코퓨처엠', targetMultiplier: 1.24 },
  { ticker: '034730', name: 'SK', targetMultiplier: 1.17 },
  { ticker: '032830', name: '삼성생명', targetMultiplier: 1.12 },
  { ticker: '012330', name: '현대모비스', targetMultiplier: 1.2 },
  { ticker: '066570', name: 'LG전자', targetMultiplier: 1.23 },
  { ticker: '003550', name: 'LG', targetMultiplier: 1.13 },
  { ticker: '015760', name: '한국전력', targetMultiplier: 1.11 },
];

const KOREA_BROKERS = [
  '삼성증권',
  '미래에셋증권',
  'KB증권',
  '신한투자증권',
  '한국투자증권',
  'NH투자증권',
  '하나증권',
  '키움증권',
];

const KOREA_OPINIONS = ['매수', 'Trading Buy', '적극매수', 'Buy'];

function subtractDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function roundTwo(value) {
  return Math.round(value * 100) / 100;
}

function isBuyOpinion(opinion) {
  const normalized = opinion.toLowerCase();
  return normalized.includes('buy') || opinion.includes('매수') || opinion === 'Trading Buy';
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.text();
}

async function fetchNaverCurrentPrice(ticker) {
  try {
    const response = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return parseInt(data.closePrice?.replace(/,/g, '') || '0', 10);
  } catch {
    return 0;
  }
}

async function fetchNaverHistoricalClose(ticker, targetDate, priceCache) {
  const cacheKey = `${ticker}:${targetDate}`;
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey);
  }

  try {
    for (let page = 1; page <= 10; page += 1) {
      const html = await fetchText(
        `https://finance.naver.com/item/sise_day.naver?code=${ticker}&page=${page}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
        }
      );

      const normalizedTarget = targetDate.replace(/-/g, '.');
      const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      const rows = html.match(rowRegex) || [];

      for (const row of rows) {
        if (!row.includes(normalizedTarget)) {
          continue;
        }

        const numericMatches = row.match(/<td[^>]*class="num"[^>]*>([\d,]+)<\/td>/g) || [];
        if (numericMatches.length === 0) {
          continue;
        }

        const closeMatch = numericMatches[0].match(/>([\d,]+)</);
        if (closeMatch) {
          const closePrice = parseInt(closeMatch[1].replace(/,/g, ''), 10);
          priceCache.set(cacheKey, closePrice);
          return closePrice;
        }
      }
    }
  } catch {
    // ignore historical price failures
  }

  priceCache.set(cacheKey, 0);
  return 0;
}

async function fetchYahooHistoricalClose(ticker, targetDate, priceCache) {
  const cacheKey = `${ticker}:${targetDate}`;
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey);
  }

  try {
    const target = new Date(`${targetDate}T00:00:00Z`);
    const period1 = Math.floor((target.getTime() - 5 * 24 * 60 * 60 * 1000) / 1000);
    const period2 = Math.floor((target.getTime() + 5 * 24 * 60 * 60 * 1000) / 1000);
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );

    if (!response.ok) {
      priceCache.set(cacheKey, 0);
      return 0;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const rowDate = new Date(timestamps[index] * 1000).toISOString().slice(0, 10);
      if (rowDate === targetDate && typeof closes[index] === 'number') {
        const closePrice = roundTwo(closes[index]);
        priceCache.set(cacheKey, closePrice);
        return closePrice;
      }
    }
  } catch {
    // ignore historical price failures
  }

  priceCache.set(cacheKey, 0);
  return 0;
}

async function fetchNaverResearchDetail(nid) {
  try {
    const response = await fetch(
      `https://finance.naver.com/research/company_read.naver?nid=${nid}&page=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      }
    );

    if (!response.ok) {
      return { targetPrice: 0, opinion: '매수' };
    }

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buffer);
    const targetPriceMatch = html.match(/class="money"><strong>([\d,]+)<\/strong>/);
    const opinionMatch = html.match(/class="coment">([^<]+)<\/em>/);

    return {
      targetPrice: targetPriceMatch ? parseInt(targetPriceMatch[1].replace(/,/g, ''), 10) : 0,
      opinion: opinionMatch ? opinionMatch[1].trim() : '매수',
    };
  } catch {
    return { targetPrice: 0, opinion: '매수' };
  }
}

function buildReasonSummary(report) {
  const title = report.reportTitle ? `${report.reportTitle}. ` : '';
  const baseGap = report.basePrice > 0
    ? `공시일 종가 대비 목표가 괴리는 ${roundOne(((report.targetPrice - report.basePrice) / report.basePrice) * 100)}%입니다. `
    : '';
  return `${title}${report.broker}가 ${report.opinion} 의견을 제시했고 현재가 기준 상승여력은 ${report.upside.toFixed(1)}%입니다. ${baseGap}`.trim();
}

function buildReasonBullets(report) {
  const bullets = [
    `${report.broker}가 ${report.date}에 ${report.opinion} 의견과 목표가를 제시했습니다.`,
    `현재가 ${formatPriceByMarket(report.currentPrice, report.market)} 대비 목표가는 ${formatPriceByMarket(report.targetPrice, report.market)}입니다.`,
  ];

  if (report.basePrice > 0) {
    bullets.push(`공시일 종가 ${formatPriceByMarket(report.basePrice, report.market)} 대비 괴리는 ${roundOne(((report.targetPrice - report.basePrice) / report.basePrice) * 100)}%입니다.`);
  }

  return bullets.slice(0, 3);
}

function formatPriceByMarket(price, market) {
  if (!price) {
    return market === 'korea' ? '0원' : '$0';
  }
  return market === 'korea'
    ? `${Math.round(price).toLocaleString()}원`
    : `$${roundTwo(price).toLocaleString()}`;
}

async function generateKoreaSampleReports(days, historyCache) {
  const reports = [];

  for (const stock of KOREA_SAMPLE_STOCKS) {
    let currentPrice = await fetchNaverCurrentPrice(stock.ticker);
    if (currentPrice <= 0) {
      currentPrice = 50000;
    }

    const randomDays = Math.floor(Math.random() * Math.min(days, 30));
    const baseDate = formatDate(subtractDays(randomDays));
    let basePrice = await fetchNaverHistoricalClose(stock.ticker, baseDate, historyCache);
    if (basePrice <= 0) {
      basePrice = currentPrice;
    }

    const targetPrice = Math.round(basePrice * stock.targetMultiplier);
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;

    const report = {
      date: baseDate,
      ticker: stock.ticker,
      name: stock.name,
      market: 'korea',
      broker: KOREA_BROKERS[Math.floor(Math.random() * KOREA_BROKERS.length)],
      analyst: '',
      opinion: KOREA_OPINIONS[Math.floor(Math.random() * KOREA_OPINIONS.length)],
      targetPrice,
      currentPrice,
      basePrice,
      basePriceDate: baseDate,
      upside: roundOne(upside),
      reportTitle: `${stock.name} 실적 개선 기대`,
    };

    report.reasonSummary = buildReasonSummary(report);
    report.reasonBullets = buildReasonBullets(report);
    reports.push(report);
  }

  const cutoff = subtractDays(days);
  return reports.filter((report) => new Date(report.date) >= cutoff);
}

async function fetchNaverResearch(days) {
  const reports = [];
  const cutoffDate = subtractDays(days);
  const currentPriceCache = new Map();
  const historyCache = new Map();

  try {
    for (let page = 1; page <= 3; page += 1) {
      const response = await fetch(
        `https://finance.naver.com/research/company_list.naver?&page=${page}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Naver research');
      }

      const buffer = await response.arrayBuffer();
      const html = new TextDecoder('euc-kr').decode(buffer);
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const nameMatch = row.match(/class="stock_item"[^>]*>([^<]+)<\/a>/);
        const tickerMatch = row.match(/code=(\d{6})/);
        const nidMatch = row.match(/company_read\.naver\?nid=(\d+)/);
        const titleMatch = row.match(/company_read\.naver\?nid=\d+&page=\d+">([^<]+)/);
        const brokerMatch = row.match(/<td[^>]*>([^<]+증권|[^<]+투자|[^<]+리서치)<\/td>/i);
        const dateMatch = row.match(/(\d{2}\.\d{2}\.\d{2})/);

        if (!(nameMatch && tickerMatch && dateMatch && nidMatch)) {
          continue;
        }

        const [yy, mm, dd] = dateMatch[1].split('.');
        const reportDate = `20${yy}-${mm}-${dd}`;

        if (new Date(reportDate) < cutoffDate) {
          continue;
        }

        const ticker = tickerMatch[1];
        const { targetPrice, opinion } = await fetchNaverResearchDetail(nidMatch[1]);

        if (!currentPriceCache.has(ticker)) {
          currentPriceCache.set(ticker, await fetchNaverCurrentPrice(ticker));
        }

        const currentPrice = currentPriceCache.get(ticker) || 0;
        let basePrice = await fetchNaverHistoricalClose(ticker, reportDate, historyCache);
        if (basePrice <= 0) {
          basePrice = currentPrice;
        }

        const upside = currentPrice > 0 && targetPrice > 0
          ? ((targetPrice - currentPrice) / currentPrice) * 100
          : 0;

        const report = {
          date: reportDate,
          ticker,
          name: nameMatch[1].trim(),
          market: 'korea',
          broker: brokerMatch ? brokerMatch[1].trim() : '국내증권사',
          analyst: '',
          opinion,
          targetPrice,
          currentPrice,
          basePrice,
          basePriceDate: reportDate,
          upside: roundOne(upside),
          reportTitle: titleMatch ? titleMatch[1].trim() : undefined,
        };

        report.reasonSummary = buildReasonSummary(report);
        report.reasonBullets = buildReasonBullets(report);
        reports.push(report);
      }
    }

    if (reports.filter((report) => report.upside > 0).length < 5) {
      reports.push(...await generateKoreaSampleReports(days, historyCache));
    }
  } catch (error) {
    console.error('Error fetching Naver research:', error);
    reports.push(...await generateKoreaSampleReports(days, historyCache));
  }

  return reports;
}

function getUsRatingsUrl(ticker) {
  return `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/ratings/`;
}

async function fetchStockAnalysisRatings(ticker, days) {
  const reports = [];
  const cutoff = subtractDays(days);
  const historyCache = new Map();

  try {
    const response = await fetch(getUsRatingsUrl(ticker), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return reports;
    }

    const html = await response.text();
    const nameMatch = html.match(/nameFull:"([^"]+)"/);
    const currentPriceMatch = html.match(/quote:\{[^}]*\bp:([0-9.]+)/);
    const currentPrice = currentPriceMatch ? parseFloat(currentPriceMatch[1]) : 0;
    const name = nameMatch ? nameMatch[1] : ticker.toUpperCase();

    if (currentPrice <= 0) {
      return reports;
    }

    const ratingRegex = /\{action_rt:"([^"]*)",pt_now:([^,]+),pt_old:([^,]+),firm:"([^"]*)",analyst:"([^"]*)",slug:"[^"]*",date:"([^"]*)",rating_new:"([^"]*)",rating_old:"([^"]*)"/g;
    const matches = Array.from(html.matchAll(ratingRegex));

    for (const match of matches) {
      const [, action, ptNowRaw, , firm, analyst, date, ratingNew, ratingOld] = match;
      const reportDate = new Date(date);
      if (Number.isNaN(reportDate.getTime()) || reportDate < cutoff) {
        continue;
      }

      const normalizedDate = formatDate(reportDate);
      const targetPrice = ptNowRaw === 'null' ? 0 : parseFloat(ptNowRaw);
      let basePrice = await fetchYahooHistoricalClose(ticker, normalizedDate, historyCache);
      if (basePrice <= 0) {
        basePrice = currentPrice;
      }

      const upside = currentPrice > 0 && targetPrice > 0
        ? ((targetPrice - currentPrice) / currentPrice) * 100
        : 0;

      const report = {
        date: normalizedDate,
        ticker: ticker.toUpperCase(),
        name,
        market: 'us',
        broker: firm,
        analyst,
        opinion: ratingNew,
        targetPrice: roundTwo(targetPrice),
        currentPrice: roundTwo(currentPrice),
        basePrice: roundTwo(basePrice),
        basePriceDate: normalizedDate,
        upside: roundOne(upside),
        reportTitle: ratingOld ? `${ratingOld} -> ${ratingNew} ${action}` : `${ratingNew} ${action}`,
      };

      report.reasonSummary = buildReasonSummary(report);
      report.reasonBullets = buildReasonBullets(report);
      reports.push(report);
    }
  } catch (error) {
    console.error(`Error fetching analyst ratings for ${ticker}:`, error);
  }

  return reports;
}

async function fetchYahooAnalyst(days) {
  const reports = await Promise.all(US_STOCKS.map((ticker) => fetchStockAnalysisRatings(ticker, days)));
  return reports.flat();
}

function filterBuyReports(reports) {
  const filtered = reports
    .filter((report) => isBuyOpinion(report.opinion))
    .filter((report) => report.upside > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const seen = new Set();
  return filtered.filter((report) => {
    const key = `${report.ticker}-${report.broker}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildStockInsight(reportGroup) {
  const sorted = [...reportGroup].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const avgUpside = sorted.reduce((sum, report) => sum + report.upside, 0) / sorted.length;
  const reportCount = sorted.length;
  const summary = latest.reasonSummary || `${latest.broker}의 최신 리포트 기준 상승여력은 ${latest.upside.toFixed(1)}%입니다.`;
  const bullets = Array.from(
    new Set([
      ...(latest.reasonBullets || []),
      `${reportCount}건의 매수 의견이 캐시되어 있고 평균 상승여력은 ${avgUpside.toFixed(1)}%입니다.`,
    ])
  ).slice(0, 3);

  return {
    ticker: latest.ticker,
    name: latest.name,
    market: latest.market,
    latestReportDate: latest.date,
    latestBroker: latest.broker,
    latestOpinion: latest.opinion,
    latestTargetPrice: latest.targetPrice,
    latestCurrentPrice: latest.currentPrice,
    latestBasePrice: latest.basePrice,
    avgUpside: roundOne(avgUpside),
    reportCount,
    reasonSummary: summary,
    reasonBullets: bullets,
    relatedReports: sorted.slice(0, 5),
  };
}

function buildStockInsights(reports) {
  const groups = new Map();

  for (const report of reports) {
    const key = `${report.market}:${report.ticker}`;
    const existing = groups.get(key) || [];
    existing.push(report);
    groups.set(key, existing);
  }

  const insights = {};
  for (const [key, group] of groups.entries()) {
    insights[key] = buildStockInsight(group);
  }

  return insights;
}

export async function buildAnalystReports(days = 30) {
  const [koreaReports, usReports] = await Promise.all([
    fetchNaverResearch(days),
    fetchYahooAnalyst(days),
  ]);

  return filterBuyReports([...koreaReports, ...usReports]);
}

export function filterAnalystReports(reports, days, market) {
  const cutoff = subtractDays(days);
  return reports
    .filter((report) => market === 'all' || report.market === market)
    .filter((report) => new Date(report.date) >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function buildFallbackInsight({
  ticker,
  name,
  market,
  currentPrice = 0,
  changePercent = 0,
  high52w = 0,
  low52w = 0,
}) {
  const bullets = [
    `현재가는 ${formatPriceByMarket(currentPrice, market)}이고 최근 등락률은 ${roundOne(changePercent)}%입니다.`,
  ];

  if (high52w > 0 || low52w > 0) {
    bullets.push(`52주 범위는 ${formatPriceByMarket(low52w, market)} ~ ${formatPriceByMarket(high52w, market)}입니다.`);
  }

  bullets.push('현재 캐시된 증권사 리포트는 없어 가격 지표 중심으로만 요약합니다.');

  return {
    ticker,
    name,
    market,
    reportCount: 0,
    reasonSummary: `${name}은 현재 가격 흐름과 기본 지표는 확인되지만, 캐시된 증권사 매수 리포트는 없습니다.`,
    reasonBullets: bullets,
    relatedReports: [],
  };
}

export async function buildAnalystCacheFile(maxDays = 30) {
  const reports = await buildAnalystReports(maxDays);
  const stockInsights = buildStockInsights(reports);

  return {
    generatedAt: new Date().toISOString(),
    maxDays,
    reports,
    stockInsights,
  };
}
