// Entrada de teclado e controle do modo runner.
import { getConnectedGamepads } from './gamepad-status.js';
import { updateGamepadAnswerLabels } from './runner-ui.js';

const ANSWER_BUTTONS = new Map([[2, 0], [3, 1], [1, 2], [0, 3]]); // X, Y, B, A -> opções 1, 2, 3, 4
const AXIS_DEADZONE = 0.45;
const NAV_REPEAT_DELAY = 320;
const NAV_REPEAT_INTERVAL = 150;

export function createRunnerInput({ isActive, getState, getCanvas, getPanel, getHint, getFallbackJumpHint, jump, resetGame }) {
  const previousButtons = new Map();
  let lastOptionButtons = [];
  let selectedOption = 0;
  let previousDirection = 0;
  let nextDirectionAt = 0;

  function hasConnectedGamepad() {
    return getConnectedGamepads().length > 0;
  }

  function getAnswerButtons() {
    return [...(getPanel()?.querySelectorAll('.quiz-options > button') || [])];
  }

  function getGameOverButtons() {
    return [...(getPanel()?.querySelectorAll('.game-over-actions > button') || [])];
  }

  function getSelectionButtons(state = getState()) {
    return state === 'over' ? getGameOverButtons() : getAnswerButtons();
  }

  function setOptionSelection(buttons, index, focus = false) {
    lastOptionButtons.forEach(button => button.classList.remove('is-gamepad-selected'));
    lastOptionButtons = buttons;
    selectedOption = Math.max(0, Math.min(index, buttons.length - 1));
    const button = buttons[selectedOption];
    button?.classList.add('is-gamepad-selected');
    if (focus) button?.focus({ preventScroll: true });
  }

  function clearOptionSelection() {
    lastOptionButtons.forEach(button => button.classList.remove('is-gamepad-selected'));
    lastOptionButtons = [];
    selectedOption = 0;
  }

  function moveOptionSelection(direction, buttons = getSelectionButtons()) {
    if (!buttons.length) return;
    if (buttons.some((button, index) => button !== lastOptionButtons[index]) || buttons.length !== lastOptionButtons.length) {
      setOptionSelection(buttons, 0);
    }

    const current = buttons[selectedOption];
    const currentRect = current?.getBoundingClientRect();
    const horizontal = Math.abs(direction) === 1;
    const sign = Math.sign(direction);
    const candidates = buttons
      .map((button, index) => {
        if (index === selectedOption || button.disabled) return null;
        const rect = button.getBoundingClientRect();
        const dx = (rect.left + rect.right - currentRect.left - currentRect.right) / 2;
        const dy = (rect.top + rect.bottom - currentRect.top - currentRect.bottom) / 2;
        const primary = (horizontal ? dx : dy) * sign;
        const perpendicular = Math.abs(horizontal ? dy : dx);
        return { index, primary, perpendicular, score: perpendicular / Math.max(1, primary) * 1000 + primary };
      })
      .filter(Boolean);

    let target = candidates.filter(candidate => candidate.primary > 1).sort((a, b) => a.score - b.score)[0];
    if (!target) {
      target = candidates.sort((a, b) => a.primary - b.primary || a.perpendicular - b.perpendicular)[0];
    }
    if (target) setOptionSelection(buttons, target.index, true);
  }

  function readNavigationDirection(pad) {
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

  function pollGamepadInput(now) {
    if (!isActive()) return;

    const pads = getConnectedGamepads();
    updateGamepadAnswerLabels(getPanel(), pads.length > 0);
    const gameOverHint = getPanel()?.querySelector('.game-over-control-hint');
    if (gameOverHint) gameOverHint.hidden = pads.length === 0;
    const hint = getHint?.();
    const hintText = pads.length ? 'CONTROLE: BOTÃO DE BAIXO PARA PULAR' : getFallbackJumpHint?.();
    if (hint && hintText && hint.textContent !== hintText) hint.textContent = hintText;

    const activeIndexes = new Set();
    let navigationDirection = 0;
    for (const pad of pads) {
      activeIndexes.add(pad.index);
      const wasPressed = previousButtons.get(pad.index) || new Set();
      const pressedButtons = new Set();

      for (let index = 0; index < (pad.buttons?.length || 0); index++) {
        const button = pad.buttons[index];
        const pressed = Boolean(button?.pressed || button?.value >= 0.5);
        if (!pressed) continue;
        pressedButtons.add(index);
        if (wasPressed.has(index)) continue;

        const state = getState();
        if (state === 'run' && index === 0) jump();
        else if (state === 'checkpoint' || state === 'fight') {
          const answerIndex = ANSWER_BUTTONS.get(index);
          const answerButton = getAnswerButtons()[answerIndex];
          if (answerButton && answerIndex === selectedOption && !answerButton.disabled) answerButton.click();
        } else if (state === 'over' && index === 0) {
          const selectedButton = getGameOverButtons()[selectedOption];
          if (selectedButton) selectedButton.click();
        }
      }
      previousButtons.set(pad.index, pressedButtons);
      if (!navigationDirection) navigationDirection = readNavigationDirection(pad);
    }

    for (const index of previousButtons.keys()) {
      if (!activeIndexes.has(index)) previousButtons.delete(index);
    }

    const selectionActive = getState() === 'checkpoint' || getState() === 'fight' || getState() === 'over';
    if (!pads.length || !selectionActive) {
      clearOptionSelection();
      previousDirection = 0;
      nextDirectionAt = 0;
      return;
    }

    const buttons = getSelectionButtons();
    const optionsChanged = buttons.length !== lastOptionButtons.length || buttons.some((button, index) => button !== lastOptionButtons[index]);
    if (optionsChanged) setOptionSelection(buttons, 0);
    else if (buttons[selectedOption]?.disabled) {
      const firstAvailable = buttons.findIndex(button => !button.disabled);
      if (firstAvailable >= 0) setOptionSelection(buttons, firstAvailable);
    }

    if (!navigationDirection) {
      previousDirection = 0;
      nextDirectionAt = 0;
    } else if (navigationDirection !== previousDirection) {
      moveOptionSelection(navigationDirection);
      previousDirection = navigationDirection;
      nextDirectionAt = now + NAV_REPEAT_DELAY;
    } else if (now >= nextDirectionAt) {
      moveOptionSelection(navigationDirection);
      nextDirectionAt = now + NAV_REPEAT_INTERVAL;
    }
  }

  function onKeyDown(event) {
    if (!isActive() || event.repeat) return;
    if (event.key === 'Escape' && !(hasConnectedGamepad() && getState() === 'over')) {
      resetGame();
      return;
    }
    if (getState() === 'run' && !hasConnectedGamepad() && (event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w')) {
      event.preventDefault();
      jump();
      return;
    }
    if (!hasConnectedGamepad() && (getState() === 'checkpoint' || getState() === 'fight')) {
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      const button = getPanel()?.querySelectorAll('.quiz-options > button')[index];
      if (button && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    }
  }

  function onPointerDown(event) {
    if (!hasConnectedGamepad() && event.target === getCanvas()) jump();
  }

  function onPanelClick(event) {
    if (hasConnectedGamepad() && event.isTrusted && event.target instanceof Element && event.target.closest('.quiz-options > button, .game-over-actions > button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  return { onKeyDown, onPointerDown, onPanelClick, pollGamepadInput };
}
