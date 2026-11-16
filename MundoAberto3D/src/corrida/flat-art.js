/**
 * Arte desenhada na hora (canvas) para a Dimensão Plana:
 *  - o fundo de lava em camadas, que desliza conforme a coruja anda;
 *  - as criaturas 2D (rastejante de sombra e caveira em chamas).
 * Tudo sai de números sorteados com semente fixa: o desenho é sempre o mesmo.
 */

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// ruído que se repete a cada W pixels (a camada emenda nela mesma)
function loopNoise(rand, n, W) {
  const v = Array.from({ length: n }, rand);
  return (x) => {
    const t = (((x / W) * n) % n + n) % n;
    const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
    return v[i] * (1 - s) + v[(i + 1) % n] * s;
  };
}

// desenha a mesma coisa 3 vezes (x − W, x, x + W) para a emenda não aparecer
const wrap = (W, draw) => { for (const o of [-W, 0, W]) draw(o); };

function blob(g, x, y, r, inner, outer) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// ---------------------------------------------------------------- fundo
const W = 2048, H = 512;

// céu: breu em cima, brasa no horizonte, fumaça pesada
function drawSky() {
  const [c, g] = canvas(1024, 512);
  const rand = seeded(11);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#040102');
  sky.addColorStop(0.3, '#120305');
  sky.addColorStop(0.55, '#3a0b07');
  sky.addColorStop(0.7, '#8a2408');
  sky.addColorStop(0.76, '#d8560e');
  sky.addColorStop(1, '#2a0704');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  // fumaça: nuvens escuras com a barriga acesa pela lava
  for (let i = 0; i < 46; i++) {
    const x = rand() * 1024, y = 20 + rand() * 280, r = 60 + rand() * 130;
    blob(g, x, y + r * 0.25, r, 'rgba(120,30,8,0.14)', 'rgba(120,30,8,0)');
    blob(g, x, y, r, 'rgba(4,1,2,0.55)', 'rgba(4,1,2,0)');
  }
  return c;
}

