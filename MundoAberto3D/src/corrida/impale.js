import * as THREE from 'three';
import { PIT_FLOOR } from './world.js';

/**
 * Morte no buraco: empalado nos espinhos.
 * Câmera lenta no impacto, espinhos atravessando o corpo, respingo escuro,
 * poça se espalhando, gotas pingando, tela avermelhada e zoom da câmera.
 */
const rnd = (a, b) => a + Math.random() * (b - a);

export function createImpale({ scene, particles, sfx }) {
  const spikeGeo = new THREE.ConeGeometry(0.075, 1.5, 7).translate(0, 0.75, 0);
  const spikeMat = new THREE.MeshPhysicalMaterial({ color: 0x2c2628, metalness: 0.8, roughness: 0.35, clearcoat: 0.6 });
  // ponta suja de sangue (só a metade de cima do espinho)
  const tipGeo = new THREE.ConeGeometry(0.045, 0.55, 7).translate(0, 1.5 - 0.275, 0);
  const tipMat = new THREE.MeshPhysicalMaterial({ color: 0x3a0306, roughness: 0.15, clearcoat: 1 });

  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 60, r = 40 + Math.random() * 50;
      const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, '#2a0204ee');
      gr.addColorStop(0.7, '#2a0204aa');
      gr.addColorStop(1, '#2a020400');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  let objs = [];
  let active = false;
  let t = 0;
  let slow = 0;
  let red = 0;
  let x0 = 0, facing = 1;
  let pool = null;
  let dripT = 0;

  function blood(x, y, n, up = 5) {
    for (let i = 0; i < n; i++) {
      particles.smoke({
        x: x + rnd(-0.2, 0.2), y, z: rnd(-0.3, 0.6),
        vx: rnd(-2.5, 2.5), vy: rnd(1, up), vz: rnd(-1, 1.5),
        color: [0.32, 0.02, 0.03], colorEnd: [0.12, 0, 0.01], size: rnd(0.06, 0.16), sizeEnd: 0.03,
        life: rnd(0.5, 0.9), gravity: 14, drag: 0.6, alpha: 0.95,
      });
    }
  }

  // x: posição dos pés; o corpo cai deitado na direção do rosto
  function start(x, dir) {
    active = true;
    t = 0;
    x0 = x;
    facing = dir;
    slow = 0.55;
    red = 1;
    dripT = 0;
    // espinhos extras atravessando o corpo
    for (const [d, z, tilt] of [[0.35, 0.15, 0.08], [0.85, -0.1, -0.12], [1.3, 0.25, 0.15]]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(spikeGeo, spikeMat), new THREE.Mesh(tipGeo, tipMat));
      g.position.set(x + facing * d, PIT_FLOOR - 0.05, z);
      g.rotation.z = tilt * facing;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(g);
      objs.push(g);
    }
    // poça
    const mat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: 0.95 });
    pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x + facing * 0.8, PIT_FLOOR + 0.02, 0.2);
    pool.scale.setScalar(0.01);
    pool.renderOrder = 3;
    scene.add(pool);
    objs.push(pool);

    blood(x + facing * 0.8, PIT_FLOOR + 0.6, 45, 6);
    sfx.impale?.();
  }

  // pose do corpo (chamado pelo player no sync)
  const qy = new THREE.Quaternion(), qz = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  function pose(root, yaw) {
    // cai de costas: gira em torno do eixo da câmera, com um quique e tremores
    const k = Math.min(1, t / 0.18);
    const settle = 1 - Math.exp(-t * 3);
    const bounce = Math.max(0, Math.sin(Math.min(t, 0.6) * 9)) * 0.22 * Math.exp(-t * 4);
    const twitch = t > 0.3 && t < 1.8 ? Math.sin(t * 47) * 0.035 * (1.8 - t) : 0;
    const angle = -facing * (1.32 * (k * k * (3 - 2 * k)) + twitch);
    qy.setFromAxisAngle(Y, yaw);
    qz.setFromAxisAngle(Z, angle);
    root.quaternion.copy(qz).multiply(qy);
    root.position.set(x0, PIT_FLOOR - 0.12 - settle * 0.25 + bounce, 0);
  }

  // retorna o fator de câmera lenta
  function timeScale(dt) {
    if (slow > 0) { slow -= dt; return 0.25; }
    return 1;
  }

  function update(dt) {
    if (!active) { red *= Math.exp(-dt * 3); return; }
    t += dt;
    red = Math.max(0.35, red * Math.exp(-dt * 1.2));
    if (pool) pool.scale.setScalar(0.3 + Math.min(1, t / 2.2) * 2.1);
    // gotas pingando do corpo
    dripT -= dt;
    if (t > 0.3 && t < 3 && dripT <= 0) {
      dripT = rnd(0.12, 0.3);
      particles.smoke({
        x: x0 + facing * rnd(0.3, 1.3), y: PIT_FLOOR + 0.35, z: rnd(0, 0.4), vy: -0.5,
        color: [0.3, 0.02, 0.03], colorEnd: [0.15, 0, 0.01], size: 0.06, sizeEnd: 0.04, life: 0.4, gravity: 9, alpha: 0.9,
      });
    }
  }

  function reset() {
    for (const o of objs) {
      scene.remove(o);
      if (o === pool) { o.geometry.dispose(); o.material.dispose(); }
    }
    objs = [];
    pool = null;
    active = false;
    red = 0;
    slow = 0;
  }

  return {
    start, pose, update, reset, timeScale,
    get active() { return active; },
    get red() { return red; },
  };
}
