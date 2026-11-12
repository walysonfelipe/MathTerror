import * as THREE from 'three';

/**
 * Armadura medieval completa (feita em código), sobre um pedestal de pedra.
 * Olha para +z, base na origem, ~2,1 m com o pedestal.
 * Quando o jogador chega perto, olhos vermelhos acendem no visor e o elmo vira para ele.
 */

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// metal riscado e com ferrugem
function steelTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a8c94';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
      const x = Math.random() * w, y = Math.random() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 4); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(110,50,20,${0.08 + Math.random() * 0.2})`;
      g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
  });
}

// tabardo vermelho com o brasão do corvo
function tabardTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#4a0608';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.fillRect(x, 0, 1, h); }
    g.strokeStyle = '#b8903a';
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    // corvo de asas abertas
    g.fillStyle = '#0a0a0a';
    g.beginPath();
    g.moveTo(w / 2, 70); g.lineTo(w / 2 + 40, 52); g.lineTo(w / 2 + 14, 82); g.lineTo(w / 2 + 10, 116);
    g.lineTo(w / 2, 104); g.lineTo(w / 2 - 10, 116); g.lineTo(w / 2 - 14, 82); g.lineTo(w / 2 - 40, 52);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(w / 2, 64, 8, 0, Math.PI * 2); g.fill();
    // barra rasgada
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - Math.random() * 30);
    g.lineTo(w, h); g.fill();
  });
}

export function createArmor(stoneTex) {
  const root = new THREE.Group();
  const steelMap = steelTexture();
  const steel = new THREE.MeshStandardMaterial({ map: steelMap, color: 0x9a9ca4, metalness: 0.85, roughness: 0.38 });
  const darkSteel = new THREE.MeshStandardMaterial({ map: steelMap, color: 0x4a4c54, metalness: 0.8, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a28, metalness: 0.85, roughness: 0.35 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x5a5250, roughness: 1 });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

  // ---------- pedestal ----------
  add(root, new THREE.BoxGeometry(0.95, 0.22, 0.75), stone, 0, 0.11, 0);
  add(root, new THREE.BoxGeometry(0.85, 0.06, 0.65), stone, 0, 0.25, 0);
  const B = 0.28; // altura onde a armadura pisa

  const body = new THREE.Group();
  body.position.y = B;
  root.add(body);

  // ---------- pernas ----------
  for (const s of [-1, 1]) {
    const x = s * 0.11;
    // sapato de placas (sabaton)
    const foot = add(body, new THREE.CapsuleGeometry(0.055, 0.17, 4, 10), darkSteel, x, 0.06, 0.06);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1, 1, 0.75);
    // canela (greave)
    add(body, lathe([[0.05, 0.08], [0.062, 0.2], [0.068, 0.34], [0.06, 0.48]]), steel, x, 0, 0);
    // joelheira com aba
    const knee = add(body, new THREE.SphereGeometry(0.072, 14, 10), steel, x, 0.52, 0.02);
    knee.scale.set(1, 0.9, 1.1);
    const fan = add(body, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14, 1, false, -Math.PI / 2, Math.PI), darkSteel, x + s * 0.05, 0.52, 0.02);
    fan.rotation.z = Math.PI / 2;
    // coxa (cuisse)
    add(body, lathe([[0.065, 0.56], [0.08, 0.72], [0.085, 0.88]]), steel, x, 0, 0);
  }

  // ---------- saia de placas (faulds) ----------
  for (let i = 0; i < 3; i++) {
    const y = 0.9 + i * 0.075;
    add(body, lathe([[0.23 - i * 0.012, y], [0.21 - i * 0.012, y + 0.08]], 32), i % 2 ? darkSteel : steel).scale.z = 0.78;
  }

  // ---------- peitoral ----------
  const chest = add(body, lathe([
    [0.17, 1.08], [0.19, 1.18], [0.23, 1.3], [0.24, 1.38], [0.22, 1.46], [0.16, 1.5], [0.09, 1.52],
  ], 36), steel);
  chest.scale.z = 0.72;
  // aresta central do peitoral
  const ridge = add(body, new THREE.BoxGeometry(0.018, 0.4, 0.02), brass, 0, 1.28, 0.165);
  ridge.rotation.x = -0.12;
  // rebites
  for (const [x, y] of [[-0.12, 1.42], [0.12, 1.42], [-0.15, 1.2], [0.15, 1.2]]) add(body, new THREE.SphereGeometry(0.012, 6, 4), brass, x, y, 0.16);
  // gorjal (pescoço)
  add(body, lathe([[0.1, 1.5], [0.085, 1.56], [0.08, 1.6]], 24), darkSteel).scale.z = 0.9;

  // ---------- tabardo e capa ----------
  const tabMat = new THREE.MeshStandardMaterial({ map: tabardTexture(), roughness: 0.95, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const tabard = add(body, new THREE.PlaneGeometry(0.3, 0.68, 1, 8), tabMat, 0, 1.0, 0.19);
  tabard.rotation.x = 0.04;
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x2a0406, roughness: 1, side: THREE.DoubleSide });
  const capeGeo = new THREE.PlaneGeometry(0.52, 1.3, 6, 10).translate(0, -0.65, 0);
  const cape = add(body, capeGeo, capeMat, 0, 1.5, -0.2);
  const capeBase = capeGeo.attributes.position.array.slice();

  // ---------- braços ----------
  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.27, 1.46, 0);
    body.add(shoulder);
    // ombreira em camadas (pauldron)
    const p1 = add(shoulder, new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 0.02, 0);
    p1.scale.set(1.1, 0.9, 1);
    for (let i = 0; i < 2; i++) {
      const lame = add(shoulder, new THREE.CylinderGeometry(0.12 - i * 0.01, 0.13 - i * 0.01, 0.05, 18, 1, true), i ? steel : darkSteel, 0, -0.03 - i * 0.045, 0);
      lame.scale.set(1.05, 1, 0.95);
    }
    add(shoulder, new THREE.CylinderGeometry(0.052, 0.048, 0.26, 12).translate(0, -0.15, 0), darkSteel);
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);
    add(elbow, new THREE.SphereGeometry(0.06, 12, 8), steel);
    const wing = add(elbow, new THREE.ConeGeometry(0.05, 0.06, 4), steel, s * 0.05, 0, -0.01);
    wing.rotation.z = -s * Math.PI / 2;
    add(elbow, lathe([[0.05, -0.02], [0.047, -0.14], [0.042, -0.25]], 14), steel);
    const hand = new THREE.Group();
    hand.position.y = -0.28;
    elbow.add(hand);
    add(hand, new THREE.BoxGeometry(0.075, 0.09, 0.05), darkSteel, 0, -0.04, 0);
    const cuff = add(hand, new THREE.CylinderGeometry(0.06, 0.05, 0.06, 12), steel, 0, 0.01, 0);
    cuff.scale.z = 0.85;
    for (let f = 0; f < 4; f++) add(hand, new THREE.BoxGeometry(0.016, 0.06, 0.02), darkSteel, -0.026 + f * 0.017, -0.11, 0.008);
    return { s, shoulder, elbow, hand };
  });
  // braço direito segura a alabarda; o esquerdo descansa no cabo da espada
  const [L, R] = arms;
  L.shoulder.rotation.set(0.05, 0, -0.12);
  L.elbow.rotation.set(-0.5, 0, 0.2);
  R.shoulder.rotation.set(-0.35, 0, 0.18);
  R.elbow.rotation.set(-1.15, 0, 0);
  // espada embainhada na cintura
  const sword = new THREE.Group();
  add(sword, new THREE.BoxGeometry(0.035, 0.7, 0.03), leather, 0, -0.35, 0);
  add(sword, new THREE.BoxGeometry(0.16, 0.02, 0.03), brass, 0, 0.0, 0);
  add(sword, new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), leather, 0, 0.07, 0);
  add(sword, new THREE.SphereGeometry(0.022, 8, 6), brass, 0, 0.14, 0);
  sword.position.set(-0.2, 1.05, 0.08);
  sword.rotation.z = -0.12;
  body.add(sword);

  // alabarda (presa na mão direita)
  const halberd = new THREE.Group();
  add(halberd, new THREE.CylinderGeometry(0.018, 0.018, 2.3, 8), leather, 0, 0, 0);
  const blade = add(halberd, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 16, 1, false, 0, Math.PI), steel, 0.08, 0.95, 0);
  blade.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  add(halberd, new THREE.ConeGeometry(0.03, 0.3, 4), steel, 0, 1.3, 0);
  const hook = add(halberd, new THREE.ConeGeometry(0.025, 0.14, 4), steel, -0.07, 0.95, 0);
  hook.rotation.z = Math.PI / 2;
  halberd.position.set(0.39, 1.12, 0.22);
  body.add(halberd);

  // ---------- elmo (great helm) ----------
  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  body.add(head);
  add(head, lathe([[0.11, 0], [0.125, 0.06], [0.128, 0.18], [0.12, 0.25], [0.09, 0.3], [0.04, 0.33], [0.0, 0.335]], 28), steel).scale.z = 0.95;
  // visor: fenda dos olhos e furos de respiração
  add(head, new THREE.BoxGeometry(0.17, 0.022, 0.03), voidMat, 0, 0.19, 0.115);
  add(head, new THREE.BoxGeometry(0.012, 0.13, 0.03), brass, 0, 0.12, 0.122); // reforço vertical
  for (const sx of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 3; k++) add(head, new THREE.SphereGeometry(0.007, 6, 4), voidMat, sx * (0.035 + k * 0.022), 0.11 - row * 0.024, 0.123);
    }
  }
  // olhos que acendem
  const eyes = [-1, 1].map((s) => add(head, new THREE.SphereGeometry(0.011, 8, 6), eyeMat, s * 0.045, 0.19, 0.131));
  // espinho no topo e pluma escura
  add(head, new THREE.ConeGeometry(0.02, 0.12, 6), brass, 0, 0.39, 0);
  const plume = add(head, new THREE.ConeGeometry(0.04, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x1a0204, roughness: 1 }), 0, 0.42, -0.12);
  plume.rotation.x = -1.9;

  root.traverse((o) => { if (o.isMesh && o.material !== eyeMat) o.castShadow = true; });

  // ---------- animação ----------
  let glow = 0;
  /** px: x do jogador em coordenadas do mundo; dist: distância até ele */
  function update(dt, time, px, dist) {
    const near = dist < 4.5;
    glow += ((near ? 1 : 0) - glow) * Math.min(1, dt * (near ? 3 : 1));
    eyeMat.opacity = glow * (0.75 + Math.sin(time * 9) * 0.25);
    for (const e of eyes) e.scale.setScalar(0.6 + glow * 0.6);
    // o elmo vira devagar na direção do jogador
    const want = near ? Math.max(-0.75, Math.min(0.75, (px - root.position.x) * 0.35)) - root.rotation.y : 0;
    head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * 1.5);
    head.rotation.z = glow * Math.sin(time * 0.7) * 0.04;
    // capa balançando com a corrente de ar do castelo
    const p = capeGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const y = capeBase[i + 1];
      const k = -y / 1.3;
      p[i + 2] = capeBase[i + 2] - Math.sin(time * 1.3 + capeBase[i] * 4 + y * 2) * 0.035 * k - k * 0.05;
    }
    capeGeo.attributes.position.needsUpdate = true;
    tabard.rotation.x = 0.04 + Math.sin(time * 1.1) * 0.03;
  }

  return { root, update };
}
