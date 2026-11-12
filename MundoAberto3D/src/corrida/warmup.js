import * as THREE from 'three';

/**
 * "Aquecimento" da placa de vídeo durante a tela de carregamento.
 *
 * A primeira vez que algo aparece na tela o navegador precisa compilar o shader,
 * mandar a textura e a malha para a GPU — é isso que causa as travadinhas no meio
 * do jogo. Aqui desenhamos cada cena uma vez, fora da tela, com TUDO visível
 * (inclusive o que está escondido), para esse custo acontecer no carregamento.
 */
const target = new THREE.WebGLRenderTarget(64, 64);

/** espera o próximo quadro (deixa a barra de carregamento andar) */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function warmScene(renderer, scene, camera, { before } = {}) {
  // liga tudo que está invisível e desliga o recorte por câmera
  const hidden = [];
  const culled = [];
  scene.traverse((o) => {
    if (!o.visible) { hidden.push(o); o.visible = true; }
    if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
  });
  try {
    try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.setRenderTarget(target);
    renderer.autoClear = true;
    before?.(renderer);
    // render de verdade: sobe texturas, malhas e o mapa de sombras para a GPU
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  } finally {
    for (const o of hidden) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
  }
  await nextFrame();
}
