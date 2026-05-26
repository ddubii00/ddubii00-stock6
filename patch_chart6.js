const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Change default to 120 days
html = html.replace('visibleCount: 100', 'visibleCount: 120');
html = html.replace(/value="100"/g, 'value="120"');

fs.writeFileSync('index.html', html);
