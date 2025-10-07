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
import { resetGame } from './game-state.js';

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

// ===================== CONTROLE DE ÁUDIO (pulse.mp3) =====================
// ===================== CONTROLE DE ÁUDIO (pulse.mp3) =====================
let pulseVolume = 1.0;       // volume máximo inicial
let pulseStarted = false;    // indica se o som já começou

function startPulse() {
  try {
    if (!window.audioAtivo || !pulseSfx) return;

    // 🔹 se ainda não começou, inicia alto
    if (!pulseStarted) {
      pulseSfx.pause();
      pulseSfx.currentTime = 0;
      pulseSfx.volume = 1.0;
      pulseSfx.play().catch(() => {});
      pulseStarted = true;
      pulseVolume = 1.0;
    } else {
      // 🔹 se já está tocando, aumenta levemente a intensidade
      pulseVolume = Math.min(1.0, pulseVolume + 0.15);
      pulseSfx.volume = pulseVolume;
      pulseSfx.playbackRate = Math.min(1.8, 1.0 + pulseVolume * 0.5); // acelera batida
    }
  } catch (e) {
    console.warn('Erro ao tocar pulse.mp3:', e);
  }
}

function resetPulse() {
  try {
    if (pulseSfx) {
      pulseSfx.pause();
      pulseSfx.currentTime = 0;
    }
    pulseStarted = false;
    pulseVolume = 1.0;
  } catch (e) {}
}



// ===================== STATUS BAR =====================
function showStatusBar() {
  if (!statusBar) return;
  statusBar.hidden = false;
  updateStatusBar();
}

function updateStatusBar() {
  if (!statusBar) return;
  livesEl.textContent = `Vidas: ${survivalLives}`;
  scoreEl.textContent = `Pontuação: ${survivalScore}`;
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
  if (survivalIndex >= survivalDeck.length) {
    buildSurvivalDeck();
  }
  const node = survivalDeck[survivalIndex++];
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
  if (!survivalActive) return;
  clearTimeout(survivalTimer);
  const correto = i === node.answer;
  if (correto) {
    handleCorrectAnswer(node.video);
  } else {
    handleWrongAnswer();
  }
}

function handleCorrectAnswer(videoPath) {
  survivalScore++;
  updateStatusBar();
  correctOverlay.hidden = false;
  if (videoPath) {
    rewardVideo.src = videoPath;
    rewardVideo.removeAttribute('controls');
    rewardVideo.currentTime = 0;
    rewardVideo.play().catch(() => {});
    const next = () => {
      rewardVideo.removeEventListener('ended', next);
      rewardVideo.pause();
      correctOverlay.hidden = true;
      nextSurvivalQuestion();
    };
    rewardVideo.addEventListener('ended', next);
  } else {
    // Sem vídeo: pequena pausa
    setTimeout(() => {
      correctOverlay.hidden = true;
      nextSurvivalQuestion();
    }, 100);
  }
}


function handleWrongAnswer() {
  survivalLives--;
  startPulse();
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
  hideStatusBar();
  resetPulse();
  // Atualiza UI com mensagem de fim
  if (qTitle) qTitle.textContent = `Fim do Modo Sobrevivência!`; 
  if (qOptions) {
    qOptions.innerHTML = '';
    const p = document.createElement('p');
    p.style.opacity = '0.9';
    p.style.margin = '8px 0 14px';
    p.textContent = `Sua pontuação foi ${survivalScore}.`; 
    qOptions.appendChild(p);
  }
  // Resetar para tela inicial depois de um delay
  setTimeout(() => {
    resetGame();
  }, SURVIVAL_RESET_DELAY);
}

// ===================== FUNÇÃO DE INICIALIZAÇÃO =====================
// Esta é a função pública que inicia o modo sobrevivência. Ela deve ser
// importada e chamada a partir do script principal quando o usuário
// selecionar o Modo Sobrevivência.
export function startSurvival() {
  // Configura estado inicial
  survivalScore = 0;
  survivalLives = SURVIVAL_LIVES;
  survivalActive = true;
  resetPulse();
  buildSurvivalDeck();
  // Mostra quiz e status bar
  quizSection.hidden = false;
  correctOverlay.hidden = true;
  wrongFlash.hidden = true;
  showStatusBar();
  nextSurvivalQuestion();
}
