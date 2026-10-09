// Entrega os arquivos do jogo. Aceita Range, que o Safari exige para tocar os vídeos de fundo.
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Pastas que ficam no projeto mas não são do jogo: os dados das partidas, o servidor e afins
const PRIVATE_DIRS = new Set(['data', 'server', 'node_modules']);

export async function serveStatic(req, res, rootDir) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return sendText(res, 400, 'Endereço inválido');
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const parts = pathname.split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.')) || PRIVATE_DIRS.has(parts[0]) || parts[0] === 'package.json') {
    return sendText(res, 404, 'Não encontrado');
  }
  const file = path.join(rootDir, ...parts);
  if (!file.startsWith(rootDir + path.sep)) return sendText(res, 404, 'Não encontrado');

  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return sendText(res, 404, 'Não encontrado');
  }
  // /painel vira /painel/ para os caminhos relativos da página funcionarem
  if (stat.isDirectory()) {
    res.writeHead(301, { Location: `${pathname}/` });
    return res.end();
  }
  if (!stat.isFile()) return sendText(res, 404, 'Não encontrado');

  const headers = {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Last-Modified': stat.mtime.toUTCString(),
  };

  const range = parseRange(req.headers.range, stat.size);
  if (range === 'invalid') {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
    return res.end();
  }
  if (range) {
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'Content-Length': range.end - range.start + 1,
    });
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  }
  if (req.method === 'HEAD') return res.end();
  createReadStream(file, range || {}).on('error', () => res.destroy()).pipe(res);
}

// Só um intervalo por pedido ("bytes=0-", "bytes=100-199" ou "bytes=-500"), que é o que os navegadores mandam
function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  } else {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
