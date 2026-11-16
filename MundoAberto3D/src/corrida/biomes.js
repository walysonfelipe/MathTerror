import * as THREE from 'three';

/**
 * Mundos da trilha. Cada um troca o chão, o fundo, as cores, a decoração,
 * o que existe nos buracos e quais criaturas aparecem.
 *  - dark: quanto a escuridão em volta da lanterna fecha (0..1)
 *  - pit: 'spikes' (espinhos) ou 'water' (água preta com mãos)
 *  - patterns: peso extra dos trechos de cada mundo
 *  - intro: frases de chegada (uma é sorteada e aparece embaixo do nome do mundo)
 */
export const BIOMES = {
  cemiterio: {
    id: 'cemiterio',
    name: 'Cemitério Esquecido',
    intro: [
      'Os nomes nas lápides sumiram. Só os números ficaram.',
      'Aqui ninguém conta os mortos. Eles é que contam você.',
      'A terra está remexida. Alguma coisa acordou antes de você.',
    ],
    fog: 0x1a1424, fogNear: 18, fogFar: 62,
    sky: 0x4a4a74, ground: 0x120c10, hemi: 0.6, sun: 0x8090d8, sunI: 0.75,
    tint: 0xffffff, bgTint: 0xffffff,
    tex: { dirt: 'dirt', top: 'grassTop', sky: 'sky', far: 'mountains', near: 'hills' },
    moon: true, dark: 0.42,
    pit: 'spikes',
    patterns: {},
  },
  floresta: {
    id: 'floresta',
    name: 'Floresta dos Enforcados',
    intro: [
      'As cordas ainda balançam, e não há vento nenhum.',
      'Olhe para cima antes de dar o próximo passo.',
      'Cada árvore guarda alguém. Não vire mais um galho.',
    ],
    fog: 0x0c140e, fogNear: 10, fogFar: 46,
    sky: 0x3a5a40, ground: 0x0a0806, hemi: 0.5, sun: 0x8ab890, sunI: 0.45,
    tint: 0xb8c8a8, bgTint: 0xb0c8b0,
    tex: { dirt: 'forestDirt', top: 'forestTop', sky: 'skyForest', far: 'forestFar', near: 'forestNear' },
    moon: false, dark: 0.55,
    pit: 'spikes',
    patterns: { dropper: 1.2, trap: 0.7, ghost: 0.5 },
  },
  pantano: {
    id: 'pantano',
    name: 'Pântano Afogado',
    intro: [
      'A água é preta e parada. As mãos embaixo dela, não.',
      'Pise só onde a madeira aguenta. O resto puxa para baixo.',
      'Quem afundou aqui ainda procura um tornozelo para segurar.',
    ],
    fog: 0x16201e, fogNear: 8, fogFar: 40,
    sky: 0x4a6266, ground: 0x0a0c0a, hemi: 0.52, sun: 0x90a8a8, sunI: 0.5,
    tint: 0xa8b4a0, bgTint: 0xa0b0b0,
    tex: { dirt: 'mud', top: 'mudTop', sky: 'skySwamp', far: 'swampFar', near: 'swampNear' },
    moon: true, dark: 0.5,
    pit: 'water',
    patterns: { ghost: 1.5, pillars: 0.4 },
  },
};

export const BIOME_ORDER = ['cemiterio', 'floresta', 'pantano'];

// primeiro mundo da partida: sorteado (ou forçado por index.html?mundo=floresta)
export function startBiome() {
  const forced = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mundo');
  if (BIOMES[forced]) return BIOMES[forced];
  return BIOMES[BIOME_ORDER[Math.floor(Math.random() * BIOME_ORDER.length)]];
}

// próximo mundo: nunca repete o atual; a cada volta completa fica mais escuro
export function nextBiome(current, loop) {
  const others = BIOME_ORDER.filter((b) => b !== current);
  const id = others[Math.floor(Math.random() * others.length)];
  return { ...BIOMES[id], dark: Math.min(0.72, BIOMES[id].dark + loop * 0.03) };
}

// frase de chegada do mundo (sorteada)
export const biomeIntro = (b) => b.intro?.[Math.floor(Math.random() * b.intro.length)] ?? '';

export const color = (c) => new THREE.Color(c);
