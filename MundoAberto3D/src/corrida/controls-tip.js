// Painel "quais controles usar" no começo de cada mapa.
// Andar / correr / pular / bola de fogo aparecem uma vez só (por partida aberta na página);
// as interações do lugar (examinar, esconder, olhar o quadro…) aparecem toda vez que se entra nele.
// Cada item tem três versões: teclado (.ck), controle (.cp) e toque (.ct); o CSS mostra a do aparelho em uso.

const IMG = (f) => `<img src="img/trilha-sombria-controles/webp/${f}.webp" alt="" />`;

// [teclado, controle, toque, texto]
const C = {
  andar: ['<kbd>←</kbd><kbd>→</kbd>', '<b class="pb pb-wide">L</b>', IMG('andar-esquerda-normal') + IMG('andar-direita-normal'), 'andar'],
  correr: ['<kbd>Shift</kbd>', '<b class="pb pb-wide">RT</b>', IMG('correr-ligado'), 'correr'],
  pular: ['<kbd>Espaço</kbd>', '<b class="pb pb-a">A</b>', IMG('pular-normal'), 'pular <em>(segure: mais alto)</em>'],
  fogo: ['<kbd>F</kbd>', '<b class="pb pb-b">B</b>', IMG('bola-de-fogo-normal'), 'bola de fogo <em>(gasta óleo)</em>'],
  usar: ['<kbd>E</kbd>', '<b class="pb pb-y">Y</b>', IMG('interagir-normal'), 'examinar / usar <em>(quando aparecer)</em>'],
  ler: ['<kbd>E</kbd>', '<b class="pb pb-y">Y</b>', IMG('interagir-normal'), 'ler, abrir, esconder no armário'],
  quadro: ['<kbd>E</kbd><kbd>G</kbd>', '<b class="pb pb-y">Y</b><b class="pb pb-wide">RS</b>', IMG('olhar-quadro'), 'olhar o quadro de perto'],
  sair: ['<kbd>Q</kbd>', '<b class="pb pb-b">B</b>', IMG('fechar-janela'), 'fechar / voltar'],
};

// once: só na primeira vez que aparecem; always: toda vez que se entra no lugar
const SETS = {
  trilha: { title: 'Controles', once: ['andar', 'correr', 'pular', 'fogo', 'usar'], always: [] },
  // castelo: sem bola de fogo lá dentro
  castelo: {
    title: 'No castelo', once: ['andar', 'correr', 'pular'], always: ['ler', 'quadro', 'sair'],
    note: 'Aqui dentro a bola de fogo não funciona. Fuja ou se esconda.',
  },
  // Dimensão Plana: só os básicos que ainda não foram mostrados
  plano: { title: 'Controles', once: ['andar', 'correr', 'pular', 'fogo'], always: [] },
  // Casa do Mago: só andar; a conversa e o livro avançam com E / toque
  casa: { title: 'Na casa', once: ['andar', 'pular'], always: [], note: 'Ande até o fundo da casa. Alguém está à sua espera.' },
};
const seen = new Set();

let el = null, tShow = 0, tHide = 0;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ctl-tip';
  el.setAttribute('aria-live', 'polite');
  document.body.append(el);
  return el;
}

const row = (k) => {
  const [key, pad, touch, text] = C[k];
  return `<li><span class="ck">${key}</span><span class="cp">${pad}</span><span class="ct">${touch}</span><span class="cl">${text}</span></li>`;
};

/** Mostra os controles do mapa `kind` ('trilha' | 'castelo' | 'plano'). */
export function showControls(kind, { delay = 900, time = 7000 } = {}) {
  const set = SETS[kind];
  if (!set) return;
  const items = [...set.once.filter((k) => !seen.has(k)), ...set.always];
  if (!items.length) return;
  items.forEach((k) => seen.add(k));

  const box = ensure();
  clearTimeout(tShow); clearTimeout(tHide);
  box.classList.remove('show');
  box.innerHTML = `<div class="ctl-title">${set.title}</div><ul>${items.map(row).join('')}</ul>` +
    (set.note ? `<p class="ctl-note">${set.note}</p>` : '');
  tShow = setTimeout(() => box.classList.add('show'), delay);
  tHide = setTimeout(hideControls, delay + time);
}

export function hideControls() {
  clearTimeout(tShow); clearTimeout(tHide);
  el?.classList.remove('show');
}
