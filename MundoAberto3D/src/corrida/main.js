import * as THREE from 'three';
import '@fontsource/grenze-gotisch/700.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import { loadCharacter } from '../character.js';
import { makeTextures } from './textures.js';
import { createBackground } from './background.js';
import { createWorld, PIT_FLOOR } from './world.js';
import { createPlayer } from './player.js';
import { createSfx } from './sfx.js';
import { createInput } from './input.js';
import { createParticles } from './particles.js';
import { createPowers } from './powers.js';
import { createImpale } from './impale.js';
import { createGateRoom } from './gate.js';
import { BIOMES, nextBiome, startBiome } from './biomes.js';
import { createCastle } from './castle.js';
import { applyHudAssets } from '../hud-assets.js';
import { setupFullscreen } from './fullscreen.js';
import { createBootScreen, decodeImages, PRELOAD_IMAGES, PRELOAD_SOUNDS } from './preload.js';
import { loadGhost } from './lady.js';
import { warmScene, nextFrame } from './warmup.js';

// tela de carregamento: baixa tudo antes de mostrar o menu
const boot = createBootScreen();

setupFullscreen();

applyHudAssets(); // corações e moldura de pedra do MathTerror 2D

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title-screen'), over: $('over-screen'), overlay: $('overlay'),
  start: $('btn-start'), again: $('btn-again'),
  hearts: $('hearts'), coins: $('coins'), dist: $('dist'), best: $('best'),
  toast: $('toast'), power: $('power'), overStats: $('over-stats'), hud: $('hud'),
};

// ---------- renderer / cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.autoClear = false; // fundo 2D e mundo 3D em duas passadas
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const tex = makeTextures();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x241c30, 20, 75);

// Fontes (instaladas no projeto): títulos góticos, texto de livro antigo e números entalhados
const fontsReady = boot.add('Entalhando as runas…', 0.4, Promise.all([
  '700 40px "Grenze Gotisch"', '400 20px "IM Fell English"', 'italic 400 20px "IM Fell English"',
  '700 40px "Cinzel"', '600 40px "Cinzel"',
].map((f) => document.fonts.load(f))).catch(() => {}));

// o resto baixa em paralelo enquanto o personagem carrega
const charTask = boot.track('Invocando a coruja…', 7.8);
const ghostTask = boot.track('Chamando a Dama de Branco…', 3.4);
const extrasReady = Promise.all([
  loadGhost((p) => ghostTask.progress(p)).catch(() => {}).finally(() => ghostTask.done()),
  boot.fetchAll('Pintando os retratos do castelo…', PRELOAD_IMAGES, 5.5),
  boot.fetchAll('Afinando os sussurros da noite…', PRELOAD_SOUNDS, 5.6),
]);

const CAM_Z = 17;
const PITCH = -0.1;
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 400);
camera.rotation.x = PITCH;
scene.add(camera);

const bg = createBackground(scene, camera, tex, CAM_Z);

// Noite: luar frio fraco + lanterna quente que acompanha o personagem
const hemi = new THREE.HemisphereLight(0x6a6c9a, 0x1a1218, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0x9fb0ff, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -14, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const lantern = new THREE.PointLight(0xff9a48, 30, 16, 1.6);
scene.add(lantern);

// Relâmpagos
const flashEl = document.getElementById('flash');
const heatEl = document.getElementById('heat');
const bloodEl = document.getElementById('blood');
let nextLightning = 6 + Math.random() * 8;
let lightning = 0;

const sfx = createSfx();
const input = createInput();
const world = createWorld(scene, tex, sfx);
const particles = createParticles(scene);

let gateRoom = null; // sala da conta (criada depois de carregar o personagem)
const warpEl = document.getElementById('warp');
const touchEl = document.getElementById('touch');

const darkEl = document.getElementById('dark');
const oilEl = document.getElementById('oil');

// ---------- câmera lateral ----------
const cam = { x: 3, y: 4, focusY: 0 };
let halfW = 10;
function viewHalfWidth() {
  return CAM_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
}

// tamanho real da tela (no celular, ao girar, o innerWidth às vezes chega atrasado)
const viewSize = () => {
  const vv = window.visualViewport;
  return [Math.round(document.documentElement.clientWidth || vv?.width || innerWidth),
    Math.round(document.documentElement.clientHeight || vv?.height || innerHeight)];
};
let sizeW = 0, sizeH = 0;
function resize() {
  [sizeW, sizeH] = viewSize();
  renderer.setSize(sizeW, sizeH);
  camera.aspect = sizeW / sizeH;
  // telas em pé (celular): abre um pouco o campo de visão
  camera.fov = camera.aspect < 1 ? 55 : 38;
  camera.updateProjectionMatrix();
  halfW = viewHalfWidth();
  bg.resize();
  particles.resize(renderer, camera);
  gateRoom?.resize();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
window.visualViewport?.addEventListener('resize', resize);
// rede de segurança: se a tela mudou e nenhum evento avisou, corrige no próximo quadro
function checkSize() {
  const [w, h] = viewSize();
  if (w !== sizeW || h !== sizeH) resize();
  if (scrollX || scrollY) scrollTo(0, 0); // a página nunca deve ficar deslocada
}
resize();

// ---------- personagem ----------
let character, player;
try {
  character = await loadCharacter((p) => charTask.progress(p));
  charTask.done();
} catch (err) {
  boot.fail('Erro ao carregar o personagem 😢 — recarregue a página');
  throw err;
}
scene.add(character.root);
const impale = createImpale({ scene, particles, sfx });
// a física do jogador consulta o "lugar" ativo: a trilha ou o castelo
let active = world;
const place = {
  solidsNear: (a, b) => active.solidsNear(a, b),
  hitBlock: (s) => active.hitBlock(s),
  clearEnemiesNear: (x, r) => active.clearEnemiesNear(x, r),
  pitFall: (x) => active.pitFall?.(x),
  isWater: () => active.isWater?.(),
};
player = createPlayer(character, place, sfx, impale);
const powers = createPowers({ scene, world, particles, sfx, character, tex });
const fadeEl = $('fade');
const castle = createCastle({
  tex, sfx, character, stats: world.stats,
  el: {
    modal: $('cmodal'), card: $('cm-card'), title: $('cm-title'), body: $('cm-body'), close: $('cm-close'),
    prompt: $('prompt'), promptText: $('prompt-text'), keys: $('keys'), blood: bloodEl, fade: fadeEl, useBtn: $('tuse'),
  },
  cb: {
    toast: (t, s, time) => toast(t, s, time),
    onOil: () => { addOil(100); sfx.oil(); },
    onExit: () => finishCastle(),
  },
});
gateRoom = createGateRoom({
  character, sfx, tex,
  el: { root: $('gate-hud'), n: $('gate-n'), hint: $('gate-hint'), warp: warpEl, blood: bloodEl },
});
// clique na tela também lança
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 0 && state === 'play') input.fire(); });


