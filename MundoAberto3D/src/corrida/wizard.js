import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * O Mago da casa, modelado em detalhe (sem arquivo de modelo, tudo gerado aqui):
 * túnica de linho com dobras, faixas douradas bordadas, estola comprida, capa de ombros pontuda,
 * mangas largas de sino, cinto com fivela e pedra, mãos com dedos e unhas, rosto esculpido
 * (testa, órbitas, maçãs do rosto, nariz adunco), olhos de verdade com íris acesa,
 * barba, bigode, sobrancelhas e cabelo fio a fio, chapéu de ponta enrolada e cajado ornamentado.
 * Origem do grupo = chão.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// números "aleatórios" sempre iguais (o Mago é o mesmo em toda partida)
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTex(w, h, draw, rx = 1, ry = 1, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

// ---------- texturas ----------
// linho: trama de fios na horizontal e na vertical, com manchas de uso
function weave(g, w, h, base, light, dark, R) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = R() < 0.5 ? light : dark; g.globalAlpha = 0.1 + R() * 0.22; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 2) { g.fillStyle = R() < 0.5 ? light : dark; g.globalAlpha = 0.1 + R() * 0.22; g.fillRect(x, 0, 1, h); }
  g.globalAlpha = 1;
  for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? light : dark; g.globalAlpha = R() * 0.25; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1); }
  for (let i = 0; i < 9; i++) {
    const x = R() * w, y = R() * h, r = 20 + R() * 50;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, '#00000030'); gr.addColorStop(1, '#0000');
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
}
const clothTex = (base, light, dark, rx, ry, seed) => canvasTex(256, 256, (g, w, h) => weave(g, w, h, base, light, dark, rng(seed)), rx, ry);
const clothBump = (rx, ry) => canvasTex(256, 256, (g, w, h) => weave(g, w, h, '#808080', '#d0d0d0', '#303030', rng(5)), rx, ry, false);

// bordado dourado: tranças entrelaçadas entre dois frisos
function drawTrim(g, w, h, gold) {
  g.fillStyle = gold ? '#7a5a1c' : '#404040';
  g.fillRect(0, 0, w, h);
  const hi = gold ? '#e8c468' : '#ffffff', mid = gold ? '#b08a30' : '#b0b0b0', lo = gold ? '#3a2808' : '#000000';
  g.fillStyle = mid; g.fillRect(0, 0, w, h);
  g.fillStyle = lo; g.fillRect(w * 0.12, 0, w * 0.76, h);
  g.fillStyle = hi; g.fillRect(w * 0.04, 0, w * 0.05, h); g.fillRect(w * 0.91, 0, w * 0.05, h);
  g.lineCap = 'round';
  for (const [ph, col, lw] of [[0, lo, 13], [0, hi, 8], [Math.PI, lo, 13], [Math.PI, hi, 8], [Math.PI / 2, lo, 9], [Math.PI / 2, mid, 5]]) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let y = -4; y <= h + 4; y += 2) { const x = w / 2 + Math.sin((y / h) * Math.PI * 4 + ph) * w * 0.24; g[y === -4 ? 'moveTo' : 'lineTo'](x, y); }
    g.stroke();
  }
  g.fillStyle = hi;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w / 2, (i + 0.5) * (h / 4), 4, 0, 7); g.fill(); }
  if (gold) { // ouro velho: manchas escuras
    const R = rng(11);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(30,18,4,${R() * 0.35})`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 5, 0, 7); g.fill(); }
  }
}
const trimTex = (rx, ry) => canvasTex(64, 128, (g, w, h) => drawTrim(g, w, h, true), rx, ry);
const trimBump = (rx, ry) => canvasTex(64, 128, (g, w, h) => drawTrim(g, w, h, false), rx, ry, false);

// pele velha: manchas, olheiras fundas e rugas na testa (o rosto fica em u = 0,25 da esfera)
const skinTex = () => canvasTex(512, 256, (g, w, h) => {
  const R = rng(3);
  g.fillStyle = '#a79f8c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? '#8a8272' : '#bcb4a0'; g.globalAlpha = R() * 0.3; g.fillRect(R() * w, R() * h, 2, 2); }
  g.globalAlpha = 1;
  const fx = w * 0.25;
  for (const s of [-1, 1]) { // olheiras
    const x = fx + s * 34, y = h * 0.47;
    const gr = g.createRadialGradient(x, y, 2, x, y, 30);
    gr.addColorStop(0, '#2a1c2ccc'); gr.addColorStop(1, '#2a1c2c00');
    g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60);
  }
  g.strokeStyle = '#5a5044aa'; g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) { // testa
    const y = h * 0.3 + i * 5;
    g.beginPath(); g.moveTo(fx - 46, y + 3);
    g.bezierCurveTo(fx - 20, y - 3, fx + 20, y - 3, fx + 46, y + 3); g.stroke();
  }
  for (const s of [-1, 1]) { // pés de galinha e sulcos da boca
    g.beginPath(); g.moveTo(fx + s * 18, h * 0.56); g.quadraticCurveTo(fx + s * 32, h * 0.64, fx + s * 28, h * 0.74); g.stroke();
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(70,50,40,${0.15 + R() * 0.3})`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 4, 0, 7); g.fill(); }
  // palidez de morto nas bochechas
  const gr = g.createLinearGradient(0, h * 0.5, 0, h);
  gr.addColorStop(0, '#6a786a00'); gr.addColorStop(1, '#6a786a55');
  g.fillStyle = gr; g.fillRect(0, h * 0.5, w, h * 0.5);
}, 1, 1);

