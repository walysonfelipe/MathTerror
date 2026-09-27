// ===================== CELULAR DEITADO =====================
// O jogo foi pensado para paisagem. No celular:
// - no primeiro toque entra em tela cheia e trava em paisagem (Android/Chrome);
// - onde a trava não existe (iPhone), o aviso "gire o celular" cobre a tela
//   e a corrida fica pausada até o aparelho ser deitado.

const phoneQuery = window.matchMedia('(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 600px), (orientation: landscape) and (max-height: 500px)');
const portraitQuery = window.matchMedia('(pointer: coarse) and (orientation: portrait) and (max-width: 600px)');

export function isPhone() {
  return phoneQuery.matches;
}

// Enquanto estiver em pé o jogo não deve correr.
export function needsRotation() {
  return portraitQuery.matches;
}

// Celular aberto pelo ícone da Tela de Início: já roda sem as barras do navegador.
// Só vale para celular: no desktop display-mode também casa com F11/app instalado,
// e lá o botão de tela cheia tem que continuar aparecendo.
export function isStandalone() {
  if (navigator.standalone === true) return true;   // iPhone
  return isPhone() && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
}

function canFullscreen() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

// iPhone no Safari: sem tela cheia para páginas, o caminho é a Tela de Início.
function needsInstallHint() {
  return isPhone() && !canFullscreen() && !isStandalone();
}

const INSTALL_HINT_KEY = 'mathterror:install-hint-seen';

export function showInstallHint() {
  const modal = document.getElementById('installModal');
  if (!modal) return;
  modal.hidden = false;
  setTimeout(() => document.getElementById('installDismissBtn')?.focus({ preventScroll: true }), 0);
}

// Mostra a dica sozinha só na primeira visita; depois fica no botão de tela cheia.
export function maybeShowInstallHint() {
  if (!needsInstallHint()) return;
  try {
    if (localStorage.getItem(INSTALL_HINT_KEY)) return;
    localStorage.setItem(INSTALL_HINT_KEY, '1');
  } catch { }
  showInstallHint();
}

export function lockLandscape() {
  if (!isPhone()) return;
  screen.orientation?.lock?.('landscape').catch(() => { });
}

async function enterFullscreenLandscape() {
  const el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch { }
  }
  lockLandscape();
}

export function initOrientation() {
  const sync = () => document.body.classList.toggle('needs-rotation', needsRotation());
  sync();
  portraitQuery.addEventListener?.('change', sync);

  // Tela cheia exige um gesto do usuário: usa o primeiro toque na página.
  document.addEventListener('click', () => {
    if (isPhone()) enterFullscreenLandscape();
  }, { capture: true, once: true });

  document.body.classList.toggle('is-standalone', isStandalone());

  // iPhone não tem tela cheia para páginas: os botões explicam a Tela de Início.
  const rotateBtn = document.getElementById('rotateBtn');
  if (rotateBtn && isStandalone()) rotateBtn.hidden = true;
  rotateBtn?.addEventListener('click', () => {
    if (needsInstallHint()) showInstallHint();
    else enterFullscreenLandscape();
  });
  document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
    if (needsInstallHint()) showInstallHint();
  });
  document.getElementById('installDismissBtn')?.addEventListener('click', () => {
    document.getElementById('installModal').hidden = true;
  });
}