// placas 3D inclinam de leve acompanhando o mouse
for (const wrap of [ui.overlay, $('cmodal')]) {
  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const card = [...wrap.querySelectorAll('.card')].find((c) => !c.hidden);
    if (!card) return;
    const r = card.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth, dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    card.style.setProperty('--ry', `${(dx * 10).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-dy * 8).toFixed(2)}deg`);
  });
  wrap.addEventListener('pointerleave', () => wrap.querySelectorAll('.card').forEach((c) => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }));
}

// ---------- estado do jogo ----------
let state = 'title';
let best = 0;
try { best = Number(localStorage.getItem('trilhaSombria.best')) || 0; } catch {}
ui.best.textContent = `${best} m`;

world.reset(1);
player.reset(0, 0);

let ambienceOn = false;
let portalsPassed = 0;
let enter = null;      // animação de entrada no portal
let warpFade = 0;      // clarão de saída do portal

// ---------- mundos (biomes.js) ----------
let biome = BIOMES.cemiterio;
let hemiBase = 0.5;
function applyBiome(b) {
  biome = b;
  scene.fog.color.set(b.fog);
  scene.fog.near = b.fogNear;
  scene.fog.far = b.fogFar;
  hemi.color.set(b.sky);
  hemi.groundColor.set(b.ground);
  hemiBase = b.hemi;
  hemi.intensity = hemiBase;
  sun.color.set(b.sun);
  sun.intensity = b.sunI;
  bg.setBiome(b);
  world.setBiome(b);
}

// ---------- lanterna: o óleo acaba e a escuridão fecha ----------
const OIL_DRAIN = 0.7;      // por segundo (~140 s com o tanque cheio)
let oil = 100;
let lowWarned = false;
let lampOutPlayed = false;
let ghostTimer = 6;
function addOil(v) {
  oil = Math.min(100, oil + v);
  if (oil > 30) lowWarned = false;
}
let darkKey = '';
function updateDarkness(P, view = 0) {
  const k = oil / 100;
  const v = new THREE.Vector3(P.x, P.y + 1, 0).project(camera);
  // olhando o quadro: o centro da luz vai para o meio da tela e abre um pouco
  const e = view * view * (3 - 2 * view);
  const sx = (((v.x + 1) / 2) * (1 - e) + 0.5 * e) * innerWidth, sy = (((1 - v.y) / 2) * (1 - e) + 0.5 * e) * innerHeight;
  const scale = (Math.min(innerWidth, innerHeight) / 700) * (1 + e * 0.6);
  const flick = 1 + Math.sin(time * 13) * 0.02 + Math.sin(time * 7.3) * 0.03;
  const r = (170 + 340 * Math.sqrt(k)) * scale * flick;
  const a = Math.min(0.9, (state === 'castle' ? 0.5 : biome.dark) + (1 - k) * 0.2);
  const key = `${sx | 0}|${sy | 0}|${r | 0}|${a.toFixed(2)}`;
  if (key === darkKey) return;
  darkKey = key;
  darkEl.style.background = `radial-gradient(circle ${r.toFixed(0)}px at ${sx.toFixed(0)}px ${sy.toFixed(0)}px, ` +
    `rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,${(a * 0.5).toFixed(2)}) 75%, rgba(0,0,0,${a.toFixed(2)}) 100%)`;
}
let growlCooldown = 0, whisperCooldown = 0, crowTimer = 10;

// ---------- tela de título: personagem grande, de frente, se mexendo ----------
// alterna entre poses calmas e sustos; a câmera fica perto e balança com o mouse
const TITLE_POSES = [['idle', 4], ['look_around', 0], ['idle', 3], ['cast_a_spell', 0], ['fold_arms', 5], ['cry', 0], ['wait', 4], ['wave_goodbye_02', 0]];
let titleStep = -1, titleT = 0, titleYaw = -0.45;
const titleMouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { titleMouse.x = e.clientX / innerWidth - 0.5; titleMouse.y = e.clientY / innerHeight - 0.5; });
function updateTitlePose(dt) {
  titleT -= dt;
  if (titleT <= 0) {
    titleStep = (titleStep + 1) % TITLE_POSES.length;
    const [name, secs] = TITLE_POSES[titleStep];
    const a = character.play(name, { fade: 0.5, restart: true }) ?? character.play('idle', { fade: 0.5 });
    // animações que não repetem duram o próprio clipe
    titleT = secs || Math.max(2, (a?.getClip().duration ?? 3) - 0.4);
  }
  // vira o rosto um pouco para o lado do mouse
  const target = -0.45 + titleMouse.sx * 0.5;
  titleYaw += (target - titleYaw) * Math.min(1, dt * 2);
  character.root.rotation.y = titleYaw;
}
function titleCamera(dt, P) {
  titleMouse.sx += (titleMouse.x - titleMouse.sx) * Math.min(1, dt * 2.5);
  titleMouse.sy += (titleMouse.y - titleMouse.sy) * Math.min(1, dt * 2.5);
  const portrait = camera.aspect < 1;
  // paisagem: personagem no terço direito; retrato: centralizado, embaixo do menu
  const dist = portrait ? 5.2 : 4.1;
  const halfW = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const offX = portrait ? 0 : halfW * 0.34;
  const breathe = Math.sin(time * 0.6) * 0.05;
  cam.x = P.x - offX - titleMouse.sx * 0.35;
  cam.y = P.y + (portrait ? 2.25 : 1.45) - titleMouse.sy * 0.15 + breathe;
  cam.z = dist;
  camera.position.set(cam.x, cam.y, cam.z);
}

