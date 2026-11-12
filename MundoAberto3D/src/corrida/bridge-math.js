// Ponte quebrada: buracos com medida e uma pilha de tábuas de vários tamanhos.
// Qualquer combinação certa que o jogador escolher deixa tábuas suficientes para os
// outros buracos: nunca dá para ficar preso. As tábuas a mais servem de isca.

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// subconjuntos (como máscaras de bits) das tábuas livres que somam exatamente `target`
function subsetsFor(planks, free, target) {
  const out = [];
  for (let mask = free; mask; mask = (mask - 1) & free) {
    let s = 0;
    for (let i = 0; i < planks.length; i++) if (mask & (1 << i)) s += planks[i];
    if (s === target) out.push(mask);
  }
  return out;
}

// "à prova de beco sem saída": QUALQUER combinação certa que o jogador escolher
// num buraco ainda deixa tábuas para fechar todos os outros (em qualquer ordem)
function alwaysSolvable(holes, planks, free) {
  if (!holes.length) return true;
  for (let h = 0; h < holes.length; h++) {
    const opts = subsetsFor(planks, free, holes[h]);
    if (!opts.length) return false;
    const rest = holes.filter((_, i) => i !== h);
    for (const m of opts) if (!alwaysSolvable(rest, planks, free & ~m)) return false;
  }
  return true;
}

export function makeBridgePuzzle(lv) {
  const holes = lv < 2 ? 2 : 3;
  const maxPlank = 6 + Math.min(lv, 3);
  for (let tries = 0; tries < 3000; tries++) {
    const sizes = [];
    const planks = [];
    for (let h = 0; h < holes; h++) {
      const k = lv === 0 ? 2 : ri(2, 3); // tábuas por buraco
      const parts = Array.from({ length: k }, () => ri(2, maxPlank));
      sizes.push(parts.reduce((a, b) => a + b, 0));
      planks.push(...parts);
    }
    // tábuas que sobram (iscas)
    for (let i = 0; i < 2 + Math.min(lv, 2); i++) planks.push(ri(2, maxPlank));
    // buracos largos o bastante para não dar para pular (≥ 8 m)
    if (sizes.some((s) => s < 8 || s > 18)) continue;
    if (new Set(sizes).size !== sizes.length) continue;
    // variedade: nenhum tamanho de tábua aparece mais de 2 vezes
    const count = {};
    if (planks.some((v) => (count[v] = (count[v] || 0) + 1) > 2)) continue;
    if (!alwaysSolvable(sizes, planks, (1 << planks.length) - 1)) continue;
    return { holes: sizes, planks: shuffle(planks) };
  }
  // reserva
  return { holes: [11, 8], planks: shuffle([6, 5, 4, 6, 3, 5]) }; // conferida: sempre tem solução
}
