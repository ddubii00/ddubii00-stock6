const fs = require('fs');
async function run() {
  const r = await fetch('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026');
  const text = await r.text();
  const dates = [...text.matchAll(/<d:NEW_DATE[^>]*>([^<T]+)T/g)].map(m => m[1]);
  const yields = [...text.matchAll(/<d:BC_2YEAR[^>]*>([^<]+)<\/d:BC_2YEAR>/g)].map(m => Number(m[1]));
  for (let i = dates.length - 5; i < dates.length; i++) {
    console.log(dates[i], yields[i]);
  }
}
run();
