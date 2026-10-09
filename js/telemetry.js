// Dados de desempenho de cada partida (formato em docs/dados-de-desempenho.md).
// Tudo fica na memória durante a partida; o envio acontece uma vez só, no fim,
// sem esperar a rede. Nada aqui identifica o jogador: cada partida tem um ID aleatório.

const API_URL = '/api/partidas';
const PENDING_KEY = 'mathterror-partidas-pendentes';
const MAX_PENDING = 50;
const SCHEMA_VERSION = 1;

let match = null;       // partida em andamento
let startedAt = 0;      // performance.now() do início
let getSnapshot = null; // { score, lives, phase } no momento do fim
let pausedMs = 0;
let hiddenAt = 0;
let checkpoint = null;  // checkpoint em andamento
let lastMarkAt = 0;     // pergunta mostrada ou última resposta
let fight = null;       // luta em andamento
let fightLivesBefore = 0;
let controls = new Set();

const now = () => performance.now();
const seconds = ms => Math.round(ms) / 1000;
const elapsed = () => seconds(now() - startedAt);

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fora de https/localhost o randomUUID não existe: monta um UUID v4 na mão
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ===================== DURANTE A PARTIDA =====================
export function startMatch({ phone, snapshot }) {
  match = {
    versaoEsquema: SCHEMA_VERSION,
    partidaId: newId(),
    iniciadaEm: new Date().toISOString(),
    dispositivo: { tipo: phone ? 'celular' : 'desktop', larguraTela: innerWidth, alturaTela: innerHeight },
    checkpoints: [],
    lutas: [],
    quedas: [],
  };
  startedAt = now();
  getSnapshot = snapshot;
  pausedMs = 0;
  hiddenAt = document.hidden ? now() : 0;
  checkpoint = null;
  fight = null;
  controls = new Set();
}

// teclado (inclui mouse) · toque · gamepad
export function noteControl(kind) {
  if (match) controls.add(kind);
}

// Quadros em que o jogo ficou congelado (celular em pé, aviso aberto)
export function notePaused(ms) {
  if (match) pausedMs += ms;
}

export function startCheckpoint(numero, nivel, pergunta) {
  if (!match) return;
  checkpoint = { numero, nivel, chegouEmSeg: elapsed(), pergunta, tentativas: [] };
  match.checkpoints.push(checkpoint);
  lastMarkAt = now();
}

export function noteAttempt(index, ameacaBoss) {
  if (!checkpoint || checkpoint.desfecho) return;
  const alternativa = checkpoint.pergunta?.alternativas?.[index];
  if (!alternativa) return;
  const at = now();
  checkpoint.tentativas.push({
    numero: checkpoint.tentativas.length + 1,
    valorEscolhido: alternativa.valor,
    correta: alternativa.correta,
    tipoErro: alternativa.tipoErro,
    tempoRespostaSeg: seconds(at - lastMarkAt),
    ameacaBoss: Math.round(Math.min(1, Math.max(0, ameacaBoss)) * 100) / 100,
  });
  lastMarkAt = at;
}

// acertou · tres_erros · tempo_esgotado
export function endCheckpoint(desfecho) {
  if (!checkpoint || checkpoint.desfecho) return;
  checkpoint.desfecho = desfecho;
  checkpoint.duracaoSeg = Math.round((elapsed() - checkpoint.chegouEmSeg) * 1000) / 1000;
}

export function startFight(origem, lives) {
  if (!match) return;
  fight = {
    checkpointNumero: origem === 'corrida_lenta' ? null : checkpoint?.numero ?? null,
    origem,
    comecouEmSeg: elapsed(),
    rodadas: [],
  };
  fightLivesBefore = lives;
  match.lutas.push(fight);
}

// Cada rodada aparece depois da anterior; o tempo de resposta conta dali
export function showFightRound() {
  lastMarkAt = now();
}

export function noteFightRound(problem, index) {
  if (!fight) return;
  const at = now();
  const respostaCorreta = problem.options[problem.answer];
  fight.rodadas.push({
    tipo: problem.type,
    texto: problem.text,
    respostaCorreta,
    valorEscolhido: problem.options[index],
    correta: index === problem.answer,
    tempoRespostaSeg: seconds(at - lastMarkAt),
  });
  lastMarkAt = at;
}

export function endFight(venceu, lives) {
  if (!fight || fight.venceu !== undefined) return;
  fight.acertos = fight.rodadas.filter(r => r.correta).length;
  fight.venceu = venceu;
  fight.vidasPerdidas = Math.max(0, fightLivesBefore - Math.max(0, lives));
}

export function noteFall(trecho, lives) {
  if (match) match.quedas.push({ trecho, emSeg: elapsed(), vidasRestantes: Math.max(0, lives) });
}

