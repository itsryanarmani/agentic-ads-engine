import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { execute } from './index.js';
const digest = value => createHash('sha256').update(value).digest();
const hasApply = value => value && typeof value === 'object' && Object.entries(value).some(([key, item]) => key === 'apply' || hasApply(item));
export async function serve(argv) {
  const options = { host: '127.0.0.1', port: 8787 }, seen = new Set();
  while (argv.length) {
    const option = argv.shift(), split = option.indexOf('=');
    const key = (split < 0 ? option : option.slice(0, split)).slice(2);
    const value = split < 0 ? argv.shift() : option.slice(split + 1);
    if (!option.startsWith('--') || !['host', 'port'].includes(key) || seen.has(key) || !value) throw new Error('Invalid serve option');
    seen.add(key); options[key] = value;
  }
  if (!/^\d+$/.test(String(options.port)) || Number(options.port) > 65535) throw new Error('Invalid port');
  options.port = Number(options.port);
  const token = process.env.AGENTIC_ADS_TOKEN || '';
  const loopback = ['localhost', '::1', '127.0.0.1'].includes(options.host);
  if (!loopback && !token) throw new Error('Non-loopback host requires AGENTIC_ADS_TOKEN');
  if (token && token !== token.trim()) throw new Error('AGENTIC_ADS_TOKEN must not start or end with spaces');
  if (token && token.length < 32) throw new Error('AGENTIC_ADS_TOKEN needs 32 or more characters');
  let boundPort = 0;
  // Pin localhost to loopback rather than trusting hostname resolution.
  if (options.host === 'localhost') options.host = '127.0.0.1';
  const expected = digest('Bearer ' + token);
  const cors = process.env.AGENTIC_ADS_CORS_ORIGIN;
  if (cors) {
    try { if (!/^https?:$/.test(new URL(cors).protocol) || new URL(cors).origin !== cors) throw new Error(); }
    catch { throw new Error('Invalid CORS origin'); }
  }
  const server = createServer({ requestTimeout: 10000, headersTimeout: 10000, connectionsCheckingInterval: 1000 }, (req, res) => {
    // Without a token, accept only loopback Host values. This blocks DNS rebinding.
    const hostOk = token || [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`, `[::1]:${boundPort}`].includes(String(req.headers.host).toLowerCase());
    const timer = setTimeout(() => { send(408, { error: 'Request timeout' }); req.resume(); }, 10000);
    res.on('close', () => clearTimeout(timer));
    function send(status, value, headers = {}) {
      if (res.writableEnded || res.destroyed) return;
      let body = JSON.stringify(value);
      if (token && (body.includes(token) || body.includes(JSON.stringify(token).slice(1, -1)))) {
        status = 400; body = JSON.stringify({ error: 'Invalid request' });
      }
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(status >= 400 && status !== 413 ? { connection: 'close' } : {}), ...headers });
      res.end(body);
    }
    if (cors && req.headers.origin === cors) {
      res.setHeader('access-control-allow-origin', cors); res.setHeader('vary', 'Origin');
    }
    if (token && !timingSafeEqual(digest(req.headers.authorization ?? ''), expected)) { send(401, { error: 'Unauthorized' }); req.resume(); return; }
    let url;
    if (!hostOk) { send(403, { error: 'Forbidden host' }); req.resume(); return; }
    try { url = new URL(req.url, 'http://localhost'); } catch { send(400, { error: 'Invalid URL' }); return; }
    const routes = { '/health': null, '/v1/formats': 'list_formats', '/v1/hooks': 'list-hooks',
      '/v1/templates': 'list-templates', '/v1/qa-rules': 'list_qa_rules', '/v1/lint': 'lint', '/v1/plan': 'plan_format' };
    const detail = url.pathname.match(/^\/v1\/(formats|qa-rules)\/([^/]+)$/);
    const action = detail ? (detail[1] === 'formats' ? 'get_format' : 'get_qa_rule') : routes[url.pathname];
    if (!detail && !Object.hasOwn(routes, url.pathname)) { send(404, { error: 'Not found' }); req.resume(); return; }
    const method = ['lint', 'plan_format'].includes(action) ? 'POST' : 'GET';
    if (req.method !== method) { send(405, { error: 'Method not allowed' }, { allow: method }); req.resume(); return; }
    if (url.searchParams.has('apply')) { send(400, { error: 'Apply is unavailable' }); req.resume(); return; }
    function run(args) {
      try { send(200, action === null ? { status: 'ok' } : execute(action, args)); }
      catch { send(detail ? 404 : 400, { error: detail ? 'Not found' : 'Invalid arguments' }); }
    }
    if (method === 'GET') {
      try { run(detail ? { id: decodeURIComponent(detail[2]) } : {}); }
      catch { send(400, { error: 'Invalid URL' }); }
      req.resume(); return;
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      send(415, { error: 'Use application/json' }); req.resume(); return;
    }
    let size = 0, chunks = [], rejected = false;
    req.on('error', () => { rejected = true; chunks = []; });
    req.on('data', chunk => {
      if (rejected) return;
      size += chunk.length;
      if (size > 65536) { rejected = true; chunks = []; send(413, { error: 'Body too large' }); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected || res.writableEnded) return;
      let args;
      try {
        args = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (hasApply(args)) { send(400, { error: 'Apply is unavailable' }); return; }
      } catch { send(400, { error: 'Invalid JSON' }); return; }
      run(args);
    });
  });
  server.on('clientError', (error, socket) => {
    if (!socket.writable) return;
    const status = error.code === 'ERR_HTTP_REQUEST_TIMEOUT' ? '408 Request Timeout' : '400 Bad Request';
    const body = JSON.stringify({ error: 'Invalid or incomplete request' });
    socket.end(`HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error('Unable to start HTTP server')));
    server.listen(options, resolve);
  });
  boundPort = server.address().port;
  console.log(JSON.stringify({ status: 'listening', port: server.address().port }));
  const stop = () => { server.close(); server.closeAllConnections(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
