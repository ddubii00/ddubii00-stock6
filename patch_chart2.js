const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldChartData2 = `              time: x.date,
              open: x.open,
              high: x.high,
              low: x.low,
              close: x.close`;

const newChartData2 = `              time: x.date,
              open: Number.isFinite(x.open) && x.open > 0 ? x.open : x.close,
              high: Number.isFinite(x.high) && x.high > 0 ? x.high : x.close,
              low: Number.isFinite(x.low) && x.low > 0 ? x.low : x.close,
              close: x.close`;

html = html.replace(oldChartData2, newChartData2);

fs.writeFileSync('index.html', html);
