// Guarda as partidas em data/partidas.jsonl: uma partida por linha, só acrescentando no fim.
// Se o servidor cair no meio de uma gravação, no máximo a última linha se perde.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function createStore(dataDir) {
  const file = path.join(dataDir, 'partidas.jsonl');
  await fs.mkdir(dataDir, { recursive: true });

  let content = '';
  try {
    content = await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const partidas = [];
  const ids = new Set();
  content.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const partida = JSON.parse(line);
      if (ids.has(partida.partidaId)) return;
      ids.add(partida.partidaId);
      partidas.push(partida);
    } catch {
      console.warn(`[dados] linha ${i + 1} de ${file} ignorada: JSON inválido`);
    }
  });

  // Uma gravação interrompida pode deixar a última linha sem quebra: a próxima começa numa linha nova
  if (content && !content.endsWith('\n')) await fs.appendFile(file, '\n');

  await backupOfTheDay(dataDir, file, content);

  // As gravações entram numa fila para duas partidas nunca escreverem ao mesmo tempo
  let queue = Promise.resolve();

  return {
    file,
    all: () => partidas,
    get: id => partidas.find(p => p.partidaId === id) || null,
    // Devolve false quando a partida já existe (o jogo pode reenviar a mesma partida)
    add(partida) {
      if (ids.has(partida.partidaId)) return Promise.resolve(false);
      ids.add(partida.partidaId);
      partidas.push(partida);
      const write = queue.then(() => fs.appendFile(file, JSON.stringify(partida) + '\n'));
      queue = write.catch(() => { });
      return write.then(() => true, err => {
        ids.delete(partida.partidaId);
        partidas.splice(partidas.indexOf(partida), 1);
        throw err;
      });
    },
  };
}

// Uma cópia por dia em data/backup, feita quando o servidor inicia
async function backupOfTheDay(dataDir, file, content) {
  if (!content) return;
  const dir = path.join(dataDir, 'backup');
  const target = path.join(dir, `partidas-${localDate(new Date())}.jsonl`);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.copyFile(file, target, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code !== 'EEXIST') console.warn(`[dados] backup não criado: ${err.message}`);
  }
}

export function localDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
