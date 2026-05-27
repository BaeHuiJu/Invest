const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const DOMESTIC_URL = 'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=258';
const OVERSEAS_URL = 'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=261';
const MAIN_URL = 'https://finance.naver.com/news/mainnews.naver';

const POSITIVE_KEYWORDS = ['상승', '급등', '호실적', '순매수', '금리인하', '회복', '성장', '서프라이즈', '반등', '강세', '최고', '개선', '증가'];
const NEGATIVE_KEYWORDS = ['하락', '급락', '실적악화', '순매도', '금리인상', '위기', '침체', '손실', '약세', '폭락', '최저', '악화', '급락', '사이드카'];
const NEUTRAL_KEYWORDS  = ['발표', '예상', '전망', '유지', '동결', '보합', '혼조', '대기'];

const CATEGORY_KEYWORDS = {
  '금리·통화': ['금리', '기준금리', '통화', '연준', 'Fed', 'FOMC', '피벗', '인플레이션', '긴축', '통안채'],
  '환율': ['환율', '원달러', '원화', '달러화', '강달러', '약달러', '위안', '엔화', '1500원', '1400원'],
  '수급': ['순매수', '순매도', '외국인', '외인', '기관', '수급', '매수세', '매도세', '사이드카', '팔자', '사자'],
  '실적': ['실적', '영업이익', '매출', '어닝', 'EPS', '순이익', '흑자', '적자', '분기'],
  '정책': ['정책', '정부', '규제', '법안', '부양', '지원', '세금', '관세', '제재', '공약', '대통령'],
};

const BEGINNER_TEMPLATES = [
  // 금리/통화 정책
  { keywords: ['금리', '인하'], explanation: '돈 빌리는 비용이 낮아져 주식시장에 좋은 소식이에요.' },
  { keywords: ['금리', '인상'], explanation: '돈 빌리는 비용이 올라가면 주식 매력이 떨어질 수 있어요.' },
  { keywords: ['연준', 'Fed'], explanation: '미국 중앙은행의 결정은 한국 주식시장에도 영향을 줘요.' },
  { keywords: ['인플레이션'], explanation: '물가가 올라가는 것인데, 기업 수익과 고객 부담에 영향을 줄 수 있어요.' },

  // 수급
  { keywords: ['외국인', '순매수'], explanation: '외국 투자자들이 한국 주식을 많이 사고 있어요. 긍정적인 신호에요.' },
  { keywords: ['외국인', '순매도'], explanation: '외국 투자자들이 한국 주식을 팔고 있어요. 주의가 필요해요.' },
  { keywords: ['기관', '순매수'], explanation: '대형 기관 투자자들이 사고 있어요. 좋은 신호예요.' },
  { keywords: ['기관', '순매도'], explanation: '기관들이 팔고 있어서 조심해야 할 시점이에요.' },

  // 실적
  { keywords: ['실적', '상승'], explanation: '기업이 예상보다 돈을 많이 벌었어요. 주가에 좋을 수 있어요.' },
  { keywords: ['실적', '하락'], explanation: '기업 이익이 줄었어요. 주가 하락 요인이 될 수 있어요.' },
  { keywords: ['영업이익'], explanation: '기업이 실제 사업으로 버는 돈을 말해요. 중요한 지표에요.' },
  { keywords: ['손실'], explanation: '기업이 손해를 봤어요. 주가 하락 원인이 될 수 있어요.' },

  // 환율
  { keywords: ['환율', '상승'], explanation: '달러 값이 올라갔어요. 수입품 가격이 올라갈 수 있어요.' },
  { keywords: ['원달러', '1500'], explanation: '원화 약세가 심해요. 수출 회사에는 좋지만 수입품은 비싸져요.' },
  { keywords: ['환율'], explanation: '환율 변동은 수출입 기업 수익에 큰 영향을 줘요.' },

  // 시장 급변
  { keywords: ['급등'], explanation: '주가가 갑자기 많이 올랐어요. 그 이유가 뭔지 꼭 확인해 보세요.' },
  { keywords: ['급락', '폭락'], explanation: '주가가 갑자기 많이 떨어졌어요. 패닉 판매는 위험해요. 침착함이 중요합니다.' },
  { keywords: ['사이드카'], explanation: '주가 급락으로 매도 제한이 발동됐어요. 시장이 매우 흔들리는 중이에요.' },

  // 정책/규제
  { keywords: ['정책', '지원'], explanation: '정부가 특정 산업을 지원하려고 해요. 해당 기업들에 좋을 수 있어요.' },
  { keywords: ['규제', '강화'], explanation: '정부 규제가 더 엄해진대요. 해당 기업들에 부담이 될 수 있어요.' },
  { keywords: ['관세'], explanation: '수입품에 세금을 붙이려고 해요. 물가와 기업 비용에 영향을 줄 수 있어요.' },
];

