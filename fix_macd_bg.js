const fs = require('fs');

function fixContent(content) {
  // 1. Fix tickMarkFormatter to prevent overlap
  const oldTickMark = /tickMarkFormatter: \(time\) => \{ if \(time\.year\) return time\.year \+ '\.' \+ String\(time\.month\)\.padStart\(2, '0'\); if \(typeof time === 'string'\) return time\.substring\(0,4\)\+'\.' \+ time\.substring\(5,7\); const d = new Date\(time\*1000\); return d\.getFullYear\(\)\+'\.'\+String\(d\.getMonth\(\)\+1\)\.padStart\(2,'0'\); \}/g;
  
  const newTickMark = `tickMarkFormatter: (time, tickMarkType, locale) => {
          if (tickMarkType === 1 || tickMarkType === 2) {
            if (time.year) return time.year + '.' + String(time.month).padStart(2, '0');
            if (typeof time === 'string') return time.substring(0,4) + '.' + time.substring(5,7);
            const d = new Date(time*1000); return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0');
          }
          if (time.day) return String(time.month).padStart(2, '0') + '.' + String(time.day).padStart(2, '0');
          if (typeof time === 'string') return time.substring(5,10).replace('-', '.');
          const d = new Date(time*1000); return String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
        }`;
  
  content = content.replace(oldTickMark, newTickMark);

  // 2. Add bgSeries to initLwChart BEFORE candleSeries
  const oldCandleSeries = /const candleSeries = chart\.addCandlestickSeries\(\{/g;
  const newCandleSeries = `const bgSeries = chart.addHistogramSeries({
        color: 'transparent',
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false
      });
      bgSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
      const candleSeries = chart.addCandlestickSeries({`;
      
  // Wait, I should make sure I only replace it where needed. But doing it globally is fine if it matches.
  // Actually, I also need to expose bgSeries to lwChartInstances
  const oldInst = /lwChartInstances\[key\] = \{ chart, candleSeries, maSeries,/g;
  const newInst = `lwChartInstances[key] = { chart, bgSeries, candleSeries, maSeries,`;

  if (!content.includes('const bgSeries')) {
    content = content.replace(oldCandleSeries, newCandleSeries);
    content = content.replace(oldInst, newInst);
  }

  // 3. Fix loadLwChart: change the macd logic
  const oldMacdLogic = `const ema12 = calculateEMA(chartData, 12);
        const ema26 = calculateEMA(chartData, 26);
        if (chartData.length > 0) {
          const lastMacd = ema12[ema12.length - 1].value - ema26[ema26.length - 1].value;
          const bgColor = lastMacd > 0 ? '#fff0f0' : (lastMacd < 0 ? '#f0f4ff' : '#ffffff');
          inst.chart.applyOptions({ layout: { backgroundColor: bgColor } });
        }`;
  
  const newMacdLogic = `const ema12 = calculateEMA(chartData, 12);
        const ema26 = calculateEMA(chartData, 26);
        const bgData = chartData.map((d, i) => {
          const macd = ema12[i].value - ema26[i].value;
          return { time: d.time, value: 1, color: macd > 0 ? 'rgba(255, 0, 0, 0.05)' : (macd < 0 ? 'rgba(0, 0, 255, 0.05)' : 'transparent') };
        });
        inst.bgSeries.setData(bgData);
        inst.chart.applyOptions({ layout: { backgroundColor: '#ffffff' } });`;
        
  content = content.replace(oldMacdLogic, newMacdLogic);

  return content;
}

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = fixContent(htmlCode);
fs.writeFileSync('index.html', htmlCode);

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = fixContent(patchCode);
fs.writeFileSync('patch_index.js', patchCode);
