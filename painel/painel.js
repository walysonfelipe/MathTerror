// Painel da professora: lê a API do servidor local e monta um relatório em linguagem de sala de aula.
// Todo texto vindo dos dados entra com textContent, nunca como HTML.

const ATUALIZAR_A_CADA_MS = 30_000;
const MIN_RESPOSTAS = 5;        // abaixo disso a porcentagem aparece com "poucos dados"
const DIFERENCA_RELEVANTE = 0.15;
const CONTAS_POR_VEZ = 10;

// Faixas de situação do domínio (acerto de primeira)
const DOMINA = 0.8;
const DESENVOLVENDO = 0.5;

// Ordem e textos das operações. Os exemplos de cada faixa vêm das faixas de js/runner-quiz.js.
const OPERACOES = [
  {
    chave: 'adicao', nome: 'Adição', etapa: 'vaiUm', etapaNome: 'vai-um',
    niveis: ['dezena + unidade, ex.: 46 + 9', 'dezena + dezena, ex.: 35 + 22', 'com vai-um, ex.: 47 + 25'],
  },
  {
    chave: 'subtracao', nome: 'Subtração', etapa: 'emprestimo', etapaNome: 'empréstimo',
    niveis: ['dezena − unidade, ex.: 27 − 6', 'dezena − dezena, ex.: 64 − 21', 'com empréstimo, ex.: 83 − 29'],
  },
  {
    chave: 'multiplicacao', nome: 'Multiplicação',
    niveis: ['dezena × 2 a 5, ex.: 17 × 5', 'dezena × 3 a 7, ex.: 24 × 6', 'dezena × 4 a 9, ex.: 38 × 7'],
  },
  {
    chave: 'divisao', nome: 'Divisão',
    niveis: ['por 2 a 5, ex.: 40 ÷ 5', 'por 3 a 9, ex.: 72 ÷ 8', 'por 6 a 12, ex.: 132 ÷ 11'],
  },
  {
    chave: 'tabuada', nome: 'Tabuada',
    niveis: ['tabuadas do 2 ao 6, ex.: 3 × 4', 'do 2 ao 10, às vezes com fator escondido, ex.: 7 × ? = 56', 'do 6 ao 10, ex.: 8 × ? = 72'],
  },
];
const NOME_OPERACAO = Object.fromEntries(OPERACOES.map(o => [o.chave, o.nome]));
const NOMES_NIVEL = ['Fácil', 'Médio', 'Difícil'];

// O que cada alternativa errada indica, em linguagem de sala de aula
const ERROS = {
  esqueceu_vai_um: {
    titulo: 'Esqueceu o “vai um”',
    indica: 'Somou as unidades, mas não levou a dezena para a casa seguinte.',
    sugestao: 'Retomar a adição com reagrupamento no quadro de valor posicional (ou com material dourado).',
  },
  dezena_a_mais: {
    titulo: 'Somou uma dezena a mais',
    indica: 'Levou “vai um” sem precisar, ou contou a dezena duas vezes.',
    sugestao: 'Pedir que confiram se a soma das unidades passou de 9 antes de levar o “vai um”.',
  },
  emprestimo_invertido: {
    titulo: 'Inverteu a subtração na unidade',
    indica: 'Em vez de desagrupar uma dezena, subtraiu o menor algarismo do maior (em 83 − 29, fez 9 − 3).',
    sugestao: 'Retomar a subtração com reagrupamento, mostrando a troca de 1 dezena por 10 unidades.',
  },
  erro_na_dezena: {
    titulo: 'Errou a casa das dezenas',
    indica: 'A unidade está certa, mas o resultado ficou 10 acima ou abaixo.',
    sugestao: 'Reforçar valor posicional e o hábito de conferir a dezena no fim da conta.',
  },
  linha_vizinha: {
    titulo: 'Pegou a linha vizinha da tabuada',
    indica: 'Multiplicou por um número a mais ou a menos, por exemplo 7 × 6 no lugar de 7 × 7.',
    sugestao: 'Treinar a tabuada em sequência e por saltos (7, 14, 21…), relacionando cada linha com a anterior.',
  },
  tabuada_vizinha: {
    titulo: 'Usou a tabuada vizinha',
    indica: 'Confundiu a tabuada, por exemplo 8 × 6 no lugar de 7 × 6.',
    sugestao: 'Trabalhar as tabuadas que mais se confundem lado a lado e usar a comutatividade (7 × 8 = 8 × 7).',
  },
  respondeu_divisor: {
    titulo: 'Respondeu o divisor',
    indica: 'Deu como resposta o número pelo qual se divide, não o resultado da divisão.',
    sugestao: 'Ligar divisão e multiplicação: 42 ÷ 6 = ? é o mesmo que 6 × ? = 42.',
  },
  erro_por_pouco: {
    titulo: 'Errou por pouco (1 ou 2)',
    indica: 'O raciocínio está certo, mas houve um deslize na contagem.',
    sugestao: 'Incentivar a estimativa e a conferência rápida do resultado.',
  },
  proximo_aleatorio: {
    titulo: 'Sem padrão identificado',
    indica: 'A alternativa escolhida não corresponde a um erro típico. Pode ter sido chute.',
    sugestao: '',
  },
};

