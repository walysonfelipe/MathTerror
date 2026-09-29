// Geometria e geração das plataformas e portas do modo runner.
import { GROUND, TILE_W, TILE_STEP, PASS, PASS_OWL_DX, PASS_SCALE, PASS_TIME, FOOT } from './runner-assets.js';
import { LEG_SECONDS } from './runner-config.js';

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
