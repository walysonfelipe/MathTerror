// Configurações de ritmo e física do modo runner.

export const LIVES = 3;
export const LEG_SECONDS = 20;          // tempo correndo até o próximo checkpoint
export const QUESTION_SECONDS = 30;     // tempo da barra encher (boss pega a coruja), sem erros
export const BOSS_APPEAR_AT = 0.7;      // o boss só entra na tela quando a barra passa de 70%
export const ERROR_SPEEDUP = 0.35;      // cada erro deixa o boss 35% mais rápido nesta questão
export const MIN_RETRY_SECONDS = 6;     // após um erro sempre sobra pelo menos esse tempo para tentar de novo
export const WRONG_PENALTY = 0.1;       // saltinho para frente a cada erro (0–1)
export const MAX_ERRORS = 3;            // o modo de luta abre no 3º erro
export const SPEED_START = 330;         // unidades/segundo
export const SPEED_GAIN = 1.08;         // aumento de velocidade a cada checkpoint
export const GRAVITY = 2600;
export const JUMP_VELOCITY = -1080;

