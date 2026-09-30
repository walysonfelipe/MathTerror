// Palco e trajetos da coruja na luta, calculados sobre as plataformas reais.
// Tudo em coordenadas de tela; cameraX converte para o mundo (a câmera fica parada na luta).
import { supportUnder } from './runner-world.js';
import { GRAVITY } from './runner-config.js';

const EDGE_MARGIN = 26;       // distância da borda para decolar/pousar sem escorregar
const SNAP = 48;              // pouso a menos disso do destino já vai direto para ele
const MIN_JUMP_TIME = 0.42;
const MAX_JUMP_TIME = 0.8;
const MAX_JUMP_SPEED = 900;   // buracos largos demais esticam o salto em vez de andar na lava
const MAX_ATTACK_JUMP = 380;  // até essa distância o salto sobre o último vão já termina no golpe

// Vãos entre plataformas vizinhas, em coordenadas de mundo e em ordem crescente.
function worldGaps(segments) {
  const ordered = [...segments].sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 1; i < ordered.length; i++) {
    const start = ordered[i - 1].x + ordered[i - 1].w;
    const end = ordered[i].x;
    if (end > start) gaps.push({ start, end });
  }
  return gaps;
}

// Escolhe onde o boss e a coruja ficam: boss perto de 25% da tela e com os dois pés
// no chão, ponto do golpe também no chão, e a coruja descansando perto de 75%.
export function planFightStage(segments, cameraX, { viewW, bossReach, bossW, owlW }) {
  const on = x => supportUnder(segments, cameraX + x);
  const firm = x => on(x - EDGE_MARGIN) && on(x + EDGE_MARGIN);   // longe da beirada
  const bossOk = x => on(x - bossW * 0.14) && on(x + bossW * 0.14);

  const bossHome = viewW * 0.25;
  let bossX = bossHome;
  let best = Infinity;
  for (let x = Math.max(bossW * 0.42, bossHome - viewW * 0.12); x <= bossHome + viewW * 0.08; x += 4) {
    const score = Math.abs(x - bossHome) + (bossOk(x) ? 0 : 5000) + (firm(x + bossReach) ? 0 : 2000);
    if (score < best) { best = score; bossX = x; }
  }
  const strikeX = bossX + bossReach;

  const restHome = viewW * 0.75;
  const minRest = strikeX + 140;
  const maxRest = Math.min(viewW * 0.86, viewW - owlW * 0.5);   // com o zoom da luta não sai da tela
  let restX = null;
  best = Infinity;
  for (let x = minRest; x <= maxRest; x += 4) {
    if (!firm(x)) continue;
    const score = Math.abs(x - restHome);
    if (score < best) { best = score; restX = x; }
  }
  return { cameraX, bossX, strikeX, restX: restX ?? Math.max(minRest, restHome) };
}

function jumpStep(from, to, runSpeed, attack) {
  const distance = Math.abs(to - from);
  let duration = Math.min(MAX_JUMP_TIME, Math.max(MIN_JUMP_TIME, distance / (runSpeed * 0.6)));
  duration = Math.max(duration, distance / MAX_JUMP_SPEED);
  // Mesma gravidade da corrida: salto curto é baixo e rápido, salto longo é alto
  return { kind: 'jump', from, to, duration, height: GRAVITY * duration * duration / 8, attack };
}

function runStep(from, to, runSpeed) {
  return { kind: 'run', from, to, duration: Math.max(0.08, Math.abs(to - from) / runSpeed), ease: false };
}

// Trajeto de fromX até toX: corre até a borda de cada vão, pula para o outro lado e segue.
// Com attack, se o boss estiver ao alcance depois do último vão, o salto termina já no golpe.
export function planFightPath(segments, cameraX, fromX, toX, { runSpeed, attack = false }) {
  const dir = Math.sign(toX - fromX) || 1;
  const to = cameraX + toX;
  let pos = cameraX + fromX;
  const lo = Math.min(pos, to), hi = Math.max(pos, to);
  // Só os vãos à frente; um vão cuja borda de perto já ficou para trás não conta
  const gaps = worldGaps(segments)
    .filter(gap => gap.end > lo && gap.start < hi)
    .filter(gap => ((dir > 0 ? gap.start : gap.end) - pos) * dir > -EDGE_MARGIN);
  if (dir < 0) gaps.reverse();
  const steps = [];

  gaps.forEach((gap, i) => {
    const near = dir > 0 ? gap.start : gap.end;
    const far = dir > 0 ? gap.end : gap.start;
    let takeoff = near - dir * EDGE_MARGIN;
    if ((takeoff - pos) * dir < 0) takeoff = pos;          // já está na borda: pula daqui
    let landing = far + dir * EDGE_MARGIN;
    const isLast = i === gaps.length - 1;
    const toOnGround = supportUnder(segments, to);
    if ((to - landing) * dir <= SNAP) landing = to;          // destino logo depois (ou dentro) do vão
    else if (isLast && attack && toOnGround && Math.abs(to - takeoff) <= MAX_ATTACK_JUMP) landing = to;
    if (Math.abs(takeoff - pos) > 2) steps.push(runStep(pos, takeoff, runSpeed));
    steps.push(jumpStep(takeoff, landing, runSpeed, attack && landing === to));
    pos = landing;
  });
  if (Math.abs(to - pos) > 2) steps.push(runStep(pos, to, runSpeed));

  // A última corrida desacelera até parar (ou até o golpe)
  const last = steps[steps.length - 1];
  if (last?.kind === 'run') { last.ease = true; last.duration *= 1.3; }
  return steps.map(step => ({ ...step, from: step.from - cameraX, to: step.to - cameraX }));
}

export function fightPathDuration(steps) {
  return steps.reduce((sum, step) => sum + step.duration, 0);
}

// Posição, altura e fase do trajeto no tempo t.
export function sampleFightPath(steps, t) {
  let start = 0;
  for (const step of steps) {
    if (t < start + step.duration) {
      const p = Math.max(0, (t - start) / step.duration);
      const k = step.ease ? 1 - (1 - p) ** 2 : p;
      const lift = step.kind === 'jump' ? 4 * step.height * p * (1 - p) : 0;
      return { x: step.from + (step.to - step.from) * k, lift, step, p, done: false };
    }
    start += step.duration;
  }
  const last = steps[steps.length - 1];
  return { x: last ? last.to : 0, lift: 0, step: last, p: 1, done: true };
}
