const http = require('http');
const fs = require('fs');
const path = require('path');

// Reuse existing utility functions from server.js by importing them if modularized.
// For simplicity, copy essential logic directly here.

const PORT = 8000; // Not used in Vercel function
const ROOT = __dirname.replace(/\/api$/, ''); // project root directory

const quoteMap = {
  '^IXIC': '^ndq',
  '^GSPC': '^spx',
  '^KS11': '^kospi',
  '^KQ11': '^kosdaq'
};
const chartMap = {
  US10Y: '10us.b',
  US2Y: '2us.b',
  USDKRW: 'usdkrw',
  VIX: '^vix',
  SOX: '^sox',
  WTI: 'cl.f',
  DXY: 'dx.f',
  NASDAQ: '^ndq',
  SP500: '^spx',
  KOSPI: '^kospi',
  KOSDAQ: '^kosdaq',
  GOLD: 'GC=F'
};

const quoteCache = new Map();
const summaryItems = [
  { name: '코스피', symbol: '^KS11', popup: true, popupKey: 'KOSPI' },
  { name: '코스닥', symbol: '^KQ11', popup: true, popupKey: 'KOSDAQ' },
  { name: '나스닥', symbol: '^IXIC', popup: true, popupKey: 'NASDAQ' },
  { name: 'S&P500', symbol: '^GSPC', popup: true, popupKey: 'SP500' }
];
const quoteFallbackKeyMap = {
  '^IXIC': 'NASDAQ',
  '^GSPC': 'SP500',
  '^KS11': 'KOSPI',
  '^KQ11': 'KOSDAQ'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function fallbackQuoteFromSeries(symbol) {
  const key = quoteFallbackKeyMap[symbol];
  if (!key) return null;
  const rows = await fetchChartSeries(key);
  if (!rows || rows.length < 2) return null;
  const last = rows[rows.length - 1].close;
  const prev = rows[rows.length - 2].close;
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
  return { symbol, price: last, changePercent: ((last - prev) / prev) * 100, asOf: rows[rows.length - 1].date, raw: 'fallback-from-series' };
}

async function fetchStooq(symbol) {
  if (['^KS11', '^KQ11', '^IXIC', '^GSPC'].includes(symbol)) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=2m`;
      const yr = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const yj = await yr.json();
      const result = yj?.chart?.result?.[0];
      if (result && result.meta && typeof result.meta.regularMarketPrice === 'number') {
        const price = result.meta.regularMarketPrice;
        const prevClose = result.meta.chartPreviousClose;
        let change = result.meta.regularMarketChangePercent ?? 0;
        if (typeof prevClose === 'number' && prevClose !== 0) {
          change = ((price - prevClose) / prevClose) * 100;
        }
        const asOf = new Date().toISOString();
        const out = { symbol, price, changePercent: change, asOf, raw: 'yahoo' };
        quoteCache.set(symbol, out);
        return out;
      }
    } catch (_) {
      // fall back
    }
  }

  const stooq = quoteMap[symbol];
  if (!stooq) return null;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooq)}&f=sd2t2ohlcv&e=csv`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const t = (await r.text()).trim();
  const parts = t.split(',');
  if (parts.length < 7) return null;
  const close = Number(parts[6]);
  const open = Number(parts[3]);
  // Calculate percent
  let changePercent = null;
  const chartKey = quoteFallbackKeyMap[symbol];
  if (chartKey) {
    const series = await fetchChartSeries(chartKey);
    if (series && series.length >= 2) {
      const lastClose = series[series.length - 1].close;
      const prevClose = series[series.length - 2].close;
      if (Number.isFinite(lastClose) && Number.isFinite(prevClose) && prevClose !== 0) {
        changePercent = ((lastClose - prevClose) / prevClose) * 100;
      }
    }
  }
  if (changePercent === null) {
    if (Number.isFinite(close) && Number.isFinite(open) && open !== 0) {
      changePercent = ((close - open) / open) * 100;
    } else {
      changePercent = 0;
    }
  }
  const out = { symbol, price: close, changePercent, asOf: parts[1], raw: t };
  quoteCache.set(symbol, out);
  return out;
}

async function fetchChartSeries(key, interval = '1d') {
  if (key === 'US10Y') {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?range=1y&interval=1d';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await r.json();
    const result = json?.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const rows = [];
    for (let i = 0; i < ts.length; i++) {
      const close = Number(closes[i]);
      if (!Number.isFinite(close) || close <= 0) continue;
      const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
      rows.push({ date, close });
    }
    if (!rows.length) return null;
    return rows.slice(-120);
  }
  // other keys handled similarly to original server.js (omitted for brevity)
  const stooq = chartMap[key];
  if (!stooq) return null;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooq)}&i=d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const csv = (await r.text()).trim();
  const lines = csv.split('\n');
  if (lines.length < 3) return null;
  const rows = lines.slice(-120).map(line => {
    const p = line.split(',');
    return { date: p[0], close: Number(p[4]) };
  }).filter(x => Number.isFinite(x.close));
  return rows.length ? rows : null;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/quote') {
    try {
      const symbol = url.searchParams.get('symbol') || '';
      const q = await fetchStooq(symbol);
      if (!q) return send(res, 404, JSON.stringify({ ok: false, error: 'no data' }), 'application/json');
      return send(res, 200, JSON.stringify({ ok: true, quote: q }), 'application/json');
    } catch (e) {
      return send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), 'application/json');
    }
  }
  if (url.pathname === '/api/chart') {
    try {
      const key = url.searchParams.get('key') || '';
      const interval = url.searchParams.get('interval') || '1d';
      const rows = await fetchChartSeries(key, interval);
      if (!rows) return send(res, 404, JSON.stringify({ ok: false, error: 'no data' }), 'application/json');
      return send(res, 200, JSON.stringify({ ok: true, series: rows }), 'application/json');
    } catch (e) {
      return send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), 'application/json');
    }
  }
  if (url.pathname === '/api/stats') {
    try {
      const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://finance.daum.net/' };
      // Fetch Naver program trading
      const rKospi = await fetch('https://finance.naver.com/sise/sise_index.naver?code=KOSPI', { headers });
      const bufKospi = await rKospi.arrayBuffer();
      let textKospi = '';
      if (typeof TextDecoder !== 'undefined') {
        textKospi = new TextDecoder('euc-kr').decode(bufKospi);
      } else {
        textKospi = Buffer.from(bufKospi).toString();
      }
      const mProg = textKospi.match(/전체<br><span class="[^"]+"\>([+-]?[\d,]+)억/);
      const prog = mProg ? parseInt(mProg[1].replace(/,/g, '')) : 0;
      // Daum turnover & foreign
      const rKospiDaum = await fetch('https://finance.daum.net/api/market_index/days?page=1&perPage=20&market=KOSPI&pagination=true', { headers });
      const jsonKospi = await rKospiDaum.json();
      const kospiData = jsonKospi.data || [];
      const rKosdaqDaum = await fetch('https://finance.daum.net/api/market_index/days?page=1&perPage=2&market=KOSDAQ&pagination=true', { headers });
      const jsonKosdaq = await rKosdaqDaum.json();
      const kosdaqData = jsonKosdaq.data || [];
      let kospiTurnover = 0, kosdaqTurnover = 0;
      let kospiTurnoverDiff = '0', kosdaqTurnoverDiff = '0';
      let futuresArray = [0, 0, 0, 0, 0];
      let progsArray = [prog, 0, 0, 0, 0];
      if (kospiData.length >= 2) {
        kospiTurnover = Math.round(kospiData[0].accTradePrice);
        const diff = (kospiData[0].accTradePrice - kospiData[1].accTradePrice) / 1000000;
        kospiTurnoverDiff = diff.toFixed(2);
        let sum = 0;
        for (let i = 0; i < kospiData.length && i < 20; i++) {
          sum += Math.round(kospiData[i].foreignStraightPurchasePrice / 100000000);
          if (i === 0) futuresArray[0] = sum;
          if (i === 2) futuresArray[1] = sum;
          if (i === 4) futuresArray[2] = sum;
          if (i === 9) futuresArray[3] = sum;
          if (i === 19 || i === kospiData.length - 1) futuresArray[4] = sum;
        }
        if (futuresArray[0] !== 0) {
          const ratio = prog / futuresArray[0];
          progsArray[1] = Math.round(futuresArray[1] * ratio);
          progsArray[2] = Math.round(futuresArray[2] * ratio);
          progsArray[3] = Math.round(futuresArray[3] * ratio);
          progsArray[4] = Math.round(futuresArray[4] * ratio);
        } else {
          progsArray = [prog, prog * 3, prog * 5, prog * 10, prog * 20];
        }
      }
      if (kosdaqData.length >= 2) {
        kosdaqTurnover = Math.round(kosdaqData[0].accTradePrice);
        const diff = (kosdaqData[0].accTradePrice - kosdaqData[1].accTradePrice) / 1000000;
        kosdaqTurnoverDiff = diff.toFixed(2);
      }
      return send(res, 200, JSON.stringify({
        ok: true,
        kospiTurnover: kospiTurnover.toLocaleString(),
        kosdaqTurnover: kosdaqTurnover.toLocaleString(),
        kospiTurnoverDiff,
        kosdaqTurnoverDiff,
        futuresArray,
        progsArray
      }), 'application/json');
    } catch (e) {
      console.error(e);
      return send(res, 500, JSON.stringify({ ok: false }), 'application/json');
    }
  }
  // Serve static files for any other route
  const targetPath = path.join(ROOT, url.pathname === '/' ? '/index.html' : url.pathname);
  if (!targetPath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) return send(res, 404, 'Not found');
  const ext = path.extname(targetPath).toLowerCase();
  const type = ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  send(res, 200, fs.readFileSync(targetPath), type);
};
