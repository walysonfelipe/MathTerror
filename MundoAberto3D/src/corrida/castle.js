import * as THREE from 'three';
import { createLady } from './lady.js';
import { createArmor } from './armor.js';
import { makeLockPuzzle, makeScalePuzzle, makeSequencePuzzle, PORTRAIT_NAMES } from './castle-math.js';

/**
 * Fase do castelo (visão de lado, igual à trilha).
 * 5 salas em fila: Hall → Galeria → Masmorra → Biblioteca → Trono.
 * Cada desafio de matemática dá um pedaço da Chave do Corvo e abre a próxima porta.
 * A Dama de Branco ronda as salas: não morre, só dá para fugir ou se esconder no armário.
 */

const ROOM = 18;
// teste: index.html?castelo&damateste faz a Dama aparecer na hora, perto do jogador
const TEST_DAMA = typeof location !== 'undefined' && location.search.includes('damateste');
const ROOMS = ['Hall de Entrada', 'Galeria dos Retratos', 'Masmorra', 'Biblioteca Proibida', 'Sala do Trono'];
// sussurro ao entrar pela primeira vez (dá o clima e aponta o caminho, sem entregar a resposta)
const ROOM_WHISPERS = [
  '',
  'Três rostos te olham da parede. Na mesa, um papel esquecido.',
  'Correntes, ossos e uma balança torta. Alguém riscou a parede da cela.',
  'Prateleiras até o teto. Um livro aberto espera sobre a mesa.',
  '',
];
// recados de cada sala: enigmas que apontam o caminho sem dar a resposta
const NOTES = {
  galeria: {
    title: 'Bilhete Rasgado', kind: 'paper', sign: '— E.',
    lines: ['Os três da parede não dormem.', 'Cada um guarda um número, mas só o mostra a quem chega perto trazendo luz.',
      'O corvo da porta não quer os números. Quer o que eles fazem juntos.'],
  },
  masmorra: {
    title: 'Riscos na Parede', kind: 'stone', sign: '|||| |||| |||| ||',
    lines: ['A caveira da balança era meu companheiro de cela.', 'Ela não aceita qualquer peso. Nem um grão a mais, nem um grão a menos.',
      'Pus pedras demais. Depois, pedras de menos. Ainda estou aqui.'],
  },
  biblioteca: {
    title: 'Diário Aberto', kind: 'paper', sign: '— a bibliotecária',
    lines: ['Os livros daqui não estão em ordem de tamanho nem de cor.', 'Cada um conversa com o vizinho. Veja o que muda de um para o outro, e o que falta se revela.',
      'Quem devolve o livro errado fica para ajudar a arrumar. Para sempre.'],
  },
};
const W = ROOM * ROOMS.length; // 90 m
const CEIL = 6.5;
const BACK_Z = -2.6;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// retrato assombrado: rosto pálido, olhos vazados (os olhos de verdade são malhas que seguem o jogador)
function portraitTex(kind) {
  return canvasTex(256, 320, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, w);
    bg.addColorStop(0, '#2a1a14');
    bg.addColorStop(1, '#070302');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // roupa
    g.fillStyle = kind === 1 ? '#3a0a10' : kind === 2 ? '#1a1a2a' : '#141018';
    g.beginPath();
    g.moveTo(30, h); g.quadraticCurveTo(w / 2, h * 0.55, w - 30, h); g.fill();
    // cabelo
    g.fillStyle = kind === 1 ? '#0a0605' : kind === 2 ? '#3a2a14' : '#1a120c';
    g.beginPath(); g.ellipse(w / 2, h * 0.36, kind === 1 ? 78 : 66, kind === 1 ? 110 : 76, 0, 0, Math.PI * 2); g.fill();
    // rosto
    g.fillStyle = '#c8b8a0';
    g.beginPath(); g.ellipse(w / 2, h * 0.4, kind === 2 ? 46 : 54, kind === 2 ? 58 : 70, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#00000040';
    g.beginPath(); g.ellipse(w / 2 + 14, h * 0.42, 40, 64, 0, 0, Math.PI * 2); g.fill();
    // órbitas escuras
    g.fillStyle = '#1a0a08';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * 20, h * 0.36, 13, 9, 0, 0, Math.PI * 2); g.fill(); }
    // boca costurada
    g.strokeStyle = '#3a0a0a';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2 - 18, h * 0.52); g.lineTo(w / 2 + 18, h * 0.52); g.stroke();
    for (let i = -14; i <= 14; i += 7) { g.beginPath(); g.moveTo(w / 2 + i, h * 0.5); g.lineTo(w / 2 + i, h * 0.54); g.stroke(); }
    // lágrimas de sangue
    g.fillStyle = '#5a0204';
    for (const s of [-1, 1]) g.fillRect(w / 2 + s * 20 - 1, h * 0.38, 3, 26 + Math.random() * 20);
    // craquelado
    g.strokeStyle = '#00000055';
    g.lineWidth = 1;
    for (let i = 0; i < 30; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30); g.stroke(); }
  });
}