// 감정 기반 기본 설명
const SENTIMENT_TEMPLATES = {
  positive: '좋은 소식이 나왔어요. 시장이 긍정적으로 반응할 가능성이 있어요.',
  negative: '안 좋은 소식이 나왔어요. 시장 하락 요인이 될 수 있으니 주의하세요.',
  neutral: '시장 뉴스가 나왔어요. 추가 정보를 찾아보고 판단하세요.',
};

const DEFAULT_EXPLANATION = '시장에 영향을 줄 수 있는 소식이에요. 천천히 내용을 읽어보세요.';

function decodeHtmlEntities(str) {
  return str
    .replace(/&hellip;/g, '...')
    .replace(/&uarr;/g, '↑')
    .replace(/&darr;/g, '↓')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripHtml(str) {
  return decodeHtmlEntities(str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

async function fetchNaverHtml(url) {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) return '';
    const buffer = await response.arrayBuffer();
    return new TextDecoder('euc-kr').decode(buffer);
  } catch {
    return '';
  }
}

function parseNaverTime(rawTime) {
  const cleaned = rawTime.trim();
  // Format: "YYYY-MM-DD HH:mm"
  const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, mo, d, h, m] = isoMatch;
    return `${y}-${mo}-${d}T${h}:${m}:00+09:00`;
  }
  // Format: "YYYY.MM.DD HH:mm"
  const dotMatch = cleaned.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if (dotMatch) {
    const [, y, mo, d, h, m] = dotMatch;
    return `${y}-${mo}-${d}T${h}:${m}:00+09:00`;
  }
  // Format: "HH:mm" (same day KST)
  const timeOnly = cleaned.match(/^(\d{2}):(\d{2})$/);
  if (timeOnly) {
    const [, h, m] = timeOnly;
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstDate = nowKst.toISOString().slice(0, 10);
    return `${kstDate}T${h}:${m}:00+09:00`;
  }
  return new Date().toISOString();
}

function isBreakingNews(publishedAt) {
  return Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000;
}

function scoreSentiment(title) {
  const titleLower = title.toLowerCase();

  // 1. 부정어 처리 (예: "약세 아님" → 긍정)
  const negationPatterns = [
    /(?:아닌|아님|아니다|아니라|없\w*)\s+\w*(부정|약세|하락|약화)/gi,
    /\w*(부정|약세|하락|약화)\s+(?:아닌|아님|아니다|아니라|없\w*)/gi,
  ];
  const hasNegation = negationPatterns.some(p => p.test(titleLower));

  // 2. 강조 정도 측정 (급, 폭, 급등, 급락)
  const intensifiers = (titleLower.match(/(?:급|폭|최고|최저)/g) || []).length;

  // 3. 중복 제거하고 키워드 매칭 (각 카테고리당 최대 1회만 카운트)
  const posSet = new Set();
  const negSet = new Set();

  for (const kw of POSITIVE_KEYWORDS) {
    if (titleLower.includes(kw.toLowerCase())) posSet.add(kw);
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (titleLower.includes(kw.toLowerCase())) negSet.add(kw);
  }

  const posCount = posSet.size;
  const negCount = negSet.size;

  // 4. 기본 점수 계산
  let score = 50;
  const diff = posCount - negCount;

  if (hasNegation && negCount > 0) {
    // 부정어가 있으면 반대로 해석
    score = 60 + Math.min(diff * 8, 35);
  } else if (diff > 0) {
    // 긍정 키워드가 많음
    score = 60 + Math.min(diff * 8, 35);
  } else if (diff < 0) {
    // 부정 키워드가 많음
    score = 40 - Math.min(Math.abs(diff) * 8, 35);
  }

  // 5. 강조 정도 적용 (±5점)
  score += Math.min(intensifiers * 2, 5);

  // 6. 범위 제한 및 반올림
  score = Math.round(Math.max(0, Math.min(100, score)));

  // 7. 감정 판정
  const sentiment = score < 40 ? 'negative' : score > 60 ? 'positive' : 'neutral';
  const sentimentScore = Math.round(score / 100 * 2 - 1, 2); // -1.0 ~ 1.0 범위로 정규화

  return { sentiment, sentimentScore };
}

