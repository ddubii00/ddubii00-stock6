// utils.js - shared functions for Vercel API routes
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
const sectorSeriesCache = new Map();
const sectorStocksCache = new Map();

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json'
};

const DAUM_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://finance.daum.net/'
};

const sectorItems = [
  { code: '1002', name: 'KOSPI 대형주', daumSectorCode: '002' },
  { code: '1003', name: 'KOSPI 중형주', daumSectorCode: '003' },
  { code: '1004', name: 'KOSPI 소형주', daumSectorCode: '004' },
  { code: '1005', name: '음식료품', daumSectorCode: '005' },
  { code: '1006', name: '섬유·의복', daumSectorCode: '006' },
  { code: '1007', name: '종이·목재', daumSectorCode: '007' },
  { code: '1008', name: '화학', daumSectorCode: '008' },
  { code: '1009', name: '의약품', daumSectorCode: '009' },
  { code: '1010', name: '비금속광물', daumSectorCode: '010' },
  { code: '1011', name: '철강·금속', daumSectorCode: '011' },
  { code: '1012', name: '기계', daumSectorCode: '012' },
  { code: '1013', name: '전기·전자', daumSectorCode: '013' },
  { code: '1014', name: '의료정밀', daumSectorCode: '014' },
  { code: '1015', name: '운수장비', daumSectorCode: '015' },
  { code: '1016', name: '유통업', daumSectorCode: '016' },
  { code: '1017', name: '전기·가스업', daumSectorCode: '017' },
  { code: '1018', name: '건설업', daumSectorCode: '018' },
  { code: '1019', name: '운수·창고업', daumSectorCode: '019' },
  { code: '1020', name: '통신업', daumSectorCode: '020' },
  { code: '1021', name: '금융업', daumSectorCode: '021' },
  { code: '1022', name: '은행', naverSectorName: '은행' },
  { code: '1024', name: '증권', daumSectorCode: '024' },
  { code: '1025', name: '보험', daumSectorCode: '025' },
  { code: '1026', name: '서비스업', daumSectorCode: '026' },
  { code: '1027', name: '제조업', daumSectorCode: '027' },
  { code: '1028', name: 'KOSPI 200', naverIndexCode: 'KPI200' }
];

const sectorByKey = new Map(sectorItems.map(item => [`SECTOR_${item.code}`, item]));

const quoteFallbackKeyMap = {
  '^IXIC': 'NASDAQ',
  '^GSPC': 'SP500',
  '^KS11': 'KOSPI',
  '^KQ11': 'KOSDAQ'
};

async function fallbackQuoteFromSeries(symbol) {
  const key = quoteFallbackKeyMap[symbol];
  if (!key) return null;

  const rows = await fetchChartSeries(key);
  if (!rows || rows.length < 2) return null;

  const last = rows[rows.length - 1].close;
  const prev = rows[rows.length - 2].close;
  const asOf = rows[rows.length - 1].date;

  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;

  return {
    symbol,
    price: last,
    changePercent: ((last - prev) / prev) * 100,
    asOf,
    raw: 'fallback-from-series'
  };
}

async function fetchStooq(symbol) {
  // Yahoo for major indices
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

async function yahooSimpleSeries(encodedSym, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?range=${range}&interval=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await r.json();

  const result = json?.chart?.result?.[0];
  const ts = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const close = Number(closes[i]);
    if (!Number.isFinite(close) || close <= 0) continue;

    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close
    });
  }

  return rows;
}

function naverNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return Number(value.replace(/,/g, ''));
}

function compactNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return Number(value.replace(/[,%\s]/g, ''));
}

