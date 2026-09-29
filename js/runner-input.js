// Entrada de teclado e toque do modo runner.
export function createRunnerInput({ isActive, getState, getCanvas, getPanel, jump, resetGame }) {
  function onKeyDown(event) {
    if (!isActive() || event.repeat) return;
    if (event.key === 'Escape') {
      resetGame();
      return;
    }
    if (getState() === 'run' && (event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w')) {
      event.preventDefault();
      jump();
      return;
    }
    if (getState() === 'checkpoint' || getState() === 'fight') {
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      const button = getPanel()?.querySelectorAll('.quiz-options > button')[index];
      if (button && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    }
  }

  function onPointerDown(event) {
    if (event.target === getCanvas()) jump();
  }

  return { onKeyDown, onPointerDown };
}
