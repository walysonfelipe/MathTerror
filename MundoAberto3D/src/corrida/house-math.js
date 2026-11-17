// Feitiço da Libertação (Casa do Mago): três versos, cada um é uma conta para montar.
// A operação de cada verso é sorteada (soma, subtração, multiplicação ou divisão) e não se repete no mesmo feitiço.
// `lv` = quantas vezes o jogador já saiu da casa (as contas crescem um pouco).

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export const OPS = {
  soma: { sym: '+', name: 'soma', article: 'uma soma', word: 'Somara', f: (a, b) => a + b },
  menos: { sym: '−', name: 'subtração', article: 'uma subtração', word: 'Minuere', f: (a, b) => a - b },
  vezes: { sym: '×', name: 'multiplicação', article: 'uma multiplicação', word: 'Multiplex', f: (a, b) => a * b },
  dividir: { sym: '÷', name: 'divisão', article: 'uma divisão', word: 'Dividus', f: (a, b) => (b !== 0 && a % b === 0 ? a / b : NaN) },
};

/** a conta montada dá o número pedido? */
export const solves = (verse, a, b) => OPS[verse.op].f(a, b) === verse.target;

function makeVerse(op, lv) {
  const k = Math.min(lv, 3);
  let a, b;
  if (op === 'soma') { a = ri(4, 14 + k * 8); b = ri(3, 12 + k * 8); }
  else if (op === 'menos') { b = ri(3, 12 + k * 5); a = b + ri(2, 12 + k * 6); }
  else if (op === 'vezes') { a = ri(2, 7 + k); b = ri(2, 6 + k); }
  else { b = ri(2, 6 + k); a = b * ri(2, 7 + k); }
  const target = OPS[op].f(a, b);
  // runas na mesa: as duas certas + quatro que atrapalham (valores parecidos, sem repetir)
  const tiles = new Set([a, b]);
  const top = Math.max(a, b, 9);
  for (let guard = 0; tiles.size < 6 && guard < 200; guard++) {
    const near = Math.random() < 0.5 ? (Math.random() < 0.5 ? a : b) + ri(-3, 3) : ri(1, top + 3);
    if (near > 0) tiles.add(near);
  }
  for (let n = 1; tiles.size < 6; n++) tiles.add(top + n); // a == b: completa a mesa
  if (a === b) tiles.delete([...tiles].pop()); // …e deixa espaço para a runa repetida
  const list = [...tiles];
  if (a === b) list.push(a);
  return { op, target, tiles: shuffle(list), answer: [a, b] };
}

/** três versos, com três operações diferentes sorteadas entre as quatro */
export function makeSpell(lv = 0) {
  return shuffle(Object.keys(OPS)).slice(0, 3).map((op) => makeVerse(op, lv));
}