function startGame() {
  resetPortraitView();
  sfx.unlock();
  if (!ambienceOn) { sfx.startAmbience(); ambienceOn = true; }
  sfx.ambience(1, 600);
  input.clear();
  castle.stop();
  active = world;
  castlesPassed = 0;
  castleGate = null;
  fadeOut = 0;
  fadeEl.style.opacity = 0;
  const firstBiome = startBiome(); // mundo inicial sorteado
  world.reset((Math.random() * 1e9) | 0, firstBiome);
  applyBiome(firstBiome);
  oil = 100;
  lowWarned = false;
  ghostTimer = 6;
  darkEl.hidden = false;
  portalsPassed = 0;
  enter = null;
  warpFade = 0;
  warpEl.style.opacity = 0;
  scene.add(character.root);
  character.root.scale.setScalar(1);
  player.reset(0, 0);
  powers.reset();
  impale.reset();
  particles.clear();
  Object.assign(cam, { x: 3, y: 4, focusY: 0, z: CAM_Z });
  ui.overlay.hidden = true;
  ui.title.hidden = true;
  $('help-screen').hidden = true;
  ui.over.hidden = true;
  ui.hud.hidden = false;
  touchEl.hidden = false;
  state = 'play';
  // teste: index.html?castelo (ou ?sala=masmorra…) começa direto dentro do castelo
  const qs = new URLSearchParams(location.search);
  if (qs.has('castelo') || qs.has('sala')) { castleGate = { p: { x: 0, top: 0 } }; enterCastle(); }
}

// ---------- portal ----------
function beginPortal(p) {
  promptEl.hidden = true;
  closeBridge();
  state = 'entering';
  enter = { t: 0, p, x0: player.P.x, y0: player.P.y, z0: cam.z ?? CAM_Z, cx: cam.x, cy: cam.y };
  input.clear();
  sfx.portal();
  sfx.ambience(0.3);
  sfx.playClip('aparicao', 0.45);
  sfx.playClip('sussurros', 0.4);
  character.play('fall', { fade: 0.2 });
}

function updateEntering(realDt) {
  enter.t += realDt;
  const { p } = enter;
  const k = Math.min(1, enter.t / 1.25), e = k * k * (3 - 2 * k);
  // personagem é sugado: vai para o centro do anel, encolhe e gira
  const s = 1 - 0.9 * e;
  const root = character.root;
  root.position.set(
    enter.x0 + (p.x - enter.x0) * e,
    enter.y0 + (p.top + 2.05 - 0.85 * s - enter.y0) * e,
    -0.6 * e,
  );
  root.scale.setScalar(s);
  root.rotation.y += realDt * (2 + 14 * e);
  // câmera mergulha no redemoinho
  cam.x = enter.cx + (p.x - enter.cx) * e;
  cam.y = enter.cy + (p.top + 2.05 - enter.cy) * e;
  cam.z = enter.z0 + (2.2 - enter.z0) * e * e;
  warpEl.style.opacity = String(Math.max(0, (k - 0.35) / 0.65));
  if (enter.t >= 1.3) {
    state = 'portal';
    root.scale.setScalar(1);
    ui.hud.hidden = true;
    touchEl.hidden = true;
    darkEl.hidden = true;
    gateRoom.start(portalsPassed, renderer, finishPortal);
  }
}

// ---------- castelo ----------
let castlesPassed = 0;
let castleGate = null;
let fadeOut = 0;      // tela preta sumindo
const CAM_Z_CASTLE = 13;

function beginCastle(p) {
  promptEl.hidden = true;
  closeBridge();
  state = 'castleEnter';
  castleGate = { t: 0, p, x0: player.P.x };
  input.clear();
  character.play('walk', { fade: 0.2 });
  sfx.playClip('corvo', 0.5);
  sfx.playClip('asas', 0.35);
  sfx.ambience(0.3, 1800);
}

function updateCastleEnter(realDt) {
  const g = castleGate;
  g.t += realDt;
  const k = Math.min(1, g.t / 1.6);
  // o personagem anda até o portão e entra no escuro
  const root = character.root;
  root.position.set(g.x0 + (g.p.x - g.x0) * Math.min(1, k * 2), g.p.top, -3.2 * Math.max(0, k * 1.6 - 0.6));
  root.rotation.y += ((k < 0.4 ? Math.PI / 2 : Math.PI) - root.rotation.y) * Math.min(1, realDt * 6);
  cam.x += (g.p.x - cam.x) * Math.min(1, realDt * 2);
  cam.z += (11 - cam.z) * Math.min(1, realDt * 1.5);
  fadeEl.style.opacity = String(Math.max(0, (k - 0.5) / 0.5));
  if (g.t >= 1.7) enterCastle();
}

function enterCastle() {
  state = 'castle';
  active = castle;
  character.root.rotation.set(0, 0, 0);
  player.teleport(2.5, 0);
  const sx = castle.start(castlesPassed, player) ?? 2.5;
  touchEl.hidden = false;
  Object.assign(cam, { x: sx, y: 3.2, focusY: 0, z: CAM_Z_CASTLE });
  fadeOut = 1;
  toast('O portão se fechou atrás de você…');
}

function finishCastle() {
  resetPortraitView();
  castlesPassed++;
  portalsPassed++;
  const x = Math.ceil((castleGate?.p.x ?? player.P.maxX) + 6);
  castleGate = null;
  active = world;
  const realm = nextBiome(biome.id, Math.floor(portalsPassed / 3));
  world.warp(x, (Math.random() * 1e9) | 0, realm);
  applyBiome(realm);
  addOil(100);
  scene.add(character.root);
  character.root.rotation.set(0, 0, 0);
  player.teleport(x, 0);
  player.heal();
  powers.reset();
  particles.clear();
  Object.assign(cam, { x: x + 3, y: 4, focusY: 0, z: CAM_Z });
  input.clear();
  fadeOut = 1;
  state = 'play';
  toast(realm.name);
  sfx.ambience(1);
  sfx.playClip('corvo', 0.45);
  sfx.playClip('asas', 0.4);
}

