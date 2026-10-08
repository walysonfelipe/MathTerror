// Preparação de perguntas usada pelo runner. Mantém geração e embaralhamento fora do loop do jogo.
import { shuffleInPlace } from './utils.js';

// ===================== CONTAS DO CHECKPOINT =====================
// Cada checkpoint gera uma conta nova: adição, subtração, multiplicação, divisão e tabuada.
// As operações saem de uma "sacola" embaralhada, então todas aparecem antes de alguma repetir.
// Nível 0 a 2: as faixas de números crescem conforme a coruja avança.
const CHECKPOINT_TYPES = ['+', '−', '×', '÷', 'tabuada'];
const MAX_LEVEL = 2;

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = list => list[Math.floor(Math.random() * list.length)];

// [nível 0, nível 1, nível 2]
const RANGES = {
  '+': [{ a: [10, 49], b: [2, 9] }, { a: [10, 59], b: [10, 39] }, { a: [25, 99], b: [15, 99], carry: true }],
  '−': [{ a: [15, 49], b: [2, 9] }, { a: [30, 89], b: [10, 29] }, { a: [50, 99], b: [15, 49], borrow: true }],
  '×': [{ a: [11, 19], b: [2, 5] }, { a: [12, 29], b: [3, 7] }, { a: [15, 49], b: [4, 9] }],
  '÷': [{ b: [2, 5], q: [2, 10] }, { b: [3, 9], q: [3, 12] }, { b: [6, 12], q: [6, 15] }],
  // hidden: chance de esconder um fator (7 × ? = 56) em vez de pedir o produto
  tabuada: [{ table: [2, 6], hidden: 0 }, { table: [2, 10], hidden: 0.5 }, { table: [6, 10], hidden: 0.7 }],
};

function makeCheckpointProblem(type, level) {
  const r = RANGES[type][level];
  let a, b, answer, text, wrong;
  if (type === '+') {
    do { a = randInt(...r.a); b = randInt(...r.b); } while (r.carry && (a % 10) + (b % 10) < 10);
    answer = a + b;
    text = `Quanto é ${a} + ${b}?`;
    // Esquecer o "vai um" (−10), contar 10 a mais ou errar por pouco
    wrong = [answer - 10, answer + 10, answer - 1, answer + 1, answer + 2, answer - 2];
  } else if (type === '−') {
    do { a = randInt(...r.a); b = randInt(...r.b); } while (b >= a || (r.borrow && a % 10 >= b % 10));
    answer = a - b;
    text = `Quanto é ${a} − ${b}?`;
    // Erro clássico de empréstimo: subtrair o menor dígito do maior em cada casa
    const noBorrow = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
    wrong = [noBorrow, answer + 10, answer - 10, answer + 1, answer - 1, answer + 2];
  } else if (type === '×') {
    a = randInt(...r.a); b = randInt(...r.b);
    answer = a * b;
    text = `Quanto é ${a} × ${b}?`;
    // Uma vez a mais/a menos, erro na dezena ou na unidade
    wrong = [answer + a, answer - a, answer + b, answer - b, answer + 10, answer - 10];
  } else if (type === '÷') {
    b = randInt(...r.b); answer = randInt(...r.q);
    a = b * answer;                                   // divisão sempre exata
    text = `Quanto é ${a} ÷ ${b}?`;
    wrong = [answer + 1, answer - 1, answer + 2, answer - 2, b === answer ? answer + 3 : b];
  } else {
    a = randInt(...r.table);
    if (Math.random() < r.hidden) {
      b = randInt(2, 10);
      answer = b;
      text = Math.random() < 0.5 ? `Tabuada do ${a}: ${a} × ? = ${a * b}` : `Tabuada do ${a}: ? × ${a} = ${a * b}`;
      wrong = [b + 1, b - 1, b + 2, b - 2];
    } else {
      b = randInt(1, 10);
      answer = a * b;
      text = `Tabuada do ${a}: ${a} × ${b} = ?`;
      // Resultado da linha vizinha da tabuada ou de uma tabuada vizinha
      wrong = [answer + a, answer - a, answer + b, answer - b, answer + 1, answer - 1];
    }
  }
  return { text, answer, wrong };
}

// Três alternativas erradas, plausíveis, diferentes entre si e nunca negativas
function pickWrongOptions(answer, candidates) {
  const valid = c => Number.isInteger(c) && c >= 0 && c !== answer;
  const chosen = new Set(shuffleInPlace(candidates.filter(valid)).slice(0, 3));
  for (let offset = 1; chosen.size < 3; offset++) {
    for (const c of shuffleInPlace([answer + offset, answer - offset])) {
      if (chosen.size < 3 && valid(c)) chosen.add(c);
    }
  }
  return [...chosen];
}

// Cria o gerador de uma partida: guarda a sacola de operações e a última conta para não repetir.
export function createCheckpointQuestions() {
  let bag = [];
  let lastType = null;
  let lastText = '';
  return function nextQuestion(level) {
    const lvl = Math.max(0, Math.min(MAX_LEVEL, level | 0));
    if (!bag.length) {
      bag = shuffleInPlace([...CHECKPOINT_TYPES]);
      // A operação que fechou a sacola anterior não abre a próxima
      if (bag[bag.length - 1] === lastType) bag.unshift(bag.pop());
    }
    const type = bag.pop();
    let problem;
    do { problem = makeCheckpointProblem(type, lvl); } while (problem.text === lastText);
    lastType = type;
    lastText = problem.text;
    const options = shuffleInPlace([problem.answer, ...pickWrongOptions(problem.answer, problem.wrong)]);
    return { questionText: problem.text, options: options.map(String), answer: options.indexOf(problem.answer) };
  };
}

export function makeFightProblem(operation) {
  let a, b, answer;
  if (operation === '+') {
    a = 2 + Math.floor(Math.random() * 19);
    b = 1 + Math.floor(Math.random() * 19);
    answer = a + b;
  } else if (operation === '−') {
    a = 10 + Math.floor(Math.random() * 31);
    b = 1 + Math.floor(Math.random() * a);
    answer = a - b;
  } else if (operation === '×') {
    a = 2 + Math.floor(Math.random() * 10);
    b = 2 + Math.floor(Math.random() * 10);
    answer = a * b;
  } else {
    b = 2 + Math.floor(Math.random() * 9);
    answer = 2 + Math.floor(Math.random() * 10);
    a = b * answer;
  }
  const choices = new Set([answer]);
  while (choices.size < 4) {
    const offset = 1 + Math.floor(Math.random() * 5);
    choices.add(Math.max(0, answer + (Math.random() < 0.5 ? -offset : offset)));
  }
  const options = shuffleInPlace([...choices]);
  return { text: `${a} ${operation} ${b} = ?`, options, answer: options.indexOf(answer) };
}

