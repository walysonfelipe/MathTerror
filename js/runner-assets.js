// Catálogo de sprites, animações e dimensões do modo runner.

// owl-sheet.webp: grade 4x4 de 312x270, de perfil olhando para a direita.
// Quadros alinhados pelos pés (base) e pelo centro do corpo (horizontal).
// Linha 1: 0 parada · 1 piscando · 2 olho fechado · 3 passada
// Linhas 2–3: corrida, 3 quadros por passo (passada → apoio → impulso), trocando de pé
// Linha 4: pulo — 12 agacha · 13 decola · 14 no ar (asas abertas) · 15 aterrissa
export const OWL = { src: 'assets/images/owl-sheet.webp', w: 312, h: 270, cols: 4 };
// Limites alfa individuais das 16 poses, na ordem de leitura das pranchas.
// Cada pose mantém o seu tamanho e proporção próprios; não é recortada por quadrantes.
export const OWL_ANIMS = {
  idle: { frames: [0, 0, 0, 0, 0, 1, 2, 1, 0, 0], fps: 6 },  // parada, piscando
};
// Corrida controlada pela distância percorrida, não pelo relógio.
// Passo 1: 3 → 4 → 5 · passo 2: 6 → 7 → 8 · passo 3: 9 → 10 → 11
export const RUN_FRAMES = [3, 4, 5, 6, 7, 8, 9, 10, 11];
export const RUN_STEP = 3;                  // quadros por passo
// ground-sheet.webp: grade 3x4 de 244x108, alinhados pelo topo da plataforma.
export const GROUND = { src: 'assets/images/ground-sheet.webp', w: 244, h: 108, cols: 3, count: 12 };
// boss-sheet.webp: grade 4x4 de 258x235, pés no chão e bico alinhado. Olha para a direita.
// Linha 1: parado/piscando · Linha 2: andando · Linha 3: salto (8 prepara, 9 decola,
// 10 no ar, 11 aterrissa) · Linha 4: 12 e 15 guarda, 13 rugido, 14 levou o golpe.
export const BOSS = { src: 'assets/images/boss-sheet.webp', w: 258, h: 235, cols: 4 };
export const BOSS_ANIMS = {
  idle: { frames: [0, 0, 1, 0, 3, 0, 0, 2, 0, 1], fps: 5 },
  guard: { frames: [12, 12, 15, 12, 12, 15], fps: 3 },   // já perto: posição de luta
};
export const BOSS_WALK = [4, 5, 6, 7];
// door-pass-sheet.webp (gerado de image.png): grade 4x5 de 472x252, coruja e porta juntas.
// Toda célula alinhada pelo arco da porta (centro em x=244), então a porta fica parada no mundo.
// 0–15: passagem (chega · empurra a porta · entra · sai do outro lado) · 16: fechada · 17: aberta.
export const PASS = { src: 'assets/images/door-pass-sheet.webp', w: 472, h: 252, cols: 4, doorX: 244, ground: 242, frames: 16, closed: 16, open: 17 };
// Centro da coruja em relação ao centro da porta em cada quadro (px do sprite, medido).
export const PASS_OWL_DX = [-172, -144, -144, -104, -105, -92, -68, -77, -25, -12, -7, -5, 108, 123, 132, 152];
export const PASS_DOOR_FRAME = 4;           // quadro em que a coruja empurra a porta (som)
// grab-sheet.webp: captura, boss e coruja juntos. Grade 4x3 de 296x297, boss firme no chão.
// Linha 1 (0–3): estica o braço · Linha 2 (4–7): agarra e puxa · Linha 3 (8–11): ergue a coruja rugindo.
export const GRAB = { src: 'assets/images/grab-sheet.webp', w: 296, h: 297, cols: 4 };
export const GRAB_OWL_X = 0.841;   // centro da coruja no quadro 0 (fração da largura)
export const GRAB_BOSS_X = 0.38;   // centro do boss no quadro 0
// Passa por todos os quadros em ordem: linha 1 (1–4), linha 2 (5–8), linha 3 (9–12).
export const GRAB_FRAME_TIME = 0.28;          // tempo de cada quadro
export const GRAB_FRAMES = 12;
export const GRAB_END = GRAB_FRAME_TIME * GRAB_FRAMES;
export const GRAB_GAME_OVER = GRAB_END + 0.7; // fim de jogo só depois do último quadro

// Tamanhos no "mundo" (unidades). O canvas escala tudo para caber na tela.
export const TILE_W = 240;
export const TILE_H = TILE_W * GROUND.h / GROUND.w;
export const TILE_STEP = TILE_W * 0.94;     // leve sobreposição para esconder as bordas
export const SURFACE = TILE_H * 0.14;       // distância do topo do sprite até o chão pisável
export const OWL_H = 150;
export const OWL_W = OWL_H * OWL.w / OWL.h;
export const FOOT = OWL_W * 0.16;           // meia largura dos pés para colisão
export const PASS_SCALE = 1;                // unidades do mundo por px do sprite (coruja do mesmo tamanho da corrida)
export const PASS_DRAW_W = PASS.w * PASS_SCALE;
export const PASS_DRAW_H = PASS.h * PASS_SCALE;
// Sequência depois do acerto (segundos desde o acerto):
export const CELEBRATE_TIME = 0.45;         // coruja comemora
export const PASS_FRAME_TIME = 0.1;         // cada quadro da passagem pela porta
export const PASS_TIME = PASS.frames * PASS_FRAME_TIME;
export const BOSS_H = OWL_H * 1.75;
// Na captura a cena fica 1,3x maior que o boss normal: ele "cresce" por cima da coruja.
export const GRAB_H = BOSS_H * (GRAB.h / 235) * 1.3;
export const GRAB_W = GRAB_H * GRAB.w / GRAB.h;
export const BOSS_W = BOSS_H * BOSS.w / BOSS.h;
export const BOSS_SPEED = 240;              // velocidade máxima para acompanhar a barra
export const BOSS_RETREAT_SPEED = 320;      // fugindo depois de levar um acerto
export const BOSS_STRIDE = 14;              // unidades por quadro de caminhada
export const BOSS_GRAVITY = 3200;
export const BOSS_LEAP_TIME = 0.6;          // tempo no ar de cada salto
export const STRIDE = 18;                   // unidades percorridas por quadro de corrida (evita pé deslizando)
export const RUN_BOB = 7;                   // quanto o corpo sobe na passagem entre os passos
export const CROUCH_TIME = 0.08;            // agachada antes de sair do chão (quadro 12)
export const LAND_TIME = 0.16;              // aterrissagem antes de voltar a correr (quadro 15)
export const JUMP_BUFFER = 0.15;            // aperto logo antes de tocar o chão já vale como pulo
export const HOP_TIME = CELEBRATE_TIME;      // um pulinho de comemoração parado no lugar