// a porta abriu e o túnel terminou: chega a um reino novo
function finishPortal() {
  portalsPassed++;
  const x = Math.ceil(enter.p.x + 4);
  enter = null;
  const realm = nextBiome(biome.id, Math.floor(portalsPassed / 3));
  world.warp(x, (Math.random() * 1e9) | 0, realm);
  applyBiome(realm);
  oil = 100;
  lowWarned = false;
  scene.add(character.root);
  character.root.scale.setScalar(1);
  character.root.rotation.set(0, 0, 0);
  player.teleport(x, 0);
  player.heal();
  powers.reset();
  impale.reset();
  particles.clear();
  Object.assign(cam, { x: x + 3, y: 4, focusY: 0, z: CAM_Z });
  input.clear();
  ui.hud.hidden = false;
  touchEl.hidden = false;
  warpFade = 1;
  darkEl.hidden = false;
  state = 'play';
  toast(realm.name);
  sfx.ambience(1);
  sfx.playClip('corvo', 0.45);
  sfx.playClip('asas', 0.4);
}
ui.start.addEventListener('click', startGame);
// menu: "Como jogar" abre a placa de ajuda por cima
const helpEl = $('help-screen');
const openHelp = (on) => { helpEl.hidden = !on; ui.title.hidden = on; if (!on) $('btn-help').focus(); else $('btn-help-close').focus(); };
$('btn-help').addEventListener('click', () => openHelp(true));
$('btn-help-close').addEventListener('click', () => openHelp(false));
addEventListener('keydown', (e) => {
  if (state !== 'title') return;
  if (!helpEl.hidden) { if (e.code === 'KeyQ' || e.code === 'Backspace') openHelp(false); return; }
  // setas sobem/descem no menu
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyS') {
    const items = [...document.querySelectorAll('#ts-menu .ts-item:not(:disabled)')];
    const i = items.indexOf(document.activeElement);
    const d = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1;
    items[(i + d + items.length) % items.length]?.focus();
    e.preventDefault();
  }
});
ui.again.addEventListener('click', startGame);
addEventListener('keydown', (e) => {
  if ((e.code === 'Enter' || e.code === 'Space') && state !== 'play' && !ui.start.disabled) {
    // na tela de título, Enter num item do menu que não é "Jogar" segue aquele item
    if (state === 'title' && (!helpEl.hidden || (document.activeElement?.classList.contains('ts-item') && document.activeElement !== ui.start))) return;
    e.preventDefault();
    if (state === 'title' || (state === 'over' && !ui.over.hidden)) startGame();
  }
});

let toastTimer = 0;
function toast(text, sub, time = 1.6) {
  ui.toast.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; ui.toast.append(s); }
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
  toastTimer = time;
}

// título da tela de fim conforme o que matou
const DEATH_TITLES = {
  crawler: 'A aranha te pegou…',
  dropper: 'A aranha te pegou…',
  ghost: 'Um fantasma te levou…',
  hand: 'A mão te arrastou…',
  trap: 'A armadilha se fechou…',
  dama: 'A Dama te encontrou…',
  spikes: 'Você caiu nos espinhos…',
  drown: 'Você se afogou…',
};
function deathTitle(P) {
  if (P.deathCause === 'ghost' && oil <= 0) return 'A escuridão te levou…';
  return DEATH_TITLES[P.deathCause] ?? 'Você caiu…';
}

