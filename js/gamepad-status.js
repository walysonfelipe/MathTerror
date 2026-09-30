const status = document.getElementById('gamepadStatus');
const sideStatus = document.getElementById('gamepadSideStatus');
const screenReaderStatus = status?.querySelector('.gamepad-status-sr');
const connectedPads = new Map();
const CONNECTING_MS = 1100;
const STATUS_TOAST_MS = 2000;

let connectingTimer;
let statusTimer;
// No carregamento, a API ainda pode ocultar controles até o primeiro input.
// Começamos em desconectado sem exibir esse estado como se fosse confirmado.
let lastConnectedState = false;

export function getConnectedGamepads() {
  const padsByIndex = new Map(
    [...connectedPads.values()].filter(pad => pad?.connected).map(pad => [pad.index, pad]),
  );
  if (!navigator.getGamepads) return [...padsByIndex.values()];
  try {
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected) padsByIndex.set(pad.index, pad);
    }
    return [...padsByIndex.values()];
  } catch {
    return [...padsByIndex.values()];
  }
}

function showCenterStatus(connected) {
  status.classList.toggle('is-connected', connected);
  status.classList.toggle('is-disconnected', !connected);
  status.setAttribute('aria-label', `Controle ${connected ? 'conectado' : 'desconectado'}`);
  if (screenReaderStatus) {
    screenReaderStatus.textContent = `Controle ${connected ? 'conectado' : 'desconectado'}`;
  }
  status.hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.hidden = true; }, STATUS_TOAST_MS);
}

function renderStatus({ newlyConnected = false } = {}) {
  if (!status || !sideStatus) return;

  const connected = connectedPads.size > 0;
  if (connected !== lastConnectedState) showCenterStatus(connected);
  lastConnectedState = connected;

  if (!connected) {
    clearTimeout(connectingTimer);
    sideStatus.hidden = true;
    sideStatus.classList.remove('is-connecting', 'is-connected');
    return;
  }

  sideStatus.hidden = false;
  if (newlyConnected) {
    clearTimeout(connectingTimer);
    sideStatus.classList.remove('is-connected');
    sideStatus.classList.add('is-connecting');
    connectingTimer = setTimeout(() => {
      sideStatus.classList.remove('is-connecting');
      sideStatus.classList.add('is-connected');
    }, CONNECTING_MS);
  } else if (!sideStatus.classList.contains('is-connecting')) {
    sideStatus.classList.remove('is-connecting');
    sideStatus.classList.add('is-connected');
  }
}

function syncConnectedPads(announceNew = false) {
  const currentPads = getConnectedGamepads();

  const hasNewPad = currentPads.some(pad => !connectedPads.has(pad.index));
  currentPads.forEach(pad => connectedPads.set(pad.index, pad));
  renderStatus({ newlyConnected: announceNew && hasNewPad });
}

window.addEventListener('gamepadconnected', event => {
  connectedPads.set(event.gamepad.index, event.gamepad);
  renderStatus({ newlyConnected: true });
});

window.addEventListener('gamepaddisconnected', event => {
  connectedPads.delete(event.gamepad.index);
  syncConnectedPads();
});

// Alguns navegadores só expõem controles já conectados depois que a pessoa
// aperta um botão, move um analógico ou volta para a aba do jogo.
window.addEventListener('pointerdown', () => syncConnectedPads(true), { passive: true });
window.addEventListener('keydown', () => syncConnectedPads(true));
window.addEventListener('focus', () => syncConnectedPads(true));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncConnectedPads(true);
});

renderStatus();
syncConnectedPads(true);
