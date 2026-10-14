// Visual do chão em cada fase do mundo (ver WORLD_STAGES).
import { GROUND } from './runner-assets.js';
import { WORLD_STAGES } from './runner-config.js';

const cooled = new Map();

// A lava esfriou: tons de cinza levemente azulados e as rachaduras quentes viram pedra escura.
// Feito uma vez sobre a sheet inteira; se o canvas não puder ler os pixels, cai num filtro.
function coolSheet(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const c = canvas.getContext('2d');
  try {
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const glow = Math.max(0, Math.min(1, (r - b - 50) / 110));   // quanto o pixel é lava
      const v = (lum * 0.9 + 26) * (1 - glow) + (22 + lum * 0.18) * glow;
      px[i] = v * 0.95;
      px[i + 1] = v * 0.99;
      px[i + 2] = v * 1.07;
    }
    c.putImageData(data, 0, 0);
  } catch {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.filter = 'grayscale(1) brightness(0.8)';
    c.drawImage(img, 0, 0);
  }
  return canvas;
}

// Imagem do chão para a fase (índice em WORLD_STAGES); null enquanto a sheet carrega.
export function groundSheet(stage, loadImage) {
  const img = loadImage(GROUND.src);
  if (!img.complete || !img.naturalWidth) return null;
  if (WORLD_STAGES[stage]?.ground !== 'stone') return img;
  if (!cooled.has(img)) cooled.set(img, coolSheet(img));
  return cooled.get(img);
}

// 0 = lava, 1 = pedra fria: usado para esfriar o céu e trocar brasas por cinzas.
export function stageColdness(stage) {
  return WORLD_STAGES[stage]?.ground === 'stone' ? 1 : 0;
}

