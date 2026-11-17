// Regras dos vagões do Trem Fantasma.
// Cada rodada tem uma regra ("só os pares aguentam", "só a tabuada do 3"…) e uma fila de vagões:
// os que seguem a regra aguentam o peso da coruja, os outros desabam.
// Nunca há dois vagões errados seguidos (um só já pede um pulo comprido).
// `lv` = quantas vezes o jogador já atravessou o trem (as regras ficam mais difíceis).

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };

/** fila de certo/errado: sem dois errados seguidos, com pelo menos 2 errados e 2 certos */
function pattern(n) {
  for (let guard = 0; guard < 200; guard++) {
    const p = [];
    for (let i = 0; i < n; i++) p.push(i > 0 && !p[i - 1] ? true : Math.random() < 0.58);
    const wrong = p.filter((ok) => !ok).length;
    if (wrong >= 2 && n - wrong >= 2) return p;
  }
  return Array.from({ length: n }, (_, i) => i % 2 === 0);
}

/** sorteia um número que passa (ou não) no teste, sem repetir */
function draw(test, want, lo, hi, used) {
  for (let guard = 0; guard < 400; guard++) {
    const v = ri(lo, hi);
    if (!used.has(v) && test(v) === want) { used.add(v); return v; }
  }
  for (let v = lo; v <= hi + 200; v++) if (!used.has(v) && test(v) === want) { used.add(v); return v; }
  return lo;
}

// regra simples: um teste sobre o número pintado
function byTest(title, hint, test, lo, hi) {
  return (n) => {
    const used = new Set();
    return { title, hint, cars: pattern(n).map((ok) => ({ label: String(draw(test, ok, lo, hi, used)), ok })) };
  };
}

// sequência: os certos seguem "de k em k"; os errados são números que não pertencem a ela
function sequence(lv) {
  return (n) => {
    const step = ri(2, 4 + Math.min(lv, 3)), start = ri(1, 9);
    const p = pattern(n);
    const inLine = (v) => (v - start) % step === 0;
    let k = 0, last = start - step;
    const cars = p.map((ok) => {
      if (ok) { last = start + step * k++; return { label: String(last), ok }; }
      // o intruso fica perto do próximo da fila, mas fora dela
      const next = last + step;
      let v = next + pick([-1, 1]) * ri(1, Math.max(1, step - 1));
      for (let guard = 0; guard < 20 && (inLine(v) || v < 1); guard++) v++;
      return { label: String(v), ok };
    });
    return { title: `Conte de ${step} em ${step}`, hint: `Começa no ${start}. Quem fura a fila desaba.`, cars };
  };
}

// contas: cada vagão traz uma conta; só as que dão o número pedido aguentam
function sums(lv) {
  return (n) => {
    const target = ri(8, 16 + Math.min(lv, 3) * 6);
    const used = new Set();
    const expr = (ok) => {
      for (let guard = 0; guard < 200; guard++) {
        const value = ok ? target : target + pick([-3, -2, -1, 1, 2, 3]);
        if (value < 2) continue;
        const kind = pick(lv > 0 ? ['+', '−', '×'] : ['+', '−']);
        let label = null;
        if (kind === '+') { const a = ri(1, value - 1); label = `${a}+${value - a}`; }
        else if (kind === '−') { const b = ri(1, 9 + lv * 3); label = `${value + b}−${b}`; }
        else {
          const ds = []; for (let d = 2; d <= 9; d++) if (value % d === 0 && value / d >= 2) ds.push(d);
          if (ds.length) { const d = pick(ds); label = `${d}×${value / d}`; }
        }
        if (label && !used.has(label)) { used.add(label); return label; }
      }
      return ok ? `${target}+0` : `${target}+1`;
    };
    return { title: `Só as contas que dão ${target}`, hint: 'Faça a conta antes de pular.', cars: pattern(n).map((ok) => ({ label: expr(ok), ok })) };
  };
}

function multiples(k, lv) {
  const hi = k * (9 + Math.min(lv, 3) * 2);
  return byTest(`Só a tabuada do ${k}`, `${k}, ${k * 2}, ${k * 3}… o resto desaba.`, (v) => v % k === 0, 2, hi);
}

/** as regras possíveis em cada degrau de dificuldade (0, 1, 2+) */
function pool(lv) {
  const top = 30 + Math.min(lv, 3) * 25;
  const cut = ri(12, top - 10);
  const easy = [
    byTest('Só os PARES aguentam', 'Terminou em 0, 2, 4, 6 ou 8? Pode pisar.', (v) => v % 2 === 0, 2, top),
    byTest('Só os ÍMPARES aguentam', 'Terminou em 1, 3, 5, 7 ou 9? Pode pisar.', (v) => v % 2 === 1, 1, top),
    multiples(pick([2, 5, 10]), lv),
    byTest(`Só os MAIORES que ${cut}`, 'Os menores não seguram ninguém.', (v) => v > cut, Math.max(1, cut - 12), cut + 12),
    byTest(`Só os MENORES que ${cut}`, 'Os maiores não seguram ninguém.', (v) => v < cut, Math.max(1, cut - 12), cut + 12),
  ];
  const lo = ri(8, 20), hi = lo + ri(8, 14);
  const mid = [
    multiples(pick([3, 4]), lv), sequence(lv), sums(lv),
    byTest(`Só os que ficam ENTRE ${lo} e ${hi}`, `Maior que ${lo} e menor que ${hi}.`, (v) => v > lo && v < hi, Math.max(1, lo - 9), hi + 9),
  ];
  const hard = [
    multiples(pick([6, 7, 8, 9]), lv),
    byTest('Só os números PRIMOS', 'Primo só divide por 1 e por ele mesmo.', isPrime, 2, 32 + Math.min(lv, 3) * 10),
    sums(lv + 1),
  ];
  return [easy, mid, hard];
}

/**
 * Uma travessia: cinco rodadas, cada uma com sua regra e sua fila de vagões.
 * Devolve [{ title, hint, cars: [{ label, ok }] }].
 */
export function makeRounds(lv = 0) {
  const [easy, mid, hard] = pool(lv);
  const sizes = [7, 8, 8, 9, 9];
  // primeira viagem: duas fáceis e três médias; depois sobe um degrau
  const plan = lv === 0 ? [easy, easy, mid, mid, mid] : lv === 1 ? [easy, mid, mid, hard, hard] : [mid, mid, hard, hard, hard];
  const usedTitles = new Set(), kinds = {};
  return plan.map((group, i) => {
    for (let guard = 0; guard < 30; guard++) {
      const round = pick(group)(sizes[i]);
      // nunca a mesma regra duas vezes, e no máximo duas do mesmo tipo (ex.: duas tabuadas diferentes)
      const kind = round.title.replace(/\d+/g, '#');
      if (usedTitles.has(round.title) || (kinds[kind] ?? 0) >= 2) continue;
      usedTitles.add(round.title);
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      return round;
    }
    // sem opção nova desse tipo: vale repetir o tipo, mas não a regra igualzinha
    for (let guard = 0; guard < 60; guard++) {
      const round = pick(group)(sizes[i]);
      if (!usedTitles.has(round.title)) { usedTitles.add(round.title); return round; }
    }
    return pick(group)(sizes[i]);
  });
}
