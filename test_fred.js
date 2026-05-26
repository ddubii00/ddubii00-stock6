async function test() {
    const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await r.text();
    const lines = text.trim().split('\n');
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const parts = lines[i].split(',');
      if (parts.length === 2) {
        const close = Number(parts[1]);
        if (Number.isFinite(close) && close > 0) {
          rows.push({ date: parts[0], close });
        }
      }
    }
    console.log(rows.slice(-5));
}
test();
