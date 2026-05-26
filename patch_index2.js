const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/document\.getElementById\('popupModal'\)\.addEventListener\('click'[\s\S]*?\}\);\n/g, '');
fs.writeFileSync('index.html', html);
