// ===================== HUD (VIDAS / PONTOS) =====================
// Moldura em assets/images/hud-frame-3.webp e corações em hearts-sheet.webp (6x3):
// linha 1 batendo · linha 2 rachando até apagar · linha 3 enchendo de novo.
// Guarda quantas vidas havia antes para animar só o coração que mudou.

const FILL_STAGGER = 0.12; // atraso entre um coração e outro ao encher

export function renderLives(el, lives, max) {
  if (!el) return;
  const prev = el.dataset.lives === undefined ? null : Number(el.dataset.lives);
  el.dataset.lives = String(lives);
  el.setAttribute('aria-label', `${lives} de ${max} vidas restantes`);

  while (el.children.length < max) {
    const heart = document.createElement('span');
    heart.setAttribute('aria-hidden', 'true');
    el.appendChild(heart);
  }
  while (el.children.length > max) el.lastElementChild.remove();

  [...el.children].forEach((heart, index) => {
    const current = heart.dataset.state;
    let state;
    if (index < lives) {
      // Vida nova (início da partida ou recuperada): enche e depois passa a bater
      state = prev === null || index >= prev ? 'is-filling' : current === 'is-filling' ? 'is-filling' : 'is-alive';
    } else {
      // Vida que acabou de ser perdida racha; as que já estavam perdidas ficam apagadas
      state = prev !== null && index < prev ? 'is-breaking' : current === 'is-breaking' ? 'is-breaking' : 'is-lost';
    }
    if (current === state) return;
    heart.dataset.state = state;
    heart.className = `life-pip ${state}`;
    heart.style.animationDelay = state === 'is-filling'
      ? `${index * FILL_STAGGER}s, ${index * FILL_STAGGER + 0.7}s`
      : state === 'is-alive' ? `${-index * 0.15}s` : '';
  });
}

// Começo de partida: esquece o estado anterior para os corações encherem.
export function resetLives(el) {
  if (!el) return;
  delete el.dataset.lives;
  el.replaceChildren();
}

export function renderScore(el, score) {
  if (!el) return;
  const text = String(score);
  if (el.textContent === text) return;
  const grew = Number(el.textContent) < score;
  el.textContent = text;
  if (grew) {
    el.classList.remove('is-bump');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('is-bump');
  }
}
