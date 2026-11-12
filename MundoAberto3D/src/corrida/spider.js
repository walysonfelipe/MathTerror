import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Aranha procedural: cefalotórax + abdômen peludo com marcas que brilham,
 * 8 olhos vítreos, quelíceras com presas pingando veneno e 8 pernas
 * articuladas (IK de 2 ossos + tarso) com marcha alternada em tetrápode.
 *
 * Eixos locais: +z = frente, +y = cima, origem no chão.
 */

const UP = new THREE.Vector3(0, 1, 0);

// ---------- texturas do abdômen ----------
function abdomenMaps() {
  const W = 512, H = 256;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const colorC = mk(), emitC = mk();
  const g = colorC.getContext('2d');
  const e = emitC.getContext('2d');

  // base escura com pelos
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#22141a');
  gr.addColorStop(0.6, '#140b0f');
  gr.addColorStop(1, '#0a0507');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    g.strokeStyle = Math.random() < 0.5 ? '#2c1c22' : '#07040599';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y + 4 + Math.random() * 5);
    g.stroke();
  }
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  // marcas: divisa em "V" ao longo do dorso traseiro (u = 0.75) + pintas laterais
  const marks = (ctx, color, glow) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = glow ? 10 : 0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = W * 0.75;
    for (let i = 0; i < 5; i++) {
      const y = 26 + i * 21, w = 70 - i * 11;
      ctx.lineWidth = 9 - i;
      ctx.beginPath();
      ctx.moveTo(cx - w, y - 10);
      ctx.lineTo(cx, y + 8);
      ctx.lineTo(cx + w, y - 10);
      ctx.stroke();
    }
    // "caveira" no topo do dorso
    ctx.beginPath();
    ctx.ellipse(cx, 14, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx + s * (95 + i * 6), 40 + i * 24, 7 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  marks(g, '#a3141a', null);
  marks(e, '#ff2a14', '#ff2a14');

  const map = new THREE.CanvasTexture(colorC);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emitC);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

// cerdas (cones finos) espalhadas numa esfera de raio r, só na parte de cima
function bristles(count, r, len, minY = -0.35) {
  const parts = [];
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    do {
      dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    } while (dir.lengthSq() > 1 || dir.lengthSq() < 0.01);
    dir.normalize();
    if (dir.y < minY) { i--; continue; }
    const l = len * (0.6 + Math.random() * 0.8);
    const c = new THREE.ConeGeometry(0.012, l, 3).translate(0, l / 2, 0);
    dir.x += (Math.random() - 0.5) * 0.5; // levemente penteado
    dir.z -= 0.35;
    dir.normalize();
    c.applyQuaternion(q.setFromUnitVectors(UP, dir));
    c.translate(dir.x * r * 0.97, dir.y * r * 0.97, dir.z * r * 0.97);
    c.deleteAttribute('uv');
    parts.push(c);
  }
  return mergeGeometries(parts);
}

// segmento de perna ao longo de +y (0..L), com pelos laterais
function legSegment(L, r0, r1, hairs) {
  const cyl = new THREE.CylinderGeometry(r1, r0, L, 7, 1).translate(0, L / 2, 0);
  cyl.deleteAttribute('uv');
  const parts = [cyl];
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  for (let i = 0; i < hairs; i++) {
    const t = (i + 0.5) / hairs;
    const a = Math.random() * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    const l = 0.05 + Math.random() * 0.05;
    const c = new THREE.ConeGeometry(0.007, l, 3).translate(0, l / 2, 0);
    dir.set(Math.cos(a), 0.55, Math.sin(a)).normalize(); // aponta para fora e para a ponta
    c.applyQuaternion(q.setFromUnitVectors(UP, dir));
    c.translate(Math.cos(a) * r, t * L, Math.sin(a) * r);
    c.deleteAttribute('uv');
    parts.push(c);
  }
  return mergeGeometries(parts);
}

