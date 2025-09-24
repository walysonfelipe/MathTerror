import { CONFIG } from './config.js';
import { QUIZ, WRONG_IMAGES } from './quiz-data.js';
import { quizSection, qTitle, qOptions, correctOverlay, rewardVideo, wrongFlash } from './dom-elements.js';
import { shuffleInPlace, cloneWithShuffledOptions, letterForIndex, isABCDLabel } from './utils.js';
import { RANDOMIZE_QUESTIONS } from './config.js';
import { isFullscreen } from './fullscreen.js';
import { resetGame } from './game-state.js';

let quizIndex = 0;
let bloqueado = false;
let QUIZ_DECK = [];

export function setQuizInteractivity(enabled) {
  if (!quizSection) return;
  quizSection.style.pointerEvents = enabled ? 'auto' : 'none';
  qOptions.querySelectorAll('button').forEach(btn => {
    btn.disabled = !enabled;
  });
}

export function startQuiz() {
  // monta deck
  if (RANDOMIZE_QUESTIONS) {
    const idxs = Array.from({ length: QUIZ.length }, (_, i) => i);
    shuffleInPlace(idxs);
    QUIZ_DECK = idxs.map(i => cloneWithShuffledOptions(QUIZ[i]));
  } else {
    QUIZ_DECK = QUIZ.map(q => cloneWithShuffledOptions(q));
  }

  quizIndex = 0;
  bloqueado = false;
  quizSection.hidden = false;
  correctOverlay.hidden = true;
  wrongFlash.hidden = true;

  setQuizInteractivity(true);
  renderQuestion();
}

export function renderQuestion() {
  if (!quizSection) return;
  const node = QUIZ_DECK[quizIndex];

  // Título (texto OU imagem)
  qTitle.innerHTML = "";
  if (node.questionText) {
    qTitle.textContent = node.questionText;
  } else if (node.questionImage) {
    const img = document.createElement("img");
    img.src = node.questionImage;
    img.alt = "Questão";
    img.className = "quiz-image";
    qTitle.appendChild(img);
  } else if (node.question) {
    // fallback formato antigo
    qTitle.textContent = node.question;
  }

  // Opções (texto OU imagem)
  qOptions.innerHTML = "";
  node.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--blood quiz-option';
    btn.type = 'button';

    // Letra calculada pela POSIÇÃO visível pós-embaralhamento
    const letter = letterForIndex(i);

    if (typeof opt === "string") {
      // Alternativa em TEXTO => mostra "A) ..." sempre coerente com a posição
      btn.textContent = `${letter}) ${opt}`;
    } else if (opt && typeof opt === "object") {
      // Alternativa em IMAGEM
      const figure = document.createElement('figure');
      figure.className = 'option-figure';

      if (opt.img) {
        const image = document.createElement('img');
        image.src = opt.img;
        image.alt = opt.alt || "Alternativa";
        image.className = 'option-image';
        figure.appendChild(image);
      }

      // Legenda:
      const figcap = document.createElement('figcaption');
      figcap.className = 'option-caption';

      if (isABCDLabel(opt.label)) {
        figcap.textContent = letter;
      } else if (typeof opt.label === 'string' && opt.label.trim() !== '') {
        figcap.textContent = `${letter} — ${opt.label}`;
      } else {
        figcap.textContent = letter;
      }

      figure.appendChild(figcap);

      btn.innerHTML = "";
      btn.appendChild(figure);
    } else {
      // fallback robusto
      btn.textContent = `${letter}) ${String(opt)}`;
    }

    btn.addEventListener('click', () => onAnswer(i));
    qOptions.appendChild(btn);
  });
}

export function onAnswer(i) {
  if (bloqueado) return;
  const node = QUIZ_DECK[quizIndex];
  const correto = (i === node.answer);
  if (correto) {
    playCorrect(node.video);
  } else {
    flashWrong();
  }
}

export function flashWrong() {
  if (!wrongFlash) return;

  if (bloqueado) return;
  bloqueado = true;

  setQuizInteractivity(false);

  const img = WRONG_IMAGES[Math.floor(Math.random() * WRONG_IMAGES.length)];
  wrongFlash.src = img;
  wrongFlash.hidden = false;

  const rot = (Math.random() * 10 - 5); // -5 a 5 graus
  wrongFlash.style.transform = `translate(-50%,-50%) scale(.6) rotate(${rot}deg)`;

  const jump = document.getElementById('jumpSfx');
  try {
    if (window.audioAtivo && jump) {
      jump.currentTime = 0;
      jump.volume = 1.0;
      jump.play().catch(() => { });
    }
  } catch { }

  // Duração dinâmica da animação
  const durMs = Math.max(200, CONFIG.JUMPSCARE_DURATION_MS | 0);
  wrongFlash.style.animation = 'none';
  void wrongFlash.offsetWidth; // reflow
  wrongFlash.style.animation = `flashJump ${durMs}ms ease-out both`;

  // Ao terminar o jumpscare: esconde e reseta o jogo
  setTimeout(() => {
    wrongFlash.hidden = true;
    resetGame();
  }, durMs + 60);
}

export async function playCorrect(videoPath) {
  if (bloqueado) return;
  bloqueado = true;

  setQuizInteractivity(false);
  correctOverlay.hidden = false;

  if (videoPath) {
    rewardVideo.src = videoPath;
    rewardVideo.removeAttribute("controls");
    rewardVideo.currentTime = 0;
    try {
      if (!isFullscreen() && rewardVideo.requestFullscreen) {
        try { await rewardVideo.requestFullscreen(); } catch { }
      }
      await rewardVideo.play();
    } catch (e) {
      console.warn("Falha ao tocar vídeo de acerto:", e);
    }

    const proximo = () => {
      rewardVideo.removeEventListener('ended', proximo);
      avançar();
    };
    rewardVideo.addEventListener('ended', proximo);
  } else {
    setTimeout(avançar, 100);
  }
}

function avançar() {
  try { rewardVideo.pause(); } catch { }
  correctOverlay.hidden = true;
  bloqueado = false;

  quizIndex++;
  if (quizIndex < QUIZ_DECK.length) {
    setQuizInteractivity(true);
    renderQuestion();
  } else {
    fimDoQuiz();
  }
}

function fimDoQuiz() {
  qTitle.textContent = "Parabéns! Você atravessou o corredor.";
  qOptions.innerHTML = "";

  const sub = document.createElement('p');
  sub.style.opacity = .9;
  sub.style.margin = "8px 0 14px";
  sub.textContent = "O guardião se cala por agora… mas ele lembra dos que ousam.";
  qOptions.parentElement.appendChild(sub);

  setTimeout(() => {
    resetGame();
  }, CONFIG.AUTO_RESET_DELAY);
}

export function resetQuizUI() {
  quizIndex = 0;
  bloqueado = false;
  if (quizSection) {
    quizSection.hidden = true;
    qOptions.innerHTML = "";
    qTitle.textContent = "";
    quizSection.style.pointerEvents = 'auto';
  }
  correctOverlay.hidden = true;
  wrongFlash.hidden = true;
}