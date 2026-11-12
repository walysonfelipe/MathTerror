import * as THREE from 'three';

/**
 * Mão afogada: antebraço magro esculpido, palma com volume (eminência do polegar,
 * concha no centro, nós dos dedos), quatro dedos com três falanges articuladas,
 * polegar opositor, unhas rachadas, pele pálida de afogado (manchas roxas,
 * veias, rugas nas juntas) brilhando de molhada e algas presas no pulso.
 *
 * A palma fica virada para +z; dobrar uma junta (rotation.x > 0) leva a ponta
 * do dedo para a frente da palma.
 */

const rnd = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// ---------- textura da pele ----------
function skinTextures() {
  const W = 256, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const b = document.createElement('canvas');
  b.width = W; b.height = H;
  const bg = b.getContext('2d');

  // base pálida, cinza-esverdeada
  g.fillStyle = '#b4b8a6';
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, W, H);

  // manchas (livor, hematomas, verde de decomposição)
  const blot = (ctx, x, y, r, col) => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    for (const dx of [-W, 0, W]) { ctx.save(); ctx.translate(dx, 0); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }
  };
  for (let i = 0; i < 70; i++) {
    const pick = rnd();
    const col = pick < 0.35 ? 'rgba(92,70,96,0.35)' : pick < 0.7 ? 'rgba(70,96,64,0.32)' : 'rgba(210,214,196,0.3)';
    blot(g, rnd() * W, rnd() * H, 10 + rnd() * 40, col);
  }
  // feridas escuras e pele soltando
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W, y = rnd() * H, r = 4 + rnd() * 9;
    blot(g, x, y, r * 1.8, 'rgba(60,30,30,0.45)');
    blot(g, x, y, r, 'rgba(25,12,10,0.8)');
    blot(bg, x, y, r, 'rgba(10,10,10,0.9)');
  }

  // veias azuladas, ramificadas, correndo ao longo do braço
  const vein = (x, y, len, w) => {
    let a = Math.PI / 2 + (rnd() - 0.5) * 0.4;
    g.lineCap = bg.lineCap = 'round';
    for (let s = 0; s < len; s++) {
      const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 6;
      g.strokeStyle = 'rgba(58,66,110,0.55)';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      bg.strokeStyle = 'rgba(190,190,190,0.7)';
      bg.lineWidth = w + 1;
      bg.beginPath(); bg.moveTo(x, y); bg.lineTo(nx, ny); bg.stroke();
      x = nx; y = ny;
      a += (rnd() - 0.5) * 0.5;
      if (rnd() < 0.06 && w > 1) vein(x, y, len * 0.4, w * 0.6);
    }
  };
  for (let i = 0; i < 9; i++) vein(rnd() * W, rnd() * H * 0.4, 40 + rnd() * 40, 1.5 + rnd() * 1.6);

  // rugas finas (pele encharcada enruga) e poros
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W, y = rnd() * H, l = 3 + rnd() * 10;
    g.strokeStyle = `rgba(60,60,50,${0.08 + rnd() * 0.12})`;
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 3, x + l, y); g.stroke();
    bg.strokeStyle = 'rgba(40,40,40,0.5)';
    bg.lineWidth = 1;
    bg.beginPath(); bg.moveTo(x, y); bg.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 3, x + l, y); bg.stroke();
  }
  for (let i = 0; i < 2500; i++) {
    const x = rnd() * W, y = rnd() * H;
    g.fillStyle = `rgba(${rnd() < 0.5 ? '40,44,36' : '230,232,220'},${0.1 + rnd() * 0.15})`;
    g.fillRect(x, y, 1.3, 1.3);
    bg.fillStyle = `rgba(${rnd() < 0.5 ? '30,30,30' : '200,200,200'},0.5)`;
    bg.fillRect(x, y, 1.5, 1.5);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

// ---------- geometrias ----------
// antebraço: perfil girado, achatado, com o osso do pulso e músculos murchos
function forearmGeo(len) {
  const prof = [
    [0.13, -0.2], [0.15, 0], [0.165, 0.25], [0.165, 0.5], [0.15, 0.8],
    [0.125, 1.1], [0.1, 1.35], [0.088, len - 0.08], [0.094, len], [0.07, len + 0.04],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 22);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = Math.min(1, Math.max(0, y / len));
    // seção oval (mais larga que funda) e cada vez mais chata perto do pulso
    z *= 0.78 - k * 0.12;
    x *= 1.0;
    // tendões e o osso da ulna marcando a pele magra
    const ridge = Math.pow(Math.max(0, Math.cos(a - 2.6)), 8) * 0.016 * k;
    const tend = Math.max(0, Math.cos(a * 5)) * 0.006 * k * k;
    const lump = Math.sin(y * 9 + a * 3) * 0.004;
    const r = Math.hypot(x, z) || 1;
    const s = 1 + (ridge + tend + lump) / r;
    p.setXYZ(i, x * s, y, z * s);
  }
  geo.computeVertexNormals();
  return geo;
}

