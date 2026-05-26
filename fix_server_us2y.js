const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const fredLogic = `    for (let i = 1; i < lines.length; i += 1) {
      const parts = lines[i].split(',');
      if (parts.length === 2) {
        const close = Number(parts[1]);
        if (Number.isFinite(close) && close > 0) {
          rows.push({ date: parts[0], close });
        }
      }
    }`;

const supplementLogic = `    for (let i = 1; i < lines.length; i += 1) {
      const parts = lines[i].split(',');
      if (parts.length === 2) {
        const close = Number(parts[1]);
        if (Number.isFinite(close) && close > 0) {
          rows.push({ date: parts[0], close });
        }
      }
    }
    
    // Supplement with Treasury.gov data (for the latest missing days)
    try {
      const year = new Date().getFullYear();
      const tUrl = \`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=\${year}\`;
      const tr = await fetch(tUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const tXml = await tr.text();
      const dates = [...tXml.matchAll(/<d:NEW_DATE[^>]*>([^<T]+)T/g)].map(m => m[1]);
      const yields = [...tXml.matchAll(/<d:BC_2YEAR[^>]*>([^<]+)<\\/d:BC_2YEAR>/g)].map(m => Number(m[1]));
      
      const lastFredDate = rows.length > 0 ? rows[rows.length - 1].date : '';
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] > lastFredDate && Number.isFinite(yields[i]) && yields[i] > 0) {
          rows.push({ date: dates[i], close: yields[i] });
        }
      }
    } catch (e) {
      console.error('Failed to fetch supplement Treasury data', e);
    }`;

if (content.includes('const fredUrl') || content.includes('id=DGS2')) {
    content = content.replace(fredLogic, supplementLogic);
    fs.writeFileSync('server.js', content);
    console.log('Fixed server.js');
} else {
    console.log('Could not find FRED logic in server.js');
}