// ----- quadros com imagem de verdade (public/img) -----
// eyes: centro de cada olho na imagem (px) para o susto do relâmpago
const PORTRAIT_IMAGES = {
  0: { src: 'img/barao.png', eyes: [[350, 218], [455, 218]] },
  1: { src: 'img/dama.png', eyes: [[350, 216], [455, 216]] },
  2: { src: 'img/crianca.png', eyes: [[352, 283], [455, 281]] },
};
const imageCache = new Map();
// carrega uma vez e prepara duas versões: pintura antiga e a "assombrada" (olhos pretos chorando sangue)
function imagePortrait(cfg) {
  if (imageCache.has(cfg.src)) return imageCache.get(cfg.src);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 1000;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { c, g: c.getContext('2d'), t };
  };
  const normal = make(), scary = make();
  const entry = { normal: normal.t, scary: scary.t, ready: false };
  imageCache.set(cfg.src, entry);
  const img = new Image();
  img.onload = () => {
    for (const v of [normal, scary]) {
      const { g, c } = v;
      g.drawImage(img, 0, 0, c.width, c.height);
      // tinta envelhecida: tom amarelado escuro + bordas queimadas
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = '#b8a080';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(c.width / 2, c.height * 0.42, c.width * 0.25, c.width / 2, c.height / 2, c.width * 0.85);
      vg.addColorStop(0, '#0000');
      vg.addColorStop(1, '#000c');
      g.fillStyle = vg;
      g.fillRect(0, 0, c.width, c.height);
      // craquelado da tinta
      g.strokeStyle = '#00000038';
      g.lineWidth = 1;
      for (let i = 0; i < 220; i++) {
        let x = Math.random() * c.width, y = Math.random() * c.height;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
        g.stroke();
      }
    }
    // versão assombrada: olhos vazios e lágrimas de sangue
    const g = scary.g;
    for (const [ex, ey] of cfg.eyes) {
      const eg = g.createRadialGradient(ex, ey, 2, ex, ey, 26);
      eg.addColorStop(0, '#000');
      eg.addColorStop(0.7, '#050000');
      eg.addColorStop(1, '#0000');
      g.fillStyle = eg;
      g.beginPath(); g.ellipse(ex, ey, 30, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff2a10';
      g.beginPath(); g.arc(ex, ey, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a0204';
      const len = 120 + Math.random() * 90;
      g.fillRect(ex - 3, ey + 12, 6, len);
      g.beginPath(); g.arc(ex, ey + 12 + len, 6, 0, Math.PI * 2); g.fill();
    }
    normal.t.needsUpdate = true;
    scary.t.needsUpdate = true;
    entry.ready = true;
  };
  img.src = import.meta.env.BASE_URL + cfg.src;
  return entry;
}

function plateTex(name, value) {
  return canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#6a5020';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a1a08';
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#1a0e04';
    g.textAlign = 'center';
    g.font = 'italic 26px "IM Fell English", Georgia, serif';
    g.fillText(name, w / 2, 32);
    g.font = '700 42px "Cinzel", Georgia, serif';
    g.fillStyle = '#5a0204';
    g.fillText(String(value), w / 2, 80);
  });
}

function booksTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#140a06';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      const y0 = row * 64;
      g.fillStyle = '#2a1a0e';
      g.fillRect(0, y0 + 58, w, 6);
      let x = 4;
      while (x < w - 10) {
        const bw = 8 + Math.random() * 14, bh = 34 + Math.random() * 20;
        g.fillStyle = ['#3a0a0a', '#1a2a1a', '#2a1a3a', '#3a2a10', '#101828', '#2a2420'][Math.floor(Math.random() * 6)];
        g.fillRect(x, y0 + 58 - bh, bw, bh);
        g.fillStyle = '#c8a04a55';
        g.fillRect(x + 2, y0 + 58 - bh + 6, bw - 4, 2);
        x += bw + 1;
      }
    }
  });
}

