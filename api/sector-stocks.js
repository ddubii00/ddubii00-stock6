// api/sector-stocks.js
const { fetchSectorStocks } = require('../utils');

module.exports = async function handler(req, res) {
  const { key = '', limit = '20' } = req.query;

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing key' });
  }

  try {
    const parsedLimit = Math.min(30, Math.max(1, parseInt(limit, 10) || 20));
    const data = await fetchSectorStocks(key, parsedLimit);

    if (!data || !Array.isArray(data.stocks) || data.stocks.length === 0) {
      return res.status(404).json({ ok: false, error: 'no data' });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e.message || e)
    });
  }
};
