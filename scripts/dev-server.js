/* Local static server plus the new API routes, for preview and screenshots.
 * Usage: node scripts/dev-server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || 4173);
const routes = {
  '/api/listing-preview': require('../api/listing-preview'),
  '/api/assistant': require('../api/assistant'),
  '/api/host-subscription': require('../api/host-subscription')
};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function readBody(req) {
  return new Promise(function (resolve) {
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (err) { resolve({}); }
    });
  });
}

const server = http.createServer(async function (req, res) {
  var url = new URL(req.url, 'http://127.0.0.1:' + port);
  var handler = routes[url.pathname];
  if (handler) {
    req.body = await readBody(req);
    var sent = false;
    var mock = {
      statusCode: 200,
      status: function (code) { this.statusCode = code; return this; },
      json: function (body) {
        if (sent) return;
        sent = true;
        res.writeHead(this.statusCode, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
      }
    };
    try { await handler(req, mock); }
    catch (err) {
      if (!sent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }
  var filePath = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', function () {
  console.log('Hostie preview on http://127.0.0.1:' + port);
});
