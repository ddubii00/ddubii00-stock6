const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// fix double script
html = html.replace('<script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script>\n  ', '');

// fix duplicate functions
const firstDecl = html.indexOf('        const lwChartInstances = {};');
const secondDecl = html.indexOf('        const lwChartInstances = {};', firstDecl + 10);

if (secondDecl !== -1) {
  html = html.substring(0, firstDecl) + html.substring(secondDecl);
}

fs.writeFileSync('index.html', html);