const MOTIVOS = {
  luta_perdida: 'Perdeu a luta contra o monstro',
  capturado: 'Foi pego pelo monstro',
  lava: 'Caiu na lava (dificuldade com o controle do jogo)',
  abandono_esc: 'Saiu no meio da partida',
  abandono_aba: 'Fechou o jogo no meio da partida',
};

const $ = id => document.getElementById(id);
const numero = new Intl.NumberFormat('pt-BR');
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const diaMesAno = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const pct = taxa => (taxa === null || taxa === undefined || Number.isNaN(taxa) ? '—' : `${Math.round(taxa * 100)}%`);
const plural = (n, um, varios) => `${numero.format(n)} ${n === 1 ? um : varios}`;

let periodo = lerPreferencia() || 'tudo';
let dados = null;
let contasMostradas = CONTAS_POR_VEZ;

// ===================== UTILIDADES =====================
function el(tag, props = {}, ...filhos) {
  const node = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (chave === 'class') node.className = valor;
    else if (chave === 'text') node.textContent = valor;
    else if (chave === 'style') Object.assign(node.style, valor);
    else node.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined && filho !== false) node.append(filho);
  }
  return node;
}

function duracao(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const total = Math.round(segundos);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (!min) return `${seg} s`;
  return seg ? `${min} min ${seg} s` : `${min} min`;
}

