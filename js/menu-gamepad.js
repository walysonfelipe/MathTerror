// Navegação do menu inicial pelo controle: D-pad ou analógico escolhe entre
// som, tela cheia e o botão de início; A confirma.
import { getConnectedGamepads } from './gamepad-status.js';

const AXIS_DEADZONE = 0.45;
const NAV_REPEAT_DELAY = 320;
const NAV_REPEAT_INTERVAL = 150;
const BUTTON_A = 0;

const menuButtons = ['soundBtn', 'fullscreenBtn', 'runnerBtn'].map(id => document.getElementById(id)).filter(Boolean);
const defaultButton = document.getElementById('runnerBtn');

let selected = null;
let previousA = new Set();
let previousDirection = 0;
let nextDirectionAt = 0;

function isVisible(element) {
  return element && !element.hidden && element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden';
}

// Avisos (girar o celular, instalar no iPhone) ficam por cima do menu:
// enquanto aparecem, o controle navega nos botões deles.
function getNavigableButtons() {
  const dialog = [...document.querySelectorAll('.rotate-screen, .modal-backdrop')].find(isVisible);
  if (dialog) return [...dialog.querySelectorAll('button')].filter(isVisible);
  return menuButtons.filter(isVisible);
}

function isMenuActive() {
  const { classList } = document.body;
  return !classList.contains('in-game') && !classList.contains('is-loading');
}

function select(button) {
  if (selected === button) return;
  selected?.classList.remove('is-gamepad-selected');
  selected = button;
  if (!button) return;
  button.classList.add('is-gamepad-selected');
  button.focus({ preventScroll: true });
}

function readDirection(pad) {
  const buttons = pad.buttons || [];
  const pressed = index => Boolean(buttons[index]?.pressed || buttons[index]?.value >= 0.5);
  if (pressed(14)) return -1;
  if (pressed(15)) return 1;
  if (pressed(12)) return -2;
  if (pressed(13)) return 2;

  const x = pad.axes?.[0] || 0;
  const y = pad.axes?.[1] || 0;
  if (Math.abs(x) > AXIS_DEADZONE && Math.abs(x) >= Math.abs(y)) return x < 0 ? -1 : 1;
  if (Math.abs(y) > AXIS_DEADZONE) return y < 0 ? -2 : 2;
  return 0;
}

// Escolhe o botão mais próximo na direção pedida (±1 horizontal, ±2 vertical).
function move(direction, buttons) {
  const from = selected.getBoundingClientRect();
  const horizontal = Math.abs(direction) === 1;
  const sign = Math.sign(direction);
  const target = buttons
    .filter(button => button !== selected)
    .map(button => {
      const rect = button.getBoundingClientRect();
      const dx = (rect.left + rect.right - from.left - from.right) / 2;
      const dy = (rect.top + rect.bottom - from.top - from.bottom) / 2;
      const primary = (horizontal ? dx : dy) * sign;
      const perpendicular = Math.abs(horizontal ? dy : dx);
      return { button, primary, score: primary + perpendicular * 2 };
    })
    .filter(candidate => candidate.primary > 1)
    .sort((a, b) => a.score - b.score)[0];
  if (target) select(target.button);
}

function poll(now) {
  requestAnimationFrame(poll);
  const pads = getConnectedGamepads();
  const buttons = isMenuActive() && pads.length ? getNavigableButtons() : [];

  const pressedA = new Set();
  let direction = 0;
  for (const pad of pads) {
    const a = pad.buttons?.[BUTTON_A];
    if (a?.pressed || a?.value >= 0.5) pressedA.add(pad.index);
    if (!direction) direction = readDirection(pad);
  }
  const newA = [...pressedA].some(index => !previousA.has(index));
  previousA = pressedA;

  if (!buttons.length) {
    select(null);
    previousDirection = 0;
    return;
  }
  if (!buttons.includes(selected)) select(buttons.includes(defaultButton) ? defaultButton : buttons[0]);

  if (!direction) {
    previousDirection = 0;
  } else if (direction !== previousDirection) {
    move(direction, buttons);
    previousDirection = direction;
    nextDirectionAt = now + NAV_REPEAT_DELAY;
  } else if (now >= nextDirectionAt) {
    move(direction, buttons);
    nextDirectionAt = now + NAV_REPEAT_INTERVAL;
  }

  if (newA) selected.click();
}

requestAnimationFrame(poll);