function detectCategory(title) {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => title.includes(kw))) return cat;
  }
  return 'all';
}

function getBeginnerExplanation(title, sentiment) {
  const titleLower = title.toLowerCase();

  // 1단계: 정확한 매칭 (모든 키워드 포함)
  for (const { keywords, explanation } of BEGINNER_TEMPLATES) {
    if (keywords.every((kw) => titleLower.includes(kw.toLowerCase()))) {
      return explanation;
    }
  }

  // 2단계: 부분 매칭 (하나의 키워드 포함)
  // 가중치: 먼저 나온 템플릿이 우선
  for (const { keywords, explanation } of BEGINNER_TEMPLATES) {
    if (keywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
      return explanation;
    }
  }

  // 3단계: 감정 기반 기본 설명 반환
  return SENTIMENT_TEMPLATES[sentiment] || DEFAULT_EXPLANATION;
}

/**
 * Naver Finance news list page (mode=LSS2D) structure:
 * <dl>
 *   <dt class="thumb"><a href="...article_id=XXX&office_id=YYY..."><img></a></dt>
 *   <dd class="articleSubject"><a href="..." title="제목">제목</a></dd>
 *   <dd class="articleSummary">
 *     <span class="press">언론사</span>
 *     <span class="wdate">2026-05-18 09:26</span>
 *   </dd>
 * </dl>
 */
