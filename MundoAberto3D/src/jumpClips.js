import * as THREE from 'three';

/**
 * Animações de pulo geradas por código (o GLB só tem um "jump" genérico):
 *   jump_normal — pulo comum: braços sobem, joelhos encolhem, prepara a aterrissagem
 *   jump_long   — pulo longo: corpo lançado para frente, braços esticados à frente,
 *                 pernas para trás e depois esticadas à frente para aterrissar
 *
 * As poses são descritas em ângulos no espaço do modelo (frente = +Z, esquerda = +X):
 *   braço/coxa/canela: { a, out } — a = 0 para baixo, 90 para frente, 180 para cima, -90 para trás;
 *                                  out = abre para o lado
 *   pé: graus de flexão (+ aponta os dedos para baixo, − levanta os dedos)
 *   hips/spine/head: inclinação (+ joga para frente)
 * O tempo de cada clipe vai de 0 (decolagem) a 1 (pronto para aterrissar). Quem toca
 * o clipe pode "arrastar" o tempo pela velocidade vertical (ver phaseFromVy).
 */

const D = THREE.MathUtils.DEG2RAD;

// chave: t, hips, spine, head, arm L/R [a, out, foreA], leg L/R [thigh, shin, foot]
const NORMAL = [
  { t: 0.00, hips: 8, spine: 6, head: -6, arm: { L: [60, 15, 100], R: [55, 15, 95] }, leg: { L: [-15, -25, 45], R: [-20, -30, 50] } },
  { t: 0.30, hips: 4, spine: 3, head: -3, arm: { L: [150, 25, 170], R: [145, 25, 165] }, leg: { L: [75, -10, 25], R: [65, -15, 30] } },
  { t: 0.55, hips: 0, spine: 0, head: 0, arm: { L: [120, 50, 140], R: [115, 50, 135] }, leg: { L: [60, 0, 15], R: [55, -5, 15] } },
  { t: 0.80, hips: 3, spine: 2, head: -2, arm: { L: [70, 75, 90], R: [70, 75, 90] }, leg: { L: [32, 5, 0], R: [28, 0, 0] } },
  { t: 1.00, hips: 8, spine: 5, head: -4, arm: { L: [45, 55, 70], R: [45, 55, 70] }, leg: { L: [25, -5, -15], R: [25, -5, -15] } },
];

const LONG = [
  // decolagem: corpo jogado para frente, joelho esquerdo puxa, perna direita empurra atrás,
  // braço direito sobe à frente (oposto da perna) e o esquerdo vai para trás
  { t: 0.00, hips: 28, spine: 8, head: -22, arm: { L: [-70, 10, -45], R: [120, 10, 150] }, leg: { L: [85, 5, 30], R: [-40, -60, 60] } },
  // voo "super-herói": braços esticados à frente, pernas dobradas para trás, pés em ponta
  { t: 0.22, hips: 35, spine: 10, head: -28, arm: { L: [165, 15, 175], R: [165, 15, 175] }, leg: { L: [-20, -75, 55], R: [-30, -80, 60] } },
  // planando: peito arqueado, braços abertos como asas
  { t: 0.50, hips: 18, spine: -4, head: -15, arm: { L: [150, 70, 155], R: [150, 70, 155] }, leg: { L: [10, -60, 45], R: [0, -70, 45] } },
  // canivete: pernas esticadas à frente, dedos para cima, braços varrem para baixo
  { t: 0.78, hips: 8, spine: 12, head: -8, arm: { L: [60, 25, 75], R: [60, 25, 75] }, leg: { L: [95, 85, 40], R: [95, 85, 40] } },
  // pronto para aterrissar
  { t: 1.00, hips: 18, spine: 10, head: -10, arm: { L: [40, 20, 60], R: [40, 20, 60] }, leg: { L: [80, 55, 30], R: [80, 55, 30] } },
];

// achata a chave num vetor de números para interpolar
const flat = (k) => [
  k.hips, k.spine, k.head,
  ...k.arm.L, ...k.arm.R, ...k.leg.L, ...k.leg.R,
];

