const express = require('express');
const cors = require('cors');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
};

// In-memory cache
const cache = {
  stock: new Map(),
  news: new Map(),
  exchangeRate: { rate: 1330, timestamp: 0 }
};

// Relative time formatter in Korean
function formatTimeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (isNaN(past.getTime())) return '방금 전';
  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return past.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// Fetch USD to KRW rate
async function getUsdKrwRate() {
  const now = Date.now();
  if (cache.exchangeRate.timestamp && (now - cache.exchangeRate.timestamp < 60000)) {
    return cache.exchangeRate.rate;
  }

  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X', {
      headers: DEFAULT_HEADERS
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (rate) {
        cache.exchangeRate = { rate: Math.round(rate * 100) / 100, timestamp: now };
        return cache.exchangeRate.rate;
      }
    }
  } catch (err) {
    console.error('USD/KRW fetch error:', err.message);
  }

  return cache.exchangeRate.rate || 1330;
}

// Market state helper
function resolveMarketState(tradingPeriods) {
  if (!tradingPeriods) return 'CLOSED';
  const nowSec = Math.floor(Date.now() / 1000);
  const { pre, regular, post } = tradingPeriods;

  if (regular && nowSec >= regular.start && nowSec < regular.end) return 'REGULAR';
  if (pre && nowSec >= pre.start && nowSec < pre.end) return 'PRE';
  if (post && nowSec >= post.start && nowSec < post.end) return 'POST';
  return 'CLOSED';
}

// Stock API
app.get('/api/stock', async (req, res) => {
  try {
    const range = req.query.range || '1d';
    const intervalMap = {
      '1d': '5m',
      '5d': '15m',
      '1mo': '1d',
      '6mo': '1d',
      '1y': '1wk'
    };
    const interval = req.query.interval || intervalMap[range] || '5m';
    const cacheKey = `${range}_${interval}`;
    const now = Date.now();

    const cached = cache.stock.get(cacheKey);
    if (cached && (now - cached.timestamp < 8000)) {
      return res.json(cached.data);
    }

    const [stockRes, usdKrw] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=${range}&interval=${interval}`, {
        headers: DEFAULT_HEADERS
      }),
      getUsdKrwRate()
    ]);

    if (!stockRes.ok) {
      throw new Error(`Yahoo Finance error: HTTP ${stockRes.status}`);
    }

    const stockData = await stockRes.json();
    const result = stockData?.chart?.result?.[0];
    if (!result) {
      throw new Error('Stock data not found in response');
    }

    const meta = result.meta || {};
    const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;
    const marketState = resolveMarketState(meta.currentTradingPeriod);

    // Parse time series for chart
    const timestamps = result.timestamp || [];
    const rawQuotes = result.indicators?.quote?.[0]?.close || [];
    const chartPoints = [];

    for (let i = 0; i < timestamps.length; i++) {
      const p = rawQuotes[i];
      if (p !== null && p !== undefined && !isNaN(p)) {
        chartPoints.push({
          time: timestamps[i] * 1000,
          price: Math.round(p * 100) / 100
        });
      }
    }

    const payload = {
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      currency: meta.currency || 'USD',
      exchange: meta.exchangeName || 'NASDAQ',
      price: Math.round(price * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      usdToKrw: usdKrw,
      krwPrice: Math.round(price * usdKrw),
      krwChange: Math.round(change * usdKrw),
      dayHigh: meta.regularMarketDayHigh ? Math.round(meta.regularMarketDayHigh * 100) / 100 : null,
      dayLow: meta.regularMarketDayLow ? Math.round(meta.regularMarketDayLow * 100) / 100 : null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? Math.round(meta.fiftyTwoWeekHigh * 100) / 100 : null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? Math.round(meta.fiftyTwoWeekLow * 100) / 100 : null,
      volume: meta.regularMarketVolume || null,
      marketState,
      range,
      interval,
      chartPoints,
      updatedAt: new Date().toISOString()
    };

    cache.stock.set(cacheKey, { timestamp: now, data: payload });
    res.json(payload);
  } catch (err) {
    console.error('/api/stock error:', err.message);
    // Return last cached data if available
    const lastCached = cache.stock.get('1d_5m');
    if (lastCached) {
      return res.json({ ...lastCached.data, isStale: true });
    }
    res.status(500).json({ error: '주가 정보를 가져오는데 실패했습니다: ' + err.message });
  }
});

// Clean HTML & special chars helper
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// News API
app.get('/api/news', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'ko';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const cacheKey = `news_${lang}`;
    const now = Date.now();

    const cached = cache.news.get(cacheKey);
    if (cached && (now - cached.timestamp < 15000)) {
      return res.json({ items: cached.items.slice(0, limit), cached: true, updatedAt: cached.updatedAt });
    }

    let url;
    if (lang === 'ko') {
      url = 'https://news.google.com/rss/search?q=' + encodeURIComponent('테슬라 OR TSLA') + '&hl=ko&gl=KR&ceid=KR:ko';
    } else {
      url = 'https://news.google.com/rss/search?q=' + encodeURIComponent('Tesla TSLA stock') + '&hl=en-US&gl=US&ceid=US:en';
    }

    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!response.ok) {
      throw new Error(`Google News RSS error: HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true
    });
    const parsed = parser.parse(xmlText);
    const rawItems = parsed?.rss?.channel?.item || [];
    const itemsList = Array.isArray(rawItems) ? rawItems : [rawItems];

    const processedItems = itemsList.slice(0, 20).map((item, idx) => {
      const rawTitle = cleanText(item.title || '');
      let title = rawTitle;
      let sourceName = '';

      if (typeof item.source === 'object' && item.source !== null) {
        sourceName = cleanText(item.source['#text'] || '');
      } else if (typeof item.source === 'string') {
        sourceName = cleanText(item.source);
      }

      // If source name not explicit or title ends with "- Source"
      const dashIdx = rawTitle.lastIndexOf(' - ');
      if (dashIdx !== -1) {
        if (!sourceName) {
          sourceName = rawTitle.slice(dashIdx + 3).trim();
        }
        title = rawTitle.slice(0, dashIdx).trim();
      }

      if (!sourceName) sourceName = lang === 'ko' ? '주요 언론' : 'News';

      const pubDate = item.pubDate || new Date().toISOString();
      const timeAgo = formatTimeAgo(pubDate);

      // Clean snippet from description
      let snippet = cleanText(item.description || '');
      if (snippet.length > 150) {
        snippet = snippet.slice(0, 150) + '...';
      }

      return {
        id: `news_${idx}_${Date.now()}`,
        title,
        source: sourceName,
        link: item.link || '#',
        pubDate,
        timeAgo,
        snippet
      };
    });

    const updatedAt = new Date().toISOString();
    cache.news.set(cacheKey, { timestamp: now, items: processedItems, updatedAt });

    res.json({
      items: processedItems.slice(0, limit),
      count: Math.min(processedItems.length, limit),
      lang,
      updatedAt
    });
  } catch (err) {
    console.error('/api/news error:', err.message);
    const lastCached = cache.news.get(`news_${req.query.lang === 'en' ? 'en' : 'ko'}`);
    if (lastCached) {
      return res.json({ items: lastCached.items.slice(0, 10), isStale: true });
    }
    res.status(500).json({ error: '뉴스를 가져오는데 실패했습니다: ' + err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 테슬라 실시간 주가 & 뉴스 서버 실행 완료!`);
  console.log(`🌐 접속 주소: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
