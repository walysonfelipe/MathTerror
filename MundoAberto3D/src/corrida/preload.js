/**
 * Tela de carregamento (estilo jogo): barra com progresso real, frase do que está
 * carregando e dicas trocando. Os arquivos são pré-baixados para o cache do navegador,
 * então quando o jogo pedir (modelos, retratos, sons) eles chegam na hora.
 */

const BASE = import.meta.env.BASE_URL;

// tudo que mora em public/ e só seria baixado no meio da partida
export const PRELOAD_IMAGES = ['img/logo-trilha-sombria-v3-1024.webp', 'img/barao.webp', 'img/dama.webp', 'img/crianca.webp']
  .map((p) => BASE + p);

export const PRELOAD_SOUNDS = [
  'ambiente-noite', 'aparicao', 'asas', 'batimento', 'corvo', 'erro', 'lanterna', 'papel', 'passos-grama',
  'pedra', 'porta-batendo', 'porta-rangendo', 'queda', 'respiracao', 'revelacao', 'rosnado', 'sino',
  'sumico', 'sussurros', 'tensao', 'vento',
  ...Object.entries({ terra: 8, corrida: 6, madeira: 5, pedra: 5 }).flatMap(([s, n]) => [...Array(n).keys()].map((i) => `passos/${s}_${i}`)),
  'passos/pulo', 'passos/aterrissagem',
].map((n) => `${BASE}sounds/${n}.mp3`);

const TIPS = [
  'A lanterna bebe óleo. Quando ela apaga, a trilha some no escuro…',
  'Na ponte, escolha tábuas que somem exatamente o tamanho do buraco.',
  'Dentro da Fenda, só a conta certa abre o caminho de volta.',
  'Junte os 3 pedaços da chave para sair do castelo.',
  'Bolas de fogo espantam o que rasteja na trilha.',
  'Se a Dama de Branco aparecer… esconda-se e prenda a respiração.',
  'Segure Shift (ou RT) para correr — mas o barulho atrai olhares.',
  'Os retratos do castelo guardam números. Olhe bem para eles.',
];

const $ = (id) => document.getElementById(id);

// imagens já decodificadas ficam guardadas aqui (senão o navegador decodifica na hora de mostrar)
const decoded = [];
export function decodeImages(urls) {
  return Promise.all(urls.map((src) => {
    const img = new Image();
    img.src = src;
    decoded.push(img);
    return img.decode().catch(() => {});
  }));
}

