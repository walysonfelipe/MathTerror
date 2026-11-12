import * as THREE from 'three';

/**
 * Abóbora de terror: gomos esculpidos na geometria, casca apodrecida,
 * rosto entalhado com borda queimada e vela tremeluzindo por dentro,
 * talo retorcido com gavinha seca e luz vazando no chão.
 *
 * A frente do rosto fica em +z (u = 0.25 na UV da esfera).
 */

const W = 1024, H = 512;
const CX = W * 0.25, CY = H * 0.5; // centro do rosto na textura
// a projeção da esfera estica o vertical: comprime o rosto para caber entre os polos
const FY = (y) => CY - 20 + y * 0.68;

function canvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

// formas do rosto (usadas no mapa de cor e no de brilho)
function faceShapes(g) {
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(CX + x, FY(y)) : g.moveTo(CX + x, FY(y))));
    g.closePath();
    g.fill();
  };
  // olhos inclinados de raiva
  for (const s of [-1, 1]) {
    poly([[s * 128, -84], [s * 38, -40], [s * 52, -6], [s * 92, 4], [s * 132, -30]]);
  }
  // nariz: triângulo invertido torto
  poly([[-20, 4], [22, 2], [3, 40]]);
  // boca rasgada e aberta, com presas separadas em cima e embaixo
  const top = [], bot = [];
  const L = 182, N = 24;
  const topY = (t) => 58 - Math.pow(Math.abs(t - 0.5) * 2, 2) * 50;            // cantos sobem
  const botY = (t) => 150 + (1 - Math.pow(Math.abs(t - 0.5) * 2, 2)) * 34 - Math.pow(Math.abs(t - 0.5) * 2, 3) * 70;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = -L + t * 2 * L;
    // presas de cima: ponta no lugar do vértice, base com 2 segmentos de largura
    const fangT = i % 4 === 1 && t > 0.1 && t < 0.9;
    top.push([x, topY(t) + (fangT ? 52 + (i % 8 === 1 ? 12 : 0) : 0)]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, x = -L + t * 2 * L;
    const fangB = i % 4 === 3 && t > 0.15 && t < 0.85;
    bot.push([x, botY(t) - (fangB ? 46 : 0)]);
  }
  poly([...top, ...bot]);
}

function makeMaps() {
  // ---------- cor ----------
  const cc = canvas();
  const g = cc.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#3a1a06');
  base.addColorStop(0.18, '#8a3a0e');
  base.addColorStop(0.5, '#b14d14');
  base.addColorStop(0.85, '#7a300c');
  base.addColorStop(1, '#2a1004');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // sulcos entre os gomos (u = 0.0, 0.1, 0.2…)
  for (let k = 0; k <= 10; k++) {
    const x = (k / 10) * W;
    const gr = g.createLinearGradient(x - 26, 0, x + 26, 0);
    gr.addColorStop(0, '#00000000');
    gr.addColorStop(0.5, '#1a0802cc');
    gr.addColorStop(1, '#00000000');
    g.fillStyle = gr;
    g.fillRect(x - 26, 0, 52, H);
  }
  // fibras verticais
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    g.strokeStyle = Math.random() < 0.5 ? '#5a220822' : '#d4702a1a';
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y + 20 + Math.random() * 40); g.stroke();
  }
  // podridão e mofo
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * W, y = H * 0.2 + Math.random() * H * 0.65, r = 10 + Math.random() * 38;
    if (Math.abs(x - CX) < 200 && Math.abs(y - CY - 30) < 140) continue; // não suja o rosto
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, '#1e1406ee');
    gr.addColorStop(0.6, '#3a2a0e99');
    gr.addColorStop(1, '#3a2a0e00');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    for (let j = 0; j < 14; j++) {
      g.fillStyle = `rgba(${150 + Math.random() * 40},${170 + Math.random() * 40},120,${0.25 + Math.random() * 0.3})`;
      g.beginPath();
      g.arc(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 1.4, 1 + Math.random() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // rachaduras saindo da boca
  g.strokeStyle = '#140602';
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    let x = CX + s * 180, y = FY(40);
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 6; i++) { x += s * (10 + Math.random() * 14); y += (Math.random() - 0.3) * 24; g.lineTo(x, y); g.lineWidth *= 0.8; }
    g.stroke();
  }
  // entalhe: borda queimada + buraco escuro
  g.save();
  g.fillStyle = '#1c0702';
  g.shadowColor = '#000';
  g.shadowBlur = 22;
  faceShapes(g);
  g.restore();
  g.fillStyle = '#0a0201';
  faceShapes(g);

  // ---------- brilho (emissive) ----------
  const ec = canvas();
  const e = ec.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  // luz vazando em volta dos cortes
  e.save();
  e.shadowColor = '#ff5a00';
  e.shadowBlur = 40;
  e.fillStyle = '#3a1000';
  faceShapes(e);
  e.restore();
  // interior: brilho quente, mais forte no centro (a vela)
  const glow = e.createRadialGradient(CX, FY(40), 10, CX, FY(40), 230);
  glow.addColorStop(0, '#fff6c0');
  glow.addColorStop(0.35, '#ffb030');
  glow.addColorStop(0.75, '#ff5a08');
  glow.addColorStop(1, '#9a1800');
  e.fillStyle = glow;
  faceShapes(e);
  // pupilas em fenda (sombra dentro dos olhos)
  e.fillStyle = '#1a0400';
  for (const s of [-1, 1]) {
    e.beginPath();
    e.ellipse(CX + s * 82, FY(-36), 5, 15, s * 0.25, 0, Math.PI * 2);
    e.fill();
  }

  // ---------- relevo ----------
  const bc = canvas();
  const b = bc.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, W, H);
  for (let k = 0; k <= 10; k++) {
    const x = (k / 10) * W;
    const gr = b.createLinearGradient(x - 30, 0, x + 30, 0);
    gr.addColorStop(0, '#80808000');
    gr.addColorStop(0.5, '#202020');
    gr.addColorStop(1, '#80808000');
    b.fillStyle = gr;
    b.fillRect(x - 30, 0, 60, H);
  }
  b.fillStyle = '#000';
  faceShapes(b);

  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const bump = new THREE.CanvasTexture(bc);
  return { map: tex(cc), emissiveMap: tex(ec), bumpMap: bump };
}

