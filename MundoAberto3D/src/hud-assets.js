// Arte do MathTerror 2D reaproveitada na interface do 3D (mesmos arquivos, sem cópia).
const IMG = {
  logo: new URL('../../assets/images/logo.webp', import.meta.url).href,
  panel: new URL('../../assets/images/gameover-panel.webp', import.meta.url).href,
  hud: new URL('../../assets/images/hud-frame-3.webp', import.meta.url).href,
  buttons: new URL('../../assets/images/gameover-buttons.webp', import.meta.url).href,
  hearts: new URL('../../assets/images/hearts-sheet.webp', import.meta.url).href,
  digits: new URL('../../assets/images/digits-sheet.webp', import.meta.url).href,
};

/** Expõe as imagens como variáveis CSS (--img-panel, --img-hud, ...) e preenche a logo. */
export function applyHudAssets() {
  const root = document.documentElement.style;
  for (const [k, url] of Object.entries(IMG)) root.setProperty(`--img-${k}`, `url("${url}")`);
  document.querySelectorAll('[data-logo]').forEach((img) => { img.src = IMG.logo; });
}

/** Números com os dígitos dourados do 2D. Outros caracteres saem como texto. */
export function digitsHTML(text) {
  return [...String(text)].map((ch) => (/\d/.test(ch)
    ? `<span class="dg" style="--d:${ch}"></span>`
    : `<span class="dg-sym">${ch === ' ' ? '&nbsp;' : ch}</span>`)).join('');
}

/**
 * Coração da sanidade (hearts-sheet 6x3). fill: 1 cheio … 0 vazio.
 * Linha 2 da folha: cheio → rachando → apagado.
 */
export function heartFrame(fill) {
  if (fill >= 0.999) return { c: 0, r: 1 };
  if (fill <= 0.001) return { c: 5, r: 1 };
  return { c: Math.min(4, 1 + Math.floor((1 - fill) * 4)), r: 1 };
}