export function createCastle({ tex, sfx, character, stats, el, cb }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x050304, 14, 34);

  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  const rep = (t, x, y) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; };

  // ---------- luz ----------
  const hemi = new THREE.HemisphereLight(0x4a3a5a, 0x050304, 0.38);
  const lantern = new THREE.PointLight(0xff9a48, 26, 14, 1.6);
  scene.add(hemi, lantern);
  const torches = [];
  const flameGeo = new THREE.ConeGeometry(0.12, 0.4, 8).translate(0, 0.2, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
  const ironMat = std({ color: 0x2a2626, metalness: 0.7, roughness: 0.5 });
  for (let r = 0; r < ROOMS.length; r++) {
    const x = r * ROOM + ROOM / 2;
    const l = new THREE.PointLight(0xff6a2a, 9, 10, 1.6);
    l.position.set(x, 4.6, BACK_Z + 0.9);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(x, 4.3, BACK_Z + 0.5);
    const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.4), ironMat);
    sconce.position.set(x, 4.0, BACK_Z + 0.3);
    scene.add(l, f, sconce);
    torches.push({ l, f, x });
  }

  // ---------- estrutura ----------
  const floorMat = std({ map: rep(tex.stone, W / 2, 3), color: 0x6a5e5a });
  const wallMat = std({ map: rep(tex.brick, W / 2, 5), color: 0x4a4048 });
  const darkStone = std({ map: rep(tex.stone, 2, 6), color: 0x2a2428 });
  const woodMat = std({ color: 0x2a1a10, roughness: 0.8 });
  const redMat = std({ color: 0x4a0608, roughness: 0.9 });
  const goldMat = std({ color: 0x8a6a28, metalness: 0.8, roughness: 0.35 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 20, 8, 6), floorMat);
  floor.position.set(W / 2, -4, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + 20, 24, 0.6), wallMat);
  back.position.set(W / 2, 4, BACK_Z - 0.3);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W + 20, 10, 6), darkStone);
  ceil.position.set(W / 2, CEIL + 5, 0);
  floor.receiveShadow = back.receiveShadow = true;
  scene.add(floor, back, ceil);
  for (const x of [-0.5, W + 0.5]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1, 24, 6), darkStone);
    w.position.set(x, 4, 0);
    scene.add(w);
  }
  // colunas entre as salas (atrás) e silhuetas de colunas na frente (profundidade)
  const colGeo = new THREE.BoxGeometry(1, CEIL, 0.8);
  const frontColGeo = new THREE.BoxGeometry(0.7, 30, 0.7);
  const frontColMat = new THREE.MeshBasicMaterial({ color: 0x030202 });
  for (let r = 1; r < ROOMS.length; r++) {
    const x = r * ROOM;
    const c = new THREE.Mesh(colGeo, darkStone);
    c.position.set(x, CEIL / 2, BACK_Z + 0.2);
    scene.add(c);
    const lint = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 6), darkStone);
    lint.position.set(x, CEIL - 0.3, 0);
    scene.add(lint);
  }
  for (let x = 9; x < W; x += 27) {
    const fc = new THREE.Mesh(frontColGeo, frontColMat);
    fc.position.set(x, 4, 4.2);
    scene.add(fc);
  }

  // janelas (relâmpago) + figura que aparece no clarão
  const winMat = new THREE.MeshBasicMaterial({ color: 0x0c1428 });
  const winGeo = new THREE.PlaneGeometry(1.1, 2.2);
  const windows = [];
  const figureMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), figureMat);
  // posição das janelas em cada sala (na galeria ficam nas pontas, longe dos quadros e do cadeado)
  const WINDOW_DX = [[4, 14], [1.6, 15.2], [4, 14], [4, 14], [4, 14]];
  for (let r = 0; r < ROOMS.length; r++) {
    for (const dx of WINDOW_DX[r]) {
      const x = r * ROOM + dx;
      const w = new THREE.Mesh(winGeo, winMat);
      w.position.set(x, 3.8, BACK_Z + 0.02);
      scene.add(w);
      windows.push(x);
      for (let i = -1; i <= 1; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), ironMat);
        bar.position.set(x + i * 0.3, 3.8, BACK_Z + 0.06);
        scene.add(bar);
      }
    }
  }
  figure.position.z = BACK_Z + 0.04;
  scene.add(figure);

  // tapete vermelho do hall ao trono
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(W - 4, 1.6), redMat);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(W / 2, 0.01, -0.8);
  scene.add(carpet);

  // ---------- conteúdo que muda a cada visita ----------
  const dyn = new THREE.Group();
  scene.add(dyn);
  let solids = [], coins = [], interact = [], doors = [], portraits = [], wardrobes = [];
  const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 24).rotateX(Math.PI / 2);
  const coinMat = std({ color: 0xffc627, metalness: 0.35, roughness: 0.3, emissive: 0x8a5a00, emissiveIntensity: 0.6 });

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    dyn.add(m);
    return m;
  }
  function addSolid(minX, maxX, minY, maxY, extra = {}) {
    const s = { minX, maxX, minY, maxY, kind: 'castle', ...extra };
    solids.push(s);
    return s;
  }
  function addCoin(x, y) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, y, 0);
    dyn.add(m);
    coins.push({ x, y, mesh: m });
  }
  // mesa/caixote onde dá para subir
  function addTable(x, w, h, coinsOn = 0) {
    box(w, 0.15, 1.6, woodMat, x, h - 0.075, 0);
    for (const sx of [-1, 1]) box(0.15, h - 0.15, 0.15, woodMat, x + sx * (w / 2 - 0.15), (h - 0.15) / 2, 0.5);
    addSolid(x - w / 2, x + w / 2, h - 0.15, h);
    for (let i = 0; i < coinsOn; i++) addCoin(x - (coinsOn - 1) * 0.45 + i * 0.9, h + 0.9);
  }

  // porta de ferro trancada entre salas
  function addDoor(x, label) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.7, CEIL - 0.6, 5.4), std({ color: 0x1e1a1a, metalness: 0.6, roughness: 0.5 }));
    slab.position.y = (CEIL - 0.6) / 2;
    g.add(slab);
    for (const y of [1, 2.6, 4.2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 5.5), ironMat);
      band.position.y = y;
      g.add(band);
    }
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 12), std({ color: 0xff2a10, emissive: 0xff1a08, emissiveIntensity: 1 }));
    lock.position.set(-0.36, 2.2, 2.0);
    lock.rotation.y = Math.PI / 2;
    g.add(lock);
    g.position.set(x, 0, 0);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dyn.add(g);
    const s = addSolid(x - 0.35, x + 0.35, 0, CEIL);
    const d = { x, g, s, lock, open: false, k: 0, label };
    doors.push(d);
    return d;
  }
  function openDoor(d) {
    d.open = true;
    solids = solids.filter((s) => s !== d.s);
    sfx.rumble();
    sfx.playClip('porta-rangendo', 0.6);
  }

  // guarda-roupa para se esconder da Dama
  function addWardrobe(x) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.9), woodMat);
    body.position.y = 1.4;
    g.add(body);
    const doorsW = [-1, 1].map((s) => {
      const piv = new THREE.Group();
      piv.position.set(s * 0.72, 1.4, 0.46);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.05), std({ color: 0x3a2414, roughness: 0.7 }));
      p.position.x = -s * 0.36;
      piv.add(p);
      g.add(piv);
      return { piv, s };
    });
    // olhos de quem está escondido (aparecem na fresta)
    const peek = new THREE.Group();
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
      e.position.set(s * 0.06, 0, 0);
      peek.add(e);
    }
    peek.position.set(0, 1.95, 0.5);
    peek.visible = false;
    g.add(peek);
    g.position.set(x, 0, BACK_Z + 0.6);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dyn.add(g);
    const w = { x, g, doorsW, peek, openK: 0 };
    wardrobes.push(w);
    interact.push({ x, w: 0.9, label: () => (hidden ? 'Sair do armário' : 'Esconder no armário'), use: () => toggleHide(w) });
  }

  // armadura que muda de lugar quando você não está olhando (armor.js)
  let armor = null, armorObj = null;
  function addArmor(x) {
    armorObj = createArmor(tex.stone);
    armor = armorObj.root;
    armor.position.set(x, 0, BACK_Z + 0.75);
    dyn.add(armor);
  }

  // ---------- estado ----------
  let level = 0, pieces = 0, fury = 0, hidden = false, modal = null, room = -1, visited = new Set(), notesRead = new Set();
  let lock, scale, seq;
  let exiting = 0, lightning = 0, nextLightning = 8;
  let player = null;

  // ---------- Dama de Branco (lady.js) ----------
  const lady = createLady();
  const dress = lady.root;
  const damaLight = new THREE.PointLight(0xa8b8ff, 0, 6, 1.6);
  damaLight.position.set(0, 1.9, 0.8);
  dress.add(damaLight);
  scene.add(dress);
  const dama = { state: 'away', t: 18, x: 0, alpha: 0, life: 0, seen: false, appearT: 0, leaveAnim: 'leave', speed: 0 };
  const damaLook = new THREE.Vector3();
  dress.visible = false;

  function damaAppear() {
    const P = player.P;
    let side = Math.random() < 0.5 ? -1 : 1;
    let x = P.x + side * 11;
    if (x < 2 || x > W - 2) x = P.x - side * 11;
    dama.x = clamp(x, 2, W - 2);
    if (TEST_DAMA) dama.x = P.x + 3.2; // teste: aparece pertinho
    dama.state = 'hunt';
    dama.appearT = 1.1; // surge e fica parada te encarando antes de vir
    dama.life = 13 + fury * 2;
    dress.visible = true;
    sfx.playClip('aparicao', 0.6);
    sfx.loopClip('batimento', 0.55);
    if (!dama.seen) { dama.seen = true; cb.toast('A Dama de Branco… esconda-se!'); }
  }
  function damaLeave(t = 22, anim = 'leave') {
    dama.state = 'fade';
    dama.leaveAnim = anim; // 'leave': vira as costas · 'caught': fica parada respirando
    dama.next = Math.max(10, t + Math.random() * 12 - fury * 2);
  }

  function updateDama(dt, time) {
    const P = player.P;
    if (dama.state === 'away') {
      dama.alpha = Math.max(0, dama.alpha - dt);
      dama.t -= dt;
      if (dama.t <= 0 && !exiting) damaAppear();
    } else if (dama.state === 'hunt' || dama.state === 'search') {
      dama.alpha = Math.min(1, dama.alpha + dt * 1.5);
      dama.life -= dt;
      const dx = P.x - dama.x;
      dama.speed = 0;
      dama.appearT = Math.max(0, dama.appearT - dt);
      if (dama.state === 'hunt') {
        if (hidden && Math.abs(dx) < 7) { dama.state = 'search'; dama.searchT = 2.8; sfx.playClip('sussurros', 0.5); }
        else if (dama.appearT <= 0) {
          // perto do jogador ela dá o bote: corre um pouco mais rápido
          const sp = (2.1 + fury * 0.35) * (Math.abs(dx) < 3.2 ? 1.2 : 1);
          const step = Math.min(Math.abs(dx), sp * dt);
          dama.x += Math.sign(dx) * step;
          dama.speed = dt > 0 ? step / dt : 0;
        }
        if (!hidden && !P.dead && Math.abs(dx) < 0.6 && P.y < 2.6) {
          player.hurt(dama.x, 'dama');
          sfx.playClip('rosnado', 0.7);
          el.blood.style.opacity = '0.9';
          damaLeave(26, 'caught');
        }
      } else {
        // procurando perto do armário: chega perto, para… e vai embora
        dama.x += Math.sign(dx) * Math.min(Math.abs(dx) - 1.2 > 0 ? Math.abs(dx) - 1.2 : 0, 0.8 * dt);
        dama.searchT -= dt;
        if (dama.searchT <= 0) { damaLeave(); if (hidden) cb.toast('Ela foi embora… por enquanto.'); }
        if (!hidden) dama.state = 'hunt';
      }
      if (dama.life <= 0 && dama.state === 'hunt') damaLeave();
    } else if (dama.state === 'fade') {
      dama.alpha = Math.max(0, dama.alpha - dt * 1.2);
      if (dama.alpha <= 0) { dama.state = 'away'; dama.t = dama.next; sfx.stopClip('batimento'); dress.visible = false; }
    }
    // vira para o jogador (3/4, mostrando o rosto para a câmera) e anima o corpo
    if (!dress.visible) return;
    dress.position.set(dama.x, 0, 0.3);
    // correndo vira mais de lado (no sentido do jogador); parada, mostra o rosto para a câmera
    const faceY = (P.x > dama.x ? 1 : -1) * (dama.speed > 0.1 ? 1.25 : 0.85);
    dress.rotation.y += (faceY - dress.rotation.y) * Math.min(1, dt * 3);
    const dist = Math.abs(P.x - dama.x);
    const animState = dama.state === 'fade' ? dama.leaveAnim
      : dama.state === 'search' ? 'search'
        : dama.appearT > 0 ? 'appear' : 'hunt';
    damaLook.set(P.x, (P.y || 0) + (hidden ? 1.0 : 1.5), hidden ? -0.4 : 0);
    lady.update(dt, time, {
      alpha: dama.alpha * (Math.random() < 0.03 ? 0.35 : 1),
      reach: dama.state === 'hunt' && dama.appearT <= 0 ? 1 : dama.state === 'search' ? 0.4 : 0,
      near: clamp(1 - (dist - 1) / 3, 0, 1),
      state: animState,
      speed: dama.speed,
      dist,
      look: damaLook,
    });
    damaLight.intensity = 4 * dama.alpha;
  }

  // ---------- esconder ----------
  function toggleHide(w) {
    hidden = !hidden;
    w.peek.visible = hidden;
    character.root.visible = !hidden;
    sfx.playClip(hidden ? 'porta-batendo' : 'porta-rangendo', 0.4);
    if (hidden) { player.P.vx = 0; player.P.x = w.x; }
  }

  // ---------- montagem do castelo ----------
  function build() {
    scene.remove(dyn);
    dyn.traverse((o) => { if (o.isMesh && o.geometry !== coinGeo) o.geometry.dispose(); });
    dyn.clear();
    scene.add(dyn);
    solids = []; coins = []; interact = []; doors = []; portraits = []; wardrobes = [];
    addSolid(-10, W + 10, -10, 0);           // chão
    addSolid(-10, W + 10, CEIL, CEIL + 10);  // teto
    addSolid(-10, 0, 0, CEIL);               // parede esquerda (portão fechado)
    addSolid(W, W + 10, 0, CEIL);            // parede direita

    // portão de entrada, fechado
    const gate = box(0.6, CEIL, 5.4, std({ color: 0x1a1414, metalness: 0.6 }), 0.3, CEIL / 2, 0);
    gate.castShadow = false;

    // ----- Hall -----
    addArmor(8);
    addTable(5, 2.4, 1.1, 2);
    addWardrobe(13.5);

    // ----- Galeria: 3 quadros com números escondidos -----
    lock = makeLockPuzzle(level);
    const pxs = [21.5, 26, 30.5];
    pxs.forEach((x, i) => {
      const frame = box(1.7, 2.1, 0.12, goldMat, x, 3.4, BACK_Z + 0.08);
      frame.castShadow = false;
      const imgCfg = PORTRAIT_IMAGES[i];
      const img = imgCfg ? imagePortrait(imgCfg) : null;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), std({ map: img ? img.normal : portraitTex(i), roughness: 1 }));
      pic.position.set(x, 3.4, BACK_Z + 0.15);
      dyn.add(pic);
      // quadro com imagem já tem olhos pintados: sem os olhos que seguem
      const eyes = img ? [] : [-1, 1].map((s) => {
        const white = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: 0xd8c8a0 }));
        white.position.set(x + s * 0.11 * (i === 2 ? 0.85 : 1), 3.4 + 0.27 * (i === 2 ? 0.9 : 1), BACK_Z + 0.16);
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        pupil.position.copy(white.position).setZ(BACK_Z + 0.17);
        dyn.add(white, pupil);
        return { pupil, bx: white.position.x, by: white.position.y };
      });
      const plateMat = new THREE.MeshBasicMaterial({ map: plateTex(PORTRAIT_NAMES[i], lock.values[i]), transparent: true, opacity: 0 });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), plateMat);
      plate.position.set(x, 2.05, BACK_Z + 0.12);
      dyn.add(plate);
      portraits.push({ x, eyes, plateMat, pic, img });
    });
    addTable(26, 2.6, 1.0, 3);
    // bilhete do vigia na mesa: a dica da galeria, em forma de enigma
    {
      const paper = box(0.62, 0.42, 0.02, new THREE.MeshBasicMaterial({ color: 0xcdb88a }), 26.7, 1.2, 0.35);
      paper.rotation.set(-0.35, 0, 0.12);
      paper.castShadow = false;
      const ink = box(0.4, 0.03, 0.025, new THREE.MeshBasicMaterial({ color: 0x3a2414 }), 26.7, 1.22, 0.36);
      ink.rotation.copy(paper.rotation);
      ink.castShadow = false;
      interact.push({ x: 26.7, w: 0.9, label: () => 'Ler o bilhete', use: () => openNote('galeria') });
    }
    const d1 = addDoor(36, 'galeria');
    interact.push({ x: 34.4, w: 1.1, label: () => 'Abrir o cadeado', on: () => !d1.open, use: () => openLock(d1) });
    // cadeado na parede
    box(0.5, 0.6, 0.15, std({ color: 0x8a6a28, metalness: 0.8, emissive: 0x3a1a00, emissiveIntensity: 0.6 }), 34.4, 2.2, BACK_Z + 0.1);

    // ----- Masmorra: balança -----
    scale = makeScalePuzzle(level);
    for (let x = 38; x < 53; x += 0.35) {
      if (x > 42.5 && x < 47.5) continue;
      box(0.06, 3.4, 0.06, ironMat, x, 1.7, BACK_Z + 0.5);
    }
    box(10, 0.1, 0.1, ironMat, 45, 3.4, BACK_Z + 0.5).position.x = 45;
    // esqueleto sentado
    const bone = std({ color: 0xc8b898 });
    const sk = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bone);
    skull.position.set(0, 0.95, 0);
    const ribs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.45, 8, 1, true), bone);
    ribs.position.y = 0.6;
    sk.add(skull, ribs);
    sk.position.set(39.5, 0, BACK_Z + 1);
    sk.rotation.z = 0.25;
    dyn.add(sk);
    // balança grande
    const sg = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.4), goldMat);
    post.position.y = 1.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), goldMat);
    beam.position.y = 2.4;
    sg.add(post, beam);
    const pans = [-1, 1].map((s) => {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.08, 12), goldMat);
      pan.position.set(s * 1.05, 1.7, 0);
      sg.add(pan);
      return pan;
    });
    const skullW = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bone);
    skullW.position.set(-1.05, 1.86, 0);
    sg.add(skullW);
    sg.position.set(45, 0, -0.9);
    sg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dyn.add(sg);
    scale.mesh = { beam, pans, skullW };
    addWardrobe(50);
    addTable(40.5, 2, 1.2, 2);
    // riscos na parede da cela, atrás do esqueleto
    {
      const scratch = new THREE.MeshBasicMaterial({ color: 0x9a8c78 });
      for (let i = 0; i < 9; i++) {
        const m = box(0.025, 0.42, 0.01, scratch, 38.7 + i * 0.13 + (i > 4 ? 0.12 : 0), 2.15, BACK_Z + 0.02);
        m.rotation.z = i === 4 ? 1.1 : (Math.random() - 0.5) * 0.15;
        if (i === 4) m.position.x -= 0.27;
        m.castShadow = false;
      }
      for (let i = 0; i < 3; i++) {
        const m = box(0.5 + Math.random() * 0.4, 0.022, 0.01, scratch, 39.3 + (Math.random() - 0.5) * 0.3, 1.75 - i * 0.16, BACK_Z + 0.02);
        m.rotation.z = (Math.random() - 0.5) * 0.12;
        m.castShadow = false;
      }
    }
    interact.push({ x: 39.4, w: 0.9, label: () => 'Ler os riscos', use: () => openNote('masmorra') });
    const d2 = addDoor(54, 'masmorra');
    interact.push({ x: 45, w: 1.4, label: () => 'Equilibrar a balança', on: () => !d2.open, use: () => openScale(d2) });

    // ----- Biblioteca: livros em sequência -----
    seq = makeSequencePuzzle(level);
    const shelfMat = std({ map: booksTex(), roughness: 1 });
    for (const x of [57, 61, 65, 69]) {
      const sh = box(3.2, 4.4, 0.6, woodMat, x, 2.2, BACK_Z + 0.35);
      sh.castShadow = false;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.2), shelfMat);
      face.position.set(x, 2.2, BACK_Z + 0.66);
      dyn.add(face);
    }
    addTable(67, 2.6, 1.0, 3);
    // diário aberto sobre a mesa
    {
      const pageMat = new THREE.MeshBasicMaterial({ color: 0xd8c8a0 });
      for (const s of [-1, 1]) {
        const pg = box(0.34, 0.02, 0.44, pageMat, 67.9 + s * 0.16, 1.03, 0.3);
        pg.rotation.z = -s * 0.18;
        pg.castShadow = false;
      }
      box(0.72, 0.03, 0.48, std({ color: 0x3a1410 }), 67.9, 1.0, 0.3).castShadow = false;
      interact.push({ x: 67.9, w: 0.9, label: () => 'Ler o diário', use: () => openNote('biblioteca') });
    }
    addWardrobe(59.5);
    const d3 = addDoor(72, 'biblioteca');
    interact.push({ x: 63, w: 1.4, label: () => 'Examinar a estante', on: () => !d3.open, use: () => openShelf(d3) });

    // ----- Trono -----
    const throne = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1), redMat);
    seat.position.y = 0.45;
    const backT = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 0.25), redMat);
    backT.position.set(0, 1.9, -0.45);
    throne.add(seat, backT);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.1), goldMat);
      arm.position.set(s * 0.75, 1.0, 0);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 6), goldMat);
      spike.position.set(s * 0.6, 3.6, -0.45);
      throne.add(arm, spike);
    }
    const crow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 4), std({ color: 0x0a0a0a }));
    crow.position.set(0, 3.5, -0.45);
    throne.add(crow);
    throne.position.set(84, 0, BACK_Z + 1.2);
    throne.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dyn.add(throne);
    for (const x of [78, 90 - 1.5]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1, 3.4), redMat);
      banner.position.set(x, 3.6, BACK_Z + 0.05);
      dyn.add(banner);
    }
    interact.push({ x: 84, w: 1.2, label: () => (pieces < 3 ? `Trono (falta chave: ${pieces}/3)` : 'Encaixar a Chave do Corvo'), use: openThrone });
  }

  // ---------- janelas de desafio (HTML) ----------
  function openModal(title, html, setup) {
    modal = { title };
    el.title.textContent = title;
    el.body.innerHTML = html;
    el.modal.hidden = false;
    el.card.style.animation = 'none';
    void el.card.offsetWidth;
    el.card.style.animation = ''; // a placa entra de novo a cada abertura
    el.prompt.hidden = true;
    setup?.(el.body);
  }
  function closeModal() {
    modal = null;
    el.modal.hidden = true;
  }
  el.close.addEventListener('click', () => closeModal());
  addEventListener('keydown', (e) => {
    if (!modal) return;
    if (e.code === 'KeyQ') closeModal();
    modal?.onKey?.(e);
  });

  function wrong() {
    fury++;
    sfx.gateBad();
    sfx.playClip('rosnado', 0.5);
    el.blood.style.opacity = '0.8';
    el.card.classList.remove('shake');
    void el.card.offsetWidth;
    el.card.classList.add('shake');
    setTimeout(() => {
      closeModal();
      cb.toast('Errado… você a acordou!');
      if (dama.state === 'away') { dama.t = 0.8; }
    }, 700);
  }
  function right(door, msg) {
    pieces++;
    sfx.keyPiece();
    closeModal();
    openDoor(door);
    cb.toast(msg ?? `Pedaço ${pieces}/3 da Chave do Corvo!`);
  }

  function openNote(key) {
    const n = NOTES[key];
    notesRead.add(key);
    sfx.playClip('sussurros', 0.25);
    openModal(n.title, `
      <div class="cm-note ${n.kind}">
        ${n.lines.map((l) => `<p>${l}</p>`).join('')}
        <p class="sign">${n.sign}</p>
      </div>
      <button class="btn cm-ok" id="cm-ok">${n.kind === 'stone' ? 'VOLTAR' : 'GUARDAR'}</button>`, (body) => {
      body.querySelector('#cm-ok').addEventListener('click', () => closeModal());
    });
  }

  function openLock(door) {
    let typed = '';
    // a fórmula mostra só os nomes; os números ficam nos quadros (é preciso memorizar)
    const names = PORTRAIT_NAMES.map((n) => n.replace(/^(o|a) /, ''));
    const missing = names.filter((_, i) => !portraits[i]?.seen);
    const formula = lock.text.replace(/[()]|[^\s()]+/g, (tok) => {
      const i = names.indexOf(tok);
      if (i < 0) return /[()]/.test(tok) ? `<span class="op"><em>${tok}</em></span>` : `<span class="op">${tok}</span>`;
      // só o nome: o número de cada quadro o jogador tem que lembrar
      return `<span class="cm-who">${tok}</span>`;
    });
    let hint = '';
    if (lock.missed) {
      if (missing.length) hint = `Você ainda não viu o número de ${missing.join(' e ')}. Volte à galeria com a lanterna.`;
      else if (lock.text.includes('(')) hint = 'Primeiro faça a conta dentro dos parênteses, depois multiplique.';
      else if (lock.text.includes('×')) hint = 'A multiplicação vem primeiro! Depois some ou tire o último número.';
      else hint = 'Faça a conta da esquerda para a direita, um número de cada vez.';
    }
    openModal('Cadeado do Corvo', `
      <p class="cm-text">${notesRead.has('galeria') ? 'O corvo de ferro abre o bico. Ele quer a conta dos três rostos.' : 'O corvo de ferro abre o bico. Ele quer uma conta… e você ainda não sabe de quê. Talvez alguém tenha deixado um recado por aqui.'}</p>
      <div class="cm-eq">${formula}</div>
      ${hint ? `<p class="cm-hint">🕯️ ${hint}</p>` : ''}
      <div class="cm-lock"><div class="cm-lock-body"><span class="cm-lock-eq">=</span><b id="cm-typed">?</b></div></div>
      <div class="cm-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>`, (body) => {
      const out = body.querySelector('#cm-typed');
      const press = (k) => {
        if (k === '⌫') typed = typed.slice(0, -1);
        else if (k === 'OK') {
          if (typed) {
            if (Number(typed) === lock.answer) right(door);
            else { typed = ''; lock.missed = true; wrong(); }
          }
        } else if (typed.length < 4) typed += k;
        out.textContent = typed || '?';
        out.classList.toggle('empty', !typed);
      };
      body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { sfx.gateTick?.(); press(b.dataset.k); }));
      modal.onKey = (e) => {
        if (/^(Digit|Numpad)\d$/.test(e.code)) press(e.code.slice(-1));
        else if (e.code === 'Backspace') press('⌫');
        else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK');
      };
      out.classList.add('empty');
    });
  }

  function openScale(door) {
    const on = new Set();
    openModal('A Balança da Masmorra', `
      <p class="cm-text">${notesRead.has('masmorra')
        ? `A caveira pesa <b>${scale.target}</b>. Ela só descansa quando o outro prato pesar o mesmo.`
        : `Uma caveira de peso <b>${scale.target}</b> repousa num prato. O outro está vazio, e a balança, torta. Talvez o antigo prisioneiro saiba algo.`}</p>
      <div class="cm-scale">
        <div class="cm-post"></div>
        <div class="cm-beam" id="cm-beam"></div>
        ${['left', 'right'].map((side) => `<div class="cm-pan ${side}" id="cm-pan-${side}">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 0 L5 100 M50 0 L95 100" /></svg>
          <div class="cm-load" id="cm-load-${side}">${side === 'left' ? `<span class="skull">💀<b>${scale.target}</b></span>` : ''}</div>
          <div class="cm-dish"></div>
        </div>`).join('')}
      </div>
      ${scale.missed ? `<p class="cm-hint">🕯️ Some os pesos que você pôr no prato: o total tem que dar exatamente ${scale.target}.</p>` : ''}
      <div class="cm-tally"><span>💀 <b>${scale.target}</b></span><i id="cm-eq">≠</i><span><b id="cm-sum">0</b> ⚖</span></div>
      <div class="cm-weights">${scale.weights.map((w, i) => `<button data-i="${i}">${w}</button>`).join('')}</div>
      <button class="btn cm-ok" id="cm-ok">PRONTO</button>`, (body) => {
      const beam = body.querySelector('#cm-beam'), rightLoad = body.querySelector('#cm-load-right');
      const panL = body.querySelector('#cm-pan-left'), panR = body.querySelector('#cm-pan-right');
      const tally = body.querySelector('.cm-tally'), sumEl = body.querySelector('#cm-sum'), eq = body.querySelector('#cm-eq');
      const sync = () => {
        const sum = [...on].reduce((s, i) => s + scale.weights[i], 0);
        const ang = clamp((sum - scale.target) * 1.5, -12, 12);
        // os pratos ficam pendurados nas pontas do travessão: sobem/descem, mas não giram
        const dy = Math.sin(ang * Math.PI / 180) * beam.offsetWidth / 2;
        beam.style.transform = `rotate(${ang}deg)`;
        panL.style.transform = `translate(-50%, ${-dy}px)`;
        panR.style.transform = `translate(-50%, ${dy}px)`;
        rightLoad.innerHTML = [...on].map((i) => `<span>${scale.weights[i]}</span>`).join('');
        sumEl.textContent = sum;
        const level = sum === scale.target;
        eq.textContent = level ? '=' : sum < scale.target ? '>' : '<';
        tally.classList.toggle('level', level);
        beam.classList.toggle('level', level);
        body.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('on', on.has(Number(b.dataset.i))));
      };
      body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        on.has(i) ? on.delete(i) : on.add(i);
        sfx.gateTick();
        sync();
      }));
      body.querySelector('#cm-ok').addEventListener('click', () => {
        const sum = [...on].reduce((s, i) => s + scale.weights[i], 0);
        if (sum === scale.target) { right(door, `Pedaço ${pieces + 1}/3 da Chave + óleo!`); cb.onOil(); }
        else { scale.missed = true; wrong(); }
      });
      sync();
    });
  }

  function openShelf(door) {
    openModal('A Estante Proibida', `
      <p class="cm-text">${notesRead.has('biblioteca')
        ? 'Um livro foi arrancado da fileira. Qual deles conversa com os vizinhos?'
        : 'Há um buraco na fileira de livros. Só um dos livros soltos cabe ali… mas qual? A bibliotecária deixou anotações por aqui.'}</p>
      <div class="cm-shelf"><div class="cm-books">${seq.seq.map((v, i) => `<div class="cm-book ${i === seq.hole ? 'hole' : ''}">${i === seq.hole ? '?' : v}</div>`).join('')}</div></div>
      ${seq.missed ? `<p class="cm-hint">🕯️ Repare: ${seq.hint}.</p>` : ''}
      <p class="cm-text small">Escolha o livro:</p>
      <div class="cm-books opts">${seq.options.map((v) => `<button class="cm-book" data-v="${v}">${v}</button>`).join('')}</div>`, (body) => {
      body.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
        if (Number(b.dataset.v) === seq.answer) right(door, `Pedaço ${pieces + 1}/3! A estante se abre…`);
        else { seq.missed = true; wrong(); } // na próxima vez a estante mostra a dica
      }));
    });
  }

  function openThrone() {
    if (pieces < 3) {
      cb.toast(`Faltam ${3 - pieces} pedaço(s) da chave`);
      sfx.empty?.();
      return;
    }
    openModal('O Trono do Corvo', `
      <p class="cm-text">Os três pedaços se juntam na sua mão. O trono tem uma fechadura em forma de corvo.</p>
      <button class="btn cm-ok" id="cm-ok">ENCAIXAR A CHAVE</button>`, (body) => {
      body.querySelector('#cm-ok').addEventListener('click', () => {
        closeModal();
        exiting = 0.001;
        sfx.portal();
        sfx.playClip('revelacao', 0.6);
        cb.toast('O castelo desaba…');
      });
    });
  }

  // ---------- API ----------
  function start(lv, pl) {
    level = lv;
    player = pl;
    pieces = 0; fury = 0; hidden = false; modal = null; room = -1; exiting = 0; notesRead = new Set();
    visited = new Set();
    dama.state = 'away'; dama.t = TEST_DAMA ? 0.3 : 16; dama.alpha = 0; dama.seen = false;
    dress.visible = false;
    build();
    scene.add(character.root);
    character.root.visible = true;
    character.root.scale.setScalar(1);
    el.keys.hidden = false;
    sfx.playClip('porta-batendo', 0.7);
    sfx.thunder(0.5);
    // teste: index.html?sala=galeria|masmorra|biblioteca|trono começa nessa sala,
    // com as portas anteriores abertas e os pedaços da chave correspondentes
    const sala = { hall: 0, galeria: 1, masmorra: 2, biblioteca: 3, trono: 4 }[new URLSearchParams(location.search).get('sala')];
    if (sala) {
      const x = sala * ROOM + 2;
      for (const d of doors) if (d.x < x && !d.open) { openDoor(d); pieces++; }
      player.teleport(x, 0);
      return x;
    }
    return undefined;
  }

  function stop() {
    closeModal();
    el.prompt.hidden = true;
    el.keys.hidden = true;
    el.useBtn.hidden = true;
    sfx.stopClip('batimento');
    hidden = false;
  }

  let promptKey = '';
  function update(dt, time, input, camera) {
    const P = player.P;
    if (modal) return;

    // sala atual
    const r = clamp(Math.floor(P.x / ROOM), 0, ROOMS.length - 1);
    if (r !== room) {
      if (room !== -1 && !visited.has(r)) cb.toast(ROOMS[r], ROOM_WHISPERS[r], ROOM_WHISPERS[r] ? 3.2 : undefined);
      // a armadura se mexe quando você volta para o hall
      if (r === 0 && room > 0 && armor) {
        armor.position.x = clamp(P.x + 5 + Math.random() * 5, 3, 16);
        armor.rotation.y = -0.5;
        sfx.playClip('pedra', 0.25);
      }
      visited.add(r);
      room = r;
    }

    // tochas, lanterna, relâmpago
    for (const [i, t] of torches.entries()) {
      t.l.intensity = 9 * (0.85 + Math.sin(time * 9 + i * 3) * 0.08 + Math.sin(time * 23 + i) * 0.07);
      t.f.scale.y = 0.85 + Math.sin(time * 11 + i) * 0.15;
    }
    lantern.position.set(P.x + P.facing * 0.4, P.y + 1.4, 1.4);
    nextLightning -= dt;
    if (nextLightning <= 0) {
      lightning = 0.45;
      nextLightning = 9 + Math.random() * 12;
      // às vezes alguém aparece na janela mais próxima
      const wx = windows.reduce((b, x) => (Math.abs(x - P.x) < Math.abs(b - P.x) ? x : b), windows[0]);
      figure.position.set(wx, 3.6, BACK_Z + 0.04);
      figureMat.opacity = Math.random() < 0.4 ? 1 : 0;
      setTimeout(() => sfx.thunder(0.6), 200 + Math.random() * 600);
    }
    if (lightning > 0) {
      lightning -= dt;
      const f = lightning > 0.3 || (lightning > 0.1 && lightning < 0.18) ? 1 : 0;
      hemi.intensity = 0.38 + f * 2.5;
      winMat.color.setHex(f ? 0xd8e0ff : 0x0c1428);
      figure.visible = f === 1;
      // no clarão, a pintura mostra a verdade
      for (const p of portraits) if (p.img?.ready) p.pic.material.map = f ? p.img.scary : p.img.normal;
    } else {
      hemi.intensity = 0.38;
      winMat.color.setHex(0x0c1428);
      figure.visible = false;
      for (const p of portraits) if (p.img) p.pic.material.map = p.img.normal;
    }

    // portas abrindo
    for (const d of doors) {
      if (d.open && d.k < 1) {
        d.k = Math.min(1, d.k + dt * 0.8);
        d.g.position.y = d.k * (CEIL - 0.4);
        d.lock.material.emissive.setHex(0x1aff4a);
      }
    }

    if (armorObj) armorObj.update(dt, time, P.x, Math.abs(P.x - armor.position.x));

    // quadros: os números só aparecem com a lanterna perto; os olhos seguem você
    for (const p of portraits) {
      const near = clamp(1 - (Math.abs(P.x - p.x) - 1.2) / 2.5, 0, 1);
      p.plateMat.opacity = near * (0.85 + Math.sin(time * 13) * 0.05);
      if (near > 0.6) p.seen = true; // o cadeado passa a mostrar esse número
      for (const e of p.eyes) {
        e.pupil.position.x = e.bx + clamp((P.x - p.x) / 8, -1, 1) * 0.022;
        e.pupil.position.y = e.by + clamp((P.y + 1.4 - 3.4) / 6, -1, 1) * 0.012;
      }
    }

    // balança: pende para o lado da caveira
    if (scale.mesh) {
      scale.mesh.beam.rotation.z = 0.18 + Math.sin(time * 1.2) * 0.02;
      const dy = Math.sin(scale.mesh.beam.rotation.z) * 1.05;
      scale.mesh.pans[0].position.y = 1.7 - dy;
      scale.mesh.pans[1].position.y = 1.7 + dy;
      scale.mesh.skullW.position.y = 1.86 - dy;
    }

    // moedas
    for (const c of coins) {
      if (c.taken) continue;
      c.mesh.rotation.y = time * 3 + c.x;
      if (!hidden && Math.abs(c.x - P.x) < 0.7 && c.y > P.y - 0.3 && c.y < P.y + P.h + 0.3) {
        c.taken = true;
        dyn.remove(c.mesh);
        stats.coins++;
        sfx.coin();
      }
    }

    updateDama(dt, time);

    // interação: E / ✋ perto de um objeto
    const near = interact.find((it) => (it.on ? it.on() : true) && Math.abs(P.x - it.x) < it.w && P.y < 1.5);
    if (near && !exiting) {
      const v = new THREE.Vector3(near.x, 3.0, 0).project(camera);
      const key = near.label();
      if (key !== promptKey) { promptKey = key; el.promptText.textContent = key; }
      el.prompt.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
      el.prompt.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
      el.prompt.hidden = false;
      el.useBtn.hidden = false;
      if (input.consumeUse()) near.use();
    } else {
      el.prompt.hidden = true;
      el.useBtn.hidden = true;
      input.consumeUse();
    }

    // HUD da chave
    el.keys.textContent = `🗝 ${pieces}/3`;

    // saída pelo trono
    if (exiting > 0) {
      exiting += dt;
      el.fade.style.opacity = String(clamp((exiting - 0.6) / 1.2, 0, 1));
      hemi.intensity = 0.38 + Math.random() * exiting;
      if (exiting > 2) { exiting = 0; stop(); cb.onExit(); }
    }
  }

  function render(renderer, camera) {
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  /** monta as salas só para a tela de carregamento aquecer a GPU (sem sons nem HTML) */
  function prewarm() {
    level = 0;
    build();
  }

  return {
    // só no modo de desenvolvimento: abre as janelas direto (testes de layout)
    debugOpen: import.meta.env.DEV ? {
      note: (k = Object.keys(NOTES)[0]) => openNote(k), lock: () => openLock({}), scale: () => openScale({}),
      shelf: () => openShelf({}), throne: () => { pieces = 3; openThrone(); },
    } : null,
    scene, start, stop, update, render, prewarm,
    minX: 0.2, maxX: W - 0.2, width: W,
    get hidden() { return hidden; },
    get paused() { return !!modal; },
    // quadro bem à frente do jogador (no chão): { x, y, z } do centro da pintura, ou null
    portraitAt(P) {
      if (modal || hidden || P.y > 1.5) return null;
      const p = portraits.find((q) => Math.abs(P.x - q.x) < 1.0);
      return p ? { x: p.x, y: 3.4, z: BACK_Z + 0.15, plateY: 2.05 } : null;
    },
    // a física do jogador usa estas funções (mesma interface do mundo)
    solidsNear: (x0, x1) => solids.filter((s) => s.maxX > x0 && s.minX < x1),
    hitBlock() {},
    clearEnemiesNear() {},
    pitFall() {},
    isWater: () => false,
  };
}
