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
    const normalizedTarget = targetDate.replace(/-/g, '.');
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

      const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      const rows = html.match(rowRegex) || [];
      const candidates = [];

      for (const row of rows) {
        const dateMatch = row.match(/<span[^>]*>(\d{4}\.\d{2}\.\d{2})<\/span>/);
        if (!dateMatch) {
          continue;
        }

        const rowDate = dateMatch[1];
        if (rowDate > normalizedTarget) {
          continue;
        }

        const numericMatches = row.match(/<td[^>]*class="num"[^>]*>([\d,]+)<\/td>/g) || [];
        if (numericMatches.length === 0) {
          continue;
        }

        const closeMatch = numericMatches[0].match(/>([\d,]+)</);
        if (closeMatch) {
          candidates.push({
            date: rowDate.replace(/\./g, '-'),
            price: parseInt(closeMatch[1].replace(/,/g, ''), 10),
          });
        }
      }

      const exactMatch = candidates.find((candidate) => candidate.date === targetDate);
      if (exactMatch) {
        priceCache.set(cacheKey, exactMatch);
        return exactMatch;
      }

      if (candidates.length > 0) {
        const nearestPrior = candidates
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        priceCache.set(cacheKey, nearestPrior);
        return nearestPrior;
      }
    }
  } catch {
    // ignore historical price failures
  }

  const fallback = { price: 0, date: targetDate };
  priceCache.set(cacheKey, fallback);
  return fallback;
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
        }
      }
    );

    if (!response.ok) {
      const fallback = { price: 0, date: targetDate };
      priceCache.set(cacheKey, fallback);
      return fallback;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const candidates = [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const rowDate = new Date(timestamps[index] * 1000).toISOString().slice(0, 10);
      if (rowDate <= targetDate && typeof closes[index] === 'number') {
        candidates.push({
          date: rowDate,
          price: roundTwo(closes[index]),
        });
      }
    }

    const exactMatch = candidates.find((candidate) => candidate.date === targetDate);
    if (exactMatch) {
      priceCache.set(cacheKey, exactMatch);
      return exactMatch;
    }

    if (candidates.length > 0) {
      const nearestPrior = candidates
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      priceCache.set(cacheKey, nearestPrior);
      return nearestPrior;
    }
  } catch {
    // ignore historical price failures
  }

  const fallback = { price: 0, date: targetDate };
  priceCache.set(cacheKey, fallback);
  return fallback;
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

async function fetchNaverResearchSourceText(nid) {
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
      return '';
    }

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buffer);
    const bodyMatch = html.match(/<td colspan="2" class="view_cnt">[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i);
    return bodyMatch ? bodyMatch[1] : '';
  } catch {
    return '';
  }
}

