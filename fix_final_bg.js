const fs = require('fs');

function applyFixes(content) {
  // 1. Remove bgSeries creation
  const bgSeriesCreation = /const bgSeries = chart\.addHistogramSeries\(\{[\s\S]*?bgSeries\.priceScale\(\)\.applyOptions\(\{ scaleMargins: \{ top: 0, bottom: 0 \} \}\);/g;
  content = content.replace(bgSeriesCreation, '');

  // 2. Remove bgSeries from instances
  content = content.replace(/lwChartInstances\[key\] = \{ chart, bgSeries, candleSeries,/g, 'lwChartInstances[key] = { chart, candleSeries,');

  // 3. Replace loadLwChart bgData injection with the Canvas approach
  const oldDataLogic = /const bgData = \[\];[\s\S]*?inst\.bgSeries\.setData\(bgData\);/g;
  const canvasLogic = `
        const chartContainer = document.getElementById('lwchart-' + key);
        chartContainer.style.position = 'relative';
        let bgCanvas = chartContainer.querySelector('.bg-canvas');
        if (!bgCanvas) {
          bgCanvas = document.createElement('canvas');
          bgCanvas.className = 'bg-canvas';
          bgCanvas.style.position = 'absolute';
          bgCanvas.style.top = '0';
          bgCanvas.style.left = '0';
          bgCanvas.style.pointerEvents = 'none';
          chartContainer.insertBefore(bgCanvas, chartContainer.firstChild);
        }
        
        const drawBg = () => {
          if (!chartData || chartData.length === 0) return;
          const ctx = bgCanvas.getContext('2d');
          const width = chartContainer.clientWidth;
          const height = chartContainer.clientHeight;
          if (bgCanvas.width !== width || bgCanvas.height !== height) {
            bgCanvas.width = width;
            bgCanvas.height = height;
          } else {
            ctx.clearRect(0, 0, width, height);
          }
          
          const timeScale = inst.chart.timeScale();
          const logicalRange = timeScale.getVisibleLogicalRange();
          if (!logicalRange) return;
          
          const startLogical = Math.max(0, Math.floor(logicalRange.from));
          const endLogical = Math.min(chartData.length - 1, Math.ceil(logicalRange.to));
          
          for (let i = startLogical; i <= endLogical; i++) {
            let x1 = timeScale.logicalToCoordinate(i - 0.5);
            let x2 = timeScale.logicalToCoordinate(i + 0.5);
            if (x1 === null || x2 === null) continue;
            
            const macd = ema12[i].value - ema26[i].value;
            ctx.fillStyle = macd > 0 ? 'rgba(255, 0, 0, 0.08)' : 'rgba(15, 111, 255, 0.08)';
            ctx.fillRect(Math.floor(x1), 0, Math.ceil(x2 - x1), height);
          }
        };
        
        inst.chart.timeScale().unsubscribeVisibleLogicalRangeChange(inst._drawBg);
        inst.chart.timeScale().unsubscribeSizeChange(inst._drawBg);
        inst._drawBg = drawBg;
        inst.chart.timeScale().subscribeVisibleLogicalRangeChange(drawBg);
        inst.chart.timeScale().subscribeSizeChange(drawBg);
        drawBg();
  `;
  content = content.replace(oldDataLogic, canvasLogic);

  // 4. Update chart layout to transparent background and localization
  // The layout is currently defined in initLwChart
  const layoutRegex = /layout: \{ backgroundColor: '#ffffff', textColor: '#172033', fontFamily: 'Pretendard, sans-serif' \},/g;
  const newLayout = `layout: { backgroundColor: 'transparent', textColor: '#172033', fontFamily: 'Pretendard, sans-serif' },
        localization: { dateFormat: 'yyyy-MM-dd' },`;
  content = content.replace(layoutRegex, newLayout);

  return content;
}

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = applyFixes(htmlCode);
fs.writeFileSync('index.html', htmlCode);

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = applyFixes(patchCode);
fs.writeFileSync('patch_index.js', patchCode);
