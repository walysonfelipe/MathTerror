// Interface do modo runner: HUD, progresso, perguntas e fim de partida.
import { renderLives, renderScore, spriteNumber } from './hud.js';
import { letterForIndex, isABCDLabel } from './utils.js';
import { FIGHT_INTRO, FIGHT_INTRO_DURATION } from './runner-fight-assets.js';

const GAMEPAD_ANSWER_LABELS = ['X', 'Y', 'B', 'A'];

export function updateGamepadAnswerLabels(panel, gamepadActive) {
  panel?.classList.toggle('is-gamepad-active', gamepadActive);
  panel?.querySelectorAll('.quiz-option-key').forEach(key => {
    const label = gamepadActive ? key.dataset.gamepadLabel : key.dataset.defaultLabel;
    if (label && key.textContent !== `${label})`) key.textContent = `${label})`;
  });
}

export function drawFightIntro(ctx, loadImage, { state, fightIntro, clock, fightStartedAt, viewW, viewH }) {
  if (state !== 'fight' || !fightIntro) return;
  const img = loadImage(FIGHT_INTRO.src);
  if (!img.complete || !img.naturalWidth) return;
  const t = clock - fightStartedAt;
  let frame;
  let pop = 1;
  if (t < 0.12) {
    frame = 0;
    const p = t / 0.12;
    pop = 1.6 - 0.6 * p * p;
  } else if (t < 0.34) frame = 1;
  else frame = 2 + (Math.floor((t - 0.34) / 0.09) % 2);
  const out = Math.max(0, (t - (FIGHT_INTRO_DURATION - 0.25)) / 0.25);
  const [sx, sy, sw, sh, anchorX, anchorY] = FIGHT_INTRO.frames[frame];
  const scale = Math.min(viewW * 0.62, viewH * 0.46 * FIGHT_INTRO.baseW / FIGHT_INTRO.baseH) / FIGHT_INTRO.baseW * pop * (1 + out * 0.25);
  const w = sw * scale;
  const h = sh * scale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t / 0.08) * (1 - out);
  ctx.drawImage(img, sx, sy, sw, sh, viewW / 2 - anchorX * scale, viewH * 0.44 - anchorY * scale, w, h);
  ctx.restore();
}

export function drawLegProgress(ctx, { state, owlX, legStartX, markerX, viewW, viewH }) {
  if (state !== 'run') return;
  const p = Math.max(0, Math.min(1, (owlX - legStartX) / (markerX - legStartX)));
  const w = Math.min(360, viewW * 0.5);
  const x = (viewW - w) / 2;
  const y = viewH - 34;
  ctx.fillStyle = '#ffffff22';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = '#df302e';
  ctx.fillRect(x, y, w * p, 4);
  ctx.fillStyle = '#e9e6de';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PRÓXIMO DESAFIO', viewW / 2, y - 10);
}

export function updateRunnerHud({ statusBar, livesEl, scoreEl, lives, maxLives, score, state, answering, errors }) {
  if (!statusBar) return;
  statusBar.hidden = false;
  // Erros na pergunta atual esvaziam o coração da vez; acertou, ele enche de volta.
  const drain = state === 'checkpoint' && !answering ? errors : 0;
  renderLives(livesEl, lives, maxLives, drain);
  renderScore(scoreEl, score);
}

export function renderCheckpointQuestion(panel, node, onAnswer, phone) {
  panel.hidden = false;
  panel.classList.remove('is-fight-question', 'is-near-catch');
  panel.innerHTML = `
    <div class="runner-question-head">
      <span class="hud-label runner-threat">CHECKPOINT · SILÊNCIO...</span>
      <progress max="1" value="0" aria-label="Distância do boss"></progress>
    </div>
    <h2 class="quiz-title"></h2>
    <div class="quiz-options"></div>
    <p class="answer-feedback" role="status" aria-live="polite"></p>`;
  const title = panel.querySelector('.quiz-title');
  if (node.questionText || node.question) {
    title.textContent = node.questionText || node.question;
  } else if (node.questionImage) {
    const img = document.createElement('img');
    img.src = node.questionImage;
    img.alt = 'Questão';
    img.className = 'quiz-image';
    title.appendChild(img);
  }

  const options = panel.querySelector('.quiz-options');
  node.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--blood quiz-option';
    btn.type = 'button';
    const letter = letterForIndex(i);
    const key = document.createElement('span');
    key.className = 'quiz-option-key';
    key.dataset.defaultLabel = letter;
    key.dataset.gamepadLabel = GAMEPAD_ANSWER_LABELS[i] || letter;
    key.textContent = `${letter})`;
    btn.appendChild(key);
    const content = document.createElement('span');
    content.className = 'quiz-option-content';
    if (opt && typeof opt === 'object') {
      const figure = document.createElement('figure');
      figure.className = 'option-figure';
      if (opt.img) {
        const image = document.createElement('img');
        image.src = opt.img;
        image.alt = opt.alt || 'Alternativa';
        image.className = 'option-image';
        figure.appendChild(image);
      }
      const figcap = document.createElement('figcaption');
      figcap.className = 'option-caption';
      const hasLabel = typeof opt.label === 'string' && opt.label.trim() !== '' && !isABCDLabel(opt.label);
      figcap.textContent = hasLabel ? opt.label : '';
      figure.appendChild(figcap);
      content.appendChild(figure);
    } else {
      content.textContent = String(opt);
    }
    btn.appendChild(content);
    btn.addEventListener('click', () => onAnswer(i === node.answer, btn));
    options.appendChild(btn);
  });
  // Foco automático é para teclado; no celular o contorno pode parecer resposta marcada.
  if (!phone) requestAnimationFrame(() => options.querySelector('button')?.focus({ preventScroll: true }));
}

