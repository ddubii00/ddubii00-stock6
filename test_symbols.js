const symbols = ['^IRX', '^FVX', '^TNX', '^TYX', '2YY=F', 'ZT=F', 'US2Y', 'US02Y', 'GT2:GOV', 'US2Y=X'];
async function test() {
  for (const sym of symbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      console.log(`${sym}: ${price}`);
    } catch (e) {
      console.log(`${sym}: error`);
    }
  }
}
test();
