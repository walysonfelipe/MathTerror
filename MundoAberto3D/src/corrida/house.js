import * as THREE from 'three';
import { createWizard } from './wizard.js';
import { makeSpell, OPS, solves } from './house-math.js';

/**
 * A Casa do Mago (visão de lado, igual à trilha e ao castelo).
 *
 * 1. A coruja acorda numa casa velha e anda até o escritório.
 * 2. O Mago aparece e fala (voz gravada no Fish Audio + legenda).
 * 3. Ele abre o livro: a câmera fecha no livro, o resto desfoca e as páginas são lidas.
 * 4. Para sair é preciso criar o Feitiço da Libertação: três versos, cada um é uma conta
 *    para montar (soma, subtração, multiplicação ou divisão, sorteadas).
 * 5. Feitiço pronto: o Mago se desfaz, o selo da porta quebra e a coruja sai para a trilha.
 */

const W = 30;
const CEIL = 7;
const BACK_Z = -2.8;
const TRIGGER_X = 15.2; // passou daqui, o Mago aparece
const BOOK_X = 19.4;
const MAGE_X = 22.2;
const DOOR_X = 26.6;
// teste: index.html?casa&feitico pula a conversa e vai direto montar o feitiço
const TEST_SPELL = typeof location !== 'undefined' && location.search.includes('feitico');

// Falas do Mago. `d` = duração do áudio (public/sounds/mago/<id>.mp3); sem `d` = só legenda.
// Voz: "Vilão Temível" (Fish Audio, id 3ff33ef27093402a961bdbb739026ef7).
const FALAS = {
  intro1: { t: 'Ora, ora… uma corujinha perdida na minha casa.', d: 5.1 },
  intro2: { t: 'Ninguém entra aqui por acaso. E ninguém sai sem pagar.', d: 4.8 },
  intro3: { t: 'Chegue perto. Vou ler o que este livro guarda.', d: 4.2 },
  livro1: { t: 'Esta casa foi de um mestre dos números. Para ele, toda conta certa era um feitiço.', d: 5.8 },
  livro2: { t: 'Uma noite, ele errou uma única conta. A casa engoliu o seu nome e a sua sombra.', d: 7.7 },
  livro3: { t: 'Quem abre este livro fica preso. Só o Feitiço da Libertação abre a porta.', d: 6.0 },
  mestre: { t: 'Esse mestre sou eu. E agora o livro também é seu.', d: 4.7 },
  tarefa: { t: 'Crie o feitiço para se libertar. Monte a conta que dá o número que o livro pede.', d: 6.4 },
  certo: { t: 'Sim… a runa acendeu. Continue.', d: 4.8 },
  erro: { t: 'Errado! A casa sentiu o seu medo.', d: 4.0 },
  livre: { t: 'Não! O feitiço está completo! Fuja, antes que a casa mude de ideia!', d: 7.4 },
  derrota: { t: 'Mais um nome para as minhas páginas.', d: 2.9 },
};
const VOICE_RATE = 0.95; // um pouco mais lenta e grave
const PAGES = [
  { id: 'livro1', title: 'O Mestre dos Números', art: 'house' },
  { id: 'livro2', title: 'A Conta Errada', art: 'eye' },
  { id: 'livro3', title: 'O Livro que Prende', art: 'key' },
];
const ROMAN = ['I', 'II', 'III'];
const RIGHT_LINES = ['O livro treme. Falta pouco.', 'A casa range. Ela não quer te soltar.'];
const WRONG_LINES = ['Não… essa conta não abre porta nenhuma.', 'A casa riu de você. Tente outra vez.'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => { const x = clamp(k, 0, 1); return x * x * (3 - 2 * x); };

function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  return t;
}

// ---------- pinturas (canvas) ----------
const wallpaperTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2c2a24';
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? '#33302a' : '#262420'; g.fillRect(x, 0, 16, h); }
  // losangos desbotados
  g.strokeStyle = '#5a4a3466';
  g.lineWidth = 2;
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
    g.beginPath(); g.moveTo(x + 32, y + 8); g.lineTo(x + 52, y + 32); g.lineTo(x + 32, y + 56); g.lineTo(x + 12, y + 32); g.closePath(); g.stroke();
    g.fillStyle = '#5a4a3444'; g.beginPath(); g.arc(x + 32, y + 32, 4, 0, 7); g.fill();
  }
  // manchas de mofo e papel descascado
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 14 + Math.random() * 40;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, i % 3 ? '#0a0c0888' : '#3a2a1a66');
    gr.addColorStop(1, '#0000');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = '#00000055';
  for (let i = 0; i < 10; i++) { g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 20, 30 + Math.random() * 90); g.stroke(); }
}, 7, 2);

const planksTex = () => canvasTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 4; i++) {
    const y = i * 64;
    g.fillStyle = ['#3a281a', '#33221a', '#402c1c', '#2e1e14'][i];
    g.fillRect(0, y, w, 64);
    g.strokeStyle = '#00000044';
    for (let k = 0; k < 14; k++) { g.beginPath(); const yy = y + Math.random() * 64; g.moveTo(0, yy); g.bezierCurveTo(80, yy + 5, 170, yy - 5, w, yy + 2); g.stroke(); }
    g.fillStyle = '#0a0604'; g.fillRect(0, y, w, 3);
    const cut = (i * 97 + 40) % w; g.fillRect(cut, y, 3, 64);
    g.fillStyle = '#1a100a'; g.beginPath(); g.arc(cut + 12, y + 12, 3, 0, 7); g.arc(cut - 10, y + 50, 3, 0, 7); g.fill();
  }
}, 8, 1);

const shelfTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#0c0806'; g.fillRect(0, 0, w, h);
  const cols = ['#3a1014', '#1c2a1e', '#2a2038', '#3a2a12', '#141c2c', '#40301c', '#241414'];
  for (let r = 0; r < 4; r++) {
    let x = 4;
    while (x < w - 8) {
      const bw = 9 + Math.random() * 14, bh = 40 + Math.random() * 16;
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.fillRect(x, r * 64 + 58 - bh, bw, bh);
      g.fillStyle = '#c8a05a55'; g.fillRect(x + 2, r * 64 + 58 - bh + 8, bw - 4, 2);
      x += bw + 1 + (Math.random() < 0.12 ? 12 : 0);
    }
    g.fillStyle = '#20140c'; g.fillRect(0, r * 64 + 58, w, 6);
  }
});

const webTex = () => canvasTex(256, 256, (g, w, h) => {
  g.strokeStyle = '#d8d8e055';
  g.lineWidth = 1.2;
  for (let i = 0; i <= 7; i++) { const a = (i / 7) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * w, Math.sin(a) * h); g.stroke(); }
  for (let r = 30; r < 250; r += 30) {
    g.beginPath();
    for (let i = 0; i <= 7; i++) { const a = (i / 7) * Math.PI / 2, rr = r * (i % 2 ? 0.93 : 1); g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    g.stroke();
  }
});

const windowTex = () => canvasTex(128, 256, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a1024'); sky.addColorStop(1, '#1a2444');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8e0f0'; g.beginPath(); g.arc(86, 60, 22, 0, 7); g.fill();
  g.fillStyle = '#0a1024'; g.beginPath(); g.arc(78, 54, 20, 0, 7); g.fill();
  // galho seco
  g.strokeStyle = '#020204'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 220); g.quadraticCurveTo(50, 170, 120, 130); g.stroke();
  g.lineWidth = 2.5;
  for (const [x, y, dx, dy] of [[40, 186, 10, -50], [70, 160, 30, -30], [90, 146, -6, -40], [60, 170, -30, -20]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke(); }
});

const portraitTex = () => canvasTex(128, 160, (g, w, h) => {
  const bg = g.createRadialGradient(w / 2, 60, 6, w / 2, 80, 110);
  bg.addColorStop(0, '#3a2a1e'); bg.addColorStop(1, '#060403');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0a0808';
  g.beginPath(); g.moveTo(10, h); g.quadraticCurveTo(w / 2, 84, w - 10, h); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 40, 46); g.lineTo(w / 2 + 6, -6); g.lineTo(w / 2 + 40, 46); g.fill(); // chapéu
  g.fillRect(w / 2 - 50, 44, 100, 7);
  g.beginPath(); g.ellipse(w / 2, 74, 24, 30, 0, 0, 7); g.fill();
  g.fillStyle = '#c8ffb0';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * 10, 70, 3, 0, 7); g.fill(); }
});

