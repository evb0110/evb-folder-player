// Serves the static web export (dist/web) on loopback. Supports HTTP Range requests,
// which browsers require to seek within audio files.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../dist/web', import.meta.url).pathname);
const port = Number(process.env.PORT || 8098);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Parses a single `bytes=start-end` range; null when absent, 'invalid' when unsatisfiable. */
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : 'invalid';
}

http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      const body = await readFile(file);
      const headers = {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      };
      const range = byteRange(req.headers.range, body.length);
      if (range === 'invalid') {
        res.writeHead(416, { 'Content-Range': `bytes */${body.length}` });
        res.end();
      } else if (range) {
        res.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${range.start}-${range.end}/${body.length}`,
          'Content-Length': range.end - range.start + 1,
        });
        res.end(body.subarray(range.start, range.end + 1));
      } else {
        res.writeHead(200, { ...headers, 'Content-Length': body.length });
        res.end(body);
      }
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Folder Player preview on 127.0.0.1:${port}`));
