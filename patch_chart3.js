const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. & 4. Remove price tags and horizontal price lines
html = html.replace("wickDownColor: '#1f5bd8'", "wickDownColor: '#1f5bd8',\n        lastValueVisible: false,\n        priceLineVisible: false");
html = html.replace("crosshairMarkerVisible: false", "crosshairMarkerVisible: false,\n          lastValueVisible: false,\n          priceLineVisible: false");

// 2. Default to 100 days
html = html.replace('visibleCount: 200', 'visibleCount: 100');
html = html.replace(/value="200"/g, 'value="100"');

// 3. X-axis format "2025.12"
const oldTimeScale = "timeScale: { borderColor: '#dbe3f1' }";
const newTimeScale = "timeScale: { borderColor: '#dbe3f1', tickMarkFormatter: (time) => { return time.year + '.' + String(time.month).padStart(2, '0'); } }";
html = html.replace(oldTimeScale, newTimeScale);

// Lightweight charts v3 'time' for string is a JS object { year, month, day } in tickMarkFormatter!
// Wait, if we use time string 'YYYY-MM-DD', tickMarkFormatter receives an object:
// { year: 2020, month: 4, day: 8 }

// 5. Thicker MA lines
html = html.replace(/lineWidth: 1/g, 'lineWidth: 2');

fs.writeFileSync('index.html', html);
