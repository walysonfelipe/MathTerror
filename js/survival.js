// ===================== MODO SOBREVIVÊNCIA =====================
// Este módulo implementa um modo de jogo "sobrevivência" para o MathTerror.
// No modo sobrevivência, o jogador tem um número limitado de vidas e um tempo
// para responder cada questão. Perguntas continuam indefinidamente (baralho
// circular) até que o jogador perca todas as vidas. Pontuação é
// incrementada a cada acerto.

// Importa dados e utilidades do jogo existente. As perguntas e imagens de
// susto são reutilizadas a partir do modo normal.
import { QUIZ, WRONG_IMAGES } from './quiz-data.js';
import {
  quizSection,
  qTitle,
  qOptions,
  correctOverlay,
  rewardVideo,
  wrongFlash,
  pulseSfx,
  livesEl,
  scoreEl,
  statusBar
} from './dom-elements.js';
import {
  shuffleInPlace,
  cloneWithShuffledOptions,
  letterForIndex,
  isABCDLabel,
} from './utils.js';
import { CONFIG } from './config.js';
import { resetGame, hideHome } from './game-state.js';

// ===================== CONFIGURAÇÕES DO MODO =====================
// Número inicial de vidas para o modo sobrevivência.
const SURVIVAL_LIVES = 3;
// Tempo (ms) para responder cada questão antes de perder uma vida.
const TIME_PER_QUESTION_MS = 15000;
// Tempo (ms) para mostrar mensagem final antes de reiniciar o jogo.
const SURVIVAL_RESET_DELAY = 3000;

// ===================== VARIÁVEIS DE ESTADO =====================
let survivalScore = 0;
let survivalLives = SURVIVAL_LIVES;
let survivalDeck = [];
let survivalIndex = 0;
let survivalTimer = null;
let survivalActive = false;
let answering = false;
let timerTicker = null;

// Intensifica a pulsação à medida que o tempo da questão acaba.
let pulseStarted = false;
function startPulse(secondsRemaining) {
  if (!pulseSfx) return;
  if (!window.audioAtivo) {
    if (!pulseSfx.paused) pulseSfx.pause();
    pulseStarted = false;
    return;
  }
  const duration = TIME_PER_QUESTION_MS / 1000;
  const urgency = Math.max(0, Math.min(1, 1 - secondsRemaining / duration));
  // Começa audível e aumenta até o volume máximo, junto com a velocidade.
  pulseSfx.loop = true;
  pulseSfx.muted = false;
  pulseSfx.volume = 0.24 + urgency * 0.76;
  pulseSfx.playbackRate = 0.95 + urgency * 0.7;
  if (!pulseStarted || pulseSfx.paused) {
    pulseSfx.currentTime = 0;
    pulseSfx.play().then(() => { pulseStarted = true; }).catch(error => {
      pulseStarted = false;
      console.warn('Não foi possível iniciar o pulso:', error);
    });
    pulseStarted = true;
  }
}

function resetPulse() {
  try {
    if (pulseSfx) {
      pulseSfx.pause();
      pulseSfx.currentTime = 0;
      pulseSfx.volume = 0;
      pulseSfx.playbackRate = 1;
      pulseSfx.muted = false;
    }
    pulseStarted = false;
  } catch {}
}


// ===================== STATUS BAR =====================
function showStatusBar() {
  if (!statusBar) return;
  statusBar.hidden = false;
  updateStatusBar();
}

function updateStatusBar() {
  if (!statusBar) return;
  livesEl.replaceChildren();
  livesEl.setAttribute('aria-label', `${survivalLives} de ${SURVIVAL_LIVES} vidas restantes`);
  for (let index = 0; index < SURVIVAL_LIVES; index++) {
    const heart = document.createElement('span');
    heart.className = `life-pip${index >= survivalLives ? ' is-lost' : ''}`;
    heart.setAttribute('aria-hidden', 'true');
    heart.textContent = '♥';
    livesEl.appendChild(heart);
  }
  scoreEl.textContent = String(survivalScore);
}

function hideStatusBar() {
  if (!statusBar) return;
  statusBar.hidden = true;
}


