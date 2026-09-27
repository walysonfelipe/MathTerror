// ===================== HUD (VIDAS / PONTOS) =====================
// Moldura em assets/images/hud-frame-3.webp e corações em hearts-sheet.webp (6x3):
// linha 1 batendo · linha 2 rachando até apagar · linha 3 enchendo de novo.
// Guarda quantas vidas havia antes para animar só o coração que mudou.

const FILL_STAGGER = 0.12; // atraso entre um coração e outro ao encher
// Esvaziando (linha 3 de trás para frente): 1º erro quase cheio · 2º metade · 3º+ quase vazio.
const DRAIN_COLUMNS = [3, 2, 1];

// drain: quantos erros na pergunta atual (0 = coração da vez cheio).
export function renderLives(el, lives, max, drain = 0) {
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

  const drainStep = Math.min(drain, DRAIN_COLUMNS.length);
  [...el.children].forEach((heart, index) => {
    const current = heart.dataset.state;
    let state;
    if (index === lives - 1 && drainStep > 0) {
      // Coração da vez perdendo vida a cada erro; o último passo fica piscando em alerta
      const column = DRAIN_COLUMNS[drainStep - 1];
      if (heart.dataset.drain === String(column)) return;
      heart.dataset.drain = String(column);
      heart.dataset.state = 'is-draining';
      heart.className = `life-pip is-draining${drainStep >= DRAIN_COLUMNS.length ? ' is-critical' : ''}`;
      heart.style.setProperty('--drain-x', `${column * 20}%`);
      heart.style.animationDelay = '';
      return;
    }
    if (index === lives - 1 && current === 'is-draining') {
      // Acertou: enche de volta a partir de onde parou e volta a bater
      delete heart.dataset.drain;
      heart.dataset.state = 'is-refilling';
      heart.className = 'life-pip is-refilling';
      heart.style.animationDelay = '';
      return;
    }
    if (index < lives) {
      // Vida nova (início da partida ou recuperada): enche e depois passa a bater
      state = prev === null || index >= prev ? 'is-filling' : current === 'is-filling' || current === 'is-refilling' ? current : 'is-alive';
    } else {
      // Vida que acabou de ser perdida racha; as que já estavam perdidas ficam apagadas
      state = prev !== null && index < prev ? 'is-breaking' : current === 'is-breaking' ? 'is-breaking' : 'is-lost';
      delete heart.dataset.drain;
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

// Números em sprite (digits-sheet.webp, de numeros.png): 0–9 lado a lado em células de
// 168x214; DIGIT_W é a largura real de cada algarismo. Usado no HUD e no fim de partida.
const DIGIT_W = [159, 115, 151, 148, 162, 151, 155, 153, 163, 151];

export function spriteNumber(value) {
  return [...String(value)]
    .map(d => `<span class="sprite-digit" style="--d:${d};--w:${DIGIT_W[d]}"></span>`)
    .join('');
}

export function renderScore(el, score) {
  if (!el) return;
  const text = String(score);
  if (el.dataset.score === text) return;
  const grew = el.dataset.score !== undefined && Number(el.dataset.score) < score;
  el.dataset.score = text;
  el.setAttribute('aria-label', `${text} pontos`);
  el.innerHTML = spriteNumber(score);
  if (grew) {
    el.classList.remove('is-bump');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('is-bump');
  }
}
