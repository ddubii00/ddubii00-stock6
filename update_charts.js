const fs = require('fs');

function applyChanges(content) {
  // 1 & 5. MA series lineWidth and tags
  content = content.replace(/lineWidth: 1,\n\s*crosshairMarkerVisible: false\n\s*\}\);/g, "lineWidth: 2,\n          crosshairMarkerVisible: false,\n          lastValueVisible: false,\n          priceLineVisible: false\n        });");
  
  // 1. Candle series tags (optional, but good to add if user meant all horizontal lines)
  content = content.replace(/wickDownColor: '#1f5bd8'\n\s*\}\);/g, "wickDownColor: '#1f5bd8',\n        lastValueVisible: false,\n        priceLineVisible: false\n      });");

  // 2, 4 & 6. Grid removal, zooming config, timeScale formatting
  const oldConfig = /grid: \{ vertLines: \{ color: '#e6ecf7' \}, horzLines: \{ color: '#e6ecf7' \} \},\n\s*rightPriceScale: \{ borderColor: '#dbe3f1' \},\n\s*timeScale: \{ borderColor: '#dbe3f1' \},/g;
  const newConfig = `handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { borderColor: '#dbe3f1' },
        timeScale: { borderColor: '#dbe3f1', tickMarkFormatter: (time) => { if (time.year) return time.year + '.' + String(time.month).padStart(2, '0'); if (typeof time === 'string') return time.substring(0,4)+'.' + time.substring(5,7); const d = new Date(time*1000); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0'); } },`;
  content = content.replace(oldConfig, newConfig);

  // 3. Top and left border
  content = content.replace(/id="lwchart-\\\$\\{item\.popupKey\\}" style="height:270px;background:none;border:none;"/g, 'id="lwchart-\\\${item.popupKey}" style="height:270px;background:none;border:none;border-top:1px solid #dbe3f1;border-left:1px solid #dbe3f1;"');
  content = content.replace(/id="lwchart-\$\{item\.popupKey\}" style="height:270px;background:none;border:none;"/g, 'id="lwchart-${item.popupKey}" style="height:270px;background:none;border:none;border-top:1px solid #dbe3f1;border-left:1px solid #dbe3f1;"');
  
  return content;
}

let patchCode = fs.readFileSync('patch_index.js', 'utf8');
patchCode = applyChanges(patchCode);
fs.writeFileSync('patch_index.js', patchCode);

let htmlCode = fs.readFileSync('index.html', 'utf8');
htmlCode = applyChanges(htmlCode);
fs.writeFileSync('index.html', htmlCode);