// palma: superelipsoide afunilada (estreita no pulso, larga nos nós)
function palmGeo() {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const p = geo.attributes.position;
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    let x = sp(p.getX(i), 0.55), y = sp(p.getY(i), 0.6), z = sp(p.getZ(i), 0.8);
    const k = (y + 1) / 2; // 0 no pulso, 1 nos nós
    const halfW = 0.125 + k * 0.055;
    const halfD = 0.07 - k * 0.018;
    let X = x * halfW, Y = k * 0.4, Z = z * halfD;
    // eminência do polegar (base do lado -x, frente da palma)
    if (Z > 0) {
      const th = Math.exp(-(((X + 0.08) / 0.07) ** 2 + ((Y - 0.1) / 0.11) ** 2));
      const hy = Math.exp(-(((X - 0.07) / 0.06) ** 2 + ((Y - 0.12) / 0.12) ** 2)); // lado do mínimo
      const cup = Math.exp(-((X / 0.08) ** 2 + ((Y - 0.22) / 0.1) ** 2));
      Z += th * 0.035 + hy * 0.015 - cup * 0.025;
    } else {
      // dorso: ossos dos metacarpos aparecendo
      Z -= Math.max(0, Math.cos(X * 44)) * 0.006 * k;
    }
    p.setXYZ(i, X, Y, Z);
  }
  geo.computeVertexNormals();
  return geo;
}

