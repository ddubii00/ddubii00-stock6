const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Use older version of lightweight charts to avoid logo
html = html.replace('unpkg.com/lightweight-charts/dist', 'unpkg.com/lightweight-charts@3.8.0/dist');

// Fix data filtering
const oldChartData = `        const chartData = series.map(x => ({
          time: x.date,
          open: x.open,
          high: x.high,
          low: x.low,
          close: x.close
        }));`;

const newChartData = `        const chartData = [];
        let lastTime = '';
        for (const x of series) {
          if (x.date > lastTime) {
            chartData.push({
              time: x.date,
              open: x.open,
              high: x.high,
              low: x.low,
              close: x.close
            });
            lastTime = x.date;
          }
        }`;

html = html.replace(oldChartData, newChartData);

fs.writeFileSync('index.html', html);
