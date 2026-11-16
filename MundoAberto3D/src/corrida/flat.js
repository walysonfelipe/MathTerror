import * as THREE from 'three';
import { createFight } from './flat-fight.js';
import { drawBackdrop, drawCreatures } from './flat-art.js';

/**
 * Dimensão Plana: um pedaço do multiverso onde tudo é 2D (arte do MathTerror 2D,
 * guardado no branch jogo-2d). A coruja 3D vira desenho, o chão é de lava, as
 * criaturas da lava atacam e o caminho acaba num abismo. O fundo e as criaturas
 * são desenhados na hora (flat-art.js).
 *
 * Usa a mesma física de lado do jogador (mesma interface do mundo e do castelo).
 * No fundo do abismo fica a arena do boss (flat-fight.js): a luta é por contas.
 */

const URLS = {
  owl: new URL('../../assets/images/owl-sheet.webp', import.meta.url).href,
  ground: new URL('../../assets/images/ground-sheet.webp', import.meta.url).href,
};

// ---------- medidas (em metros, as mesmas da física do jogador) ----------
const VIEW_H = 11;              // altura visível da tela
const CAM_Y = 3.4;
const OWL_H = 1.9;              // altura do quadro da coruja
const U = OWL_H / 150;          // 1 "unidade" do jogo 2D antigo, em metros
const OWL = { cols: 4, rows: 4, w: OWL_H * (312 / 270) };
const TILE = { cols: 3, rows: 4, count: 12, w: 240 * U, h: 240 * U * (108 / 244) };
const TILE_STEP = TILE.w * 0.94;        // leve sobreposição para esconder as bordas
const SURFACE = TILE.h * 0.14;          // do topo do desenho até onde se pisa
const TILE_PAD = 0.12;                  // a borda do desenho é irregular: a pedra firme começa um pouco depois
// criaturas (desenhadas em flat-art.js, 4 quadros cada):
//  - rastejante: sombra que patrulha o chão e dispara em cima da coruja quando a vê
//  - caveira: flutua em chamas e cospe fogo-fátuo mirando na coruja
const CRAWLER = { size: 2.6, foot: 2.6 * (20 / 256), walk: 1.1, charge: 3.3, sees: 7 };
const SKULL = { size: 2.1, hover: 1.5, sees: 10, shot: 5.5 };
const SPELL_SPEED = 15;                 // fogo da coruja
const CRUMBLE = 1.1;                    // o último chão treme esse tempo antes de despedaçar
const FALL_TIME = 3.2;                  // quanto dura a queda no abismo
const LAVA_Y = -1.2;
const RUN_FRAMES = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const STRIDE = 18 * U * 1.25;           // metros por quadro de corrida (pé não desliza)
const IDLE = [0, 0, 0, 0, 0, 1, 2, 1, 0, 0];
const EMBERS = 110;