function volcano(g, cx, base, w, h, rand, erupting) {
  const tw = w * 0.08, top = base - h;
  g.beginPath();
  g.moveTo(cx - w / 2, base);
  g.bezierCurveTo(cx - w * 0.26, base - h * 0.12, cx - tw * 2.4, top + h * 0.18, cx - tw, top);
  g.quadraticCurveTo(cx, top + h * 0.06, cx + tw, top);
  g.bezierCurveTo(cx + tw * 2.4, top + h * 0.18, cx + w * 0.26, base - h * 0.12, cx + w / 2, base);
  g.closePath();
  const body = g.createLinearGradient(0, top, 0, base);
  body.addColorStop(0, '#2e0b08');
  body.addColorStop(0.4, '#1a0606');
  body.addColorStop(1, '#0e0304');
  g.fillStyle = body;
  g.fill();
  // rios de lava descendo da cratera
  g.save();
  g.lineCap = 'round';
  g.shadowColor = '#ff5a10';
  g.shadowBlur = 8;
  const n = erupting ? 4 : 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const side = (i / (n - 1 || 1)) * 2 - 1 + (rand() - 0.5) * 0.3;
    let x = cx + side * tw * 0.8, y = top + 4;
    const len = h * (0.45 + rand() * 0.45);
    const flow = g.createLinearGradient(0, top, 0, top + len);
    flow.addColorStop(0, '#ffe08a');
    flow.addColorStop(0.3, '#ff8a1e');
    flow.addColorStop(1, 'rgba(190,30,0,0)');
    g.strokeStyle = flow;
    g.lineWidth = 1.5 + rand() * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 9; s++) {
      y += len / 9;
      x += side * (w * 0.018 + s * 1.6) + (rand() - 0.5) * 9;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  // boca acesa
  g.globalCompositeOperation = 'lighter';
  blob(g, cx, top + 2, tw * (erupting ? 4.5 : 3), 'rgba(255,130,30,0.6)', 'rgba(255,60,0,0)');
  if (erupting) {
    // coluna de fogo e faíscas
    for (let i = 0; i < 8; i++) blob(g, cx + (rand() - 0.5) * tw * 2.5, top - i * h * 0.1, tw * (1.6 + i * 0.4), 'rgba(255,100,20,0.16)', 'rgba(200,30,0,0)');
    g.fillStyle = '#ffd27a';
    for (let i = 0; i < 34; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.5, d = h * (0.1 + rand() * 0.9);
      g.globalAlpha = 0.4 + rand() * 0.6;
      g.fillRect(cx + Math.cos(a) * d * 0.7, top + Math.sin(a) * d, 2 + rand() * 2, 2 + rand() * 2);
    }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
}

// longe: vulcões e um mar de lava até o horizonte
function drawFar() {
  const [c, g] = canvas(W, H);
  const rand = seeded(23);
  const horizon = 372;
  // mar de lava
  const sea = g.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#ffb23a');
  sea.addColorStop(0.12, '#ff6a12');
  sea.addColorStop(0.6, '#b82806');
  sea.addColorStop(1, '#5a0c02');
  g.fillStyle = sea;
  g.fillRect(0, horizon, W, H - horizon);
  // crosta escura boiando (maior quanto mais perto)
  for (let i = 0; i < 150; i++) {
    const k = rand(), y = horizon + 4 + k * k * (H - horizon), x = rand() * W;
    const rx = 14 + k * 90 + rand() * 30, ry = 1.5 + k * 9;
    g.fillStyle = `rgba(${22 + rand() * 14},5,4,${0.55 + rand() * 0.3})`;
    wrap(W, (o) => { g.beginPath(); g.ellipse(x + o, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); });
  }
  // vulcões
  const list = [[150, 330, 120, false], [470, 420, 185, false], [860, 520, 235, true], [1230, 300, 110, false], [1520, 400, 170, false], [1850, 340, 140, false]];
  for (const [cx, w, h, erupting] of list) {
    wrap(W, (o) => volcano(g, cx + o, horizon + 6, w, h, seeded(cx), erupting));
  }
  // brilho do horizonte por cima da base dos vulcões
  g.globalCompositeOperation = 'lighter';
  const glow = g.createLinearGradient(0, horizon - 70, 0, horizon + 30);
  glow.addColorStop(0, 'rgba(255,90,10,0)');
  glow.addColorStop(0.75, 'rgba(255,120,30,0.3)');
  glow.addColorStop(1, 'rgba(255,90,10,0)');
  g.fillStyle = glow;
  g.fillRect(0, horizon - 70, W, 100);
  g.globalCompositeOperation = 'source-over';
  return c;
}

// serra de pedra: silhueta com a borda acesa; `falls` = cachoeiras de lava
function ridge(g, rand, { base, low, high, jag, fill, rim, falls = 0, spires = 0 }) {
  const big = loopNoise(rand, 7, W), mid = loopNoise(rand, 23, W), small = loopNoise(rand, 90, W);
  const top = (x) => {
    const k = big(x) * 0.6 + mid(x) * 0.3 + small(x) * 0.1 * jag;
    return base - low - (high - low) * Math.pow(k, 1.6);
  };
  const path = () => {
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, top(x));
    g.lineTo(W, H);
    g.closePath();
  };
  path();
  g.fillStyle = fill;
  g.fill();
  // lava escorrendo pela pedra, de uma fenda perto do topo até o pé
  for (let i = 0; i < falls; i++) {
    const x = ((i + 0.3 + rand() * 0.4) / falls) * W, y0 = top(x) + 14 + rand() * 30, w = 7 + rand() * 9;
    wrap(W, (o) => {
      const lava = g.createLinearGradient(0, y0, 0, H);
      lava.addColorStop(0, '#ffe890');
      lava.addColorStop(0.2, '#ff9a22');
      lava.addColorStop(1, '#d83606');
      g.save();
      g.shadowColor = '#ff5a10';
      g.shadowBlur = 20;
      g.fillStyle = lava;
      g.beginPath();
      g.moveTo(x + o - w * 0.3, y0);
      g.quadraticCurveTo(x + o - w * 0.7, y0 + 40, x + o - w / 2, H);
      g.lineTo(x + o + w / 2, H);
      g.quadraticCurveTo(x + o + w * 0.7, y0 + 40, x + o + w * 0.3, y0);
      g.closePath();
      g.fill();
      g.restore();
    });
  }
  // agulhas e ruínas espetadas na serra
  for (let i = 0; i < spires; i++) {
    const x = rand() * W, y = top(x), h = 50 + rand() * 120, w = 12 + rand() * 20;
    wrap(W, (o) => {
      g.beginPath();
      g.moveTo(x + o - w, y + 20);
      g.lineTo(x + o - w * 0.25, y - h * 0.7);
      g.lineTo(x + o, y - h);
      g.lineTo(x + o + w * 0.35, y - h * 0.6);
      g.lineTo(x + o + w, y + 20);
      g.closePath();
      g.fill();
    });
  }
  // fio de luz na crista (a lava ilumina por trás)
  g.save();
  path();
  g.clip();
  g.strokeStyle = rim;
  g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x <= W; x += 4) (x ? g.lineTo(x, top(x) + 1) : g.moveTo(x, top(x) + 1));
  g.stroke();
  // rachaduras em brasa
  g.lineWidth = 1.6;
  g.shadowColor = '#ff4a08';
  g.shadowBlur = 8;
  for (let i = 0; i < 26; i++) {
    let x = rand() * W, y = top(x) + 20 + rand() * 70;
    g.strokeStyle = `rgba(255,${90 + rand() * 80},20,${0.35 + rand() * 0.4})`;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (rand() - 0.5) * 26; y += 8 + rand() * 16; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
}

