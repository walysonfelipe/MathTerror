// Servidor local do MathTerror: entrega o jogo e guarda os dados de desempenho das partidas.
// Sem dependências: só módulos do Node. Uso: npm start  (ou node server/index.js)
//
// Rotas da API:
//   GET  /api/saude                     servidor no ar e quantas partidas há
//   POST /api/partidas                  grava uma partida (formato em docs/dados-de-desempenho.md)
//   GET  /api/partidas                  lista as partidas, mais recentes primeiro (?de, ?ate, ?limite)
//   GET  /api/partidas/:id              uma partida
//   GET  /api/ranking                   quem chegou mais longe (?de, ?ate, ?limite)
//   GET  /api/estatisticas              resumos para o dashboard (?de, ?ate)
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './storage.js';
import { validatePartida } from './validate.js';
import { estatisticas, filterByDate, ranking } from './stats.js';
import { serveStatic } from './static.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');
const PORT = Number(process.env.PORT) || 8080;
// Só a própria máquina acessa. Para abrir na rede local: HOST=0.0.0.0 npm start
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 1024 * 1024;   // uma partida longa tem poucas dezenas de KB
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const store = await createStore(DATA_DIR);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { erro: 'Método não permitido' });
    return await serveStatic(req, res, ROOT_DIR);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { erro: 'Erro interno do servidor' });
    else res.destroy();
  }
});

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/\/+$/, '');
  const filters = readFilters(url);
  if (filters.erro) return sendJson(res, 400, filters);

  if (route === '/api/saude' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, partidas: store.all().length });
  }

  if (route === '/api/partidas' && req.method === 'POST') {
    let partida;
    try {
      partida = JSON.parse(await readBody(req));
    } catch (err) {
      return sendJson(res, err.status || 400, { erro: err.status ? err.message : 'JSON inválido' });
    }
    const problem = validatePartida(partida);
    if (problem) return sendJson(res, 400, { erro: problem });
    const added = await store.add({ ...partida, recebidaEm: new Date().toISOString() });
    return sendJson(res, added ? 201 : 200, { ok: true, partidaId: partida.partidaId, duplicada: !added });
  }

  if (route === '/api/partidas' && req.method === 'GET') {
    const list = filterByDate(store.all(), filters)
      .sort((a, b) => Date.parse(b.iniciadaEm) - Date.parse(a.iniciadaEm));
    return sendJson(res, 200, { total: list.length, partidas: list.slice(0, filters.limite ?? list.length) });
  }

  const one = /^\/api\/partidas\/([^/]+)$/.exec(route);
  if (one && req.method === 'GET') {
    const partida = store.get(decodeURIComponent(one[1]));
    return partida ? sendJson(res, 200, partida) : sendJson(res, 404, { erro: 'Partida não encontrada' });
  }

  if (route === '/api/ranking' && req.method === 'GET') {
    return sendJson(res, 200, { ranking: ranking(filterByDate(store.all(), filters), filters.limite ?? 10) });
  }

  if (route === '/api/estatisticas' && req.method === 'GET') {
    return sendJson(res, 200, estatisticas(filterByDate(store.all(), filters)));
  }

  return sendJson(res, 404, { erro: 'Rota não encontrada' });
}

function readFilters(url) {
  const de = url.searchParams.get('de') || undefined;
  const ate = url.searchParams.get('ate') || undefined;
  const limiteText = url.searchParams.get('limite');
  if (de && !DATE.test(de)) return { erro: 'de precisa estar no formato AAAA-MM-DD' };
  if (ate && !DATE.test(ate)) return { erro: 'ate precisa estar no formato AAAA-MM-DD' };
  let limite;
  if (limiteText !== null) {
    limite = Number(limiteText);
    if (!Number.isInteger(limite) || limite < 1) return { erro: 'limite precisa ser um inteiro ≥ 1' };
  }
  return { de, ate, limite };
}

// O jogo pode mandar com sendBeacon, que envia como text/plain: o tipo do corpo não é exigido
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Partida grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

server.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`MathTerror rodando em http://${shownHost}:${PORT}`);
  if (HOST === '0.0.0.0') {
    for (const ip of lanAddresses()) console.log(`Na rede local: http://${ip}:${PORT}`);
  }
  console.log(`Dados em ${store.file} (${store.all().length} partidas)`);
});

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(net => net && net.family === 'IPv4' && !net.internal)
    .map(net => net.address);
}