const runeRingTex = () => canvasTex(512, 512, (g, w) => {
  const c = w / 2;
  g.strokeStyle = '#8aff5a'; g.fillStyle = '#8aff5a';
  g.lineWidth = 5; g.beginPath(); g.arc(c, c, 240, 0, 7); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, 196, 0, 7); g.stroke();
  g.beginPath(); g.arc(c, c, 120, 0, 7); g.stroke();
  g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const glyphs = ['+', '−', '×', '÷', 'π', '∑', '√', '∞', '=', '≠', '%', '∆'];
  glyphs.forEach((s, i) => {
    const a = (i / glyphs.length) * Math.PI * 2;
    g.save(); g.translate(c + Math.cos(a) * 218, c + Math.sin(a) * 218); g.rotate(a + Math.PI / 2); g.fillText(s, 0, 0); g.restore();
  });
  // estrela de sete pontas
  g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 7; i++) { const a = (i * 3 / 7) * Math.PI * 2 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * 196, c + Math.sin(a) * 196); }
  g.stroke();
});

const pageTex = (flip) => canvasTex(256, 320, (g, w, h) => {
  const bg = g.createLinearGradient(flip ? w : 0, 0, flip ? 0 : w, 0);
  bg.addColorStop(0, '#a89468'); bg.addColorStop(0.18, '#d8c698'); bg.addColorStop(1, '#c8b484');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a2410';
  for (let y = 40; y < h - 30; y += 17) {
    let x = 26;
    while (x < w - 30) { const l = 8 + Math.random() * 26; g.fillRect(x, y, l, 2.2); x += l + 6; }
  }
  g.font = '700 40px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#6a1410';
  g.fillText(flip ? '÷ ×' : '+ −', w / 2, 30);
});

const doorTex = () => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 51) { g.fillStyle = '#0a0604'; g.fillRect(x, 0, 3, h); g.fillStyle = '#ffffff08'; g.fillRect(x + 3, 0, 2, h); }
  g.strokeStyle = '#00000055';
  for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y + 30 + Math.random() * 60); g.stroke(); }
  g.fillStyle = '#16161a';
  for (const y of [70, 250, 430]) { g.fillRect(0, y, w, 26); g.fillStyle = '#3a3a40'; for (let x = 20; x < w; x += 44) { g.beginPath(); g.arc(x, y + 13, 5, 0, 7); g.fill(); } g.fillStyle = '#16161a'; }
});

function runeSealTex(sym, on) {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    g.strokeStyle = on ? '#fff2b0' : '#3a4a34';
    g.fillStyle = on ? '#fff2b0' : '#3a4a34';
    g.lineWidth = 6; g.beginPath(); g.arc(c, c, 54, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(c, c, 42, 0, 7); g.stroke();
    g.font = '700 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sym, c, c + 4);
  });
}

// ---------- visual das páginas (HTML) ----------
const ART = {
  house: '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M14 104V58L60 20l46 38v46z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 104V78h20v26M28 66h16v16H28zM76 66h16v16H76z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M80 37V18h10v27" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="60" cy="48" r="7" fill="currentColor"/><path d="M4 104h112" stroke="currentColor" stroke-width="3"/></svg>',
  eye: '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M8 60c16-26 34-38 52-38s36 12 52 38c-16 26-34 38-52 38S24 86 8 60z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="60" r="20" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="60" r="8" fill="currentColor"/><path d="M60 8v10M60 102v10M22 22l8 8M98 22l-8 8M22 98l8-8M98 98l-8-8" stroke="currentColor" stroke-width="2.5"/></svg>',
  key: '<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="22" y="14" width="76" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M36 14v92" stroke="currentColor" stroke-width="2.5"/><circle cx="68" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="3"/><path d="M68 62v28M68 78h10M68 88h8" stroke="currentColor" stroke-width="3"/></svg>',
};

