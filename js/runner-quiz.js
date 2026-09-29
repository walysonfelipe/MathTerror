// Preparação de perguntas usada pelo runner. Mantém geração e embaralhamento fora do loop do jogo.
import { shuffleInPlace, cloneWithShuffledOptions } from './utils.js';

export function buildQuestionDeck(quiz) {
  const idxs = Array.from({ length: quiz.length }, (_, i) => i);
  shuffleInPlace(idxs);
  return idxs.map(i => cloneWithShuffledOptions(quiz[i]));
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

