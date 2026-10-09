// Confere se a partida recebida segue docs/dados-de-desempenho.md antes de gravar.
// Devolve null quando está tudo certo ou o texto do primeiro problema encontrado.

export const SCHEMA_VERSION = 1;

export const MOTIVOS_FIM = ['lava', 'capturado', 'luta_perdida', 'abandono_esc', 'abandono_aba'];
export const FASES = ['corrida', 'checkpoint', 'luta'];
export const TIPOS_CONTA = ['adicao', 'subtracao', 'multiplicacao', 'divisao', 'tabuada'];
export const TIPOS_ERRO = [
  'esqueceu_vai_um', 'dezena_a_mais', 'emprestimo_invertido', 'erro_na_dezena', 'linha_vizinha',
  'tabuada_vizinha', 'respondeu_divisor', 'erro_por_pouco', 'proximo_aleatorio',
];
const DESFECHOS = ['acertou', 'tres_erros', 'tempo_esgotado', 'abandono'];
const ORIGENS_LUTA = ['tres_erros', 'tempo_esgotado', 'corrida_lenta'];
const TIPOS_DISPOSITIVO = ['celular', 'desktop'];
const CONTROLES = ['teclado', 'toque', 'gamepad', 'misto'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 2000;

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = v => Number.isInteger(v) && v >= 0;
const isSeconds = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isNumber = v => typeof v === 'number' && Number.isFinite(v);
const isDate = v => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isList = v => Array.isArray(v) && v.length <= MAX_ITEMS;

export function validatePartida(p) {
  if (!isObject(p)) return 'o corpo precisa ser um objeto JSON';
  if (p.versaoEsquema !== SCHEMA_VERSION) return `versaoEsquema precisa ser ${SCHEMA_VERSION}`;
  if (typeof p.partidaId !== 'string' || !UUID.test(p.partidaId)) return 'partidaId precisa ser um UUID';
  if (!isDate(p.iniciadaEm)) return 'iniciadaEm precisa ser data/hora ISO';
  if (!isDate(p.terminadaEm)) return 'terminadaEm precisa ser data/hora ISO';
  if (Date.parse(p.terminadaEm) < Date.parse(p.iniciadaEm)) return 'terminadaEm é anterior a iniciadaEm';
  if (!isSeconds(p.duracaoSeg)) return 'duracaoSeg precisa ser um número ≥ 0';
  if (!isSeconds(p.pausadaSeg)) return 'pausadaSeg precisa ser um número ≥ 0';

  const d = p.dispositivo;
  if (!isObject(d)) return 'dispositivo ausente';
  if (!TIPOS_DISPOSITIVO.includes(d.tipo)) return `dispositivo.tipo inválido: ${d.tipo}`;
  if (!CONTROLES.includes(d.controle)) return `dispositivo.controle inválido: ${d.controle}`;

  const r = p.resultado;
  if (!isObject(r)) return 'resultado ausente';
  if (!MOTIVOS_FIM.includes(r.motivoFim)) return `resultado.motivoFim inválido: ${r.motivoFim}`;
  if (!FASES.includes(r.ondeTerminou)) return `resultado.ondeTerminou inválido: ${r.ondeTerminou}`;
  for (const key of ['checkpointsAlcancados', 'checkpointsSuperados', 'nivelMaximo', 'pontuacao', 'vidasRestantes']) {
    if (!isCount(r[key])) return `resultado.${key} precisa ser um inteiro ≥ 0`;
  }

  if (!isObject(p.resumo)) return 'resumo ausente';
  if (!isList(p.checkpoints)) return 'checkpoints precisa ser uma lista';
  if (!isList(p.lutas)) return 'lutas precisa ser uma lista';
  if (!isList(p.quedas)) return 'quedas precisa ser uma lista';

  for (const [i, c] of p.checkpoints.entries()) {
    const problem = validateCheckpoint(c);
    if (problem) return `checkpoints[${i}]: ${problem}`;
  }
  for (const [i, l] of p.lutas.entries()) {
    const problem = validateLuta(l);
    if (problem) return `lutas[${i}]: ${problem}`;
  }
  for (const [i, q] of p.quedas.entries()) {
    if (!isObject(q) || !isCount(q.trecho) || !isSeconds(q.emSeg) || !isCount(q.vidasRestantes)) {
      return `quedas[${i}]: precisa de trecho, emSeg e vidasRestantes`;
    }
  }
  return null;
}

function validateCheckpoint(c) {
  if (!isObject(c)) return 'precisa ser um objeto';
  if (!isCount(c.numero) || !isCount(c.nivel)) return 'numero e nivel precisam ser inteiros ≥ 0';
  if (!DESFECHOS.includes(c.desfecho)) return `desfecho inválido: ${c.desfecho}`;
  const q = c.pergunta;
  if (!isObject(q)) return 'pergunta ausente';
  if (!TIPOS_CONTA.includes(q.tipo)) return `pergunta.tipo inválido: ${q.tipo}`;
  if (!isNumber(q.respostaCorreta)) return 'pergunta.respostaCorreta precisa ser um número';
  if (!isList(q.alternativas)) return 'pergunta.alternativas precisa ser uma lista';
  for (const a of q.alternativas) {
    if (!isObject(a) || !isNumber(a.valor) || typeof a.correta !== 'boolean') return 'alternativa precisa de valor e correta';
    if (a.tipoErro !== null && !TIPOS_ERRO.includes(a.tipoErro)) return `tipoErro inválido: ${a.tipoErro}`;
  }
  if (!isList(c.tentativas)) return 'tentativas precisa ser uma lista';
  for (const t of c.tentativas) {
    if (!isObject(t) || typeof t.correta !== 'boolean' || !isSeconds(t.tempoRespostaSeg)) {
      return 'tentativa precisa de correta e tempoRespostaSeg';
    }
    if (t.tipoErro !== null && !TIPOS_ERRO.includes(t.tipoErro)) return `tipoErro inválido: ${t.tipoErro}`;
  }
  return null;
}

function validateLuta(l) {
  if (!isObject(l)) return 'precisa ser um objeto';
  if (!ORIGENS_LUTA.includes(l.origem)) return `origem inválida: ${l.origem}`;
  if (typeof l.venceu !== 'boolean') return 'venceu precisa ser sim/não';
  if (!isList(l.rodadas)) return 'rodadas precisa ser uma lista';
  for (const r of l.rodadas) {
    if (!isObject(r) || !TIPOS_CONTA.includes(r.tipo) || typeof r.correta !== 'boolean') {
      return 'rodada precisa de tipo e correta';
    }
  }
  return null;
}