function buildSurvivalDeck() {
  const idxs = Array.from({ length: QUIZ.length }, (_, i) => i);
  shuffleInPlace(idxs);
  survivalDeck = idxs.map(i => cloneWithShuffledOptions(QUIZ[i]));
  survivalIndex = 0;
}

function nextSurvivalQuestion() {
  if (!survivalActive) return;
  resetPulse();
  if (survivalIndex >= survivalDeck.length) {
    buildSurvivalDeck();
  }
  answering = false;
  const node = survivalDeck[survivalIndex++];
  document.getElementById('modeLabel').textContent = 'SOBREVIVÊNCIA';
  document.getElementById('questionProgress').textContent = `${survivalScore} acertos`;
  document.getElementById('questionMeter').value = 0;
  document.getElementById('timerPanel').hidden = false;
  document.getElementById('answerFeedback').textContent = '';
  const deadline = Date.now() + TIME_PER_QUESTION_MS;
  clearInterval(timerTicker);
  const tick = () => {
    const seconds = Math.max(0, (deadline - Date.now()) / 1000);
    document.getElementById('timerText').textContent = String(Math.ceil(seconds)).padStart(2, '0');
    document.getElementById('timerRing').style.strokeDashoffset = String(169.65 * (1 - seconds / (TIME_PER_QUESTION_MS / 1000)));
    document.getElementById('timerPanel').setAttribute('aria-label', `${Math.ceil(seconds)} segundos restantes`);
    document.getElementById('timerMeter').value = seconds;
    startPulse(seconds);
    document.getElementById('timerPanel').classList.toggle('is-urgent', seconds <= 5);
  };
  tick();
  timerTicker = setInterval(tick, 100);
  renderSurvivalQuestion(node);
  // Inicia cronômetro para perder vida se o tempo acabar.
  clearTimeout(survivalTimer);
  survivalTimer = setTimeout(() => {
    handleWrongAnswer();
  }, TIME_PER_QUESTION_MS);
}

function renderSurvivalQuestion(node) {
  if (!quizSection) return;
  // Título (texto ou imagem)
  qTitle.innerHTML = '';
  if (node.questionText) {
    qTitle.textContent = node.questionText;
  } else if (node.questionImage) {
    const img = document.createElement('img');
    img.src = node.questionImage;
    img.alt = 'Questão';
    img.className = 'quiz-image';
    qTitle.appendChild(img);
  } else if (node.question) {
    // fallback para formato antigo
    qTitle.textContent = node.question;
  }

  // Opções
  qOptions.innerHTML = '';
  node.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--blood quiz-option';
    btn.type = 'button';
    const letter = letterForIndex(i);
    if (typeof opt === 'string') {
      btn.textContent = `${letter}) ${opt}`;
    } else if (opt && typeof opt === 'object') {
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
      if (isABCDLabel(opt.label)) {
        figcap.textContent = letter;
      } else if (typeof opt.label === 'string' && opt.label.trim() !== '') {
        figcap.textContent = `${letter} \u2014 ${opt.label}`;
      } else {
        figcap.textContent = letter;
      }
      figure.appendChild(figcap);
      btn.innerHTML = '';
      btn.appendChild(figure);
    } else {
      btn.textContent = `${letter}) ${String(opt)}`;
    }
    // Ao clicar, passa índice selecionado
    btn.addEventListener('click', () => handleAnswer(i, node));
    qOptions.appendChild(btn);
  });
}

function handleAnswer(i, node) {
  if (!survivalActive || answering) return;
  clearTimeout(survivalTimer);
  const correto = i === node.answer;
  if (correto) {
    handleCorrectAnswer(node.video);
  } else {
    handleWrongAnswer();
  }
}

