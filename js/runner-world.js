// Geometria e geração das plataformas e portas do modo runner.
import { GROUND, TILE_W, TILE_STEP, PASS, PASS_OWL_DX, PASS_SCALE, PASS_TIME, FOOT } from './runner-assets.js';
import { LEG_SECONDS, EDGE_NEAR } from './runner-config.js';

export function createSegment(x, tileCount) {
  const tiles = Array.from({ length: tileCount }, () => Math.floor(Math.random() * GROUND.count));
  return { x, w: tileCount * TILE_STEP + (TILE_W - TILE_STEP), tiles };
}

export function generateLeg(fromX, startX, speed) {
  const segments = [];
  const end = startX + speed * LEG_SECONDS;
  let x = fromX;
  while (x < end - TILE_STEP * 14) {
    x += 90 + Math.random() * 90;
    const seg = createSegment(x, 2 + Math.floor(Math.random() * 4));
    segments.push(seg);
    x = seg.x + seg.w;
  }
  x += 110;
  const last = createSegment(x, Math.ceil((end - x) / TILE_STEP) + 6);
  segments.push(last);
  const markerX = Math.max(end, last.x + TILE_STEP * 2);
  const door = { x: markerX - PASS_OWL_DX[0] * PASS_SCALE, passAt: -1, rattleAt: -1 };
  return { segments, markerX, door };
}

export function passOwlX(door, t) {
  const from = PASS_OWL_DX[0], to = PASS_OWL_DX[PASS.frames - 1];
  return door.x + (from + (to - from) * Math.min(1, t / PASS_TIME)) * PASS_SCALE;
}

export function currentDoor(doors) {
  return doors[doors.length - 1];
}

export function supportUnder(segments, worldX) {
  return segments.some(seg => worldX + FOOT > seg.x + 18 && worldX - FOOT < seg.x + seg.w - 18);
}

// Situação dos pés em worldX (da coruja, ou de quem passar foot: meia largura dos pés), para saber se está firme, na beirada ou sobre um vão.
// status: 'firm' (longe da borda), 'edge' (a menos de nearEdge de perder o apoio) ou 'gap' (sem chão embaixo).
// edgeAhead/edgeBehind: quanto ainda dá para andar para frente/trás antes de perder o apoio (0 sobre o vão).
// Sobre o vão: gapStart/gapEnd são os limites do vão e gapProgress vai de 0 (acabou de sair) a 1 (chegando ao outro lado).
export function footingAt(segments, worldX, nearEdge = EDGE_NEAR, foot = FOOT) {
  // Mesmos limites de supportUnder: apoiada enquanto algum pé estiver sobre a plataforma
  const spans = segments
    .map(seg => ({ from: seg.x + 18 - foot, to: seg.x + seg.w - 18 + foot }))
    .sort((a, b) => a.from - b.from);
  const span = spans.find(s => worldX > s.from && worldX < s.to);
  if (span) {
    const edgeAhead = span.to - worldX;
    const edgeBehind = worldX - span.from;
    const status = Math.min(edgeAhead, edgeBehind) <= nearEdge ? 'edge' : 'firm';
    return { status, supported: true, edgeAhead, edgeBehind };
  }
  const before = spans.filter(s => s.to <= worldX).pop();
  const after = spans.find(s => s.from >= worldX);
  const gapStart = before ? before.to : -Infinity;
  const gapEnd = after ? after.from : Infinity;
  const gapProgress = Number.isFinite(gapStart) && Number.isFinite(gapEnd)
    ? (worldX - gapStart) / (gapEnd - gapStart)
    : 0;
  return { status: 'gap', supported: false, edgeAhead: 0, edgeBehind: 0, gapStart, gapEnd, gapProgress };
}

// Salto sobre o vão para quem anda no sentido dir (1 frente, -1 trás): se está a até takeoff da borda
// com um vão logo depois, ou já sobre o vão, devolve onde pousar (landing além da outra borda).
export function gapLeapTarget(segments, worldX, dir, { foot, takeoff, landing }) {
  const here = footingAt(segments, worldX, 0, foot);
  let gap = here;
  if (here.supported) {
    const toEdge = dir > 0 ? here.edgeAhead : here.edgeBehind;
    if (toEdge > takeoff) return null;
    gap = footingAt(segments, worldX + dir * (toEdge + 1), 0, foot);
    if (gap.supported) return null;                  // plataformas encostadas: não há vão
  }
  const far = dir > 0 ? gap.gapEnd : gap.gapStart;
  return Number.isFinite(far) ? far + dir * landing : null;   // sem chão do outro lado não salta
}
