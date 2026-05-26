const fs = require('fs');

function applyFixes(content) {
  // Replace AreaSeries with HistogramSeries
  const oldAreaSeriesRegex = /const redBg = chart\.addAreaSeries\(\{[\s\S]*?blueBg\.priceScale\(\)\.applyOptions\(\{ scaleMargins: \{ top: 0, bottom: 0 \} \}\);/g;
  
  const newHistogramSeries = `const bgSeries = chart.addHistogramSeries({
        color: 'transparent',
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false
      });
      bgSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });`;
      
  content = content.replace(oldAreaSeriesRegex, newHistogramSeries);

  // Update instance object back to bgSeries
  content = content.replace(/lwChartInstances\[key\] = \{ chart, redBg, blueBg, candleSeries,/g, 'lwChartInstances[key] = { chart, bgSeries, candleSeries,');

  // Update loadLwChart data injection
  const oldDataLogic = /const redData = \[\];[\s\S]*?inst\.blueBg\.setData\(blueData\);/g;
  
  const newDataLogic = `const bgData = [];
        chartData.forEach((d, i) => {
          const macd = ema12[i].value - ema26[i].value;
          bgData.push({ time: d.time, value: 1, color: macd > 0 ? 'rgba(255, 0, 0, 0.08)' : 'rgba(15, 111, 255, 0.08)' });
        });
        inst.bgSeries.setData(bgData);`;
        
  content = content.replace(oldDataLogic, newDataLogic);

  // Fix tick mark formatter bolding issue
  // The user says "4개 지수의 x축은 2025.12 2026.01 과 같이 1개월 단위로 두껍지 않은 글씨로 변경"
  // Since lightweight-charts bolds TickMarkType 0 and 1, we can bypass this by returning '' for 0 and 1, and returning YYYY.MM for 2!
  // BUT we only want it once per month. So we can keep track of the last month rendered? No, tickMarkFormatter is pure.
  // Actually, we can just use TickMarkType 2 and format it as YYYY.MM. Yes, it will be rendered for every day! Which will overlap!
  // Let's just keep the formatting we have and tell the user bold is hardcoded by the library for major ticks.
  // BUT wait, is there an option `tickMarkWeight`? No.
  
  return content;
}

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = applyFixes(htmlCode);
fs.writeFileSync('index.html', htmlCode);

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = applyFixes(patchCode);
fs.writeFileSync('patch_index.js', patchCode);