function lockAnswer(message) {
  answering = true;
  clearTimeout(survivalTimer);
  clearInterval(timerTicker);
  resetPulse();
  qOptions.querySelectorAll('button').forEach(button => button.disabled = true);
  document.getElementById('answerFeedback').textContent = message;
}
function handleCorrectAnswer(videoPath) {
  lockAnswer('Resposta correta! +1 ponto.');
  survivalScore++;
  updateStatusBar();
  correctOverlay.hidden = false;
  if (videoPath) {
    rewardVideo.src = videoPath;
    rewardVideo.removeAttribute('controls');
    rewardVideo.currentTime = 0;
    rewardVideo.muted = !window.audioAtivo;
    let finished = false;
    const next = () => {
      if (finished) return;
      finished = true;
      rewardVideo.onended = null;
      rewardVideo.onerror = null;
      document.getElementById('skipRewardBtn').onclick = null;
      rewardVideo.pause();
      correctOverlay.hidden = true;
      nextSurvivalQuestion();
    };
    rewardVideo.onended = next;
    rewardVideo.onerror = next;
    document.getElementById('skipRewardBtn').onclick = next;
    rewardVideo.play().catch(next);
  } else {
    // Sem vídeo: pequena pausa
    setTimeout(() => {
      correctOverlay.hidden = true;
      nextSurvivalQuestion();
    }, 100);
  }
}


function handleWrongAnswer() {
  if (!survivalActive || answering) return;
  lockAnswer('Você perdeu uma vida. Prepare-se para a próxima questão.');
  survivalLives--;
  updateStatusBar();
  // Se esgotou vidas, encerra jogo
  if (survivalLives <= 0) {
    endSurvival();
    return;
  }
  // Mostra imagem de erro e jumpscare
  if (wrongFlash) {
    const img = WRONG_IMAGES[Math.floor(Math.random() * WRONG_IMAGES.length)];
    wrongFlash.src = img;
    wrongFlash.hidden = false;
    // Aleatoriza leve rotação para dar efeito
    const rot = (Math.random() * 10 - 5);
    wrongFlash.style.transform = `translate(-50%, -50%) scale(.6) rotate(${rot}deg)`;
    // Toca som de susto se o áudio estiver ativo
    const jump = document.getElementById('jumpSfx');
    try {
      if (window.audioAtivo && jump) {
        jump.currentTime = 0;
        jump.volume = 1.0;
        jump.play().catch(() => {});
      }
    } catch {}
    // Duração do jumpscare baseada em CONFIG ou default
    const durMs = Math.max(200, CONFIG.JUMPSCARE_DURATION_MS || 1000);
    wrongFlash.style.animation = 'none';
    void wrongFlash.offsetWidth; // força reflow
    wrongFlash.style.animation = `flashJump ${durMs}ms ease-out both`;
    // Após o jumpscare, oculta imagem e segue
    setTimeout(() => {
      wrongFlash.hidden = true;
      nextSurvivalQuestion();
    }, durMs + 60);
  } else {
    // Sem imagem de erro: apenas segue após breve pausa
    setTimeout(() => nextSurvivalQuestion(), 300);
  }
}

// Encerra o modo sobrevivência: mostra mensagem final, oculta status e
// reinicia o jogo após alguns segundos.
function endSurvival() {
  survivalActive = false;
  clearTimeout(survivalTimer);
  clearInterval(timerTicker);
  hideStatusBar();
  resetPulse();
  try { rewardVideo.pause(); } catch {}
  correctOverlay.hidden = true;
  wrongFlash.hidden = true;

  const playerName = window.currentPlayer || 'Jogador';
  let scores = [];
  try {
    const saved = JSON.parse(localStorage.getItem('scores') || '[]');
    if (Array.isArray(saved)) scores = saved;
  } catch {}
  scores.push({ name: playerName, score: survivalScore, date: new Date().toISOString() });
  scores.sort((a, b) => Number(b.score) - Number(a.score));
  scores = scores.slice(0, 10);
  try { localStorage.setItem('scores', JSON.stringify(scores)); } catch {}

  qTitle.textContent = '';
  qOptions.replaceChildren();
  document.getElementById('questionInstruction').hidden = true;
  document.getElementById('answerFeedback').textContent = '';
  document.getElementById('timerPanel').hidden = true;

  const card = document.createElement('section');
  card.className = 'game-over-card';
  card.setAttribute('aria-labelledby', 'gameOverTitle');
  const signal = document.createElement('p');
  signal.className = 'game-over-kicker';
  signal.textContent = 'SINAL PERDIDO · FIM DE PARTIDA';
  card.appendChild(signal);
  const title = document.createElement('h2');
  title.id = 'gameOverTitle';
  title.className = 'game-over-title';
  title.textContent = 'O corredor venceu.';
  card.appendChild(title);
  const player = document.createElement('p');
  player.className = 'game-over-player';
  player.textContent = playerName;
  card.appendChild(player);

  const result = document.createElement('div');
  result.className = 'game-over-result';
  const label = document.createElement('span');
  label.textContent = 'QUESTÕES CERTAS';
  const value = document.createElement('strong');
  value.textContent = String(survivalScore);
  result.append(label, value);
  card.appendChild(result);
  const record = document.createElement('p');
  record.className = 'game-over-record';
  record.textContent = `RECORDE LOCAL  ${Math.max(0, ...scores.map(entry => Number(entry.score) || 0))}`;
  card.appendChild(record);

  const actions = document.createElement('div');
  actions.className = 'game-over-actions';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn--blood-primary';
  retry.textContent = 'TENTAR NOVAMENTE';
  retry.addEventListener('click', () => {
    resetGame();
    hideHome();
    startSurvival();
  });
  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'btn';
  home.textContent = 'VOLTAR AO MENU';
  home.addEventListener('click', resetGame);
  actions.append(retry, home);
  card.appendChild(actions);

  qOptions.classList.add('is-game-over');
  qOptions.appendChild(card);
  requestAnimationFrame(() => retry.focus({ preventScroll: true }));
}


