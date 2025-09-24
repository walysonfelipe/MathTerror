// ===================== CONFIG GERAL =====================
// Ajuste tudo aqui em cima e pronto.
const CONFIG = {
  // Velocidade de digitação (ms por caractere)
  // 18 = rápido | 28 = médio | 40–55 = lento
  TYPE_CHAR_DELAY: 100,

  // A cada quantas letras o SFX de digitação toca (ex.: 3 = a cada 3 letras)
  TYPE_SFX_EVERY: 13,

  // Volume do efeito de digitação (0.0 = mudo, 1.0 = máximo)
  TYPE_SFX_VOLUME: 0.35,

  // Duração do jumpscare (imagem de erro) na tela, em ms
  // Ex.: 800 = rápido | 1200 = médio | 1800 = demorado
  JUMPSCARE_DURATION_MS: 1800,

  // Tempo (ms) até resetar pro início após VENCER (o erro já reseta ao fim do jumpscare)
  AUTO_RESET_DELAY: 1800
};

// ===== ALEATORIZAÇÃO =====
const RANDOMIZE_QUESTIONS = true;  // embaralhar ordem das perguntas
const RANDOMIZE_OPTIONS   = true;  // embaralhar ordem das alternativas de cada pergunta

// ===================== CONTROLES BÁSICOS =====================
const startBtn = document.getElementById('startBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const bgMusic = document.getElementById('bgMusic');
const bgVideo = document.getElementById('bgVideo');
const audioModal = document.getElementById('audioModal');
const audioEnableBtn = document.getElementById('audioEnableBtn');
const audioDismissBtn = document.getElementById('audioDismissBtn');

window.audioAtivo = false;
let modalJaMostradoNesteFS = false;

bgVideo?.play().catch(() => { });

// ===================== FULLSCREEN / MODAL ÁUDIO =====================
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function showModal() {
  if (!audioModal) return;
  audioModal.hidden = false;
  if (audioEnableBtn) setTimeout(() => audioEnableBtn.focus({ preventScroll: true }), 0);
}

function hideModal() {
  if (!audioModal) return;
  audioModal.hidden = true;
}

function onFullscreenChange() {
  const ativo = isFullscreen();
  fullscreenBtn?.setAttribute('aria-pressed', ativo ? 'true' : 'false');

  if (!ativo) {
    hideModal();
    modalJaMostradoNesteFS = false;
    return;
  }

  if (!window.audioAtivo && !modalJaMostradoNesteFS) {
    modalJaMostradoNesteFS = true;
    setTimeout(() => {
      if (isFullscreen() && !window.audioAtivo) showModal();
    }, 120);
  }
}

fullscreenBtn?.addEventListener('click', async () => {
  const ativo = isFullscreen();
  try {
    if (!ativo) {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
  } catch (e) {
    console.warn('Erro ao alternar fullscreen:', e);
  }
});

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// ===================== STORY / CENA =====================
const scene1 = document.getElementById('scene1');
const storyTextEl = document.getElementById('storyText');
const storyScrollEl = document.querySelector('.story-scroll');
const char1 = document.getElementById('char1');
const continueBtn = document.getElementById('continueBtn');
const skipBtn = document.getElementById('skipBtn'); // botão Pular

// Áudios
const typeSfxEl = document.getElementById('typeSfx');
const narration = document.getElementById('narration');

// ===================== HISTÓRIA =====================
// (mantido do seu arquivo)
const historiaCap1 = [
  "Nas sombras do desconhecido, um guardião desperta.",
  "Seus olhos ardem em chamas, observando cada passo que você dá.",
  "Ele não fala, mas você sente sua presença em cada batida do coração.",
  "Portas surgirão diante de você. Atrás de algumas, há esperança.",
  "Atrás de outras… apenas o vazio e o terror.",
  "Avance com cautela.",
  "O guardião espera",
  "pronto para testar sua coragem.",
  "Uma escolha errada,",
  "e ele estará à sua frente.",
  "Bem-vindo",
  "ao corredor",
  "do medo.",
  "Você ousa continuar?"
].join("\n\n");

// ===================== NARRAÇÃO  =====================
async function startNarration() {
  if (!window.audioAtivo || !narration) return;
  try {
    narration.currentTime = 0;
    narration.volume = 0.9;
    await narration.play();
  } catch (e) {
    console.warn("Falha narração:", e);
  }
}

// ===================== TYPEWRITER =====================
let typingActive = false;
let typingTimerId = null;

function stopTypeSfx() {
  try {
    if (typeSfxEl) {
      typeSfxEl.pause();
      typeSfxEl.currentTime = 0;
    }
  } catch { }
}

async function typewriterFixedDuration(el, texto) {
  el.textContent = "";
  typingActive = true;
  stopTypeSfx();
  await startNarration();

  const perChar = Math.max(4, CONFIG.TYPE_CHAR_DELAY | 0);
  const sfxEvery = Math.max(1, CONFIG.TYPE_SFX_EVERY | 0);

  await new Promise(resolve => {
    let i = 0;

    const tick = () => {
      if (!typingActive) return resolve();

      el.textContent += texto.charAt(i);

      if (window.audioAtivo && typeSfxEl && (i % sfxEvery === 0)) {
        try {
          typeSfxEl.currentTime = 0;
          typeSfxEl.volume = CONFIG.TYPE_SFX_VOLUME; // volume configurável
          typeSfxEl.play().catch(() => { });
        } catch { }
      }

      if (storyScrollEl && storyScrollEl.scrollHeight > storyScrollEl.clientHeight) {
        storyScrollEl.scrollTo({ top: storyScrollEl.scrollHeight, behavior: 'smooth' });
      }

      i++;
      if (i < texto.length) {
        const jitter = perChar * (0.7 + Math.random() * 0.6);
        typingTimerId = setTimeout(tick, jitter);
      } else {
        typingActive = false;
        stopTypeSfx();
        resolve();
      }
    };

    typingTimerId = setTimeout(tick, perChar);
  });
}

// ============ ABORT IMEDIATO (narração + digitação) ============
function abortStoryTyping({ showFullText = false } = {}) {
  // Para a digitação imediatamente
  typingActive = false;
  if (typingTimerId) clearTimeout(typingTimerId);
  stopTypeSfx();

  // Para a narração imediatamente
  try {
    if (narration) {
      narration.pause();
      narration.currentTime = 0;
    }
  } catch {}

  // Revela todo o texto (opcional)
  if (showFullText && storyTextEl) {
    storyTextEl.textContent = historiaCap1;
  }
}

// ===================== RESET / HOME =====================
function stopAllAudio() {
  try { narration.pause(); narration.currentTime = 0; } catch { }
  try { bgMusic.pause(); } catch { }
  stopTypeSfx();
}

function showHome() {
  document.querySelector('.overlay')?.style.removeProperty('display');
  try { bgVideo.style.filter = 'brightness(0.50) contrast(1.05) saturate(1.05) hue-rotate(-6deg)'; } catch { }
}

function hideHome() {
  const ov = document.querySelector('.overlay');
  if (ov) ov.style.display = 'none';
}

function resetStoryUI() {
  if (storyTextEl) storyTextEl.textContent = "";
  if (continueBtn) {
    continueBtn.hidden = true;
    continueBtn.classList.remove('is-visible');
  }
  if (storyScrollEl) storyScrollEl.scrollTop = 0;
}

function resetQuizUI() {
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

function resetGame() {
  typingActive = false;
  if (typingTimerId) clearTimeout(typingTimerId);
  stopAllAudio();

  if (scene1) scene1.hidden = true;
  resetStoryUI();
  resetQuizUI();

  showHome();
}

// ===================== CENA 1 =====================
async function startScene1() {
  if (!scene1) return;
  scene1.hidden = false;

  // ao iniciar a cena, deixa o "Pular diálogo" visível
  if (skipBtn) skipBtn.hidden = false; // :contentReference[oaicite:1]{index=1}

  if (char1) {
    char1.style.animation = 'none';
    void char1.offsetWidth;
    char1.style.animation = '';
  }

  if (storyScrollEl) storyScrollEl.scrollTop = 0;

  await typewriterFixedDuration(storyTextEl, historiaCap1);

  // a introdução acabou: esconde o "Pular diálogo" e mostra "Continuar ▶"
  if (storyScrollEl) {
    storyScrollEl.scrollTo({ top: storyScrollEl.scrollHeight, behavior: 'smooth' });
    setTimeout(() => {
      if (skipBtn) skipBtn.hidden = true; // :contentReference[oaicite:2]{index=2}
      continueBtn.hidden = false;
      continueBtn.classList.add('is-visible');
      continueBtn.focus({ preventScroll: true });
    }, 320);
  } else {
    if (skipBtn) skipBtn.hidden = true; // :contentReference[oaicite:3]{index=3}
    continueBtn.hidden = false;
    continueBtn.classList.add('is-visible');
    continueBtn.focus({ preventScroll: true });
  }
}

continueBtn?.addEventListener('click', () => {
  if (skipBtn) skipBtn.hidden = true; // garante sumir quando clica em Continuar :contentReference[oaicite:4]{index=4}
  abortStoryTyping();
  scene1.hidden = true;
  try { bgVideo.style.filter = 'brightness(0.35) contrast(1.1) saturate(1.05) hue-rotate(-6deg)'; } catch { }
  startQuiz();
});

// Botão "Pular diálogo" — corta tudo na hora e vai pro quiz
skipBtn?.addEventListener('click', () => {
  abortStoryTyping({ showFullText: false });
  if (skipBtn) skipBtn.hidden = true; // esconde ao pular também
  if (scene1) scene1.hidden = true;
  try { bgVideo.style.filter = 'brightness(0.35) contrast(1.1) saturate(1.05) hue-rotate(-6deg)'; } catch {}
  startQuiz();
});

// ===================== ATIVAÇÃO DE ÁUDIO =====================
async function enableAudio() {
  try {
    bgMusic.volume = 0.7;
    await bgMusic.play();
    window.audioAtivo = true;
  } catch (err) {
    console.warn("Erro ao ativar áudio:", err);
  }
}

audioEnableBtn?.addEventListener('click', async () => {
  await enableAudio();
  hideModal();
});

audioDismissBtn?.addEventListener('click', () => {
  window.audioAtivo = false;
  hideModal();
});

// ===================== INÍCIO DO JOGO =====================
startBtn?.addEventListener('click', () => {
  hideHome();
  bgVideo.style.filter = 'brightness(0.4) contrast(1.1) saturate(1.1) hue-rotate(-6deg)';
  setTimeout(startScene1, 250);
});

onFullscreenChange();

// ===================== QUIZ ENGINE =====================
const quizSection = document.getElementById('quiz');
const qTitle = document.getElementById('qTitle');
const qOptions = document.getElementById('qOptions');
const correctOverlay = document.getElementById('correctOverlay');
const rewardVideo = document.getElementById('rewardVideo');
const wrongFlash = document.getElementById('wrongFlash');

function setQuizInteractivity(enabled) {
  if (!quizSection) return;
  quizSection.style.pointerEvents = enabled ? 'auto' : 'none';
  qOptions.querySelectorAll('button').forEach(btn => {
    btn.disabled = !enabled;
  });
}

// ===== NOVO FORMATO DO QUIZ =====
// Agora cada "option" pode ser:
// - string (texto)  OU
// - objeto: { img: "caminho.png", alt: "descrição", label: "legenda opcional" }
const QUIZ = [
  // Pergunta em TEXTO + opções em IMAGEM
  {
    questionText: " Considere a funcao f (x) = 2x - 1. Qual dos gráficos abaixo corresponde a f?",
    options: [
      { img: "assets/images/quiz/resp1n.png",  alt: "Porta rangendo",     label: "a" },
      { img: "assets/images/quiz/resp1s.png",  alt: "Porta trancada",     label: "b" },
      { img: "assets/images/quiz/resp1_2n.png",alt: "Porta recém-pintada",label: "c" },
      { img: "assets/images/quiz/resp1_3n.png",alt: "Porta sem maçaneta", label: "d" }
    ],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  // Pergunta em TEXTO + opções em TEXTO (compatibilidade com seu formato antigo)
  {
    questionText: "Sejam A = {1,2,3,4} e B = {3,4,5,6}. Qual é A ∪ B?",
    options: ["{1,2,3,4}", "{3,4,5,6}", "{1,2,3,4,5,6}", "{1,2}"],
    answer: 2,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {2,4, 6,8} e B - {1,2,3,4}. Qual é A ∪ B?",
    options: ["{2,4}", "{1,2,3,4,6,8} ", "{1,3}", "{6,8}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {2,4, 6,8} e B = {1,2,3,4}. Qual é A ∩ B?",
    options: ["{1,3}", "{2,4}", "{1,2,3,4,6,8} ", "{6,8}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {1,3,5, 7,9} e B = {3,6,9}. Qual é A <> B?",
    options: ["{1,5,7}", "{3,6,9}", "{1,3,5,7,9} ", "{5,7,9}"],
    answer: 0,
    video: "assets/videos/door.mp4"
  },
];

const WRONG_IMAGES = ["assets/images/horror.png"];

let quizIndex = 0;
let bloqueado = false;

// ======= SHUFFLE UTILS (Fisher–Yates) =======
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Clona a pergunta e (opcionalmente) embaralha as opções
function cloneWithShuffledOptions(q) {
  if (!RANDOMIZE_OPTIONS) return { ...q };
  const optIdx = Array.from({ length: q.options.length }, (_, i) => i);
  shuffleInPlace(optIdx);

  const newOptions = optIdx.map(i => q.options[i]);
  const newAnswer  = optIdx.indexOf(q.answer);

  return { ...q, options: newOptions, answer: newAnswer };
}

let QUIZ_DECK = [];  // baralho vigente desta partida

function startQuiz() {
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

// ===== Helpers para rótulos A/B/C/D/E =====
function letterForIndex(i) {
  const letters = ['A','B','C','D','E','F','G'];
  return letters[i] || String(i + 1);
}
function isABCDLabel(val) {
  return typeof val === 'string' && /^[a-e]$/i.test(val);
}

// ====== render com suporte a pergunta/alternativas em imagem e rótulo sequencial ======
function renderQuestion() {
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
      // - se vier "a/b/c/d/e", troca pela letra da posição;
      // - se vier outra coisa (ex.: “reta crescente”), exibe "A — reta crescente";
      // - se não vier nada, exibe só a letra.
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

function onAnswer(i) {
  if (bloqueado) return;
  const node = QUIZ_DECK[quizIndex];
  const correto = (i === node.answer);
  if (correto) {
    playCorrect(node.video);
  } else {
    flashWrong();
  }
}

function flashWrong() {
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

  // Duração dinâmica da animação — usa os @keyframes 'flashJump' do CSS
  const durMs = Math.max(200, CONFIG.JUMPSCARE_DURATION_MS | 0);
  wrongFlash.style.animation = 'none';
  void wrongFlash.offsetWidth; // reflow
  wrongFlash.style.animation = `flashJump ${durMs}ms ease-out both`;

  // Ao terminar o jumpscare: esconde e reseta o jogo
  setTimeout(() => {
    wrongFlash.hidden = true;
    resetGame(); // reset limpa UI e volta à tela inicial
  }, durMs + 60);
}

async function playCorrect(videoPath) {
  if (bloqueado) return;
  bloqueado = true;

  // TRAVA cliques durante o acerto
  setQuizInteractivity(false);

  // blackout ON
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
    // sem vídeo: blackout curto
    setTimeout(avançar, 100);
  }
}

function avançar() {
  try { rewardVideo.pause(); } catch { }
  correctOverlay.hidden = true;
  bloqueado = false;

  quizIndex++;
  if (quizIndex < QUIZ_DECK.length) {
    setQuizInteractivity(true); // reabilita para a próxima pergunta
    renderQuestion();
  } else {
    fimDoQuiz();
  }
}

function fimDoQuiz() {
  // mensagem rápida e reset automático (usa AUTO_RESET_DELAY)
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
