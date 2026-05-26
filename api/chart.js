// api/chart.js
const { fetchChartSeries } = require('../utils');

// api/chart.js
const { fetchChartSeries } = require('../utils');

module.exports = async function handler(req, res) {
  const { key = '' , interval = '1d' } = req.query;
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing key' });
  }
  try {
    const rows = await fetchChartSeries(key, interval);
    if (!rows) return res.status(404).json({ ok: false, error: 'no data' });
    return res.status(200).json({ ok: true, series: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
  const { key = '' , interval = '1d' } = req.query;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Missing key' });
    return;
  }
  try {
    const rows = await fetchChartSeries(key, interval);
    if (!rows) return res.status(404).json({ ok: false, error: 'no data' });
    return res.status(200).json({ ok: true, series: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