// gerador de números com semente: a mesma fase sai igual se precisar repetir
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFlat({ sfx, stats, cb }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120404);
  const camera = new THREE.OrthographicCamera(-10, 10, VIEW_H / 2, -VIEW_H / 2, 0.1, 50);
  camera.position.set(0, CAM_Y, 10);
  let halfW = 10;

  const dyn = new THREE.Group(); // tudo que é refeito a cada visita
  scene.add(dyn);

  const flatMat = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...o });
  const unit = new THREE.PlaneGeometry(1, 1);
  const plane = (mat, w, h, order) => {
    const m = new THREE.Mesh(unit, mat);
    m.scale.set(w, h, 1);
    m.renderOrder = order;
    return m;
  };

  // ---------- fundo: o vídeo da cidade de lava, cobrindo a tela ----------
  // ---------- fundo: camadas de lava que deslizam conforme a coruja anda ----------
  const LAYER_W = VIEW_H * 4; // largura no mundo de uma volta de cada camada (desenho 4:1)
  const backdrop = drawBackdrop().map((l, i) => {
    const tex = new THREE.CanvasTexture(l.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (l.tile) tex.wrapS = THREE.RepeatWrapping;
    const mat = i === 0
      ? new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false })
      : flatMat({ map: tex });
    const mesh = plane(mat, 1, VIEW_H, i * 0.1);
    scene.add(mesh);
    return { ...l, tex, mesh };
  });
  function placeBackdrop(x) {
    for (const l of backdrop) {
      l.mesh.position.set(x, CAM_Y, 0);
      if (l.tile) l.tex.offset.x = ((x * l.factor) / LAYER_W) % 1;
    }
  }

  // ---------- lava embaixo de tudo ----------
  const lavaMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uX: { value: 0 }, uW: { value: 20 }, uH: { value: 4 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uX, uW, uH;
      varying vec2 vUv;
      void main() {
        float x = uX + (vUv.x - 0.5) * uW;
        float depth = (1.0 - vUv.y) * uH;                 // metros abaixo da superfície
        float wave = sin(x * 1.3 + uTime * 1.4) * 0.07 + sin(x * 3.4 - uTime * 2.1) * 0.035;
        float d = depth + wave;
        if (d < 0.0) discard;
        float blob = sin(x * 2.1 + sin(d * 5.0 - uTime * 1.2) * 1.6 + uTime * 0.6) * 0.5 + 0.5;
        vec3 deep = mix(vec3(0.1, 0.004, 0.0), vec3(0.75, 0.1, 0.0), blob * blob);
        vec3 col = mix(vec3(1.0, 0.6, 0.12), deep, smoothstep(0.0, 0.14, d));
        col = mix(col, vec3(0.04, 0.0, 0.0), smoothstep(0.5, uH, d) * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const lavaMesh = plane(lavaMat, 1, 1, 1);
  scene.add(lavaMesh);

  // ---------- texturas desenhadas na hora ----------
  const glowTex = canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,220,150,0.7)');
    r.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
  const fireTex = canvasTexture(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s * 0.45, 2, s / 2, s / 2, s / 2);
    r.addColorStop(0, '#fff6c8');
    r.addColorStop(0.3, '#ffc233');
    r.addColorStop(0.6, '#ff5a0a');
    r.addColorStop(0.85, 'rgba(160,20,0,0.55)');
    r.addColorStop(1, 'rgba(120,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
  const coinTex = canvasTexture(128, (g, s) => {
    g.fillStyle = '#8a4a08';
    g.beginPath(); g.arc(s / 2, s / 2, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6c443';
    g.beginPath(); g.arc(s / 2, s / 2, 51, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff0a8'; g.lineWidth = 5;
    g.beginPath(); g.arc(s / 2, s / 2, 42, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
    g.fillStyle = '#8a4a08';
    g.font = '700 70px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('π', s / 2, s / 2 + 4);
  });
  const coinMat = flatMat({ map: coinTex });
  const fireMat = flatMat({ map: fireTex, blending: THREE.AdditiveBlending });
  const fireCoreMat = flatMat({ map: fireTex });
  const shotMat = flatMat({ map: fireTex, color: 0x8aff70, blending: THREE.AdditiveBlending });   // fogo-fátuo verde das caveiras
  const shotCoreMat = flatMat({ map: fireTex, color: 0xc8ffb0 });
  const beastArt = drawCreatures();
  const beastTex = Object.fromEntries(['crawler', 'skull'].map((k) => {
    const t = new THREE.CanvasTexture(beastArt[k]);
    t.colorSpace = THREE.SRGBColorSpace;
    return [k, t];
  }));
  const spellMat = flatMat({ map: fireTex, color: 0xfff0b0, blending: THREE.AdditiveBlending });  // fogo claro da coruja
  // poço do abismo: debaixo do último chão não tem lava, só um breu sem fundo
  const PIT_H = 3;
  const pitTex = canvasTexture(256, (g, s) => {
    const down = g.createLinearGradient(0, 0, 0, s);
    down.addColorStop(0, 'rgba(0,0,0,0)');
    down.addColorStop(0.3, 'rgba(0,0,0,1)');
    g.fillStyle = down;
    g.fillRect(0, 0, s, s);
    // a borda esquerda (onde a lava acaba) entra aos poucos
    const side = g.createLinearGradient(0, 0, s, 0);
    side.addColorStop(0, 'rgba(0,0,0,0)');
    side.addColorStop(0.03, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = side;
    g.fillRect(0, 0, s, s);
  });
  const voidMesh = plane(flatMat({ map: pitTex }), 60, PIT_H, 2);
  const shadeMat = flatMat({ color: 0x000000, opacity: 0 });
  const shadeMesh = plane(shadeMat, 1, VIEW_H + 2, 5);  // escurece tudo durante a queda
  scene.add(voidMesh, shadeMesh);

  // ---------- brasas subindo da lava ----------
  const emberPos = new Float32Array(EMBERS * 3), emberCol = new Float32Array(EMBERS * 3);
  const embers = Array.from({ length: EMBERS }, () => ({ vx: 0, vy: 0, life: 0, max: 1, burst: false }));
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));
  const emberPts = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    map: glowTex, size: 7 * Math.min(devicePixelRatio || 1, 2), sizeAttenuation: false, vertexColors: true,
    transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  emberPts.frustumCulled = false;
  emberPts.renderOrder = 9;
  scene.add(emberPts);
  let burstNext = 0;
  function spawnEmber(i, x, y, vx, vy, life, burst = false) {
    emberPos[i * 3] = x; emberPos[i * 3 + 1] = y; emberPos[i * 3 + 2] = 1;
    Object.assign(embers[i], { vx, vy, life, max: life, burst });
  }
  function splash(x, y = LAVA_Y, n = 26) {
    for (let k = 0; k < n; k++) {
      burstNext = (burstNext + 1) % EMBERS;
      spawnEmber(burstNext, x + (Math.random() - 0.5) * 0.8, y, (Math.random() - 0.5) * 5, 3 + Math.random() * 6, 0.5 + Math.random() * 0.7, true);
    }
  }
  function updateEmbers(dt) {
    for (let i = 0; i < EMBERS; i++) {
      const e = embers[i];
      e.life -= dt;
      if (e.life <= 0 && falling >= 0) {
        // caindo: as brasas passam voando para cima
        spawnEmber(i, camera.position.x + (Math.random() - 0.5) * halfW * 2, CAM_Y - VIEW_H / 2 - Math.random() * 3,
          0, 16 + Math.random() * 14, 0.5 + Math.random() * 0.5);
      } else if (e.life <= 0 && !fight.active && camera.position.x - halfW > pitX) {
        e.life = 0.3; // só o poço na tela: sem lava, sem brasa
        emberPos[i * 3 + 1] = -50;
      } else if (e.life <= 0) {
        const ex = camera.position.x + (Math.random() - 0.5) * halfW * 2.2;
        if (!fight.active && ex > pitX) { e.life = 0.3; emberPos[i * 3 + 1] = -50; } // em cima do poço não nasce brasa
        else spawnEmber(i, ex, LAVA_Y + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 1.5, 2 + Math.random() * 4);
      }
      if (e.burst) e.vy -= 14 * dt;
      emberPos[i * 3] += e.vx * dt;
      emberPos[i * 3 + 1] += e.vy * dt;
      const k = Math.min(1, (e.life / e.max) * 2) * Math.min(1, (e.max - e.life) * 4) * (0.7 + Math.random() * 0.3);
      emberCol[i * 3] = k; emberCol[i * 3 + 1] = k * 0.42; emberCol[i * 3 + 2] = k * 0.08;
    }
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.color.needsUpdate = true;
  }

  // ---------- pranchas de desenho (carregam junto com o jogo) ----------
  let tileMats = [], owlTex = null, owlMesh = null, ok = false;
  const sheet = (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  };
  // mostra só um quadro da prancha
  function setFrame(t, frame, cols, rows) {
    t.offset.set((frame % cols) / cols, 1 - (Math.floor(frame / cols) + 1) / rows);
  }
  // arena do boss, no fundo do abismo
  const fight = createFight({
    scene, plane, flatMat, sheet, splash, sfx, U, camY: CAM_Y,
    tiles: () => tileMats, tile: { w: TILE.w, h: TILE.h, step: TILE_STEP, surface: SURFACE },
    fire: { glow: fireMat, core: fireCoreMat },
    cb: { onHurt: () => cb.onHurt?.(), onFaint: () => cb.onFaint?.(), onWin: () => cb.onWin(), onLose: () => cb.onLose() },
  });

  const loader = new THREE.TextureLoader();
  const ready = Promise.all([loader.loadAsync(URLS.owl), loader.loadAsync(URLS.ground)]).then(([owl, ground]) => {
    owlTex = sheet(owl);
    owlTex.repeat.set(1 / OWL.cols, 1 / OWL.rows);
    sheet(ground);
    tileMats = Array.from({ length: TILE.count }, (_, f) => {
      const t = ground.clone();
      t.repeat.set(1 / TILE.cols, 1 / TILE.rows);
      setFrame(t, f, TILE.cols, TILE.rows);
      t.needsUpdate = true;
      return flatMat({ map: t });
    });
    owlMesh = plane(flatMat({ map: owlTex }), OWL.w, OWL_H, 6);
    scene.add(owlMesh);
    return fight.ready;
  }).then(() => { ok = true; }).catch((err) => { console.warn('Dimensão Plana: arte não carregou', err); });

  // ---------- fase ----------
  let solids = [], coins = [], fires = [], beasts = [], shots = [];
  let minX = 0.3, maxX = 100, abyssX = 100, pitX = 100;
  let player = null, visit = 0, falling = -1, deathSet = false;
  // o último chão: { x0, solid, tiles, debris, t (tremendo desde), broke }
  let last = null, quake = 0;
  let runDist = 0, idleT = 0, landT = 0, wasGrounded = true;
  const view = { x: 0 };

  function addTiles(x0, n, top, rand) {
    for (let i = 0; i < n; i++) {
      const m = plane(tileMats[Math.floor(rand() * TILE.count)], TILE.w, TILE.h, 3);
      m.position.set(x0 + i * TILE_STEP + TILE.w / 2, top + SURFACE - TILE.h / 2, 0);
      dyn.add(m);
    }
    return x0 + (n - 1) * TILE_STEP + TILE.w;
  }
  // chão firme: dá para voltar para ele depois de cair na lava
  function addGround(x0, n, rand) {
    const x1 = addTiles(x0, n, 0, rand);
    solids.push({ minX: x0 + TILE_PAD, maxX: x1 - TILE_PAD, minY: -1.1, maxY: 0, kind: 'ground' });
    return x1;
  }
  // pedra solta no ar
  function addFloat(x0, top, rand) {
    const x1 = addTiles(x0, 1, top, rand);
    solids.push({ minX: x0 + TILE_PAD, maxX: x1 - TILE_PAD, minY: top - 0.85, maxY: top, kind: 'pillar' });
    return x1;
  }
  function addCoin(x, y) {
    const m = plane(coinMat, 0.62, 0.62, 5);
    m.position.set(x, y, 0);
    dyn.add(m);
    coins.push({ x, y, mesh: m, t: x * 1.7 });
  }
  function addFire(x, rand, height = 4.4) {
    const glow = plane(fireMat, 1.9, 1.9, 7);
    const core = plane(fireCoreMat, 0.95, 1.15, 8);
    dyn.add(glow, core);
    fires.push({ x, y: LAVA_Y - 1, glow, core, height, period: 1.9 + rand() * 0.7, phase: rand(), up: false });
  }

  // criatura: `kind` = 'crawler' (rastejante) ou 'skull' (caveira em chamas)
  function addBeast(kind, x0, x1, rand) {
    const tex = beastTex[kind].clone(); // cada uma mostra o seu quadro
    tex.repeat.set(1 / beastArt.frames, 1);
    tex.needsUpdate = true;
    const mat = flatMat({ map: tex });
    const size = kind === 'skull' ? SKULL.size : CRAWLER.size;
    const mesh = plane(mat, size, size, 4);
    dyn.add(mesh);
    beasts.push({
      kind, x: x0 + (x1 - x0) * (0.4 + rand() * 0.5), y: kind === 'skull' ? SKULL.hover : 0, x0: x0 + 0.9, x1: x1 - 0.9, dir: -1, mesh, tex, mat,
      walk: rand() * 10, aim: 1.2 + rand() * 1.5, wind: 0, dead: -1, rage: false,
    });
  }
  // bola de fogo: `mine` = lançada pela coruja (voa reto); a da caveira vem mirada
  function addShot(x, y, vx, vy, mine) {
    const glow = plane(mine ? spellMat : shotMat, mine ? 1.5 : 1.3, mine ? 1.5 : 1.3, 7);
    const core = plane(mine ? fireCoreMat : shotCoreMat, 0.75, 0.6, 8);
    dyn.add(glow, core);
    shots.push({ x, y, vx, vy, mine, glow, core, life: mine ? 1.1 : 3 });
  }
  function dropShot(s) {
    dyn.remove(s.glow, s.core);
    s.life = 0;
  }

  function clear() {
    for (const c of beasts) { c.tex.dispose(); c.mat.dispose(); }
    dyn.clear();
    solids = []; coins = []; fires = []; beasts = []; shots = [];
  }

  function build(level, seed) {
    clear();
    const rand = seeded(seed);
    const hard = Math.min(1, level * 0.25);
    // começo: chão largo e calmo
    let x = addGround(-4 * TILE_STEP, 8, rand);
    for (let i = 0; i < 4; i++) addCoin(5 + i * 1.3, 1.1);
    // o abismo chega depois de um caminho de tamanho sorteado
    const parts = 5 + Math.floor(rand() * 6) + Math.min(3, level);
    for (let i = 0; i < parts; i++) {
      const r = rand();
      if (i > 0 && r < 0.3) {
        // buraco largo com uma pedra solta no meio
        const side = 2.5 + rand() * 0.6 + hard * 0.4;
        const top = 0.6 + rand() * 1.2;
        const fx = x + side;
        const fEnd = addFloat(fx, top, rand);
        addCoin((fx + fEnd) / 2, top + 1.2);
        if (rand() < 0.4 + hard * 0.3) addFire(x + side / 2, rand);
        if (rand() < 0.3 + hard * 0.4) addFire(fEnd + side / 2, rand);
        x = fEnd + side;
      } else {
        // buraco simples; depois do primeiro, a lava começa a cuspir fogo
        const gap = 2.6 + rand() * (1.4 + hard * 0.8);
        if (i > 0 && rand() < 0.5 + hard * 0.3) addFire(x + gap / 2, rand);
        else for (let k = 0; k < 3; k++) addCoin(x + gap * (0.25 + k * 0.25), 2.3 + (k === 1 ? 0.5 : 0));
        x += gap;
      }
      const n = 2 + Math.floor(rand() * 3);
      const x1 = addGround(x, n, rand);
      // em cima do chão: moedas ou uma pedra alta com prêmio
      if (n >= 3 && rand() < 0.45) {
        const fx = x + (x1 - x - TILE.w) / 2;
        const top = 2.5 + rand() * 0.5;
        addFloat(fx, top, rand);
        for (let k = 0; k < 3; k++) addCoin(fx + 0.7 + k * 0.85, top + 1);
      } else if (rand() < 0.7) {
        for (let k = 0; k < n; k++) addCoin(x + 1.5 + k * 1.4, 1.1);
      }
      if (i > 0 && n >= 3 && rand() < 0.6 + hard * 0.3) addBeast(rand() < 0.5 ? 'crawler' : 'skull', x, x1, rand);
      else if (i > 0 && rand() < 0.25 + hard * 0.2) addBeast('skull', x, x1, rand);
      x = x1;
    }
    // fim: a lava acaba e o último chão fica sobre um poço escuro, sem lava embaixo.
    // Quando a coruja pisa nele, o chão treme, despedaça e ela despenca até a arena.
    x += 2.8;
    pitX = x - 0.5;
    const first = dyn.children.length;
    abyssX = addGround(x, 5, rand);
    last = {
      x0: x, solid: solids[solids.length - 1], t: -1, broke: false, debris: [],
      tiles: dyn.children.slice(first).map((mesh) => ({ mesh, x: mesh.position.x, y: mesh.position.y, vy: 0, vr: 0, wait: 0 })),
    };
    voidMesh.position.set(pitX + voidMesh.scale.x / 2, 0.15 - PIT_H / 2, 0);
    minX = 0.3;
    maxX = abyssX + 8;
  }

  // ---------- API ----------
  function start(level, pl) {
    player = pl;
    visit = level;
    fight.stop();
    resetZoom();
    falling = -1; quake = 0; deathSet = false;
    dyn.visible = true;
    voidMesh.visible = true;
    shadeMat.opacity = 0;
    runDist = 0; idleT = 0; landT = 0; wasGrounded = true;
    build(level, (Math.random() * 1e9) | 0);
    pl.teleport(1.5, 0);
    view.x = minX + halfW - 3;
    for (let i = 0; i < EMBERS; i++) embers[i].life = Math.random() * 3; // já começa com brasas no ar
    place(0);
  }

  function stop() {
    fight.stop();
    resetZoom();
    falling = -1;
  }

  function resize(aspect) {
    halfW = (VIEW_H * aspect) / 2;
    camera.left = -halfW; camera.right = halfW;
    camera.updateProjectionMatrix();
    for (const l of backdrop) {
      l.mesh.scale.x = halfW * 2 + 0.5;
      if (l.tile) l.tex.repeat.x = l.mesh.scale.x / LAYER_W;
    }
    lavaMesh.scale.set(halfW * 2 + 2, LAVA_Y - (CAM_Y - VIEW_H / 2) + 0.6, 1);
    lavaMat.uniforms.uW.value = lavaMesh.scale.x;
    lavaMat.uniforms.uH.value = lavaMesh.scale.y;
    shadeMesh.scale.x = halfW * 2 + 2;
  }

  function resetZoom() {
    if (camera.zoom === 1) return;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
  }

  // fim da queda: a fase some e sobra só a arena
  function toArena() {
    falling = -1;
    dyn.visible = false;
    voidMesh.visible = false;
    shadeMat.opacity = 0.94;
    view.x = 0;
    fight.start(player, visit, halfW);
    cb.onArena?.();
  }

  // a coruja lança o seu fogo (a carga é gasta pelo jogo principal)
  function fire() {
    const P = player.P;
    if (P.dead || falling >= 0 || fight.active) return false;
    addShot(P.x + P.facing * 0.7, P.y + 0.85, P.facing * SPELL_SPEED, 0, true);
    sfx.cast?.();
    return true;
  }

  function killBeast(c) {
    c.dead = 0;
    stats.stomps++;
    splash(c.x, c.kind === 'skull' ? c.y : 0.9, 18);
    sfx.boom?.(0.35);
  }

  // jogo: moedas, fogo da lava, criaturas, tiros e o abismo
  function update(dt, time) {
    const P = player.P;
    if (fight.active) { fight.update(dt); return; }
    if (P.dead && !deathSet) { deathSet = true; P.deathDur = Math.min(P.deathDur ?? 2.4, 2.4); }

    // caindo no abismo: nada mais acontece, só a queda
    if (falling >= 0) {
      falling += dt;
      if (falling > FALL_TIME) toArena();
      return;
    }

    for (const c of coins) {
      if (c.got) continue;
      if (Math.abs(P.x - c.x) < 0.75 && c.y > P.y - 0.4 && c.y < P.y + P.h + 0.4) {
        c.got = true;
        c.mesh.visible = false;
        stats.coins++;
        sfx.coin();
      }
    }

    for (const f of fires) {
      const u = (time / f.period + f.phase) % 1;
      const v = u / 0.62;
      const was = f.up;
      f.up = v < 1;
      f.y = f.up ? LAVA_Y - 0.5 + (f.height + 0.5) * 4 * v * (1 - v) : LAVA_Y - 2;
      f.rising = v < 0.5;
      // saiu da lava: respingo (só perto da tela)
      if (f.up && !was && Math.abs(f.x - view.x) < halfW + 2) splash(f.x, LAVA_Y, 8);
      if (f.up && !P.dead && Math.abs(P.x - f.x) < 0.72 && f.y > P.y - 0.4 && f.y < P.y + P.h + 0.3) player.hurt(f.x, 'lava');
    }

    // ----- criaturas -----
    for (const c of beasts) {
      if (c.dead >= 0) { c.dead += dt; continue; }
      const dx = P.x - c.x;
      const onScreen = Math.abs(c.x - view.x) < halfW + 1;
      c.walk += dt;
      let top, bottom, reach;
      if (c.kind === 'skull') {
        // caveira: flutua de um lado para o outro e, quando vê a coruja, abre a boca e cospe fogo
        const sees = !P.dead && onScreen && Math.abs(dx) < SKULL.sees;
        c.y = SKULL.hover + Math.sin(c.walk * 2.2) * 0.3;
        if (c.wind > 0) {
          c.wind -= dt;
          if (c.wind <= 0) {
            const ax = P.x - c.x, ay = P.y + 0.8 - c.y, d = Math.hypot(ax, ay) || 1;
            addShot(c.x, c.y - 0.2, (ax / d) * SKULL.shot, (ay / d) * SKULL.shot, false);
            sfx.cast?.();
          }
        } else {
          if (sees) c.dir = dx < 0 ? -1 : 1;
          else {
            c.x += c.dir * 0.8 * dt;
            if (c.x < c.x0) { c.x = c.x0; c.dir = 1; }
            if (c.x > c.x1) { c.x = c.x1; c.dir = -1; }
          }
          if (sees) {
            c.aim -= dt;
            if (c.aim <= 0) { c.aim = 2.4 + Math.random() * 1.6; c.wind = 0.5; }
          }
        }
        top = c.y + 0.55; bottom = c.y - 0.55; reach = 0.7;
      } else {
        // rastejante: patrulha devagar; se a coruja pisa no pedaço dela, dispara para cima
        const sees = !P.dead && onScreen && Math.abs(dx) < CRAWLER.sees && P.y < 2.2 && P.x > c.x0 - 1.5 && P.x < c.x1 + 1.5;
        if (sees && !c.rage) sfx.playClip?.('rosnado', 0.3);
        c.rage = sees;
        if (sees) c.dir = dx < 0 ? -1 : 1;
        c.x += c.dir * (sees ? CRAWLER.charge : CRAWLER.walk) * dt;
        if (sees) c.walk += dt * 1.6; // pernas mais rápidas na investida
        if (c.x < c.x0) { c.x = c.x0; if (!sees) c.dir = 1; }
        if (c.x > c.x1) { c.x = c.x1; if (!sees) c.dir = -1; }
        top = 1.6; bottom = 0; reach = 1;
      }
      // encostou: pisar por cima derrota; de lado, machuca
      if (!P.dead && Math.abs(P.x - c.x) < reach && P.y < top && P.y + P.h > bottom) {
        if (P.vy < -1 && P.y > (top + bottom) / 2) { killBeast(c); player.bounce(); sfx.stomp?.(); }
        else player.hurt(c.x, c.kind === 'skull' ? 'caveira' : 'sombra');
      }
    }

    // ----- tiros -----
    for (const s of shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.mine) {
        const hit = beasts.find((c) => c.dead < 0 && Math.abs(c.x - s.x) < 0.8 && (c.kind === 'skull' ? Math.abs(s.y - c.y) < 1 : s.y < 1.5));
        if (hit) { killBeast(hit); s.life = 0; }
      } else if (!P.dead && Math.abs(P.x - s.x) < 0.55 && s.y > P.y - 0.1 && s.y < P.y + P.h) {
        player.hurt(s.x, 'caveira');
        splash(s.x, s.y, 8);
        s.life = 0;
      } else if (!s.mine && s.y < LAVA_Y) s.life = 0;
      if (s.life <= 0) dropShot(s);
    }
    shots = shots.filter((s) => s.life > 0);

    // ----- o último chão: treme, despedaça e cai -----
    if (last.t < 0 && !P.dead && P.grounded && P.ground === last.solid && P.x > last.x0 + 2.2) { last.t = 0; cb.onEdge?.(); }
    if (last.t >= 0) {
      last.t += dt;
      if (!last.broke) {
        quake = 0.08 + (last.t / CRUMBLE) * 0.22;
        if (Math.random() < dt * 16) splash(last.x0 + Math.random() * (abyssX - last.x0), 0.1, 3);
        for (const tl of last.tiles) tl.mesh.position.set(tl.x + (Math.random() - 0.5) * quake * 0.5, tl.y + (Math.random() - 0.5) * quake * 0.5, 0);
        if (last.t >= CRUMBLE) {
          last.broke = true;
          quake = 0.6;
          solids = solids.filter((sd) => sd !== last.solid);
          // cada pedaço cai a seu tempo, começando por onde a coruja está; lascas voam
          for (const tl of last.tiles) { tl.wait = Math.abs(tl.x - P.x) * 0.06; tl.vr = (Math.random() - 0.5) * 3; }
          for (let i = 0; i < 16; i++) {
            const m = plane(tileMats[Math.floor(Math.random() * TILE.count)], 0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.25, 4);
            m.position.set(last.x0 + Math.random() * (abyssX - last.x0), -0.2 + Math.random() * 0.4, 0);
            dyn.add(m);
            last.debris.push({ mesh: m, vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
          }
          for (let i = 0; i < 5; i++) splash(last.x0 + Math.random() * (abyssX - last.x0), 0, 10);
          cb.onBreak?.();
        }
      } else {
        quake = Math.max(0, quake - dt * 0.8);
        const since = last.t - CRUMBLE;
        for (const tl of last.tiles) {
          if (since < tl.wait) continue;
          tl.vy -= 30 * dt;
          tl.mesh.position.y += tl.vy * dt;
          tl.mesh.rotation.z += tl.vr * dt;
        }
        for (const d of last.debris) {
          d.vy -= 26 * dt;
          d.mesh.position.x += d.vx * dt;
          d.mesh.position.y += d.vy * dt;
          d.mesh.rotation.z += d.vr * dt;
        }
      }
    }
    // caiu no poço (com o chão quebrado ou pulando para fora dele)
    if (!P.dead && P.x > pitX + 0.6 && P.y < -1.6) {
      falling = 0;
      for (const s of shots) dropShot(s);
      shots = [];
      cb.onFall?.();
    }
  }

  // desenho: coruja, câmera, fundo, lava e brasas (roda também na tela de fim)
  function place(dt, time = 0) {
    const P = player?.P;
    if (!P || !owlMesh) return;

    // ----- arena: quem desenha os lutadores é a luta; aqui só o fundo -----
    if (fight.active) {
      owlMesh.visible = false;
      shadeMat.opacity = Math.max(0, shadeMat.opacity - dt * 1.6); // sai do breu da queda
      const v = fight.place(dt, time);
      if (camera.zoom !== v.zoom) { camera.zoom = v.zoom; camera.updateProjectionMatrix(); }
      camera.position.set(v.x + (Math.random() - 0.5) * v.shake, CAM_Y + v.y + (Math.random() - 0.5) * v.shake, 10);
      camera.updateMatrixWorld();
      placeBackdrop(0);
      lavaMesh.visible = true;
      lavaMesh.scale.x = halfW * 2 + 2;
      lavaMat.uniforms.uW.value = lavaMesh.scale.x;
      lavaMesh.position.set(0, LAVA_Y + 0.12 - lavaMesh.scale.y / 2, 0);
      lavaMat.uniforms.uTime.value = time;
      lavaMat.uniforms.uX.value = 0;
      shadeMesh.position.set(0, CAM_Y, 0);
      updateEmbers(dt);
      return;
    }

    // ----- coruja -----
    let frame = 0;
    owlMesh.rotation.z = 0;
    let oy = P.y, ox = P.x, visible = true;
    if (falling >= 0) {
      // queda imensa: a coruja despenca girando no meio da tela, com tudo passando para cima
      const k = Math.min(1, falling / 0.7);
      frame = 14;
      if (place.fallFrom === undefined) place.fallFrom = { x: P.x, y: P.y };
      ox = place.fallFrom.x + (view.x - place.fallFrom.x) * k;
      oy = place.fallFrom.y + (CAM_Y - 0.4 - place.fallFrom.y) * k + Math.sin(falling * 5) * 0.25;
      owlMesh.rotation.z = Math.sin(falling * 3.1) * 0.7 - falling * 0.6;
      shadeMat.opacity = Math.min(0.94, falling * 1.6);
      dyn.visible = falling < 0.6;
    } else if (P.dead) {
      // morte de desenho animado: um pulinho, gira e despenca
      const t = P.deadT;
      frame = 2;
      if (P.deathKind === 'drown') visible = false;
      else {
        if (place.deadY === undefined) place.deadY = P.y;
        oy = place.deadY + 9 * t - 21 * t * t;
        owlMesh.rotation.z = -P.facing * t * 7;
        if (oy < LAVA_Y - 0.4 && !place.sunk) { place.sunk = true; splash(P.x); sfx.splash?.(); }
        visible = oy > LAVA_Y - 2;
      }
    } else {
      place.deadY = undefined; place.sunk = false; place.fallFrom = undefined;
      const speed = Math.abs(P.vx);
      if (P.grounded && !wasGrounded) landT = 0.12;
      landT -= dt;
      if (!P.grounded) frame = P.vy > 9 ? 13 : 14;
      else if (landT > 0) frame = 15;
      else if (speed > 0.4) {
        runDist += speed * dt;
        frame = RUN_FRAMES[Math.floor(runDist / STRIDE) % RUN_FRAMES.length];
        // o corpo sobe um pouco na troca de passo
        oy += Math.abs(Math.sin((runDist / STRIDE / 3) * Math.PI)) * 0.06;
      } else {
        idleT += dt;
        frame = IDLE[Math.floor(idleT * 6) % IDLE.length];
      }
      wasGrounded = P.grounded;
      if (P.invuln > 0 && Math.floor(time * 18) % 2) visible = false;
    }
    setFrame(owlTex, frame, OWL.cols, OWL.rows);
    owlMesh.visible = visible;
    owlMesh.scale.x = OWL.w * (P.facing < 0 ? -1 : 1);
    owlMesh.position.set(ox, oy + OWL_H / 2 - 0.06, 0);

    // ----- criaturas e tiros -----
    for (const c of beasts) {
      const skull = c.kind === 'skull';
      const size = skull ? SKULL.size : CRAWLER.size;
      // caveira: 3 quadros de chama + boca aberta ao atirar; rastejante: 4 passos
      const f = skull ? (c.wind > 0 ? 3 : Math.floor(c.walk * 9) % 3) : Math.floor(c.walk * 6) % 4;
      const k = c.dead >= 0 ? Math.max(0.05, 1 - c.dead * 4) : 1;
      const alpha = c.dead >= 0 ? Math.max(0, 1 - c.dead * 3) : 1;
      c.tex.offset.x = f / beastArt.frames;
      c.mat.opacity = alpha;
      c.mesh.visible = alpha > 0;
      c.mesh.scale.set(size * c.dir * (skull ? k : 1), size * k, 1);
      c.mesh.position.set(c.x, skull ? c.y : -CRAWLER.foot + (size * k) / 2, 0);
      c.mesh.rotation.z = skull ? Math.sin(c.walk * 3) * 0.08 : 0;
    }
    for (const s of shots) {
      s.glow.position.set(s.x, s.y, 0);
      s.core.position.set(s.x, s.y, 0);
      s.glow.scale.setScalar((s.mine ? 1.5 : 1.3) * (1 + Math.sin(time * 28 + s.x) * 0.12));
    }

    // ----- moedas e fogo -----
    for (const c of coins) {
      if (c.got) continue;
      c.mesh.position.y = c.y + Math.sin(time * 3 + c.t) * 0.08;
      c.mesh.scale.x = 0.62 * Math.cos(time * 2.4 + c.t); // gira de lado
    }
    for (const f of fires) {
      f.glow.visible = f.core.visible = f.up;
      f.glow.position.set(f.x, f.y, 0);
      f.core.position.set(f.x, f.y, 0);
      f.core.scale.y = (f.rising ? 1.15 : -1.15) * (1 + Math.sin(time * 30 + f.x) * 0.06);
      f.glow.scale.setScalar(1.9 + Math.sin(time * 22 + f.x) * 0.15);
    }

    // ----- câmera: acompanha para os dois lados, presa às pontas da fase -----
    const lo = minX + halfW - 3, hi = Math.max(lo, abyssX + 4 - halfW * 0.4);
    const tx = Math.max(lo, Math.min(hi, P.x + P.facing * 1.6));
    view.x += (tx - view.x) * Math.min(1, dt * 4);
    if (dt === 0) view.x = tx;
    camera.position.x = view.x + (Math.random() - 0.5) * quake;
    camera.position.y = CAM_Y + (Math.random() - 0.5) * quake;
    camera.updateMatrixWorld();

    placeBackdrop(view.x);
    // a lava acaba onde começa o poço do abismo
    const l0 = view.x - halfW - 1, l1 = Math.min(view.x + halfW + 1, pitX);
    lavaMesh.visible = falling < 0.6 && l1 > l0 + 0.05;
    lavaMesh.scale.x = Math.max(0.05, l1 - l0);
    lavaMesh.position.set((l0 + l1) / 2, LAVA_Y + 0.12 - lavaMesh.scale.y / 2, 0);
    lavaMat.uniforms.uTime.value = time;
    lavaMat.uniforms.uX.value = lavaMesh.position.x;
    lavaMat.uniforms.uW.value = lavaMesh.scale.x;
    shadeMesh.position.set(view.x, CAM_Y, 0);
    if (falling < 0) shadeMat.opacity = 0;
    updateEmbers(dt);
  }

  function render(renderer) {
    renderer.render(scene, camera);
  }

  /** monta uma fase só para a tela de carregamento aquecer a GPU */
  function prewarm() {
    if (!ok) return;
    build(0, 7);
    addBeast('crawler', 0, 6, Math.random);
    addBeast('skull', 6, 12, Math.random);
    addShot(2, 1, 1, 0, true);
    addShot(3, 1, -1, 0, false);
    fight.prewarm();
  }

  resize(innerWidth / innerHeight);

  return {
    scene, camera, ready, start, stop, update, place, render, resize, prewarm, fire, toArena,
    get ok() { return ok; },
    get minX() { return minX; },
    get maxX() { return maxX; },
    get busy() { return falling >= 0 || fight.active; },
    get fighting() { return fight.active; },
    // a física do jogador usa estas funções (mesma interface do mundo)
    solidsNear: (x0, x1) => solids.filter((s) => s.maxX > x0 && s.minX < x1),
    hitBlock() {},
    clearEnemiesNear() {},
    pitFall(x) { splash(x); sfx.splash?.(); },
    isWater: () => true, // cair na lava com a última vida: some dentro dela
  };
}