export function createSpiderFactory() {
  // ---------- materiais ----------
  const { map, emissiveMap } = abdomenMaps();
  const fur = (o) => new THREE.MeshPhysicalMaterial({
    color: 0x1a1014, roughness: 0.55, sheen: 1, sheenColor: 0x7a4048, sheenRoughness: 0.45, ...o,
  });
  const bodyMat = fur({});
  const abdomenMat = fur({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0xffffff });
  const legMat = fur({ color: 0x150d10 });
  const jointMat = fur({ color: 0x5a0e10, emissive: 0x2a0000, emissiveIntensity: 1, sheenColor: 0xff5a40 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a262c, roughness: 0.9 });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a0000, emissive: 0xff1a00, emissiveIntensity: 2.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const fangMat = new THREE.MeshPhysicalMaterial({ color: 0x120607, roughness: 0.25, clearcoat: 1 });
  const fangTipMat = new THREE.MeshPhysicalMaterial({ color: 0x8a1a12, roughness: 0.2, clearcoat: 1, emissive: 0x300000 });
  const venomMat = new THREE.MeshPhysicalMaterial({
    color: 0x7aff3a, emissive: 0x3aa010, emissiveIntensity: 1.5, roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.9,
  });

  // ---------- geometrias compartilhadas ----------
  const FEMUR = 0.62, TIBIA = 0.72, TARSUS = 0.18;
  const femurGeo = legSegment(FEMUR, 0.055, 0.045, 14);
  const tibiaGeo = legSegment(TIBIA, 0.045, 0.028, 14);
  const tarsusGeo = legSegment(TARSUS, 0.028, 0.01, 4);
  const jointGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const ankleGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const thoraxGeo = new THREE.SphereGeometry(0.3, 24, 16);
  const headGeo = new THREE.SphereGeometry(0.19, 20, 14);
  const abdomenGeo = new THREE.SphereGeometry(0.5, 40, 28);
  const abdomenHair = bristles(260, 0.5, 0.09);
  const thoraxHair = bristles(90, 0.3, 0.06, -0.1);
  const pedicelGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8).rotateX(Math.PI / 2);
  const eyeGeo = new THREE.SphereGeometry(1, 14, 10);
  const cheliceraGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.2, 10).translate(0, -0.1, 0);
  const fangGeo = new THREE.ConeGeometry(0.028, 0.15, 8).rotateX(Math.PI).translate(0, -0.075, 0);
  const venomGeo = new THREE.SphereGeometry(0.022, 8, 6).scale(1, 1.4, 1);
  const palpGeo = legSegment(0.26, 0.03, 0.022, 5);
  const spinneretGeo = new THREE.ConeGeometry(0.05, 0.12, 8).rotateX(-Math.PI / 2);

  // ---------- pernas ----------
  // spread: ângulo para a frente (+) ou para trás (−); reach: distância do pé
  const LEGS = [
    { z: 0.36, spread: 0.95, reach: 1.12, scale: 1.08 },
    { z: 0.27, spread: 0.38, reach: 1.02, scale: 1.0 },
    { z: 0.17, spread: -0.25, reach: 1.0, scale: 0.96 },
    { z: 0.07, spread: -0.85, reach: 1.1, scale: 1.05 },
  ];
  const ATTACH_Y = 0.58;

  function makeLeg(parent, side, def, gaitGroup) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.2, ATTACH_Y, def.z);
    const dx = side * Math.cos(def.spread), dz = Math.sin(def.spread);
    const baseYaw = Math.atan2(-dz, dx);
    hip.rotation.y = baseYaw;
    hip.scale.setScalar(def.scale);
    const femur = new THREE.Mesh(femurGeo, legMat);
    const knee = new THREE.Mesh(jointGeo, jointMat);
    const tibia = new THREE.Mesh(tibiaGeo, legMat);
    const ankle = new THREE.Mesh(ankleGeo, jointMat);
    const tarsus = new THREE.Mesh(tarsusGeo, legMat);
    for (const m of [femur, tibia, tarsus]) m.castShadow = true;
    hip.add(femur, knee, tibia, ankle, tarsus);
    parent.add(hip);
    return { hip, femur, knee, tibia, ankle, tarsus, side, def, baseYaw, offset: gaitGroup ? Math.PI : 0 };
  }

  // IK de 2 ossos no plano da perna (x = para fora, y = cima), joelho para cima
  function solveLeg(leg, fx, fy) {
    // ponto do tornozelo: um pouco acima e para dentro do pé (anda na ponta)
    let ax = fx - 0.06, ay = fy + 0.16;
    let d = Math.hypot(ax, ay);
    const max = (FEMUR + TIBIA) * 0.999;
    if (d > max) { ax *= max / d; ay *= max / d; d = max; }
    const a = Math.atan2(ay, ax);
    const k = Math.min(1, Math.max(-1, (FEMUR * FEMUR + d * d - TIBIA * TIBIA) / (2 * FEMUR * d)));
    const kneeAng = a + Math.acos(k);
    const kx = Math.cos(kneeAng) * FEMUR, ky = Math.sin(kneeAng) * FEMUR;
    leg.femur.rotation.z = kneeAng - Math.PI / 2;
    leg.knee.position.set(kx, ky, 0);
    leg.tibia.position.set(kx, ky, 0);
    leg.tibia.rotation.z = Math.atan2(ay - ky, ax - kx) - Math.PI / 2;
    leg.ankle.position.set(ax, ay, 0);
    leg.tarsus.position.set(ax, ay, 0);
    leg.tarsus.rotation.z = Math.atan2(fy - ay, fx - ax) - Math.PI / 2;
  }

  function make() {
    const root = new THREE.Group();
    const body = new THREE.Group(); // balança com a marcha
    root.add(body);

    const thorax = new THREE.Mesh(thoraxGeo, bodyMat);
    thorax.scale.set(0.9, 0.55, 1.1);
    thorax.position.set(0, 0.62, 0.22);
    thorax.castShadow = true;
    thorax.add(new THREE.Mesh(thoraxHair, hairMat));
    body.add(thorax);

    const head = new THREE.Mesh(headGeo, bodyMat);
    head.scale.set(1, 0.8, 0.9);
    head.position.set(0, 0.68, 0.5);
    head.castShadow = true;
    body.add(head);

    const pedicel = new THREE.Mesh(pedicelGeo, bodyMat);
    pedicel.position.set(0, 0.66, -0.08);
    body.add(pedicel);

    // abdômen (grande, inclinado para cima) + cerdas + fiandeiras
    const abdomenPivot = new THREE.Group();
    abdomenPivot.position.set(0, 0.7, -0.12);
    abdomenPivot.rotation.x = -0.32;
    const abdomen = new THREE.Mesh(abdomenGeo, abdomenMat);
    abdomen.scale.set(0.95, 0.8, 1.18);
    abdomen.position.set(0, 0.06, -0.5);
    abdomen.castShadow = true;
    abdomen.add(new THREE.Mesh(abdomenHair, hairMat));
    const spinneret = new THREE.Mesh(spinneretGeo, bodyMat);
    spinneret.position.set(0, -0.1, -0.5);
    abdomen.add(spinneret);
    abdomenPivot.add(abdomen);
    body.add(abdomenPivot);

    // 8 olhos: par principal grande, demais menores
    const EYES = [
      [0.065, 0.74, 0.66, 0.05], [0.14, 0.77, 0.6, 0.036], [0.055, 0.82, 0.6, 0.03],
      [0.17, 0.71, 0.55, 0.028],
    ];
    for (const [x, y, z, r] of EYES) {
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.scale.setScalar(r);
        eye.position.set(s * x, y, z);
        body.add(eye);
      }
    }

    // quelíceras + presas + gota de veneno
    const fangs = [];
    for (const s of [-1, 1]) {
      const base = new THREE.Group();
      base.position.set(s * 0.065, 0.62, 0.62);
      base.rotation.x = 0.35;
      const ch = new THREE.Mesh(cheliceraGeo, fangMat);
      const fangPivot = new THREE.Group();
      fangPivot.position.y = -0.19;
      const fang = new THREE.Mesh(fangGeo, fangTipMat);
      fangPivot.rotation.z = -s * 0.5;
      fangPivot.add(fang);
      base.add(ch, fangPivot);
      body.add(base);
      fangs.push({ base, fangPivot, s });
    }
    const venom = new THREE.Mesh(venomGeo, venomMat);
    venom.position.set(0.04, 0.32, 0.72);
    body.add(venom);

    // pedipalpos (pernas curtas da frente)
    const palps = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(palpGeo, legMat);
      p.position.set(s * 0.1, 0.62, 0.62);
      p.rotation.set(0.9, 0, -s * 0.5);
      body.add(p);
      palps.push(p);
    }

    // pernas: tetrápode alternado (E1, D2, E3, D4) x (D1, E2, D3, E4)
    const legs = [];
    LEGS.forEach((def, i) => {
      legs.push(makeLeg(body, -1, def, i % 2 === 1));
      legs.push(makeLeg(body, 1, def, i % 2 === 0));
    });

    const st = { phase: Math.random() * 10, t: Math.random() * 10, curl: 0, venom: 0 };

    function animate(dt, speed, curlTarget = 0) {
      st.curl += (curlTarget - st.curl) * Math.min(1, dt * 7);
      st.t += dt;
      const moving = Math.min(1, speed / 1.5);
      st.phase += dt * (2 + speed * 4.2);
      const curl = st.curl;

      // corpo: balanço da marcha + tremidinha nervosa
      const bob = Math.sin(st.phase * 2) * 0.03 * moving;
      body.position.y = bob - curl * 0.25;
      body.rotation.z = Math.sin(st.phase) * 0.04 * moving;
      body.rotation.x = Math.sin(st.t * 1.3) * 0.03;
      const breath = 1 + Math.sin(st.t * 3.1) * 0.035;
      abdomen.scale.set(0.95 * breath, 0.8 * breath, 1.18);
      abdomenPivot.rotation.y = Math.sin(st.phase) * 0.06 * moving;
      abdomenPivot.rotation.x = -0.32 + Math.sin(st.t * 1.7) * 0.04;

      for (const f of fangs) {
        f.fangPivot.rotation.z = -f.s * (0.45 + Math.max(0, Math.sin(st.t * 7)) * 0.4);
        f.base.rotation.x = 0.35 + Math.sin(st.t * 5 + f.s) * 0.06;
      }
      for (const p of palps) p.rotation.x = 0.9 + Math.sin(st.t * 6 + p.position.x * 30) * 0.15;

      // gota de veneno cresce, cai e recomeça
      st.venom = (st.venom + dt * 0.6) % 1;
      const vs = Math.min(1, st.venom * 2.5);
      venom.scale.setScalar(vs);
      venom.position.y = 0.36 - Math.max(0, st.venom - 0.6) * 0.8;
      venom.visible = curl < 0.5;

      // pernas
      for (const leg of legs) {
        const p = st.phase + leg.offset;
        const swing = 0.12 + 0.88 * moving;
        const lift = Math.max(0, Math.cos(p)) * 0.2 * swing;
        leg.hip.rotation.y = leg.baseYaw - leg.side * Math.sin(p) * 0.26 * swing;
        const H = (ATTACH_Y + body.position.y) / leg.def.scale;
        const fx = THREE.MathUtils.lerp(leg.def.reach, 0.32, curl);
        const fy = THREE.MathUtils.lerp(-H + lift, -0.02, curl);
        solveLeg(leg, fx, fy);
      }
    }

    animate(0, 0);
    root.userData.animate = animate;
    return root;
  }

  return { make };
}
