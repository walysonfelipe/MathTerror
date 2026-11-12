import * as THREE from 'three';
import { makeGatePuzzle } from './gate-math.js';
import { makeVortexMaterial, makeTunnelMaterial } from './vortex.js';

/**
 * A cripta da fenda: nenhum monstro entra aqui, mas olhos observam do escuro.
 * A câmera sai da visão lateral, gira e entra em primeira pessoa. No altar há ossos
 * numerados e na porta de ferro, a conta. Errar apaga as velas e aproxima os olhos;
 * acertar abre a porta e o jogador é engolido pela garganta até outro lugar.
 */

const DOOR_X = 6.6;          // plano da porta
const TILE_X = 2.5;          // pedras flutuando sobre o altar
const PANEL_Y = 2.35;        // altura da conta na porta
const PANEL_X = DOOR_X - 0.62; // a conta flutua na frente da moldura
const EYE = new THREE.Vector3(0.15, 1.62, 0);
const LOOK = new THREE.Vector3(DOOR_X, 1.2, 0);
const HALL = 8;              // meia largura do salão (z)
const FACE = -Math.PI / 2;   // planos virados para a câmera (que olha para +x)

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;

function scaleUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, g: canvas.getContext('2d'), tex };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------- desenho das peças ----------
// osso/lasca de lápide com o número escrito em sangue
function drawTile(c, value, hotkey) {
  const { g, canvas } = c;
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const gr = g.createRadialGradient(W * 0.4, H * 0.35, 4, W / 2, H / 2, W * 0.75);
  gr.addColorStop(0, '#d9ceb2');
  gr.addColorStop(0.6, '#a8987a');
  gr.addColorStop(1, '#4a3e30');
  g.fillStyle = gr;
  roundRect(g, 4, 4, W - 8, H - 8, 22);
  g.fill();
  // manchas e rachaduras
  for (let i = 0; i < 7; i++) {
    g.fillStyle = `rgba(60, 40, 20, ${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.ellipse(Math.random() * W, Math.random() * H, 6 + Math.random() * 16, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#2a1a1088';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    let x = 20 + Math.random() * (W - 40), y = 8;
    g.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 26; y += 12 + Math.random() * 12; g.lineTo(x, y); }
    g.stroke();
  }
  // número em sangue, com escorridos
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const s = String(value);
  g.font = `700 ${s.length > 2 ? 50 : s.length > 1 ? 64 : 82}px "Cinzel", Georgia, serif`;
  g.shadowColor = '#ff1a0a';
  g.shadowBlur = 10;
  g.fillStyle = '#6a0204';
  g.fillText(s, W / 2, H / 2 + 4);
  g.shadowBlur = 0;
  g.fillStyle = '#5a0204';
  for (let i = 0; i < 2; i++) {
    const x = W / 2 + (Math.random() - 0.5) * 40, y = H / 2 + 22, len = 10 + Math.random() * 22;
    g.fillRect(x, y, 3, len);
    g.beginPath(); g.arc(x + 1.5, y + len, 3.2, 0, Math.PI * 2); g.fill();
  }
  if (hotkey) {
    g.font = '700 20px "Cinzel", Georgia, serif';
    g.fillStyle = '#3a2a1a';
    g.fillText(hotkey, 24, 26);
  }
  c.tex.needsUpdate = true;
}

const SLOT_COLORS = { empty: '#7a1010', next: '#ff4a2a', filled: '#a01a10', ok: '#b4ff5a', bad: '#ff1a1a' };
function drawSlot(c, value, state) {
  const { g, canvas } = c;
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = state === 'ok' ? '#0e1a06' : state === 'bad' ? '#3a0000' : '#080304';
  roundRect(g, 6, 6, W - 12, H - 12, 16);
  g.fill();
  const col = SLOT_COLORS[state] || SLOT_COLORS.empty;
  g.strokeStyle = col;
  g.shadowColor = col;
  g.shadowBlur = 16;
  g.lineWidth = 6;
  if (value == null) g.setLineDash([16, 10]);
  roundRect(g, 12, 12, W - 24, H - 24, 12);
  g.stroke();
  g.setLineDash([]);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (value == null) {
    g.font = '700 66px "Cinzel", Georgia, serif';
    g.fillStyle = col + '99';
    g.fillText('?', W / 2, H / 2 + 4);
  } else {
    const s = String(value);
    g.font = `700 ${s.length > 2 ? 50 : s.length > 1 ? 62 : 78}px "Cinzel", Georgia, serif`;
    g.fillStyle = state === 'ok' ? '#e0ffc0' : state === 'bad' ? '#ffffff' : '#ffd8c8';
    g.fillText(s, W / 2, H / 2 + 6);
  }
  g.shadowBlur = 0;
  c.tex.needsUpdate = true;
}

function drawGlyph(c, text, color = '#e8d0c8') {
  const { g, canvas } = c;
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(H * 0.58)}px "Cinzel", Georgia, serif`;
  g.shadowColor = '#ff1a0a';
  g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, W / 2, H / 2 + 6);
  c.tex.needsUpdate = true;
}

function drawPanel(c) {
  const { g, canvas } = c;
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#140405ee');
  gr.addColorStop(1, '#050101ee');
  g.fillStyle = gr;
  roundRect(g, 6, 6, W - 12, H - 12, 18);
  g.fill();
  g.strokeStyle = '#6a0a0a';
  g.shadowColor = '#ff1a0a';
  g.shadowBlur = 18;
  g.lineWidth = 5;
  roundRect(g, 14, 14, W - 28, H - 28, 14);
  g.stroke();
  g.shadowBlur = 0;
  // sangue escorrendo da borda de baixo
  g.fillStyle = '#5a0204';
  for (let i = 0; i < 9; i++) {
    const x = 30 + Math.random() * (W - 60), len = 6 + Math.random() * 22;
    g.fillRect(x, H - 18, 3, len);
  }
  c.tex.needsUpdate = true;
}