const irisTex = () => canvasTex(64, 64, (g, w) => {
  const c = w / 2;
  const gr = g.createRadialGradient(c, c, 3, c, c, c);
  gr.addColorStop(0, '#f4ffb0'); gr.addColorStop(0.45, '#9cff3a'); gr.addColorStop(0.85, '#2a8a10'); gr.addColorStop(1, '#0a2a04');
  g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
  g.strokeStyle = '#1a5a0888';
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 8, c + Math.sin(a) * 8); g.lineTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); g.stroke(); }
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(c, c, 4.5, 15, 0, 0, 7); g.fill(); // pupila em fenda
}, 1, 1);

const woodTex = () => canvasTex(64, 256, (g, w, h) => {
  const R = rng(8);
  g.fillStyle = '#3a2616'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = R() < 0.5 ? '#1c1008' : '#5a3c22'; g.globalAlpha = 0.3 + R() * 0.5; g.lineWidth = 1 + R() * 2;
    const x = R() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + R() * 14 - 7, h * 0.3, x + R() * 14 - 7, h * 0.7, x + R() * 8 - 4, h); g.stroke();
  }
  g.globalAlpha = 1;
}, 2, 3);

// ---------- geometria ----------
/** tubo de raio variável ao longo de uma curva (dedos, nariz, chapéu, fios, chifres, cajado) */
function tube(points, radiusFn, tub = 12, rad = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const fr = curve.computeFrenetFrames(tub, false);
  const pos = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= tub; i++) {
    const t = i / tub;
    curve.getPointAt(t, P);
    const r = radiusFn(t), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
      pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s);
      uv.push(j / rad, t);
    }
  }
  for (let i = 0; i < tub; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** pinta a geometria inteira de uma cor (para juntar fios de tons diferentes numa malha só) */
function tinted(g, r, gg, b) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** normais suaves também na emenda (vértices repetidos no mesmo lugar passam a ter a mesma normal) */
function smoothSeam(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    (map.get(k) ?? map.set(k, []).get(k)).push(i);
  }
  const v = new THREE.Vector3();
  for (const list of map.values()) {
    if (list.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of list) v.x += n.getX(i), v.y += n.getY(i), v.z += n.getZ(i);
    v.normalize();
    for (const i of list) n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

export function createWizard() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // tudo que se mexe junto
  group.add(body);
  const R = rng(42);

  // ---------- materiais ----------
  const bump = clothBump(7, 5);
  const robeMat = new THREE.MeshStandardMaterial({ map: clothTex('#2e2a66', '#5650a4', '#141038', 7, 5, 1), bumpMap: bump, bumpScale: 0.6, roughness: 0.95, side: THREE.DoubleSide });
  const liningMat = new THREE.MeshStandardMaterial({ color: 0x0a0814, roughness: 1, side: THREE.BackSide });
  const capeMat = new THREE.MeshStandardMaterial({ map: clothTex('#1c1838', '#3a3470', '#080618', 5, 2, 2), bumpMap: clothBump(5, 2), bumpScale: 0.6, roughness: 0.95, side: THREE.DoubleSide });
  const stoleMat = new THREE.MeshStandardMaterial({ map: clothTex('#5c1420', '#8a2a34', '#2a060c', 1.2, 6, 3), bumpMap: clothBump(1.2, 6), bumpScale: 0.6, roughness: 0.9, side: THREE.DoubleSide });
  const goldOpts = { color: 0xffffff, metalness: 0.55, roughness: 0.42, emissive: 0x2a1c06, emissiveIntensity: 0.9, bumpScale: 1.4, side: THREE.DoubleSide };
  const gold = (rx, ry) => new THREE.MeshStandardMaterial({ ...goldOpts, map: trimTex(rx, ry), bumpMap: trimBump(rx, ry) });
  const goldPlain = new THREE.MeshStandardMaterial({ color: 0xb08a30, metalness: 0.6, roughness: 0.38, emissive: 0x2a1c06, emissiveIntensity: 0.9 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.7 });
  const skinMap = skinTex();
  const skinMat = new THREE.MeshStandardMaterial({ map: skinMap, roughness: 0.62 });
  const skinPlain = new THREE.MeshStandardMaterial({ color: 0xa79f8c, roughness: 0.62 });
  const nailMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.4 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.78 });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x030103 });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xc8c2a0, roughness: 0.3, emissive: 0x30341c, emissiveIntensity: 0.5 });
  const irisMat = new THREE.MeshBasicMaterial({ map: irisTex() });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: 0.5 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.85 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.5 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8aff7a, emissive: 0x3aff2a, emissiveIntensity: 2, roughness: 0.15, transparent: true, opacity: 0.88, flatShading: true });
  const wispMat = new THREE.MeshBasicMaterial({ color: 0x9aff6a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const gemMat = new THREE.MeshStandardMaterial({ color: 0x4aff5a, emissive: 0x2aff3a, emissiveIntensity: 1.6, roughness: 0.1, flatShading: true });

  // ---------- túnica ----------
  const SEG = 72;
  const profile = new THREE.SplineCurve([
    [1.0, 0], [0.97, 0.14], [0.82, 0.62], [0.65, 1.15], [0.55, 1.52], [0.56, 1.86], [0.6, 2.12], [0.5, 2.33], [0.3, 2.46], [0.15, 2.56],
  ].map(([r, y]) => new THREE.Vector2(r * 0.88, y))).getPoints(56);
  // dobras do tecido: quase nada no peito, fundas na barra; a barra ondula
  const foldAt = (a, y) => {
    const t = clamp(1 - y / 2.2, 0, 1), w = t * t;
    return 1 + w * (0.07 * Math.sin(a * 7 + 1.3) + 0.045 * Math.sin(a * 13 + 0.4) + 0.025 * Math.sin(a * 23 + 2.1)) + (1 - t) * 0.012 * Math.sin(a * 5);
  };
  function drape(geo, scale = 1) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z), k = foldAt(a, y) * scale;
      const hem = y < 0.02 ? 0.035 * Math.sin(a * 7 + 1.3) + 0.02 * Math.sin(a * 3) : 0;
      p.setXYZ(i, x * k, y + hem, z * k * 0.9); // um pouco mais fino de frente para trás
    }
    return smoothSeam(geo);
  }
  const between = (y0, y1) => profile.filter((v) => v.y >= y0 - 1e-3 && v.y <= y1 + 1e-3);
  const lathe = (pts, seg = SEG, a0 = 0, len = Math.PI * 2) => new THREE.LatheGeometry(pts, seg, a0, len);
  const mesh = (geo, mat, parent = body) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  mesh(drape(lathe(profile)), robeMat);
  mesh(drape(lathe(between(0, 0.34)), 1.012), gold(22, 1));                       // barra bordada
  mesh(drape(lathe(between(0.3, 2.3), 6, -0.1, 0.2), 1.014), gold(1, 9));         // faixa da frente
  // estola: duas tiras compridas caindo dos ombros, com ponta dourada
  for (const s of [-1, 1]) {
    const a0 = s > 0 ? 0.15 : -0.47;
    mesh(drape(lathe(between(0.72, 2.32), 8, a0, 0.32), 1.03), stoleMat);
    mesh(drape(lathe(between(0.72, 0.9), 8, a0, 0.32), 1.036), gold(2, 1));
  }
  // cinto de couro com fivela e pedra
  mesh(drape(lathe(between(1.44, 1.63)), 1.05), leatherMat);
  for (const y of [1.44, 1.63]) mesh(drape(lathe([new THREE.Vector2(0.487, y - 0.012), new THREE.Vector2(0.487, y + 0.012)]), 1.062), goldPlain);
  const buckle = new THREE.Group();
  buckle.position.set(0, 1.535, 0.5);
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 6).rotateX(Math.PI / 2), goldPlain, buckle);
  mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 6).rotateZ(Math.PI / 6), goldPlain, buckle).position.z = 0.025;
  const beltGem = mesh(new THREE.OctahedronGeometry(0.065, 0), gemMat, buckle);
  beltGem.scale.set(1, 1.3, 0.5);
  beltGem.position.z = 0.035;
  body.add(buckle);

  // ---------- capa de ombros pontuda, com gola dupla dourada ----------
  const capeR = (a) => 0.58 + 0.3 * Math.pow(Math.abs(Math.sin(a)), 2.4);           // pontas nos ombros
  const capeDrop = (a) => 0.3 + 0.36 * Math.pow(Math.max(0, Math.cos(a)), 5) + 0.1 * Math.pow(Math.max(0, -Math.cos(a)), 3); // bico na frente
  const capePt = (a, s, out = 0) => {
    const e = Math.pow(s, 0.8), r = lerp(0.17, capeR(a), e) + out;
    const y = 2.6 - capeDrop(a) * Math.pow(s, 1.5) + 0.1 * Math.pow(Math.abs(Math.sin(a)), 5) * s * s + 0.015 * Math.sin(a * 9) * s;
    return [Math.sin(a) * r, y, Math.cos(a) * r * 0.82 + 0.02];
  };
  {
    const na = 72, ns = 14, pos = [], uv = [], idx = [];
    for (let i = 0; i <= na; i++) for (let j = 0; j <= ns; j++) { pos.push(...capePt((i / na) * Math.PI * 2 - Math.PI, j / ns)); uv.push(i / na, j / ns); }
    for (let i = 0; i < na; i++) for (let j = 0; j < ns; j++) { const a = i * (ns + 1) + j, b = a + ns + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    mesh(smoothSeam(g), capeMat);
    const rim = (s, out) => Array.from({ length: 73 }, (_, i) => capePt((i / 72) * Math.PI * 2 - Math.PI, s, out));
    mesh(tube(rim(1, 0.01), () => 0.034, 144, 8), gold(60, 1));
    mesh(tube(rim(0.72, 0.012), () => 0.022, 144, 6), goldPlain);
    mesh(tube(rim(0.12, 0.03), () => 0.04, 48, 8), goldPlain); // gola
  }

  // ---------- braços: manga de sino, punho dourado, antebraço e mão ----------
  function makeHand(side, curl) {
    const hand = new THREE.Group();
    const palm = mesh(new THREE.SphereGeometry(0.1, 16, 12), skinPlain, hand);
    palm.scale.set(0.82, 1.0, 0.36);
    palm.position.y = -0.07;
    // tendões no dorso
    for (let i = 0; i < 4; i++) mesh(tube([[-0.05 + i * 0.034, -0.01, -0.03], [-0.058 + i * 0.039, -0.14, -0.026]], () => 0.008, 2, 5), skinPlain, hand);
    const finger = (x, len, r, spread, c) => {
      let parent = hand, y = -0.15;
      const segs = [0.42, 0.33, 0.25];
      segs.forEach((k, n) => {
        const gseg = new THREE.Group();
        gseg.position.set(n ? 0 : x, y, 0);
        gseg.rotation.x = c * (n ? 1 : 0.6);
        if (!n) gseg.rotation.z = spread;
        const L = len * k, rr = r * (1 - n * 0.14);
        mesh(new THREE.CapsuleGeometry(rr, L, 4, 8).translate(0, -L / 2, 0), skinPlain, gseg);
        mesh(new THREE.SphereGeometry(rr * 1.18, 8, 6), skinPlain, gseg); // nó do dedo
        if (n === 2) { // unha comprida e escura
          const nail = mesh(new THREE.ConeGeometry(rr * 0.85, 0.07, 6).translate(0, -0.035, 0), nailMat, gseg);
          nail.position.set(0, -L - rr * 0.3, -rr * 0.25);
          nail.scale.z = 0.5;
        }
        parent.add(gseg);
        parent = gseg;
        y = -L;
      });
    };
    [[-0.058, 0.24, 0.016, -0.16], [-0.02, 0.28, 0.017, -0.05], [0.02, 0.265, 0.0165, 0.05], [0.056, 0.2, 0.0145, 0.17]]
      .forEach(([x, len, r, sp], i) => finger(x * side, len, r, sp * side, curl * (1 + i * 0.06)));
    // polegar
    const th = new THREE.Group();
    th.position.set(side * -0.075, -0.05, 0.02);
    th.rotation.set(curl * 0.5, 0, side * -0.9);
    mesh(new THREE.CapsuleGeometry(0.019, 0.09, 4, 8).translate(0, -0.045, 0), skinPlain, th);
    const th2 = new THREE.Group();
    th2.position.y = -0.1;
    th2.rotation.set(curl * 0.6, 0, side * 0.35);
    mesh(new THREE.CapsuleGeometry(0.016, 0.07, 4, 8).translate(0, -0.035, 0), skinPlain, th2);
    mesh(new THREE.ConeGeometry(0.014, 0.06, 6).translate(0, -0.1, -0.004), nailMat, th2).scale.z = 0.5;
    th.add(th2);
    hand.add(th);
    return hand;
  }
  function makeArm(side, curl) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.43, 2.3, 0.02);
    const LEN = 1.12;
    const sp = Array.from({ length: 22 }, (_, i) => { const t = i / 21; return new THREE.Vector2(0.19 + 0.3 * Math.pow(t, 1.7), -LEN * t); });
    // a manga pende do lado de baixo do braço e faz pregas
    const droop = (geo, scale = 1) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = clamp(-y / LEN, 0, 1), a = Math.atan2(x, z);
        const hang = Math.pow(0.5 - 0.5 * Math.cos(a), 2) * t * t; // 1 no lado de trás (−z)
        const k = (1 + t * 0.06 * Math.sin(a * 6 + 1)) * scale;
        p.setXYZ(i, x * k * 0.85, y - hang * 0.55, z * k - hang * 0.12);
      }
      return smoothSeam(geo);
    };
    mesh(droop(lathe(sp, 40)), robeMat, arm);
    mesh(droop(lathe(sp, 40), 0.985), liningMat, arm);
    mesh(droop(lathe(sp.slice(17), 40), 1.02), gold(14, 1), arm);
    const fore = mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.62, 12).translate(0, -0.31, 0), skinPlain, arm);
    fore.position.y = -0.62;
    const hand = makeHand(side, curl);
    hand.position.y = -1.24;
    hand.scale.setScalar(1.3);
    arm.add(hand);
    body.add(arm);
    return { arm, hand };
  }
  const L = makeArm(-1, 0.42); // gesticula (lado do livro)
  const Rt = makeArm(1, 1.25); // fechada no cajado
  Rt.arm.rotation.set(-0.86, 0, 0.12);

  // ---------- cabeça ----------
  const head = new THREE.Group();
  head.position.set(0, 2.99, 0.07);
  head.scale.setScalar(1.3);
  body.add(head);
  mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 14), skinPlain).position.set(0, 2.66, 0.02); // pescoço magro
  const HS = [0.8, 1.12, 0.94]; // crânio comprido e estreito
  {
    const g = new THREE.SphereGeometry(0.3, 64, 48);
    const p = g.attributes.position, d = new THREE.Vector3();
    const bumps = [];
    const B = (x, y, z, amt, sig, mirror = true) => {
      bumps.push([new THREE.Vector3(x, y, z).normalize(), amt, sig]);
      if (mirror && x) bumps.push([new THREE.Vector3(-x, y, z).normalize(), amt, sig]);
    };
    B(0.34, 0.3, 0.9, 0.1, 0.02);     // arco das sobrancelhas
    B(0, 0.3, 0.95, 0.05, 0.02);      // entre as sobrancelhas
    B(0.4, 0.08, 0.91, -0.11, 0.012); // órbitas fundas
    B(0.64, -0.14, 0.75, 0.1, 0.022); // maçãs do rosto
    B(0.56, -0.52, 0.64, -0.16, 0.05);// bochechas chupadas
    B(0.93, 0.25, 0.25, -0.06, 0.05); // têmporas
    B(0, -0.82, 0.57, 0.2, 0.04);     // queixo comprido
    B(0, -0.52, 0.86, 0.05, 0.02);    // boca
    B(0, 0.75, 0.6, 0.04, 0.08);      // testa
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      let k = 1;
      for (const [dir, amt, sig] of bumps) k += amt * Math.exp(-(1 - d.dot(dir)) / sig);
      const jaw = d.y < 0 ? 1 + d.y * 0.16 : 1; // mandíbula estreita
      p.setXYZ(i, d.x * 0.3 * k * jaw * HS[0], d.y * 0.3 * k * HS[1], d.z * 0.3 * k * HS[2]);
    }
    mesh(smoothSeam(g), skinMat, head);
  }
  // nariz adunco + narinas
  mesh(tube([[0, 0.1, 0.262], [0, 0.03, 0.31], [0, -0.06, 0.375], [0, -0.13, 0.385], [0, -0.175, 0.33]], (t) => (t < 0.75 ? 0.02 + t * 0.026 : 0.0395 * (1 - (t - 0.75) / 0.25) + 0.012), 16, 10), skinPlain, head).scale.x = 0.85;
  for (const s of [-1, 1]) {
    const n = mesh(new THREE.SphereGeometry(0.017, 10, 8), skinPlain, head);
    n.position.set(s * 0.028, -0.145, 0.33);
    const hole = mesh(new THREE.SphereGeometry(0.008, 8, 6), voidMat, head);
    hole.position.set(s * 0.02, -0.166, 0.328);
  }
  // olhos: globo amarelado, íris acesa com pupila em fenda, pálpebra pesada
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.094, 0.03, 0.217);
    const ball = mesh(new THREE.SphereGeometry(0.04, 20, 14), scleraMat, eg);
    const iris = mesh(new THREE.CircleGeometry(0.021, 20), irisMat, ball);
    iris.position.z = 0.0377;
    const lidU = mesh(new THREE.SphereGeometry(0.0435, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), skinPlain, eg);
    lidU.rotation.set(-0.2, 0, s * -0.38); // caída por fora: olhar de raiva
    const lidD = mesh(new THREE.SphereGeometry(0.0425, 20, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), skinPlain, eg);
    lidD.rotation.x = -0.3;
    head.add(eg);
    eyes.push({ ball, lidU, s });
  }
  // orelhas pontudas
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.07, 12, 10), skinPlain, head);
    e.scale.set(0.3, 1.25, 0.7);
    e.position.set(s * 0.235, 0, -0.02);
    e.rotation.z = s * -0.2;
  }
  // boca: lábios finos, dentes tortos e o escuro lá dentro
  const mouth = mesh(new THREE.SphereGeometry(0.07, 14, 10), voidMat, head);
  mouth.position.set(0, -0.238, 0.262);
  mouth.scale.set(1.0, 0.16, 0.5);
  const lipU = mesh(tube([[-0.07, -0.232, 0.255], [-0.03, -0.218, 0.287], [0, -0.223, 0.292], [0.03, -0.218, 0.287], [0.07, -0.232, 0.255]], (t) => 0.004 + 0.009 * Math.sin(t * Math.PI), 10, 6), skinPlain, head);
  const lipD = mesh(tube([[-0.07, -0.235, 0.255], [-0.03, -0.25, 0.284], [0, -0.253, 0.288], [0.03, -0.25, 0.284], [0.07, -0.235, 0.255]], (t) => 0.004 + 0.011 * Math.sin(t * Math.PI), 10, 6), skinPlain, head);
  const teethD = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.017, z = 0.278 - Math.abs(i - 3) * 0.006;
    const up = mesh(new THREE.ConeGeometry(0.008, 0.03 + (i % 3) * 0.008, 5).rotateX(Math.PI), toothMat, head);
    up.position.set(x, -0.238, z);
    if (i % 2) { const dn = mesh(new THREE.ConeGeometry(0.008, 0.028, 5), toothMat, teethD); dn.position.set(x + 0.006, -0.246, z - 0.004); }
  }
  head.add(teethD);

  // ---------- pelos: barba, bigode, sobrancelhas e cabelo, fio a fio ----------
  const strands = { beard: [], head: [] };
  const strand = (list, pts, r0, tone, tub = 6) => {
    const k = tone * (0.86 + R() * 0.2);
    list.push(tinted(tube(pts, (t) => r0 * (1 - t * 0.85) + 0.001, tub, 5), k * 0.82, k * 0.82, k * 0.78));
  };
  // barba: três camadas a partir da linha do queixo; no meio ela chega até a cintura
  for (let layer = 0; layer < 4; layer++) {
    const n = 64 - layer * 5;
    for (let i = 0; i < n; i++) {
      const u = (i + R() * 0.8) / n * 2 - 1, phi = u * 1.42, c = Math.cos(phi);
      const root = [Math.sin(phi) * (0.185 - layer * 0.012), -0.2 - 0.13 * c * c - layer * 0.035 + R() * 0.03 + (1 - c) * 0.12, 0.03 + c * (0.2 + layer * 0.012)];
      const len = (0.28 + 0.95 * Math.pow(c, 2.2)) * (0.72 + R() * 0.4) * (1 - layer * 0.07);
      const wav = (R() - 0.5) * 0.09;
      // cai para a frente, por cima da capa e do peito
      strand(strands.beard, [
        root,
        [root[0] * 1.12 + wav * 0.3, root[1] - len * 0.3, root[2] + 0.06 + c * 0.12],
        [root[0] * 0.8 + wav, root[1] - len * 0.68, root[2] + 0.07 + c * 0.2 + layer * 0.008],
        [root[0] * 0.42 + wav * 0.5, root[1] - len, root[2] + 0.05 + c * 0.24 + R() * 0.03],
      ], 0.0085 + R() * 0.005, 0.56 + layer * 0.09, 7);
    }
  }
  // bigode caído pelos cantos da boca
  for (const s of [-1, 1]) for (let i = 0; i < 22; i++) {
    const x0 = s * (0.008 + R() * 0.05), len = 0.3 + R() * 0.22;
    strand(strands.beard, [
      [x0, -0.19 - R() * 0.015, 0.3],
      [x0 + s * 0.05, -0.215, 0.31],
      [x0 + s * 0.085, -0.26 - len * 0.35, 0.3],
      [x0 + s * (0.07 + R() * 0.03), -0.26 - len, 0.3 + R() * 0.05],
    ], 0.007 + R() * 0.004, 0.86, 7);
  }
  // sobrancelhas espessas, puxadas para cima nas pontas
  for (const s of [-1, 1]) for (let i = 0; i < 26; i++) {
    const t = i / 25, x = s * (0.02 + t * 0.13);
    const y = 0.092 + Math.sin(t * Math.PI) * 0.02 - t * 0.012 + (R() - 0.5) * 0.012, z = 0.292 - t * t * 0.075;
    strand(strands.head, [[x, y, z], [x + s * 0.02, y + 0.012, z + 0.012 - t * 0.012], [x + s * 0.045, y + 0.004 - t * 0.02, z - 0.006 - t * 0.03]], 0.007, 0.8, 3);
  }
  // cabelo comprido e ralo saindo por baixo do chapéu
  for (let i = 0; i < 96; i++) {
    const phi = Math.PI * (0.48 + (i / 95) * 1.04) + (R() - 0.5) * 0.08; // dos lados para trás
    const sx = Math.sin(phi), cz = Math.cos(phi), len = 0.55 + R() * 0.5;
    strand(strands.head, [
      [sx * 0.225, 0.14, cz * 0.25],
      [sx * 0.27, -0.08, cz * 0.3],
      [sx * 0.3 + (R() - 0.5) * 0.05, -0.08 - len * 0.6, cz * 0.33 + 0.02],
      [sx * 0.34 + (R() - 0.5) * 0.08, -0.08 - len, cz * 0.3 + 0.06],
    ], 0.008 + R() * 0.005, 0.6, 7);
  }
  // o queixo e a barba se mexem juntos quando ele fala
  const jaw = new THREE.Group();
  head.add(jaw);
  jaw.add(new THREE.Mesh(mergeGeometries(strands.beard), hairMat));
  const core = mesh(tube([[0, -0.27, 0.15], [0, -0.52, 0.31], [0, -0.85, 0.39], [0, -1.12, 0.41]], (t) => 0.12 * (1 - t * 0.9) + 0.01, 10, 10), new THREE.MeshStandardMaterial({ color: 0x77776f, roughness: 0.9 }), jaw);
  core.scale.x = 1.25;
  jaw.add(lipD, teethD);
  head.add(new THREE.Mesh(mergeGeometries(strands.head), hairMat));

  // ---------- chapéu: aba larga e mole, copa comprida de ponta enrolada ----------
  const hat = new THREE.Group();
  hat.position.set(0, 0.225, -0.04);
  hat.rotation.set(0.1, 0, 0.05);
  hat.scale.setScalar(0.86);
  {
    const brimPts = [[0.27, 0.02], [0.38, 0.0], [0.52, -0.02], [0.64, -0.055], [0.66, -0.05], [0.645, -0.032], [0.52, 0.0], [0.38, 0.03], [0.27, 0.05]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = lathe(brimPts, 64), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(x, z), k = Math.pow(clamp((r - 0.27) / 0.39, 0, 1), 1.6);
      p.setY(i, p.getY(i) + k * (0.06 * Math.sin(a * 3 + 0.6) + 0.03 * Math.sin(a * 5 + 2) + 0.05 * Math.cos(a)));
    }
    mesh(smoothSeam(g), capeMat, hat);
    // copa: amassada, com rugas, a ponta dá uma volta
    const crown = tube([[0, 0, 0], [-0.01, 0.34, 0], [-0.05, 0.66, -0.01], [-0.15, 0.93, -0.03], [-0.31, 1.07, -0.05], [-0.46, 1.04, -0.06], [-0.5, 0.91, -0.05], [-0.43, 0.83, -0.04]],
      (t) => (0.315 * Math.pow(1 - t, 0.82) + 0.018) * (1 + 0.035 * Math.sin(t * 46) * (1 - t)), 44, 28);
    mesh(crown, robeMat, hat).position.y = 0.02;
    const band = mesh(new THREE.CylinderGeometry(0.305, 0.325, 0.11, 40, 1, true), leatherMat, hat);
    band.position.y = 0.09;
    for (const y of [0.04, 0.145]) mesh(new THREE.TorusGeometry(y < 0.1 ? 0.326 : 0.304, 0.011, 6, 40).rotateX(Math.PI / 2), goldPlain, hat).position.y = y;
    const hb = new THREE.Group();
    hb.position.set(0, 0.09, 0.32);
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 8).rotateX(Math.PI / 2), goldPlain, hb);
    const hg = mesh(new THREE.OctahedronGeometry(0.04, 0), gemMat, hb);
    hg.scale.z = 0.5;
    hg.position.z = 0.02;
    hat.add(hb);
  }
  head.add(hat);

  // ---------- cajado ----------
  const staff = new THREE.Group();
  staff.position.set(0.62, -0.1, 0.94);
  staff.rotation.z = 0.03;
  const HEAD_Y = 3.62;
  mesh(tube([[0, 0, 0], [0.03, 0.6, 0.01], [-0.02, 1.2, -0.015], [0.025, 1.9, 0.01], [-0.015, 2.6, 0], [0, 3.3, 0.01], [0, HEAD_Y - 0.12, 0]],
    (t) => (0.056 - t * 0.014) * (1 + 0.14 * Math.sin(t * 31) * Math.sin(t * 13)), 60, 10), woodMat, staff);
  for (let i = 0; i < 12; i++) { // punho enrolado em couro
    const ring = mesh(new THREE.TorusGeometry(0.058, 0.014, 6, 14).rotateX(Math.PI / 2), leatherMat, staff);
    ring.position.set(0.0, 1.5 + i * 0.03, 0);
    ring.rotation.z = 0.2;
  }
  for (const y of [0.05, 1.44, 1.88, HEAD_Y - 0.2]) mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 16).rotateX(Math.PI / 2), goldPlain, staff).position.y = y;
  const top = new THREE.Group();
  top.position.y = HEAD_Y;
  staff.add(top);
  // taça dourada, dois chifres e garras segurando os cristais
  mesh(lathe([[0.04, -0.2], [0.07, -0.14], [0.06, -0.08], [0.13, -0.02], [0.17, 0.05], [0.15, 0.07], [0.1, 0.02], [0.0, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 20), goldPlain, top);
  for (const s of [-1, 1]) {
    mesh(tube([[s * 0.1, -0.02, 0], [s * 0.26, 0.02, 0], [s * 0.36, 0.14, 0], [s * 0.37, 0.3, 0]], (t) => 0.055 * (1 - t) + 0.006, 12, 8), hornMat, top);
    mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 12).rotateY(Math.PI / 2), goldPlain, top).position.set(s * 0.13, -0.012, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.78, cx = Math.cos(a), cz = Math.sin(a);
    mesh(tube([[cx * 0.12, 0.03, cz * 0.12], [cx * 0.2, 0.18, cz * 0.2], [cx * 0.15, 0.36, cz * 0.15], [cx * 0.07, 0.45, cz * 0.07]], (t) => 0.02 * (1 - t) + 0.004, 10, 6), goldPlain, top);
  }
  const crystals = new THREE.Group();
  crystals.position.y = 0.22;
  top.add(crystals);
  const shard = (h, r, x, z, rx, rz) => {
    const m = mesh(new THREE.CylinderGeometry(0, r, h * 0.3, 6).translate(0, h * 0.35, 0), crystalMat, crystals);
    mesh(new THREE.CylinderGeometry(r, r * 0.7, h * 0.5, 6).translate(0, -h * 0.05, 0), crystalMat, m);
    m.position.set(x, 0.02, z);
    m.rotation.set(rx, 0, rz);
  };
  shard(0.5, 0.075, 0, 0, 0, 0);
  shard(0.3, 0.05, 0.07, 0.03, 0.3, -0.5);
  shard(0.26, 0.045, -0.07, 0.02, 0.2, 0.55);
  shard(0.24, 0.04, 0.01, -0.07, -0.55, 0.1);
  shard(0.2, 0.035, 0.0, 0.08, 0.6, -0.1);
  // fitas de energia girando em volta dos cristais
  const wisps = new THREE.Group();
  wisps.position.y = 0.2;
  top.add(wisps);
  for (let k = 0; k < 3; k++) {
    const pts = Array.from({ length: 16 }, (_, i) => { const t = i / 15, a = t * Math.PI * 2.6 + k * 2.1; return [Math.cos(a) * (0.2 - t * 0.06), -0.24 + t * 0.62, Math.sin(a) * (0.2 - t * 0.06)]; });
    mesh(tube(pts, (t) => 0.014 * Math.sin(t * Math.PI) + 0.002, 40, 5), wispMat, wisps);
  }
  const staffLight = new THREE.PointLight(0x6aff4a, 0, 9, 1.6);
  staffLight.position.y = HEAD_Y + 0.3;
  staff.add(staffLight);
  body.add(staff);

  // luz de baixo no rosto (assusta) + uma luz fria suave que deixa ver o tecido e o ouro
  const faceLight = new THREE.PointLight(0xc8ffb0, 0, 3.4, 1.8);
  faceLight.position.set(0, 2.15, 0.95);
  const keyLight = new THREE.PointLight(0xcfd4ff, 0, 7, 1.5);
  keyLight.position.set(-1.5, 3.2, 2.6);
  body.add(faceLight, keyLight);

  // sombra no chão
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  let talk = 0, mouthK = 0, power = 0, blink = 3, blinkK = 0;
  /**
   * s: { talking, point (0..1: aponta para o livro), rage (0..1: treme), power (0..1: magia acesa) }
   */
  function update(dt, time, s = {}) {
    power += ((s.power ?? 1) - power) * Math.min(1, dt * 3);
    const rage = s.rage ?? 0;
    body.position.y = 0.16 + Math.sin(time * 1.3) * 0.06 + (Math.random() - 0.5) * rage * 0.06;
    body.position.x = (Math.random() - 0.5) * rage * 0.08;
    body.rotation.z = Math.sin(time * 0.9) * 0.02;
    body.rotation.x = Math.sin(time * 0.7) * 0.012 + 0.03; // levemente curvado para a frente
    // fala: a boca abre em sílabas, o queixo desce e leva a barba junto
    talk += ((s.talking ? 1 : 0) - talk) * Math.min(1, dt * 8);
    const syll = Math.max(0, Math.sin(time * 17) * 0.6 + Math.sin(time * 11.3) * 0.5);
    mouthK += (talk * (0.3 + syll) - mouthK) * Math.min(1, dt * 22);
    mouth.scale.y = 0.16 + mouthK * 0.75;
    mouth.position.y = -0.238 - mouthK * 0.02;
    jaw.position.y = -mouthK * 0.035;
    jaw.rotation.x = mouthK * 0.05;
    lipU.position.y = mouthK * 0.006;
    head.rotation.set(
      Math.sin(time * 0.7) * 0.04 + talk * Math.sin(time * 5) * 0.035 + 0.06,
      Math.sin(time * 0.5) * 0.1,
      Math.sin(time * 0.6) * 0.03 + rage * Math.sin(time * 40) * 0.08,
    );
    // olhos: a íris arde, as pálpebras piscam devagar e apertam quando ele se irrita
    const flick = 0.86 + Math.sin(time * 23) * 0.07 + Math.sin(time * 7) * 0.07;
    irisMat.color.setScalar(Math.min(1.6, (0.25 + power * 0.75) * flick * (1 + talk * 0.25 + rage * 0.8)));
    blink -= dt;
    if (blink < 0) blink = 2.5 + Math.random() * 4;
    blinkK += ((blink < 0.13 ? 1 : 0) - blinkK) * Math.min(1, dt * 30);
    for (const e of eyes) {
      e.lidU.rotation.x = -0.2 + blinkK * 0.95 + rage * 0.1;
      e.ball.rotation.set(Math.sin(time * 0.37) * 0.05 + 0.16, Math.sin(time * 0.53) * 0.16, 0);
    }
    // braço que gesticula / aponta para o livro
    const pt = s.point ?? 0;
    L.arm.rotation.x = -0.3 - talk * (0.45 + Math.sin(time * 3.1) * 0.22) - pt * 0.8;
    L.arm.rotation.z = -0.2 - talk * 0.18 - pt * 0.5 + Math.sin(time * 2.3) * 0.05;
    L.hand.rotation.x = -0.25 - talk * 0.3 + Math.sin(time * 2.7) * 0.12 * (0.3 + talk);
    Rt.arm.rotation.x = -0.86 + Math.sin(time * 1.3) * 0.03;
    crystals.rotation.y = time * 0.5;
    wisps.rotation.y = -time * 2.2;
    wisps.scale.setScalar(0.6 + power * (0.45 + Math.sin(time * 4) * 0.06 + rage * 0.4));
    wispMat.opacity = power * (0.55 + Math.sin(time * 9) * 0.15);
    staffLight.intensity = power * (3.2 + Math.sin(time * 9) * 0.6 + talk * 1.2 + rage * 9);
    faceLight.intensity = power * (0.55 + talk * 0.3 + rage * 3) * flick;
    keyLight.intensity = 2 + power * 4;
    crystalMat.emissiveIntensity = 0.25 + power * (1.9 + rage * 3);
    gemMat.emissiveIntensity = 0.2 + power * (1.3 + Math.sin(time * 3) * 0.3);
  }
  update(0, 0, { power: 0 });

  return { group, body, update };
}