function toNaverChartRows(priceInfos) {
  return (priceInfos || [])
    .map(x => {
      const localDate = String(x.localDate || x.localTradedAt || '').replace(/-/g, '');
      if (localDate.length < 8) return null;
      const date = `${localDate.slice(0, 4)}-${localDate.slice(4, 6)}-${localDate.slice(6, 8)}`;
      const open = naverNumber(x.openPrice);
      const high = naverNumber(x.highPrice);
      const low = naverNumber(x.lowPrice);
      const close = naverNumber(x.closePrice);
      if (!Number.isFinite(close) || close <= 0) return null;
      return {
        date,
        open: Number.isFinite(open) && open > 0 ? open : close,
        high: Number.isFinite(high) && high > 0 ? high : close,
        low: Number.isFinite(low) && low > 0 ? low : close,
        close
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseNaverFchartRows(text) {
  return [...String(text || '').matchAll(/<item data="([^"]+)"/g)]
    .map(match => {
      const [rawDate, rawOpen, rawHigh, rawLow, rawClose] = match[1].split('|');
      if (!rawDate || rawDate.length < 8) return null;
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const open = Number(rawOpen);
      const high = Number(rawHigh);
      const low = Number(rawLow);
      const close = Number(rawClose);
      if (!Number.isFinite(close) || close <= 0) return null;
      return {
        date,
        open: Number.isFinite(open) && open > 0 ? open : close,
        high: Number.isFinite(high) && high > 0 ? high : close,
        low: Number.isFinite(low) && low > 0 ? low : close,
        close
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchNaverFchartSeries(symbol, count = 1500) {
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=day&count=${count}&requestType=0`;
  const r = await fetch(url, { headers: NAVER_HEADERS });
  const text = await r.text();
  const rows = parseNaverFchartRows(text);
  return rows.length ? rows.slice(-count) : null;
}

async function fetchNaverIndexSeries(indexCode) {
  const fchartRows = await fetchNaverFchartSeries(indexCode).catch(() => null);
  if (fchartRows) return fchartRows;

  const url = `https://api.stock.naver.com/chart/domestic/index/${encodeURIComponent(indexCode)}?periodType=dayCandle`;
  const r = await fetch(url, { headers: NAVER_HEADERS });
  const json = await r.json();
  const rows = toNaverChartRows(json.priceInfos);
  return rows.length ? rows.slice(-1500) : null;
}

async function fetchNaverItemSeries(itemCode) {
  const code = String(itemCode || '').replace(/^A/, '');
  if (!/^\d{6}$/.test(code)) return null;

  const fchartRows = await fetchNaverFchartSeries(code).catch(() => null);
  if (fchartRows) return fchartRows;

  const url = `https://api.stock.naver.com/chart/domestic/item/${code}?periodType=dayCandle`;
  const r = await fetch(url, { headers: NAVER_HEADERS });
  const json = await r.json();
  const rows = toNaverChartRows(json.priceInfos);
  return rows.length ? rows.slice(-1500) : null;
}

async function fetchDaumKospiSectors() {
  const url = 'https://finance.daum.net/api/quotes/sectors?market=KOSPI';
  const r = await fetch(url, { headers: DAUM_HEADERS });
  const json = await r.json();
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchNaverSectorByName(sectorName) {
  const params = new URLSearchParams({
    sectorType: 'upjong',
    businessDayCategory: 'daily',
    page: '1',
    pageSize: '50',
    sectorSortType: 'CHANGE_RATE',
    nationType: 'domestic'
  });
  const url = `https://m.stock.naver.com/front-api/stock/sectors/all?${params}`;
  const r = await fetch(url, { headers: NAVER_HEADERS });
  const json = await r.json();
  const sectors = json?.result?.sectors || [];
  return sectors.find(x => x.sectorName === sectorName) || null;
}

function pickSectorStocks(stocks, limit = 6) {
  return (stocks || [])
    .map(x => {
      const weights = [x.marketCap, x.accTradePrice, x.tradePrice]
        .map(naverNumber)
        .filter(Number.isFinite);
      return {
        code: String(x.symbolCode || x.itemCode || x.code || '').replace(/^A/, ''),
        weight: weights.length ? Math.max(...weights) : 1
      };
    })
    .filter(x => /^\d{6}$/.test(x.code))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

function normalizeDaumStock(stock) {
  const directCode = String(stock.symbolCode || stock.itemCode || '').replace(/^A/, '');
  const krxCode = String(stock.code || '').match(/^KR7(\d{6})/)?.[1] || '';
  const fallbackCode = String(stock.code || '').match(/\d{6}/)?.[0] || '';
  const itemCode = /^\d{6}$/.test(directCode) ? directCode : (krxCode || fallbackCode);
  return {
    code: itemCode,
    name: stock.name || stock.itemName || '',
    closePrice: stock.tradePrice,
    changeRate: typeof stock.changeRate === 'number' ? stock.changeRate * 100 : naverNumber(stock.changeRate),
    marketCapValue: naverNumber(stock.marketCap),
    marketCap: stock.marketCap,
    tradingValue: stock.accTradePrice,
    foreignRate: typeof stock.foreignRatio === 'number' ? stock.foreignRatio * 100 : naverNumber(stock.foreignRatio)
  };
}

function normalizeNaverSectorStock(stock) {
  const marketCap = naverNumber(stock.marketCap);
  return {
    code: String(stock.symbolCode || stock.itemCode || stock.code || '').replace(/^A/, ''),
    name: stock.itemName || stock.name || '',
    closePrice: stock.closePrice || stock.tradePrice,
    changeRate: naverNumber(stock.changeRate),
    marketCapValue: Number.isFinite(marketCap) ? marketCap * 1000000 : NaN,
    marketCap: stock.marketCap,
    tradingValue: stock.accumulatedTradingValue || stock.accTradePrice,
    foreignRate: naverNumber(stock.foreignRate)
  };
}

function parseNaverKpi200Rows(text) {
  const rows = [];
  const html = String(text || '');
  const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
  for (const match of html.matchAll(rowPattern)) {
    const row = match[1];
    const codeMatch = row.match(/code=(\d{6})[^>]*>([^<]+)<\/a>/);
    if (!codeMatch) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(cell => cell[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cells.length < 7) continue;
    rows.push({
      code: codeMatch[1],
      name: codeMatch[2].trim(),
      closePrice: cells[1],
      changeRate: compactNumber(cells[3]),
      tradingValue: compactNumber(cells[5]) * 1000000,
      marketCapValue: compactNumber(cells[6]) * 100000000,
      marketCap: cells[6]
    });
  }
  return rows;
}

async function fetchKpi200Stocks(limit = 20) {
  const pages = [1, 2, 3, 4, 5];
  const htmlRows = await Promise.all(pages.map(async page => {
    const url = `https://finance.naver.com/sise/entryJongmok.naver?type=KPI200&page=${page}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,*/*',
        'Referer': 'https://finance.naver.com/sise/sise_index.naver?code=KPI200'
      }
    });
    const buffer = await r.arrayBuffer();
    const text = new TextDecoder('euc-kr').decode(buffer);
    return parseNaverKpi200Rows(text);
  }));
  return htmlRows
    .flat()
    .filter(stock => /^\d{6}$/.test(stock.code))
    .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0))
    .slice(0, limit);
}

async function fetchSectorStockCandidates(key, limit = 20) {
  const def = sectorByKey.get(key);
  if (!def) return null;

  if (def.naverIndexCode === 'KPI200') {
    return fetchKpi200Stocks(limit);
  }

  if (def.daumSectorCode) {
    const sectors = await fetchDaumKospiSectors();
    const sector = sectors.find(x => x.sectorCode === def.daumSectorCode);
    return (sector?.includedStocks || [])
      .map(normalizeDaumStock)
      .filter(stock => /^\d{6}$/.test(stock.code))
      .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0))
      .slice(0, limit);
  }

  if (def.naverSectorName) {
    const sector = await fetchNaverSectorByName(def.naverSectorName);
    return (sector?.items || [])
      .map(normalizeNaverSectorStock)
      .filter(stock => /^\d{6}$/.test(stock.code))
      .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0))
      .slice(0, limit);
  }

  return null;
}

function infoValue(totalInfos, code) {
  const found = totalInfos.find(item => item.code === code);
  return found?.value || '';
}

function latestFinanceValue(rowList, title) {
  const row = rowList.find(item => item.title === title);
  if (!row?.columns) return '';
  const keys = Object.keys(row.columns).sort().reverse();
  const actualKey = keys.find(key => row.columns[key]?.value && row.columns[key].value !== '-');
  return actualKey ? row.columns[actualKey].value : '';
}

async function fetchNaverStockDetails(stock) {
  const code = stock.code;
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

  const [basic, integration, finance] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, { headers }).then(r => r.json()).catch(() => null)
  ]);

  const totalInfos = Array.isArray(integration?.totalInfos) ? integration.totalInfos : [];
  const rowList = Array.isArray(finance?.financeInfo?.rowList) ? finance.financeInfo.rowList : [];
  const roe = latestFinanceValue(rowList, 'ROE');
  const foreignRate = infoValue(totalInfos, 'foreignRate') || (Number.isFinite(stock.foreignRate) ? `${stock.foreignRate.toFixed(2)}%` : '');
  const high52 = infoValue(totalInfos, 'highPriceOf52Weeks');
  const low52 = infoValue(totalInfos, 'lowPriceOf52Weeks');
  const infoParts = [];
  if (foreignRate) infoParts.push(`외인 ${foreignRate}`);
  if (high52 && low52) infoParts.push(`52주 ${low52}~${high52}`);

  return {
    code,
    name: basic?.stockName || integration?.stockName || stock.name || code,
    closePrice: basic?.closePrice || stock.closePrice || '',
    changeRate: basic?.fluctuationsRatio || stock.changeRate,
    importantInfo: infoParts.join(' · ') || '-',
    marketCap: infoValue(totalInfos, 'marketValue') || stock.marketCap || '',
    marketCapValue: stock.marketCapValue || 0,
    per: infoValue(totalInfos, 'per'),
    pbr: infoValue(totalInfos, 'pbr'),
    roe: roe ? `${roe}%` : '',
    tradingValue: infoValue(totalInfos, 'accumulatedTradingValue') || stock.tradingValue || ''
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchSectorStocks(key, limit = 20) {
  const cached = sectorStocksCache.get(key);
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) return cached.data;

  const def = sectorByKey.get(key);
  if (!def) return null;

  const candidates = await fetchSectorStockCandidates(key, limit);
  if (!candidates?.length) return null;

  const stocks = await mapWithConcurrency(candidates, 5, async stock => {
    try {
      return await fetchNaverStockDetails(stock);
    } catch (_) {
      return {
        code: stock.code,
        name: stock.name || stock.code,
        closePrice: stock.closePrice || '',
        changeRate: stock.changeRate,
        importantInfo: '-',
        marketCap: stock.marketCap || '',
        marketCapValue: stock.marketCapValue || 0,
        per: '',
        pbr: '',
        roe: '',
        tradingValue: stock.tradingValue || ''
      };
    }
  });

  const data = {
    key,
    name: def.name,
    asOf: new Date().toISOString(),
    stocks: stocks
      .filter(stock => stock && /^\d{6}$/.test(stock.code))
      .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0))
      .slice(0, limit)
  };

  sectorStocksCache.set(key, { time: Date.now(), data });
  return data;
}

function buildCompositeSeries(seriesList, targetLastClose) {
  const usable = seriesList
    .filter(rows => Array.isArray(rows) && rows.length >= 30)
    .map(rows => {
      const lastClose = rows[rows.length - 1].close;
      return { rows, lastClose };
    })
    .filter(x => Number.isFinite(x.lastClose) && x.lastClose > 0);

  if (!usable.length) return null;

  const byDate = new Map();
  for (const item of usable) {
    for (const row of item.rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date).push({
        open: row.open / item.lastClose,
        high: row.high / item.lastClose,
        low: row.low / item.lastClose,
        close: row.close / item.lastClose
      });
    }
  }

  const raw = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => {
      if (values.length < Math.max(2, Math.ceil(usable.length * 0.45))) return null;
      const avg = key => values.reduce((sum, x) => sum + x[key], 0) / values.length;
      return { date, open: avg('open'), high: avg('high'), low: avg('low'), close: avg('close') };
    })
    .filter(Boolean);

  if (!raw.length) return null;

  const scale = Number.isFinite(targetLastClose) && targetLastClose > 0
    ? targetLastClose / raw[raw.length - 1].close
    : 1000;

  return raw.slice(-1500).map(row => ({
    date: row.date,
    open: row.open * scale,
    high: row.high * scale,
    low: row.low * scale,
    close: row.close * scale
  }));
}

function aggregateOhlcRows(rows, interval) {
  if (interval !== '1wk' && interval !== '1mo') return rows;
  const groups = new Map();
  for (const row of rows) {
    const date = new Date(row.date + 'T00:00:00Z');
    let groupKey;
    if (interval === '1mo') {
      groupKey = row.date.slice(0, 7) + '-01';
    } else {
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() - day + 1);
      groupKey = date.toISOString().slice(0, 10);
    }
    const current = groups.get(groupKey);
    if (!current) {
      groups.set(groupKey, { date: groupKey, open: row.open, high: row.high, low: row.low, close: row.close });
    } else {
      current.high = Math.max(current.high, row.high);
      current.low = Math.min(current.low, row.low);
      current.close = row.close;
    }
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchKospiSectorSeries(key, interval = '1d') {
  const cached = sectorSeriesCache.get(key);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) return aggregateOhlcRows(cached.rows, interval);

  const def = sectorByKey.get(key);
  if (!def) return null;

  if (def.naverIndexCode) {
    const rows = await fetchNaverIndexSeries(def.naverIndexCode);
    if (rows) sectorSeriesCache.set(key, { time: Date.now(), rows });
    return rows ? aggregateOhlcRows(rows, interval) : null;
  }

  let targetLastClose = null;
  let stocks = [];

  if (def.daumSectorCode) {
    const sectors = await fetchDaumKospiSectors();
    const sector = sectors.find(x => x.sectorCode === def.daumSectorCode);
    if (sector) {
      targetLastClose = naverNumber(sector.tradePrice);
      stocks = pickSectorStocks(sector.includedStocks);
    }
  } else if (def.naverSectorName) {
    const sector = await fetchNaverSectorByName(def.naverSectorName);
    if (sector) {
      targetLastClose = 1000 * (1 + naverNumber(sector.changeRate) / 100);
      stocks = pickSectorStocks(sector.items);
    }
  }

  if (!stocks.length) return null;

  const seriesList = await Promise.all(stocks.map(stock => fetchNaverItemSeries(stock.code).catch(() => null)));
  const rows = buildCompositeSeries(seriesList, targetLastClose);
  if (rows) sectorSeriesCache.set(key, { time: Date.now(), rows });
  return rows ? aggregateOhlcRows(rows, interval) : null;
}

async function fetchChartSeries(key, interval = '1d') {
  if (sectorByKey.has(key)) {
    return fetchKospiSectorSeries(key, interval);
  }

  // US10Y
  if (key === 'US10Y') {
    const rows = await yahooSimpleSeries('%5ETNX');
    return rows.length ? rows.slice(-120) : null;
  }

  // US2Y
  if (key === 'US2Y') {
    const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await r.text();
    const lines = text.trim().split('\n');

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');

      if (parts.length === 2) {
        const close = Number(parts[1]);

        if (Number.isFinite(close) && close > 0) {
          rows.push({ date: parts[0], close });
        }
      }
    }

    // Supplement with Treasury.gov data for the latest missing days.
    try {
      const year = new Date().getFullYear();
      const tUrl = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
      const tr = await fetch(tUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const tXml = await tr.text();

      const dates = [...tXml.matchAll(/<d:NEW_DATE[^>]*>([^<T]+)T/g)].map(m => m[1]);
      const yields = [...tXml.matchAll(/<d:BC_2YEAR[^>]*>([^<]+)<\/d:BC_2YEAR>/g)].map(m => Number(m[1]));

      const lastFredDate = rows.length > 0 ? rows[rows.length - 1].date : '';
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] > lastFredDate && Number.isFinite(yields[i]) && yields[i] > 0) {
          rows.push({ date: dates[i], close: yields[i] });
        }
      }
    } catch (_) {
      // Keep FRED rows if Treasury.gov supplement fails.
    }

    return rows.length ? rows.slice(-120) : null;
  }

  // USD/KRW
  if (key === 'USDKRW') {
    const rows = await yahooSimpleSeries('KRW%3DX');
    return rows.length ? rows.slice(-120) : null;
  }

  // Yahoo Finance simple close series.
  const yahooMap = {
    VIX: '%5EVIX',
    SOX: '%5ESOX',
    WTI: 'CL%3DF',
    DXY: 'DX-Y.NYB',
    GOLD: 'GC%3DF'
  };

  if (yahooMap[key]) {
    const rows = await yahooSimpleSeries(yahooMap[key]);
    return rows.length ? rows.slice(-120) : null;
  }

  // Yahoo symbols for indices, OHLC candle data.
  const yahooSymbols = {
    'KOSPI': '%5EKS11',
    'KOSDAQ': '%5EKQ11',
    'NASDAQ': '%5EIXIC',
    'SP500': '%5EGSPC'
  };

  if (yahooSymbols[key]) {
    const sym = yahooSymbols[key];
    let rangeStr = '10y';
    let queryInterval = interval;
    let targetMin = 0;
    
    if (interval.endsWith('m')) {
      targetMin = parseInt(interval);
      if (targetMin >= 60) {
        queryInterval = '60m';
        rangeStr = '1y'; // 1 year for 60m+
      } else if (targetMin >= 5) {
        queryInterval = '5m';
        rangeStr = '60d'; // 60 days for 5m to 30m
      } else {
        queryInterval = '1m';
        rangeStr = '7d';  // 7 days for 1m, 3m
      }
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${rangeStr}&interval=${queryInterval}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await r.json();
    const result = json?.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const quotes = result?.indicators?.quote?.[0] || {};
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];
    
    const rows = [];
    let currentCandle = null;
    let currentCandlePeriod = null;
    
    for (let i = 0; i < ts.length; i += 1) {
      const open = Number(opens[i]);
      const high = Number(highs[i]);
      const low = Number(lows[i]);
      const close = Number(closes[i]);
      if (!Number.isFinite(close) || close <= 0) continue;
      
      if (targetMin > 0) {
        // Aggregate 1m candles into targetMin candles
        let periodStart = Math.floor(ts[i] / (targetMin * 60)) * (targetMin * 60);
        if (!currentCandle || currentCandlePeriod !== periodStart) {
          if (currentCandle) rows.push(currentCandle);
          currentCandlePeriod = periodStart;
          currentCandle = { date: periodStart + (9 * 3600), open, high, low, close };
        } else {
          currentCandle.high = Math.max(currentCandle.high, high);
          currentCandle.low = Math.min(currentCandle.low, low);
          currentCandle.close = close;
        }
      } else {
        const dateObj = new Date(ts[i] * 1000);
        let dateStr = dateObj.toISOString().slice(0, 10);
        rows.push({ date: dateStr, open, high, low, close });
      }
    }
    if (currentCandle) rows.push(currentCandle);
    if (!rows.length) return null;
    return rows.slice(-1500); // 넉넉하게 1500개 전달 (프론트에서 700개 등 사용)
  }

  // Stooq fallback.
  const stooq = chartMap[key];
  if (!stooq) return null;

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooq)}&i=d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const csv = (await r.text()).trim();
  const lines = csv.split('\n');

  if (lines.length < 3) return null;

  const rows = lines
    .slice(-120)
    .map(line => {
      const p = line.split(',');
      return { date: p[0], close: Number(p[4]) };
    })
    .filter(x => Number.isFinite(x.close));

  return rows.length ? rows : null;
}

module.exports = {
  fetchStooq,
  fetchChartSeries,
  fallbackQuoteFromSeries,
  fetchSectorStocks
};
