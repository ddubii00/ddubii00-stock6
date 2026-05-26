const fs = require('fs');

function applyFixes(content) {
  // 1. Fix tickMarkFormatter
  const oldTickMarkRegex = /tickMarkFormatter: \(time, tickMarkType, locale\) => \{[\s\S]*?return String\(d\.getMonth\(\)\+1\)\.padStart\(2,'0'\) \+ '\.' \+ String\(d\.getDate\(\)\)\.padStart\(2,'0'\);\n\s*\}/;
  
  const newTickMark = `tickMarkFormatter: (time, tickMarkType, locale) => {
          if (tickMarkType === 0 || tickMarkType === 1) {
            if (time.year) return time.year + '.' + String(time.month).padStart(2, '0');
            if (typeof time === 'string') return time.substring(0,4) + '.' + time.substring(5,7);
            const d = new Date(time*1000); return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0');
          }
          return '';
        }`;
        
  content = content.replace(oldTickMarkRegex, newTickMark);

  // 2. Replace HistogramSeries with AreaSeries for gapless background
  const oldSeriesRegex = /const bgSeries = chart\.addHistogramSeries\(\{[\s\S]*?bgSeries\.priceScale\(\)\.applyOptions\(\{ scaleMargins: \{ top: 0, bottom: 0 \} \}\);/g;
  
  const newSeries = `const redBg = chart.addAreaSeries({
        topColor: 'rgba(255, 0, 0, 0.06)', bottomColor: 'rgba(255, 0, 0, 0.06)', lineColor: 'transparent', lineWidth: 0,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, priceScaleId: ''
      });
      const blueBg = chart.addAreaSeries({
        topColor: 'rgba(15, 111, 255, 0.06)', bottomColor: 'rgba(15, 111, 255, 0.06)', lineColor: 'transparent', lineWidth: 0,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, priceScaleId: ''
      });
      redBg.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
      blueBg.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });`;
      
  content = content.replace(oldSeriesRegex, newSeries);

  // Update instance object
  content = content.replace(/lwChartInstances\[key\] = \{ chart, bgSeries, candleSeries,/g, 'lwChartInstances[key] = { chart, redBg, blueBg, candleSeries,');

  // 3. Update loadLwChart data injection
  const oldDataLogic = /const bgData = chartData\.map\(\(d, i\) => \{[\s\S]*?inst\.bgSeries\.setData\(bgData\);/g;
  
  const newDataLogic = `const redData = [];
        const blueData = [];
        chartData.forEach((d, i) => {
          const macd = ema12[i].value - ema26[i].value;
          redData.push({ time: d.time, value: macd > 0 ? 1 : 0 });
          blueData.push({ time: d.time, value: macd <= 0 ? 1 : 0 });
        });
        inst.redBg.setData(redData);
        inst.blueBg.setData(blueData);`;
        
  content = content.replace(oldDataLogic, newDataLogic);

  return content;
}

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = applyFixes(htmlCode);
fs.writeFileSync('index.html', htmlCode);

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = applyFixes(patchCode);
fs.writeFileSync('patch_index.js', patchCode);
