const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Delete Grid lines
// Existing: grid: { vertLines: { color: '#e6ecf7' }, horzLines: { color: '#e6ecf7' } }
html = html.replace(
  "grid: { vertLines: { color: '#e6ecf7' }, horzLines: { color: '#e6ecf7' } }", 
  "grid: { vertLines: { visible: false }, horzLines: { visible: false } }"
);

// 2. Top and Left border for the chart
// Existing: <div class="chart lw-chart" id="lwchart-${item.popupKey}" style="height:270px;background:none;border:none;"></div>
html = html.replace(
  /style="height:270px;background:none;border:none;"/g, 
  'style="height:270px;background:none;border:none;border-top:1px solid #dbe3f1;border-left:1px solid #dbe3f1;"'
);

// 3 & 4. Disable zooming, allow panning
// We need to inject handleScale and handleScroll into the createChart options.
const oldLayout = "layout: { backgroundColor: '#ffffff', textColor: '#172033', fontFamily: 'Pretendard, sans-serif' },";
const newLayout = "layout: { backgroundColor: '#ffffff', textColor: '#172033', fontFamily: 'Pretendard, sans-serif' },\n        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false },\n        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },";
html = html.replace(oldLayout, newLayout);

fs.writeFileSync('index.html', html);
