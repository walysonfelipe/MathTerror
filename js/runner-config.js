// Configurações de ritmo e física do modo runner.

export const LIVES = 3;
export const LEG_SECONDS = 20;          // tempo correndo até o próximo checkpoint
export const QUESTION_SECONDS = 30;     // tempo da barra encher (boss pega a coruja), sem erros
export const BOSS_APPEAR_AT = 0.7;      // o boss só entra na tela quando a barra passa de 70%
// O que cada erro no checkpoint faz com o boss (índice 0 = 1º erro):
// closeTo: a barra pula pelo menos até aqui (0,7 = boss entra na tela; 1 = pegou a coruja)
// pace: quantas vezes mais rápido que o normal ele passa a vir
// retrySeconds: tempo mínimo que ainda sobra para responder; se faltar, ele desacelera
export const ERROR_STEPS = [
  { closeTo: 0.7, pace: 2.4, retrySeconds: 4 },     // 1º erro: aparece e dispara
  { closeTo: 0.97, pace: 3, retrySeconds: 3.5 },    // 2º erro: colado na coruja, última chance
];
export const MAX_ERRORS = 3;            // o modo de luta abre no 3º erro
export const SPEED_START = 330;         // unidades/segundo
export const SPEED_GAIN = 1.08;         // aumento de velocidade a cada checkpoint
export const GRAVITY = 2600;
export const JUMP_VELOCITY = -1080;