export function renderFightQuestion(panel, problem, round, elapsed, turnTime, onAnswer, isCurrentFirstRound, phone, feedbackText = '') {
  panel.hidden = false;
  panel.classList.add('is-fight-question');
  panel.classList.remove('is-near-catch');
  panel.innerHTML = `
    <div class="runner-question-head"><span class="hud-label runner-threat">LUTA CONTRA O BOSS · ${round + 1}/4</span></div>
    <h2 class="quiz-title"></h2>
    <div class="quiz-options"></div>
    <p class="answer-feedback" role="status" aria-live="polite"></p>`;
  panel.querySelector('.quiz-title').textContent = problem.text;
  panel.querySelector('.answer-feedback').textContent = feedbackText;
  const options = panel.querySelector('.quiz-options');
  const turning = round === 0 && elapsed < turnTime;
  problem.options.forEach((value, index) => {
    const button = document.createElement('button');
    button.className = 'btn btn--blood quiz-option';
    button.type = 'button';
    button.disabled = turning;
    const key = document.createElement('span');
    key.className = 'quiz-option-key';
    key.dataset.defaultLabel = String(index + 1);
    key.dataset.gamepadLabel = GAMEPAD_ANSWER_LABELS[index] || String(index + 1);
    key.textContent = `${index + 1})`;
    const content = document.createElement('span');
    content.className = 'quiz-option-content';
    content.textContent = String(value);
    button.append(key, content);
    button.addEventListener('click', () => onAnswer(index === problem.answer));
    options.appendChild(button);
  });
  if (turning) {
    const remaining = Math.max(0, (turnTime - elapsed) * 1000);
    setTimeout(() => {
      if (!isCurrentFirstRound()) return;
      options.querySelectorAll('button').forEach(button => { button.disabled = false; });
      if (!phone) options.querySelector('button')?.focus({ preventScroll: true });
    }, remaining);
  } else if (!phone) {
    requestAnimationFrame(() => options.querySelector('button')?.focus({ preventScroll: true }));
  }
}

export function updateThreatLabel(panel, mode, errors, pace) {
  const label = panel.querySelector('.runner-threat');
  if (!label) return;
  if (mode === 'hidden' && errors === 0) label.textContent = 'CHECKPOINT · SILÊNCIO...';
  else if (errors === 0) label.textContent = 'O BOSS SE APROXIMA';
  else label.textContent = `O BOSS SE APROXIMA · ${pace.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}× MAIS RÁPIDO`;
}

export function renderRunnerGameOver(panel, reason, score, onRetry, onHome, phone) {
  panel.hidden = false;
  panel.classList.remove('is-fight-question', 'is-near-catch');
  panel.classList.add('is-game-over');
  // Textos fixos já estão desenhados nas imagens; este texto atende leitores de tela.
  panel.innerHTML = `
    <section class="game-over-card" aria-labelledby="gameOverTitle">
      <p class="go-sr">FUGA INFERNAL · FIM DE PARTIDA</p>
      <h2 id="gameOverTitle" class="game-over-title"></h2>
      <div class="game-over-result">
        <span class="go-sr">QUESTÕES CERTAS: ${score}</span>
        <span class="go-number" aria-hidden="true">${spriteNumber(score)}</span>
      </div>
      <div class="game-over-actions">
        <button type="button" class="go-btn go-btn--retry" data-action="retry"><span class="go-sr">TENTAR NOVAMENTE</span></button>
        <button type="button" class="go-btn go-btn--home" data-action="home"><span class="go-sr">VOLTAR AO MENU</span></button>
      </div>
      <p class="game-over-control-hint" hidden>D-PAD / ANALÓGICO: ESCOLHER · A: CONFIRMAR</p>
    </section>`;
  panel.querySelector('.game-over-title').textContent = reason;
  const retry = panel.querySelector('[data-action="retry"]');
  retry.addEventListener('click', onRetry);
  panel.querySelector('[data-action="home"]').addEventListener('click', onHome);
  if (!phone) requestAnimationFrame(() => retry.focus({ preventScroll: true }));
}