const CSS = `
#cine-top, #cine-bot { position: fixed; left: 0; right: 0; height: 9vh; background: #000; z-index: 7; pointer-events: none; transition: transform .7s cubic-bezier(.3,.8,.3,1); }
#cine-top { top: 0; transform: translateY(-100%); } #cine-bot { bottom: 0; transform: translateY(100%); }
body.cine #cine-top, body.cine #cine-bot { transform: none; }
body.cine #hud { visibility: hidden; }
#house-white { position: fixed; inset: 0; z-index: 9; pointer-events: none; opacity: 0; background: radial-gradient(circle at 70% 45%, #fffbe6, #ffe9a0 60%, #e8b84a); }
#legenda { position: fixed; left: 50%; bottom: max(3.2vh, calc(env(safe-area-inset-bottom) + 10px)); transform: translate(-50%, 12px); z-index: 8; width: min(92vw, 860px);
  text-align: center; opacity: 0; transition: opacity .25s, transform .25s; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#legenda[hidden] { display: none; }
#legenda.show { opacity: 1; transform: translate(-50%, 0); }
#legenda .lg-who { display: inline-block; margin-bottom: 4px; padding: 0 14px; font: 700 clamp(15px, 2.3vw, 22px)/1.2 var(--font-title); letter-spacing: .12em; color: #a8ff6a; text-shadow: 0 2px 0 #000, 0 0 16px #4aff2a99; }
#legenda .lg-text { margin: 0 auto; padding: 10px 20px 11px; border-radius: 12px; font: italic clamp(17px, 2.7vw, 26px)/1.35 var(--font-text); color: #f2e8d2;
  background: linear-gradient(#0a0808e6, #050404f0); box-shadow: inset 0 0 0 1px #3a5a2a88, 0 8px 22px #000c; text-shadow: 0 2px 3px #000; min-height: 1.35em; }
#legenda .lg-next { display: block; margin-top: 5px; font: 600 clamp(10px, 1.5vw, 12px)/1 var(--font-num); letter-spacing: .16em; color: #9a8b78; text-shadow: 0 1px 2px #000; opacity: 0; transition: opacity .3s; }
#legenda.done .lg-next { opacity: 1; animation: lgBlink 1.4s ease-in-out infinite; }
@keyframes lgBlink { 50% { opacity: .35; } }
:root.touch #legenda .key-only { display: none !important; }
#legenda.top { bottom: auto; top: max(1.4vh, env(safe-area-inset-top)); z-index: 10; cursor: default; pointer-events: none; }
#legenda.top .lg-who { display: none; }
#legenda.top .lg-text { display: inline-block; padding: 6px 18px 7px; font-size: clamp(14px, min(2.2vw, 4.4vh), 21px); box-shadow: inset 0 0 0 1px #5aff2a88, 0 8px 22px #000c; }
#legenda.top .lg-text::before { content: 'O Mago: '; font: 700 .8em var(--font-num); font-style: normal; letter-spacing: .1em; color: #a8ff6a; }
#legenda.top .lg-next { display: none; }

#book-ui { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; perspective: 1600px;
  padding: max(12vh, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: radial-gradient(ellipse at center, #0000 0, #000a 62%, #000e 100%); opacity: 0; transition: opacity .5s; }
#book-ui[hidden] { display: none; }
#book-ui.open { opacity: 1; }
#book-ui .bk { --u: clamp(11px, min(2.05vw, 3.7vh), 21px); position: relative; display: grid; grid-template-columns: 1fr 1fr; width: min(96vw, 46em); font-size: var(--u);
  min-height: min(78vh, 27em); border-radius: .5em; transform: rotateX(48deg) scale(.6); transform-origin: 50% 80%; transition: transform .8s cubic-bezier(.2,.8,.25,1);
  background: #2a140c; padding: .5em; box-shadow: 0 0 0 2px #120805, 0 0 0 .3em #3a1c10, 0 1.6em 3.4em #000, 0 0 5em #6aff3a22; }
#book-ui.open .bk { transform: none; }
#book-ui .bk::after { content: ''; position: absolute; left: 50%; top: .5em; bottom: .5em; width: 2.2em; transform: translateX(-50%); pointer-events: none;
  background: linear-gradient(90deg, #0000, #3a240f55 35%, #1a0e06aa 50%, #3a240f55 65%, #0000); }
#book-ui .bk-page { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 0; padding: 1.3em 1.5em 1em; color: #2c1a0c; overflow: hidden;
  background: radial-gradient(ellipse at 30% 20%, #efe0b6, #d9c592 60%, #bfa873); box-shadow: inset 0 0 2.4em #6a441e66; }
#book-ui .bk-left { border-radius: .3em 0 0 .3em; } #book-ui .bk-right { border-radius: 0 .3em .3em 0; background: radial-gradient(ellipse at 70% 20%, #efe0b6, #d9c592 60%, #bfa873); }
#book-ui .bk-right.turn { animation: bkTurn .55s ease-out; transform-origin: 0 50%; }
@keyframes bkTurn { from { transform: rotateY(-70deg); filter: brightness(.6); } }
#book-ui h3 { margin: 0 0 .3em; font: 700 1.75em/1 var(--font-title); letter-spacing: .03em; color: #6a1410; text-align: center; }
#book-ui .bk-orn { color: #8a5a2a; font-size: .9em; letter-spacing: .5em; margin-bottom: .5em; }
#book-ui .bk-art { width: 46%; max-width: 9em; margin: auto; color: #4a2a14; opacity: .85; }
#book-ui .bk-art svg { display: block; width: 100%; }
#book-ui .bk-num { margin-top: auto; font: 600 .8em var(--font-num); letter-spacing: .2em; color: #7a5a34; }
#book-ui .bk-text { margin: auto 0; font: 1.32em/1.5 var(--font-text); text-align: left; }
#book-ui .bk-text::first-letter { float: left; margin: .04em .1em 0 0; font: 700 3em/.8 var(--font-title); color: #8a1a12; }
#book-ui .bk-text i { font-style: normal; color: #2c1a0c00; transition: color .5s; }
#book-ui .bk-text i.on { color: inherit; }
#book-ui .bk-btn { margin-top: .7em; padding: .5em 1.3em .45em; border: 1px solid #000; border-radius: .5em; cursor: pointer; font: 700 1em/1 var(--font-num); letter-spacing: .08em; color: #f2dfc0;
  background: linear-gradient(#5a1a14, #32100c 60%, #1e0906); text-shadow: 0 2px 0 #000; box-shadow: inset 0 1px 0 #ffffff26, 0 .2em 0 #120605, 0 .5em .7em #0009; transition: transform .07s, filter .15s; }
#book-ui .bk-btn:hover, #book-ui .bk-btn:focus-visible, #book-ui .bk-btn.pad-focus { filter: brightness(1.3); outline: 2px solid #ffcf7a; outline-offset: 2px; }
#book-ui .bk-btn:active { transform: translateY(.15em); }
#book-ui .bk-btn:disabled { filter: grayscale(.8) brightness(.6); cursor: default; }
#book-ui .bk-btn.plain { background: none; box-shadow: inset 0 0 0 1px #6a441e; color: #5a3a1a; text-shadow: none; }
/* ----- feitiço ----- */
#book-ui .sp-verses { list-style: none; margin: .3em 0 0; padding: 0; width: 100%; display: grid; gap: .5em; }
#book-ui .sp-verses li { display: grid; grid-template-columns: 2.1em 1fr; align-items: center; gap: .6em; padding: .45em .6em; border-radius: .4em; font: 1.02em/1.25 var(--font-text); color: #6a5234;
  box-shadow: inset 0 0 0 1px #6a441e44; }
#book-ui .sp-verses b { display: grid; place-items: center; width: 2.1em; height: 2.1em; border-radius: 50%; font: 700 .9em var(--font-num); color: #7a5a34; box-shadow: inset 0 0 0 2px #7a5a3466; }
#book-ui .sp-verses li.now { color: #2c1a0c; background: #fff6d455; box-shadow: inset 0 0 0 2px #8a1a12aa; }
#book-ui .sp-verses li.now b { color: #fff; background: #8a1a12; box-shadow: 0 0 .7em #c8301a; }
#book-ui .sp-verses li.ok { color: #1c4a14; font-style: italic; }
#book-ui .sp-verses li.ok b { color: #10300a; background: #9aff6a; box-shadow: 0 0 .8em #5aff2a; }
#book-ui .sp-verses strong { font: 700 1.05em var(--font-num); color: #8a1a12; }
#book-ui .sp-verses em { display: block; font: 700 .86em var(--font-num); font-style: normal; letter-spacing: .08em; color: #1c6a10; }
#book-ui .sp-note { margin: auto 0 0; font: italic .92em/1.3 var(--font-text); color: #7a5a34; text-align: center; }
#book-ui .sp-hearts { display: block; margin-top: .2em; font: 1.5em/1 Georgia, serif; font-style: normal; letter-spacing: .12em; color: #b01a12; text-shadow: 0 1px 0 #fff6; }
#book-ui .sp-hearts s { text-decoration: none; color: #6a441e55; text-shadow: none; }
#book-ui .sp-ask { margin: 0 0 .4em; font: 1.08em/1.3 var(--font-text); text-align: center; }
#book-ui .sp-ask b { font: 700 1.1em var(--font-num); color: #8a1a12; }
#book-ui .sp-eq { display: flex; align-items: center; justify-content: center; gap: .35em; margin: .2em 0 .7em; font: 700 2.3em/1 var(--font-num); color: #2c1a0c; }
#book-ui .sp-slot { display: grid; place-items: center; min-width: 1.75em; height: 1.55em; padding: 0 .12em; border: 0; border-radius: .16em; cursor: pointer; font: inherit; color: #f8e6c0;
  background: #1e100a; box-shadow: inset 0 .08em .2em #000, 0 0 0 2px #6a441e; }
#book-ui .sp-slot.empty { color: #6a441e; animation: lgBlink 1.2s ease-in-out infinite; }
#book-ui .sp-slot.next { box-shadow: inset 0 .08em .2em #000, 0 0 0 3px #c8301a; }
#book-ui .sp-op { color: #8a1a12; min-width: .8em; text-align: center; }
#book-ui .sp-target { color: #8a1a12; text-shadow: 0 0 .4em #ff5a2a55; }
#book-ui .sp-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5em; width: 100%; max-width: 15em; }
#book-ui .sp-tile { position: relative; padding: .42em 0 .36em; border: 1px solid #000; border-radius: .45em; cursor: pointer; font: 700 1.5em/1 var(--font-num); color: #d8ffc0;
  background: radial-gradient(circle at 35% 25%, #4a4a52, #26262c 60%, #141418); text-shadow: 0 0 .4em #5aff2a, 0 2px 0 #000;
  box-shadow: inset 0 1px 0 #ffffff30, inset 0 -.14em 0 #0008, 0 .16em 0 #08080a, 0 .4em .5em #0009; transition: transform .07s, filter .15s, opacity .15s; }
#book-ui .sp-tile small { position: absolute; left: .35em; top: .25em; font: 600 .38em var(--font-num); color: #8a8a94; text-shadow: none; }
:root.touch #book-ui .sp-tile small { display: none; }
#book-ui .sp-tile:hover, #book-ui .sp-tile:focus-visible, #book-ui .sp-tile.pad-focus { filter: brightness(1.35); outline: 2px solid #9aff6a; outline-offset: 2px; }
#book-ui .sp-tile:active { transform: translateY(.1em); }
#book-ui .sp-tile.used { opacity: .28; transform: translateY(.1em); }
#book-ui .sp-row { display: flex; gap: .6em; justify-content: center; flex-wrap: wrap; }
#book-ui .bk.bad { animation: bkShake .45s; } #book-ui .bk.bad .sp-slot { background: #5a0a08; }
#book-ui .bk.good .sp-slot { background: #1c4a14; box-shadow: 0 0 0 2px #9aff6a, 0 0 1em #5aff2a; }
@keyframes bkShake { 20% { transform: translateX(-.7em) rotate(-1deg); } 40% { transform: translateX(.7em) rotate(1deg); } 60% { transform: translateX(-.4em); } 80% { transform: translateX(.3em); } }
#book-ui .sp-chant { margin: auto 0 .2em; font: 700 1.9em/1.25 var(--font-title); color: #1c6a10; text-align: center; text-shadow: 0 0 .5em #7aff4a; animation: chant 1.6s ease-in-out infinite; }
@keyframes chant { 50% { text-shadow: 0 0 1em #7aff4a, 0 0 .2em #fff; } }
canvas.house-focus { filter: blur(7px) brightness(.55) saturate(.8); }
canvas.house-canvas { transition: filter .8s; }
`;

