import * as THREE from 'three';
import { rng } from './textures.js';
import { createSpiderFactory } from './spider.js';
import { createPumpkinFactory } from './pumpkin.js';
import { makeVortexMaterial, glyphTexture } from './vortex.js';
import { BIOMES } from './biomes.js';
import { makeBridgePuzzle } from './bridge-math.js';
import { createDrownedHandFactory } from './drowned-hand.js';

const DEPTH = 6;      // profundidade (z) da pista de terra
const LIP = 0.55;     // espessura da borda de grama
const BOTTOM = -30;   // fundo dos blocos de terra
const EPS = 1e-4;
const ENEMY_G = 40;
const FACE = Math.PI / 2 - 0.45; // rumo das aranhas: de perfil, 3/4 para a câmera
export const PIT_FLOOR = -6; // fundo dos buracos
export const WATER_Y = -0.9; // nível da água preta do pântano

const overlap = (ax0, ax1, ay0, ay1, s) =>
  ax1 > s.minX + EPS && ax0 < s.maxX - EPS && ay1 > s.minY + EPS && ay0 < s.maxY - EPS;

// UV em coordenadas do mundo: a textura emenda entre blocos vizinhos
function worldUV(geo, cx, cy, cz, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, y = p.getY(i) + cy, z = p.getZ(i) + cz;
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z * scale, y * scale);
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x * scale, z * scale);
    else uv.setXY(i, x * scale, y * scale);
  }
  uv.needsUpdate = true;
}

// UV da borda de grama: v vai de 0 (base da faixa) a 1 (topo), u em metros
function lipUV(geo, cx, cz, h) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, y = p.getY(i), z = p.getZ(i) + cz;
    const v = (y + h / 2) / h;
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z, v);
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x * 0.5, z * 0.5);
    else uv.setXY(i, x, v);
  }
  uv.needsUpdate = true;
}