function extractListNewsItems(html, source) {
  const items = [];
  const seen = new Set();

  // Extract each articleSubject block and look backward for the article_id in the dt block
  const subjectPattern = /<dd[^>]+class="articleSubject"[^>]*>([\s\S]*?)<\/dd>/gi;
  let match;

  while ((match = subjectPattern.exec(html)) !== null) {
    const block = match[1];

    // Get href with article_id and office_id
    const hrefMatch = /article_id=(\d+)[^&"]*[&"](?:[^"]*)?office_id=(\d+)/.exec(block)
      || /office_id=(\d+)[^&"]*[&"](?:[^"]*)?article_id=(\d+)/.exec(block);

    let articleId, officeId;
    if (hrefMatch) {
      // Determine which group is which based on which key matched first
      const fullHref = block.match(/href="([^"]+)"/);
      if (fullHref) {
        const aId = /article_id=(\d+)/.exec(fullHref[1]);
        const oId = /office_id=(\d+)/.exec(fullHref[1]);
        if (aId) articleId = aId[1];
        if (oId) officeId = oId[1];
      }
    }
    if (!articleId || !officeId) continue;

    const id = `${officeId}_${articleId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Title: prefer title attribute, fallback to text content
    const titleAttr = /title="([^"]+)"/.exec(block);
    let rawTitle = titleAttr ? decodeHtmlEntities(titleAttr[1]) : stripHtml(block.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, ''));
    rawTitle = rawTitle.trim();
    if (!rawTitle || rawTitle.length < 5) continue;

    // Look forward for the articleSummary block (press + wdate)
    const afterIdx = match.index + match[0].length;
    const nextArticle = html.indexOf('class="articleSubject"', afterIdx);
    const searchEnd = nextArticle > 0 ? nextArticle : afterIdx + 1500;
    const searchRange = html.substring(afterIdx, searchEnd);

    const pressMatch = /<span[^>]+class="press"[^>]*>([\s\S]*?)<\/span>/i.exec(searchRange);
    const pressName = pressMatch ? stripHtml(pressMatch[1]) : '네이버금융';

    const wdateMatch = /<span[^>]+class="wdate"[^>]*>([\s\S]*?)<\/span>/i.exec(searchRange);
    const rawTime = wdateMatch ? stripHtml(wdateMatch[1]) : '';
    const publishedAt = parseNaverTime(rawTime);

    const url = `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`;
    const { sentiment, sentimentScore } = scoreSentiment(rawTitle);

    items.push({
      id,
      title: rawTitle,
      pressName,
      publishedAt,
      url,
      source,
      sentiment,
      sentimentScore,
      category: detectCategory(rawTitle),
      isBreaking: isBreakingNews(publishedAt),
      beginnerExplanation: getBeginnerExplanation(rawTitle, sentiment),
    });
  }

  return items;
}

/**
 * Naver Finance main news page uses a different structure with <li> blocks.
 */
function extractMainNewsItems(html) {
  const items = [];
  const seen = new Set();

  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liPattern.exec(html)) !== null) {
    const block = match[1];
    const fullHref = block.match(/href="([^"]+)"/);
    if (!fullHref) continue;

    const aId = /article_id=(\d+)/.exec(fullHref[1]);
    const oId = /office_id=(\d+)/.exec(fullHref[1]);
    if (!aId || !oId) continue;

    const articleId = aId[1];
    const officeId = oId[1];
    const id = `${officeId}_${articleId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Prefer title attribute
    const titleAttr = /title="([^"]+)"/.exec(block);
    const anchorText = /<a[^>]+>([\s\S]*?)<\/a>/i.exec(block);
    let rawTitle = titleAttr
      ? decodeHtmlEntities(titleAttr[1])
      : anchorText ? stripHtml(anchorText[1]) : '';
    rawTitle = rawTitle.trim();
    if (!rawTitle || rawTitle.length < 5) continue;

    const pressMatch = /<span[^>]+class="[^"]*press[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const pressName = pressMatch ? stripHtml(pressMatch[1]) : '네이버금융';

    const dateMatch = /<span[^>]+class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const rawTime = dateMatch ? stripHtml(dateMatch[1]) : '';
    const publishedAt = parseNaverTime(rawTime);

    const url = `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`;
    const { sentiment, sentimentScore } = scoreSentiment(rawTitle);

    items.push({
      id,
      title: rawTitle,
      pressName,
      publishedAt,
      url,
      source: 'main',
      sentiment,
      sentimentScore,
      category: detectCategory(rawTitle),
      isBreaking: isBreakingNews(publishedAt),
      beginnerExplanation: getBeginnerExplanation(rawTitle, sentiment),
    });
  }

  return items;
}

async function fetchWithRetry(url, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: FETCH_HEADERS, timeout: 5000 });
      if (!response.ok) {
        console.warn(`[news-scraper] HTTP ${response.status} from ${url}`);
        if (attempt < maxRetries) continue;
        return '';
      }
      const buffer = await response.arrayBuffer();
      return new TextDecoder('euc-kr').decode(buffer);
    } catch (error) {
      lastError = error;
      console.warn(`[news-scraper] Attempt ${attempt + 1} failed for ${url}: ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  console.error(`[news-scraper] Failed to fetch ${url} after ${maxRetries + 1} attempts:`, lastError);
  return '';
}

async function fetchDomesticNews() {
  try {
    const html = await fetchWithRetry(DOMESTIC_URL);
    if (!html) {
      console.warn('[news-scraper] Empty HTML for domestic news');
      return [];
    }
    const items = extractListNewsItems(html, 'domestic');
    console.log(`[news-scraper] Fetched ${items.length} domestic news items`);
    return items;
  } catch (error) {
    console.error('[news-scraper] Error fetching domestic news:', error);
    return [];
  }
}

async function fetchOverseasNews() {
  try {
    const html = await fetchWithRetry(OVERSEAS_URL);
    if (!html) {
      console.warn('[news-scraper] Empty HTML for overseas news');
      return [];
    }
    const items = extractListNewsItems(html, 'overseas');
    console.log(`[news-scraper] Fetched ${items.length} overseas news items`);
    return items;
  } catch (error) {
    console.error('[news-scraper] Error fetching overseas news:', error);
    return [];
  }
}

async function fetchMainNews() {
  try {
    const html = await fetchWithRetry(MAIN_URL);
    if (!html) {
      console.warn('[news-scraper] Empty HTML for main news');
      return [];
    }
    const items = extractMainNewsItems(html);
    console.log(`[news-scraper] Fetched ${items.length} main news items`);
    return items;
  } catch (error) {
    console.error('[news-scraper] Error fetching main news:', error);
    return [];
  }
}

export async function buildNewsCacheFile() {
  console.log('[news-scraper] Starting news scrape...');
  const startTime = Date.now();

  const [domestic, overseas, main] = await Promise.all([
    fetchDomesticNews(),
    fetchOverseasNews(),
    fetchMainNews(),
  ]);

  const seen = new Set();
  const dedup = (items) => items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const domesticDedup = dedup(domestic);
  const overseasDedup = dedup(overseas);
  const mainDedup = dedup(main);

  const elapsedMs = Date.now() - startTime;
  const totalItems = domesticDedup.length + overseasDedup.length + mainDedup.length;

  console.log(`[news-scraper] Completed in ${elapsedMs}ms`);
  console.log(`[news-scraper] Total items: ${totalItems} (domestic: ${domesticDedup.length}, overseas: ${overseasDedup.length}, main: ${mainDedup.length})`);

  return {
    generatedAt: new Date().toISOString(),
    domestic: domesticDedup,
    overseas: overseasDedup,
    main: mainDedup,
  };
}