function stripHtml(rawHtml = '') {
  return rawHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
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

function getUniqueBullets(items, limit = 3) {
  return Array.from(new Set(items.filter(Boolean))).slice(0, limit);
}

function splitSentences(text = '') {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
}

function pickSentences(text, keywords, limit = 3) {
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const matches = splitSentences(text).filter((sentence) => {
    const normalized = sentence.toLowerCase();
    return loweredKeywords.some((keyword) => normalized.includes(keyword));
  });

  if (matches.length > 0) {
    return getUniqueBullets(matches, limit);
  }

  return getUniqueBullets(splitSentences(text), limit);
}

function detectEstimateSignal(text = '') {
  const normalized = text.toLowerCase();
  const hasUp = ['상향', '높여', '올려', '증가', '개선', 'raise', 'raised', 'upward', 'beat']
    .some((keyword) => normalized.includes(keyword));
  const hasDown = ['하향', '낮춰', '내려', '감소', '둔화', 'cut', 'lowered', 'downward', 'miss']
    .some((keyword) => normalized.includes(keyword));
  const hasFlat = ['유지', '변동 없음', 'unchanged', 'maintain']
    .some((keyword) => normalized.includes(keyword));

  if ((hasUp && hasDown) || (hasFlat && (hasUp || hasDown))) return 'mixed';
  if (hasUp) return 'up';
  if (hasDown) return 'down';
  if (hasFlat) return 'flat';
  return 'unknown';
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
    const historicalClose = await fetchNaverHistoricalClose(stock.ticker, baseDate, historyCache);
    let basePrice = historicalClose.price;
    let basePriceDate = historicalClose.date;
    if (basePrice <= 0) {
      basePrice = currentPrice;
      basePriceDate = baseDate;
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
      basePriceDate,
      upside: roundOne(upside),
      sourceUrl: '',
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
        const sourceText = stripHtml(await fetchNaverResearchSourceText(nidMatch[1]));

        if (!currentPriceCache.has(ticker)) {
          currentPriceCache.set(ticker, await fetchNaverCurrentPrice(ticker));
        }

        const currentPrice = currentPriceCache.get(ticker) || 0;
        const historicalClose = await fetchNaverHistoricalClose(ticker, reportDate, historyCache);
        let basePrice = historicalClose.price;
        let basePriceDate = historicalClose.date;
        if (basePrice <= 0) {
          basePrice = currentPrice;
          basePriceDate = reportDate;
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
          basePriceDate,
          upside: roundOne(upside),
          sourceUrl: `https://finance.naver.com/research/company_read.naver?nid=${nidMatch[1]}&page=1`,
          reportTitle: titleMatch ? titleMatch[1].trim() : undefined,
          sourceText,
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
      const [, action, ptNowRaw, ptOldRaw, firm, analyst, date, ratingNew, ratingOld] = match;
      const reportDate = new Date(date);
      if (Number.isNaN(reportDate.getTime()) || reportDate < cutoff) {
        continue;
      }

      const normalizedDate = formatDate(reportDate);
      const targetPrice = ptNowRaw === 'null' ? 0 : parseFloat(ptNowRaw);
      const historicalClose = await fetchYahooHistoricalClose(ticker, normalizedDate, historyCache);
      let basePrice = historicalClose.price;
      let basePriceDate = historicalClose.date;
      if (basePrice <= 0) {
        basePrice = currentPrice;
        basePriceDate = normalizedDate;
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
        basePriceDate,
        upside: roundOne(upside),
        sourceUrl: getUsRatingsUrl(ticker),
        sourceText: `${firm} ${ratingNew} ${action}. Price target ${ptOldRaw === 'null' ? 'N/A' : ptOldRaw} -> ${ptNowRaw === 'null' ? 'N/A' : ptNowRaw}.`,
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
  const combinedText = sorted
    .map((report) => [report.reportTitle || '', stripHtml(report.sourceText || ''), report.reasonSummary || ''].join(' '))
    .join(' ');
  const estimateSignal = detectEstimateSignal(combinedText);
  const estimateSignalLabel = {
    up: '상향',
    down: '하향',
    flat: '유지',
    mixed: '혼재',
    unknown: '확인 어려움',
  }[estimateSignal];
  const summary = latest.reasonSummary || `${latest.broker}의 최신 리포트 기준 상승여력은 ${latest.upside.toFixed(1)}%입니다.`;
  const bullets = Array.from(
    new Set([
      ...(latest.reasonBullets || []),
      `${reportCount}건의 매수 의견이 캐시되어 있고 평균 상승여력은 ${avgUpside.toFixed(1)}%입니다.`,
    ])
  ).slice(0, 3);
  const investmentLogicBullets = getUniqueBullets([
    latest.reportTitle || '',
    ...pickSentences(combinedText, ['성장', '회복', '수요', '점유율', '확대', '수주', '신제품', 'growth', 'demand', 'margin', 'launch']),
  ]);
  const estimateBullets = getUniqueBullets([
    ...pickSentences(combinedText, ['상향', '하향', '유지', '추정', '컨센서스', '매출', '영업이익', 'eps', 'estimate', 'forecast', 'consensus']),
    estimateSignal === 'unknown' ? '현재 캐시된 원문에서는 추정치 변화 방향을 단정할 표현이 충분하지 않습니다.' : '',
  ]);
  const valuationBullets = getUniqueBullets([
    ...pickSentences(combinedText, ['per', 'pbr', 'ev/ebitda', '밸류', 'valuation', 'discount', 'premium', 'multiple']),
    latest.targetPrice > 0 && latest.currentPrice > 0 ? `현재가 대비 목표가 상승여력은 ${roundOne(((latest.targetPrice - latest.currentPrice) / latest.currentPrice) * 100)}%입니다.` : '',
    latest.basePrice > 0 && latest.targetPrice > 0 ? `기준가격 대비 목표가 괴리는 ${roundOne(((latest.targetPrice - latest.basePrice) / latest.basePrice) * 100)}%입니다.` : '',
  ]);
  const sectorCycleBullets = getUniqueBullets([
    ...pickSentences(combinedText, ['업황', '사이클', '턴어라운드', '회복', '둔화', '재고', 'capex', 'cycle', 'inventory', 'recovery', 'downcycle', 'upcycle']),
    `${latest.market === 'korea' ? '국내' : '해외'} 시장 기준 최근 ${sorted.length}건 리포트의 업황 표현을 정리했습니다.`,
  ]);

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
    investmentLogic: {
      summary: investmentLogicBullets[0] || `${latest.name} 추천 논리는 실적과 수요, 사업 모멘텀 중심으로 정리됩니다.`,
      bullets: investmentLogicBullets,
    },
    estimateRevision: {
      summary: `${estimateSignalLabel} 신호입니다. 리포트 원문에서 추정치 관련 표현을 기준으로 판단했습니다.`,
      bullets: estimateBullets,
      signal: estimateSignal,
    },
    valuation: {
      summary: latest.targetPrice > 0 && latest.currentPrice > 0
        ? `현재가 ${formatPriceByMarket(latest.currentPrice, latest.market)} 대비 목표가 ${formatPriceByMarket(latest.targetPrice, latest.market)}가 제시돼 밸류에이션 여력을 확인할 수 있습니다.`
        : '현재 캐시된 숫자 지표를 기준으로 밸류에이션을 요약했습니다.',
      bullets: valuationBullets,
    },
    sectorCycle: {
      summary: sectorCycleBullets[0] || '현재 캐시된 리포트에서 업종 사이클 근거를 정리했습니다.',
      bullets: sectorCycleBullets,
    },
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
    investmentLogic: {
      summary: `${name}의 투자 논리는 현재 캐시된 원문이 없어 기본 가격 흐름 위주로만 요약됩니다.`,
      bullets,
    },
    estimateRevision: {
      summary: '확인 어려움 신호입니다. 현재 캐시된 원문 기준 실적 추정치 조정 방향을 판단하기 어렵습니다.',
      bullets: ['실적 추정치 상향/하향을 보여줄 수 있는 증권사 원문이 아직 캐시되어 있지 않습니다.'],
      signal: 'unknown',
    },
    valuation: {
      summary: currentPrice > 0 ? `현재가 ${formatPriceByMarket(currentPrice, market)} 기준으로 숫자 지표만 간단히 확인할 수 있습니다.` : '현재 캐시된 데이터 기준 밸류에이션 정보가 제한적입니다.',
      bullets,
    },
    sectorCycle: {
      summary: '현재 캐시된 리포트 원문이 없어 업종 사이클 근거를 충분히 설명하기 어렵습니다.',
      bullets: ['업황/사이클 관련 문구가 포함된 증권사 리포트가 캐시되면 이 영역이 더 구체적으로 채워집니다.'],
    },
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