export function createWorld(scene, tex, sfx) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------- materiais e geometrias compartilhados ----------
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  const dirtMat = std({ map: tex.dirt, roughness: 1 });
  const grassMat = std({ map: tex.grassTop, roughness: 1 });
  const lipMat = std({ map: tex.lip, roughness: 1, alphaTest: 0.5 });
  const lipMats = [lipMat, lipMat, grassMat, dirtMat, lipMat, lipMat];
  const brickMat = std({ map: tex.brick });
  const qMat = std({ map: tex.qblock, emissiveMap: tex.qblock, emissive: 0xffffff, emissiveIntensity: 0.55 });
  const usedMat = std({ map: tex.used });
  const stoneMat = std({ map: tex.stone });
  const stoneWorldMat = std({ map: tex.stone });
  const blockMats = { brick: brickMat, q: qMat, used: usedMat, stone: stoneMat };
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const tintLater = [dirtMat, grassMat, lipMat, brickMat, usedMat, stoneMat, stoneWorldMat];

  const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 28).rotateX(Math.PI / 2);
  const coinMat = std({ color: 0xffc627, metalness: 0.35, roughness: 0.3, emissive: 0x8a5a00, emissiveIntensity: 0.6 });

  // ----- criaturas -----
  // Rastejante: aranha gigante (modelo procedural em spider.js)
  const spiders = createSpiderFactory();

  // Espectro: fantasma translúcido de boca escancarada
  const ghostGeo = (() => {
    const head = new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const g = new THREE.CylinderGeometry(0.5, 0.62, 0.95, 20, 6, true).translate(0, -0.475, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.9) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        p.setY(i, y + Math.sin(a * 7) * 0.13);
      }
    }
    return { head, body: g };
  })();
  const ghostMat = std({
    color: 0xc8d4ff, emissive: 0x5a6aa0, emissiveIntensity: 0.9, roughness: 0.6,
    transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false,
  });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x050308 });
  const ghostEyeGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const ghostMouthGeo = new THREE.SphereGeometry(0.14, 12, 8);
  const ghostPupilMat = new THREE.MeshBasicMaterial({ color: 0x9dff7a });
  const ghostPupilGeo = new THREE.SphereGeometry(0.03, 6, 4);

  const spriteGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const spriteMats = new Map();
  const spriteMat = (t) => {
    if (!spriteMats.has(t)) {
      const soft = t === tex.cloud || t === tex.mist;
      spriteMats.set(t, new THREE.MeshBasicMaterial(soft
        ? { map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: t === tex.mist ? 0x9a90b8 : 0xffffff }
        : { map: t, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9a94a0 }));
      const m = tintable(spriteMats.get(t));
      m.color.multiply(tint);
    }
    return spriteMats.get(t);
  };

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 3, 6).translate(0, 1.5, 0);
  const branchGeo = new THREE.CylinderGeometry(0.03, 0.1, 1.4, 5).translate(0, 0.7, 0);
  const trunkMat = std({ color: 0x1c1512, flatShading: true });
  const graveGeo = new THREE.BoxGeometry(0.8, 0.9, 0.22).translate(0, 0.45, 0);
  const graveTopGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.22, 16, 1, false, -Math.PI / 2, Math.PI)
    .rotateX(Math.PI / 2).rotateZ(0).translate(0, 0.9, 0);
  const graveMat = std({ color: 0x55565e, map: tex.stone });
  const pumpkins = createPumpkinFactory(tex);


  // checkpoint: lampião de vigília apagado num poste torto; acende quando você passa
  const vigPostGeo = new THREE.BoxGeometry(0.22, 4.2, 0.22).translate(0, 2.1, 0);
  const vigArmGeo = new THREE.BoxGeometry(1.25, 0.14, 0.16).translate(0.55, 0, 0);
  const vigBraceGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
  const vigChainGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4).translate(0, -0.22, 0);
  const vigCapGeo = new THREE.ConeGeometry(0.3, 0.3, 4).rotateY(Math.PI / 4).translate(0, -0.55, 0);
  const vigCageGeo = new THREE.BoxGeometry(0.4, 0.55, 0.4).translate(0, -0.98, 0);
  const vigGlassGeo = new THREE.BoxGeometry(0.32, 0.46, 0.32).translate(0, -0.98, 0);
  const vigBaseGeo = new THREE.BoxGeometry(0.46, 0.08, 0.46).translate(0, -1.27, 0);
  const vigFlameGeo = new THREE.ConeGeometry(0.07, 0.22, 6).translate(0, -0.95, 0);
  const vigGlowGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const vigStoneGeo = new THREE.DodecahedronGeometry(0.35, 0);
  const vigWoodMat = std({ color: 0x2a1c14, roughness: 1 });
  const vigIronMat = std({ color: 0x24222a, metalness: 0.7, roughness: 0.5 });

  // ----- portal (leva para a sala da conta) -----
  const portalRingGeo = new THREE.TorusGeometry(1.55, 0.2, 10, 40);
  const portalDiscGeo = new THREE.CircleGeometry(1.5, 48);
  const portalBaseGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7).translate(0, 0.3, 0);
  const portalStoneMat = std({ map: tex.stone, color: 0x4a3434 });
  const toothGeo = new THREE.ConeGeometry(0.11, 0.55, 6).translate(0, 0.27, 0);
  const toothMat = std({ color: 0xd8ccb0, roughness: 0.55 });
  const bloodMat = std({ color: 0x3a0204, roughness: 0.25, metalness: 0.2 });
  const dripGeo = new THREE.CylinderGeometry(0.035, 0.015, 1, 5).translate(0, -0.5, 0);
  const portalRuneGeo = new THREE.PlaneGeometry(0.55, 0.55);
  const runeMats = ['+', '−', '×', '÷'].map((ch) => new THREE.MeshBasicMaterial({
    map: glyphTexture(ch), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  // uma luz só, que vai para o portal mais próximo (evita recompilar shaders)
  const portalLight = new THREE.PointLight(0xff1a08, 0, 10, 1.5);
  root.add(portalLight);
  const PORTAL_CY = 2.05; // centro do anel acima do chão
  const PORTAL_Z = -0.6;

  // ----- cor do reino (multiplica os materiais do cenário) -----
  const tint = new THREE.Color(1, 1, 1);
  const tintables = [];
  const tintable = (m) => { tintables.push([m, m.color.clone()]); return m; };
  [...tintLater, trunkMat, graveMat].forEach(tintable);
  let warps = 0; // cada reino novo começa um pouco mais difícil
  let eventCount = 0;
  // lugares da trilha: saem de um saco embaralhado (todos aparecem, em ordem sorteada, sem repetir seguido)
  const PLACES = ['castelo', 'fenda', 'rio'];
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  // teste: index.html?lugar=castelo|fenda|rio faz esse lugar ser o primeiro, logo no começo
  const LEGACY = { fendateste: 'fenda', rioteste: 'rio', portalteste: 'castelo' };
  const testPlace = PLACES.includes(qs.get('lugar')) ? qs.get('lugar') : Object.keys(LEGACY).map((k) => qs.has(k) && LEGACY[k]).find(Boolean);
  let placeBag = [], lastPlace = null;
  function nextPlace() {
    if (eventCount === 0 && testPlace) return (lastPlace = testPlace);
    if (!placeBag.length) {
      placeBag = PLACES.slice();
      for (let i = placeBag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [placeBag[i], placeBag[j]] = [placeBag[j], placeBag[i]]; }
      if (placeBag[0] === lastPlace) placeBag.push(placeBag.shift());
    }
    return (lastPlace = placeBag.shift());
  }

  // ---------- estado ----------
  let rand = Math.random;
  let solids = [], coins = [], enemies = [], decor = [], effects = [], checkpoints = [], portals = [];
  let swingers = [], traps = [], flasks = [];
  let biome = BIOMES.cemiterio;
  const stats = { coins: 0, stomps: 0 };
  const events = [];
  let genX = 0, level = 0, nextCheckpoint = 0, nextPortal = 0;

  const add = (obj) => { root.add(obj); return obj; };
  let keepMats = false; // tela de carregamento: guarda os materiais para os shaders não serem apagados
  function drop(obj) {
    root.remove(obj);
    if (obj.userData.ownGeo) obj.geometry.dispose();
    if (obj.userData.ownMat && !keepMats) obj.material.dispose();
  }

  // ---------- construção ----------
  function addGround(x0, x1, top) {
    const w = x1 - x0, h = top - BOTTOM, cx = (x0 + x1) / 2, cy = (top + BOTTOM) / 2;
    const geo = new THREE.BoxGeometry(w, h, DEPTH);
    worldUV(geo, cx, cy, 0, 0.5);
    const body = add(new THREE.Mesh(geo, dirtMat));
    body.position.set(cx, cy, 0);
    body.receiveShadow = true;
    body.userData.ownGeo = true;

    const lgeo = new THREE.BoxGeometry(w + 0.16, LIP, DEPTH + 0.16);
    lipUV(lgeo, cx, 0, LIP);
    const lip = add(new THREE.Mesh(lgeo, lipMats));
    lip.position.set(cx, top - LIP / 2 + 0.02, 0);
    lip.receiveShadow = true;
    lip.userData.ownGeo = true;

    solids.push({ minX: x0, maxX: x1, minY: BOTTOM, maxY: top, kind: 'ground', objs: [body, lip] });
  }

  // fundo do buraco: terra escura com espinhos (só visual; a queda é tratada no player)
  const spikeIronGeo = new THREE.ConeGeometry(0.16, 0.9, 6).translate(0, 0.45, 0);
  const spikeIronMat = std({ color: 0x3a3438, metalness: 0.7, roughness: 0.45 });
  const pitMat = std({ map: tex.dirt, color: 0x6a5a55, roughness: 1 });
  tintables.push([pitMat, pitMat.color.clone()]);
  function addPitFloor(x0, x1) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const geo = new THREE.BoxGeometry(w + 0.2, 3, DEPTH);
    worldUV(geo, cx, PIT_FLOOR - 1.5, 0, 0.5);
    const floor = add(new THREE.Mesh(geo, pitMat));
    floor.position.set(cx, PIT_FLOOR - 1.5, 0);
    floor.receiveShadow = true;
    floor.userData.ownGeo = true;
    decor.push({ obj: floor, maxX: x1 });
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.55) {
      for (const z of [-1.6, -0.5, 0.7]) {
        const sp = add(new THREE.Mesh(spikeIronGeo, spikeIronMat));
        sp.position.set(x + (rand() - 0.5) * 0.2, PIT_FLOOR, z + (rand() - 0.5) * 0.3);
        sp.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
        sp.scale.setScalar(0.7 + rand() * 0.5);
        decor.push({ obj: sp, maxX: x1 });
      }
    }
  }

  function addBlock(cx, y, type) {
    const m = add(new THREE.Mesh(blockGeo, blockMats[type]));
    m.position.set(cx, y + 0.5, 0);
    m.castShadow = m.receiveShadow = true;
    solids.push({ minX: cx - 0.5, maxX: cx + 0.5, minY: y, maxY: y + 1, kind: 'block', type, mesh: m, baseY: y + 0.5, bumpT: 0, objs: [m] });
  }

  function addPillar(cx, base, top) {
    const h = top - base - 0.5;
    const geo = new THREE.BoxGeometry(1.5, h, 1.5);
    worldUV(geo, cx, base + h / 2, 0, 1);
    const body = add(new THREE.Mesh(geo, stoneWorldMat));
    body.position.set(cx, base + h / 2, 0);
    body.castShadow = body.receiveShadow = true;
    body.userData.ownGeo = true;
    const cgeo = new THREE.BoxGeometry(1.9, 0.5, 1.9);
    const cap = add(new THREE.Mesh(cgeo, stoneMat));
    cap.position.set(cx, top - 0.25, 0);
    cap.castShadow = cap.receiveShadow = true;
    cap.userData.ownGeo = true;
    solids.push({ minX: cx - 0.95, maxX: cx + 0.95, minY: base, maxY: top, kind: 'pillar', objs: [body, cap] });
  }

  function addCoin(x, y) {
    const m = add(new THREE.Mesh(coinGeo, coinMat));
    m.position.set(x, y, 0);
    m.castShadow = true;
    coins.push({ x, y, mesh: m });
  }

  function makeGhost() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    const head = new THREE.Mesh(ghostGeo.head, ghostMat);
    const body = new THREE.Mesh(ghostGeo.body, ghostMat);
    inner.add(head, body);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(ghostEyeGeo, voidMat);
      eye.scale.set(1, 1.7, 0.6);
      eye.position.set(s * 0.17, 0.12, 0.44);
      eye.rotation.z = s * 0.3;
      const pupil = new THREE.Mesh(ghostPupilGeo, ghostPupilMat);
      pupil.position.set(s * 0.17, 0.08, 0.5);
      inner.add(eye, pupil);
    }
    const mouth = new THREE.Mesh(ghostMouthGeo, voidMat);
    mouth.scale.set(0.9, 1.6, 0.5);
    mouth.position.set(0, -0.28, 0.47);
    inner.add(mouth);
    inner.position.y = 1.0;
    g.add(inner);
    g.userData = { body: inner };
    return g;
  }

  function addEnemy(x, y) {
    const m = add(spiders.make());
    m.position.set(x, y, 0);
    m.rotation.y = -FACE;
    enemies.push({ kind: 'crawler', x, y, vx: -2, vy: 0, w: 1.3, h: 1.0, mesh: m, state: 'walk', active: false, t: rand() * 10, deadT: 0 });
  }

  function addGhost(x, y) {
    const m = add(makeGhost());
    m.position.set(x, y, 0);
    enemies.push({ kind: 'ghost', x, y, baseY: y, vx: 0, vy: 0, w: 0.9, h: 1.3, mesh: m, state: 'walk', active: false, t: rand() * 10, deadT: 0 });
  }

  function addSprite(t, x, y, z, w, h, maxX = x + w) {
    const m = add(new THREE.Mesh(spriteGeo, spriteMat(t)));
    m.position.set(x, y, z);
    m.scale.set(w, h, 1);
    decor.push({ obj: m, maxX });
    return m;
  }

  // árvore morta 3D: tronco torto e galhos secos
  function addTree3D(x, y, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.rotation.z = (rand() - 0.5) * 0.2;
    g.add(trunk);
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(branchGeo, trunkMat);
      const side = i % 2 ? 1 : -1;
      b.position.set(0, 1.6 + i * 0.28, 0);
      b.rotation.set((rand() - 0.5) * 0.8, rand() * 6, side * (0.6 + rand() * 0.7));
      b.scale.setScalar(0.7 + rand() * 0.7);
      g.add(b);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y, z);
    g.scale.setScalar(0.9 + rand() * 0.6);
    add(g);
    decor.push({ obj: g, maxX: x + 3 });
  }

  function addGrave(x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(graveGeo, graveMat), new THREE.Mesh(graveTopGeo, graveMat));
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, y, z);
    g.rotation.set((rand() - 0.5) * 0.15, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.25);
    g.scale.setScalar(0.8 + rand() * 0.5);
    add(g);
    decor.push({ obj: g, maxX: x + 1 });
  }

  function addPumpkin(x, y, z) {
    const g = pumpkins.make(rand);
    g.position.set(x, y, z);
    g.scale.setScalar(0.9 + rand() * 0.5);
    add(g);
    decor.push({ obj: g, maxX: x + 1 });
  }

  function addCheckpoint(x, top) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(vigPostGeo, vigWoodMat);
    post.rotation.z = -0.06;
    const arm = new THREE.Mesh(vigArmGeo, vigWoodMat);
    arm.position.set(0.25, 3.95, 0);
    const brace = new THREE.Mesh(vigBraceGeo, vigWoodMat);
    brace.position.set(0.38, 3.62, 0);
    brace.rotation.z = -0.8;
    // pedras empilhadas segurando o poste
    for (const [sx, sy, s] of [[-0.3, 0.18, 1], [0.32, 0.15, 0.85], [0.02, 0.4, 0.7]]) {
      const st = new THREE.Mesh(vigStoneGeo, graveMat);
      st.position.set(sx, sy, 0.1);
      st.scale.setScalar(s);
      st.rotation.set(rand() * 3, rand() * 3, 0);
      g.add(st);
    }
    // lampião pendurado (balança sozinho)
    const lamp = new THREE.Group();
    lamp.position.set(1.12, 3.92, 0);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.85 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040, fog: false });
    const glowMat = new THREE.MeshBasicMaterial({ map: tex.puff, color: 0xff8a2a, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const flame = new THREE.Mesh(vigFlameGeo, flameMat);
    flame.visible = false;
    const glow = new THREE.Mesh(vigGlowGeo, glowMat);
    glow.position.set(0, -0.98, 0.3);
    lamp.add(new THREE.Mesh(vigChainGeo, vigIronMat), new THREE.Mesh(vigCapGeo, vigIronMat),
      new THREE.Mesh(vigCageGeo, vigIronMat), new THREE.Mesh(vigGlassGeo, glassMat), new THREE.Mesh(vigBaseGeo, vigIronMat), flame, glow);
    g.add(post, arm, brace, lamp);
    g.traverse((o) => { if (o.isMesh && o !== glow && o !== flame) o.castShadow = true; });
    g.position.set(x, top, -0.8);
    add(g);
    decor.push({ obj: g, maxX: x + 2 });
    checkpoints.push({ x, top, lamp, flame, glow, glassMat, on: false, lit: 0 });
  }

  function addPortal(x, top) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(portalRingGeo, portalStoneMat);
    ring.position.y = PORTAL_CY;
    ring.castShadow = true;
    const mat = makeVortexMaterial();
    const disc = new THREE.Mesh(portalDiscGeo, mat);
    disc.position.set(0, PORTAL_CY, -0.02);
    g.add(ring, disc);
    // dentes apontando para dentro: a fenda é uma boca
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.1;
      const t = new THREE.Mesh(toothGeo, toothMat);
      t.position.set(Math.cos(a) * 1.45, PORTAL_CY + Math.sin(a) * 1.45, 0.05);
      t.rotation.z = a + Math.PI / 2;
      t.scale.set(1, 0.7 + rand() * 0.7, 1);
      g.add(t);
    }
    // sangue escorrendo do anel
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.3 + rand() * (Math.PI - 0.6);
      const d = new THREE.Mesh(dripGeo, bloodMat);
      d.position.set(Math.cos(a) * 1.55, PORTAL_CY + Math.sin(a) * 1.55, 0.18);
      d.scale.y = 0.3 + rand() * 0.8;
      g.add(d);
    }
    for (const s of [-1, 1]) {
      const base = new THREE.Mesh(portalBaseGeo, portalStoneMat);
      base.position.x = s * 1.45;
      base.castShadow = base.receiveShadow = true;
      g.add(base);
    }
    const runes = runeMats.map((m) => {
      const r = new THREE.Mesh(portalRuneGeo, m);
      g.add(r);
      return r;
    });
    g.position.set(x, top, PORTAL_Z);
    add(g);
    portals.push({ kind: 'fenda', x, top, group: g, mat, disc, runes, used: false });
  }

  // trecho calmo e plano com um portal no meio (sem monstros)
  function portalSection(place) {
    const L = 30, x0 = genX, x1 = genX + L;
    addGround(x0, x1, level);
    decorate(x0, x1, level);
    patCoins(x0 + 3, level);
    if (place === 'castelo') addCastleGate(x0 + 17, level);
    else addPortal(x0 + 17, level);
    eventCount++;
    nextPortal = x0 + 17 + 220 + rand() * 120;
    if (nextCheckpoint < x1 + 20) nextCheckpoint = x1 + 20;
    genX = x1;
  }

  // =================== PONTE QUEBRADA (rio) ===================
  // Uma ponte coberta sobre o rio, com buracos medidos em metros. O telhado é baixo:
  // não dá para pular os buracos. Na beira de cada buraco o jogador escolhe tábuas
  // da pilha que somem a medida exata (bridge-math.js garante que sempre há solução).
  const U = 0.55; // 1 "metro" da conta = 0,55 m no mundo (buraco de 8 m ≈ 4,4 m: grande demais para pular)
  const SEG = 3.2; // trechos inteiros da ponte entre os buracos
  // tábuas de madeira velha (textura desenhada aqui)
  const plankTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4a3020';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = `hsl(25, ${30 + Math.random() * 15}%, ${16 + Math.random() * 8}%)`;
      g.fillRect(0, y + 2, 256, 28);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
        g.beginPath(); g.moveTo(0, y + 4 + Math.random() * 24);
        g.bezierCurveTo(80, y + Math.random() * 30, 170, y + Math.random() * 30, 256, y + 4 + Math.random() * 24);
        g.stroke();
      }
      g.fillStyle = '#1a1008';
      for (const nx of [12, 244]) { g.beginPath(); g.arc(nx, y + 16, 3, 0, Math.PI * 2); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const deckMat = std({ map: plankTex, color: 0xb89a80, roughness: 1 });
  const beamMat = std({ color: 0x2a1a10, roughness: 1 });
  const bridgeRoofMat = std({ color: 0x1c1410, roughness: 1 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const riverWaterMat = std({ color: 0x0a1a1c, roughness: 0.25, metalness: 0.4 });
  const rippleTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#163438';
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(150,200,200,${0.05 + Math.random() * 0.12})`;
      const x = Math.random() * 256, y = Math.random() * 128, w = 10 + Math.random() * 40;
      g.fillRect(x, y, w, 1 + Math.random() * 1.5);
      g.fillRect(x - 256, y, w, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const riverSurfMat = std({ map: rippleTex, color: 0x9ab8b8, roughness: 0.08, metalness: 0.5, emissive: 0x06181a, emissiveIntensity: 0.6 });
  let bridges = [];
  let bridgeCount = 0;
  let lastPX = 0;

  // placa pendurada com a medida do buraco
  function holeSignTex(size) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#2a1a10';
    g.fillRect(0, 0, 256, 160);
    for (let y = 0; y < 160; y += 7) { g.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.15})`; g.fillRect(0, y, 256, 2); }
    g.strokeStyle = '#120a06';
    g.lineWidth = 8;
    g.strokeRect(4, 4, 248, 152);
    g.textAlign = 'center';
    g.fillStyle = '#c8b898';
    g.font = 'italic 28px "IM Fell English", Georgia, serif';
    g.fillText('buraco de', 128, 46);
    g.font = '700 84px "Cinzel", Georgia, serif';
    g.shadowColor = '#ff2a10';
    g.shadowBlur = 14;
    g.fillStyle = '#ffd8b8';
    g.fillText(`${size} m`, 128, 130);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // trecho de tábuas da ponte (vira chão de verdade, inclusive para o ponto seguro)
  function addDeck(xa, xb, extra = {}) {
    const w = xb - xa, cx = (xa + xb) / 2;
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 3.4), deckMat));
    m.position.set(cx, -0.15, 0);
    m.castShadow = m.receiveShadow = true;
    m.userData.ownGeo = true;
    const s = { minX: xa, maxX: xb, minY: -0.3, maxY: 0, kind: 'ground', objs: [m], ...extra };
    solids.push(s);
    return s;
  }

  // ponta quebrada: lascas de tábua saindo da beira do buraco
  function addBrokenEdge(x, dir) {
    for (let i = 0; i < 4; i++) {
      const len = 0.2 + rand() * 0.5;
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.5), deckMat));
      m.position.set(x + (dir * len) / 2, -0.12 - rand() * 0.12, -1.3 + i * 0.85);
      m.rotation.z = -dir * (0.15 + rand() * 0.5);
      decor.push({ obj: m, maxX: x + 2 });
    }
  }

  function bridgeSection() {
    level = 0;
    const pz = makeBridgePuzzle(bridgeCount++);
    const shoreL = 12, farL = 14;
    const x0 = genX, rs = x0 + shoreL;
    addGround(x0, rs, 0);
    decorate(x0, rs, 0);

    // trechos inteiros e buracos alternados
    let x = rs;
    const holes = [];
    addDeck(x, x + SEG);
    x += SEG;
    pz.holes.forEach((size, i) => {
      const w = size * U;
      const h = { size, x0: x, x1: x + w, done: false, idx: i };
      addBrokenEdge(x, 1);
      addBrokenEdge(x + w, -1);
      // mão esperando na água embaixo do buraco
      addHand(x + w / 2);
      h.hand = enemies[enemies.length - 1];
      // placa pendurada do teto, no meio do buraco
      const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.78), new THREE.MeshBasicMaterial({ map: holeSignTex(size) })));
      sign.position.set(x + w / 2, 2.25, 1.0);
      decor.push({ obj: sign, maxX: x + w + 2 });
      for (const sx of [-0.5, 0.5]) {
        const rope = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), ropeMat));
        rope.position.set(x + w / 2 + sx, 2.85, 1.0);
        decor.push({ obj: rope, maxX: x + w + 2 });
      }
      h.sign = sign;
      holes.push(h);
      x += w;
      addDeck(x, x + SEG);
      x += SEG;
    });
    const re = x;
    addGround(re, re + farL, 0);
    decorate(re, re + farL, 0);

    // água embaixo da ponte
    const riverW = re - rs;
    const hh = WATER_Y - (PIT_FLOOR - 3);
    const water = add(new THREE.Mesh(new THREE.BoxGeometry(riverW + 0.2, hh, DEPTH), riverWaterMat));
    water.position.set(rs + riverW / 2, WATER_Y - hh / 2, 0);
    water.userData.ownGeo = true;
    decor.push({ obj: water, maxX: re + 1 });
    const surf = add(new THREE.Mesh(new THREE.PlaneGeometry(riverW + 0.2, DEPTH), riverSurfMat));
    surf.rotation.x = -Math.PI / 2;
    surf.position.set(rs + riverW / 2, WATER_Y + 0.005, 0);
    surf.userData.ownGeo = true;
    decor.push({ obj: surf, maxX: re + 1 });
    for (let mx = rs - 2; mx < re; mx += 4) {
      const m = addSprite(tex.mist, mx, WATER_Y - 0.2, 2.2 - rand() * 4, 7, 1.3, re + 4);
      m.userData.drift = 0.15;
    }

    // telhado baixo (impede pular os buracos), vigas, colunas e lampiões
    const roofY = 2.9;
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(riverW + 1, 0.3, 3.8), bridgeRoofMat));
    roof.position.set(rs + riverW / 2, roofY + 0.15, 0);
    roof.userData.ownGeo = true;
    decor.push({ obj: roof, maxX: re + 1 });
    for (const sz of [-1, 1]) {
      const slope = add(new THREE.Mesh(new THREE.BoxGeometry(riverW + 1.4, 0.18, 2.4), bridgeRoofMat));
      slope.position.set(rs + riverW / 2, roofY + 0.75, sz * 1.0);
      slope.rotation.x = sz * 0.55;
      slope.userData.ownGeo = true;
      decor.push({ obj: slope, maxX: re + 1 });
    }
    solids.push({ minX: rs - 0.4, maxX: re + 0.4, minY: roofY, maxY: roofY + 6, kind: 'roof', objs: [] });
    for (let px = rs; px <= re + 0.01; px += riverW / Math.max(1, Math.round(riverW / 3.4))) {
      for (const pz2 of [-1.65, 1.65]) {
        const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, roofY + 0.3, 0.2), beamMat));
        post.position.set(px, (roofY - 0.3) / 2, pz2);
        post.castShadow = true;
        decor.push({ obj: post, maxX: px + 1 });
      }
    }
    for (const rz of [-1.65, 1.65]) {
      const rail = add(new THREE.Mesh(new THREE.BoxGeometry(riverW, 0.1, 0.1), beamMat));
      rail.position.set(rs + riverW / 2, 1.0, rz);
      rail.userData.ownGeo = true;
      decor.push({ obj: rail, maxX: re + 1 });
    }
    for (let lx = rs + 1.5; lx < re; lx += 6) {
      const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat));
      lamp.position.set(lx, roofY - 0.35, -1.2);
      decor.push({ obj: lamp, maxX: lx + 1 });
    }

    // pilha de tábuas na margem (de onde saem as tábuas)
    const pile = new THREE.Group();
    pz.planks.forEach((v, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(v * U * 0.5, 0.1, 0.4), deckMat);
      b.position.set((rand() - 0.5) * 0.3, 0.06 + i * 0.1, (rand() - 0.5) * 0.2);
      b.rotation.y = (rand() - 0.5) * 0.3;
      pile.add(b);
    });
    pile.position.set(rs - 2.2, 0, -1.6);
    pile.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    add(pile);
    decor.push({ obj: pile, maxX: rs });

    bridges.push({
      x0, rs, re, holes, planks: pz.planks.map((v, i) => ({ v, i, used: false })), announced: false, done: false,
    });
    nextPortal = re + farL + 200 + rand() * 100;
    if (nextCheckpoint < re + farL + 20) nextCheckpoint = re + farL + 20;
    eventCount++;
    genX = re + farL;
  }

  // tábua caindo (efeito)
  function fallingBoard(x, w, y, vx) {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, 3.2), deckMat));
    m.position.set(x, y, 0);
    m.userData.ownGeo = true;
    let vy = 0;
    effects.push({
      mesh: m, t: 0, dur: 1.6,
      update(f, dt) {
        vy -= 22 * dt;
        m.position.y += vy * dt;
        m.position.x += vx * dt;
        m.rotation.z += vx * dt * 0.8;
        if (m.position.y < WATER_Y && !f.splashed) { f.splashed = true; puff(m.position.x, WATER_Y + 0.3, 1.5, 1.6, 0x4a6a60); sfx.splash?.(); }
      },
    });
  }

  /**
   * O jogador escolheu tábuas para um buraco. Retorna 'ok', 'short' (curta) ou 'long' (comprida).
   */
  function placePlanks(bridge, hole, ids) {
    const chosen = ids.map((i) => bridge.planks[i]).filter((p) => p && !p.used);
    const sum = chosen.reduce((a, p) => a + p.v, 0);
    const mid = (hole.x0 + hole.x1) / 2;
    if (sum < hole.size) {
      // as tábuas não alcançam o outro lado: caem na água (e voltam para a pilha)
      let xx = hole.x0;
      for (const p of chosen) { fallingBoard(xx + (p.v * U) / 2, p.v * U, -0.15, 0.4); xx += p.v * U; }
      events.push({ type: 'bridgeShort', sum, size: hole.size });
      return 'short';
    }
    if (sum > hole.size) {
      events.push({ type: 'bridgeLong', sum, size: hole.size });
      return 'long';
    }
    // encaixou: as tábuas descem do alto, uma de cada vez, e viram chão
    let xx = hole.x0;
    chosen.forEach((p, k) => {
      p.used = true;
      const w = p.v * U, cx = xx + w / 2;
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.28, 3.3), deckMat));
      m.position.set(cx, 3 + k * 0.6, 0);
      m.castShadow = m.receiveShadow = true;
      m.userData.ownGeo = true;
      const s = { minX: xx, maxX: xx + w, minY: -0.3, maxY: 0, kind: 'ground', objs: [m] };
      solids.push(s);
      let vy = 0, landed = false;
      effects.push({
        mesh: null, t: 0, dur: 1.5,
        update(f, dt) {
          if (landed) return;
          vy -= 30 * dt;
          m.position.y = Math.max(-0.14, m.position.y + vy * dt);
          if (m.position.y <= -0.14) { landed = true; sfx.bump(); puff(cx, 0.1, 0.8, 1, 0xa08060); }
        },
      });
      xx += w;
    });
    hole.done = true;
    hole.sign.material.color.set(0x7aff7a);
    // acertou: a mão do buraco some na hora, afundando com um respingo
    if (hole.hand && !hole.hand.dead) {
      hole.hand.dead = true;
      puff(hole.hand.x, WATER_Y + 0.4, 1, 1.8, 0x4a6a60);
      sfx.splash?.();
    }
    stats.coins += 2;
    if (bridge.holes.every((h) => h.done)) {
      bridge.done = true;
      stats.coins += 5;
      events.push({ type: 'bridgeDone' });
    } else events.push({ type: 'bridgeOk', size: hole.size });
    void mid;
    return 'ok';
  }

  function updateBridges(dt, time, player) {
    const P = player.P;
    lastPX = P.x;
    rippleTex.offset.x = time * 0.02;
    rippleTex.offset.y = Math.sin(time * 0.3) * 0.02;
    for (const b of bridges) {
      if (!b.announced && P.x > b.x0 + 2 && P.x < b.re) { b.announced = true; events.push({ type: 'bridgeNear' }); }
      for (const h of b.holes) if (!h.done) h.sign.rotation.z = Math.sin(time * 1.4 + h.x0) * 0.06;
    }
  }

  // botão de usar (E) na beira de um buraco
  function interactAt(P) {
    if (!P.grounded) return null;
    for (const b of bridges) {
      for (const h of b.holes) {
        if (h.done) continue;
        if (P.x > h.x0 - 2.2 && P.x < h.x0 + 0.1) {
          return {
            x: (h.x0 + h.x1) / 2, y: 2.0,
            label: `Tapar o buraco de ${h.size} m`,
            use: () => events.push({ type: 'bridgeOpen', bridge: b, hole: h }),
          };
        }
        break; // só o próximo buraco desta ponte
      }
    }
    return null;
  }
  const inRiver = (x) => bridges.some((b) => x > b.rs && x < b.re);

  // ----- fachada do castelo (entrada da fase do castelo) -----
  const castleStone = std({ map: tex.stone, color: 0x5a5058 });
  const castleDark = std({ map: tex.stone, color: 0x2e282e });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const gateHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const roofMat = std({ color: 0x1a1418, roughness: 0.8 });
  const bridgeMat = std({ color: 0x3a2a1c, roughness: 1 });
  function addCastleGate(x, top) {
    const g = new THREE.Group();
    const Z = -3.6;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 1.4), castleStone);
    wall.position.set(0, 4.5, Z);
    g.add(wall);
    // ameias
    for (let i = -7; i <= 7; i += 2) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.4), castleStone);
      m.position.set(i, 9.5, Z);
      g.add(m);
    }
    // torres
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 14, 12), castleDark);
      tower.position.set(sx * 8.5, 7, Z - 0.4);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.5, 12), roofMat);
      roof.position.set(sx * 8.5, 16.2, Z - 0.4);
      g.add(tower, roof);
      for (const wy of [6, 10]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), winMat);
        w.position.set(sx * 8.5, wy, Z - 0.4 + 2.21);
        g.add(w);
      }
    }
    // portão: buraco escuro em arco + grade levantada
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), gateHoleMat);
    hole.position.set(0, 2.2, Z + 0.71);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20, 0, Math.PI), gateHoleMat);
    arch.position.set(0, 4.4, Z + 0.71);
    g.add(hole, arch);
    for (let i = -1.4; i <= 1.4; i += 0.35) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.08), spikeIronMat);
      bar.position.set(i, 5.2, Z + 0.8);
      g.add(bar);
    }
    // janelas acesas
    for (const wx of [-4.5, 4.5]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3), winMat);
      w.position.set(wx, 6, Z + 0.71);
      g.add(w);
    }
    // ponte levadiça deitada no chão até a pista
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 3.2), bridgeMat);
    bridge.position.set(0, 0.08, Z + 2.3);
    g.add(bridge);
    g.traverse((o) => { if (o.isMesh && o.material !== winMat && o.material !== gateHoleMat) { o.castShadow = o.receiveShadow = true; } });
    g.position.set(x, top, 0);
    add(g);
    portals.push({ kind: 'castelo', x, top, group: g, runes: [], used: false });
  }

  // =================== MUNDOS ===================
  // ----- Floresta dos Enforcados -----
  const ropeMat = std({ color: 0x3a2e1e });
  const ropeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4).translate(0, -0.5, 0);
  const corpseMat = std({ color: 0x241c18, roughness: 1 });
  const headGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.14, 0.62, 8);
  const limbGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.62, 6);
  const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a10, fog: false });
  const redEyeGeo = new THREE.SphereGeometry(0.028, 6, 4);
  const rootGeo = new THREE.TorusGeometry(0.45, 0.07, 5, 10, Math.PI);

  // corpo pendurado: pivô no galho, balança e às vezes abre os olhos
  function makeCorpse(rope) {
    const pivot = new THREE.Group();
    const r = new THREE.Mesh(ropeGeo, ropeMat);
    r.scale.y = rope;
    const body = new THREE.Group();
    body.position.y = -rope;
    const head = new THREE.Mesh(headGeo, corpseMat);
    head.position.set(0.03, -0.12, 0);
    head.rotation.z = 0.5; // pescoço quebrado
    const torso = new THREE.Mesh(torsoGeo, corpseMat);
    torso.position.y = -0.55;
    body.add(head, torso);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(limbGeo, corpseMat);
      arm.position.set(sx * 0.21, -0.6, 0);
      arm.rotation.z = sx * 0.08;
      const leg = new THREE.Mesh(limbGeo, corpseMat);
      leg.position.set(sx * 0.08, -1.15, 0);
      body.add(arm, leg);
    }
    const eyes = new THREE.Group();
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(redEyeGeo, redEyeMat);
      e.position.set(sx * 0.05, 0, 0.12);
      eyes.add(e);
    }
    eyes.position.copy(head.position);
    eyes.visible = false;
    body.add(eyes);
    pivot.add(r, body);
    pivot.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { pivot, eyes };
  }

  function addHangingTree(x, y, z, near) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(1.3, 1.6, 1.3);
    const limb = new THREE.Mesh(branchGeo, trunkMat);
    limb.rotation.z = -Math.PI / 2 + 0.15;
    limb.scale.set(1.6, 1.7, 1.6);
    limb.position.y = 4.1;
    g.add(trunk, limb);
    const c = makeCorpse(0.9 + rand() * 0.9);
    c.pivot.position.set(1.6, 4.3, 0);
    g.add(c.pivot);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y, z);
    add(g);
    decor.push({ obj: g, maxX: x + 3 });
    swingers.push({ pivot: c.pivot, eyes: c.eyes, x: x + 1.6, ph: rand() * 6, willOpen: near && rand() < 0.55, open: false });
  }

  function addRoot(x, y, z) {
    const m = add(new THREE.Mesh(rootGeo, trunkMat));
    m.position.set(x, y - 0.12, z);
    m.rotation.set(0, (rand() - 0.5) * 1.2, 0);
    m.scale.set(0.8 + rand(), 0.6 + rand() * 0.6, 1);
    decor.push({ obj: m, maxX: x + 1 });
  }

  function decorateForest(x0, x1, top) {
    // folhas secas na frente
    for (let x = x0 + 0.6; x < x1 - 0.6; x += 1 + rand() * 2) {
      addSprite(tex.tuft, x, top - 0.08, 2.7 + rand() * 0.3, 0.9 + rand() * 0.7, 0.35 + rand() * 0.25);
    }
    // borda de trás: árvores grossas, enforcados e raízes
    for (let x = x0 + 1; x < x1 - 1; x += 2.2 + rand() * 3.5) {
      const r = rand();
      if (r < 0.28) addHangingTree(x - 1.6, top, -2.6 - rand() * 0.8, true);
      else if (r < 0.62) addTree3D(x, top, -2.3 - rand() * 0.6);
      else addRoot(x, top, -1.9);
    }
    // mata fechada lá atrás
    for (let x = x0; x < x1; x += 1.4 + rand() * 2.5) {
      const r = rand();
      if (r < 0.45) addSprite(rand() < 0.6 ? tex.tree : tex.tree2, x, -0.55, -7 - rand() * 12, 3.8 + rand() * 1.5, 6 + rand() * 2.5);
      else if (r < 0.8) addTree3D(x, -0.5, -4.5 - rand() * 9);
      else if (r < 0.9) addHangingTree(x, -0.5, -6 - rand() * 6, false);
      else addSprite(tex.bush, x, -0.55, -4.5 - rand() * 8, 3 + rand() * 2, 1.5 + rand() * 0.8);
    }
    for (let x = x0; x < x1; x += 4 + rand() * 4) {
      const m = addSprite(tex.mist, x, top - 0.3, 1.2 - rand() * 6, 9 + rand() * 5, 1.6 + rand() * 1, x + 14);
      m.userData.drift = 0.15 + rand() * 0.25;
    }
  }

  // ----- Pântano Afogado -----
  const woodMat = std({ color: 0x2a2018, roughness: 1 });
  const crossV = new THREE.BoxGeometry(0.14, 1.6, 0.12).translate(0, 0.8, 0);
  const crossH = new THREE.BoxGeometry(0.8, 0.13, 0.12).translate(0, 1.2, 0);
  const waterMat = std({ color: 0x040909, roughness: 0.06, metalness: 0.75 });
  const wispMat = new THREE.MeshBasicMaterial({ map: tex.puff, color: 0x7affc0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const wispGeo = new THREE.PlaneGeometry(0.7, 0.7);

  function addCross(x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(crossV, woodMat), new THREE.Mesh(crossH, woodMat));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y - 0.4 - rand() * 0.4, z);
    g.rotation.set((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.7);
    add(g);
    decor.push({ obj: g, maxX: x + 1 });
  }

  // fogo-fátuo: luzinha verde que flutua (e chama para os buracos)
  function addWisp(x, y, z) {
    const m = add(new THREE.Mesh(wispGeo, wispMat));
    m.position.set(x, y, z);
    m.userData.wisp = { x, y, ph: rand() * 6 };
    decor.push({ obj: m, maxX: x + 3 });
  }

  function decorateSwamp(x0, x1, top) {
    // juncos altos na frente
    for (let x = x0 + 0.4; x < x1 - 0.4; x += 0.8 + rand() * 1.6) {
      addSprite(tex.tuft, x, top - 0.1, 2.6 + rand() * 0.4, 0.7 + rand() * 0.5, 0.7 + rand() * 0.6);
    }
    for (let x = x0 + 1.5; x < x1 - 1.5; x += 2.5 + rand() * 4) {
      const r = rand();
      if (r < 0.4) addCross(x, top, -2.2);
      else if (r < 0.6) addTree3D(x, top - 0.3, -2.5);
      else addSprite(tex.tuft, x, top - 0.1, -2, 1.2 + rand(), 1.1 + rand() * 0.6);
    }
    // cruzes e árvores afundadas na água lá atrás
    for (let x = x0; x < x1; x += 2 + rand() * 4) {
      const r = rand(), z = -4.5 - rand() * 12;
      if (r < 0.4) addCross(x, -0.5, z);
      else if (r < 0.65) addTree3D(x, -0.9, z - 2);
      else if (r < 0.85) addSprite(rand() < 0.5 ? tex.tree : tex.tree2, x, -0.7, -9 - rand() * 10, 3.4 + rand(), 5 + rand() * 2);
    }
    for (let i = 0; i < 2; i++) if (rand() < 0.6) addWisp(x0 + rand() * (x1 - x0), top + 1.4 + rand() * 1.8, -0.8 - rand() * 4);
    // névoa grossa
    for (let x = x0; x < x1; x += 3 + rand() * 3) {
      const m = addSprite(tex.mist, x, top - 0.4, 1.5 - rand() * 7, 10 + rand() * 5, 1.8 + rand() * 1.2, x + 14);
      m.userData.drift = 0.1 + rand() * 0.2;
    }
  }

  // buraco do pântano: água preta (não dá pra ver o fundo)
  function addWaterPit(x0, x1) {
    const w = x1 - x0, cx = (x0 + x1) / 2, h = WATER_Y - (PIT_FLOOR - 3);
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h, DEPTH), waterMat));
    m.position.set(cx, WATER_Y - h / 2, 0);
    m.receiveShadow = true;
    m.userData.ownGeo = true;
    decor.push({ obj: m, maxX: x1 });
    const mist = addSprite(tex.mist, cx - w / 2 - 1, WATER_Y - 0.2, 1.2, w + 2, 1.2, x1 + 2);
    mist.userData.drift = 0.1;
  }

  // mão afogada: sobe da água quando o jogador chega perto e agarra
  const makeDrownedHand = createDrownedHandFactory();
  function addHand(x) {
    const g = makeDrownedHand();
    add(g);
    g.position.set(x, WATER_Y, 0.2);
    enemies.push({ kind: 'hand', x, y: WATER_Y, vx: 0, vy: 0, w: 0.5, h: 0, mesh: g, state: 'walk', active: false, t: rand() * 3, deadT: 0, rise: 0 });
  }

  // tábua podre: afunda logo depois que alguém pisa
  const plankGeo = new THREE.BoxGeometry(1.6, 0.18, 1.3);
  function addPlank(cx, y) {
    const m = add(new THREE.Mesh(plankGeo, woodMat));
    m.position.set(cx, y - 0.09, 0);
    m.rotation.y = (rand() - 0.5) * 0.2;
    m.castShadow = m.receiveShadow = true;
    solids.push({ minX: cx - 0.8, maxX: cx + 0.8, minY: y - 0.18, maxY: y, kind: 'plank', mesh: m, baseY: y, load: 0, sink: 0, objs: [m] });
  }

  // ----- armadilha de urso (floresta) -----
  const trapMat = std({ color: 0x8a807a, metalness: 0.85, roughness: 0.3, emissive: 0x5a2a10, emissiveIntensity: 0.6 });
  const jawGeo = new THREE.TorusGeometry(0.32, 0.03, 4, 14, Math.PI);
  const trapToothGeo = new THREE.ConeGeometry(0.035, 0.12, 4).translate(0, 0.06, 0);
  const trapBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.05, 10);
  function addTrap(x, top) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(trapBaseGeo, trapMat));
    const jaws = [1, -1].map((s) => {
      const j = new THREE.Group();
      j.add(new THREE.Mesh(jawGeo, trapMat));
      for (let i = 1; i < 7; i++) {
        const a = (i / 7) * Math.PI;
        const t = new THREE.Mesh(trapToothGeo, trapMat);
        t.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
        t.rotation.z = a + Math.PI / 2;
        j.add(t);
      }
      j.rotation.x = s * Math.PI / 2; // aberta, deitada no chão
      g.add(j);
      return { j, s };
    });
    g.position.set(x, top + 0.02, 0);
    add(g);
    traps.push({ x, y: top, g, jaws, closed: false, k: 0 });
    // folhas escondendo metade da armadilha
  }

  // ----- aranha pendurada no fio (floresta) -----
  const threadMat = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.5 });
  const threadGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 3).translate(0, 0.5, 0);
  function addDropper(x, y) {
    const m = add(spiders.make());
    m.position.set(x, y, 0);
    m.rotation.y = -FACE;
    const thread = new THREE.Mesh(threadGeo, threadMat);
    thread.scale.y = 9;
    thread.position.y = 0.7;
    m.add(thread);
    enemies.push({ kind: 'dropper', x, y, hangY: y, vx: 0, vy: 0, w: 1.3, h: 1.0, mesh: m, state: 'walk', active: false, t: rand() * 10, deadT: 0, thread });
  }

  // ----- frasco de óleo da lanterna -----
  const flaskMat = std({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.1, roughness: 0.15, transparent: true, opacity: 0.9 });
  const corkMat = std({ color: 0x5a3a20 });
  const flaskBodyGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const flaskNeckGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.18, 8).translate(0, 0.25, 0);
  const corkGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.08, 8).translate(0, 0.37, 0);
  function addFlask(x, y) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(flaskBodyGeo, flaskMat), new THREE.Mesh(flaskNeckGeo, flaskMat), new THREE.Mesh(corkGeo, corkMat));
    g.position.set(x, y, 0);
    add(g);
    flasks.push({ x, y, mesh: g });
  }

  function decorate(x0, x1, top) {
    if (biome.id === 'floresta') return decorateForest(x0, x1, top);
    if (biome.id === 'pantano') return decorateSwamp(x0, x1, top);
    return decorateCemetery(x0, x1, top);
  }

  // decoração de um trecho de chão: 2D (recortes) e 3D misturados
  function decorateCemetery(x0, x1, top) {
    for (let x = x0 + 0.6; x < x1 - 0.6; x += 1.4 + rand() * 3) {
      addSprite(tex.tuft, x, top - 0.08, 2.75 + rand() * 0.25, 0.9 + rand() * 0.6, 0.4 + rand() * 0.25);
    }
    // na borda de trás da pista: lápides, abóboras ou arbusto seco
    for (let x = x0 + 1.5; x < x1 - 1.5; x += 3 + rand() * 5) {
      const r = rand();
      if (r < 0.35) addGrave(x, top, -2.2);
      else if (r < 0.55) addPumpkin(x, top, -1.9);
      else if (r < 0.75) addSprite(tex.bush, x - 1.2, top - 0.05, -2.4, 2.4 + rand(), 1.3 + rand() * 0.5);
    }
    for (let x = x0; x < x1; x += 2.5 + rand() * 5) {
      const r = rand(), z = -4.5 - rand() * 12;
      if (r < 0.25) addSprite(tex.bush, x, -0.55, z, 3 + rand() * 2, 1.5 + rand() * 0.8);
      else if (r < 0.55) addSprite(rand() < 0.75 ? tex.tree : tex.tree2, x, -0.55, -8 - rand() * 10, 3.6 + rand(), 5.2 + rand() * 1.8);
      else if (r < 0.75) addTree3D(x, -0.5, -5.5 - rand() * 7);
      else addGrave(x, -0.5, z);
    }
    // névoa rasteira
    for (let x = x0; x < x1; x += 6 + rand() * 6) {
      const m = addSprite(tex.mist, x, top - 0.3, 1.2 - rand() * 5, 9 + rand() * 5, 1.4 + rand() * 0.8, x + 14);
      m.userData.drift = 0.2 + rand() * 0.3;
    }
    if (rand() < 0.5) {
      const s = 7 + rand() * 5;
      addSprite(tex.cloud, x0 + rand() * (x1 - x0), 9 + rand() * 7, -22 - rand() * 25, s, s / 2, x1 + 40);
    }
  }

  // padrão: fantasma flutuando
  function patGhost(x, top) {
    if (d < 0.12) return patEnemies(x, top);
    addGhost(x + 1, top + 2.2 + rand() * 1.2);
    return 2;
  }

  // ---------- padrões do nível ----------
  let d = 0; // dificuldade 0..1

  function patBlocks(x, top, y = top + 2.8) {
    const n = 3 + Math.floor(rand() * 3);
    const qi = Math.floor(rand() * n);
    for (let i = 0; i < n; i++) addBlock(x + i + 0.5, y, i === qi || rand() < 0.2 ? 'q' : 'brick');
    if (n >= 4 && rand() < 0.4) addBlock(x + Math.floor(n / 2) + 0.5, y + 4, 'q');
    else if (rand() < 0.5) for (let i = 0; i < n; i++) addCoin(x + i + 0.5, y + 1.6);
    if (rand() < 0.35 + d * 0.35) addEnemy(x + n * 0.5, top);
    return n;
  }

  function patCoins(x, top) {
    const n = 4 + Math.floor(rand() * 3);
    const arc = rand() < 0.5;
    for (let i = 0; i < n; i++) {
      addCoin(x + i * 0.9 + 0.5, top + 1.1 + (arc ? Math.sin((i / (n - 1)) * Math.PI) * 1.6 : 0));
    }
    return n * 0.9;
  }

  function patPillars(x, top) {
    const h = () => Math.round((1.5 + rand() * (1.2 + d * 1.1)) * 2) / 2;
    const h1 = h();
    addPillar(x + 0.95, top, top + h1);
    if (rand() < 0.5) addCoin(x + 0.95, top + h1 + 1.4);
    if (rand() < 0.5) {
      addEnemy(x + 3.6, top);
      addPillar(x + 6.25, top, top + h());
      return 7.2;
    }
    return 1.9;
  }

  function patEnemies(x, top) {
    const n = 1 + Math.floor(rand() * (1 + d * 2));
    for (let i = 0; i < n; i++) addEnemy(x + 0.8 + i * 2.3, top);
    return n * 2.3;
  }

  function patStairs(x, top) {
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) addBlock(x + i + 0.5, top + j, 'stone');
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) addBlock(x + n + i + 0.5, top + j, 'stone');
    addCoin(x + n, top + n + 1.2);
    return 2 * n;
  }

  function patPlatform(x, top) {
    const n = 3 + Math.floor(rand() * 3);
    const y = top + 2.6;
    for (let i = 0; i < n; i++) addBlock(x + i + 0.5, y, rand() < 0.2 ? 'q' : 'brick');
    for (let i = 0; i < n; i++) addCoin(x + i + 0.5, y + 1.7);
    if (n >= 4 && rand() < 0.5) addEnemy(x + n - 1, y + 1);
    return n;
  }

  function patDropper(x, top) {
    if (d < 0.08) return patCoins(x, top);
    addDropper(x + 1.2, top + 4.6 + rand() * 0.8);
    if (rand() < 0.5) for (let i = 0; i < 3; i++) addCoin(x + 0.3 + i * 0.9, top + 1.2);
    return 2.6;
  }

  let lastTrapX = -1e9;
  function patTrap(x, top) {
    if (d < 0.15 || x - lastTrapX < 25) return patCoins(x, top);
    lastTrapX = x;
    addTrap(x + 0.8, top);
    if (rand() < 0.5) addCoin(x + 0.8, top + 2.4); // isca
    return 1.6;
  }

  let patterns = [];
  function buildPatterns() {
    const w = biome.patterns;
    patterns = [
      [patBlocks, 3, 5], [patCoins, 2, 6], [patPillars, 2 * (w.pillars ?? 1), 7.2],
      [patEnemies, 2, 7], [patStairs, 1, 8], [patPlatform, 2, 5], [patGhost, 1.5 * (w.ghost ?? 1), 2],
    ];
    if (w.dropper) patterns.push([patDropper, w.dropper, 2.6]);
    if (w.trap) patterns.push([patTrap, w.trap, 1.6]);
  }
  buildPatterns();

  function pickPattern(room) {
    const fit = patterns.filter((p) => p[2] <= room);
    if (!fit.length) return null;
    let total = fit.reduce((s, p) => s + p[1], 0);
    let r = rand() * total;
    for (const p of fit) if ((r -= p[1]) <= 0) return p[0];
    return fit[0][0];
  }

  function section() {
    d = Math.min(1, (genX - originX) / 600 + warps * 0.12);
    if (genX >= nextPortal) {
      const place = nextPlace();
      return place === 'rio' ? bridgeSection() : portalSection(place);
    }

    // buraco
    if (rand() < 0.3 + 0.3 * d) {
      const gap = 2 + Math.floor(rand() * (2 + d * 2.5));
      const mid = genX + gap / 2;
      if (biome.pit === 'water') {
        // tábuas podres boiando e mãos esperando na água
        if (gap >= 3 && rand() < 0.75) {
          const n = gap >= 5 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const px = genX + (gap * (i + 1)) / (n + 1);
            addPlank(px, WATER_Y + 0.4);
            addCoin(px, WATER_Y + 1.9);
          }
        }
        if (gap >= 3 && rand() < 0.25 + d * 0.3) addHand(mid + (rand() - 0.5) * (gap - 2));
        addWaterPit(genX, genX + gap);
        genX += gap;
      } else if (gap >= 4 && rand() < 0.5) {
        // degraus flutuantes no meio do buraco, moedas EM CIMA deles
        const by = level + 2.2;
        addBlock(mid - 0.5, by, 'brick');
        addBlock(mid + 0.5, by, 'q');
        addCoin(mid - 0.5, by + 1.7);
        addCoin(mid + 0.5, by + 1.7);
      } else {
        // arco de moedas acompanhando o pulo por cima do buraco
        const n = Math.max(3, Math.round(gap));
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          addCoin(genX + 0.5 + t * (gap - 1), level + 1.8 + Math.sin(t * Math.PI) * 1.4);
        }
      }
      if (biome.pit !== 'water') {
        addPitFloor(genX, genX + gap);
        genX += gap;
      }
    }

    // degrau de altura
    const steps = [-1, 0, 0, 1, 1];
    level = Math.max(0, Math.min(3, level + steps[Math.floor(rand() * steps.length)]));

    const L = 10 + Math.floor(rand() * 13);
    const x0 = genX, x1 = genX + L;
    addGround(x0, x1, level);
    decorate(x0, x1, level);

    let cx = x0 + 2.5;
    if (genX >= nextCheckpoint) {
      addCheckpoint(x0 + 1.5, level);
      nextCheckpoint += 160;
      cx = x0 + 4;
    }
    while (cx < x1 - 3) {
      const fn = pickPattern(x1 - 2 - cx);
      if (!fn) break;
      cx += fn(cx, level) + 2 + rand() * 3;
    }
    // frasco de óleo de vez em quando
    if (rand() < 0.3) addFlask(x0 + 2 + rand() * (L - 4), level + 1.3);
    genX = x1;
  }

  // ---------- API ----------
  let originX = 0;
  function dropPortal(p) {
    root.remove(p.group);
    if (!keepMats) p.mat?.dispose();
  }

  function clearAll() {
    for (const s of solids) s.objs.forEach(drop);
    for (const c of coins) drop(c.mesh);
    for (const e of enemies) drop(e.mesh);
    for (const o of decor) drop(o.obj);
    for (const f of effects) drop(f.mesh);
    for (const p of portals) dropPortal(p);
    for (const t of traps) drop(t.g);
    for (const f of flasks) drop(f.mesh);
    bridges = [];
    solids = []; coins = []; enemies = []; decor = []; effects = []; checkpoints = []; portals = [];
    swingers = []; traps = []; flasks = [];
    events.length = 0;
    portalLight.intensity = 0;
  }

  // trecho inicial calmo a partir de x0
  function startAt(x0, firstPortal) {
    originX = x0;
    level = 0;
    addGround(x0 - 40, x0 + 22, 0);
    decorate(x0 - 40, x0 + 22, 0);
    for (let i = 0; i < 4; i++) addCoin(x0 + 6 + i * 0.9, 1.2);
    addBlock(x0 + 12.5, 2.8, 'brick');
    addBlock(x0 + 13.5, 2.8, 'q');
    addBlock(x0 + 14.5, 2.8, 'brick');
    addEnemy(x0 + 19, 0);
    genX = x0 + 22;
    nextCheckpoint = x0 + (qs.has('vigilia') ? 26 : 140); // teste: index.html?vigilia
    nextPortal = x0 + firstPortal;
  }

  function reset(seed, startBiome = BIOMES.cemiterio) {
    clearAll();
    warps = 0;
    eventCount = 0;
    bridgeCount = 0;
    placeBag = []; lastPlace = null;
    setBiome(startBiome);
    stats.coins = 0;
    stats.stomps = 0;
    rand = rng(seed);
    startAt(0, testPlace ? 4 : 70 + rand() * 60);
  }

  // novo reino: apaga tudo e recomeça a trilha em x (a distância continua contando)
  function warp(x, seed, nextBiome) {
    clearAll();
    if (nextBiome) setBiome(nextBiome);
    warps++;
    rand = rng(seed);
    startAt(x, 200 + rand() * 80);
  }

  // troca chão, decoração, buracos e criaturas do mundo
  function setBiome(b) {
    biome = b;
    dirtMat.map = tex[b.tex.dirt];
    pitMat.map = tex[b.tex.dirt];
    grassMat.map = tex[b.tex.top];
    for (const m of [dirtMat, pitMat, grassMat]) m.needsUpdate = true;
    setTint(new THREE.Color(b.tint));
    buildPatterns();
  }

  // a fantasma surge do escuro (lanterna apagada)
  function spawnGhost(x, y) {
    addGhost(x, y);
    const e = enemies[enemies.length - 1];
    e.active = true;
    events.push({ type: 'ghost' });
  }

  function setTint(color) {
    tint.copy(color);
    for (const [m, base] of tintables) m.color.copy(base).multiply(tint);
  }

  // o jogador entrou no anel?
  function portalAt(P) {
    for (const p of portals) {
      if (!p.used && P.x > p.x - 0.1 && P.x < p.x + 2.5 && P.y < p.top + 4.6 && P.y > p.top - 1) {
        p.used = true;
        return p;
      }
    }
    return null;
  }

  function generate(untilX) {
    while (genX < untilX) section();
  }

  function solidsNear(x0, x1) {
    return solids.filter((s) => s.maxX > x0 && s.minX < x1);
  }

  function puff(x, y, z = 0.6, size = 1.2, color = 0xffffff) {
    const mat = new THREE.MeshBasicMaterial({ map: tex.puff, transparent: true, depthWrite: false, color });
    const m = add(new THREE.Mesh(spriteGeo, mat));
    m.userData.ownMat = true;
    m.position.set(x, y - size / 2, z);
    effects.push({
      mesh: m, t: 0, dur: 0.35,
      update(f) {
        const k = f.t / f.dur, s = size * (0.6 + k * 0.8);
        m.scale.set(s, s, 1);
        m.position.y = y - s / 2;
        mat.opacity = 1 - k;
      },
    });
  }

  function coinPop(x, y) {
    const m = add(new THREE.Mesh(coinGeo, coinMat));
    m.position.set(x, y, 0);
    let vy = 11;
    effects.push({
      mesh: m, t: 0, dur: 0.5,
      update(f, dt) {
        vy -= 32 * dt;
        m.position.y += vy * dt;
        m.rotation.y += dt * 25;
        if (f.t + dt >= f.dur) puff(x, m.position.y, 0.6, 1, 0xffe27a);
      },
    });
  }

  function collectCoin(c) {
    drop(c.mesh);
    c.taken = true;
    stats.coins++;
    sfx.coin();
    puff(c.x, c.y, 0.6, 0.9, 0xffe27a);
  }

  function flipEnemy(e) {
    e.state = 'flip';
    e.vy = 9;
    e.vx = (rand() - 0.5) * 3;
    stats.stomps++;
  }

  function hitBlock(s) {
    if (s.kind !== 'block' || s.bumpT > 0) return;
    s.bumpT = 0.18;
    if (s.type === 'q') {
      s.type = 'used';
      s.mesh.material = usedMat;
      stats.coins++;
      sfx.coin();
      coinPop((s.minX + s.maxX) / 2, s.maxY + 0.3);
    } else {
      sfx.bump();
    }
    // inimigos e moedas em cima do bloco
    for (const e of enemies) {
      if (e.state === 'walk' && e.kind === 'crawler' && Math.abs(e.y - s.maxY) < 0.15 && e.x > s.minX - 0.5 && e.x < s.maxX + 0.5) flipEnemy(e);
    }
    for (const c of coins) {
      if (!c.taken && Math.abs(c.x - (s.minX + s.maxX) / 2) < 0.6 && c.y > s.maxY && c.y < s.maxY + 2) collectCoin(c);
    }
  }

  function moveEnemy(e, dt) {
    e.vy = Math.max(e.vy - ENEMY_G * dt, -20);
    const near = solidsNear(e.x - 2, e.x + 2);
    e.x += e.vx * dt;
    for (const s of near) {
      if (overlap(e.x - e.w / 2, e.x + e.w / 2, e.y, e.y + e.h, s)) {
        e.x = e.vx > 0 ? s.minX - e.w / 2 : s.maxX + e.w / 2;
        e.vx = -e.vx;
      }
    }
    e.y += e.vy * dt;
    for (const s of near) {
      if (overlap(e.x - e.w / 2, e.x + e.w / 2, e.y, e.y + e.h, s)) {
        e.y = e.vy < 0 ? s.maxY : s.minY - e.h;
        e.vy = 0;
      }
    }
  }

  // portais: redemoinho girando, runas orbitando, luz no mais próximo
  function animatePortals(time, P) {
    let nearP = null;
    for (const p of portals) {
      if (!p.mat) continue;
      const u = p.mat.uniforms;
      u.uTime.value = time;
      // o olho acompanha o jogador e pisca de vez em quando
      u.uLook.value.set(Math.max(-1, Math.min(1, (P.x - p.x) / 8)), Math.max(-1, Math.min(1, (P.y + 1 - p.top - PORTAL_CY) / 5)));
      const bl = (time + p.x * 0.37) % 4.3;
      u.uEye.value = bl < 0.18 ? Math.abs(bl - 0.09) / 0.09 : 1;
      p.runes.forEach((r, i) => {
        const a = time * 0.9 + (i * Math.PI) / 2;
        r.position.set(Math.cos(a) * 2.25, PORTAL_CY + Math.sin(a) * 2.25, 0.2);
        r.scale.setScalar(0.9 + Math.sin(time * 3 + i) * 0.15);
      });
      if (!nearP || Math.abs(p.x - P.x) < Math.abs(nearP.x - P.x)) nearP = p;
    }
    if (nearP) {
      portalLight.position.set(nearP.x, nearP.top + PORTAL_CY, PORTAL_Z + 1.3);
      // pulsa como um coração
      const beat = Math.pow(Math.max(0, Math.sin(time * 5.2)), 8) + Math.pow(Math.max(0, Math.sin(time * 5.2 - 0.9)), 8) * 0.6;
      portalLight.intensity = 14 + beat * 22;
    } else portalLight.intensity = 0;
  }

  function updateBiomeStuff(dt, time, player) {
    const P = player.P;
    // enforcados balançando; alguns abrem os olhos e se viram quando você passa
    for (const s of swingers) {
      if (s.open) {
        s.pivot.rotation.y += (0 - s.pivot.rotation.y) * Math.min(1, dt * 2);
        s.pivot.rotation.z = Math.sin(time * 0.6 + s.ph) * 0.05;
      } else {
        s.pivot.rotation.z = Math.sin(time * 0.9 + s.ph) * 0.12;
        s.pivot.rotation.y = Math.sin(time * 0.4 + s.ph) * 1.2;
        if (s.willOpen && Math.abs(P.x - s.x) < 2.5) {
          s.open = true;
          s.eyes.visible = true;
          events.push({ type: 'corpse' });
        }
      }
    }
    // fogos-fátuos
    for (const o of decor) {
      const w = o.obj.userData.wisp;
      if (!w) continue;
      o.obj.position.set(w.x + Math.sin(time * 0.5 + w.ph) * 1.2, w.y + Math.sin(time * 1.3 + w.ph) * 0.3, o.obj.position.z);
      o.obj.material.opacity = 0.6 + Math.sin(time * 4 + w.ph) * 0.3;
    }
    // armadilhas
    for (const t of traps) {
      if (!t.closed && !P.dead && Math.abs(P.x - t.x) < 0.42 && P.y < t.y + 0.25 && P.y > t.y - 0.2) {
        t.closed = true;
        sfx.trap?.();
        player.hurt(P.x + P.facing, 'trap');
        puff(t.x, t.y + 0.3, 0.6, 0.9, 0x6a1020);
        events.push({ type: 'trap' });
      }
      if (t.closed && t.k < 1) {
        t.k = Math.min(1, t.k + dt * 14);
        for (const { j, s } of t.jaws) j.rotation.x = s * (Math.PI / 2) * (1 - t.k);
      }
    }
    // tábuas podres
    for (const s of solids) {
      if (s.kind !== 'plank') continue;
      if (s.sink === 0) {
        const on = !P.dead && P.grounded && Math.abs(P.y - s.maxY) < 0.06 && P.x + P.w / 2 > s.minX && P.x - P.w / 2 < s.maxX;
        s.load = on ? s.load + dt : Math.max(0, s.load - dt * 0.5);
        s.mesh.position.y = s.maxY - 0.09 + Math.sin(time * 2 + s.minX) * 0.03 - s.load * 0.15;
        s.mesh.rotation.z = on ? Math.sin(time * 30) * 0.02 : 0;
        if (s.load > 0.9) { s.sink = 0.001; events.push({ type: 'plank' }); }
      } else {
        s.sink += dt;
        if (s.mesh.visible) {
          const dy = 1.8 * dt;
          s.minY -= dy;
          s.maxY -= dy;
          s.mesh.position.y = s.maxY - 0.09;
          s.mesh.rotation.z = Math.sin(s.sink * 8) * 0.1;
          if (s.maxY < WATER_Y - 0.6) {
            s.mesh.visible = false;
            s.minY = s.maxY = -100; // some de vez (não vira chão debaixo d'água)
            puff((s.minX + s.maxX) / 2, WATER_Y + 0.2, 0.8, 1.4, 0x4a6a60);
          }
        } else if (s.sink > 5) {
          // volta a boiar
          s.maxY = s.baseY;
          s.minY = s.baseY - 0.18;
          s.sink = 0;
          s.load = 0;
          s.mesh.visible = true;
          s.mesh.position.y = s.maxY - 0.09;
        }
      }
    }
    // frascos de óleo
    for (const f of flasks) {
      if (f.taken) continue;
      f.mesh.rotation.y = time * 2;
      f.mesh.position.y = f.y + Math.sin(time * 3 + f.x) * 0.1;
      if (!P.dead && Math.abs(f.x - P.x) < 0.7 && f.y > P.y - 0.3 && f.y < P.y + P.h + 0.4) {
        f.taken = true;
        drop(f.mesh);
        puff(f.x, f.y, 0.6, 1, 0xffa040);
        events.push({ type: 'oil' });
      }
    }
    flasks = flasks.filter((f) => !f.taken);
  }

  // jogador caiu na água: respingo
  function pitFall(x) {
    if (biome.pit !== 'water' && !inRiver(x)) return;
    puff(x, WATER_Y + 0.3, 0.8, 1.8, 0x4a6a60);
    sfx.splash?.();
  }

  /**
   * Atualiza moedas, inimigos, bandeiras e efeitos.
   * `player` expõe { P, bounce(), hurt(x), heal() }.
   */
  function update(dt, time, player, view) {
    const P = player.P;
    const px0 = P.x - P.w / 2, px1 = P.x + P.w / 2;

    // blocos batidos
    for (const s of solids) {
      if (s.bumpT > 0) {
        s.bumpT = Math.max(0, s.bumpT - dt);
        s.mesh.position.y = s.baseY + Math.sin((1 - s.bumpT / 0.18) * Math.PI) * 0.3;
      }
    }

    // moedas
    for (const c of coins) {
      if (c.taken) continue;
      c.mesh.rotation.y = time * 3 + c.x;
      if (!P.dead && Math.abs(c.x - P.x) < 0.7 && c.y > P.y - 0.3 && c.y < P.y + P.h + 0.3) collectCoin(c);
    }
    coins = coins.filter((c) => !c.taken);

    // inimigos
    for (const e of enemies) {
      if (e.state === 'walk') {
        if (!e.active) {
          if (e.x < view.right + 3) {
            e.active = true;
            events.push({ type: e.kind === 'ghost' ? 'ghost' : e.kind === 'hand' ? 'hand' : 'crawler' });
          } else continue;
        }
        e.t += dt;
        const ud = e.mesh.userData;
        if (e.kind === 'dropper') {
          // pendurada no fio, balançando; cai quando o jogador passa embaixo
          e.y = e.hangY + Math.sin(e.t * 1.4) * 0.15;
          e.mesh.rotation.z = Math.sin(e.t * 0.9) * 0.15;
          ud.animate(dt, 0.6, 0);
          if (Math.abs(P.x - e.x) < 2.2 + Math.abs(P.vx) * 0.12 && !P.dead) {
            e.kind = 'crawler';
            e.mesh.remove(e.thread);
            e.mesh.rotation.z = 0;
            e.vy = -3;
            e.vx = (Math.sign(P.x - e.x) || -1) * 2.6;
            events.push({ type: 'drop' });
          }
        } else if (e.kind === 'hand') {
          // sobe e afunda em ciclos enquanto o jogador está perto
          const near = Math.abs(P.x - e.x) < 4.5 && !P.dead;
          const want = near && e.t % 3.2 < 1.7 ? 1 : 0;
          e.rise += (want - e.rise) * Math.min(1, dt * (want ? 4 : 2.2));
          const reach = 2.6 * e.rise;
          ud.inner.position.y = -2.25 + reach;
          ud.inner.rotation.z = Math.sin(e.t * 2.3) * 0.15;
          ud.update(e.t, e.rise);
          e.h = Math.max(0, reach - 0.25);
          if (e.rise > 0.5 && !e.splashed) { e.splashed = true; puff(e.x, WATER_Y + 0.3, 0.8, 1.3, 0x4a6a60); sfx.splash?.(); }
          if (e.rise < 0.2) e.splashed = false;
        } else if (e.kind === 'ghost') {
          // persegue o jogador devagar, ondulando no ar
          const dir = Math.sign(P.x - e.x) || -1;
          e.vx += (dir * 2.3 - e.vx) * Math.min(1, dt * 1.2);
          e.x += e.vx * dt;
          const ty = Math.max(e.baseY - 1.5, Math.min(e.baseY + 1.5, P.y + 0.6));
          e.baseY += Math.sign(ty - e.baseY) * Math.min(Math.abs(ty - e.baseY), 0.7 * dt);
          e.y = e.baseY + Math.sin(e.t * 2.4) * 0.35;
          ud.body.rotation.z = Math.sin(e.t * 1.7) * 0.12;
          ud.body.scale.set(1 + Math.sin(e.t * 5) * 0.04, 1 - Math.sin(e.t * 5) * 0.04, 1);
          const ry = e.vx > 0 ? 0.55 : -0.55;
          e.mesh.rotation.y += (ry - e.mesh.rotation.y) * Math.min(1, dt * 4);
        } else {
          moveEnemy(e, dt);
          ud.animate(dt, Math.abs(e.vx), 0);
          // de perfil, levemente virada para a câmera
          const ry = e.vx > 0 ? FACE : -FACE;
          e.mesh.rotation.y += (ry - e.mesh.rotation.y) * Math.min(1, dt * 6);
          if (e.y < -15) e.dead = true;
        }

        if (!P.dead && e.h > 0.3 && overlap(px0, px1, P.y, P.y + P.h, { minX: e.x - e.w / 2, maxX: e.x + e.w / 2, minY: e.y, maxY: e.y + e.h })) {
          if (P.vy < -0.5 && P.y > e.y + e.h * 0.35) {
            e.state = 'squash';
            stats.stomps++;
            player.bounce();
            sfx.stomp();
            puff(e.x, e.y + 0.4, 0.6, 1.6, e.kind === 'ghost' ? 0xb8c8ff : 0x6a1020);
          } else {
            player.hurt(e.x, e.kind);
          }
        }
      } else if (e.state === 'squash') {
        e.deadT += dt;
        if (!e.mesh.userData.animate) {
          const k = Math.max(0.01, 1 - e.deadT / 0.35);
          e.mesh.scale.set(1 + (1 - k), k, 1);
        } else {
          // esmagada: achata e encolhe as pernas
          e.mesh.userData.animate(dt, 0, 1);
          e.mesh.scale.set(1.15, Math.max(0.35, 1 - e.deadT * 4), 1.15);
        }
        if (e.deadT > (e.mesh.userData.animate ? 0.9 : 0.4)) e.dead = true;
      } else if (e.state === 'flip') {
        e.vy -= ENEMY_G * dt;
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        e.mesh.rotation.z += dt * 10;
        e.mesh.userData.animate?.(dt, 0, 1); // aranha de barriga pra cima, pernas encolhidas
        e.mesh.position.z = 1.5;
        if (e.y < -15) e.dead = true;
      }
      e.mesh.position.x = e.x;
      e.mesh.position.y = e.y;
    }
    enemies = enemies.filter((e) => {
      if (e.dead) drop(e.mesh);
      return !e.dead;
    });

    pumpkins.update(time);
    updateBiomeStuff(dt, time, player);
    updateBridges(dt, time, player);

    animatePortals(time, P);

    // névoa rasteira se arrastando
    for (const o of decor) if (o.obj.userData.drift) o.obj.position.x += o.obj.userData.drift * dt;

    // lampiões de vigília (checkpoint: acende, recupera 1 coração e vira o ponto de volta)
    for (const c of checkpoints) {
      c.lamp.rotation.z = Math.sin(time * 1.3 + c.x) * (0.06 + c.lit * 0.1 * Math.max(0, 1 - c.lit));
      if (c.on) {
        c.lit = Math.min(1.5, c.lit + dt * 1.6);
        const k = Math.min(1, c.lit);
        const flick = 0.85 + Math.sin(time * 17 + c.x) * 0.08 + Math.sin(time * 7.1) * 0.07;
        c.flame.scale.set(1, flick * k, 1);
        c.glow.material.opacity = 0.75 * k * flick;
        // o brilho nasce grande e assenta
        c.glow.scale.setScalar(1 + Math.max(0, 1.2 - c.lit) * 1.2);
      }
      if (!c.on && P.x > c.x && !P.dead) {
        c.on = true;
        c.flame.visible = true;
        c.glassMat.color.set(0xffc070);
        c.glassMat.opacity = 0.55;
        sfx.checkpoint();
        player.heal();
        player.setSafe(c.x + 1, c.top);
        events.push({ type: 'checkpoint' });
      }
    }

    // efeitos
    for (const f of effects) {
      f.update(f, dt);
      f.t += dt;
      if (f.t >= f.dur) { if (f.mesh) drop(f.mesh); f.done = true; }
    }
    effects = effects.filter((f) => !f.done);
  }

  // remove o que ficou para trás da câmera
  function prune(leftX) {
    solids = solids.filter((s) => {
      if (s.maxX >= leftX) return true;
      s.objs.forEach(drop);
      return false;
    });
    coins = coins.filter((c) => (c.x >= leftX ? true : (drop(c.mesh), false)));
    enemies = enemies.filter((e) => (e.x >= leftX ? true : (drop(e.mesh), false)));
    decor = decor.filter((o) => (o.maxX >= leftX ? true : (drop(o.obj), false)));
    checkpoints = checkpoints.filter((c) => c.x >= leftX);
    portals = portals.filter((p) => (p.x + 4 >= leftX ? true : (dropPortal(p), false)));
    swingers = swingers.filter((s) => s.x + 3 >= leftX);
    traps = traps.filter((t) => (t.x >= leftX ? true : (drop(t.g), false)));
    flasks = flasks.filter((f) => (f.x >= leftX ? true : (drop(f.mesh), false)));
    bridges = bridges.filter((b) => b.re + 4 >= leftX);
  }

  function clearEnemiesNear(x, r) {
    for (const e of enemies) if (Math.abs(e.x - x) < r) e.dead = true;
    enemies = enemies.filter((e) => (e.dead ? (drop(e.mesh), false) : true));
  }

  // morte pela bola de fogo: aranha voa em chamas, fantasma se desfaz
  function killByPower(e, dir) {
    stats.stomps++;
    if (e.kind === 'ghost' || e.kind === 'hand') {
      sfx.vanish?.();
      e.state = 'squash';
      e.deadT = 0;
      e.mesh.visible = false;
    } else {
      if (e.thread) e.mesh.remove(e.thread);
      e.kind = 'crawler';
      e.state = 'flip';
      e.vy = 9;
      e.vx = dir * 4;
      e.burning = true;
    }
  }

  return {
    keepMaterials(v) { keepMats = v; },
    reset, warp, setTint, setBiome, spawnGhost, pitFall, portalAt, animatePortals,
    isWater: () => biome.pit === 'water' || inRiver(lastPX),
    interactAt, placePlanks, get biome() { return biome; }, generate, solidsNear, hitBlock, update, prune, clearEnemiesNear, killByPower, stats, events,
    enemies: () => enemies,
  };
}