// falange: cápsula afunilada e levemente achatada, base em y = 0
function phalanxGeo(len, r, taper) {
  const geo = new THREE.CapsuleGeometry(r, len, 5, 10).translate(0, len / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = Math.min(1, Math.max(0, y / len));
    // junta mais grossa na base (nó do dedo ossudo)
    const s = (1 - k * (1 - taper)) * (1 + Math.exp(-((y / (r * 1.4)) ** 2)) * 0.12);
    p.setXYZ(i, p.getX(i) * s, y, p.getZ(i) * s * 0.86);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createDrownedHandFactory() {
  const { map, bump } = skinTextures();
  const skin = new THREE.MeshStandardMaterial({
    color: 0xc4cab8, map, bumpMap: bump, bumpScale: 1.2,
    roughness: 0.38, metalness: 0.05, // molhada: brilho úmido
    emissive: 0x0a140e, emissiveIntensity: 0.6,
  });
  const nailMat = new THREE.MeshStandardMaterial({ color: 0x5a5440, roughness: 0.25, metalness: 0.1 });
  const algaeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1c, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });

  const ARM = 1.55;
  const armGeo = forearmGeo(ARM);
  const palm = palmGeo();
  const knuckleGeo = new THREE.SphereGeometry(1, 10, 8);
  const nailGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2);

  // indicador, médio, anelar, mínimo (dedos compridos e finos de cadáver)
  const FINGERS = [
    { x: -0.118, y: 0.395, L: 0.2, r: 0.032, splay: 0.12 },
    { x: -0.04, y: 0.41, L: 0.225, r: 0.033, splay: 0.02 },
    { x: 0.04, y: 0.4, L: 0.208, r: 0.031, splay: -0.07 },
    { x: 0.112, y: 0.37, L: 0.16, r: 0.026, splay: -0.17 },
  ].map((f) => ({
    ...f,
    geos: [
      phalanxGeo(f.L, f.r, 0.88),
      phalanxGeo(f.L * 0.64, f.r * 0.88, 0.88),
      phalanxGeo(f.L * 0.48, f.r * 0.78, 0.72),
    ],
  }));
  const thumbGeos = [phalanxGeo(0.15, 0.04, 0.85), phalanxGeo(0.12, 0.036, 0.85), phalanxGeo(0.1, 0.032, 0.72)];
  const strandGeo = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0, -0.5, 0);

  // monta um dedo articulado; devolve as juntas
  function buildDigit(parent, geos, r) {
    const joints = [];
    let at = parent;
    geos.forEach((geo, j) => {
      const jt = new THREE.Group();
      if (j > 0) jt.position.y = geos[j - 1].userData.len;
      at.add(jt);
      jt.add(new THREE.Mesh(geo, skin));
      joints.push(jt);
      at = jt;
    });
    // unha rachada no dorso da última falange
    const last = geos[geos.length - 1].userData;
    const nail = new THREE.Mesh(nailGeo, nailMat);
    nail.scale.set(r * 0.62, last.len * 0.55, r * 0.28);
    nail.position.set(0, last.len * 0.62, -r * 0.62);
    nail.rotation.x = 0.12;
    joints[joints.length - 1].add(nail);
    return joints;
  }
  // guarda o comprimento de cada falange para encadear as juntas
  FINGERS.forEach((f) => f.geos.forEach((g, j) => (g.userData.len = [f.L, f.L * 0.64, f.L * 0.48][j])));
  [0.15, 0.12, 0.1].forEach((l, j) => (thumbGeos[j].userData.len = l));

  return function makeHand() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);

    const arm = new THREE.Mesh(armGeo, skin);
    inner.add(arm);

    // pulso: articulação que dobra a mão
    const wrist = new THREE.Group();
    wrist.position.y = ARM;
    inner.add(wrist);
    wrist.add(new THREE.Mesh(palm, skin));

    // nós dos dedos saltados no dorso
    const fingers = FINGERS.map((f) => {
      const k = new THREE.Mesh(knuckleGeo, skin);
      k.scale.set(f.r * 1.15, f.r * 0.9, f.r * 0.8);
      k.position.set(f.x, f.y - 0.01, -0.03);
      wrist.add(k);
      const base = new THREE.Group();
      base.position.set(f.x, f.y, 0.0);
      wrist.add(base);
      const joints = buildDigit(base, f.geos, f.r);
      return { base, joints, splay: f.splay, ph: rnd() * 6 };
    });

    // polegar: sai da base da palma, girado para se opor aos dedos
    const tBase = new THREE.Group();
    tBase.position.set(-0.11, 0.09, 0.025);
    tBase.rotation.set(0.35, -0.75, 0.85);
    wrist.add(tBase);
    const thumb = buildDigit(tBase, thumbGeos, 0.036);

    // algas e trapos de lodo presos no pulso, balançando
    const strands = [];
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group();
      const a = (i / 4) * Math.PI * 2 + rnd();
      piv.position.set(Math.cos(a) * 0.1, ARM - 0.12 - rnd() * 0.15, Math.sin(a) * 0.08);
      piv.rotation.y = -a;
      const m = new THREE.Mesh(strandGeo, algaeMat);
      m.scale.set(0.03 + rnd() * 0.035, 0.35 + rnd() * 0.45, 1);
      m.position.x = 0.012;
      piv.add(m);
      inner.add(piv);
      strands.push({ piv, ph: rnd() * 6 });
    }

    inner.traverse((o) => { if (o.isMesh && o.material !== algaeMat) o.castShadow = true; });
    // vista 3/4: palma virada para a câmera e para quem vem pela esquerda
    inner.rotation.y = -0.55;

    // rise: 0 = submersa, 1 = toda para fora
    function update(t, rise) {
      const open = Math.min(1, Math.max(0, rise));
      // agarrar: aperta em espasmos quando está no alto
      const grab = Math.pow(Math.max(0, Math.sin(t * 2.4)), 3) * open;
      wrist.rotation.x = 0.25 - open * 0.45 + grab * 0.35 + Math.sin(t * 1.7) * 0.06;
      wrist.rotation.z = Math.sin(t * 1.3) * 0.08;
      fingers.forEach((f, i) => {
        const trem = Math.sin(t * 13 + f.ph) * 0.05 * open;
        const curl = (1 - open) * 1.15 + 0.18 + grab * 1.1 + Math.sin(t * 2 + i * 0.7) * 0.08;
        f.base.rotation.z = f.splay * (0.4 + open * 1.1) * (1 - grab * 0.6);
        f.joints[0].rotation.x = curl * 0.8 + trem;
        f.joints[1].rotation.x = curl * 1.0 + trem;
        f.joints[2].rotation.x = curl * 0.7 - open * 0.25 * (1 - grab); // ponta torta para trás quando abre
      });
      const tc = (1 - open) * 0.7 + 0.15 + grab * 0.6;
      thumb[0].rotation.x = tc * 0.4;
      thumb[1].rotation.x = tc * 0.8 + Math.sin(t * 11) * 0.04 * open;
      thumb[2].rotation.x = tc * 0.9;
      strands.forEach((s) => {
        s.piv.rotation.x = Math.sin(t * 1.9 + s.ph) * 0.25;
        s.piv.rotation.z = Math.sin(t * 1.4 + s.ph * 2) * 0.2;
      });
    }
    update(0, 0);

    g.userData = { inner, update };
    return g;
  };
}
