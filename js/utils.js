import { RANDOMIZE_OPTIONS } from './config.js';

// ======= SHUFFLE UTILS (Fisher–Yates) =======
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Clona a pergunta e (opcionalmente) embaralha as opções
export function cloneWithShuffledOptions(q) {
  if (!RANDOMIZE_OPTIONS) return { ...q };
  const optIdx = Array.from({ length: q.options.length }, (_, i) => i);
  shuffleInPlace(optIdx);

  const newOptions = optIdx.map(i => q.options[i]);
  const newAnswer  = optIdx.indexOf(q.answer);

  return { ...q, options: newOptions, answer: newAnswer };
}

// ===== Helpers para rótulos A/B/C/D/E =====
export function letterForIndex(i) {
  const letters = ['A','B','C','D','E','F','G'];
  return letters[i] || String(i + 1);
}

export function isABCDLabel(val) {
  return typeof val === 'string' && /^[a-e]$/i.test(val);
}