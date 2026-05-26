const fs = require('fs');

function applyMacdBackground(content) {
  // Add calculateEMA function after calculateSMA
  const emaFunc = `    function calculateEMA(data, period) {
      const result = [];
      if (data.length === 0) return result;
      const k = 2 / (period + 1);
      let ema = data[0].close;
      for (let i = 0; i < data.length; i++) {
        if (i === 0) { result.push({ time: data[i].time, value: ema }); continue; }
        ema = (data[i].close - ema) * k + ema;
        result.push({ time: data[i].time, value: ema });
      }
      return result;
    }
`;
  if (!content.includes('function calculateEMA')) {
    content = content.replace(/function calculateSMA\(data, period\) \{[\s\S]*?return result;\n    \}/, match => match + '\n\n' + emaFunc);
  }

  // Inside loadLwChart, add MACD calculation and background color update
  const macdLogic = `
        const ema12 = calculateEMA(chartData, 12);
        const ema26 = calculateEMA(chartData, 26);
        if (chartData.length > 0) {
          const lastMacd = ema12[ema12.length - 1].value - ema26[ema26.length - 1].value;
          const bgColor = lastMacd > 0 ? '#fff0f0' : (lastMacd < 0 ? '#f0f4ff' : '#ffffff');
          inst.chart.applyOptions({ layout: { backgroundColor: bgColor } });
        }
`;
  if (!content.includes('const ema12 = calculateEMA')) {
    content = content.replace(/inst\.candleSeries\.setData\(chartData\);/, match => match + macdLogic);
  }

  // Also change the default layout background in initLwChart to transparent so it doesn't flash white if we don't want to?
  // Actually, wait, lightweight-charts layout: { backgroundColor } defaults to white. It's fine to leave it and update it dynamically.

  return content;
}

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = applyMacdBackground(patchCode);
fs.writeFileSync('patch_index.js', patchCode);

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = applyMacdBackground(htmlCode);
fs.writeFileSync('index.html', htmlCode);

