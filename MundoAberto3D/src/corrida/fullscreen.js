// Tela cheia. O navegador só deixa entrar em tela cheia a partir de um gesto do
// jogador (clique, toque ou tecla), então entramos no primeiro gesto da página
// e oferecemos um botão no canto + a tecla T para alternar depois.
const root = document.documentElement;

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const isFullscreen = () => !!fsElement();
const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);

export function enterFullscreen() {
  if (!supported || isFullscreen()) return;
  try {
    const p = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen();
    // no celular, tenta travar deitado (Android; o iPhone ignora e mostra o aviso "vire o celular")
    const lock = () => { if (document.documentElement.classList.contains('touch')) screen.orientation?.lock?.('landscape')?.catch?.(() => {}); };
    p?.then ? p.then(lock, () => {}) : lock();
  } catch { /* sem gesto válido ou bloqueado: ignora */ }
}

export function exitFullscreen() {
  if (!isFullscreen()) return;
  try { (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {}); } catch {}
}

export const toggleFullscreen = () => (isFullscreen() ? exitFullscreen() : enterFullscreen());

export function setupFullscreen() {
  if (!supported) return;

  // botão no canto
  const btn = document.createElement('button');
  btn.id = 'fs-btn';
  btn.type = 'button';
  btn.title = 'Tela cheia (T)';
  btn.setAttribute('aria-label', 'Alternar tela cheia');
  const art = 'img/trilha-sombria-controles/webp/';
  btn.innerHTML =
    `<img class="fs-in" src="${art}tela-cheia-entrar.webp" alt="" />` +
    `<img class="fs-out" src="${art}tela-cheia-sair.webp" alt="" />`;
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); btn.blur(); });
  document.body.appendChild(btn);

  const style = document.createElement('style');
  style.textContent = `
    #fs-btn { position: fixed; top: var(--fs-top, max(10px, env(safe-area-inset-top))); right: max(10px, env(safe-area-inset-right));
      z-index: 9999; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%;
      background: none; cursor: pointer; opacity: .7; transition: opacity .2s; }
    #fs-btn:hover, #fs-btn:focus-visible { opacity: 1; }
    #fs-btn img { width: 100%; height: 100%; display: block; }
    #fs-btn .fs-out, :root.is-fs #fs-btn .fs-in { display: none; }
    :root.is-fs #fs-btn .fs-out { display: block; }
    :root.is-fs #fs-btn { opacity: .4; }
    :root.is-fs #fs-btn:hover { opacity: 1; }
    /* app instalado (PWA): já abre em tela cheia */
    @media (display-mode: fullscreen), (display-mode: standalone) { #fs-btn { display: none; } }
  `;
  document.head.appendChild(style);

  // fica no canto de cima à direita; com o HUD do jogo na tela, desce para logo abaixo
  // do bloco da direita (distância/recorde) para não ficar por cima dele
  let lastTop = '';
  const place = () => {
    const hud = document.getElementById('hud');
    const right = hud && !hud.hidden && hud.querySelector('.right');
    const r = right && right.getBoundingClientRect();
    const top = r && r.height ? `${Math.round(r.bottom + 10)}px` : '';
    if (top !== lastTop) {
      lastTop = top;
      if (top) btn.style.setProperty('--fs-top', top);
      else btn.style.removeProperty('--fs-top');
    }
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);

  const sync = () => root.classList.toggle('is-fs', isFullscreen());
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  // primeiro gesto do jogador → tela cheia
  const first = (e) => {
    if (!e.isTrusted) return; // teclas sintéticas do controle não valem como gesto: espera um real
    if (e.target !== btn && e.code !== 'KeyT') enterFullscreen(); // o botão e o T já alternam sozinhos
    removeEventListener('pointerdown', first, true);
    removeEventListener('keydown', first, true);
  };
  addEventListener('pointerdown', first, true);
  addEventListener('keydown', first, true);

  // T alterna a qualquer momento
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
  });
}