export function createBootScreen() {
  const root = $('boot');
  const bar = $('boot-bar');
  const pct = $('boot-pct');
  const text = $('boot-text');
  const tip = $('boot-tip');
  let started = performance.now();
  const bootStart = started;

  // ---------- vitrine no lugar da logo: logo → equipe → oferecimento → logo (o carregamento corre junto) ----------
  // a tela só termina depois que a vitrine volta para a logo
  const slides = [['boot-logo', 1000], ['boot-team', 9200], ['boot-sponsor', 4300], ['boot-logo', 0]]
    .map(([id, ms]) => ({ el: $(id), ms })).filter((x) => x.el);
  // a barra acompanha a vitrine: só enche de vez quando a logo volta no final (mesmo se tudo já baixou)
  const SHOWCASE_MS = slides.reduce((a, x) => a + x.ms, 0) + 2300;
  const introDone = new Promise((resolve) => {
    let i = 0;
    const next = () => {
      slides[i].el.classList.remove('on');
      i++;
      slides[i].el.classList.add('on');
      if (i >= slides.length - 1) { started = performance.now(); resolve(); return; }
      setTimeout(next, slides[i].ms);
    };
    if (slides.length < 2) resolve(); else setTimeout(next, slides[0].ms);
  });

  // brasas subindo pelo fundo (só CSS: não pesa enquanto o jogo carrega)
  for (let i = 0; i < 18; i++) {
    const e = document.createElement('i');
    e.className = 'ember';
    e.style.left = `${Math.random() * 100}%`;
    e.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    e.style.animationDuration = `${5 + Math.random() * 6}s`;
    e.style.animationDelay = `${-Math.random() * 10}s`;
    const s = 2 + Math.random() * 3;
    e.style.width = e.style.height = `${s}px`;
    root.prepend(e);
  }

  // ---------- dicas trocando ----------
  let tipI = Math.floor(Math.random() * TIPS.length);
  const showTip = () => {
    tip.classList.remove('on');
    setTimeout(() => { tip.textContent = TIPS[tipI++ % TIPS.length]; tip.classList.add('on'); }, 350);
  };
  showTip();
  const tipTimer = setInterval(showTip, 4200);

  // ---------- progresso: cada tarefa tem um peso (~ tamanho em MB) e um avanço 0..1 ----------
  const tasks = [];
  let shown = 0;     // valor exibido (anda suave até o real, nunca volta)
  let raf = 0;
  const target = () => {
    let w = 0, d = 0;
    for (const t of tasks) { w += t.weight; d += t.weight * t.p; }
    return w ? d / w : 0;
  };
  const paint = () => {
    // nunca à frente do tempo da vitrine; se a rede for lenta, segue o carregamento real
    const time = Math.min(1, (performance.now() - bootStart) / SHOWCASE_MS);
    const goal = Math.min(target(), time ** 0.9);
    shown += (goal - shown) * 0.12;
    if (goal - shown < 0.002) shown = goal;
    bar.style.width = `${(shown * 100).toFixed(1)}%`;
    pct.textContent = `${Math.floor(shown * 100)}%`;
    root.setAttribute('aria-valuenow', String(Math.floor(shown * 100)));
    raf = requestAnimationFrame(paint);
  };
  raf = requestAnimationFrame(paint);

  // a frase acompanha a primeira tarefa ainda não terminada
  const refreshLabel = () => {
    const t = tasks.find((x) => x.p < 1);
    if (t) text.textContent = t.label.replace(/[….]+$/, ''); // os pontinhos são animados no CSS
  };

  function track(label, weight = 1) {
    const t = { label, weight, p: 0 };
    tasks.push(t);
    refreshLabel();
    return {
      progress(p) { t.p = Math.max(t.p, Math.min(1, p)); refreshLabel(); },
      done() { t.p = 1; refreshLabel(); },
      /** troca a frase desta etapa (ex.: aquecendo um mundo de cada vez) */
      label(txt) { t.label = txt; refreshLabel(); },
    };
  }

  /** acompanha uma promessa sem progresso intermediário */
  function add(label, weight, promise) {
    const t = track(label, weight);
    return Promise.resolve(promise).finally(() => t.done());
  }

  /** baixa uma lista de arquivos (fica no cache do navegador), contando bytes */
  function fetchAll(label, urls, weight) {
    const t = track(label, weight);
    const each = urls.map(() => 0);
    const update = () => t.progress(each.reduce((a, b) => a + b, 0) / urls.length);
    return Promise.all(urls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        const total = Number(res.headers.get('content-length')) || 0;
        if (res.body && total) {
          const reader = res.body.getReader();
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            got += value.length;
            each[i] = Math.min(1, got / total);
            update();
          }
        } else {
          await res.arrayBuffer();
        }
      } catch { /* sem rede para esse arquivo: o jogo tenta de novo quando precisar */ }
      each[i] = 1;
      update();
    })).finally(() => t.done());
  }

  function fail(msg) {
    text.textContent = msg;
    root.classList.add('error');
  }

  /** termina: completa a barra, segura um instante e some com fade */
  async function finish(minMs = 2600) { // conta a partir da volta da logo: ela aparece bem antes do menu
    await introDone;
    for (const t of tasks) t.p = 1;
    text.textContent = 'A trilha te espera';
    const wait = Math.max(0, minMs - (performance.now() - started));
    await new Promise((r) => setTimeout(r, Math.max(wait, 450)));
    root.classList.add('done');
    clearInterval(tipTimer);
    await new Promise((r) => setTimeout(r, 900));
    cancelAnimationFrame(raf);
    root.remove();
  }

  return { track, add, fetchAll, fail, finish };
}
