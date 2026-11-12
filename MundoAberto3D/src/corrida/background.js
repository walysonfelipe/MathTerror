import * as THREE from 'three';

/**
 * Fundo "2D": planos presos à câmera com textura rolando em parallax
 * (montanhas, nuvens, colinas) + um campo 3D atrás da pista que segue a câmera.
 */
export function createBackground(scene, camera, tex, camZ) {
  // As camadas 2D ficam numa cena própria, desenhada ANTES do mundo 3D
  // (assim nunca ficam na frente do personagem).
  const bgScene = new THREE.Scene();
  bgScene.background = tex.sky;
  const bgCam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 1, 1000);
  bgScene.add(bgCam);
  const group = new THREE.Group();
  bgCam.add(group);
  const layers = [];

  function addLayer(texture, opts) {
    const mat = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = -100 + layers.length;
    mesh.frustumCulled = false;
    group.add(mesh);
    const l = { mesh, texture, ...opts };
    layers.push(l);
    return l;
  }

  // dist: distância da câmera | k: fração da velocidade da pista | h/y: altura e base (fração da tela)
  addLayer(tex.stars, { dist: 205, k: 0.01, h: 0.5, y: 0.5, tile: 1.4 });
  const moonL = addLayer(tex.moon, { dist: 200, k: 0, h: 0.34, y: 0.6, x: 0.26, tile: 0 });
  // nuvens atrás das montanhas (não cobrem o castelo)
  addLayer(tex.cloudsLayer, { dist: 195, k: 0.03, h: 0.36, y: 0.64, tile: 1.6, drift: 0.004 });
  // keepAspect: a largura do ladrilho segue a proporção da textura (nada esticado)
  const farL = addLayer(tex.mountains, { dist: 190, k: 0.05, h: 0.5, y: 0.36, tile: 1, keepAspect: true });
  const nearL = addLayer(tex.hills, { dist: 180, k: 0.16, h: 0.3, y: 0.36, tile: 1, keepAspect: true });

  // véu de cor do reino: multiplica o céu e as camadas atrás dele
  const tintMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, blending: THREE.MultiplyBlending, transparent: true, premultipliedAlpha: true,
    depthWrite: false, depthTest: false, fog: false,
  });
  const tintPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tintMat);
  tintPlane.renderOrder = 100;
  tintPlane.frustumCulled = false;
  tintPlane.position.z = -150;
  tintPlane.visible = false;
  group.add(tintPlane);

  // ---------- campo atrás da pista (3D) ----------
  const W = 420, D = 24, TILE = 4;
  const top = tex.grassTop.clone();
  top.needsUpdate = true;
  top.repeat.set(W / TILE, D / TILE);
  const front = tex.dirt.clone();
  front.needsUpdate = true;
  front.repeat.set(W / 2, 30 / 2);
  const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 1, color: 0x9a9888, vertexColors: true });
  const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 1, color: 0x5a4a44 });
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  const meadow = new THREE.Mesh(
    new THREE.BoxGeometry(W, 30, D),
    [frontMat, frontMat, hiddenMat, frontMat, frontMat, frontMat], // o topo é a superfície abaixo
  );
  meadow.receiveShadow = true;
  const MEADOW_TOP = -0.5, MEADOW_FRONT = -3.2;
  meadow.position.set(0, MEADOW_TOP - 15, MEADOW_FRONT - D / 2);
  scene.add(meadow);

  // topo do campo: escurece com a distância até sumir no fundo
  // (antes era a face de cima da caixa, clara até o fim e com uma linha reta na borda)
  const topGeo = new THREE.PlaneGeometry(W, D, 1, 16);
  {
    const pos = topGeo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const far = (pos.getY(i) + D / 2) / D; // 0 = beira da pista … 1 = fundo
      const k = THREE.MathUtils.smoothstep(far, 0.08, 0.85);
      const v = 1 - k * 0.97;
      col.set([v, v, v], i * 3);
    }
    topGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const meadowTop = new THREE.Mesh(topGeo, topMat);
  meadowTop.rotation.x = -Math.PI / 2; // +Y da geometria = fundo (−Z)
  meadowTop.position.set(0, MEADOW_TOP, MEADOW_FRONT - D / 2);
  meadowTop.receiveShadow = true;
  scene.add(meadowTop);

  let viewW0 = 1;
  function resize() {
    bgCam.fov = camera.fov;
    bgCam.aspect = camera.aspect;
    bgCam.updateProjectionMatrix();
    bgCam.rotation.copy(camera.rotation);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    viewW0 = 2 * camZ * t * camera.aspect;
    tintPlane.scale.set(2 * 150 * t * camera.aspect * 1.2, 2 * 150 * t * 1.2, 1);
    for (const l of layers) {
      const vh = 2 * l.dist * t, vw = vh * camera.aspect;
      l.vh = vh;
      if (l.keepAspect) {
        const img = l.texture.image;
        l.tile = (img.width / img.height) * l.h / camera.aspect;
      }
      if (l.tile) {
        l.mesh.scale.set(vw * 1.02, vh * l.h, 1);
        l.texture.repeat.set(1.02 / l.tile, 1);
        l.baseY = -vh / 2 + vh * l.y + (vh * l.h) / 2;
        l.mesh.position.set(0, l.baseY, -l.dist);
      } else {
        const s = vh * l.h;
        l.mesh.scale.set(s, s, 1);
        l.baseY = -vh / 2 + vh * l.y + s / 2;
        l.mesh.position.set(vw * l.x, l.baseY, -l.dist);
      }
    }
  }

  function update(camX, camY, time) {
    for (const l of layers) {
      if (l.tile) l.texture.offset.x = (camX * l.k) / (viewW0 * l.tile) + (l.drift || 0) * time;
      // parallax vertical leve
      l.mesh.position.y = l.baseY - (camY - 4) * l.k * (l.vh / 12);
    }
    meadow.position.x = camX;
    meadowTop.position.x = camX;
    top.offset.x = (camX - W / 2) / TILE;
    front.offset.x = (camX - W / 2) / 2;
  }

  let topBase = topMat.color.clone();
  const frontBase = frontMat.color.clone();
  function setTint(color) {
    tintMat.color.copy(color);
    tintPlane.visible = color.r < 0.999 || color.g < 0.999 || color.b < 0.999;
    topMat.color.copy(topBase).multiply(color);
    frontMat.color.copy(frontBase).multiply(color);
  }

  // troca céu, silhuetas do fundo e o campo atrás da pista (no pântano vira água parada)
  function setBiome(b) {
    bgScene.background = tex[b.tex.sky];
    for (const [l, key] of [[farL, b.tex.far], [nearL, b.tex.near]]) {
      l.texture = tex[key];
      l.mesh.material.map = l.texture;
      l.mesh.material.needsUpdate = true;
    }
    moonL.mesh.visible = !!b.moon;
    const water = b.pit === 'water';
    topMat.map = water ? null : top;
    topMat.roughness = water ? 0.08 : 1;
    topMat.metalness = water ? 0.7 : 0;
    topMat.needsUpdate = true;
    topBase = new THREE.Color(water ? 0x0a1212 : b.id === 'floresta' ? 0x6a5a40 : 0x9a9888);
    setTint(new THREE.Color(b.bgTint));
    resize();
  }

  function render(renderer) {
    renderer.render(bgScene, bgCam);
  }

  return { resize, update, render, setTint, setBiome };
}
