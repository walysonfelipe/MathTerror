// Resumos prontos para o dashboard, calculados a partir das partidas gravadas.
// Cada bloco responde a uma das perguntas da seção 7 de docs/dados-de-desempenho.md.
import { localDate } from './storage.js';
import { MOTIVOS_FIM, TIPOS_CONTA } from './validate.js';

// Faixas de ameaça do boss no momento da resposta (0 = longe, 1 = pegou)
const PRESSURE_BANDS = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1.01]];

const playedSeconds = p => Math.max(0, p.duracaoSeg - p.pausadaSeg);
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const rate = (part, total) => (total ? round(part / total, 3) : null);
const average = list => (list.length ? round(list.reduce((s, n) => s + n, 0) / list.length) : null);

// ?de=2026-10-01&ate=2026-10-08 (datas locais, inclusivas)
export function filterByDate(partidas, { de, ate } = {}) {
  return partidas.filter(p => {
    const day = localDate(new Date(p.iniciadaEm));
    return (!de || day >= de) && (!ate || day <= ate);
  });
}

// Mais longe primeiro; empate decide pela pontuação e depois por quem chegou em menos tempo
export function ranking(partidas, limit = 10) {
  return [...partidas]
    .sort((a, b) =>
      b.resultado.checkpointsAlcancados - a.resultado.checkpointsAlcancados
      || b.resultado.pontuacao - a.resultado.pontuacao
      || playedSeconds(a) - playedSeconds(b))
    .slice(0, limit)
    .map((p, i) => ({
      posicao: i + 1,
      partidaId: p.partidaId,
      codigo: p.partidaId.slice(0, 8),
      iniciadaEm: p.iniciadaEm,
      checkpointsAlcancados: p.resultado.checkpointsAlcancados,
      pontuacao: p.resultado.pontuacao,
      nivelMaximo: p.resultado.nivelMaximo,
      tempoJogadoSeg: round(playedSeconds(p), 1),
      motivoFim: p.resultado.motivoFim,
    }));
}

export function estatisticas(partidas) {
  const checkpoints = partidas.flatMap(p => p.checkpoints);
  const lutas = partidas.flatMap(p => p.lutas);
  const quedas = partidas.flatMap(p => p.quedas);
  const played = partidas.map(playedSeconds);

  return {
    totalPartidas: partidas.length,
    tempoJogado: {
      totalSeg: round(played.reduce((s, n) => s + n, 0), 1),
      medioSeg: average(played),
    },
    partidasPorDia: countBy(partidas, p => localDate(new Date(p.iniciadaEm))),
    motivosFim: countBy(partidas, p => p.resultado.motivoFim, MOTIVOS_FIM),
    ondeTerminou: countBy(partidas, p => p.resultado.ondeTerminou),
    abandonos: partidas.filter(p => p.resultado.motivoFim.startsWith('abandono')).length,
    sobrevivencia: survival(partidas),
    porTipoConta: byQuestionType(checkpoints),
    tiposErro: errorTypes(checkpoints),
    vaiUm: withAndWithout(checkpoints.filter(c => c.pergunta.tipo === 'adicao'), c => c.pergunta.exigeVaiUm),
    emprestimo: withAndWithout(checkpoints.filter(c => c.pergunta.tipo === 'subtracao'), c => c.pergunta.exigeEmprestimo),
    pressao: pressure(checkpoints),
    lutas: fights(lutas),
    quedas: {
      total: quedas.length,
      porTrecho: countBy(quedas, q => q.trecho),
      partidasComQueda: partidas.filter(p => p.quedas.length).length,
    },
    porControle: byController(partidas),
    errosDetalhados: wrongAnswers(partidas),
  };
}

// As respostas erradas com a conta, a resposta certa e a escolhida, mais recentes primeiro.
// O painel usa como exemplos de cada tipo de erro e na lista de contas erradas.
const MAX_WRONG_ANSWERS = 300;
function wrongAnswers(partidas) {
  return partidas.flatMap(p => p.checkpoints.flatMap(c => c.tentativas
    .filter(t => !t.correta)
    .map(t => ({
      quando: new Date(Date.parse(p.iniciadaEm) + (c.chegouEmSeg || 0) * 1000).toISOString(),
      tipo: c.pergunta.tipo,
      nivel: c.nivel,
      texto: c.pergunta.texto,
      respostaCorreta: c.pergunta.respostaCorreta,
      valorEscolhido: t.valorEscolhido,
      tipoErro: t.tipoErro,
      tentativa: t.numero,
    }))))
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))
    .slice(0, MAX_WRONG_ANSWERS);
}