function drawDoor(c) {
  const { g, canvas } = c;
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#120c0c';
  g.fillRect(0, 0, W, H);
  // chapas de ferro enferrujado
  for (let i = 0; i < 6; i++) {
    const y = (i * H) / 6;
    const gr = g.createLinearGradient(0, y, 0, y + H / 6);
    gr.addColorStop(0, '#3a2620');
    gr.addColorStop(1, '#170e0c');
    g.fillStyle = gr;
    g.fillRect(6, y + 4, W - 12, H / 6 - 8);
    g.fillStyle = '#4a3028';
    for (const x of [22, W - 22]) { g.beginPath(); g.arc(x, y + H / 12, 7, 0, Math.PI * 2); g.fill(); }
  }
  // ferrugem
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(120, 50, 20, ${Math.random() * 0.25})`;
    g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 0, Math.PI * 2); g.fill();
  }
  // arranhões de unhas (alguém tentou sair)
  g.strokeStyle = '#8a6a5a99';
  g.lineWidth = 2;
  for (let k = 0; k < 2; k++) {
    const x0 = 40 + Math.random() * (W - 110), y0 = H * (0.45 + Math.random() * 0.3);
    for (let f = 0; f < 4; f++) {
      g.beginPath();
      g.moveTo(x0 + f * 11, y0);
      g.quadraticCurveTo(x0 + f * 11 + 6, y0 + 50, x0 + f * 11 + 2, y0 + 110);
      g.stroke();
    }
  }
  // mão de sangue
  g.fillStyle = '#5a0406cc';
  const hx = W * 0.62, hy = H * 0.66;
  g.beginPath(); g.ellipse(hx, hy, 22, 26, 0, 0, Math.PI * 2); g.fill();
  for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(hx - 18 + f * 12, hy - 36, 5, 15, (f - 1.5) * 0.12, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(hx + 26, hy - 6, 5, 13, -0.8, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) g.fillRect(hx - 15 + i * 9, hy + 20, 3, 20 + Math.random() * 50);
  // runas em brasa
  g.strokeStyle = '#ff2a10';
  g.shadowColor = '#ff2a10';
  g.shadowBlur = 14;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(W / 2, H * 0.86, W * 0.18, 0, Math.PI * 2);
  g.stroke();
  g.font = '700 30px "Cinzel", Georgia, serif';
  g.fillStyle = '#ff6a4a';
  g.textAlign = 'center';
  g.fillText('÷ × − +', W / 2, H * 0.875);
  c.tex.needsUpdate = true;
}

// caveira: crânio, arcada da sobrancelha, maçãs do rosto, órbitas fundas com brasa,
// cavidade do nariz, dentes e mandíbula entreaberta
function makeSkull(boneMat, voidMat) {
  const g = new THREE.Group();
  const toothMat = boneMat.clone();
  toothMat.color = new THREE.Color(boneMat.color).multiplyScalar(0.82);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  // crânio: caixa craniana alta e comprida, rosto mais estreito embaixo
  add(new THREE.SphereGeometry(0.15, 28, 20), boneMat, 0, 0.045, -0.025, 0.92, 0.9, 1.1);
  add(new THREE.SphereGeometry(0.1, 20, 14), boneMat, 0, -0.045, 0.065, 1.02, 0.85, 0.75);
  // testa / arcada sobre os olhos
  const brow = add(new THREE.CapsuleGeometry(0.026, 0.12, 6, 12), boneMat, 0, 0.032, 0.118);
  brow.rotation.z = Math.PI / 2;
  // maçãs do rosto
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.035, 12, 10), boneMat, s * 0.078, -0.045, 0.098, 1.1, 0.75, 0.9);
  // órbitas fundas e uma brasa fraca lá dentro
  const ember = new THREE.MeshBasicMaterial({ color: 0xff3a14 });
  for (const s of [-1, 1]) {
    const o = add(new THREE.SphereGeometry(0.043, 16, 12), voidMat, s * 0.052, -0.006, 0.128, 1, 0.92, 0.7);
    o.rotation.z = s * 0.25;
    add(new THREE.SphereGeometry(0.008, 8, 6), ember, s * 0.05, -0.01, 0.146);
  }
  // cavidade do nariz (dois buracos em gota)
  for (const s of [-1, 1]) {
    const n = add(new THREE.ConeGeometry(0.013, 0.05, 8), voidMat, s * 0.011, -0.068, 0.148);
    n.rotation.set(Math.PI + 0.25, 0, s * 0.18);
  }
  // dentes de cima
  const toothGeo = new THREE.BoxGeometry(0.019, 0.032, 0.016);
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.24;
    const t = add(toothGeo, toothMat, Math.sin(a) * 0.065, -0.112, 0.06 + Math.cos(a) * 0.064);
    t.rotation.y = a;
  }
  // mandíbula entreaberta com os dentes de baixo
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.11, 0.02);
  jaw.rotation.x = 0.22;
  g.add(jaw);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), boneMat);
  chin.scale.set(1, 0.65, 1.1);
  chin.position.set(0, -0.012, 0.035);
  jaw.add(chin);
  for (const s of [-1, 1]) {
    const ramus = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.04), boneMat);
    ramus.position.set(s * 0.078, 0.02, -0.02);
    jaw.add(ramus);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.24;
    const t = new THREE.Mesh(toothGeo, toothMat);
    t.position.set(Math.sin(a) * 0.06, -0.006, 0.04 + Math.cos(a) * 0.058);
    t.rotation.y = a;
    t.scale.y = 0.85;
    jaw.add(t);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

export function createGateRoom({ character, sfx, tex, el }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020101);
  scene.fog = new THREE.Fog(0x020101, 5, 19);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 220);
  const coarse = matchMedia('(pointer: coarse)').matches;

  // ---------- luz ----------
  const hemi = new THREE.HemisphereLight(0x5a3a40, 0x080304, 0.32);
  // luz das velas do altar (é ela que deixa ler os ossos)
  const keyLight = new THREE.PointLight(0xffb070, 7, 6, 1.6);
  keyLight.position.set(TILE_X - 0.4, 1.6, 0);
  const doorGlow = new THREE.PointLight(0xff1a08, 5, 10, 1.4);
  doorGlow.position.set(DOOR_X - 0.9, 2.3, 0);
  scene.add(hemi, keyLight, doorGlow);

  // ---------- salão ----------
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, ...o });
  const stone = std({ map: tex.stone, color: 0x6a5a58 });
  const stoneDark = std({ map: tex.stone, color: 0x3a2e2e });
  const L = DOOR_X + 8;
  const cx = DOOR_X - L / 2;

  const floor = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(L, HALL * 2), L / 2, HALL), stone);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, 0);
  const ceil = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(L, HALL * 2), L / 2, HALL), stoneDark);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, 7, 0);
  scene.add(floor, ceil);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(L, 7, 0.4), L / 2, 3.5), stoneDark);
    wall.position.set(cx, 3.5, s * HALL);
    scene.add(wall);
  }
  const back = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.4, 7, HALL * 2), HALL, 3.5), stoneDark);
  back.position.set(DOOR_X - L, 3.5, 0);
  scene.add(back);
  // parede da porta, com o vão no meio (z ±1.6, até 3.6 m)
  for (const s of [-1, 1]) {
    const w = HALL - 1.6;
    const side = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.6, 7, w), w / 2, 3.5), stoneDark);
    side.position.set(DOOR_X + 0.3, 3.5, s * (1.6 + w / 2));
    scene.add(side);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 3.2), stoneDark);
  lintel.position.set(DOOR_X + 0.3, 3.6 + 1.7, 0);
  scene.add(lintel);
  // moldura da porta
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.1, 0.4), stone);
    post.position.set(DOOR_X - 0.15, 2.05, s * 1.8);
    scene.add(post);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.0), stone);
  header.position.set(DOOR_X - 0.15, 4.1, 0);
  scene.add(header);

  // colunas com tochas
  const flameGeo = new THREE.ConeGeometry(0.12, 0.38, 8).translate(0, 0.19, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
  const torches = [];
  for (const x of [-1.5, 3.4]) {
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.9, 7, 0.9), 0.5, 3.5), stone);
      col.position.set(x, 3.5, s * 4.2);
      scene.add(col);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x - 0.55, 2.7, s * 4.2);
      scene.add(flame);
      torches.push(flame);
    }
  }
  const torchLights = [-1, 1].map((s) => {
    const l = new THREE.PointLight(0xff6a2a, 11, 11, 1.5);
    l.position.set(2.6, 2.9, s * 4.0);
    scene.add(l);
    return l;
  });

  // altar das pedras
  const altar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1), stone);
  altar.position.set(TILE_X + 0.2, 0.35, 0);
  scene.add(altar);

  // velas e caveiras no altar
  const boneMat = std({ color: 0xc8b898, roughness: 0.6 });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const waxMat = std({ color: 0xd8d0b8, roughness: 0.6 });
  const candleFlames = [];
  const candleGeo = new THREE.CylinderGeometry(0.045, 0.05, 1, 8).translate(0, 0.5, 0);
  const candleFlameGeo = new THREE.SphereGeometry(0.04, 8, 6).scale(1, 2.2, 1);
  const altarDeco = new THREE.Group();
  scene.add(altarDeco);
  const skulls = [-1, 1].map((s) => {
    const k = makeSkull(boneMat, voidMat);
    altarDeco.add(k);
    return k;
  });
  const candles = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.12 + Math.random() * 0.22;
    const c = new THREE.Mesh(candleGeo, waxMat);
    c.scale.y = h;
    const f = new THREE.Mesh(candleFlameGeo, flameMat);
    altarDeco.add(c, f);
    candles.push({ c, f, h, s: i < 2 ? -1 : i < 4 ? 1 : 0 });
    candleFlames.push(f);
  }
  // espalha as velas e caveiras conforme a largura do altar
  function placeAltarDeco(halfW) {
    skulls.forEach((k, i) => {
      k.position.set(TILE_X + 0.25, 0.83, (i ? 1 : -1) * (halfW - 0.05));
      // vira o rosto para o jogador (antes uma delas olhava para fora)
      k.rotation.y = Math.atan2(EYE.x - k.position.x, -k.position.z);
    });
    candles.forEach((cd, i) => {
      const z = cd.s === 0 ? 0 : cd.s * (halfW - 0.3 - (i % 2) * 0.16);
      const x = TILE_X + 0.42 - (i % 2) * 0.1;
      cd.c.position.set(x, 0.7, z);
      cd.f.position.set(x, 0.7 + cd.h + 0.05, z);
    });
  }

  // olhos no escuro: aparecem, piscam e chegam mais perto a cada erro
  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6).scale(1.5, 0.7, 1);
  const eyes = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0, fog: false });
    const pair = new THREE.Group();
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, mat);
      e.position.set(0, 0, s * 0.09);
      pair.add(e);
    }
    scene.add(pair);
    eyes.push({ pair, mat, on: 0, t: Math.random() * 5, blink: 0, x: 0, y: 0, z: 0 });
  }
  let dread = 0; // cresce a cada erro
  function placeEye(e) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const close = Math.min(1, dread * 0.25);
    // no fundo da sala ou entre as colunas, cada vez mais perto do altar
    e.x = lerp(-4.5, 1.5, Math.random() * (0.4 + close * 0.6));
    e.z = side * lerp(7.4, 3.2, close * Math.random());
    e.y = 1.2 + Math.random() * 2.2;
    e.pair.position.set(e.x, e.y, e.z);
    e.pair.lookAt(EYE);
    e.pair.rotateY(Math.PI / 2);
    e.pair.scale.setScalar(0.8 + Math.random() * 0.6 + close * 0.6);
  }
  eyes.forEach(placeEye);

  // correntes penduradas do teto
  const linkGeo = new THREE.TorusGeometry(0.07, 0.018, 5, 10);
  const ironMat = std({ color: 0x2a2424, metalness: 0.7, roughness: 0.5 });
  for (const [x, z, n] of [[1.2, -2.6, 22], [4.2, 2.4, 16], [-0.6, 2.9, 26], [5.2, -1.9, 12]]) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(linkGeo, ironMat);
      l.position.set(x, 7 - i * 0.12, z);
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      l.rotation.x = Math.PI / 2;
      scene.add(l);
    }
  }

  // porta de duas folhas
  const doorC = makeCanvas(256, 512);
  drawDoor(doorC);
  const doorFront = std({ map: doorC.tex, emissiveMap: doorC.tex, emissive: 0x801010, emissiveIntensity: 0.3, roughness: 0.7, metalness: 0.3 });
  const doorSide = std({ color: 0x1e1412 });
  const doorMats = [doorSide, doorFront, doorSide, doorSide, doorSide, doorSide];
  const halves = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.6, 1.6), doorMats);
    m.position.set(DOOR_X, 1.8, s * 0.8);
    scene.add(m);
    return m;
  });
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 3.6), new THREE.MeshBasicMaterial({ color: 0xff3a1a }));
  seam.rotation.y = FACE;
  seam.position.set(DOOR_X - 0.12, 1.8, 0);
  scene.add(seam);

  // túnel atrás da porta
  const tunnelMat = makeTunnelMaterial();
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 90, 40, 1, true).rotateZ(Math.PI / 2), tunnelMat);
  tunnel.position.set(DOOR_X + 0.2 + 45, 1.8, 0);
  tunnel.visible = false;
  scene.add(tunnel);
  const endMat = makeVortexMaterial(); // no fim da garganta, o olho espera
  const tunnelEnd = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), endMat);
  tunnelEnd.rotation.y = FACE;
  tunnelEnd.position.set(DOOR_X + 80, 1.8, 0);
  tunnelEnd.visible = false;
  scene.add(tunnelEnd);

  // ---------- conta ----------
  const panelC = makeCanvas(512, 160);
  drawPanel(panelC);
  const panelMat = new THREE.MeshBasicMaterial({ map: panelC.tex, transparent: true, depthWrite: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), panelMat);
  panel.rotation.y = FACE;
  panel.position.set(PANEL_X + 0.04, PANEL_Y, 0);
  scene.add(panel);
  const eqGroup = new THREE.Group();
  scene.add(eqGroup);

  const slotGeo = new THREE.BoxGeometry(1, 1, 0.08);
  const tileGeo = new THREE.BoxGeometry(1, 1, 0.16);
  const tileSide = std({ map: tex.stone, color: 0x8a7a62 });

  let puzzle = null;
  let slots = [];   // { mesh, c, value, tile, w }
  let glyphs = [];  // { mesh, c, w }
  let tiles = [];   // { mesh, c, value, home, state, t, from, to, slot }
  let tileSize = 0.46;

  function clearPuzzle() {
    for (const s of slots) { eqGroup.remove(s.mesh); s.c.tex.dispose(); s.mesh.material.forEach((m) => m.dispose()); }
    for (const gl of glyphs) { eqGroup.remove(gl.mesh); gl.c.tex.dispose(); gl.mesh.material.dispose(); }
    for (const t of tiles) { scene.remove(t.mesh); t.c.tex.dispose(); t.mesh.material[4].dispose(); }
    slots = []; glyphs = []; tiles = [];
  }

  function buildPuzzle(level) {
    clearPuzzle();
    puzzle = makeGatePuzzle(level);
    // sequência de células: slot, operador, parênteses, '=', alvo
    const cells = [];
    if (puzzle.parens) cells.push({ kind: 'g', text: '(' , w: 0.32 });
    cells.push({ kind: 's' });
    cells.push({ kind: 'g', text: puzzle.ops[0], w: 0.5 });
    cells.push({ kind: 's' });
    if (puzzle.parens) cells.push({ kind: 'g', text: ')', w: 0.32 });
    if (puzzle.slots === 3) {
      cells.push({ kind: 'g', text: puzzle.ops[1], w: 0.5 });
      cells.push({ kind: 's' });
    }
    cells.push({ kind: 'g', text: '=', w: 0.5 });
    const tlen = String(puzzle.target).length;
    cells.push({ kind: 'g', text: String(puzzle.target), w: 0.3 + tlen * 0.3, target: true });

    for (const cell of cells) {
      if (cell.kind === 's') {
        const c = makeCanvas(128, 128);
        const face = new THREE.MeshBasicMaterial({ map: c.tex, transparent: true });
        const side = new THREE.MeshBasicMaterial({ color: 0x140c1c });
        const mesh = new THREE.Mesh(slotGeo, [side, side, side, side, face, side]);
        mesh.rotation.y = FACE;
        const s = { mesh, c, value: null, tile: null, w: 0.66, state: 'empty', idx: slots.length };
        mesh.userData.slot = s;
        drawSlot(c, null, slots.length === 0 ? 'next' : 'empty');
        slots.push(s);
        eqGroup.add(mesh);
        cell.ref = s;
      } else {
        const c = makeCanvas(cell.target ? 256 : 128, 128);
        drawGlyph(c, cell.text, cell.target ? '#ff7a5a' : '#e8d0c8');
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: c.tex, transparent: true, depthWrite: false }));
        mesh.rotation.y = FACE;
        mesh.userData.aspect = cell.target ? 2 : 1;
        const gl = { mesh, c, w: cell.w };
        glyphs.push(gl);
        eqGroup.add(mesh);
        cell.ref = gl;
      }
    }
    eqCells = cells;

    puzzle.tiles.forEach((value, i) => {
      const c = makeCanvas(128, 128);
      drawTile(c, value, coarse ? '' : String(i + 1));
      const face = std({ map: c.tex, emissiveMap: c.tex, emissive: 0xffd8b0, emissiveIntensity: 0.22, roughness: 0.8 });
      const mesh = new THREE.Mesh(tileGeo, [tileSide, tileSide, tileSide, tileSide, face, tileSide]);
      mesh.rotation.y = FACE;
      const t = { mesh, c, value, idx: i, home: new THREE.Vector3(), state: 'home', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), slot: null, pop: 1, hover: 0 };
      mesh.userData.tile = t;
      tiles.push(t);
      scene.add(mesh);
    });
    layout();
  }

  let eqCells = [];
  // encaixa conta e pedras no que a câmera enxerga (tela deitada ou em pé)
  // encaixa conta e pedras no que a câmera enxerga, em qualquer tamanho/proporção de tela:
  // monta o layout, projeta os cantos na tela e encolhe até tudo caber
  const fitCam = new THREE.PerspectiveCamera();
  const tmpV = new THREE.Vector3();
  function layout() {
    if (!puzzle) return;
    fitCam.copy(camera);
    fitCam.position.copy(EYE);
    fitCam.lookAt(LOOK);
    fitCam.updateMatrixWorld();
    fitCam.updateProjectionMatrix();
    // parte de cima da tela fica para o título e a dica
    const hudPx = el.root.hidden ? 120 : el.root.getBoundingClientRect().bottom + 12;
    const topNdc = Math.min(0.9, 1 - (2 * Math.max(110, hudPx)) / innerHeight);
    const box = (x, y, z, hw, hh) => {
      let ok = true;
      for (const [dy, dz] of [[-hh, -hw], [-hh, hw], [hh, -hw], [hh, hw]]) {
        tmpV.set(x, y + dy, z + dz).project(fitCam);
        if (Math.abs(tmpV.x) > 0.94 || tmpV.y < -0.94 || tmpV.y > topNdc) ok = false;
      }
      return ok;
    };
    for (let f = 1, tries = 0; tries < 14; f *= 0.9, tries++) {
      if (place(f, box) || tries === 13) break;
    }
  }

  function place(f, box) {
    let fits = true;
    // conta: na frente da moldura da porta (antes ficava atrás das colunas e cortava as pontas)
    const gap = 0.08;
    const raw = eqCells.reduce((s, c) => s + (c.kind === 's' ? 0.66 : c.w) + gap, -gap);
    const k = Math.min(1, 3.4 / raw) * f;
    let z = (-raw * k) / 2;
    for (const cell of eqCells) {
      const w = (cell.kind === 's' ? 0.66 : cell.w) * k;
      const mesh = cell.ref.mesh;
      mesh.position.set(PANEL_X, PANEL_Y, z + w / 2);
      if (cell.kind === 's') mesh.scale.set(w, w, 1);
      else mesh.scale.set(0.66 * k * mesh.userData.aspect, 0.66 * k, 1);
      z += w + gap * k;
    }
    panel.scale.set(raw * k + 0.45 * f, 0.66 * k + 0.4 * f, 1);
    panel.position.set(PANEL_X + 0.04, PANEL_Y, 0);
    if (!box(PANEL_X, PANEL_Y, 0, panel.scale.x / 2, panel.scale.y / 2)) fits = false;

    // pedras: uma fileira se couber, senão duas (ou três em tela bem estreita)
    const n = tiles.length;
    const size = 0.46 * f, step = size * 1.3;
    const dT = TILE_X - EYE.x;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const maxT = 2 * dT * tanH * camera.aspect * 0.88;
    let cols = n;
    while (cols > 2 && cols * step > maxT) cols = Math.ceil(n / (Math.ceil(n / cols) + 1));
    const rows = Math.ceil(n / cols);
    tileSize = size;
    const rowH = size * 1.22;
    const top = 0.75 + size * 0.7 + (rows - 1) * rowH; // acima do altar
    tiles.forEach((t, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      t.home.set(TILE_X, top - row * rowH, (col - (inRow - 1) / 2) * step);
      if (t.state === 'home') t.mesh.position.copy(t.home);
      // margem para o balanço e o destaque de quando o mouse passa por cima
      if (!box(t.home.x, t.home.y, t.home.z, size * 0.62, size * 0.62)) fits = false;
    });
    // as pedras (mais perto da câmera) não podem tampar a conta: o topo da fileira de cima
    // (com o balanço e o destaque) tem que ficar abaixo da base do painel na tela
    const panelBottom = tmpV.set(PANEL_X, PANEL_Y - panel.scale.y / 2, 0).project(fitCam).y;
    const tilesTop = tmpV.set(TILE_X, top + size * 0.62 + 0.12, 0).project(fitCam).y;
    if (tilesTop > panelBottom - 0.03) fits = false;
    altar.scale.z = Math.max(1.6, cols * step + 0.9);
    placeAltarDeco(altar.scale.z / 2);
    return fits;
  }

  // ---------- estado ----------
  let phase = 'idle', t = 0, onDone = null, level = 0, time = 0;
  let shake = 0, blackout = 0;
  const look = new THREE.Vector3();
  const pointer = { x: 0, y: 0, hasMove: false };
  const ray = new THREE.Raycaster();

  // frase da cena + linha de controles (só com teclado)
  const HINT = () => (dread > 0 ? 'Eles estão mais perto… monte a conta.' : 'Monte a conta nos ossos para abrir a porta.');
  const PAD_KEYS = '<b class="pb">◀▶</b> escolhe <i>✦</i> <b class="pb pb-a">A</b> coloca <i>✦</i> <b class="pb pb-b">B</b> desfaz';
  const KEYS = () => (coarse
    ? `<span class="pad-only">${PAD_KEYS}</span>`
    : `<span class="key-only"><kbd>1</kbd>–<kbd>${tiles.length}</kbd> escolhe <i>✦</i> <kbd>⌫</kbd> desfaz</span><span class="pad-only">${PAD_KEYS}</span>`);
  function setHint(text, cls = '', keys = cls ? '' : KEYS()) {
    el.hint.innerHTML = `<span class="gh-text"></span>${keys ? `<span class="gh-keys">${keys}</span>` : ''}`;
    el.hint.firstChild.textContent = text;
    el.hint.className = 'gate-hint ' + cls;
  }

  function refreshSlots(stateAll) {
    const next = slots.find((s) => s.value == null);
    for (const s of slots) {
      const st = stateAll || (s.value != null ? 'filled' : s === next ? 'next' : 'empty');
      if (s.state !== st || stateAll) { s.state = st; drawSlot(s.c, s.value, st); }
    }
  }

  function chooseTile(tile) {
    if (phase !== 'puzzle' || tile.state !== 'home') return;
    const slot = slots.find((s) => s.value == null && !s.tile);
    if (!slot) return;
    slot.tile = tile;
    tile.slot = slot;
    tile.state = 'flying';
    tile.t = 0;
    tile.from.copy(tile.mesh.position);
    tile.to.copy(slot.mesh.position).setX(PANEL_X - 0.08);
    sfx.gatePlace();
  }

  function undoSlot(slot) {
    if (phase !== 'puzzle' || !slot || !slot.tile || slot.tile.state !== 'placed') return;
    const tile = slot.tile;
    slot.tile = null;
    slot.value = null;
    tile.slot = null;
    tile.state = 'home';
    tile.mesh.visible = true;
    tile.mesh.position.copy(tile.home);
    tile.pop = 0;
    sfx.gateUndo();
    refreshSlots();
  }

  function returnAll() {
    for (const s of slots) {
      if (s.tile) {
        const tile = s.tile;
        tile.state = 'home';
        tile.slot = null;
        tile.mesh.visible = true;
        tile.mesh.position.copy(tile.home);
        tile.pop = 0;
      }
      s.tile = null;
      s.value = null;
    }
    refreshSlots();
  }

  function pick(e) {
    const r = e.target.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const objs = [...tiles.filter((t) => t.state === 'home').map((t) => t.mesh), ...slots.filter((s) => s.tile).map((s) => s.mesh)];
    const hit = ray.intersectObjects(objs, false)[0];
    return hit?.object.userData;
  }

  function onPointerDown(e) {
    if (phase !== 'puzzle') return;
    const ud = pick(e);
    if (ud?.tile) chooseTile(ud.tile);
    else if (ud?.slot) undoSlot(ud.slot);
  }
  function onPointerMove(e) {
    if (phase === 'idle') return;
    pointer.hasMove = true;
    const ud = phase === 'puzzle' ? pick(e) : null;
    for (const t of tiles) t.hoverOn = ud?.tile === t;
    e.target.style.cursor = ud ? 'pointer' : '';
  }
  // cursor do controle: ◀▶ passa pelos ossos que ainda estão no lugar, A coloca
  let padTile = null;
  function padPoint(tile) {
    padTile = tile;
    for (const t of tiles) t.hoverOn = t === tile;
  }
  function padMove(d) {
    const home = tiles.filter((t) => t.state === 'home');
    if (!home.length) return padPoint(null);
    const i = home.indexOf(padTile);
    padPoint(i < 0 ? home[d > 0 ? 0 : home.length - 1] : home[(i + d + home.length) % home.length]);
  }

  function onKey(e) {
    if (phase !== 'puzzle') return;
    if (e.code === 'PadLeft' || e.code === 'PadRight') return padMove(e.code === 'PadRight' ? 1 : -1);
    if (e.code === 'PadA') {
      if (!padTile || padTile.state !== 'home') return padMove(1);
      const chosen = padTile;
      chooseTile(chosen);
      const home = tiles.filter((t) => t.state === 'home' && t !== chosen);
      padPoint(home.find((t) => t.idx > chosen.idx) ?? home[0] ?? null); // vai para o próximo osso
      return;
    }
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      const tile = tiles[Number(m[2]) - 1];
      if (tile) chooseTile(tile);
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault();
      const filled = slots.filter((s) => s.tile && s.tile.state === 'placed');
      undoSlot(filled[filled.length - 1]);
    }
  }
  addEventListener('keydown', onKey);
  let canvasEl = null;

  // ---------- API ----------
  function start(lv, renderer, done) {
    level = lv;
    onDone = done;
    phase = 'intro';
    t = 0;
    shake = 0;
    camera.fov = camera.aspect < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
    buildPuzzle(level);
    for (const t of tiles) { t.mesh.visible = false; }
    panel.visible = false;
    eqGroup.visible = false;
    panelMat.opacity = 1;
    halves[0].position.z = -0.8;
    halves[1].position.z = 0.8;
    seam.visible = true;
    tunnel.visible = tunnelEnd.visible = false;
    doorGlow.intensity = 5;
    dread = 0;
    blackout = 0;
    eyes.forEach((e) => { e.on = 0; e.mat.opacity = 0; placeEye(e); });
    sfx.playClip('sussurros', 0.45);
    sfx.loopClip('batimento', 0.5);

    scene.add(character.root);
    character.root.position.set(0, 0, 0);
    character.root.rotation.set(0, Math.PI / 2, 0);
    character.root.scale.setScalar(1);
    character.root.visible = true;
    character.play('idle', { fade: 0, restart: true });

    if (canvasEl !== renderer.domElement) {
      canvasEl = renderer.domElement;
      canvasEl.addEventListener('pointerdown', onPointerDown);
      canvasEl.addEventListener('pointermove', onPointerMove);
    }
    el.n.textContent = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][level] ?? String(level + 1);
    el.root.hidden = true;
  }

  function update(dt) {
    if (phase === 'idle') return;
    time += dt;
    t += dt;
    tunnelMat.uniforms.uTime.value = time;
    endMat.uniforms.uTime.value = time;
    for (const [i, f] of torches.entries()) f.scale.set(1, 0.85 + Math.sin(time * 11 + i * 2) * 0.15, 1);
    // tochas tremulam e às vezes quase apagam; ao errar, tudo escurece
    blackout = Math.max(0, blackout - dt);
    const dark = blackout > 0 ? (blackout > 0.25 ? 0.03 : 1 - blackout / 0.25 * 0.97) : 1;
    const gust = Math.sin(time * 0.7) > 0.96 ? 0.35 : 1;
    for (const [i, l] of torchLights.entries()) l.intensity = 11 * dark * gust * (0.85 + Math.sin(time * 9 + i * 3) * 0.08 + Math.sin(time * 23 + i) * 0.07);
    keyLight.intensity = 7 * dark * (0.88 + Math.sin(time * 13) * 0.06 + Math.sin(time * 31) * 0.05);
    for (const [i, f] of candleFlames.entries()) f.scale.set(1, 0.8 + Math.sin(time * 15 + i * 1.7) * 0.2, 1);
    flameMat.color.set(0xff8a3a).multiplyScalar(Math.max(0.15, dark));
    const bl = parseFloat(el.blood.style.opacity) || 0;
    if (bl > 0) el.blood.style.opacity = String(Math.max(0, bl - dt * 0.9));

    // olhos: aparecem devagar, piscam, somem e reaparecem em outro canto
    const want = Math.min(eyes.length, 3 + dread * 4);
    eyes.forEach((e, i) => {
      e.t += dt;
      const active = i < want && phase !== 'warp';
      const life = 4 + (i % 5);
      if (e.t > life) { e.t = 0; placeEye(e); }
      const vis = active ? Math.min(1, e.t / 0.8) * Math.min(1, (life - e.t) / 0.5) : 0;
      const blink = (e.t * 1.3 + i) % 3.1 < 0.12 ? 0.05 : 1;
      e.on += (vis - e.on) * Math.min(1, dt * 4);
      e.mat.opacity = e.on * blink * (0.7 + 0.3 * Math.sin(time * 4 + i));
      e.pair.visible = e.mat.opacity > 0.01;
    });

    // ---------- câmera ----------
    if (phase === 'intro') {
      const DUR = 2.2;
      const k = clamp01(t / DUR), e = ease(k);
      el.warp.style.opacity = String(Math.max(0, 1 - t / 0.6));
      // da visão lateral para trás do personagem e então para dentro dos olhos
      const phi = Math.PI / 2 + (Math.PI / 2) * ease(clamp01(k * 1.15));
      const r = 6.2 * (1 - e);
      camera.position.set(
        lerp(0.4, EYE.x, e) + r * Math.cos(phi),
        lerp(2.3, EYE.y, e),
        r * Math.sin(phi),
      );
      look.set(lerp(0.4, LOOK.x, e), lerp(1.1, LOOK.y, e), 0);
      camera.lookAt(look);
      character.root.visible = r > 1.3;
      if (k > 0.55 && !panel.visible) {
        panel.visible = eqGroup.visible = true;
        for (const tl of tiles) { tl.mesh.visible = true; tl.pop = 0; }
        sfx.gateAppear();
      }
      if (k >= 1) {
        phase = 'puzzle';
        t = 0;
        el.root.hidden = false;
        layout();
        setHint(HINT());
      }
    } else if (phase === 'warp') {
      const DUR = 2.4;
      const k = clamp01(t / DUR);
      const x = EYE.x + (DOOR_X + 50 - EYE.x) * k * k * k;
      camera.position.set(x, lerp(EYE.y, 1.8, clamp01(k * 2)), 0);
      look.set(x + 10, 1.8, 0);
      camera.lookAt(look);
      camera.rotation.z += Math.sin(time * 3) * 0.08 * k;
      camera.fov = lerp(camera.aspect < 1 ? 72 : 55, 105, k * k);
      camera.updateProjectionMatrix();
      el.warp.style.opacity = String(clamp01((t - 1.6) / 0.7));
      if (t >= DUR) {
        phase = 'idle';
        el.root.hidden = true;
        camera.fov = camera.aspect < 1 ? 72 : 55;
        camera.updateProjectionMatrix();
        onDone?.();
        return;
      }
    } else {
      // primeira pessoa: respiração + olhar segue o ponteiro de leve
      camera.position.set(EYE.x, EYE.y + Math.sin(time * 1.6) * 0.012, 0);
      const px = pointer.hasMove && !coarse ? pointer.x : 0, py = pointer.hasMove && !coarse ? pointer.y : 0;
      look.set(LOOK.x, LOOK.y + py * 0.25, -px * 0.35);
      camera.lookAt(look);
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.6);
      camera.position.x += (Math.random() - 0.5) * shake * 0.12;
      camera.position.y += (Math.random() - 0.5) * shake * 0.12;
      camera.position.z += (Math.random() - 0.5) * shake * 0.12;
    }

    // ---------- pedras ----------
    for (const tl of tiles) {
      const m = tl.mesh;
      if (tl.state === 'home') {
        tl.pop = Math.min(1, tl.pop + dt * 4);
        const hv = tl.hoverOn ? 1.12 : 1;
        tl.hover += (hv - tl.hover) * Math.min(1, dt * 12);
        const s = tileSize * ease(tl.pop) * tl.hover;
        const lift = (tl.hover - 1) / 0.12; // 0..1: selecionado sobe e acende
        m.scale.set(s, s, s);
        m.position.set(tl.home.x, tl.home.y + Math.sin(time * 2 + tl.idx) * 0.03 + lift * 0.22, tl.home.z);
        m.material[4].emissiveIntensity = 0.22 + lift * 0.55;
        m.rotation.set(0, FACE + Math.sin(time * 1.3 + tl.idx) * 0.08, Math.sin(time * 1.1 + tl.idx * 2) * 0.04);
      } else if (tl.state === 'flying') {
        m.material[4].emissiveIntensity = 0.22;
        tl.hover = 1;
        tl.t += dt / 0.32;
        const k = clamp01(tl.t), e = ease(k);
        m.position.lerpVectors(tl.from, tl.to, e);
        m.position.y += Math.sin(k * Math.PI) * 0.6;
        const target = tl.slot.mesh.scale.x;
        const s = lerp(tileSize, target, e);
        m.scale.set(s, s, s);
        m.rotation.set(0, FACE + k * Math.PI * 2, 0);
        if (k >= 1) {
          tl.state = 'placed';
          m.visible = false;
          tl.slot.value = tl.value;
          refreshSlots();
          sfx.gateTick();
          if (slots.every((s) => s.value != null)) { phase = 'check'; t = 0; }
        }
      }
    }

    // a próxima casa vazia pulsa
    for (const s of slots) {
      s.mesh.position.x = PANEL_X - (s.state === 'next' ? (Math.sin(time * 6) * 0.5 + 0.5) * 0.06 : 0);
    }

    // ---------- fases da conta ----------
    if (phase === 'check' && t > 0.25) {
      const ok = puzzle.check(slots.map((s) => s.value));
      t = 0;
      if (ok) {
        phase = 'success';
        refreshSlots('ok');
        sfx.gateOk();
        sfx.playClip('sino', 0.6);
        setHint('A porta cede… não olhe para trás', 'ok');
      } else {
        phase = 'fail';
        refreshSlots('bad');
        shake = 1;
        sfx.gateBad();

        setHint('ERRADO. As velas se apagam…', 'bad');
        dread++;
        blackout = 0.7;
        el.blood.style.opacity = '0.9';
        sfx.playClip('rosnado', 0.55);
        eyes.forEach((e) => { e.t = 0; placeEye(e); });
      }
    } else if (phase === 'fail' && t > 0.9) {
      returnAll();
      phase = 'puzzle';
      setHint(HINT());
    } else if (phase === 'success') {
      doorGlow.intensity = 5 + Math.sin(t * 12) * 3 + t * 8;
      if (t > 0.9) {
        phase = 'open';
        t = 0;
        tunnel.visible = tunnelEnd.visible = true;
        sfx.rumble();
        sfx.playClip('porta-rangendo', 0.6);
        el.root.hidden = true;
        // pedras que sobraram se desfazem
        for (const tl of tiles) if (tl.state === 'home') tl.state = 'gone';
      }
    } else if (phase === 'open') {
      const k = ease(clamp01(t / 1.5));
      shake = Math.max(shake, 0.35 * (1 - k));
      halves[0].position.z = -0.8 - 1.65 * k;
      halves[1].position.z = 0.8 + 1.65 * k;
      seam.visible = k < 0.05;
      panelMat.opacity = 1 - clamp01(t / 0.6);
      eqGroup.visible = t < 0.6;
      panel.visible = t < 0.6;
      eqGroup.position.y = t * 0.4;
      doorGlow.intensity = 14 + k * 20;
      for (const tl of tiles) if (tl.state === 'gone') {
        const s = tileSize * Math.max(0, 1 - t * 2);
        tl.mesh.scale.set(s, s, s);
        tl.mesh.position.y += dt * 0.8;
      }
      if (t > 1.6) {
        phase = 'warp';
        t = 0;
        eqGroup.position.y = 0;
        sfx.warp();
        sfx.stopClip('batimento');
        sfx.playClip('sussurros', 0.6);
      }
    }
  }

  function render(renderer) {
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    if (phase !== 'warp') camera.fov = camera.aspect < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
    layout();
  }
  resize();

  return {
    scene, camera, start, update, render, resize,
    /** monta uma conta só para a tela de carregamento aquecer a GPU */
    prewarm() { buildPuzzle(1); },
    get active() { return phase !== 'idle'; },
  };
}