// ===================== FUNÇÃO DE INICIALIZAÇÃO =====================
// Esta é a função pública que inicia o modo sobrevivência. Ela deve ser
// importada e chamada a partir do script principal quando o usuário
// selecionar o Modo Sobrevivência.
export function startSurvival() {
  // Sempre pede o nome de novo
  showNameScreen((playerName) => {
    // Configura estado inicial
    survivalScore = 0;
    survivalLives = SURVIVAL_LIVES;
    survivalActive = true;
    resetPulse();
    buildSurvivalDeck();

    // Guarda nome atual na memória temporária (não fixa)
    window.currentPlayer = playerName;

    // Mostra quiz e status bar
    quizSection.hidden = false;
    correctOverlay.hidden = true;
    wrongFlash.hidden = true;
    showStatusBar();
    nextSurvivalQuestion();
  });
}




// ===================== TELA DE NOME DO JOGADOR =====================
function showNameScreen(onSubmit) {
  // Evita duplicar
  if (document.getElementById('nameScreen')) return;

  const overlay = document.createElement('div');
  overlay.id = 'nameScreen';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.9)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';
  overlay.style.color = '#fff';
  overlay.style.fontFamily = 'Inter, sans-serif';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '20px';

  const title = document.createElement('h2');
  title.textContent = 'Quem vai enfrentar o corredor?';
  title.style.fontSize = '1.5rem';
  title.style.marginBottom = '16px';
  overlay.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('aria-label', 'Nome do jogador');
  input.autocomplete = 'nickname';
  input.placeholder = 'Seu nome...';
  input.maxLength = 20;
  input.style.padding = '10px 14px';
  input.style.border = 'none';
  input.style.borderRadius = '8px';
  input.style.fontSize = '1rem';
  input.style.marginBottom = '12px';
  input.style.width = '220px';
  input.style.textAlign = 'center';
  overlay.appendChild(input);

  const button = document.createElement('button');
  button.textContent = 'Começar ▶';
  button.style.background = '#e50914';
  button.style.border = 'none';
  button.style.color = '#fff';
  button.style.padding = '10px 20px';
  button.style.fontSize = '1rem';
  button.style.borderRadius = '8px';
  button.style.cursor = 'pointer';
  button.style.transition = 'background 0.2s';
  button.addEventListener('mouseover', () => (button.style.background = '#f6121d'));
  button.addEventListener('mouseout', () => (button.style.background = '#e50914'));

  overlay.appendChild(button);

  button.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) {
      input.style.border = '2px solid #f33';
      input.focus();
      return;
    }
    localStorage.setItem('playerName', name);
    document.body.removeChild(overlay);
    onSubmit(name);
  });

  const cancel = document.createElement('button');
  cancel.className = 'btn btn--blood-ghost';
  cancel.textContent = 'Voltar ao início';
  cancel.style.marginTop = '16px';
  cancel.onclick = () => { overlay.remove(); resetGame(); };
  overlay.appendChild(cancel);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') button.click(); });
  document.body.appendChild(overlay);
  input.focus();
}


function escapeName(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