function countBy(list, key, known = []) {
  const counts = Object.fromEntries(known.map(k => [k, 0]));
  for (const item of list) {
    const k = key(item);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

// Quantas partidas alcançaram pelo menos N checkpoints: mostra onde as pessoas param
function survival(partidas) {
  const max = Math.max(0, ...partidas.map(p => p.resultado.checkpointsAlcancados));
  return Array.from({ length: max + 1 }, (_, n) => {
    const alcancaram = partidas.filter(p => p.resultado.checkpointsAlcancados >= n).length;
    return { checkpoint: n, partidas: alcancaram, percentual: rate(alcancaram, partidas.length) };
  });
}

// Uma pergunta conta como "dominada" quando é acertada na 1ª tentativa
function questionSummary(list) {
  const answered = list.filter(c => c.tentativas.length);
  const firstRight = answered.filter(c => c.tentativas[0].correta).length;
  const attempts = list.flatMap(c => c.tentativas);
  return {
    perguntas: list.length,
    respondidas: answered.length,
    acertosPrimeiraTentativa: firstRight,
    taxaPrimeiraTentativa: rate(firstRight, answered.length),
    acertouNoFim: list.filter(c => c.desfecho === 'acertou').length,
    tentativas: attempts.length,
    erros: attempts.filter(t => !t.correta).length,
    tempoMedioPrimeiraRespostaSeg: average(answered.map(c => c.tentativas[0].tempoRespostaSeg)),
  };
}

function byQuestionType(checkpoints) {
  return Object.fromEntries(TIPOS_CONTA.map(tipo => {
    const ofType = checkpoints.filter(c => c.pergunta.tipo === tipo);
    const levels = [...new Set(ofType.map(c => c.nivel))].sort((a, b) => a - b);
    return [tipo, {
      ...questionSummary(ofType),
      porNivel: Object.fromEntries(levels.map(n => [n, questionSummary(ofType.filter(c => c.nivel === n))])),
    }];
  }));
}

// Quais erros aparecem em cada tipo de conta, do mais comum para o menos comum
function errorTypes(checkpoints) {
  const result = {};
  for (const tipo of TIPOS_CONTA) {
    const wrong = checkpoints
      .filter(c => c.pergunta.tipo === tipo)
      .flatMap(c => c.tentativas)
      .filter(t => !t.correta && t.tipoErro);
    const counts = countBy(wrong, t => t.tipoErro);
    result[tipo] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tipoErro, vezes]) => ({ tipoErro, vezes, percentual: rate(vezes, wrong.length) }));
  }
  return result;
}

function withAndWithout(list, flag) {
  return {
    com: questionSummary(list.filter(c => flag(c) === true)),
    sem: questionSummary(list.filter(c => flag(c) === false)),
  };
}

// Só a 1ª resposta de cada conta: as seguintes já vêm com o boss mais perto e por eliminação
function pressure(checkpoints) {
  const attempts = checkpoints.map(c => c.tentativas[0]).filter(t => t && typeof t.ameacaBoss === 'number');
  return PRESSURE_BANDS.map(([from, to]) => {
    const inBand = attempts.filter(t => t.ameacaBoss >= from && t.ameacaBoss < to);
    const right = inBand.filter(t => t.correta).length;
    return {
      faixa: `${Math.round(from * 100)}–${Math.min(100, Math.round(to * 100))}%`,
      tentativas: inBand.length,
      acertos: right,
      taxaAcerto: rate(right, inBand.length),
    };
  });
}

function fights(lutas) {
  const rounds = lutas.flatMap(l => l.rodadas);
  const won = lutas.filter(l => l.venceu).length;
  return {
    total: lutas.length,
    vencidas: won,
    taxaVitoria: rate(won, lutas.length),
    porOrigem: countBy(lutas, l => l.origem),
    porTipoConta: Object.fromEntries(['adicao', 'subtracao', 'multiplicacao', 'divisao'].map(tipo => {
      const ofType = rounds.filter(r => r.tipo === tipo);
      const right = ofType.filter(r => r.correta).length;
      return [tipo, {
        rodadas: ofType.length,
        acertos: right,
        taxaAcerto: rate(right, ofType.length),
        tempoMedioSeg: average(ofType.map(r => r.tempoRespostaSeg).filter(n => typeof n === 'number')),
      }];
    })),
  };
}

function byController(partidas) {
  const groups = {};
  for (const p of partidas) (groups[p.dispositivo.controle] ||= []).push(p);
  return Object.fromEntries(Object.entries(groups).map(([controle, list]) => [controle, {
    partidas: list.length,
    mediaCheckpoints: average(list.map(p => p.resultado.checkpointsAlcancados)),
    mediaQuedas: average(list.map(p => p.quedas.length)),
  }]));
}
