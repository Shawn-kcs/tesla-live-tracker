/**
 * TSLA Live Tracker - Frontend Client Logic
 * Real-time Tesla stock and news aggregator
 */

(function () {
  'use strict';

  // --- App State ---
  const state = {
    range: '1d',
    lang: 'ko',
    autoRefresh: true,
    intervalSec: 30,
    countdownSec: 30,
    timerId: null,
    countdownIntervalId: null,
    isRefreshing: false,
    stockData: null,
    allNews: [],
    searchQuery: '',
    chartInstance: null
  };

  // --- DOM Elements ---
  const el = {
    // Header & Controls
    connectionStatus: document.getElementById('connection-status'),
    autoRefreshCheck: document.getElementById('auto-refresh-check'),
    intervalSelect: document.getElementById('interval-select'),
    manualRefreshBtn: document.getElementById('manual-refresh-btn'),
    lastUpdatedTime: document.getElementById('last-updated-time'),
    countdownText: document.getElementById('countdown-text'),
    countdownFill: document.getElementById('countdown-fill'),

    // Stock elements
    marketBadge: document.getElementById('market-badge'),
    stockPrice: document.getElementById('stock-price'),
    priceChangePill: document.getElementById('price-change-pill'),
    changeArrow: document.getElementById('change-arrow'),
    changeAmount: document.getElementById('change-amount'),
    changePercent: document.getElementById('change-percent'),
    krwPrice: document.getElementById('krw-price'),
    usdKrwRate: document.getElementById('usd-krw-rate'),

    // Stats
    statPrevClose: document.getElementById('stat-prev-close'),
    statDayRange: document.getElementById('stat-day-range'),
    stat52wRange: document.getElementById('stat-52w-range'),
    statVolume: document.getElementById('stat-volume'),

    // Chart
    rangeButtons: document.getElementById('range-buttons'),
    chartCanvas: document.getElementById('stockChart'),
    chartLoading: document.getElementById('chart-loading'),
    chartRangeChange: document.getElementById('chart-range-change'),

    // News
    tabKo: document.getElementById('tab-ko'),
    tabEn: document.getElementById('tab-en'),
    newsSearchInput: document.getElementById('news-search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    newsCountNum: document.getElementById('news-count-num'),
    newsSyncTime: document.getElementById('news-sync-time'),
    newsList: document.getElementById('news-list'),
    newsEmptyState: document.getElementById('news-empty-state'),
    resetSearchBtn: document.getElementById('reset-search-btn'),

    // Toast
    toast: document.getElementById('toast')
  };

  // --- Utility Functions ---
  function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('ko-KR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatCompactNumber(num) {
    if (!num || isNaN(num)) return '-';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  function showToast(message, duration = 2500) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(el.toast._timer);
    el.toast._timer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, duration);
  }

  function formatTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  // --- Stock UI Rendering ---
  function updateStockUI(data) {
    state.stockData = data;

    // Price & KRW
    el.stockPrice.textContent = formatNumber(data.price);
    el.krwPrice.textContent = Number(data.krwPrice).toLocaleString('ko-KR');
    el.usdKrwRate.textContent = Number(data.usdToKrw).toLocaleString('ko-KR');

    // Change Pill
    const isUp = data.change > 0;
    const isDown = data.change < 0;
    const sign = isUp ? '+' : '';

    el.priceChangePill.className = 'change-pill ' + (isUp ? 'up' : isDown ? 'down' : 'neutral');
    el.changeArrow.textContent = isUp ? '▲' : isDown ? '▼' : '•';
    el.changeAmount.textContent = `${sign}$${formatNumber(Math.abs(data.change))}`;
    el.changePercent.textContent = `(${sign}${formatNumber(data.changePercent)}%)`;

    // Market State
    const marketStateMap = {
      REGULAR: { text: '🟢 정규장 거래중', class: 'regular' },
      PRE: { text: '🟡 프리마켓', class: 'pre' },
      POST: { text: '🟣 애프터마켓', class: 'post' },
      CLOSED: { text: '⚪ 장 마감', class: 'closed' }
    };
    const marketInfo = marketStateMap[data.marketState] || { text: data.marketState, class: 'closed' };
    el.marketBadge.textContent = marketInfo.text;
    el.marketBadge.className = `badge badge-market ${marketInfo.class}`;

    // Stats Grid
    el.statPrevClose.textContent = `$${formatNumber(data.prevClose)}`;
    el.statDayRange.textContent = `$${formatNumber(data.dayLow)} - $${formatNumber(data.dayHigh)}`;
    el.stat52wRange.textContent = `$${formatNumber(data.fiftyTwoWeekLow)} - $${formatNumber(data.fiftyTwoWeekHigh)}`;
    el.statVolume.textContent = `${formatCompactNumber(data.volume)} 주`;

    // Update Timestamp
    el.lastUpdatedTime.textContent = formatTime(data.updatedAt);

    // Update Chart
    renderChart(data);
  }

  // --- Chart.js Rendering ---
  function renderChart(data) {
    if (!el.chartCanvas || !window.Chart) return;

    const points = data.chartPoints || [];
    if (points.length === 0) return;

    const isRise = data.change >= 0;
    const primaryColor = isRise ? '#f43f5e' : '#38bdf8';
    const gradientTop = isRise ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.35)';
    const gradientBottom = 'rgba(24, 32, 50, 0.0)';

    const labels = points.map(pt => {
      const d = new Date(pt.time);
      if (state.range === '1d') {
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    });

    const prices = points.map(pt => pt.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.08 || 1;

    // Period change
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const periodChange = lastPrice - firstPrice;
    const periodPercent = firstPrice ? (periodChange / firstPrice) * 100 : 0;
    const sign = periodChange >= 0 ? '+' : '';
    el.chartRangeChange.textContent = `${sign}${formatNumber(periodPercent)}% (${state.range.toUpperCase()})`;
    el.chartRangeChange.style.color = periodChange >= 0 ? '#fb7185' : '#38bdf8';

    if (state.chartInstance) {
      state.chartInstance.data.labels = labels;
      state.chartInstance.data.datasets[0].data = prices;
      state.chartInstance.data.datasets[0].borderColor = primaryColor;
      state.chartInstance.options.scales.y.min = Math.floor(minPrice - padding);
      state.chartInstance.options.scales.y.max = Math.ceil(maxPrice + padding);
      state.chartInstance.update('none');
      return;
    }

    const ctx = el.chartCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, gradientTop);
    gradient.addColorStop(1, gradientBottom);

    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'TSLA 주가 ($)',
          data: prices,
          borderColor: primaryColor,
          backgroundColor: gradient,
          fill: true,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: points.length > 50 ? 0 : 2,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: primaryColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(18, 24, 38, 0.95)',
            titleColor: '#94a3b8',
            bodyColor: '#fff',
            borderColor: '#27344f',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function (context) {
                return `주가: $${formatNumber(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              maxTicksLimit: 7,
              font: { size: 11, family: 'var(--font-mono)' }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { size: 11, family: 'var(--font-mono)' },
              callback: val => `$${val}`
            },
            min: Math.floor(minPrice - padding),
            max: Math.ceil(maxPrice + padding)
          }
        }
      }
    });
  }

  // --- News UI Rendering ---
  function renderNews() {
    const query = state.searchQuery.toLowerCase().trim();
    let filtered = state.allNews;

    if (query) {
      filtered = state.allNews.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        (item.snippet && item.snippet.toLowerCase().includes(query))
      );
    }

    el.newsCountNum.textContent = filtered.length;

    if (filtered.length === 0) {
      el.newsList.innerHTML = '';
      el.newsEmptyState.classList.remove('hidden');
      return;
    }

    el.newsEmptyState.classList.add('hidden');

    const html = filtered.map((item, idx) => `
      <article class="news-card">
        <div>
          <div class="news-card-meta">
            <span class="news-source-tag">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              ${item.source}
            </span>
            <span class="news-time-tag">${item.timeAgo}</span>
          </div>

          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-title" title="${item.title}">
            ${item.title}
          </a>

          ${item.snippet ? `<p class="news-snippet">${item.snippet}</p>` : ''}
        </div>

        <div class="news-card-footer">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="btn-news-link">
            <span>원문 기사 읽기</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
          </a>
          <span class="news-index-num">#${idx + 1}</span>
        </div>
      </article>
    `).join('');

    el.newsList.innerHTML = html;
  }

  // --- API Fetching ---
  async function fetchStock(range = state.range) {
    try {
      const res = await fetch(`/api/stock?range=${range}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      updateStockUI(data);
      el.connectionStatus.textContent = '실시간 연결됨';
      el.connectionStatus.style.color = 'var(--text-secondary)';
      return true;
    } catch (err) {
      console.error('Fetch stock error:', err);
      el.connectionStatus.textContent = '주가 데이터 지연';
      el.connectionStatus.style.color = '#fbbf24';
      return false;
    }
  }

  async function fetchNews(lang = state.lang) {
    try {
      const res = await fetch(`/api/news?lang=${lang}&limit=10`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.allNews = data.items || [];
      el.newsSyncTime.textContent = formatTime(data.updatedAt);
      renderNews();
      return true;
    } catch (err) {
      console.error('Fetch news error:', err);
      return false;
    }
  }

  async function refreshAll(notify = false) {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    el.manualRefreshBtn.classList.add('spinning');
    el.manualRefreshBtn.disabled = true;

    try {
      await Promise.all([fetchStock(), fetchNews()]);
      if (notify) {
        showToast('⚡ 최신 주가 및 테슬라 뉴스가 업데이트되었습니다.');
      }
    } finally {
      state.isRefreshing = false;
      el.manualRefreshBtn.classList.remove('spinning');
      el.manualRefreshBtn.disabled = false;
      resetCountdown();
    }
  }

  // --- Countdown & Auto-Refresh Timer ---
  function resetCountdown() {
    state.countdownSec = state.intervalSec;
    updateCountdownUI();
  }

  function updateCountdownUI() {
    if (!state.autoRefresh) {
      el.countdownText.textContent = '자동 갱신 정지';
      el.countdownFill.style.width = '0%';
      return;
    }

    el.countdownText.textContent = `다음 갱신: ${state.countdownSec}초`;
    const percent = ((state.countdownSec / state.intervalSec) * 100);
    el.countdownFill.style.width = `${percent}%`;
  }

  function startTimers() {
    clearInterval(state.countdownIntervalId);

    state.countdownIntervalId = setInterval(() => {
      if (!state.autoRefresh) return;

      state.countdownSec--;
      if (state.countdownSec <= 0) {
        refreshAll(false);
      } else {
        updateCountdownUI();
      }
    }, 1000);
  }

  // --- Event Listeners ---
  function setupEvents() {
    // Manual Refresh
    el.manualRefreshBtn.addEventListener('click', () => {
      refreshAll(true);
    });

    // Auto Refresh Toggle
    el.autoRefreshCheck.addEventListener('change', (e) => {
      state.autoRefresh = e.target.checked;
      if (state.autoRefresh) {
        resetCountdown();
        showToast('자동 새로고침이 활성화되었습니다.');
      } else {
        updateCountdownUI();
        showToast('자동 새로고침이 일시 중지되었습니다.');
      }
    });

    // Interval Select
    el.intervalSelect.addEventListener('change', (e) => {
      state.intervalSec = parseInt(e.target.value, 10);
      resetCountdown();
      showToast(`갱신 주기가 ${state.intervalSec}초로 변경되었습니다.`);
    });

    // Chart Range Buttons
    el.rangeButtons.addEventListener('click', async (e) => {
      const btn = e.target.closest('.range-btn');
      if (!btn || btn.dataset.range === state.range) return;

      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.range = btn.dataset.range;
      el.chartLoading.classList.add('visible');

      // Recreate chart for range change
      if (state.chartInstance) {
        state.chartInstance.destroy();
        state.chartInstance = null;
      }

      await fetchStock(state.range);
      el.chartLoading.classList.remove('visible');
    });

    // News Language Tabs
    el.tabKo.addEventListener('click', async () => {
      if (state.lang === 'ko') return;
      state.lang = 'ko';
      el.tabKo.classList.add('active');
      el.tabEn.classList.remove('active');
      el.newsList.innerHTML = '<div class="news-card skeleton"><div class="skeleton-line w-30"></div><div class="skeleton-line w-80"></div></div>';
      await fetchNews('ko');
    });

    el.tabEn.addEventListener('click', async () => {
      if (state.lang === 'en') return;
      state.lang = 'en';
      el.tabEn.classList.add('active');
      el.tabKo.classList.remove('active');
      el.newsList.innerHTML = '<div class="news-card skeleton"><div class="skeleton-line w-30"></div><div class="skeleton-line w-80"></div></div>';
      await fetchNews('en');
    });

    // Search Input
    el.newsSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      el.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      renderNews();
    });

    el.clearSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      el.newsSearchInput.value = '';
      el.clearSearchBtn.style.display = 'none';
      renderNews();
      el.newsSearchInput.focus();
    });

    el.resetSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      el.newsSearchInput.value = '';
      el.clearSearchBtn.style.display = 'none';
      renderNews();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshAll(true);
      } else if (e.key === '/') {
        e.preventDefault();
        el.newsSearchInput.focus();
      }
    });
  }

  // --- Initializer ---
  async function init() {
    setupEvents();
    resetCountdown();
    startTimers();
    await refreshAll(false);
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
