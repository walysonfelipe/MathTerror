// Contas aleatórias do portal: o jogador monta "□ op □ = alvo" escolhendo pedras numeradas.
// A partir do 3º portal aparecem contas de 3 pedras: "(□ op □) op □ = alvo".

export const OPS = ['+', '−', '×', '÷'];

export function apply(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : NaN;
  }
  return NaN;
}

const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];

function shuffle(r, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// dois números para a operação, com faixas que crescem a cada portal
function pair(op, lv, r) {
  const m = Math.min(lv, 6);
  switch (op) {
    case '+': return [ri(r, 1, 8 + m * 4), ri(r, 1, 8 + m * 4)];
    case '−': { const b = ri(r, 1, 6 + m * 3); return [b + ri(r, 1, 8 + m * 3), b]; }
    case '×': return [ri(r, 2, 5 + m), ri(r, 2, 5 + m)];
    default: { const b = ri(r, 2, 4 + m); return [b * ri(r, 2, 5 + m), b]; } // ÷ sempre exata
  }
}

const isHigh = (op) => op === '×' || op === '÷';

export function makeGatePuzzle(level, r = Math.random) {
  const three = level >= 2 && r() < Math.min(0.85, 0.35 + level * 0.12);
  let nums, ops, target;

  for (let tries = 0; tries < 80; tries++) {
    if (!three) {
      const op = pick(r, OPS);
      nums = pair(op, level, r);
      ops = [op];
      target = apply(nums[0], op, nums[1]);
    } else {
      const op1 = pick(r, OPS), op2 = pick(r, OPS);
      const [a, b] = pair(op1, Math.max(0, level - 2), r);
      const ab = apply(a, op1, b);
      let c;
      if (op2 === '+') c = ri(r, 1, 9 + Math.min(level, 6));
      else if (op2 === '−') { if (ab < 2) continue; c = ri(r, 1, Math.min(ab - 1, 15)); }
      else if (op2 === '×') { c = ri(r, 2, 4 + Math.min(level, 4)); if (ab * c > 150) continue; }
      else {
        const divs = [];
        for (let d = 2; d <= 9; d++) if (ab % d === 0 && ab / d > 0) divs.push(d);
        if (!divs.length) continue;
        c = pick(r, divs);
      }
      nums = [a, b, c];
      ops = [op1, op2];
      target = apply(ab, op2, c);
    }
    if (Number.isInteger(target) && target > 0 && target <= 200) break;
  }

  // pedras: as da resposta + "iscas" parecidas
  const total = nums.length === 3 ? 8 : 6;
  const tiles = [...nums];
  const taken = new Set(nums);
  const top = Math.max(10, ...nums) + 3;
  const pool = [];
  for (const n of nums) pool.push(n + 1, n - 1, n + 2, n - 2, n + 10, n * 2);
  shuffle(r, pool);
  for (const v of pool) {
    if (tiles.length >= total) break;
    if (v > 0 && v <= 99 && !taken.has(v)) { tiles.push(v); taken.add(v); }
  }
  while (tiles.length < total) {
    const v = ri(r, 1, top);
    if (!taken.has(v)) { tiles.push(v); taken.add(v); }
  }
  shuffle(r, tiles);

  // parênteses só quando mudam a ordem das contas
  const parens = nums.length === 3 && !isHigh(ops[0]) && isHigh(ops[1]);

  function check(v) {
    if (v.length === 2) return apply(v[0], ops[0], v[1]) === target;
    return apply(apply(v[0], ops[0], v[1]), ops[1], v[2]) === target;
  }

  return { slots: nums.length, ops, target, tiles, solution: nums, parens, check };
}
