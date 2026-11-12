// Desafios de matemática do castelo. `lv` = quantos castelos o jogador já passou.

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ----- Galeria: o cadeado usa os números escondidos nos quadros -----
export const PORTRAIT_NAMES = ['o Barão', 'a Dama', 'a Criança'];
export function makeLockPuzzle(lv) {
  const top = 6 + Math.min(lv, 3) * 2;
  const v = [ri(2, top), ri(2, top), ri(2, top)];
  const [A, B, C] = PORTRAIT_NAMES.map((n) => n.replace(/^(o|a) /, ''));
  const forms = [
    { text: `${A} + ${B} + ${C}`, f: (a, b, c) => a + b + c },
    { text: `${A} × ${B} − ${C}`, f: (a, b, c) => a * b - c },
    { text: `(${A} + ${B}) × ${C}`, f: (a, b, c) => (a + b) * c },
    { text: `${A} × ${B} + ${C}`, f: (a, b, c) => a * b + c },
    { text: `${A} + ${B} − ${C}`, f: (a, b, c) => a + b - c },
  ];
  // começa com as fáceis; depois libera as de multiplicação
  const pool = lv === 0 ? [forms[0], forms[4], forms[1]] : forms;
  let form, answer;
  for (let i = 0; i < 30; i++) {
    form = pick(pool);
    answer = form.f(...v);
    if (answer > 0 && answer < 400) break;
  }
  return { values: v, text: form.text, answer };
}

// ----- Masmorra: a balança precisa ficar equilibrada -----
export function makeScalePuzzle(lv) {
  const n = lv === 0 ? 2 : pick([2, 3]);
  const top = 9 + Math.min(lv, 4) * 4;
  const sol = Array.from({ length: n }, () => ri(2, top));
  const target = sol.reduce((s, x) => s + x, 0);
  const weights = [...sol];
  while (weights.length < 6) {
    const w = ri(2, top);
    weights.push(w);
  }
  return { target, weights: shuffle(weights) };
}

// ----- Biblioteca: livros numa sequência, falta um -----
export function makeSequencePuzzle(lv) {
  const rules = [
    () => { const a = ri(1, 9), d = ri(2, 5); return { seq: Array.from({ length: 5 }, (_, i) => a + d * i), hint: `cada livro tem ${d} a mais que o anterior` }; },
    () => { const a = ri(40, 70), d = ri(3, 7); return { seq: Array.from({ length: 5 }, (_, i) => a - d * i), hint: `cada livro tem ${d} a menos que o anterior` }; },
    () => { const a = ri(1, 3), r = 2; return { seq: Array.from({ length: 5 }, (_, i) => a * r ** i), hint: 'cada livro é o dobro do anterior' }; },
    () => { const s = ri(1, 3); return { seq: Array.from({ length: 5 }, (_, i) => (i + s) ** 2), hint: 'cada livro é um número vezes ele mesmo (1×1, 2×2, 3×3…)' }; },
    () => { const a = ri(1, 4), r = 3; return { seq: Array.from({ length: 5 }, (_, i) => a * r ** i), hint: 'cada livro é o triplo do anterior' }; },
    () => { let x = ri(1, 3), y = ri(2, 4); const seq = [x, y]; while (seq.length < 5) { const z = seq[seq.length - 1] + seq[seq.length - 2]; seq.push(z); } return { seq, hint: 'cada livro é a soma dos dois anteriores' }; },
  ];
  const pool = lv === 0 ? rules.slice(0, 3) : rules;
  const { seq, hint } = pick(pool)();
  // o livro que falta: o último (ou, depois do 1º castelo, um do meio)
  const hole = lv === 0 ? 4 : pick([2, 3, 4]);
  const answer = seq[hole];
  const opts = new Set([answer]);
  for (const d of shuffle([1, -1, 2, -2, 3, 5, -3, 10])) {
    if (opts.size >= 4) break;
    if (answer + d > 0) opts.add(answer + d);
  }
  return { seq, hole, answer, options: shuffle([...opts]), hint };
}