function drawMid() {
  const [c, g] = canvas(W, H);
  ridge(g, seeded(41), { base: 440, low: 0, high: 190, jag: 1, fill: '#1c0708', rim: 'rgba(255,110,30,0.5)', falls: 0, spires: 12 });
  // névoa quente no pé da serra
  const haze = g.createLinearGradient(0, 380, 0, H);
  haze.addColorStop(0, 'rgba(255,80,10,0)');
  haze.addColorStop(1, 'rgba(255,90,14,0.32)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = haze;
  g.fillRect(0, 380, W, H - 380);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function drawNear() {
  const [c, g] = canvas(W, H);
  ridge(g, seeded(77), { base: 475, low: 10, high: 150, jag: 2.2, fill: '#0a0304', rim: 'rgba(255,90,20,0.45)', spires: 16 });
  return c;
}

/**
 * Camadas do fundo, da mais distante para a mais próxima.
 * `factor`: quanto a camada acompanha a câmera (0 = presa na tela, 1 = presa no mundo).
 */
export function drawBackdrop() {
  return [
    { canvas: drawSky(), factor: 0, tile: false },
    { canvas: drawFar(), factor: 0.06, tile: true },
    { canvas: drawMid(), factor: 0.2, tile: true },
    { canvas: drawNear(), factor: 0.42, tile: true },
  ];
}

// ---------------------------------------------------------------- criaturas
const F = 256; // tamanho de cada quadro

// Rastejante: sombra corcunda de braços compridos, olhos e boca em brasa. Olha para a direita.
function drawCrawler(g, ox, phase) {
  const sw = Math.sin(phase * Math.PI * 2), cw = Math.cos(phase * Math.PI * 2);
  g.save();
  g.translate(ox, 0);
  const dark = '#0b0507';
  // halo de brasa em volta da silhueta (senão ela some no fundo escuro)
  g.shadowColor = '#ff5a14';
  g.shadowBlur = 12;
  // fumaça que escapa das costas
  for (let i = 0; i < 7; i++) {
    const x = 70 - i * 9 + sw * 3, y = 96 - i * 11 - (i % 2) * 6, r = 26 - i * 2.4;
    blob(g, x, y, r, 'rgba(12,5,7,0.55)', 'rgba(12,5,7,0)');
  }
  // pernas de trás e da frente (alternam)
  g.strokeStyle = dark;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 17;
  const leg = (hx, hy, s) => {
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx + 6 + s * 14, hy + 30);
    g.lineTo(hx + s * 26, 236);
    g.stroke();
  };
  leg(84, 176, sw);
  leg(126, 180, -sw);
  // corpo corcunda
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(48, 196);
  g.bezierCurveTo(20, 120, 80, 62 + cw * 2, 138, 74 + cw * 2);
  g.bezierCurveTo(176, 80, 196, 108, 204, 132);
  g.bezierCurveTo(206, 168, 170, 200, 130, 204);
  g.bezierCurveTo(100, 208, 62, 212, 48, 196);
  g.fill();
  // espinhos nas costas
  for (let i = 0; i < 6; i++) {
    const t = i / 5, x = 46 + t * 96, y = 132 - Math.sin(t * Math.PI * 0.9) * 62 + cw * 2;
    g.beginPath();
    g.moveTo(x - 9, y + 12);
    g.lineTo(x - 6 - (1 - t) * 10, y - 22 - (i % 2) * 8);
    g.lineTo(x + 10, y + 10);
    g.fill();
  }
  // cabeça baixa, esticada para a frente
  g.beginPath();
  g.ellipse(196, 128 + sw * 2, 44, 36, 0.25, 0, Math.PI * 2);
  g.fill();
  // chifres tortos
  g.beginPath(); g.moveTo(176, 102); g.quadraticCurveTo(160, 62, 190, 50); g.quadraticCurveTo(178, 78, 198, 98); g.fill();
  g.beginPath(); g.moveTo(206, 98); g.quadraticCurveTo(214, 66, 238, 64); g.quadraticCurveTo(222, 82, 226, 106); g.fill();
  // braço comprido com garras (vai e volta)
  const reach = sw * 16;
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(150, 150);
  g.lineTo(176 + reach * 0.5, 196);
  g.lineTo(206 + reach, 228);
  g.stroke();
  g.lineWidth = 5;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(206 + reach, 228);
    g.lineTo(226 + reach + i * 4, 236 + i * 7);
    g.stroke();
  }
  // brasa por dentro: olhos, boca rasgada e rachaduras no peito
  g.globalCompositeOperation = 'source-atop';
  const under = g.createLinearGradient(0, 150, 0, 240);
  under.addColorStop(0, 'rgba(255,90,20,0)');
  under.addColorStop(1, 'rgba(255,90,20,0.55)');
  g.fillStyle = under;
  g.shadowBlur = 0;
  g.fillRect(0, 150, 256, 100);
  g.globalCompositeOperation = 'source-over';
  g.shadowColor = '#ff4a08';
  g.shadowBlur = 16;
  g.fillStyle = '#ffd24a';
  const eye = (x, y, r) => { g.beginPath(); g.ellipse(x, y + sw * 2, r, r * 0.5, -0.45, 0, Math.PI * 2); g.fill(); };
  eye(196, 116, 10);
  eye(222, 122, 8);
  g.strokeStyle = '#ff8a1e';
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(184, 142 + sw * 2);
  for (let i = 1; i <= 7; i++) g.lineTo(184 + i * 7, 142 + sw * 2 + (i % 2 ? 9 : 1) + (phase > 0.5 ? 2 : 0));
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(255,110,30,0.75)';
  for (const [x, y] of [[96, 130], [122, 160], [78, 168]]) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y + 12); g.lineTo(x + 3, y + 24); g.lineTo(x + 13, y + 34); g.stroke();
  }
  g.restore();
}