function pumpkinGeometry() {
  const geo = new THREE.SphereGeometry(0.45, 64, 40);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = v.length();
    const a = Math.atan2(v.z, v.x);
    const yN = v.y / r;
    // 10 gomos (rosto centrado num gomo)
    const rib = Math.pow(Math.abs(Math.sin(5 * a)), 0.55);
    let s = 0.9 + 0.1 * rib;
    // achata e afunda os polos (encaixe do talo)
    const pole = Math.pow(Math.abs(yN), 6);
    s *= 1 - pole * 0.35;
    v.multiplyScalar(s);
    v.y *= 0.8;
    if (yN > 0.92) v.y -= (yN - 0.92) * 0.9;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createPumpkinFactory(tex) {
  const maps = makeMaps();
  const shellMat = new THREE.MeshStandardMaterial({
    map: maps.map, emissiveMap: maps.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4,
    bumpMap: maps.bumpMap, bumpScale: 2.5, roughness: 0.75,
  });
  const shellGeo = pumpkinGeometry();

  // talo retorcido
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.26, 0), new THREE.Vector3(0.02, 0.36, 0.01),
    new THREE.Vector3(0.07, 0.44, -0.02), new THREE.Vector3(0.15, 0.48, 0.01),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 16, 0.05, 7, false);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e2a14, roughness: 1, flatShading: true });
  // gavinha seca em espiral
  const vinePts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, a = t * Math.PI * 5;
    vinePts.push(new THREE.Vector3(-0.02 - t * 0.28 + Math.cos(a) * 0.04 * (1 - t), 0.3 + Math.sin(t * Math.PI) * 0.08, Math.sin(a) * 0.04 * (1 - t) + t * 0.05));
  }
  const vineGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vinePts), 40, 0.009, 4, false);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a3218, roughness: 1 });

  // luz vazando: halo na frente e mancha de luz no chão
  const glowMat = new THREE.SpriteMaterial({
    map: tex.puff, color: 0xff7a1a, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const spillGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const spillMat = new THREE.MeshBasicMaterial({
    map: tex.puff, color: 0xff5a10, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  function make(rand = Math.random) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 0.36;
    shell.rotation.y = (rand() - 0.5) * 0.5;  // um pouco virada, mas olhando para a câmera
    shell.rotation.z = (rand() - 0.5) * 0.12;
    shell.castShadow = true;
    shell.receiveShadow = true;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.rotation.y = rand() * Math.PI * 2;
    const vine = new THREE.Mesh(vineGeo, vineMat);
    vine.rotation.y = rand() * Math.PI * 2;
    shell.add(stem, vine);
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(0, 0.36, 0.55);
    glow.scale.setScalar(1.1);
    const spill = new THREE.Mesh(spillGeo, spillMat);
    spill.position.set(0, 0.02, 0.55);
    spill.scale.set(1.6, 1, 1.2);
    spill.renderOrder = 3;
    g.add(shell, glow, spill);
    return g;
  }

  // vela tremeluzindo (todas as abóboras juntas, material compartilhado)
  function update(time) {
    const f = 0.82 + Math.sin(time * 11) * 0.06 + Math.sin(time * 23.7) * 0.05 + Math.sin(time * 4.3) * 0.07;
    shellMat.emissiveIntensity = 1.5 * f;
    glowMat.opacity = 0.32 * f;
    spillMat.opacity = 0.38 * f;
  }

  return { make, update };
}
