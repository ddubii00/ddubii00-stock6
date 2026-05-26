const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldFmt = "tickMarkFormatter: (time) => { return time.year + '.' + String(time.month).padStart(2, '0'); }";
const newFmt = "tickMarkFormatter: (time) => { if (time.year) return time.year + '.' + String(time.month).padStart(2, '0'); if (typeof time === 'string') return time.substring(0,4)+'.'+time.substring(5,7); const d = new Date(time*1000); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0'); }";

html = html.replace(oldFmt, newFmt);
fs.writeFileSync('index.html', html);
