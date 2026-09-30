// Sprites e tempos específicos das cenas de luta do modo runner.

export const FIGHT_OWL = {
  src: 'assets/images/owl-fight-sheet.webp',
  frames: [
    [74, 34, 218, 241], [389, 32, 240, 244], [718, 39, 231, 236], [1070, 42, 259, 234],
    [46, 315, 271, 238], [344, 320, 335, 232], [748, 315, 231, 238], [1104, 306, 228, 252],
    [12, 584, 357, 250], [414, 626, 236, 205], [708, 636, 275, 198], [1002, 581, 342, 244],
    [40, 894, 296, 200], [383, 895, 271, 198], [591, 890, 462, 201], [1092, 881, 229, 219],
  ],
};
// boss-fight-frames.webp (reempacotada de boss-fight-sheet.webp): cada pose isolada na sua
// célula, com o brilho próprio e sem pedaços das poses vizinhas (punho do 9, esferas do 6/7/14/15).
// [x, y, w, h, anchorX, anchorY]: anchorX é o meio do tronco (a esfera/fogo não empurra o corpo)
// e anchorY a linha em que as garras tocam o chão (o brilho abaixo dos pés não levanta o boss).
export const FIGHT_BOSS = {
  src: 'assets/images/boss-fight-frames.webp',
  frames: [
    [8, 8, 317, 278, 148, 267], [445, 8, 364, 278, 180, 266], [882, 8, 407, 255, 180, 245], [1319, 8, 305, 262, 146, 251],
    [8, 322, 312, 260, 142, 251], [445, 322, 310, 264, 135, 254], [882, 322, 408, 254, 141, 246], [1319, 322, 357, 249, 120, 238],
    [8, 636, 328, 249, 162, 236], [445, 636, 297, 298, 151, 290], [882, 636, 421, 238, 176, 228], [1319, 636, 329, 278, 150, 270],
    [8, 950, 308, 266, 134, 258], [445, 950, 325, 265, 140, 257], [882, 950, 414, 261, 153, 252], [1319, 950, 381, 241, 130, 233],
  ],
  maxW: 421,   // pose mais larga: limita a escala em telas estreitas sem o boss mudar de tamanho
};
// Reação do boss ao golpe: 16 recortes alfa individuais, em ordem de leitura.
// Os sprites vão da preparação (0–3), passam pelos impactos (4–11) e terminam
// com a reação forte e a recuperação (12–15).
export const FIGHT_BOSS_HIT = {
  src: 'assets/images/boss-strike-sheet.webp',
  frames: [
    [18, 3, 320, 269], [378, 6, 317, 266], [740, 3, 323, 269], [1115, 6, 318, 266],
    [37, 272, 308, 271], [381, 272, 315, 271], [741, 272, 319, 271], [1112, 272, 313, 271],
    [19, 547, 322, 268], [380, 543, 315, 268], [742, 546, 318, 266], [1113, 543, 323, 272],
    [20, 815, 316, 257], [385, 815, 324, 257], [725, 815, 336, 256], [1113, 815, 320, 257],
  ],
};
export const FIGHT_BOSS_HIT_DURATION = 0.88;
export const FIGHT_BOSS_HIT_FRAME_TIME = FIGHT_BOSS_HIT_DURATION / FIGHT_BOSS_HIT.frames.length;
// Poder do boss: carrega a esfera na mão (2 quadros), solta (1 quadro) e segue de punhos
// fechados (3) enquanto a esfera voa sozinha. Os quadros 7 e 15 ficam de fora: neles a bola
// ainda está na mão e ela apareceria duas vezes.
export const BOSS_CASTS = [
  [4, 5, 6],        // esfera de fogo
  [12, 13, 14],     // rajada de energia
];
export const BOSS_CAST_FRAME = 0.14;
export const BOSS_CAST_TIME = BOSS_CASTS[0].length * BOSS_CAST_FRAME;
export const BOSS_AFTER_CAST = 3;                 // punhos fechados depois de soltar
export const BOSS_RELEASE = { x: 200, y: 135 };   // centro da esfera ao soltar (6 e 14), px da prancha a partir das âncoras
// Golpe no chão (8–11): comemoração do boss quando a coruja cai derrotada.
export const BOSS_SLAM = [8, 9, 10, 11];
export const BOSS_SLAM_TIMES = [0.16, 0.24, 0.32, 0.3];
export const BOSS_SLAM_HIT = BOSS_SLAM_TIMES[0] + BOSS_SLAM_TIMES[1];   // o punho bate no chão (quadro 10)
// Derrota na luta (owl-death-sheet.webp, gerada sem os respingos soltos).
// 0–2 a esfera π chega e explode · 3–5 arremessada no ar · 6–11 cai, derrapa na poeira
// e chuta · 12–15 ergue a cabeça e desmaia deitada.
// [x, y, w, h, anchorX, anchorY]: recorte pelo alfa de cada pose; anchorX é o centro do
// corpo (sem o fogo) e anchorY a linha em que o corpo/pés tocam o chão.
export const FIGHT_DEATH = {
  src: 'assets/images/owl-death-sheet.webp',
  frames: [
    [2, 66, 415, 207, 333, 204], [418, 67, 346, 208, 263, 206], [775, 69, 309, 213, 217, 207], [1179, 94, 256, 190, 151, 183],
    [86, 338, 270, 226, 153, 223], [418, 377, 292, 196, 169, 192], [790, 414, 297, 167, 160, 164], [1128, 428, 293, 150, 158, 147],
    [28, 652, 350, 164, 196, 160], [389, 683, 361, 133, 194, 130], [774, 661, 315, 154, 163, 152], [1119, 688, 310, 129, 171, 126],
    [55, 879, 324, 165, 178, 161], [417, 914, 322, 128, 174, 125], [770, 918, 319, 121, 172, 119], [1118, 918, 308, 121, 167, 118],
  ],
  times: [
    0.12, 0.12, 0.14, 0.12,   // impacto
    0.11, 0.11, 0.12, 0.12,   // voo e queda
    0.12, 0.12, 0.14, 0.14,   // derrapa na poeira
    0.20, 0.18, 0.18, 0.18,   // desmaia
  ],
  scale: 0.74,        // a coruja em pé fica do mesmo tamanho das outras pranchas da luta
  maxW: 415,          // pose mais larga: limita a escala em telas estreitas sem mudar entre quadros
  knockback: 70,      // quanto ela é empurrada para trás (para longe do boss)
  lift: 40,           // altura do arremesso nos quadros 3–5
  finalHold: 0.8,
  // Esfera no quadro 0 (chegando na coruja), a partir das âncoras, e tamanho em relação ao voo.
  impactBall: { dx: -134, dy: 110, size: 0.94 },
};
// Antes da coruja cair, o boss prepara e lança a esfera (BOSS_CASTS), que atravessa a arena.
export const FIGHT_DEATH_TRAVEL = 0.36;
export const FIGHT_DEATH_HIT_AT = BOSS_CAST_TIME + FIGHT_DEATH_TRAVEL;
export const FIGHT_DEATH_STARTS = FIGHT_DEATH.times.reduce((starts, time) => [...starts, starts[starts.length - 1] + time], [0]);
export const FIGHT_DEATH_IMPACT_AT = FIGHT_DEATH_HIT_AT + FIGHT_DEATH_STARTS[2];     // explosão: perde a vida
export const FIGHT_DEATH_LANDED_AT = FIGHT_DEATH_HIT_AT + FIGHT_DEATH_STARTS[6];     // corpo toca o chão
// Com a coruja já no chão, o boss comemora batendo o punho no chão.
export const FIGHT_DEATH_SLAM_AT = FIGHT_DEATH_LANDED_AT + 0.25;
export const FIGHT_DEATH_DURATION = Math.max(
  FIGHT_DEATH_HIT_AT + FIGHT_DEATH_STARTS[16] + FIGHT_DEATH.finalHold,
  FIGHT_DEATH_SLAM_AT + BOSS_SLAM_TIMES.reduce((sum, time) => sum + time, 0) + 0.4,
);
// Sequência do poder do boss: disparo (0–3), impacto (4–11), queda/recuperação (12–15).
// Os limites seguem o alfa real de cada pose (incluindo brasas e faíscas), sem quadrantes uniformes.
// [x, y, w, h, anchorX, anchorY]: âncoras relativas ao canto do recorte; anchorY é a linha do chão.
export const BOSS_POWER = {
  src: 'assets/images/boss-power-attack-sheet.webp',
  frames: [
    [36, 60, 315, 171, 248], [391, 62, 322, 169, 255], [746, 66, 319, 164, 256], [1099, 61, 322, 170, 257],
    [7, 320, 382, 194, 293, 198], [389, 322, 365, 193, 284, 196], [754, 315, 354, 200, 257, 204], [1108, 301, 331, 215, 215, 219],
    [15, 537, 375, 244, 281, 248], [401, 537, 362, 237, 270, 240], [774, 564, 353, 204, 246, 195], [1136, 565, 302, 187, 206, 194],
    [80, 817, 278, 202, 177, 201], [419, 839, 324, 192, 167, 196], [801, 846, 243, 188, 135, 192], [1172, 830, 203, 207, 101, 211],
  ],
  // Na segunda linha as poses se encostam: margem lateral extra puxaria a coruja vizinha.
  touchingFrames: [4, 5, 6, 7],
  // Centro da esfera π nos quadros 0–3 do voo (medido por correlação), relativo a x/y do recorte.
  projectileCore: [[248, 85], [250, 82], [246, 78], [247, 82]],
  projectileScale: 0.76,
  maxW: 390,          // pose mais larga: limita a escala em telas estreitas sem mudar entre quadros
  // Esfera no quadro 4 (encostando na coruja): posição a partir das âncoras e tamanho em
  // relação à esfera do voo. O voo termina exatamente aqui para não voltar para trás.
  impactBall: { dx: -152, dy: 111, size: 0.78 },
};
// Tempos por pose: aproximação curta, impacto legível e recuo/recuperação mais longos.
export const BOSS_POWER_FRAME_TIMES = [
  0.12, 0.12, 0.12, 0.12,
  0.10, 0.10, 0.10, 0.10,
  0.12, 0.12, 0.12, 0.12,
  0.14, 0.14, 0.14, 0.14,
];
export const BOSS_POWER_IMPACT_AT = BOSS_POWER_FRAME_TIMES.slice(0, 8).reduce((sum, time) => sum + time, 0);
export const BOSS_POWER_DURATION = BOSS_POWER_FRAME_TIMES.reduce((sum, time) => sum + time, 0);
export const FIGHT_TURN_TIME = 0.8;
// Letreiro "Fight" antes da primeira pergunta: 0 surge, 1 explode, 2 e 3 pulsam.
// [x, y, w, h, anchorX, anchorY]: recorte pelo alfa de cada quadrante e centro das letras,
// para a palavra não pular entre quadros com contornos de fogo diferentes.
export const FIGHT_INTRO = {
  src: 'assets/images/fight.webp',
  frames: [
    [46, 104, 722, 372, 343, 207], [768, 70, 752, 440, 384, 221],
    [23, 576, 737, 379, 382, 179], [804, 579, 687, 352, 347, 189],
  ],
  baseW: 722,
  baseH: 372,
};
export const FIGHT_INTRO_DURATION = 1.5;
export const FIGHT_OWL_COMBOS = [
  [4, 5, 6],       // soco e recuperação
  [7, 8, 6],       // chute e recuperação
  [9, 10, 11],     // esquiva baixa e golpe de asa
  [4, 5, 8, 11],   // sequência final
];