// Catmull-Rom uniforme entre as chaves (movimento contínuo, sem trancos)
function sample(keys, t) {
  const fk = keys.map(flat);
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const t0 = keys[i].t, t1 = keys[i + 1].t;
  const u = THREE.MathUtils.clamp((t - t0) / (t1 - t0 || 1), 0, 1);
  const p0 = fk[Math.max(0, i - 1)], p1 = fk[i], p2 = fk[i + 1], p3 = fk[Math.min(fk.length - 1, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  const v = p1.map((_, j) => 0.5 * (
    2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3
  ));
  let n = 0;
  const take = (c) => v.slice(n, (n += c));
  const [hips, spine, head] = take(3);
  return { hips, spine, head, arm: { L: take(3), R: take(3) }, leg: { L: take(3), R: take(3) } };
}

export function buildJumpClips(model, clips, bone) {
  const idle = clips.find((c) => c.name === 'idle');
  const B = (n) => bone(n) ?? model.getObjectByName(`mixamorig${n}`);
  const hips = B('Hip');
  const spines = ['Spine', 'Spine1', 'Spine2'].map(B).filter(Boolean);
  const neck = B('Neck'), head = B('Head');
  const side = (s) => ({
    s,
    sign: s === 'L' ? 1 : -1, // esquerda do personagem = +X
    arm: B(`${s}_Upperarm`), fore: B(`${s}_Forearm`), hand: B(`${s}_Hand`),
    thigh: B(`${s}_Thigh`), calf: B(`${s}_Calf`), foot: B(`${s}_Foot`), toe: B(`${s}_ToeBase`),
  });
  const sides = [side('L'), side('R')];
  if (!idle || !hips || sides.some((x) => !x.arm || !x.fore || !x.hand || !x.thigh || !x.calf || !x.foot)) {
    console.warn('[jumpClips] esqueleto incompatível, pulos procedurais desativados');
    return [];
  }

  // pose base = primeiro quadro do idle
  const tmp = new THREE.AnimationMixer(model);
  tmp.clipAction(idle).play();
  tmp.setTime(0);
  model.updateMatrixWorld(true);
  const bones = [];
  model.traverse((o) => { if (o.isBone) bones.push(o); }); // pais antes dos filhos
  const baseQ = bones.map((b) => b.quaternion.clone());
  const baseP = hips.position.clone();
  tmp.stopAllAction();
  tmp.uncacheRoot(model);

  const restore = () => {
    bones.forEach((b, i) => b.quaternion.copy(baseQ[i]));
    hips.position.copy(baseP);
    model.updateMatrixWorld(true);
  };

  const qW = new THREE.Quaternion(), qP = new THREE.Quaternion(), qD = new THREE.Quaternion();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);

  // aplica uma rotação (no espaço do modelo) ao osso, mantendo a hierarquia
  function rotateWorld(b, q) {
    b.getWorldQuaternion(qW);
    qW.premultiply(q);
    b.parent.getWorldQuaternion(qP);
    b.quaternion.copy(qP.invert().multiply(qW));
    b.updateMatrixWorld(true);
  }
  const pitch = (b, deg) => b && deg && rotateWorld(b, qD.setFromAxisAngle(X, deg * D));

  // aponta o segmento bone→child na direção (a, out)
  function aim(b, child, aDeg, outDeg, sign) {
    const a = aDeg * D, o = outDeg * D;
    const target = new THREE.Vector3(sign * Math.sin(o), -Math.cos(a) * Math.cos(o), Math.sin(a) * Math.cos(o)).normalize();
    b.getWorldPosition(va);
    child.getWorldPosition(vb);
    const cur = vb.sub(va).normalize();
    rotateWorld(b, qD.setFromUnitVectors(cur, target));
  }

  function pose(p) {
    restore();
    pitch(hips, p.hips);
    for (const s of spines) pitch(s, p.spine / spines.length);
    pitch(neck, p.head * 0.4);
    pitch(head, p.head * 0.6);
    for (const S of sides) {
      const [ua, uo, fa] = p.arm[S.s];
      aim(S.arm, S.fore, ua, uo, S.sign);
      aim(S.fore, S.hand, fa, uo * 0.6, S.sign);
      const [th, sh, ft] = p.leg[S.s];
      aim(S.thigh, S.calf, th, 6, S.sign);
      aim(S.calf, S.foot, sh, 4, S.sign);
      pitch(S.foot, ft);
    }
  }

  function makeClip(name, keys, duration, fps = 30) {
    const n = Math.round(duration * fps) + 1;
    const times = new Float32Array(n);
    const qv = bones.map(() => new Float32Array(n * 4));
    for (let f = 0; f < n; f++) {
      const t = f / (n - 1);
      times[f] = t * duration;
      pose(sample(keys, t));
      bones.forEach((b, i) => b.quaternion.toArray(qv[i], f * 4));
    }
    const tracks = bones.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, qv[i]));
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, [0], baseP.toArray()));
    return new THREE.AnimationClip(name, duration, tracks);
  }

  const out = [makeClip('jump_normal', NORMAL, 1.0), makeClip('jump_long', LONG, 1.0)];
  restore();
  return out;
}

/**
 * Fase do pulo (0..1) pela velocidade vertical: decolagem (vy = v0) → topo (0) → descida (−v0).
 * Assim a animação acompanha pulos curtos (botão solto cedo) e longos sem dessincronizar.
 */
export function phaseFromVy(vy, v0) {
  return THREE.MathUtils.clamp((v0 - vy) / (2 * v0), 0, 0.999);
}
