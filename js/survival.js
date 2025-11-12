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

  const playerName = window.currentPlayer || 'Jogador';
  const scores = JSON.parse(localStorage.getItem('scores') || '[]');

  // Salva pontuação
  scores.push({ name: playerName, score: survivalScore, date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score);
  const topScores = scores.slice(0, 10);
  localStorage.setItem('scores', JSON.stringify(topScores));

  // Limpa tela
  qTitle.innerHTML = '';
  qOptions.innerHTML = '';

  // 🔻 Cria contêiner com mesmo estilo base da interface
  const wrap = document.createElement('div');
  wrap.className = 'quiz-inner';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.gap = '18px';
  wrap.style.animation = 'fadeInUp 0.8s ease-out both';

  // 🎬 Título principal
  const title = document.createElement('h2');
  title.textContent = '🩸 Fim do Modo Sobrevivência';
  title.style.fontFamily = '"Creepster", cursive';
  title.style.fontSize = '2.2rem';
  title.style.color = '#ff1a1a';
  title.style.textShadow = '0 0 25px rgba(255,0,0,.45)';
  title.style.letterSpacing = '2px';
  wrap.appendChild(title);

  // 💀 Bloco com pontuação
  const info = document.createElement('div');
  info.innerHTML = `
    <p style="font-size:1.3rem; letter-spacing:1px;">Jogador: <strong>${playerName}</strong></p>
    <p style="font-size:1.3rem;">Pontuação: <strong style="color:#ff2c2c">${survivalScore}</strong></p>
  `;
  info.style.color = '#fff';
  info.style.textAlign = 'center';
  wrap.appendChild(info);

  // 😈 Caso não tenha atingido 3 pontos
  if (survivalScore < 3) {
    const low = document.createElement('p');
    low.textContent = 'Você não sobreviveu tempo suficiente... tente novamente!';
    low.style.fontFamily = '"Spectral SC", serif';
    low.style.color = '#ccc';
    low.style.opacity = '.85';
    low.style.textShadow = '0 0 8px #400';
    low.style.fontSize = '1.1rem';
    low.style.marginTop = '8px';
    wrap.appendChild(low);
  } else {
    // 🏆 Ranking
    const rankTitle = document.createElement('h3');
    rankTitle.textContent = '🏆 Top 10 Sobreviventes';
    rankTitle.style.fontFamily = '"Creepster", cursive';
    rankTitle.style.color = '#ffcc00';
    rankTitle.style.textShadow = '0 0 20px rgba(255,200,0,0.4)';
    rankTitle.style.fontSize = '1.6rem';
    rankTitle.style.marginTop = '10px';
    wrap.appendChild(rankTitle);

    const list = document.createElement('div');
    list.style.width = '100%';
    list.style.maxHeight = '200px';
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    list.style.marginTop = '6px';

    topScores.forEach((s, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || '🎯';
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = 'rgba(40,0,0,.45)';
      row.style.border = '1px solid rgba(255,0,0,.25)';
      row.style.borderRadius = '10px';
      row.style.padding = '8px 14px';
      row.style.transition = 'transform .25s ease';
      row.style.fontSize = '1.05rem';
      row.style.color = '#fff';

      if (s.name === playerName && s.score === survivalScore) {
        row.style.background = 'rgba(150,0,0,.55)';
        row.style.boxShadow = '0 0 22px rgba(255,0,0,.25)';
        row.style.transform = 'scale(1.02)';
      }

      row.innerHTML = `
        <span>${medal} ${s.name}</span>
        <span style="color:#ff2c2c;font-weight:600;">${s.score}</span>
      `;

      row.addEventListener('mouseover', () => (row.style.transform = 'scale(1.04)'));
      row.addEventListener('mouseout', () => (row.style.transform = s.name === playerName ? 'scale(1.02)' : 'scale(1)'));

      list.appendChild(row);
    });

    wrap.appendChild(list);
  }

  // 🔁 Botão jogar novamente — usa classe global
  const retry = document.createElement('button');
  retry.className = 'btn btn--blood-primary';
  retry.textContent = 'Jogar Novamente 🔄';
  retry.style.marginTop = '20px';
  retry.addEventListener('click', () => resetGame());
  wrap.appendChild(retry);

  qOptions.appendChild(wrap);
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
  title.textContent = 'Digite seu nome para começar';
  title.style.fontSize = '1.5rem';
  title.style.marginBottom = '16px';
  overlay.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
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

  document.body.appendChild(overlay);
}

