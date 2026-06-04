const http = require('http');
const fs = require('fs');
const path = require('path');

const chartHandler = require('./api/chart');
const quoteHandler = require('./api/quote');
const sectorStocksHandler = require('./api/sector-stocks');
const statsHandler = require('./api/stats');

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;

const apiHandlers = new Map([
  ['/api/chart', chartHandler],
  ['/api/quote', quoteHandler],
  ['/api/sector-stocks', sectorStocksHandler],
  ['/api/stats', statsHandler]
]);

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function attachVercelResponseHelpers(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
    }
    res.end(JSON.stringify(body));
  };
  return res;
}

function serveStatic(req, res, pathname) {
  const target = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(ROOT, target));

  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found');

  const ext = path.extname(file).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  return send(res, 200, fs.readFileSync(file), types[ext] || 'text/plain; charset=utf-8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const handler = apiHandlers.get(url.pathname);

  if (handler) {
    req.query = Object.fromEntries(url.searchParams.entries());
    return handler(req, attachVercelResponseHelpers(res));
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
