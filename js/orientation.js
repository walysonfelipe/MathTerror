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

  // iPhone não tem tela cheia para páginas: fica só o aviso para girar.
  const rotateBtn = document.getElementById('rotateBtn');
  const el = document.documentElement;
  if (rotateBtn) rotateBtn.hidden = !(el.requestFullscreen || el.webkitRequestFullscreen);
  rotateBtn?.addEventListener('click', enterFullscreenLandscape);
}
