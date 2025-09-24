// ===================== CONFIG GERAL =====================
// Ajuste tudo aqui em cima e pronto.
export const CONFIG = {
  // Velocidade de digitação (ms por caractere)
  // 18 = rápido | 28 = médio | 40–55 = lento
  TYPE_CHAR_DELAY: 100,

  // A cada quantas letras o SFX de digitação toca (ex.: 3 = a cada 3 letras)
  TYPE_SFX_EVERY: 13,

  // Volume do efeito de digitação (0.0 = mudo, 1.0 = máximo)
  TYPE_SFX_VOLUME: 0.09,

  // Duração do jumpscare (imagem de erro) na tela, em ms
  // Ex.: 800 = rápido | 1200 = médio | 1800 = demorado
  JUMPSCARE_DURATION_MS: 1800,

  // Tempo (ms) até resetar pro início após VENCER (o erro já reseta ao fim do jumpscare)
  AUTO_RESET_DELAY: 1800
};

// ===== ALEATORIZAÇÃO =====
export const RANDOMIZE_QUESTIONS = true;  // embaralhar ordem das perguntas
export const RANDOMIZE_OPTIONS   = true;  // embaralhar ordem das alternativas de cada pergunta