// ===================== FIM =====================
// motivoFim: lava · capturado · luta_perdida · abandono_esc · abandono_aba
export function endMatch(motivoFim) {
  if (!match) return;
  const partida = finish(motivoFim);
  match = null;
  checkpoint = null;
  fight = null;
  const body = JSON.stringify(partida);
  if (motivoFim === 'abandono_aba') {
    // A página está fechando: só o sendBeacon tem garantia de sair
    if (!navigator.sendBeacon?.(API_URL, body)) savePending(body);
    return;
  }
  send(body);
}

function finish(motivoFim) {
  const { score = 0, lives = 0, phase = 'corrida' } = getSnapshot?.() || {};
  if (hiddenAt) pausedMs += now() - hiddenAt;
  const duracaoSeg = elapsed();

  // Luta sem fim registrado: a partida acabou nela
  if (fight && fight.venceu === undefined) endFight(false, lives);
  // Checkpoint sem desfecho: a partida acabou durante a pergunta
  const last = match.checkpoints[match.checkpoints.length - 1];
  if (last && !last.desfecho) {
    const fought = match.lutas.some(l => l.checkpointNumero === last.numero);
    endCheckpoint(fought ? 'tres_erros' : 'abandono');
  }

  const cps = match.checkpoints;
  const answered = cps.filter(c => c.tentativas.length);
  const attempts = cps.flatMap(c => c.tentativas);
  const firstTimes = answered.map(c => c.tentativas[0].tempoRespostaSeg);
  const wonFights = match.lutas.filter(l => l.venceu);

  return {
    ...match,
    terminadaEm: new Date().toISOString(),
    duracaoSeg,
    pausadaSeg: Math.min(duracaoSeg, seconds(pausedMs)),
    dispositivo: {
      ...match.dispositivo,
      controle: controls.size > 1 ? 'misto' : [...controls][0] || (match.dispositivo.tipo === 'celular' ? 'toque' : 'teclado'),
    },
    resultado: {
      motivoFim,
      checkpointsAlcancados: cps.length,
      checkpointsSuperados: cps.filter(c => c.desfecho === 'acertou').length
        + wonFights.filter(l => l.checkpointNumero !== null).length,
      nivelMaximo: Math.max(0, ...cps.map(c => c.nivel)),
      pontuacao: score,
      vidasRestantes: Math.max(0, lives),
      ondeTerminou: phase,
    },
    resumo: {
      perguntasCheckpoint: cps.length,
      tentativas: attempts.length,
      acertos: cps.filter(c => c.desfecho === 'acertou').length,
      acertosPrimeiraTentativa: answered.filter(c => c.tentativas[0].correta).length,
      erros: attempts.filter(t => !t.correta).length,
      tempoMedioRespostaSeg: firstTimes.length
        ? Math.round(firstTimes.reduce((s, n) => s + n, 0) / firstTimes.length * 100) / 100 : null,
      quedasLava: match.quedas.length,
      lutas: match.lutas.length,
      lutasVencidas: wonFights.length,
    },
  };
}

// ===================== ENVIO =====================
// Sem servidor (ex.: python -m http.server) ou com ele fora do ar, a partida fica
// guardada no navegador e vai junto no próximo envio.
async function send(body) {
  try {
    const res = await fetch(API_URL, { method: 'POST', body, keepalive: body.length < 60000 });
    if (res.ok) {
      sendPending();
      return;
    }
    // 400: o servidor recusou o formato; reenviar não adianta
    if (res.status === 400) console.warn('[desempenho] partida recusada:', await res.text());
    else savePending(body);
  } catch {
    savePending(body);
  }
}

function readPending() {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePending(list) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-MAX_PENDING)));
    else localStorage.removeItem(PENDING_KEY);
  } catch { }
}

function savePending(body) {
  writePending([...readPending(), body]);
}

let sendingPending = false;
async function sendPending() {
  if (sendingPending) return;
  const list = readPending();
  if (!list.length) return;
  sendingPending = true;
  const left = [];
  for (const body of list) {
    try {
      const res = await fetch(API_URL, { method: 'POST', body });
      if (!res.ok && res.status !== 400) left.push(body);
    } catch {
      left.push(body);
    }
  }
  // Partidas guardadas por outra aba enquanto este envio rodava não se perdem
  const added = readPending().filter(body => !list.includes(body));
  writePending([...left, ...added]);
  sendingPending = false;
}

// Aba escondida não é tempo jogado; fechar a aba no meio é abandono
document.addEventListener('visibilitychange', () => {
  if (!match) return;
  if (document.hidden) hiddenAt = now();
  else if (hiddenAt) {
    pausedMs += now() - hiddenAt;
    hiddenAt = 0;
  }
});
addEventListener('pagehide', () => endMatch('abandono_aba'));

sendPending();
