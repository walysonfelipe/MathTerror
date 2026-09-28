// ===================== PROVIDER DE ÁUDIO =====================
// Um único lugar liga, desliga e toca todos os sons do jogo.
// - Efeitos curtos usam Web Audio: depois de destravado por um toque, tocam a
//   qualquer momento (inclusive do loop do jogo no Safari/iPhone) e têm volume real.
// - A trilha é longa (streaming), então segue como <audio>, iniciada dentro do gesto.
// setAudioEnabled(true) precisa ser chamado dentro de um clique/toque do jogador.

import { bgMusic } from './dom-elements.js';

const SFX = {
  jump: 'assets/audio/jump.mp3',
  door: 'assets/audio/porta.mp3',
  fall: 'assets/audio/voicebosch-falling-whistle-cartoon-180579.mp3',
  scare: 'assets/audio/susto.mp3',
  pulse: 'assets/audio/pulse.mp3',
};
const MUSIC_VOLUME = 0.7;
// Celular/tablet: mesma trilha a 96 kbps (~9,6 MB) em vez da original de 320 kbps (~32 MB).
let ctx = null;
let master = null;
let enabled = false;
const decoded = {};          // nome → AudioBuffer já pronto
const playing = new Set();   // efeitos tocando agora
const listeners = new Set();

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  // iPhone: sem isto a chave de silencioso cala o Web Audio, mas não a trilha
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { }
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = enabled ? 1 : 0;
  master.connect(ctx.destination);
  loadEffects();
  return ctx;
}

// Safari antigo só aceita decodeAudioData com callback
function decode(data) {
  return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
}

function loadEffects() {
  Object.entries(SFX).forEach(([name, url]) => {
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(decode)
      .then(buffer => { decoded[name] = buffer; })
      .catch(err => console.warn(`Som "${name}" não carregou:`, err));
  });
}

// Destrava o áudio no gesto atual (iPhone exige tocar algo dentro do toque).
function unlock() {
  const c = ensureContext();
  if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => { });
  const silent = c.createBufferSource();
  silent.buffer = c.createBuffer(1, 1, 22050);
  silent.connect(c.destination);
  silent.start(0);
}

function playMusic() {
  if (!bgMusic || document.hidden) return;
  bgMusic.volume = MUSIC_VOLUME;
  bgMusic.play().catch(err => console.warn('A trilha de fundo não pôde ser iniciada:', err));
}

export function isAudioEnabled() {
  return enabled;
}

export function setAudioEnabled(on) {
  enabled = !!on;
  if (enabled) {
    unlock();
    playMusic();
  } else {
    bgMusic?.pause();
    stopAllEffects();
  }
  if (master) master.gain.value = enabled ? 1 : 0;
  listeners.forEach(fn => fn(enabled));
}

// Avisa (e já chama uma vez) sempre que o som liga/desliga.
export function onAudioChange(fn) {
  listeners.add(fn);
  fn(enabled);
  return () => listeners.delete(fn);
}

// Toca um efeito. Retorna um controle { stop, setVolume, setRate, stopped } ou null.
// offset/duration em segundos; loop repete até stop().
export function playSfx(name, { volume = 1, rate = 1, offset = 0, duration, loop = false } = {}) {
  if (!enabled || !ctx || !decoded[name]) return null;
  if (ctx.state !== 'running') ctx.resume().catch(() => { });

  const source = ctx.createBufferSource();
  source.buffer = decoded[name];
  source.loop = loop;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(master);
  if (!loop && duration !== undefined) source.start(0, offset, duration);
  else source.start(0, offset);

  const handle = {
    stopped: false,
    stop() {
      if (handle.stopped) return;
      handle.stopped = true;
      playing.delete(handle);
      try { source.stop(); } catch { }
    },
    // Mudanças suaves (~50 ms) para não estalar quando o valor pula
    setVolume(v) { gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    setRate(r) { source.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.05); },
  };
  source.onended = () => { handle.stopped = true; playing.delete(handle); };
  playing.add(handle);
  return handle;
}

export function stopAllEffects() {
  [...playing].forEach(handle => handle.stop());
}

// Aba escondida/app em segundo plano: pausa a trilha e retoma na volta.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) bgMusic?.pause();
  else if (enabled) playMusic();
});

// iPhone pode "interromper" o áudio (ligação, outro app): o próximo toque retoma.
document.addEventListener('pointerdown', () => {
  if (enabled && ctx && ctx.state !== 'running') ctx.resume().catch(() => { });
}, { capture: true, passive: true });