function dataLocal(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dataDoTexto(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function intervaloDoPeriodo() {
  if (periodo.startsWith('dia:')) {
    const dia = periodo.slice(4);
    return { de: dia, ate: dia };
  }
  if (periodo === 'tudo') return {};
  const hoje = new Date();
  const inicio = new Date(hoje);
  if (periodo !== 'hoje') inicio.setDate(hoje.getDate() - (Number(periodo) - 1));
  return { de: dataLocal(inicio), ate: dataLocal(hoje) };
}

function descricaoDoPeriodo() {
  if (periodo.startsWith('dia:')) return `no dia ${diaMesAno.format(dataDoTexto(periodo.slice(4)))}`;
  if (periodo === 'tudo') return 'desde o começo';
  const { de, ate } = intervaloDoPeriodo();
  if (periodo === 'hoje') return `hoje, ${diaMes.format(dataDoTexto(ate))}`;
  return `nos últimos ${periodo} dias (${diaMes.format(dataDoTexto(de))} a ${diaMes.format(dataDoTexto(ate))})`;
}

function lerPreferencia() {
  try { return localStorage.getItem('painel-periodo'); } catch { return null; }
}
function salvarPreferencia(valor) {
  try { localStorage.setItem('painel-periodo', valor); } catch { }
}

// "Quanto é 14 + 5?" → "14 + 5"; "Tabuada do 3: 3 × 4 = ?" → "3 × 4"; "Tabuada do 7: 7 × ? = 56" fica "7 × ? = 56"
function contaCurta(texto) {
  return String(texto).replace(/^Quanto é\s*/, '').replace(/^Tabuada do \d+:\s*/, '').replace(/\s*=\s*\?$/, '').replace(/\?$/, '');
}

// ===================== ÍCONES E SELOS =====================
const SVG = 'http://www.w3.org/2000/svg';
const ICONES = {
  bom: { cor: 'var(--bom)', caminho: 'M5 10.5l3 3 7-7' },
  atencao: { cor: 'var(--atencao)', caminho: 'M10 6v5M10 14h.01' },
  critico: { cor: 'var(--critico)', caminho: 'M7 7l6 6M13 7l-6 6' },
  neutro: { cor: 'var(--neutro)', caminho: 'M6.5 10h7' },
  info: { cor: 'var(--serie)', caminho: 'M10 9v5M10 6h.01' },
};

function icone(tipo, tamanho = 18) {
  const { cor, caminho } = ICONES[tipo];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const circulo = document.createElementNS(SVG, 'circle');
  Object.entries({ cx: 10, cy: 10, r: 9, fill: cor }).forEach(([k, v]) => circulo.setAttribute(k, v));
  const traco = document.createElementNS(SVG, 'path');
  Object.entries({ d: caminho, stroke: '#0b0c0e', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
    .forEach(([k, v]) => traco.setAttribute(k, v));
  svg.append(circulo, traco);
  return svg;
}

function situacao(taxa, respostas) {
  if (!respostas || respostas < MIN_RESPOSTAS) return { tipo: 'neutro', texto: 'Poucos dados' };
  if (taxa >= DOMINA) return { tipo: 'bom', texto: 'Domina' };
  if (taxa >= DESENVOLVENDO) return { tipo: 'atencao', texto: 'Em desenvolvimento' };
  return { tipo: 'critico', texto: 'Precisa reforçar' };
}

function selo({ tipo, texto }) {
  return el('span', { class: `selo selo--${tipo}` }, icone(tipo, 16), texto);
}

// ===================== DICA (TOOLTIP) =====================
const dica = $('dica');
const dicas = new WeakMap();

function comDica(node, valor, rotulo, extra) {
  dicas.set(node, { valor, rotulo, extra });
  node.tabIndex = 0;
  node.setAttribute('aria-label', [valor, rotulo, extra].filter(Boolean).join(', '));
  return node;
}

function mostrarDica(node, x, y) {
  const info = dicas.get(node);
  if (!info) return;
  dica.replaceChildren(el('strong', { text: info.valor }), el('span', { text: info.rotulo }), info.extra ? el('span', { text: info.extra }) : null);
  dica.hidden = false;
  const caixa = dica.getBoundingClientRect();
  const left = Math.min(window.innerWidth - caixa.width - 8, x + 14);
  const top = y + caixa.height + 20 > window.innerHeight ? y - caixa.height - 14 : y + 14;
  dica.style.left = `${Math.max(8, left)}px`;
  dica.style.top = `${Math.max(8, top)}px`;
}

function alvoComDica(evento) {
  for (let node = evento.target; node && node !== document.body; node = node.parentElement) {
    if (dicas.has(node)) return node;
  }
  return null;
}

document.addEventListener('pointermove', evento => {
  const alvo = alvoComDica(evento);
  if (alvo) mostrarDica(alvo, evento.clientX, evento.clientY);
  else dica.hidden = true;
});
document.addEventListener('focusin', evento => {
  const alvo = alvoComDica(evento);
  if (!alvo) return;
  const caixa = alvo.getBoundingClientRect();
  mostrarDica(alvo, caixa.left + caixa.width / 2, caixa.bottom);
});
document.addEventListener('focusout', () => { dica.hidden = true; });
document.addEventListener('scroll', () => { dica.hidden = true; }, { passive: true });

// ===================== PEÇAS DE GRÁFICO =====================
function medidor(taxa) {
  return el('div', { class: 'medidor', 'aria-hidden': 'true' }, el('span', { style: { width: `${Math.round((taxa || 0) * 100)}%` } }));
}

function semDados(container, texto) {
  container.replaceChildren(el('p', { class: 'sem-dados', text: texto }));
}

// linhas: { rotulo, valor, texto, sub?, dica: [valor, rotulo, extra] }
function barras(container, linhas, maximo) {
  const max = maximo ?? Math.max(1, ...linhas.map(l => l.valor));
  container.replaceChildren(el('div', { class: 'barras' }, linhas.flatMap(l => {
    const trilha = comDica(el('div', { class: 'barra-trilha' },
      el('div', { class: 'barra', style: { width: `${(l.valor / max) * 100}%` } })), ...l.dica);
    return [
      el('span', { class: 'barra-rotulo', text: l.rotulo }),
      trilha,
      el('span', { class: 'barra-valor' }, l.texto, l.sub ? el('small', { text: l.sub }) : null),
    ];
  })));
}

// ===================== CONTAS GERAIS =====================
function totaisDeContas(est) {
  const ops = Object.values(est.porTipoConta);
  const respondidas = ops.reduce((s, o) => s + o.respondidas, 0);
  const primeira = ops.reduce((s, o) => s + o.acertosPrimeiraTentativa, 0);
  const tempoPonderado = ops.reduce((s, o) => s + (o.tempoMedioPrimeiraRespostaSeg || 0) * o.respondidas, 0);
  return {
    respondidas,
    primeira,
    taxa: respondidas ? primeira / respondidas : null,
    tempoMedio: respondidas ? tempoPonderado / respondidas : null,
  };
}

// O monstro leva 30 s para chegar: na 1ª resposta, "longe" quer dizer que o aluno respondeu logo.
// Logo = monstro em até 25% do caminho (cerca de 7 s); demorou = depois disso.
function calmaEPressa(est) {
  const junta = faixas => {
    const tentativas = faixas.reduce((s, f) => s + f.tentativas, 0);
    const acertos = faixas.reduce((s, f) => s + f.acertos, 0);
    return { tentativas, acertos, taxa: tentativas ? acertos / tentativas : null };
  };
  return { logo: junta(est.pressao.slice(0, 1)), demorou: junta(est.pressao.slice(1)) };
}

// Totais de cada tipo de erro somando todas as operações
function errosAgrupados(est) {
  const porErro = {};
  for (const [operacao, lista] of Object.entries(est.tiposErro)) {
    for (const { tipoErro, vezes } of lista) {
      const item = porErro[tipoErro] ||= { tipoErro, vezes: 0, operacoes: {} };
      item.vezes += vezes;
      item.operacoes[operacao] = (item.operacoes[operacao] || 0) + vezes;
    }
  }
  const lista = Object.values(porErro);
  const total = lista.reduce((s, e) => s + e.vezes, 0);
  // "Sem padrão" sempre por último: não ajuda a planejar a aula
  lista.sort((a, b) => (a.tipoErro === 'proximo_aleatorio') - (b.tipoErro === 'proximo_aleatorio') || b.vezes - a.vezes);
  return { lista, total };
}

// ===================== SEÇÕES =====================
function desenharCabecalho(est, totais) {
  $('frase-periodo').textContent = est.totalPartidas
    ? `${plural(est.totalPartidas, 'partida', 'partidas')} ${descricaoDoPeriodo()}.`
    : `Nenhuma partida ${descricaoDoPeriodo()}.`;

  const aviso = $('aviso-poucos');
  aviso.hidden = totais.respondidas >= 20;
  aviso.textContent = `Ainda há poucas respostas (${numero.format(totais.respondidas)}). As porcentagens podem mudar bastante com novas partidas; use-as como primeira pista.`;
}

function desenharVisaoGeral(est, totais) {
  $('n-acerto').textContent = pct(totais.taxa);
  $('n-acerto-nota').textContent = totais.respondidas
    ? `${numero.format(totais.primeira)} de ${plural(totais.respondidas, 'conta', 'contas')}, sem errar antes`
    : 'nenhuma conta respondida';
  $('n-partidas').textContent = numero.format(est.totalPartidas);
  $('n-partidas-nota').textContent = `cada uma dura em média ${duracao(est.tempoJogado.medioSeg)}`;
  $('n-contas').textContent = numero.format(totais.respondidas);
  $('n-tempo').textContent = duracao(totais.tempoMedio);
}

function desenharDestaques(est, totais) {
  const itens = [];
  const ops = OPERACOES
    .map(o => ({ ...o, dados: est.porTipoConta[o.chave] }))
    .filter(o => o.dados && o.dados.respondidas >= MIN_RESPOSTAS)
    .sort((a, b) => b.dados.taxaPrimeiraTentativa - a.dados.taxaPrimeiraTentativa);

  const forte = ops[0];
  if (forte && forte.dados.taxaPrimeiraTentativa >= DESENVOLVENDO) {
    const domina = forte.dados.taxaPrimeiraTentativa >= DOMINA;
    itens.push([domina ? 'bom' : 'info', domina ? `A turma domina ${forte.nome.toLowerCase()}` : `Melhor resultado: ${forte.nome.toLowerCase()}`,
      `${pct(forte.dados.taxaPrimeiraTentativa)} de acerto de primeira em ${plural(forte.dados.respondidas, 'conta', 'contas')}.`]);
  }
  const fraca = ops[ops.length - 1];
  if (fraca && fraca !== forte && fraca.dados.taxaPrimeiraTentativa < DOMINA) {
    itens.push([fraca.dados.taxaPrimeiraTentativa < DESENVOLVENDO ? 'critico' : 'atencao', `${fraca.nome} pede mais atenção`,
      `${pct(fraca.dados.taxaPrimeiraTentativa)} de acerto de primeira em ${plural(fraca.dados.respondidas, 'conta', 'contas')}.`]);
  }

  for (const o of OPERACOES.filter(o => o.etapa)) {
    const { com, sem } = est[o.etapa];
    if (com.respondidas >= 3 && sem.respondidas >= 3
      && sem.taxaPrimeiraTentativa - com.taxaPrimeiraTentativa >= DIFERENCA_RELEVANTE) {
      itens.push(['atencao', `Contas com ${o.etapaNome} derrubam a turma`,
        `${o.nome}: ${pct(com.taxaPrimeiraTentativa)} de acerto com ${o.etapaNome}, contra ${pct(sem.taxaPrimeiraTentativa)} sem.`]);
    }
  }

  const { lista, total } = errosAgrupados(est);
  const comum = lista.find(e => e.tipoErro !== 'proximo_aleatorio' && e.vezes >= 2);
  if (comum) {
    itens.push(['info', `Erro mais frequente: ${ERROS[comum.tipoErro]?.titulo || comum.tipoErro}`,
      `${plural(comum.vezes, 'vez', 'vezes')} (${pct(comum.vezes / total)} dos erros). ${ERROS[comum.tipoErro]?.indica || ''}`]);
  }

  const { logo, demorou } = calmaEPressa(est);
  if (logo.tentativas >= MIN_RESPOSTAS && demorou.tentativas >= MIN_RESPOSTAS) {
    if (demorou.taxa - logo.taxa >= DIFERENCA_RELEVANTE) {
      itens.push(['atencao', 'Quem responde muito rápido erra mais',
        `Respostas imediatas acertam ${pct(logo.taxa)}; as pensadas com mais calma, ${pct(demorou.taxa)}. Pode haver chute.`]);
    } else if (logo.taxa - demorou.taxa >= DIFERENCA_RELEVANTE) {
      itens.push(['atencao', 'Quando a turma trava, costuma errar',
        `Respostas imediatas acertam ${pct(logo.taxa)}; as que demoraram, ${pct(demorou.taxa)}.`]);
    }
  }

  const lava = est.motivosFim.lava || 0;
  if (est.totalPartidas >= 3 && lava / est.totalPartidas >= 0.3) {
    itens.push(['neutro', 'Muitas partidas acabam na lava',
      `${pct(lava / est.totalPartidas)} das partidas terminaram por queda: é dificuldade com o controle do jogo, não com as contas.`]);
  }

  if (!itens.length) {
    itens.push(['neutro', 'Ainda não dá para tirar conclusões',
      `Os destaques aparecem quando houver pelo menos ${MIN_RESPOSTAS} respostas por operação. Até agora são ${plural(totais.respondidas, 'conta respondida', 'contas respondidas')}.`]);
  }

  $('destaques').replaceChildren(...itens.map(([tipo, titulo, texto]) =>
    el('li', { class: `destaque destaque--${tipo}` }, icone(tipo, 20), el('div', {}, el('strong', { text: titulo }), el('p', { text: texto })))));
}

function desenharLegendaStatus() {
  $('legenda-status').replaceChildren(
    selo({ tipo: 'bom', texto: `Domina: ${Math.round(DOMINA * 100)}% ou mais` }),
    selo({ tipo: 'atencao', texto: `Em desenvolvimento: ${Math.round(DESENVOLVENDO * 100)}% a ${Math.round(DOMINA * 100) - 1}%` }),
    selo({ tipo: 'critico', texto: `Precisa reforçar: abaixo de ${Math.round(DESENVOLVENDO * 100)}%` }),
    selo({ tipo: 'neutro', texto: `Poucos dados: menos de ${MIN_RESPOSTAS} respostas` }),
  );
}

function desenharOperacoes(est) {
  $('operacoes').replaceChildren(...OPERACOES.map(o => {
    const d = est.porTipoConta[o.chave];
    const sit = situacao(d.taxaPrimeiraTentativa, d.respondidas);
    const cartao = el('article', { class: `operacao operacao--${sit.tipo}` },
      el('div', { class: 'operacao-topo' }, el('h3', { text: o.nome }), selo(sit)));

    if (!d.respondidas) {
      cartao.append(el('p', { class: 'operacao-linha', text: 'Nenhuma conta desta operação foi respondida ainda.' }));
      return cartao;
    }

    cartao.append(
      el('div', { class: 'operacao-taxa' }, pct(d.taxaPrimeiraTentativa), el('small', { text: 'de primeira' })),
      medidor(d.taxaPrimeiraTentativa),
      el('p', { class: 'operacao-linha', text: `${numero.format(d.acertosPrimeiraTentativa)} de ${plural(d.respondidas, 'conta', 'contas')} certas de primeira · ${duracao(d.tempoMedioPrimeiraRespostaSeg)} para responder, em média` }),
    );

    // Fácil / médio / difícil
    const niveis = el('div', { class: 'niveis' }, el('span', { class: 'niveis-titulo', text: 'Por dificuldade' }));
    NOMES_NIVEL.forEach((nomeNivel, nivel) => {
      const n = d.porNivel[nivel];
      const respondidas = n?.respondidas || 0;
      const barra = el('div', { class: `nivel-barra${respondidas ? '' : ' vazia'}` },
        el('span', { style: { width: `${Math.round((n?.taxaPrimeiraTentativa || 0) * 100)}%` } }));
      comDica(barra, respondidas ? pct(n.taxaPrimeiraTentativa) : 'Sem respostas', `${o.nome} · ${nomeNivel.toLowerCase()}: ${o.niveis[nivel]}`,
        respondidas ? `${n.acertosPrimeiraTentativa} de ${plural(respondidas, 'conta', 'contas')} de primeira` : 'A turma ainda não chegou nesta dificuldade.');
      niveis.append(
        el('span', { class: 'nivel-nome', text: nomeNivel }),
        barra,
        el('span', { class: 'nivel-valor' }, respondidas ? pct(n.taxaPrimeiraTentativa) : '—', respondidas ? el('small', { text: ` (${respondidas})` }) : null),
      );
    });
    cartao.append(niveis);

    // Vai-um / empréstimo
    if (o.etapa) {
      const { com, sem } = est[o.etapa];
      if (com.respondidas || sem.respondidas) {
        cartao.append(el('p', { class: 'etapa' },
          'Com ', o.etapaNome, ': ', el('strong', { text: pct(com.taxaPrimeiraTentativa) }), ` (${com.respondidas})`,
          ' · sem: ', el('strong', { text: pct(sem.taxaPrimeiraTentativa) }), ` (${sem.respondidas})`));
      }
    }
    return cartao;
  }));
}

function desenharErros(est) {
  const container = $('erros');
  const { lista, total } = errosAgrupados(est);
  if (!total) return semDados(container, 'Nenhuma resposta errada neste período.');

  const exemplosPorErro = {};
  for (const e of est.errosDetalhados) {
    const lista = exemplosPorErro[e.tipoErro] ||= [];
    if (lista.length < 3 && !lista.some(x => x.texto === e.texto)) lista.push(e);
  }

  container.replaceChildren(...lista.map(e => {
    const info = ERROS[e.tipoErro] || { titulo: e.tipoErro, indica: '', sugestao: '' };
    const onde = Object.entries(e.operacoes).sort((a, b) => b[1] - a[1]).map(([op]) => NOME_OPERACAO[op] || op).join(', ');
    const exemplos = (exemplosPorErro[e.tipoErro] || []).map(x => el('span', { class: 'exemplo' },
      `${contaCurta(x.texto)} → respondeu `, el('s', { text: String(x.valorEscolhido) }), ` (certo: ${x.respostaCorreta})`));
    return el('article', { class: 'erro' },
      el('div', { class: 'erro-cabeca' },
        el('h3', { text: info.titulo }),
        el('span', { class: 'erro-onde', text: `Aparece em: ${onde}` }),
        el('div', { class: 'erro-freq' }, medidor(e.vezes / total), `${plural(e.vezes, 'vez', 'vezes')} · ${pct(e.vezes / total)} dos erros`)),
      el('div', { class: 'erro-corpo' },
        el('p', { text: info.indica }),
        exemplos.length ? el('div', { class: 'exemplos' }, exemplos) : null,
        info.sugestao ? el('p', { class: 'sugestao' }, el('strong', { text: 'Ideia para a aula: ' }), info.sugestao) : null));
  }));
}

function desenharContasErradas(est) {
  const tabela = $('contas-erradas');
  const lista = est.errosDetalhados;
  const botao = $('mais-contas');
  if (!lista.length) {
    tabela.replaceChildren(el('caption', { class: 'sem-dados', text: 'Nenhuma conta errada neste período.' }));
    botao.hidden = true;
    return;
  }
  const visiveis = lista.slice(0, contasMostradas);
  tabela.replaceChildren(
    el('thead', {}, el('tr', {},
      el('th', { text: 'Conta' }), el('th', { class: 'num', text: 'Resposta certa' }), el('th', { class: 'num', text: 'Respondeu' }),
      el('th', { text: 'Provável erro' }), el('th', { text: 'Dificuldade' }), el('th', { text: 'Quando' }))),
    el('tbody', {}, visiveis.map(e => {
      const quando = new Date(e.quando);
      return el('tr', {},
        el('td', { class: 'conta', text: contaCurta(e.texto) }),
        el('td', { class: 'num', text: String(e.respostaCorreta) }),
        el('td', { class: 'num errada', text: String(e.valorEscolhido) }),
        el('td', { text: ERROS[e.tipoErro]?.titulo || '—' }),
        el('td', { text: `${NOME_OPERACAO[e.tipo] || e.tipo}, ${(NOMES_NIVEL[e.nivel] || '').toLowerCase()}` }),
        el('td', { text: `${diaMes.format(quando)} às ${hora.format(quando)}${e.tentativa > 1 ? ` · ${e.tentativa}ª tentativa` : ''}` }));
    })));
  botao.hidden = lista.length <= contasMostradas;
  botao.textContent = `Mostrar mais contas (${numero.format(lista.length - contasMostradas)} restantes)`;
}

function desenharPressa(est) {
  const container = $('pressa');
  const { logo, demorou } = calmaEPressa(est);
  if (!logo.tentativas && !demorou.tentativas) return semDados(container, 'Ainda não há respostas para comparar.');

  const caixa = (rotulo, g) => el('div', {},
    el('span', { class: 'rotulo', text: rotulo }),
    el('span', { class: 'valor', text: pct(g.taxa) }),
    el('span', { class: 'nota', text: g.tentativas ? `de acerto em ${plural(g.tentativas, 'resposta', 'respostas')}` : 'sem respostas' }));

  let conclusao;
  if (logo.tentativas < MIN_RESPOSTAS || demorou.tentativas < MIN_RESPOSTAS) {
    conclusao = 'Ainda há poucas respostas para comparar as duas situações.';
  } else if (demorou.taxa - logo.taxa >= DIFERENCA_RELEVANTE) {
    conclusao = 'Quem responde muito rápido erra mais: pode ser chute. Vale incentivar a conferir a conta antes de escolher.';
  } else if (logo.taxa - demorou.taxa >= DIFERENCA_RELEVANTE) {
    conclusao = 'Quando a turma demora, costuma errar: são as contas em que ela trava. Veja quais são na lista de contas erradas.';
  } else {
    conclusao = 'O tempo para responder não muda muito os acertos: os erros vêm mais do conteúdo do que da pressa.';
  }
  container.replaceChildren(
    el('div', { class: 'comparacao' }, caixa('Respondeu logo (monstro longe)', logo), caixa('Pensou mais (monstro se aproximando)', demorou)),
    el('p', { class: 'conclusao', text: `${conclusao} Conta só a primeira resposta de cada pergunta.` }));
}

function desenharRapido(est) {
  const container = $('rapido');
  const l = est.lutas;
  if (!l.total) return semDados(container, 'Ninguém precisou enfrentar o monstro neste período.');
  const linhas = ['adicao', 'subtracao', 'multiplicacao', 'divisao']
    .map(op => [op, l.porTipoConta[op]])
    .filter(([, d]) => d.rodadas)
    .map(([op, d]) => ({
      rotulo: NOME_OPERACAO[op],
      valor: d.taxaAcerto ?? 0,
      texto: pct(d.taxaAcerto),
      sub: `(${d.rodadas})`,
      dica: [pct(d.taxaAcerto), `${NOME_OPERACAO[op]} em cálculo rápido`, `${d.acertos} de ${plural(d.rodadas, 'conta', 'contas')} · ${duracao(d.tempoMedioSeg)} por conta, em média`],
    }));
  barras(container, linhas, 1);
  container.prepend(el('p', { class: 'operacao-linha', style: { margin: '0 0 12px' },
    text: `${plural(l.total, 'luta', 'lutas')}, ${pct(l.taxaVitoria)} vencidas (é preciso acertar pelo menos 2 das 4 contas).` }));
}

function desenharProgresso(est) {
  const container = $('progresso');
  const itens = est.sobrevivencia.filter(s => s.checkpoint > 0);
  if (!itens.length) {
    semDados(container, 'Nenhuma partida chegou à primeira porta ainda.');
  } else {
    const mostrarValores = itens.length <= 12;
    const passo = itens.length <= 16 ? 1 : Math.ceil(itens.length / 12);
    container.replaceChildren(
      el('div', { class: 'colunas' }, itens.map(s => comDica(
        el('div', { class: 'coluna' },
          mostrarValores ? el('span', { class: 'coluna-valor', text: pct(s.percentual) }) : null,
          el('div', { class: 'coluna-barra', style: { height: `${(s.percentual || 0) * 100}%` } })),
        pct(s.percentual), `chegaram à porta ${s.checkpoint} (${NOMES_NIVEL[Math.min(2, Math.floor((s.checkpoint - 1) / 5))].toLowerCase()})`,
        `${numero.format(s.partidas)} de ${plural(est.totalPartidas, 'partida', 'partidas')}`))),
      el('div', { class: 'colunas-base', 'aria-hidden': 'true' }, itens.map((s, i) => el('span', { text: i % passo === 0 ? String(s.checkpoint) : '' }))),
      el('div', { class: 'eixo-titulo', text: 'Porta' }),
      el('div', { class: 'faixas-dificuldade' },
        el('span', { text: 'Portas 1 a 5: contas fáceis' }), el('span', { text: '6 a 10: médias' }), el('span', { text: '11 em diante: difíceis' })));
  }

  const fins = $('fins');
  const motivos = Object.entries(est.motivosFim).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  if (!motivos.length) return fins.replaceChildren();
  const alvo = el('div');
  barras(alvo, motivos.map(([motivo, n]) => ({
    rotulo: MOTIVOS[motivo] || motivo,
    valor: n,
    texto: numero.format(n),
    sub: pct(n / est.totalPartidas),
    dica: [plural(n, 'partida', 'partidas'), MOTIVOS[motivo] || motivo, `${pct(n / est.totalPartidas)} do total`],
  })));
  fins.replaceChildren(el('h3', { text: 'Como as partidas terminam' }), alvo);
}

function desenharMelhores(ranking) {
  const tabela = $('melhores');
  if (!ranking.length) return tabela.replaceChildren();
  tabela.replaceChildren(
    el('thead', {}, el('tr', {},
      el('th', { text: 'Partida' }), el('th', { class: 'num', text: 'Chegou até a porta' }), el('th', { class: 'num', text: 'Pontos' }),
      el('th', { class: 'num', text: 'Tempo de jogo' }), el('th', { text: 'Como terminou' }))),
    el('tbody', {}, ranking.map(r => {
      const inicio = new Date(r.iniciadaEm);
      return el('tr', {},
        el('td', { text: `${diaMes.format(inicio)} às ${hora.format(inicio)}` }),
        el('td', { class: 'num', text: numero.format(r.checkpointsAlcancados) }),
        el('td', { class: 'num', text: numero.format(r.pontuacao) }),
        el('td', { class: 'num', text: duracao(r.tempoJogadoSeg) }),
        el('td', { text: MOTIVOS[r.motivoFim] || r.motivoFim }));
    })));
}

function desenhar() {
  if (!dados) return;
  const { est, ranking } = dados;
  const totais = totaisDeContas(est);
  desenharCabecalho(est, totais);
  const vazio = est.totalPartidas === 0;
  $('vazio').hidden = !vazio;
  $('relatorio').hidden = vazio;
  if (vazio) return;
  desenharVisaoGeral(est, totais);
  desenharDestaques(est, totais);
  desenharOperacoes(est);
  desenharErros(est);
  desenharContasErradas(est);
  desenharPressa(est);
  desenharRapido(est);
  desenharProgresso(est);
  desenharMelhores(ranking);
}

// ===================== DADOS =====================
async function buscar(caminho) {
  const resposta = await fetch(caminho, { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`${caminho}: ${resposta.status}`);
  return resposta.json();
}

let carregando = false;
async function carregar() {
  if (carregando) return;
  carregando = true;
  $('conteudo').classList.add('carregando');
  const filtros = new URLSearchParams(intervaloDoPeriodo());
  try {
    const [est, ranking] = await Promise.all([
      buscar(`/api/estatisticas?${filtros}`),
      buscar(`/api/ranking?${filtros}&limite=5`),
    ]);
    dados = { est, ranking: ranking.ranking };
    desenhar();
    $('status').textContent = `Atualizado às ${hora.format(new Date())}`;
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Não foi possível carregar os dados. O jogo precisa estar aberto pelo servidor (npm start).';
  } finally {
    carregando = false;
    $('conteudo').classList.remove('carregando');
  }
}

function marcarPeriodo() {
  document.querySelectorAll('[data-periodo]').forEach(botao => {
    botao.setAttribute('aria-checked', String(botao.dataset.periodo === periodo));
  });
  const dia = $('dia');
  dia.classList.toggle('ativo', periodo.startsWith('dia:'));
  dia.value = periodo.startsWith('dia:') ? periodo.slice(4) : '';
}

function escolherPeriodo(valor) {
  periodo = valor;
  contasMostradas = CONTAS_POR_VEZ;
  salvarPreferencia(periodo);
  marcarPeriodo();
  carregar();
}

document.querySelectorAll('[data-periodo]').forEach(botao => botao.addEventListener('click', () => escolherPeriodo(botao.dataset.periodo)));
$('dia').max = dataLocal(new Date());
$('dia').addEventListener('change', evento => {
  if (evento.target.value) escolherPeriodo(`dia:${evento.target.value}`);
});
$('mais-contas').addEventListener('click', () => {
  contasMostradas += CONTAS_POR_VEZ * 2;
  if (dados) desenharContasErradas(dados.est);
});
$('imprimir').addEventListener('click', () => window.print());
// No papel a explicação sai aberta
addEventListener('beforeprint', () => { document.querySelector('.ajuda').open = true; });

if (!/^(hoje|7|30|tudo|dia:\d{4}-\d{2}-\d{2})$/.test(periodo)) periodo = 'tudo';
desenharLegendaStatus();
marcarPeriodo();
carregar();
setInterval(() => { if (!document.hidden) carregar(); }, ATUALIZAR_A_CADA_MS);