function gameOver() {
  state = 'over';
  resetPortraitView();
  $('over-title').textContent = deathTitle(player.P);
  castle.stop();
  closeBridge();
  promptEl.hidden = true;
  const meters = Math.max(0, Math.floor(player.P.maxX));
  const record = meters > best;
  if (record) {
    best = meters;
    try { localStorage.setItem('trilhaSombria.best', String(best)); } catch {}
  }
  const prev = record ? meters : best;
  const pct = prev > 0 ? Math.min(100, (meters / prev) * 100) : 100;
  const ICO = {
    coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c8902a"/><circle cx="12" cy="12" r="7.5" fill="#f2c45a" stroke="#a8701a" stroke-width="1.2"/><path d="M12 7.5v9M9.5 10h5" stroke="#a8701a" stroke-width="1.6" stroke-linecap="round"/></svg>',
    skull: '<svg viewBox="0 0 24 24"><path fill="#e6d8bc" d="M12 2C6.9 2 3 5.8 3 10.6c0 2.9 1.4 5 3.5 6.2V20c0 1.1.9 2 2 2h7c1.1 0 2-.9 2-2v-3.2c2.1-1.2 3.5-3.3 3.5-6.2C21 5.8 17.1 2 12 2z"/><circle cx="8.6" cy="11.2" r="2.3" fill="#1a0c0c"/><circle cx="15.4" cy="11.2" r="2.3" fill="#1a0c0c"/><path d="M12 14l-1.3 2.4h2.6zM10 19.5v2M14 19.5v2" stroke="#1a0c0c" stroke-width="1.3" fill="#1a0c0c"/></svg>',
    portal: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="10.5" fill="#2a0a3a" stroke="#b05aff" stroke-width="2"/><ellipse cx="12" cy="12" rx="4.5" ry="6.5" fill="none" stroke="#d8a0ff" stroke-width="1.4" opacity=".8"/><circle cx="12" cy="12" r="2" fill="#fff0ff"/></svg>',
  };
  const tile = (ico, n, lbl) => `<div class="go-tile">${ICO[ico]}<b data-count="${n}">0</b><span>${lbl}</span></div>`;
  ui.overStats.innerHTML =
    `<div class="go-hero"><div class="go-dist"><span data-count="${meters}">0</span><small>M</small></div>` +
    `<div class="go-biome">${biome.name}</div>` +
    (record && meters > 0 ? '<div class="go-stamp">Novo recorde!</div>' : '') + '</div>' +
    `<div class="go-track"><div class="bar"><div class="go-fill"></div></div>` +
    `<div class="go-track-lbl"><span>Distância</span><span>Recorde <b>${best} m</b></span></div></div>` +
    `<div class="go-tiles">${tile('coin', world.stats.coins, 'Moedas')}${tile('skull', world.stats.stomps, 'Criaturas')}${tile('portal', portalsPassed, 'Portais')}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = ui.overStats.querySelector('.go-fill');
    if (fill) fill.style.width = pct + '%';
  }));
  // contagem animada dos números
  const t0 = performance.now();
  const els = [...ui.overStats.querySelectorAll('[data-count]')];
  const tick = (now) => {
    const k = Math.min(1, (now - t0 - 200) / 900);
    const e = k <= 0 ? 0 : 1 - Math.pow(1 - k, 3);
    for (const el of els) el.textContent = Math.round(+el.dataset.count * e);
    if (k < 1 && state === 'over') requestAnimationFrame(tick);
    else for (const el of els) el.textContent = el.dataset.count;
  };
  requestAnimationFrame(tick);
  ui.overlay.hidden = false;
  ui.over.hidden = false;
  ui.again.focus();
}

let lastHud = '';
// ---------- ponte quebrada: escolher tábuas que somam a medida do buraco ----------
const cm = { modal: $('cmodal'), card: $('cm-card'), title: $('cm-title'), body: $('cm-body'), close: $('cm-close') };
let bridgeUI = null; // { bridge, hole, sel:Set }
function closeBridge() {
  if (!bridgeUI) return;
  bridgeUI = null;
  cm.modal.hidden = true;
}
cm.close.addEventListener('click', closeBridge);
addEventListener('keydown', (e) => { if (bridgeUI && e.code === 'KeyQ') closeBridge(); });

function openBridge(bridge, hole) {
  bridgeUI = { bridge, hole, sel: new Set() };
  input.clear();
  promptEl.hidden = true;
  useBtn.hidden = true;
  cm.title.textContent = 'A Ponte Quebrada';
  const planks = bridge.planks.filter((p) => !p.used);
  const maxV = Math.max(...planks.map((p) => p.v), hole.size);
  cm.body.innerHTML = `
    <p class="cm-text">Falta um pedaço da ponte. Junte tábuas que somem <b>exatamente ${hole.size} m</b> para tapar o buraco.</p>
    <div class="br-gap">
      <div class="br-shore"></div>
      <div class="br-hole"><div class="br-water"></div><div class="br-fill" id="br-fill"></div><span class="br-size">${hole.size} m</span></div>
      <div class="br-shore"></div>
    </div>
    <p class="cm-text small">Tábuas na pilha (toque para colocar ou tirar):</p>
    <div class="br-planks">${planks.map((p) => `<button class="br-plank" data-i="${p.i}" style="--len:${(p.v / maxV).toFixed(3)}">${p.v} m</button>`).join('')}</div>
    <button class="btn cm-ok" id="br-ok">COLOCAR</button>`;
  cm.card.style.animation = 'none';
  void cm.card.offsetWidth;
  cm.card.style.animation = '';
  cm.modal.hidden = false;
  const fill = cm.body.querySelector('#br-fill');
  const sync = () => {
    // as tábuas escolhidas aparecem no buraco, do tamanho certo (sem mostrar a soma)
    const sum = [...bridgeUI.sel].reduce((a, i) => a + bridge.planks[i].v, 0);
    fill.innerHTML = [...bridgeUI.sel].map((i) => `<i style="width:${(bridge.planks[i].v / hole.size) * 100}%">${bridge.planks[i].v}</i>`).join('');
    fill.classList.toggle('over', sum > hole.size);
    cm.body.querySelectorAll('.br-plank').forEach((b) => b.classList.toggle('on', bridgeUI.sel.has(Number(b.dataset.i))));
  };
  cm.body.querySelectorAll('.br-plank').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.i);
    bridgeUI.sel.has(i) ? bridgeUI.sel.delete(i) : bridgeUI.sel.add(i);
    sfx.gatePlace();
    sync();
  }));
  cm.body.querySelector('#br-ok').addEventListener('click', () => {
    if (!bridgeUI.sel.size) return;
    const res = world.placePlanks(bridge, hole, [...bridgeUI.sel]);
    if (res === 'long') {
      cm.card.classList.remove('shake');
      void cm.card.offsetWidth;
      cm.card.classList.add('shake');
      sfx.wood();
      return;
    }
    closeBridge();
  });
  sync();
}

const promptEl = $('prompt'), promptText = $('prompt-text'), useBtn = $('tuse');
function updateTrailPrompt(P) {
  const it = !P.dead && !bridgeUI ? world.interactAt(P) : null;
  if (!it) { promptEl.hidden = true; useBtn.hidden = true; input.consumeUse(); return; }
  const v = new THREE.Vector3(it.x, it.y, 0).project(camera);
  promptText.textContent = it.label;
  promptEl.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
  promptEl.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
  promptEl.hidden = false;
  useBtn.hidden = false;
  if (input.consumeUse()) it.use();
}

// Os elementos dos sinais vitais são criados uma vez só e depois só trocam de classe,
// para não reiniciar as animações (chama, batimento) a cada atualização.
const heartEls = [], orbEls = [];
let shownHearts = -1;
function renderVitals(P) {
  if (!heartEls.length) {
    for (let i = 0; i < 3; i++) { const h = document.createElement('i'); h.className = 'heart'; ui.hearts.append(h); heartEls.push(h); }
    for (let i = 0; i < powers.MAX_CHARGES; i++) { const o = document.createElement('i'); o.className = 'orb'; o.append(document.createElement('b')); ui.power.append(o); orbEls.push(o); }
  }
  if (P.hearts !== shownHearts) {
    heartEls.forEach((h, i) => {
      const on = i < P.hearts, was = i < shownHearts;
      h.className = 'heart';
      if (!on) h.classList.add('off');
      if (shownHearts >= 0 && was && !on) { h.classList.remove('off'); h.classList.add('breaking'); } // racha e apaga
      if (shownHearts >= 0 && !was && on) h.classList.add('healing'); // reacende
    });
    ui.hearts.classList.toggle('low', P.hearts === 1);
    shownHearts = P.hearts;
  }
  orbEls.forEach((o, i) => {
    o.classList.toggle('on', i < powers.charges);
    o.style.setProperty('--p', i === powers.charges ? powers.rechargeProgress.toFixed(2) : '0');
  });
}

function updateHud() {
  const P = player.P;
  const meters = Math.max(0, Math.floor(P.maxX));
  const prog = Math.round(powers.rechargeProgress * 10);
  const oilK = Math.ceil(oil / 5);
  const key = `${P.hearts}|${world.stats.coins}|${meters}|${best}|${powers.charges}|${prog}|${oilK}`;
  if (key === lastHud) return;
  lastHud = key;
  renderVitals(P);
  ui.coins.textContent = world.stats.coins;
  oilEl.style.setProperty('--oil', (oil / 100).toFixed(2));
  oilEl.classList.toggle('low', oil < 25);
  ui.dist.textContent = `${meters} m`;
  ui.best.textContent = `${Math.max(best, meters)} m`;
}

// ---------- olhar o quadro de perto (galeria do castelo) ----------
// G / R3 alterna, empurrar o analógico direito entra; o analógico direito vira a cabeça.
// Sai com G, B, Esc, andando, pulando, se apanhar ou se abrir uma janela.
const lookHint = $('look-hint');
const portraitView = { k: 0, target: null, lx: 0, ly: 0 };
const _baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(PITCH, 0, 0));
const _viewQ = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _vPos = new THREE.Vector3(), _vAt = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
function updatePortraitView(dt, P) {
  const v = portraitView;
  const near = state === 'castle' && !P.dead && P.grounded ? castle.portraitAt(P) : null;
  const ask = input.consumeLook();
  const back = input.consumeBack();
  if (!v.target && ask && near) {
    v.target = near;
    v.lx = v.ly = 0;
    P.vx = 0;
    sfx.playClip?.('papel', 0.15);
  } else if (v.target && (ask === 'toggle' || back || input.left || input.right || input.jumpHeld || !near || P.invuln > 0)) {
    v.target = null;
  }
  v.k += ((v.target ? 1 : 0) - v.k) * Math.min(1, dt * (v.target ? 4.5 : 6));
  if (v.k < 0.002) v.k = 0;
  // vira a cabeça com o analógico direito (suave)
  // controle: analógico direito; teclado: posição do mouse
  const pad = document.body.classList.contains('pad');
  const wantX = v.target ? (pad ? input.look.x : input.mouse.x * 0.8) : 0;
  const wantY = v.target ? (pad ? input.look.y : input.mouse.y * 0.8) : 0;
  v.lx += (wantX - v.lx) * Math.min(1, dt * 6);
  v.ly += (wantY - v.ly) * Math.min(1, dt * 6);

  // aviso "olhar o quadro" embaixo da pintura
  const showHint = !!near && !v.target && !castle.paused;
  if (showHint) {
    const p3 = new THREE.Vector3(near.x, near.plateY - 0.55, near.z).project(camera);
    lookHint.style.left = `${((p3.x + 1) / 2) * innerWidth}px`;
    lookHint.style.top = `${((1 - p3.y) / 2) * innerHeight}px`;
  }
  lookHint.hidden = !showHint;
  $('look-exit').hidden = !(v.target && v.k > 0.6);
}
function resetPortraitView() {
  portraitView.target = null;
  portraitView.k = 0;
  camera.quaternion.copy(_baseQ);
  lookHint.hidden = true;
  $('look-exit').hidden = true;
}
// câmera: de lado (normal) → nos olhos, de frente para o quadro
function applyPortraitCamera(P) {
  const v = portraitView;
  if (!v.k) { camera.quaternion.copy(_baseQ); return; }
  const t = v.target ?? applyPortraitCamera.last;
  if (!t) return;
  applyPortraitCamera.last = t;
  const e = v.k * v.k * (3 - 2 * v.k);
  // distância para caber a moldura inteira e a placa com o número embaixo
  _vPos.set(t.x, P.y + 2.4, t.z + 4.6);
  _vAt.set(t.x + v.lx * 1.4, 3.05 - v.ly * 1.0, t.z);
  _m4.lookAt(_vPos, _vAt, _UP);
  _viewQ.setFromRotationMatrix(_m4);
  camera.position.lerp(_vPos, e);
  camera.quaternion.slerpQuaternions(_baseQ, _viewQ, e);
  // a coruja some quando a câmera chega nos olhos dela
  if (e > 0.35) character.root.visible = false;
}

function frameCastle(dt) {
  time += dt;
  const P = player.P;
  if (state === 'castle') updatePortraitView(dt, P);
  if (state === 'castle') {
    if (!castle.paused && !castle.hidden) {
      player.update(dt, input, castle.minX, time);
      if (P.x > castle.maxX - P.w / 2) { P.x = castle.maxX - P.w / 2; P.vx = 0; }
    } else input.consumeJump();
    input.consumeFire(); // sem bola de fogo dentro do castelo
    if (state === 'castle') castle.update(dt, time, input, camera);
    if (!castle.paused && !P.dead) oil = Math.max(0, oil - OIL_DRAIN * 0.6 * dt);
    if (player.deathDone()) gameOver();
    updateHud();
  }
  if (!castle.hidden) player.sync(dt, time);
  character.mixer.update(dt);

  // câmera acompanha para os dois lados, presa às paredes do castelo
  const hw = CAM_Z_CASTLE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const tx = Math.max(castle.minX + hw - 1, Math.min(castle.maxX - hw + 1, P.x + P.facing * 1.5));
  cam.x += (tx - cam.x) * Math.min(1, dt * 4);
  cam.y += (3.2 + Math.max(0, P.y - 1.5) * 0.4 - cam.y) * Math.min(1, dt * 3);
  camera.position.set(cam.x, cam.y, CAM_Z_CASTLE);
  applyPortraitCamera(P);
  if (portraitView.k > 0.05) { $('prompt').hidden = true; $('tuse').hidden = true; }
  updateDarkness(P, portraitView.k);
  const bl = parseFloat(bloodEl.style.opacity) || 0;
  if (bl > 0) bloodEl.style.opacity = String(Math.max(0, bl - dt * 0.8));
  if (fadeOut > 0) { fadeOut = Math.max(0, fadeOut - dt * 1.2); fadeEl.style.opacity = String(fadeOut); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
  renderer.clear();
  castle.render(renderer, camera);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let time = 0;

function frame() {
  checkSize();
  const realDt = Math.min(clock.getDelta(), 1 / 30);
  // passos só na trilha (o castelo é de pedra)
  {
    const P = player.P, gk = P.groundKind;
    const surface = gk === 'plank' ? 'madeira' : gk === 'block' || gk === 'pillar' || gk === 'roof' ? 'pedra'
      : biome.id === 'pantano' ? 'lama' : 'terra';
    sfx.steps(state === 'play' && P.grounded && !P.dead ? Math.abs(P.vx) : 0, realDt, surface);
  }

  // dentro do castelo: outra cena, mesma física de lado
  if (state === 'castle' || (state === 'over' && active === castle)) {
    frameCastle(realDt);
    requestAnimationFrame(frame);
    return;
  }

  // dentro da sala da conta: outra cena, primeira pessoa
  if (state === 'portal') {
    time += realDt;
    gateRoom.update(realDt);
    character.mixer.update(realDt);
    renderer.clear();
    if (state === 'portal') gateRoom.render(renderer);
    requestAnimationFrame(frame);
    return;
  }

  const dt = realDt * powers.timeScale(realDt) * impale.timeScale(realDt); // hit-stop / câmera lenta
  time += dt;
  const P = player.P;

  if (state === 'play' && bridgeUI) {
    input.consumeJump(); // janela da ponte aberta: o jogo espera
  } else if (state === 'play') {
    world.generate(cam.x + halfW + 50);
    const res = player.update(dt, input, cam.x - halfW, time);
    if (res === 'respawn') {
      cam.x = P.x + 2;
      cam.focusY = P.y;
    }
    world.update(dt, time, player, { left: cam.x - halfW, right: cam.x + halfW });
    if (input.consumeFire()) powers.trigger();
    input.consumeLook(); input.consumeBack(); // "olhar o quadro" só existe no castelo
    world.prune(cam.x - halfW - 25);
    for (const ev of world.events.splice(0)) {
      if (ev.type === 'checkpoint') { toast('Vigília acesa', '+1 ♥ · +óleo · se cair, você volta daqui', 2.4); addOil(25); }
      else if (ev.type === 'oil') { addOil(35); sfx.oil(); toast('+ Óleo'); }
      else if (ev.type === 'corpse') { sfx.playClip('respiracao', 0.6); sfx.playClip('sussurros', 0.35); }
      else if (ev.type === 'drop') sfx.drop();
      else if (ev.type === 'trap') toast('Armadilha!');
      else if (ev.type === 'plank') { sfx.creak(); sfx.playClip('porta-rangendo', 0.25); }
      else if (ev.type === 'hand' && whisperCooldown <= 0) { sfx.playClip('sussurros', 0.4); whisperCooldown = 9; }
      // ----- ponte quebrada -----
      else if (ev.type === 'bridgeNear') toast('A Ponte Quebrada');
      else if (ev.type === 'bridgeOpen') openBridge(ev.bridge, ev.hole);
      else if (ev.type === 'bridgeOk') { toast('Encaixou! +2 moedas'); sfx.wood(); sfx.coin(); }
      else if (ev.type === 'bridgeDone') { toast('A ponte está inteira! +7 moedas'); sfx.wood(); sfx.gateOk(); sfx.playClip('sino', 0.5); }
      else if (ev.type === 'bridgeShort') {
        toast('Curta demais… as tábuas caíram no rio');
        sfx.gateBad(); sfx.playClip('rosnado', 0.5);
        oil = Math.max(0, oil - 12);
        bloodEl.style.opacity = '0.7';
      }
      else if (ev.type === 'bridgeLong') { toast('Comprida demais: não encaixa'); sfx.creak(); }
      else if (ev.type === 'crawler' && growlCooldown <= 0) { sfx.playClip('rosnado', 0.35); growlCooldown = 7; }
      else if (ev.type === 'ghost' && whisperCooldown <= 0) { sfx.playClip('sussurros', 0.5); whisperCooldown = 9; }
    }
    growlCooldown -= dt;
    whisperCooldown -= dt;
    crowTimer -= dt;
    if (crowTimer <= 0) { sfx.playClip('corvo', 0.35); if (Math.random() < 0.4) sfx.playClip('asas', 0.25); crowTimer = 18 + Math.random() * 25; }
    if (!P.dead) {
      oil = Math.max(0, oil - OIL_DRAIN * dt);
      if (oil < 25 && !lowWarned) { lowWarned = true; toast('A lanterna está apagando…'); sfx.playClip('tensao', 0.45); }
      if (oil <= 0 && !lampOutPlayed) { lampOutPlayed = true; sfx.lampOut(); }
      if (oil > 0) lampOutPlayed = false;
      // no escuro total, eles vêm
      if (oil <= 0) {
        ghostTimer -= dt;
        if (ghostTimer <= 0) {
          ghostTimer = 6 + Math.random() * 3;
          world.spawnGhost(P.x + (Math.random() < 0.5 ? -7 : 9), P.y + 1.5);
          sfx.playClip('sussurros', 0.5);
        }
      }
    }
    if (player.deathDone()) gameOver();
    updateTrailPrompt(P);
    const gate = !P.dead && world.portalAt(P);
    if (gate) gate.kind === 'castelo' ? beginCastle(gate) : beginPortal(gate);
    updateHud();
  } else if (state === 'title') {
    updateTitlePose(realDt);
  }

  if (state === 'title') {
    character.root.position.set(P.x, P.y, 0);
  } else if (state === 'castleEnter') {
    updateCastleEnter(realDt);
    world.animatePortals(time, P);
  } else if (state === 'entering') {
    updateEntering(realDt);
    world.animatePortals(time, P);
  } else {
    player.sync(dt, time);
  }
  character.mixer.update(dt);
  if (state !== 'title' && state !== 'entering' && state !== 'castleEnter') powers.poseArm(dt, P);
  powers.update(dt, time, P, state === 'play');
  particles.update(dt);
  impale.update(dt);

  if (fadeOut > 0 && state === 'play') { fadeOut = Math.max(0, fadeOut - realDt * 1.2); fadeEl.style.opacity = String(fadeOut); }
  if (warpFade > 0) {
    warpFade = Math.max(0, warpFade - realDt * 1.4);
    warpEl.style.opacity = String(warpFade);
  }

  // câmera: só avança para a direita; vertical acompanha o chão
  if (state === 'title') {
    titleCamera(realDt, P);
  } else if (state === 'entering' || state === 'castleEnter') {
    camera.position.set(cam.x, cam.y, cam.z);
  } else {
  const lead = P.x + 2.5 + P.vx * 0.25;
  if (lead > cam.x) cam.x += (lead - cam.x) * Math.min(1, dt * 5);
  if (P.grounded || P.y < cam.focusY) cam.focusY = P.y;
  else if (P.y > cam.focusY + 4) cam.focusY = P.y - 4;
  const ty = Math.max(cam.focusY, P.inPit ? -8 : -1) + (P.inPit ? 3 : 4); // desce junto se morrer no buraco
  cam.y += (ty - cam.y) * Math.min(1, dt * 3);
  const sh = powers.shake;
  // morte nos espinhos: câmera se aproxima e fixa no corpo
  const zoomTo = impale.active ? 9.5 : CAM_Z;
  cam.z = (cam.z ?? CAM_Z) + (zoomTo - (cam.z ?? CAM_Z)) * Math.min(1, realDt * 2.2);
  if (impale.active) {
    cam.x += (P.x + P.facing * 0.8 - cam.x) * Math.min(1, realDt * 3);
    cam.y += (PIT_FLOOR + 1.6 - cam.y) * Math.min(1, realDt * 3);
  }
  camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z);
  }

  bg.update(cam.x, cam.y, time);
  heatEl.style.opacity = Math.min(1, powers.heat).toFixed(3);
  bloodEl.style.opacity = Math.min(1, impale.red).toFixed(3);
  sun.position.set(cam.x - 10, cam.y + 22, 16);
  sun.target.position.set(cam.x, cam.y - 4, 0);
  lantern.position.set(P.x + P.facing * 0.4, P.y + 1.4, 1.4);
  const oilK = oil / 100;
  lantern.distance = 10 + 10 * oilK;
  lantern.intensity = (14 + 26 * oilK) * (0.9 + Math.sin(time * 13) * 0.04 + Math.sin(time * 7.3) * 0.06) *
    (oil < 15 && Math.sin(time * 23) > 0.6 ? 0.4 : 1); // pisca quando está acabando
  if (state === 'play' || state === 'over') updateDarkness(P);

  // relâmpago: clarão rápido + trovão
  nextLightning -= dt;
  if (nextLightning <= 0 && state === 'play') {
    lightning = 0.5;
    nextLightning = 9 + Math.random() * 14;
    setTimeout(() => sfx.thunder(0.6), 250 + Math.random() * 700);
  }
  if (lightning > 0) {
    lightning -= dt;
    const f = lightning > 0.35 || (lightning > 0.15 && lightning < 0.25) ? 1 : 0;
    hemi.intensity = hemiBase + f * 3;
    flashEl.style.opacity = f * 0.35;
  } else {
    hemi.intensity = hemiBase;
    flashEl.style.opacity = 0;
  }

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }

  renderer.clear();
  bg.render(renderer);
  renderer.clearDepth();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- fim do carregamento: aquece a GPU com tudo que vai aparecer na partida ----------
await fontsReady; // os textos desenhados nas peças 3D usam essas fontes
await extrasReady;
{
  const biomes = Object.values(BIOMES);
  const steps = biomes.length + 4;
  let done = 0;
  const shaderTask = boot.track('Acendendo as tochas…', 3);
  const step = () => shaderTask.progress(++done / steps);
  const warmMain = () => warmScene(renderer, scene, camera, { before: (r) => bg.render(r) });
  await nextFrame();

  // retratos e logo já decodificados; clipes de som já criados e bufferizados
  shaderTask.label('Pendurando os retratos…');
  await decodeImages(PRELOAD_IMAGES);
  sfx.preloadClips(PRELOAD_SOUNDS.filter((u) => !u.includes('/passos/')).map((u) => u.split('/').pop().replace('.mp3', '')));
  step();

  // nada do que for criado aqui é descartado: os shaders ficam vivos para a partida
  world.keepMaterials(true);

  // guarda o clima do menu para devolver igualzinho depois
  const keep = {
    biome, hemiBase, fog: [scene.fog.color.clone(), scene.fog.near, scene.fog.far],
    hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity], sun: [sun.color.clone(), sun.intensity],
  };

  // cada mundo: chão, céu, decoração, criaturas, ponte, portais… gerados bem à frente
  for (const b of biomes) {
    shaderTask.label(`Erguendo ${b.name}…`);
    applyBiome(b);
    world.reset(7, b);
    world.generate(700);
    await warmMain();
    step();
  }

  // efeitos que só nascem no meio da partida: bola de fogo, explosão, runas, morte nos espinhos
  shaderTask.label('Atiçando as chamas…');
  const P = player.P;
  const cleanPowers = powers.prewarm(P);
  impale.start(P.x + 3, 1);
  for (let i = 0; i < 30; i++) {
    particles.glow({ x: P.x, y: 1, z: 0, vy: 2, color: [1, 0.6, 0.2], size: 0.3, life: 1 });
    particles.smoke({ x: P.x, y: 1, z: 0, vy: 1, color: [0.1, 0.1, 0.1], size: 0.6, life: 1 });
  }
  particles.update(0.016);
  await warmMain();
  cleanPowers();
  impale.reset();
  particles.clear();
  step();

  // castelo (salas, armadura, Dama de Branco) e a Fenda, cada um com suas luzes
  for (const [label, place] of [['Abrindo os portões do castelo…', castle], ['Rasgando a Fenda…', gateRoom]]) {
    shaderTask.label(label);
    place.prewarm();
    const s = place.scene;
    s.add(character.root); // o personagem também precisa do shader com as luzes de lá
    await warmScene(renderer, s, place.camera ?? camera);
    scene.add(character.root);
    step();
  }

  // volta a trilha do menu exatamente como estava
  applyBiome(keep.biome);
  world.reset(1);
  world.keepMaterials(false);
  player.reset(0, 0);
  hemiBase = keep.hemiBase;
  scene.fog.color.copy(keep.fog[0]); [, scene.fog.near, scene.fog.far] = keep.fog;
  hemi.color.copy(keep.hemi[0]); hemi.groundColor.copy(keep.hemi[1]); hemi.intensity = keep.hemi[2];
  sun.color.copy(keep.sun[0]); sun.intensity = keep.sun[1];
  shaderTask.done();
}
ui.start.disabled = false;
ui.title.classList.add('ready');
ui.start.innerHTML = '<span>Jogar</span>';
boot.finish().then(() => ui.start.focus());
