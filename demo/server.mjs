import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/demo.mjs', ['demo.mjs', 'text/javascript']],
  ['/renderer.mjs', ['../src/renderer.mjs', 'text/javascript']], ['/quota.mjs', ['../src/quota.mjs', 'text/javascript']]
]);
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' || !files.has(req.url)) { res.writeHead(404).end(); return; }
  const [file, type] = files.get(req.url);
  try {
    const data = await readFile(new URL(file, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff' }); res.end(data);
  } catch { res.writeHead(500).end('Preview unavailable'); }
});
server.on('error', () => { console.error('无法开启127.0.0.1:43189。可直接打开 preview.html 查看模拟效果。'); process.exitCode = 1; });
server.listen(43189, '127.0.0.1', () => console.log('模拟演示：http://127.0.0.1:43189（固定示例数据，不连接账号）'));