// Caveira em chamas: flutua e cospe fogo. `open` = boca aberta (vai atirar).
function drawSkull(g, ox, frame, open) {
  const rand = seeded(100 + frame * 7);
  g.save();
  g.translate(ox, 0);
  const cx = 128, cy = 132;
  // labaredas atrás da cabeça
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (i / 12 - 0.5) * 2.6, len = 62 + rand() * 46, w = 20 + rand() * 12;
    const bx = cx + Math.cos(a) * 46, by = cy - 6 + Math.sin(a) * 46;
    const tx = cx + Math.cos(a) * (46 + len) + (rand() - 0.5) * 18, ty = cy - 6 + Math.sin(a) * (46 + len) - 14;
    const fl = g.createLinearGradient(bx, by, tx, ty);
    fl.addColorStop(0, 'rgba(255,220,110,0.95)');
    fl.addColorStop(0.45, 'rgba(255,110,20,0.75)');
    fl.addColorStop(1, 'rgba(170,20,0,0)');
    g.fillStyle = fl;
    g.beginPath();
    g.moveTo(bx - Math.sin(a) * w, by + Math.cos(a) * w);
    g.quadraticCurveTo((bx + tx) / 2 - Math.sin(a) * w * 0.9, (by + ty) / 2, tx, ty);
    g.quadraticCurveTo((bx + tx) / 2 + Math.sin(a) * w * 0.9, (by + ty) / 2, bx + Math.sin(a) * w, by - Math.cos(a) * w);
    g.fill();
  }
  blob(g, cx, cy, 120, 'rgba(255,120,30,0.4)', 'rgba(255,60,0,0)');
  g.globalCompositeOperation = 'source-over';
  // queixo (desce quando abre a boca)
  const jaw = open ? 20 : 4;
  const bone = g.createRadialGradient(cx - 16, cy - 30, 8, cx, cy, 90);
  bone.addColorStop(0, '#f6ecd2');
  bone.addColorStop(0.6, '#cdbd98');
  bone.addColorStop(1, '#6e5a3e');
  g.fillStyle = bone;
  g.beginPath();
  g.moveTo(cx - 34, cy + 34 + jaw);
  g.quadraticCurveTo(cx - 30, cy + 70 + jaw, cx, cy + 72 + jaw);
  g.quadraticCurveTo(cx + 30, cy + 70 + jaw, cx + 34, cy + 34 + jaw);
  g.closePath();
  g.fill();
  if (open) { g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(cx, cy + 50, 26, 15, 0, 0, Math.PI * 2); g.fill(); blob(g, cx, cy + 52, 24, 'rgba(255,170,50,0.95)', 'rgba(255,60,0,0)'); }
  // crânio
  g.fillStyle = bone;
  g.beginPath();
  g.moveTo(cx - 40, cy + 38);
  g.bezierCurveTo(cx - 78, cy + 22, cx - 76, cy - 70, cx, cy - 72);
  g.bezierCurveTo(cx + 76, cy - 70, cx + 78, cy + 22, cx + 40, cy + 38);
  g.quadraticCurveTo(cx, cy + 50, cx - 40, cy + 38);
  g.fill();
  // dentes
  g.strokeStyle = '#3a2a1c';
  g.lineWidth = 2.5;
  for (let i = -3; i <= 3; i++) {
    g.beginPath(); g.moveTo(cx + i * 10, cy + 34); g.lineTo(cx + i * 10, cy + 46); g.stroke();
    g.beginPath(); g.moveTo(cx + i * 9, cy + 52 + jaw); g.lineTo(cx + i * 9, cy + 62 + jaw); g.stroke();
  }
  // órbitas bravas, com brasa no fundo
  g.fillStyle = '#120403';
  const socket = (s) => {
    g.beginPath();
    g.moveTo(cx + s * 12, cy - 22);
    g.quadraticCurveTo(cx + s * 34, cy - 40, cx + s * 54, cy - 30);
    g.quadraticCurveTo(cx + s * 56, cy + 2, cx + s * 34, cy + 6);
    g.quadraticCurveTo(cx + s * 14, cy + 4, cx + s * 12, cy - 22);
    g.fill();
  };
  socket(-1); socket(1);
  g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(cx - 9, cy + 26); g.lineTo(cx, cy + 22); g.lineTo(cx + 9, cy + 26); g.closePath(); g.fill();
  g.shadowColor = '#ff3a00';
  g.shadowBlur = 14;
  g.fillStyle = open ? '#fff0a0' : '#ff7a1a';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 33, cy - 12, open ? 8 : 5.5 + (frame % 2), 0, Math.PI * 2); g.fill(); }
  g.shadowBlur = 0;
  // rachadura na testa
  g.strokeStyle = '#4a3826';
  g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(cx + 8, cy - 70); g.lineTo(cx + 2, cy - 54); g.lineTo(cx + 12, cy - 44); g.lineTo(cx + 6, cy - 32); g.stroke();
  g.restore();
}

/** pranchas das criaturas: 4 quadros de 256 px em linha */
export function drawCreatures() {
  const [crawler, gc] = canvas(F * 4, F);
  for (let i = 0; i < 4; i++) drawCrawler(gc, i * F, i / 4);
  const [skull, gs] = canvas(F * 4, F);
  for (let i = 0; i < 4; i++) drawSkull(gs, i * F, i, i === 3);
  return { crawler, skull, frames: 4 };
}