export function createHouse({ sfx, character, canvas, el, cb }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x060508, 12, 32);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });

  // ---------- luz ----------
  const hemi = new THREE.HemisphereLight(0x3a3a5e, 0x070506, 0.34);
  const lantern = new THREE.PointLight(0xff9a48, 24, 13, 1.6);
  const moon = new THREE.PointLight(0x6a8cff, 7, 10, 1.6);
  moon.position.set(5, 4, BACK_Z + 1.4);
  const bookLight = new THREE.PointLight(0xffd88a, 0, 6, 1.6);
  bookLight.position.set(BOOK_X, 2.5, 1.0);
  const doorLight = new THREE.PointLight(0xfff2c0, 0, 22, 1.2);
  doorLight.position.set(DOOR_X, 2.6, BACK_Z + 1.2);
  const spellLight = new THREE.PointLight(0xfff0a0, 0, 16, 1.4);
  scene.add(hemi, lantern, moon, bookLight, doorLight, spellLight);

  // ---------- estrutura ----------
  const woodMat = std({ color: 0x2a1a10, roughness: 0.8 });
  const darkWood = std({ color: 0x140c08 });
  const ironMat = std({ color: 0x2a2626, metalness: 0.7, roughness: 0.5 });
  const waxMat = std({ color: 0xd8cfae, roughness: 0.6 });
  const clothMat = std({ color: 0x4a4a48, flatShading: true });

  const add = (m) => { scene.add(m); return m; };
  function box(w, h, d, mat, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  box(W + 20, 8, 7, std({ map: planksTex(), color: 0x9a8a7a }), W / 2, -4, 0);              // chão
  box(W + 20, 24, 0.6, std({ map: wallpaperTex(), color: 0x8a8a84 }), W / 2, 4, BACK_Z - 0.3); // parede do fundo
  box(W + 20, 10, 7, darkWood, W / 2, CEIL + 5, 0);                                         // teto
  for (const x of [-0.5, W + 0.5]) box(1, 24, 7, darkWood, x, 4, 0);
  // rodapé, lambri e vigas do teto
  box(W + 2, 1.5, 0.12, woodMat, W / 2, 0.75, BACK_Z + 0.05);
  box(W + 2, 0.14, 0.2, darkWood, W / 2, 1.55, BACK_Z + 0.08);
  for (let x = 2; x < W; x += 4) box(0.35, 0.4, 6.5, darkWood, x, CEIL - 0.2, 0);
  // silhuetas na frente (profundidade): colunas e um balaústre
  const frontMat = new THREE.MeshBasicMaterial({ color: 0x020102 });
  for (const x of [1.2, 12.2, 28.6]) box(0.4, 30, 0.4, frontMat, x, 4, 4.4);

  // porta por onde se entrou (à esquerda, no fundo): fechada com tábuas
  const doorMapIn = doorTex();
  const inDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.7), std({ map: doorMapIn, color: 0x8a8078 }));
  inDoor.position.set(2.2, 1.85, BACK_Z + 0.03);
  add(inDoor);
  for (const [y, r] of [[1.2, 0.14], [2.3, -0.1], [3.1, 0.2]]) { const b = box(2.5, 0.26, 0.08, woodMat, 2.2, y, BACK_Z + 0.1); b.rotation.z = r; }

  // janela com lua e galho seco (relâmpago)
  const winMat = new THREE.MeshBasicMaterial({ map: windowTex(), color: 0x8a94b4 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), winMat);
  win.position.set(5.6, 3.6, BACK_Z + 0.03);
  add(win);
  box(1.7, 0.1, 0.12, darkWood, 5.6, 3.6, BACK_Z + 0.08);
  box(0.1, 3.0, 0.12, darkWood, 5.6, 3.6, BACK_Z + 0.08);
  for (const [dx, w] of [[-0.9, 0.5], [0.95, 0.38]]) {
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.2, 3, 6), std({ color: 0x3a0c12, side: THREE.DoubleSide, flatShading: true }));
    cur.position.set(5.6 + dx, 3.5, BACK_Z + 0.18);
    cur.geometry.attributes.position.array.forEach((_, i, a) => { if (i % 3 === 2) a[i] = Math.sin(a[i - 2] * 14) * 0.06; });
    add(cur);
  }

  // cadeira de balanço que balança sozinha
  const rocker = new THREE.Group();
  rocker.position.set(7.6, 0, -1.2);
  box(0.9, 0.08, 0.8, woodMat, 0, 0.62, 0, rocker);
  box(0.9, 1.3, 0.08, woodMat, 0, 1.3, -0.38, rocker).rotation.x = -0.14;
  for (const s of [-1, 1]) {
    box(0.07, 0.6, 0.07, woodMat, s * 0.4, 0.32, 0.3, rocker);
    box(0.07, 0.6, 0.07, woodMat, s * 0.4, 0.32, -0.3, rocker);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.04, 5, 14, 0.9), woodMat);
    rail.rotation.set(0, Math.PI / 2, 0);
    rail.rotation.z = -Math.PI / 2 - 0.45;
    rail.position.set(s * 0.4, 1.32, 0);
    rocker.add(rail);
  }
  rocker.rotation.y = 0.5;
  add(rocker);

  // relógio de pêndulo parado… até você passar
  const clock = new THREE.Group();
  clock.position.set(10.3, 0, BACK_Z + 0.45);
  box(0.95, 4.2, 0.55, darkWood, 0, 2.1, 0, clock);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0xb8ae8a }));
  face.position.set(0, 3.5, 0.29);
  const hand1 = box(0.03, 0.26, 0.02, frontMat, 0, 3.62, 0.3, clock);
  hand1.rotation.z = 0.5;
  box(0.03, 0.18, 0.02, frontMat, 0.06, 3.5, 0.3, clock).rotation.z = -1.3;
  box(0.6, 1.7, 0.02, frontMat, 0, 1.75, 0.285, clock);
  const pend = new THREE.Group();
  pend.position.set(0, 2.5, 0.3);
  box(0.03, 1.1, 0.02, ironMat, 0, -0.55, 0, pend);
  const bob = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), std({ color: 0x8a6a28, metalness: 0.8, roughness: 0.35 }));
  bob.position.y = -1.1;
  pend.add(bob);
  clock.add(face, pend);
  add(clock);

  // retratos tortos do antigo dono
  const frameMat = std({ color: 0x4a3414, metalness: 0.5, roughness: 0.5 });
  const pTex = portraitTex();
  const portraitEyes = [];
  for (const [x, y, r] of [[12.6, 4.1, 0.12], [8.4, 4.4, -0.08]]) {
    const gp = new THREE.Group();
    gp.position.set(x, y, BACK_Z + 0.06);
    gp.rotation.z = r;
    box(1.25, 1.55, 0.08, frameMat, 0, 0, 0, gp);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.35), new THREE.MeshBasicMaterial({ map: pTex, color: 0x9a9a9a }));
    pm.position.z = 0.05;
    gp.add(pm);
    add(gp);
    portraitEyes.push(pm.material);
  }

  // teias nos cantos
  const webMat = new THREE.MeshBasicMaterial({ map: webTex(), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, flip] of [[0.05, 1], [W - 0.05, -1], [14, 1]]) {
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), webMat);
    wb.position.set(x + flip * 1.3, CEIL - 1.3 - (x === 14 ? 0.4 : 0), BACK_Z + 0.12);
    wb.scale.set(flip, -1, 1);
    add(wb);
  }

  // lustre que balança
  const chand = new THREE.Group();
  chand.position.set(13.2, CEIL - 0.4, 0);
  box(0.04, 1.6, 0.04, ironMat, 0, -0.8, 0, chand);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 5, 14), ironMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.6;
  chand.add(ring);
  add(chand);

  // velas (as chamas ficam verdes quando o Mago aparece)
  const flameGeo = new THREE.ConeGeometry(0.06, 0.24, 6).translate(0, 0.12, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a });
  const candleLights = [];
  function candle(x, y, z, parent = scene, h = 0.3) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 6), waxMat);
    c.position.set(x, y + h / 2, z);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(x, y + h, z);
    parent.add(c, f);
    return f;
  }
  const flames = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; flames.push(candle(Math.cos(a) * 0.7, -1.55, Math.sin(a) * 0.7, chand, 0.22)); }
  // mesa com velas e frascos
  box(2.4, 0.12, 1.2, woodMat, 16.6, 1.0, BACK_Z + 0.9);
  for (const sx of [-1, 1]) box(0.12, 1.0, 0.12, woodMat, 16.6 + sx * 1.05, 0.5, BACK_Z + 1.3);
  for (const [dx, hh] of [[-0.8, 0.5], [-0.5, 0.3], [0.7, 0.42]]) flames.push(candle(16.6 + dx, 1.06, BACK_Z + 0.9, scene, hh));
  for (const [dx, col] of [[0.0, 0x2a6a3a], [0.3, 0x6a2a5a]]) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), std({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.85 }));
    fl.position.set(16.6 + dx, 1.2, BACK_Z + 0.95);
    add(fl);
  }
  for (const [x, y, z] of [[13.2, CEIL - 2.0, 0.2], [16.6, 2.0, BACK_Z + 1.2], [24.6, 2.6, BACK_Z + 1.0]]) {
    const l = new THREE.PointLight(0xff8a3a, 7, 9, 1.6);
    l.position.set(x, y, z);
    add(l);
    candleLights.push(l);
  }
  // castiçal alto ao lado da porta de saída
  box(0.08, 2.2, 0.08, ironMat, 24.6, 1.1, BACK_Z + 0.7);
  box(0.5, 0.06, 0.5, ironMat, 24.6, 0.03, BACK_Z + 0.7);
  flames.push(candle(24.6, 2.2, BACK_Z + 0.7, scene, 0.36));

  // estantes do escritório
  const shelfMap = shelfTex();
  for (const x of [18.1, 21.3]) {
    box(3.0, 5.4, 0.5, darkWood, x, 2.7, BACK_Z + 0.25);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.0), std({ map: shelfMap, color: 0x9a9a9a }));
    sm.position.set(x, 2.75, BACK_Z + 0.52);
    add(sm);
  }
  // caveira na estante e poltrona coberta por lençol
  const skullM = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), std({ color: 0xb8b09a, flatShading: true }));
  skullM.position.set(16.0, 1.24, BACK_Z + 0.8);
  skullM.scale.set(1, 1.1, 1.1);
  add(skullM);
  box(1.5, 0.75, 1.1, clothMat, 4.0, 0.38, -1.7);
  box(1.5, 1.2, 0.3, clothMat, 4.0, 1.3, -2.15).rotation.x = -0.12;
  for (const s of [-1, 1]) box(0.28, 0.5, 1.1, clothMat, 4.0 + s * 0.75, 0.95, -1.7);

  // círculo de runas no chão, embaixo do Mago
  const ringMat = new THREE.MeshBasicMaterial({ map: runeRingTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const runeRing = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), ringMat);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.set(MAGE_X, 0.03, 0);
  add(runeRing);

  // ---------- púlpito e livro ----------
  box(0.22, 1.25, 0.22, darkWood, BOOK_X, 0.62, 0.15);
  box(0.8, 0.08, 0.7, darkWood, BOOK_X, 0.04, 0.15);
  const deskTop = new THREE.Group();
  deskTop.position.set(BOOK_X, 1.36, 0.2);
  deskTop.rotation.x = 0.78; // tampo inclinado para a câmera
  box(1.35, 0.07, 0.95, woodMat, 0, 0, 0, deskTop);
  add(deskTop);
  const book = new THREE.Group();
  book.position.y = 0.045;
  deskTop.add(book);
  const coverMat = std({ color: 0x4a0c10, roughness: 0.6 });
  const paperMat = std({ color: 0xd8c898, roughness: 0.9 });
  box(0.56, 0.03, 0.8, coverMat, 0.28, 0.015, 0, book);          // capa de baixo (direita)
  box(0.52, 0.07, 0.74, paperMat, 0.27, 0.065, 0, book);         // folhas (direita)
  const pageR = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.74), new THREE.MeshBasicMaterial({ map: pageTex(false), color: 0x8a8a8a }));
  pageR.rotation.x = -Math.PI / 2;
  pageR.position.set(0.27, 0.102, 0);
  book.add(pageR);
  const coverPivot = new THREE.Group();                          // capa de cima + folhas da esquerda
  coverPivot.position.set(0, 0.118, 0);
  book.add(coverPivot);
  box(0.56, 0.03, 0.8, coverMat, -0.28, 0, 0, coverPivot);
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 7), std({ color: 0x8a6a28, metalness: 0.8, roughness: 0.35 }));
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(-0.28, -0.02, 0); // fica por cima quando o livro está fechado
  coverPivot.add(emblem);
  box(0.52, 0.045, 0.74, paperMat, -0.27, 0.038, 0, coverPivot);
  const pageL = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.74), new THREE.MeshBasicMaterial({ map: pageTex(true), color: 0x8a8a8a }));
  pageL.rotation.x = -Math.PI / 2;
  pageL.position.set(-0.27, 0.062, 0);
  coverPivot.add(pageL);
  let bookOpen = 0;
  const setBook = (k) => { bookOpen = k; coverPivot.rotation.z = -Math.PI * (1 - smooth(k)) - 0.06 * smooth(k); };
  setBook(0);

  // poeira mágica (sobe do livro; na hora do feitiço explode em volta da coruja)
  const N = 110;
  const mPos = new Float32Array(N * 3), mVel = new Float32Array(N * 3), mLife = new Float32Array(N);
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const motesMat = new THREE.PointsMaterial({ color: 0xbaff7a, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const motes = new THREE.Points(motesGeo, motesMat);
  motes.frustumCulled = false;
  add(motes);
  let motesFrom = { x: BOOK_X, y: 1.6, z: 0.4, spread: 0.5, up: 0.7 };
  function spawnMote(i) {
    const s = motesFrom;
    mPos[i * 3] = s.x + (Math.random() - 0.5) * s.spread;
    mPos[i * 3 + 1] = s.y + Math.random() * 0.2;
    mPos[i * 3 + 2] = s.z + (Math.random() - 0.5) * s.spread;
    const a = Math.random() * Math.PI * 2, r = s.burst ?? 0.15;
    mVel[i * 3] = Math.cos(a) * r * Math.random();
    mVel[i * 3 + 1] = s.up * (0.4 + Math.random());
    mVel[i * 3 + 2] = Math.sin(a) * r * Math.random();
    mLife[i] = 1 + Math.random() * 2.2;
  }
  for (let i = 0; i < N; i++) { spawnMote(i); mLife[i] = Math.random() * 3; }

  // ---------- Mago ----------
  const wizard = createWizard();
  wizard.group.position.set(MAGE_X, 0, -0.3);
  wizard.group.rotation.y = -0.62;
  wizard.group.visible = false;
  add(wizard.group);

  // ---------- porta de saída, selada com três runas ----------
  const exitGroup = new THREE.Group();
  exitGroup.position.set(DOOR_X, 0, BACK_Z);
  box(2.9, 4.5, 0.2, darkWood, 0, 2.25, 0.02, exitGroup);
  const lightPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.0), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
  lightPlane.position.set(0, 2.0, 0.13);
  lightPlane.visible = false;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-1.15, 0, 0.16);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.0, 0.1), std({ map: doorTex(), color: 0xa09488 }));
  doorMesh.position.set(1.15, 2.0, 0);
  doorPivot.add(doorMesh);
  const seals = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    m.position.set(1.15, 3.15 - i * 1.05, 0.07);
    doorPivot.add(m);
    seals.push(m);
  }
  exitGroup.add(lightPlane, doorPivot);
  add(exitGroup);
  const sealTex = {}; // textura de cada runa (acesa / apagada), criada uma vez só
  for (const k of Object.keys(OPS)) sealTex[k] = { off: runeSealTex(OPS[k].sym, false), on: runeSealTex(OPS[k].sym, true) };
  function setSeal(i, op, on) {
    const m = seals[i].material;
    m.map = sealTex[op][on ? 'on' : 'off'];
    m.color.set(on ? 0xffffff : 0x9aa890);
    m.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.needsUpdate = true;
  }

  const solids = [
    { minX: -10, maxX: W + 10, minY: -10, maxY: 0, kind: 'plank' },
    { minX: -10, maxX: W + 10, minY: CEIL, maxY: CEIL + 10, kind: 'house' },
    { minX: -10, maxX: 0, minY: 0, maxY: CEIL, kind: 'house' },
    { minX: W, maxX: W + 10, minY: 0, maxY: CEIL, kind: 'house' },
  ];

  // ---------- HTML: faixas de cinema, legenda e livro ----------
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const mk = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.append(d); return d; };
  mk('cine-top'); mk('cine-bot');
  const white = mk('house-white');
  const legenda = mk('legenda', '<span class="lg-who">O Mago</span><p class="lg-text"></p><span class="lg-next"><span class="key-only">E · ESPAÇO</span><span class="pad-only">A</span><span class="touch-only">TOQUE</span> PARA CONTINUAR</span>');
  legenda.hidden = true;
  const lgText = legenda.querySelector('.lg-text');
  const bookUI = mk('book-ui', '<div class="bk"><div class="bk-page bk-left"></div><div class="bk-page bk-right"></div></div>');
  bookUI.hidden = true;
  const bk = bookUI.querySelector('.bk'), pgL = bookUI.querySelector('.bk-left'), pgR = bookUI.querySelector('.bk-right');
  canvas.classList.add('house-canvas');

  // ---------- estado ----------
  let player = null, level = 0, running = false;
  let phase = 'off', pt = 0;       // fase da cena e tempo dentro dela
  let shot = 'walk', shake = 0;
  let step = 0;                    // fala / página atual
  let speech = null;               // { id, text, t, dur, audio, shown }
  let advance = false, lastNext = 0;
  let spell = [], verse = 0, pick = [], lockUI = 0, wrongs = 0, rights = 0;
  let magePower = 0, mageScale = 0, mageRage = 0, magePoint = 0;
  let green = 0;                   // 0 = velas quentes, 1 = velas verdes
  let lightning = 0, nextLightning = 4, scareDone = {};
  let whiteK = 0;
  const camPos = new THREE.Vector3(3, 3.2, 13), camAt = new THREE.Vector3(3, 1.9, 0);
  const wantPos = new THREE.Vector3(), wantAt = new THREE.Vector3();
  const warm = new THREE.Color(0xff8a3a), cold = new THREE.Color(0x5aff4a), tmpC = new THREE.Color();

  const busy = () => phase !== 'walk' && phase !== 'off';

  // ---------- voz + legenda ----------
  function stopVoice() {
    const a = speech?.audio;
    if (a) { try { a.pause(); } catch {} }
  }
  function say(id, text, { legend = true } = {}) {
    stopVoice();
    const f = FALAS[id];
    const t = text ?? f.t;
    let audio = null, dur = Math.max(2.2, t.length * 0.062);
    if (f?.d) {
      audio = sfx.playClip(`mago/${id}`, 1, { rate: VOICE_RATE });
      dur = f.d / VOICE_RATE;
    } else sfx.playClip('sussurros', 0.16, { maxDur: 2 });
    speech = { id, text: t, t: 0, dur, audio, shown: -1, legend };
    if (legend) {
      legenda.classList.toggle('top', phase === 'spell' || phase === 'chant'); // com o livro aberto, a fala vai para cima dele
      lgText.textContent = '';
      legenda.hidden = false;
      legenda.classList.remove('done');
      requestAnimationFrame(() => legenda.classList.add('show'));
    }
    return speech;
  }
  function hideLegend() {
    legenda.classList.remove('show', 'done');
    legenda.hidden = true;
  }
  const speaking = () => !!speech && speech.t < speech.dur;
  function updateSpeech(dt) {
    if (!speech) return;
    speech.t += dt;
    if (!speech.legend) return;
    // as letras aparecem junto com a voz (um pouco à frente, para dar tempo de ler)
    const n = Math.min(speech.text.length, Math.ceil((speech.t / (speech.dur * 0.8)) * speech.text.length));
    if (n !== speech.shown) { speech.shown = n; lgText.textContent = speech.text.slice(0, n); }
    legenda.classList.toggle('done', speech.t > speech.dur * 0.8);
  }
  // pulou a fala: mostra o texto todo; já estava todo na tela: segue adiante
  function skipOrNext() {
    if (!speech) return true;
    if (speech.legend && speech.shown < speech.text.length) { speech.t = Math.max(speech.t, speech.dur * 0.8); return false; }
    return true;
  }

  // ---------- livro (HTML) ----------
  function openBookUI() {
    bookUI.hidden = false;
    canvas.classList.add('house-focus');
    requestAnimationFrame(() => requestAnimationFrame(() => bookUI.classList.add('open')));
  }
  function closeBookUI() {
    bookUI.classList.remove('open');
    canvas.classList.remove('house-focus');
    setTimeout(() => { if (!bookUI.classList.contains('open')) bookUI.hidden = true; }, 520);
  }
  function turnPage() {
    pgR.classList.remove('turn');
    void pgR.offsetWidth;
    pgR.classList.add('turn');
    sfx.playClip('papel', 0.4);
  }
  const nextBtn = (label) => `<button class="bk-btn" id="book-next">${label}</button>`;

  function showPage(i) {
    const p = PAGES[i];
    const words = FALAS[p.id].t.split(' ');
    pgL.innerHTML = `<h3>${p.title}</h3><div class="bk-orn">✦ ✠ ✦</div><div class="bk-art">${ART[p.art]}</div><div class="bk-num">${ROMAN[i]} · III</div>`;
    pgR.innerHTML = `<p class="bk-text">${words.map((w) => `<i>${w}</i>`).join(' ')}</p>${nextBtn(i < PAGES.length - 1 ? 'Virar a página ▸' : 'Fechar o livro ▸')}`;
    turnPage();
    say(p.id, null, { legend: false });
    speech.words = [...pgR.querySelectorAll('.bk-text i')];
  }
  // a tinta aparece palavra por palavra, acompanhando a voz
  function updateReading() {
    if (!speech?.words) return;
    const n = Math.ceil(clamp(speech.t / (speech.dur * 0.9), 0, 1) * speech.words.length);
    speech.words.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  function verseLine(v, i) {
    const op = OPS[v.op];
    if (i < verse) return `<li class="ok"><b>${ROMAN[i]}</b><span><strong>${v.done[0]} ${op.sym} ${v.done[1]} = ${v.target}</strong><em>${op.word}!</em></span></li>`;
    if (i === verse) return `<li class="now"><b>${ROMAN[i]}</b><span>${op.article[0].toUpperCase() + op.article.slice(1)} que dê <strong>${v.target}</strong></span></li>`;
    return `<li><b>${ROMAN[i]}</b><span>· · ·</span></li>`;
  }
  const hearts = () => '♥'.repeat(Math.max(0, player.P.hearts)) + '<s>♥</s>'.repeat(Math.max(0, 3 - player.P.hearts));
  function renderSpell() {
    const v = spell[verse], op = OPS[v.op];
    pgL.innerHTML = `<h3>Feitiço da Libertação</h3><div class="bk-orn">✦ ✠ ✦</div><ul class="sp-verses">${spell.map(verseLine).join('')}</ul>` +
      `<p class="sp-note">Cada conta certa acende uma runa da porta.<br>Cada erro custa um coração. <span class="sp-hearts">${hearts()}</span></p>`;
    pgR.innerHTML = `<p class="sp-ask">Verso ${ROMAN[verse]}: monte <b>${op.article}</b> que dê <b>${v.target}</b></p>` +
      `<div class="sp-eq"><button class="sp-slot" data-s="0"></button><span class="sp-op">${op.sym}</span><button class="sp-slot" data-s="1"></button><span>=</span><span class="sp-target">${v.target}</span></div>` +
      `<div class="sp-tiles">${v.tiles.map((n, i) => `<button class="sp-tile" data-t="${i}"><small>${i + 1}</small>${n}</button>`).join('')}</div>` +
      '<div class="sp-row"><button class="bk-btn plain" id="sp-clear">Apagar</button><button class="bk-btn" id="sp-cast">Conjurar ✦</button></div>';
    pick = [null, null];
    syncSpell();
  }
  function syncSpell() {
    const v = spell[verse];
    const nextSlot = pick.indexOf(null);
    pgR.querySelectorAll('.sp-slot').forEach((s, i) => {
      s.textContent = pick[i] === null ? '?' : v.tiles[pick[i]];
      s.classList.toggle('empty', pick[i] === null);
      s.classList.toggle('next', i === nextSlot);
    });
    pgR.querySelectorAll('.sp-tile').forEach((t, i) => t.classList.toggle('used', pick.includes(i)));
    const cast = pgR.querySelector('#sp-cast');
    if (cast) cast.disabled = nextSlot !== -1;
  }
  function chooseTile(i) {
    if (phase !== 'spell' || lockUI > 0 || !spell[verse]?.tiles[i]) return;
    const at = pick.indexOf(i);
    if (at !== -1) pick[at] = null;          // tocar de novo devolve a runa
    else {
      const slot = pick.indexOf(null);
      if (slot === -1) return;
      pick[slot] = i;
    }
    sfx.gatePlace();
    syncSpell();
  }
  function clearPick(slot) {
    if (phase !== 'spell' || lockUI > 0) return;
    if (slot === undefined) pick = [null, null]; else pick[slot] = null;
    sfx.playClip('papel', 0.2);
    syncSpell();
  }
  function flash(cls) {
    bk.classList.remove('good', 'bad');
    void bk.offsetWidth;
    bk.classList.add(cls);
  }
  function conjure() {
    if (phase !== 'spell' || lockUI > 0 || pick.includes(null)) return;
    const v = spell[verse];
    const a = v.tiles[pick[0]], b = v.tiles[pick[1]];
    if (solves(v, a, b)) {
      v.done = [a, b];
      flash('good');
      sfx.gateOk();
      sfx.playClip('luta-spell', 0.5);
      sfx.playClip('sino', 0.4);
      setSeal(verse, v.op, true);
      doorLight.intensity = 6 * (verse + 1);
      shake = 0.25;
      cb.rumble?.(0.5, 250);
      verse++;
      lockUI = 1.5;
      if (verse < spell.length) {
        if (rights++ === 0) say('certo'); else say('ok', RIGHT_LINES[(rights - 2) % RIGHT_LINES.length]);
        setTimeout(() => { if (phase === 'spell') { bk.classList.remove('good'); renderSpell(); turnPage(); } }, 1300);
      } else {
        hideLegend();
        setTimeout(() => { if (phase === 'spell') showChant(); }, 1100);
      }
    } else {
      flash('bad');
      sfx.gateBad();
      sfx.playClip('rosnado', 0.5);
      el.blood.style.opacity = '0.85';
      shake = 0.6;
      mageRage = 1;
      cb.rumble?.(0.9, 350);
      const P = player.P;
      P.hearts--;
      const hs = pgL.querySelector('.sp-hearts');
      if (hs) hs.innerHTML = hearts();
      lockUI = 1.1;
      if (P.hearts <= 0) { setPhase('lose'); return; }
      if (wrongs++ === 0) say('erro'); else say('no', WRONG_LINES[(wrongs - 2) % WRONG_LINES.length]);
      setTimeout(() => { if (phase === 'spell') { bk.classList.remove('bad'); pick = [null, null]; syncSpell(); } }, 750);
    }
  }
  function showChant() {
    phase = 'chant';
    bk.classList.remove('good');
    pgL.innerHTML = `<h3>Feitiço da Libertação</h3><div class="bk-orn">✦ ✠ ✦</div><ul class="sp-verses">${spell.map((v, i) => verseLine(v, i)).join('')}</ul>` +
      '<p class="sp-note">As três runas estão acesas.</p>';
    pgR.innerHTML = `<p class="sp-ask">Diga em voz alta e a porta se abre:</p><p class="sp-chant">${spell.map((v) => OPS[v.op].word).join(' · ')}<br>Liberta!</p>${nextBtn('Lançar o feitiço ✦')}`;
    turnPage();
    sfx.playClip('revelacao', 0.35, { maxDur: 3 });
  }

  // cliques e teclas do livro
  bookUI.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'book-next') advance = true;
    else if (t.id === 'sp-cast') conjure();
    else if (t.id === 'sp-clear') clearPick();
    else if (t.dataset.t !== undefined) chooseTile(Number(t.dataset.t));
    else if (t.dataset.s !== undefined) clearPick(Number(t.dataset.s));
    t.blur(); // senão o Espaço/Enter apertaria o botão de novo
  });
  legenda.addEventListener('click', () => { advance = true; });
  canvas.addEventListener('pointerdown', () => { if (running && (phase === 'talk' || phase === 'talk2')) advance = true; });
  addEventListener('keydown', (e) => {
    if (!running || phase !== 'spell') return;
    if (/^(Digit|Numpad)[1-6]$/.test(e.code)) chooseTile(Number(e.code.slice(-1)) - 1);
    else if (e.code === 'Backspace' || e.code === 'KeyQ') { e.preventDefault(); clearPick(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); conjure(); }
  });

  // ---------- fases ----------
  function setPhase(p) {
    phase = p;
    pt = 0;
    step = 0;
    advance = false;
    const cine = p !== 'walk' && p !== 'off';
    document.body.classList.toggle('cine', cine && p !== 'spell' && p !== 'chant' && p !== 'read');
    cb.onCine?.(cine);
    if (p === 'appear') {
      const P = player.P;
      P.vx = 0;
      P.facing = 1;
      shot = 'two';
      wizard.group.visible = true;
      sfx.thunder(0.7);
      sfx.playClip('aparicao', 0.6);
      sfx.playClip('tensao', 0.45);
      sfx.ambience(0.12, 900);
      lightning = 0.5;
      shake = 0.7;
      cb.rumble?.(0.8, 600);
      character.play('look_around', { fade: 0.2, restart: true, lock: 2 });
    } else if (p === 'talk') {
      say('intro1');
    } else if (p === 'toBook') {
      hideLegend();
      shot = 'book';
      sfx.playClip('porta-rangendo', 0.3);
      sfx.playClip('papel', 0.5);
    } else if (p === 'read') {
      openBookUI();
      showPage(0);
    } else if (p === 'talk2') {
      closeBookUI();
      shot = 'low';
      say('mestre');
    } else if (p === 'spell') {
      hideLegend();
      shot = 'spell';
      verse = 0; wrongs = 0; rights = 0; lockUI = 0.4;
      spell = makeSpell(level);
      spell.forEach((v, i) => setSeal(i, v.op, false));
      renderSpell();
      openBookUI();
      turnPage();
      const v = spell[0];
      say('verso', `Primeiro verso: ${OPS[v.op].article} que dê ${v.target}.`);
    } else if (p === 'cast') {
      stopVoice();
      hideLegend();
      closeBookUI();
      shot = 'wide';
      character.play('cast_a_spell', { fade: 0.2, restart: true, lock: 3.2 });
      sfx.cast();
      sfx.playClip('luta-spell', 0.7);
      const P = player.P;
      motesFrom = { x: P.x + 0.6, y: P.y + 1.4, z: 0.3, spread: 0.4, up: 2.4, burst: 4.5 };
      for (let i = 0; i < N; i++) spawnMote(i);
      motesMat.color.set(0xfff0a0);
      motesMat.size = 0.14;
    } else if (p === 'lose') {
      closeBookUI();
      shot = 'face';
      say('derrota');
      sfx.playClip('tensao', 0.5);
    }
  }

  function updatePhase(dt, time, input) {
    const P = player.P;
    pt += dt;
    // "seguir adiante": E, pulo, fogo/Enter, botão do livro, toque na tela
    const used = input.consumeUse(), jumped = busy() && input.consumeJump(), fired = input.consumeFire();
    input.consumeLook(); input.consumeBack();
    let go = false;
    if (busy() && (advance || used || jumped || fired)) {
      const now = performance.now();
      if (now - lastNext > 260) { lastNext = now; go = true; }
    }
    advance = false;

    switch (phase) {
      case 'walk': {
        // sustos pelo caminho
        if (P.x > 5 && !scareDone.chair) { scareDone.chair = true; sfx.creak(); sfx.playClip('porta-rangendo', 0.25); }
        if (P.x > 9 && !scareDone.clock) { scareDone.clock = time; sfx.playClip('sino', 0.3, { rate: 0.6 }); sfx.playClip('sussurros', 0.35); cb.toast('O relógio voltou a andar…', 'No fim do corredor, alguém vira uma página.', 3); }
        if (TEST_SPELL && pt > 0.3) { P.x = TRIGGER_X; green = magePower = mageScale = 1; wizard.group.visible = true; setBook(1); setPhase('spell'); break; }
        if (P.x > TRIGGER_X && P.grounded && !P.dead) setPhase('appear');
        break;
      }
      case 'appear':
        green = Math.min(1, pt / 0.8);
        mageScale = smooth(pt / 1.6);
        magePower = smooth((pt - 0.3) / 1.4);
        if (pt > 2.3) setPhase('talk');
        break;
      case 'talk': {
        const order = ['intro1', 'intro2', 'intro3'];
        shot = step === 0 ? 'two' : 'face';
        magePoint = step === 2 ? 1 : 0;
        if (go && skipOrNext()) {
          if (++step >= order.length) setPhase('toBook'); else say(order[step]);
        } else if (speech && speech.t > speech.dur + 1.6) advance = true; // ninguém apertou nada: segue sozinho
        break;
      }
      case 'toBook':
        magePoint = 1;
        setBook(clamp((pt - 0.5) / 1.2, 0, 1));
        if (pt > 2.2) setPhase('read');
        break;
      case 'read':
        magePoint = 0.4;
        updateReading();
        if (go) {
          if (++step >= PAGES.length) { stopVoice(); setPhase('talk2'); } else showPage(step);
        }
        break;
      case 'talk2':
        magePoint = 0;
        shot = step === 0 ? 'low' : 'two';
        if (go && skipOrNext()) {
          if (++step >= 2) setPhase('spell'); else say('tarefa');
        } else if (speech && speech.t > speech.dur + 1.6) advance = true;
        break;
      case 'spell':
        lockUI -= dt;
        // a legenda some sozinha depois da fala
        if (speech?.legend && speech.t > speech.dur + 1.2 && !legenda.hidden) hideLegend();
        break;
      case 'chant':
        if (go) setPhase('cast');
        break;
      case 'cast': {
        if (pt > 1.1 && step === 0) { step = 1; say('livre'); sfx.boom?.(0.6); shake = 1; cb.rumble?.(1, 700); mageRage = 1; }
        if (pt > 1.1) mageRage = Math.max(mageRage, 0.8);
        // o Mago se desfaz em fumaça verde
        if (pt > 5.2 && step === 1) {
          step = 2;
          sfx.vanish();
          sfx.playClip('sumico', 0.5);
          motesFrom = { x: MAGE_X, y: 1.2, z: 0, spread: 1.2, up: 2.2, burst: 3 };
          for (let i = 0; i < N; i++) spawnMote(i);
          motesMat.color.set(0x9aff5a);
        }
        if (pt > 5.2) { mageScale = 1 - smooth((pt - 5.2) / 1.1); magePower = mageScale; green = mageScale; }
        // a porta se abre e a luz invade a sala
        if (pt > 6.3 && step === 2) { step = 3; shot = 'door'; hideLegend(); wizard.group.visible = false; lightPlane.visible = true; sfx.playClip('porta-rangendo', 0.6); sfx.playClip('revelacao', 0.5, { maxDur: 4 }); }
        if (pt > 6.3) {
          const k = smooth((pt - 6.3) / 1.3);
          doorPivot.rotation.y = -k * 1.9;
          doorLight.intensity = 18 + k * 60;
          whiteK = smooth((pt - 7.3) / 1.4);
        }
        if (pt > 9) { stop(); cb.onExit(); }
        break;
      }
      case 'lose':
        mageRage = 1;
        el.fade.style.opacity = String(smooth((pt - 1.6) / 1.6));
        if (pt > 3.4) { hideLegend(); phase = 'off'; cb.onLose(); }
        break;
    }
  }

  // ---------- API ----------
  function start(lv, pl) {
    level = lv;
    player = pl;
    running = true;
    scene.add(character.root);
    character.root.visible = true;
    character.root.scale.setScalar(1);
    wizard.group.visible = false;
    magePower = mageScale = mageRage = magePoint = green = 0;
    whiteK = 0; shake = 0; lightning = 0; nextLightning = 5; scareDone = {};
    speech = null;
    setBook(0);
    doorPivot.rotation.y = 0;
    lightPlane.visible = false;
    doorLight.intensity = 0;
    spellLight.intensity = 0;
    motesFrom = { x: BOOK_X, y: 1.6, z: 0.4, spread: 0.5, up: 0.7 };
    motesMat.color.set(0xbaff7a);
    motesMat.size = 0.09;
    seals.forEach((_, i) => setSeal(i, 'soma', false));
    for (const m of seals) m.visible = false;
    camPos.set(3, 3.2, 13); camAt.set(3, 1.9, 0);
    hideLegend();
    bookUI.hidden = true;
    bookUI.classList.remove('open');
    bk.classList.remove('good', 'bad');
    setPhase('walk');
    shot = 'walk';
    sfx.playClip('porta-batendo', 0.7);
    sfx.thunder(0.4);
  }

  function stop() {
    const was = running;
    running = false;
    whiteK = 0; // senão o clarão da porta seria reaplicado no mesmo quadro e ficaria na tela
    phase = 'off';
    stopVoice();
    speech = null;
    hideLegend();
    bookUI.hidden = true;
    bookUI.classList.remove('open');
    canvas.classList.remove('house-focus');
    document.body.classList.remove('cine');
    white.style.transition = 'opacity 1.4s'; // a luz da porta some devagar, já lá fora
    white.style.opacity = '0';
    if (was) cb.onCine?.(false);
  }

  function update(dt, time, input) {
    const P = player.P;
    updatePhase(dt, time, input);
    updateSpeech(dt);

    // Mago
    mageRage = Math.max(0, mageRage - dt * 0.6);
    if (wizard.group.visible) {
      wizard.group.scale.set(0.3 + 0.7 * mageScale, mageScale, 0.3 + 0.7 * mageScale);
      wizard.group.rotation.y = -0.62 + (phase === 'cast' && pt > 5.2 ? (pt - 5.2) * 6 : 0);
      wizard.update(dt, time, { talking: speaking(), point: magePoint, rage: mageRage, power: magePower });
    }
    for (const m of seals) m.visible = phase === 'spell' || phase === 'chant' || phase === 'cast';
    ringMat.opacity = magePower * (0.55 + Math.sin(time * 3) * 0.15);
    runeRing.rotation.z = time * 0.25;

    // velas: do fogo quente para o verde
    tmpC.copy(warm).lerp(cold, green);
    flameMat.color.copy(tmpC);
    candleLights.forEach((l, i) => { l.color.copy(tmpC); l.intensity = (6 - green * 2.5) * (0.82 + Math.sin(time * (11 + i * 2.3)) * 0.1 + Math.sin(time * 23 + i) * 0.08); });
    for (let i = 0; i < flames.length; i++) flames[i].scale.set(1, 0.85 + Math.sin(time * (13 + i * 1.7)) * 0.25, 1);

    // lanterna da coruja
    lantern.position.set(P.x + P.facing * 0.4, P.y + 1.4, 1.4);
    lantern.intensity = 24 * (0.9 + Math.sin(time * 13) * 0.04 + Math.sin(time * 7.3) * 0.06);

    // casa viva: cadeira, pêndulo, lustre
    rocker.rotation.z = Math.sin(time * 1.5) * (scareDone.chair ? 0.14 : 0.03);
    pend.rotation.z = scareDone.clock ? Math.sin(time * 3.1) * 0.3 : 0.12;
    if (scareDone.clock) hand1.rotation.z = 0.5 - (time - scareDone.clock) * 2.4;
    chand.rotation.z = Math.sin(time * 0.8) * (0.04 + green * 0.08);

    // livro: luz e poeira mágica
    const glow = phase === 'cast' ? 1 : bookOpen;
    bookLight.intensity = bookOpen * (7 + Math.sin(time * 5) * 1.2);
    motesMat.opacity += ((glow > 0.2 ? 0.9 : 0) - motesMat.opacity) * Math.min(1, dt * 3);
    for (let i = 0; i < N; i++) {
      mLife[i] -= dt;
      if (mLife[i] <= 0) { if (phase === 'cast') { mPos[i * 3 + 1] = -50; continue; } spawnMote(i); }
      mVel[i * 3] *= 1 - dt * 1.2; mVel[i * 3 + 2] *= 1 - dt * 1.2;
      mPos[i * 3] += (mVel[i * 3] + Math.sin(time * 2 + i) * 0.12) * dt;
      mPos[i * 3 + 1] += mVel[i * 3 + 1] * dt;
      mPos[i * 3 + 2] += mVel[i * 3 + 2] * dt;
    }
    motesGeo.attributes.position.needsUpdate = true;

    // clarão do feitiço em volta da coruja
    if (phase === 'cast') {
      spellLight.position.set(P.x + 0.6, P.y + 1.6, 1.2);
      spellLight.intensity = 60 * smooth(pt / 0.6) * (1 - smooth((pt - 2.5) / 3));
    } else spellLight.intensity = 0;
    if (whiteK > 0) { white.style.transition = 'none'; white.style.opacity = whiteK.toFixed(3); }

    // relâmpago na janela (os olhos dos retratos acendem junto)
    nextLightning -= dt;
    if (nextLightning <= 0 && phase === 'walk') { lightning = 0.5; nextLightning = 7 + Math.random() * 9; setTimeout(() => running && sfx.thunder(0.5), 300 + Math.random() * 600); }
    let f = 0;
    if (lightning > 0) { lightning -= dt; f = lightning > 0.35 || (lightning > 0.15 && lightning < 0.25) ? 1 : 0; }
    hemi.intensity = 0.34 + green * 0.14 + f * 2.4;
    moon.intensity = 7 + f * 40;
    winMat.color.setHex(f ? 0xffffff : 0x8a94b4);
    for (const m of portraitEyes) m.color.setHex(f || green > 0.5 ? 0xffffff : 0x9a9a9a);
    shake = Math.max(0, shake - dt * 1.4);
  }

  function placeCamera(dt, camera, time) {
    const P = player.P;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    let k = 3;
    if (shot === 'walk') {
      const hw = 13 * tanH;
      const x = hw * 2 >= W ? W / 2 : clamp(P.x + P.facing * 1.5, hw - 1, W - hw + 1);
      const y = 3.2 + Math.max(0, P.y - 1.5) * 0.4;
      wantPos.set(x, y, 13); wantAt.set(x, y - 1.3, 0);
      k = 4;
    } else if (shot === 'two') {
      // os dois na tela: a distância se ajusta ao formato da tela
      const mid = (P.x + MAGE_X) / 2 + 0.4, half = (MAGE_X - P.x) / 2 + 2.2;
      const z = clamp(half / tanH, 6.5, 14);
      wantPos.set(mid, 2.7, z); wantAt.set(mid, 1.95, 0);
    } else if (shot === 'face') {
      wantPos.set(MAGE_X - 1.75 + Math.sin(time * 0.4) * 0.15, 2.95, 3.5); wantAt.set(MAGE_X - 0.12, 2.98, -0.1);
    } else if (shot === 'low') {
      wantPos.set(MAGE_X - 1.6, 1.7, 3.3); wantAt.set(MAGE_X - 0.1, 2.85, -0.1);
    } else if (shot === 'book') {
      wantPos.set(BOOK_X, 2.75, 2.25); wantAt.set(BOOK_X, 1.5, 0.3);
      k = 1.8;
    } else if (shot === 'spell') {
      wantPos.set(BOOK_X + 0.6 + Math.sin(time * 0.25) * 0.7, 2.9, 5.2); wantAt.set(BOOK_X + 1.2, 2.2, 0);
      k = 1.5;
    } else if (shot === 'wide') {
      const mid = (P.x + MAGE_X) / 2 + 1, z = clamp(((MAGE_X - P.x) / 2 + 3.2) / tanH, 8, 15);
      wantPos.set(mid, 3.2, z); wantAt.set(mid, 2.3, 0);
      k = 2.2;
    } else if (shot === 'door') {
      wantPos.set(DOOR_X - 1.2, 2.7, 8.5); wantAt.set(DOOR_X, 2.2, BACK_Z);
      k = 1.6;
    }
    camPos.lerp(wantPos, Math.min(1, dt * k));
    camAt.lerp(wantAt, Math.min(1, dt * k));
    camera.position.set(camPos.x + (Math.random() - 0.5) * shake * 0.3, camPos.y + (Math.random() - 0.5) * shake * 0.3, camPos.z);
    camera.lookAt(camAt);
  }

  function render(renderer, camera) {
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  /** a tela de carregamento desenha esta cena uma vez (tudo visível) para a GPU já conhecer as peças */
  function prewarm() {
    Object.keys(OPS).forEach((op, i) => setSeal(i % 3, op, true));
  }

  return {
    scene, start, stop, update, render, prewarm, placeCamera,
    minX: 0.2, maxX: W - 0.2,
    /** em cena (conversa, livro, feitiço): o jogador não anda */
    get busy() { return busy(); },
    get phase() { return phase; },
    // a física do jogador usa estas funções (mesma interface do mundo)
    solidsNear: (x0, x1) => solids.filter((s) => s.maxX > x0 && s.minX < x1),
    hitBlock() {},
    clearEnemiesNear() {},
    pitFall() {},
    isWater: () => false,
  };
}
