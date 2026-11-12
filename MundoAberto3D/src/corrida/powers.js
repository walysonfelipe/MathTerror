import * as THREE from 'three';
import { createFireMaterial, createTrail, makeRuneTexture, makeStarTexture, makeScorchTexture } from './fireball.js';

/**
 * Poder: "Chama Rúnica" — bola de fogo conjurada na mão do personagem.
 *
 * 1. CARGA     — círculo rúnico (símbolos matemáticos) surge na mão, energia é sugada
 *                para dentro, uma bola de fogo cresce na palma e a mão brilha
 * 2. ARREMESSO — braço sobe para trás e vem para frente mirando a criatura;
 *                o círculo rúnico se expande e gira, onda de choque, recuo do corpo
 * 3. VOO       — bola de fogo em shader (ruído animado + chamas esticadas para trás),
 *                núcleo branco, halo, anel rúnico girando, rastro em fita, faíscas,
 *                fumaça e luz própria; persegue o alvo suavemente
 * 4. IMPACTO   — congela o tempo por um instante (hit-stop), clarão, estrela de raios,
 *                ondas de choque, faíscas, bola de fogo, fumaça, destroços em brasa,
 *                fogo no chão + marca de queimado, tremor de câmera e tela aquecida
 */

const MAX_CHARGES = 3;
const RECHARGE = 0.95;   // s por carga
const COOLDOWN = 0.25;   // s entre lançamentos
const SPEED = 18;
const LIFETIME = 1.2;
const RADIUS = 0.3;
const WIND_UP = 0.13;    // carga: braço vai para trás/cima
const SWING = 0.07;      // braço vem para frente
const CAST_DELAY = WIND_UP + SWING;
const CAST_TIME = 0.5;
const AIM_RANGE = 16;
const HOMING = 7;
const Z = 0.35;
const FLY_H = 0.75;

const FIRE = [1, 0.92, 0.6];
const FIRE_END = [0.75, 0.08, 0.02];
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

export function createPowers({ scene, world, particles, sfx, character, tex }) {
  const fx = particles;

  // ---------- recursos compartilhados ----------
  const ballGeo = new THREE.IcosahedronGeometry(1, 4);
  const coreGeo = new THREE.SphereGeometry(1, 16, 12);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const runeTex = makeRuneTexture();
  const starTex = makeStarTexture();
  const scorchTex = makeScorchTexture();
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const ringGeo = new THREE.RingGeometry(0.82, 1, 64);
  const debrisGeo = new THREE.IcosahedronGeometry(0.075, 0);
  const debrisMat = new THREE.MeshStandardMaterial({
    color: 0x1a1210, roughness: 0.9, emissive: 0xff4a10, emissiveIntensity: 0.9, flatShading: true,
  });
  const additive = (map, color, opacity = 1) => new THREE.MeshBasicMaterial({
    map, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  });
  const haloMat = new THREE.SpriteMaterial({
    map: tex.puff, color: 0xff5a14, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });

  // luzes em pool (sempre na cena: criar/remover luzes recompila shaders)
  const lights = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xff7a2a, 0, 10, 1.6);
    scene.add(l);
    return { light: l, busy: false };
  });
  const flash = new THREE.PointLight(0xffa050, 0, 18, 1.4);
  const handLight = new THREE.PointLight(0xff8a3a, 0, 6, 1.6);
  scene.add(flash, handLight);
  let flashI = 0;

  // ---------- estado ----------
  let charges = MAX_CHARGES;
  let recharge = 0;
  let cooldown = 0;
  let castT = 0;
  let castW = 0;
  let pending = -1;
  let aimTarget = null;
  let emberT = 0;
  let shake = 0;
  let hitStop = 0;
  let heat = 0;          // tela aquecida (0..1)
  let fireQueued = false;
  let lastP = null;
  const shots = [];      // projéteis
  const fxs = [];        // efeitos com update(dt) => true quando terminam
  const aimDir = new THREE.Vector3(), windDir = new THREE.Vector3(), shoulder = new THREE.Vector3();
  const handW = new THREE.Vector3();

  // ---------- braço (IK por cima da animação) ----------
  const model = character.model;
  const bone = character.bone ?? ((n) => model.getObjectByName(n));
  const arms = {
    L: ['L_Upperarm', 'L_Forearm', 'L_Hand'].map(bone),
    R: ['R_Upperarm', 'R_Forearm', 'R_Hand'].map(bone),
  };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3();
  const qd = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), qi = new THREE.Quaternion();

  function aimBone(bone, child, target, w) {
    bone.getWorldPosition(va);
    child.getWorldPosition(vb);
    const cur = vb.sub(va).normalize();
    qd.setFromUnitVectors(cur, target);
    qd.slerpQuaternions(qi, qd, w);
    bone.getWorldQuaternion(qw);
    qw.premultiply(qd);
    bone.parent.getWorldQuaternion(qp);
    bone.quaternion.copy(qp.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }

  // usa o braço do lado da câmera (+z), para a bola de fogo não ficar escondida atrás do corpo
  const _ha = new THREE.Vector3(), _hb = new THREE.Vector3();
  const armFor = (facing) => {
    if (!arms.L[2] || !arms.R[2]) return facing > 0 ? arms.L : arms.R;
    return arms.L[2].getWorldPosition(_ha).z >= arms.R[2].getWorldPosition(_hb).z ? arms.L : arms.R;
  };
  function handPos(facing, out) {
    const arm = armFor(facing);
    if (!arm[2]) return out.set(lastP ? lastP.x : 0, lastP ? lastP.y + 1.3 : 1.3, Z);
    return arm[2].getWorldPosition(out);
  }

  const targetY = (e) => (e.kind === 'ghost' ? e.y + 1.0 : e.y + 0.55);

  function findTarget(P) {
    let best = null, bestD = Infinity;
    const hx = P.x, hy = P.y + 1.3;
    for (const e of world.enemies()) {
      if (e.state !== 'walk' || !e.active) continue;
      const dx = (e.x - hx) * P.facing;
      if (dx < 0.3 || dx > AIM_RANGE) continue;
      const dy = targetY(e) - hy;
      if (Math.abs(Math.atan2(dy, dx)) > 1.25) continue;
      const d = Math.hypot(dx, dy * 1.3);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function computeAim(P) {
    if (aimTarget && aimTarget.state === 'walk') {
      aimDir.set(aimTarget.x - shoulder.x, targetY(aimTarget) - shoulder.y, 0);
      if (aimDir.x * P.facing < 0.2) aimDir.x = 0.2 * P.facing;
      aimDir.normalize();
    } else {
      aimDir.set(P.facing, 0.1, 0).normalize();
    }
    return aimDir;
  }

  // chamado depois do mixer.update()
  function poseArm(dt, P) {
    lastP = P;
    const target = castT > 0 ? 1 : 0;
    castW += (target - castW) * Math.min(1, dt * (target ? 30 : 7));
    if (castW < 0.01 || P.dead) return;
    const [upper, fore, hand] = armFor(P.facing);
    if (!upper || !fore || !hand) return;
    character.root.updateMatrixWorld(true);
    upper.getWorldPosition(shoulder);
    computeAim(P);
    const aim = va.copy(aimDir);
    aim.z = 0.2;
    aim.normalize();

    windDir.set(-P.facing * 0.5, 1, 0.2).normalize();
    const el = CAST_TIME - castT;
    if (castT <= 0) dir.copy(aim);
    else if (el < WIND_UP) dir.copy(windDir);
    else if (el < WIND_UP + SWING) {
      const k = (el - WIND_UP) / SWING;
      dir.copy(windDir).lerp(aim, k * k * (3 - 2 * k)).normalize();
    } else dir.copy(aim);

    const d = dir.clone();
    aimBone(upper, fore, d, castW);
    aimBone(fore, hand, d, castW);
  }

  // ---------- peças de efeito ----------
  function addFx(update) { fxs.push({ update, t: 0 }); }

  function ring(x, y, z, size, color, dur = 0.35, normal = null) {
    const mat = additive(null, color);
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.set(x, y, z);
    if (normal) m.lookAt(x + normal.x, y + normal.y, z + normal.z);
    m.renderOrder = 11;
    scene.add(m);
    addFx((f, dt) => {
      const k = Math.min(1, f.t / dur);
      m.scale.setScalar(0.15 + easeOut(k) * size);
      mat.opacity = (1 - k) * (1 - k);
      if (k >= 1) { scene.remove(m); mat.dispose(); return true; }
      return false;
    });
  }

  function starBurst(x, y, size) {
    const mat = additive(starTex, 0xffc070);
    const m = new THREE.Mesh(planeGeo, mat);
    m.position.set(x, y, Z + 0.2);
    m.renderOrder = 13;
    m.rotation.z = Math.random() * 6;
    scene.add(m);
    addFx((f) => {
      const k = Math.min(1, f.t / 0.28);
      m.scale.setScalar(size * (0.4 + easeOut(k) * 0.9));
      m.rotation.z += 0.02;
      mat.opacity = 1 - k;
      if (k >= 1) { scene.remove(m); mat.dispose(); return true; }
      return false;
    });
  }

  // círculo rúnico: aparece na carga, segue a mão, expande no arremesso e some
  function runeCircle(P) {
    const outer = new THREE.Mesh(planeGeo, additive(runeTex, 0xffa040));
    const inner = new THREE.Mesh(planeGeo, additive(runeTex, 0xffe0a0));
    outer.renderOrder = inner.renderOrder = 12;
    scene.add(outer, inner);
    let released = false;
    const fixed = new THREE.Vector3(), normal = new THREE.Vector3();
    let spin = 0;
    const rc = {
      release() { released = true; rc.rt = 0; fixed.copy(handW).addScaledVector(aimDir, 0.35); normal.copy(aimDir).setZ(0.6).normalize(); },
    };
    addFx((f, dt) => {
      spin += dt * (released ? 5 : 9);
      let scale, op;
      if (!released) {
        const k = Math.min(1, f.t / WIND_UP);
        handPos(P.facing, handW);
        computeAim(P);
        outer.position.copy(handW).addScaledVector(aimDir, 0.3);
        normal.copy(aimDir).setZ(0.6).normalize();
        scale = 0.25 + easeOut(k) * 0.45;
        op = k;
        if (f.t > 1) released = true; // segurança
      } else {
        rc.rt += dt;
        const k = Math.min(1, rc.rt / 0.45);
        outer.position.copy(fixed);
        scale = 0.7 + easeOut(Math.min(1, rc.rt / 0.12)) * 0.9 + k * 0.3;
        op = 1 - k * k;
        if (k >= 1) {
          scene.remove(outer, inner);
          outer.material.dispose();
          inner.material.dispose();
          return true;
        }
      }
      inner.position.copy(outer.position).addScaledVector(normal, 0.02);
      for (const [m, s, r] of [[outer, scale, spin], [inner, scale * 0.55, -spin * 1.6]]) {
        m.lookAt(m.position.x + normal.x, m.position.y + normal.y, m.position.z + normal.z);
        m.rotateZ(r);
        m.scale.setScalar(s);
        m.material.opacity = op;
      }
      return false;
    });
    return rc;
  }

  // bola de fogo crescendo na mão durante a carga
  function handOrb(P) {
    const outer = new THREE.Mesh(ballGeo, createFireMaterial({ disp: 0.35, freq: 3, hotBias: 0.25, alpha: 0.9 }));
    const core = new THREE.Mesh(coreGeo, coreMat);
    outer.renderOrder = 12;
    scene.add(outer, core);
    const o = { done: false };
    addFx((f, dt) => {
      handPos(P.facing, handW);
      const k = Math.min(1, f.t / CAST_DELAY);
      const s = 0.04 + easeOut(k) * 0.18;
      outer.position.copy(handW);
      core.position.copy(handW);
      outer.scale.setScalar(s);
      core.scale.setScalar(s * 0.35);
      outer.material.uniforms.time.value += dt;
      handLight.position.copy(handW);
      handLight.intensity = 12 + k * 18;
      // energia sendo sugada para a mão
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), r = rnd(0.6, 1.1);
        const dx = Math.sin(b) * Math.cos(a) * r, dy = Math.cos(b) * r, dz = Math.sin(b) * Math.sin(a) * r;
        const life = rnd(0.12, 0.18);
        fx.glow({
          x: handW.x + dx, y: handW.y + dy, z: handW.z + dz, vx: -dx / life, vy: -dy / life, vz: -dz / life,
          color: [1, 0.7, 0.3], colorEnd: [1, 0.95, 0.8], size: 0.1, sizeEnd: 0.03, life,
        });
      }
      if (o.done || P.dead) {
        scene.remove(outer, core);
        outer.material.dispose();
        return true;
      }
      return false;
    });
    return o;
  }

  function debris(x, y, groundY) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(debrisGeo, debrisMat);
      m.position.set(x, y, Z + rnd(-0.3, 0.3));
      m.scale.setScalar(rnd(0.6, 1.6));
      scene.add(m);
      const v = new THREE.Vector3(rnd(-5, 5), rnd(3, 9), rnd(-1.5, 2));
      const spin = new THREE.Vector3(rnd(-15, 15), rnd(-15, 15), rnd(-15, 15));
      const life = rnd(0.9, 1.5);
      addFx((f, dt) => {
        v.y -= 26 * dt;
        m.position.addScaledVector(v, dt);
        m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
        if (groundY !== null && m.position.y < groundY + 0.05 && v.y < 0) {
          m.position.y = groundY + 0.05;
          v.y *= -0.35; v.x *= 0.6; v.z *= 0.6;
          spin.multiplyScalar(0.5);
        }
        if (Math.random() < 0.3) {
          fx.glow({ x: m.position.x, y: m.position.y, z: m.position.z, color: [1, 0.6, 0.2], colorEnd: [0.6, 0.05, 0], size: 0.08, sizeEnd: 0, life: 0.3 });
        }
        if (f.t > life) { scene.remove(m); return true; }
        return false;
      });
    }
  }

  // fogo que fica queimando no chão + marca de queimado
  function groundFire(x, gy) {
    const mat = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: 0.95 });
    const decal = new THREE.Mesh(planeGeo, mat);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * 6;
    decal.position.set(x, gy + 0.03, 0.4);
    decal.scale.set(1.3, 1.3, 1);
    decal.renderOrder = 2;
    scene.add(decal);
    addFx((f, dt) => {
      if (f.t < 0.5) {
        const k = 1 - f.t / 0.5;
        for (let i = 0; i < 2 * k; i++) {
          fx.glow({
            x: x + rnd(-0.5, 0.5), y: gy + 0.05, z: rnd(-0.3, 0.8),
            vx: rnd(-0.3, 0.3), vy: rnd(1.2, 3.2) * (0.5 + k * 0.5),
            color: FIRE, colorEnd: FIRE_END, size: rnd(0.25, 0.5) * (0.4 + k * 0.6), sizeEnd: 0, life: rnd(0.25, 0.5), drag: 2,
          });
        }
        if (Math.random() < 0.05 * k) {
          fx.smoke({ x: x + rnd(-0.6, 0.6), y: gy + 0.4, z: 0.3, vy: 1.2, color: [0.07, 0.05, 0.06], size: 0.4, sizeEnd: 1.4, life: 1.2, alpha: 0.4 });
        }
      }
      mat.opacity = 0.7 * Math.max(0, 1 - f.t / 1.6);
      if (f.t > 1.6) { scene.remove(decal); mat.dispose(); return true; }
      return false;
    });
  }

  function groundBelow(x, y) {
    let best = null;
    for (const s of world.solidsNear(x - 0.3, x + 0.3)) {
      if (x < s.minX || x > s.maxX || s.maxY > y + 0.3) continue;
      if (best === null || s.maxY > best) best = s.maxY;
    }
    return best;
  }

  // ---------- impacto ----------
  function explode(x, y, { soul = false, big = 1, enemy = false } = {}) {
    const z = Z;
    for (let i = 0; i < 36 * big; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), s = rnd(4, 11) * big;
      fx.glow({
        x, y, z,
        vx: Math.sin(ph) * Math.cos(th) * s, vy: Math.cos(ph) * s + 1, vz: Math.sin(ph) * Math.sin(th) * s * 0.6,
        color: [1, 0.97, 0.8], colorEnd: [1, 0.25, 0.02], size: rnd(0.07, 0.15), sizeEnd: 0,
        life: rnd(0.25, 0.55), drag: 4.5, gravity: 2,
      });
    }
    for (let i = 0; i < 26 * big; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.5, 3.4) * big;
      fx.glow({
        x: x + rnd(-0.2, 0.2), y: y + rnd(-0.2, 0.2), z,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1.2, vz: rnd(-1, 1),
        color: [1, 0.88, 0.5], colorEnd: [0.55, 0.05, 0.02], size: rnd(0.6, 1.2) * big, sizeEnd: rnd(1.5, 2.4) * big,
        life: rnd(0.3, 0.6), drag: 3, alpha: 0.9,
      });
    }
    fx.glow({ x, y, z, color: [1, 1, 0.95], colorEnd: [1, 0.6, 0.2], size: 3 * big, sizeEnd: 0.5, life: 0.16 });
    for (let i = 0; i < 16 * big; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.4, 1.8);
      fx.smoke({
        x: x + rnd(-0.3, 0.3), y: y + rnd(-0.2, 0.3), z: z - 0.1,
        vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s + 1.2, vz: rnd(-0.5, 0.5),
        color: [0.08, 0.06, 0.07], colorEnd: [0.04, 0.03, 0.05], size: rnd(0.5, 0.9), sizeEnd: rnd(1.8, 3),
        life: rnd(1, 1.8), drag: 1.5, gravity: -0.6, alpha: 0.55,
      });
    }
    for (let i = 0; i < 6; i++) {
      fx.glow({
        x, y, z, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-0.5, 0.5),
        color: [1, 0.6, 0.15], colorEnd: [0.6, 0.05, 0], size: rnd(0.05, 0.09), sizeEnd: 0,
        life: rnd(0.6, 1.1), drag: 1.5, gravity: -0.8,
      });
    }
    if (soul) {
      for (let i = 0; i < 34; i++) {
        fx.glow({
          x: x + rnd(-0.4, 0.4), y: y + rnd(-0.3, 0.5), z,
          vx: rnd(-1.2, 1.2), vy: rnd(1.5, 4.5), vz: rnd(-0.5, 0.5),
          color: [0.75, 0.88, 1], colorEnd: [0.2, 0.35, 1], size: rnd(0.2, 0.5), sizeEnd: 0,
          life: rnd(0.9, 1.8), drag: 0.8, gravity: -1.5,
        });
      }
      ring(x, y, z, 2.8, 0x8ab4ff, 0.5);
    }
    starBurst(x, y, 4.2 * big);
    ring(x, y, z, 3.4 * big, 0xff8a3a, 0.38);
    ring(x, y, z - 0.05, 2 * big, 0xffe0a0, 0.22);
    const gy = groundBelow(x, y);
    if (gy !== null && y - gy < 1.0) {
      ring(x, gy + 0.06, 0.4, 2.4 * big, 0xff7a2a, 0.35, new THREE.Vector3(0, 1, 0));
      groundFire(x, gy);
    }
    flashI = 110 * big;
    flash.position.set(x, y + 0.3, 1.2);
    shake = Math.max(shake, 0.4 * big);
    heat = Math.max(heat, 0.55 * big);
    if (enemy) hitStop = 0.075;
    sfx.boom?.(big);
  }

  function fizzle(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(1, 3);
      fx.glow({ x, y, z: Z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: FIRE, colorEnd: FIRE_END, size: rnd(0.15, 0.3), sizeEnd: 0, life: rnd(0.2, 0.4), drag: 3 });
    }
    fx.smoke({ x, y, z: Z, vy: 0.8, color: [0.1, 0.08, 0.09], size: 0.5, sizeEnd: 1.4, life: 0.8, alpha: 0.4 });
    ring(x, y, Z, 1, 0xff8a3a, 0.2);
  }

  // ---------- projétil ----------
  function spawn(P) {
    const p = handPos(P.facing, new THREE.Vector3());
    p.z = Z;
    const group = new THREE.Group();
    const outerMat = createFireMaterial({ disp: 0.45, freq: 2.4, hotBias: 0.05, alpha: 0.75 });
    const innerMat = createFireMaterial({ disp: 0.25, freq: 3.4, hotBias: 0.55, alpha: 0.95 });
    const outer = new THREE.Mesh(ballGeo, outerMat);
    outer.scale.setScalar(0.34);
    const inner = new THREE.Mesh(ballGeo, innerMat);
    inner.scale.setScalar(0.2);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.scale.setScalar(0.08);
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.6);
    const rune = new THREE.Mesh(planeGeo, additive(runeTex, 0xffb050, 0.75));
    rune.scale.setScalar(0.85);
    halo.renderOrder = 10;
    outer.renderOrder = inner.renderOrder = rune.renderOrder = 12;
    group.add(halo, outer, inner, core);
    group.position.copy(p);
    scene.add(group, rune);
    const slot = lights.find((l) => !l.busy);
    if (slot) slot.busy = true;
    const trail = createTrail(scene, { points: 26, width: 0.5 });
    const shot = {
      group, outer, inner, halo, rune, outerMat, innerMat, trail, slot, t: 0, x: p.x, y: p.y,
      baseY: P.y + FLY_H, yOff: p.y - (P.y + FLY_H),
      vx: P.facing * SPEED + P.vx * 0.5, vy: 0, dir: P.facing, spin: Math.random() * 6, target: null,
    };
    if (aimTarget && aimTarget.state === 'walk') {
      shot.target = aimTarget;
      const dx = aimTarget.x - p.x, dy = targetY(aimTarget) - p.y, l = Math.hypot(dx, dy) || 1;
      shot.vx = (dx / l) * SPEED;
      shot.vy = (dy / l) * SPEED;
    }
    shots.push(shot);

    // disparo: clarão, ondas de choque na direção do tiro, faíscas, recuo
    const n = new THREE.Vector3(shot.vx, shot.vy, 0).normalize();
    const nTilt = n.clone().setZ(0.6).normalize();
    for (let i = 0; i < 22; i++) {
      const a = rnd(-0.8, 0.8), s = rnd(3, 9);
      const c = Math.cos(a), si = Math.sin(a);
      fx.glow({
        x: p.x, y: p.y, z: p.z, vx: (n.x * c - n.y * si) * s, vy: (n.x * si + n.y * c) * s, vz: rnd(-1.5, 1.5),
        color: [1, 0.95, 0.7], colorEnd: [1, 0.3, 0.05], size: rnd(0.08, 0.16), sizeEnd: 0, life: rnd(0.15, 0.3), drag: 5,
      });
    }
    fx.glow({ x: p.x, y: p.y, z: p.z, color: [1, 0.9, 0.6], colorEnd: [1, 0.3, 0.05], size: 1.6, sizeEnd: 0.2, life: 0.14 });
    ring(p.x, p.y, p.z, 1.2, 0xffb050, 0.25, nTilt);
    ring(p.x + n.x * 0.4, p.y + n.y * 0.4, p.z, 0.8, 0xffe0a0, 0.18, nTilt);
    flashI = Math.max(flashI, 35);
    flash.position.set(p.x, p.y, 1.2);
    shake = Math.max(shake, 0.12);
    if (P.grounded) P.vx -= P.facing * 1.6; // recuo
    sfx.cast?.();
  }

  function removeShot(s) {
    scene.remove(s.group, s.rune);
    s.outerMat.dispose();
    s.innerMat.dispose();
    s.rune.material.dispose();
    if (s.slot) { s.slot.busy = false; s.slot.light.intensity = 0; }
    // o rastro termina de encolher sozinho
    const trail = s.trail, last = trail.last() || [s.x, s.y, Z];
    addFx((f) => {
      trail.push(last[0], last[1], last[2]);
      trail.mat.uniforms.fade.value = Math.max(0, 1 - f.t / 0.3);
      trail.update(f.t);
      if (f.t > 0.3) { trail.dispose(); return true; }
      return false;
    });
    s.dead = true;
  }

  function hitEnemy(s) {
    for (const e of world.enemies()) {
      if (e.state !== 'walk' || !e.active) continue;
      if (Math.abs(s.x - e.x) < e.w / 2 + RADIUS && s.y > e.y - RADIUS && s.y < e.y + e.h + RADIUS) return e;
    }
    return null;
  }

  function hitSolid(s) {
    for (const b of world.solidsNear(s.x - 1, s.x + 1)) {
      if (s.x + 0.12 > b.minX && s.x - 0.12 < b.maxX && s.y + 0.12 > b.minY && s.y - 0.12 < b.maxY) return b;
    }
    return null;
  }

  // ---------- API ----------
  let rune = null, orb = null;

  function reset() {
    for (const s of shots) if (!s.dead) removeShot(s);
    shots.length = 0;
    charges = MAX_CHARGES;
    recharge = 0;
    cooldown = 0;
    castT = 0;
    aimTarget = null;
    pending = -1;
    fireQueued = false;
    hitStop = 0;
    heat = 0;
    if (orb) orb.done = true;
    rune = orb = null;
  }

  function trigger() { fireQueued = true; }

  /**
   * Tela de carregamento: cria UM de cada efeito (bola de fogo, rastro, runas, orbe na mão,
   * explosão com alma, fogo no chão, estilhaços, fumaça) para a GPU preparar tudo.
   * Devolve a limpeza. Os materiais NÃO são descartados de propósito: assim os shaders
   * continuam vivos e o primeiro disparo da partida não recompila nada.
   */
  function prewarm(P) {
    const before = new Set(scene.children);
    spawn(P);
    runeCircle(P);
    handOrb(P);
    explode(P.x + 2, P.y + 0.5, { soul: true, enemy: true });
    debris(P.x + 1, P.y + 1, P.y);
    groundFire(P.x + 1, P.y);
    fizzle(P.x - 1, P.y + 1);
    for (const s of shots) s.trail.update?.(0);
    return () => {
      for (const s of shots) if (s.slot) { s.slot.busy = false; s.slot.light.intensity = 0; }
      shots.length = 0;
      fxs.length = 0;
      for (const o of [...scene.children]) if (!before.has(o)) scene.remove(o);
      reset();
      shake = 0; heat = 0; flashI = 0; flash.intensity = 0;
    };
  }

  // retorna o fator de tempo (hit-stop) — chamar uma vez por quadro com o dt real
  function timeScale(dt) {
    if (hitStop > 0) { hitStop -= dt; return 0.06; }
    return 1;
  }

  const tmpN = new THREE.Vector3();

  function update(dt, time, P, playing) {
    lastP = P;
    // recarga
    cooldown -= dt;
    if (charges < MAX_CHARGES) {
      recharge += dt;
      if (recharge >= RECHARGE) {
        recharge = 0;
        charges++;
        if (playing && !P.dead) {
          handPos(P.facing, va);
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            fx.glow({ x: va.x, y: va.y, z: va.z, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 + 0.5, color: FIRE, colorEnd: FIRE_END, size: 0.12, sizeEnd: 0, life: 0.4, drag: 3 });
          }
          ring(va.x, va.y, va.z, 0.6, 0xffa040, 0.25);
          sfx.recharge?.();
        }
      }
    } else recharge = 0;

    // iniciar conjuração
    if (fireQueued) {
      fireQueued = false;
      if (playing && !P.dead && charges > 0 && cooldown <= 0 && pending < 0) {
        charges--;
        cooldown = COOLDOWN;
        castT = CAST_TIME;
        pending = CAST_DELAY;
        aimTarget = findTarget(P);
        rune = runeCircle(P);
        orb = handOrb(P);
        sfx.charge?.();
        // parado no chão: corpo inteiro faz o arremesso do feitiço (clipe da coruja).
        // O trecho 1.2s→2.0s do clipe (puxa as mãos e empurra) cabe no CAST_DELAY.
        if (P.grounded && Math.abs(P.vx) < 1.5 && character.actions?.spell_throw) {
          character.play('spell_throw', { from: 1.2, timeScale: 0.8 / CAST_DELAY, fade: 0.05, restart: true, lock: CAST_DELAY + 0.35 });
        }
      } else if (playing && charges === 0) {
        sfx.empty?.();
      }
    }
    castT = Math.max(0, castT - dt);
    if (pending >= 0) {
      pending -= dt;
      if (pending < 0) {
        if (orb) orb.done = true;
        if (!P.dead) {
          handPos(P.facing, handW);
          computeAim(P);
          rune?.release();
          spawn(P);
        }
        rune = orb = null;
      }
    }
    if (pending < 0) handLight.intensity *= Math.exp(-dt * 12);

    // brasas flutuando da mão quando há carga
    if (playing && !P.dead && charges > 0) {
      emberT -= dt;
      if (emberT <= 0) {
        emberT = 0.07 / charges;
        handPos(P.facing, va);
        fx.glow({
          x: va.x + rnd(-0.05, 0.05), y: va.y, z: va.z, vx: rnd(-0.3, 0.3), vy: rnd(0.4, 1.1), vz: rnd(-0.2, 0.2),
          color: FIRE, colorEnd: FIRE_END, size: rnd(0.05, 0.11), sizeEnd: 0, life: rnd(0.35, 0.7), drag: 1,
        });
      }
    }

    // projéteis
    for (const s of shots) {
      if (s.dead) continue;
      s.t += dt;
      if (s.target) {
        const e = s.target;
        if (e.state === 'walk') {
          const dx = e.x - s.x, dy = targetY(e) - s.y, l = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * HOMING);
          s.vx += ((dx / l) * SPEED - s.vx) * k;
          s.vy += ((dy / l) * SPEED - s.vy) * k;
          const v = Math.hypot(s.vx, s.vy) || 1;
          s.vx = (s.vx / v) * SPEED;
          s.vy = (s.vy / v) * SPEED;
        } else s.target = null;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      } else if (s.vy) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      } else {
        s.x += s.vx * dt;
        s.y = s.baseY + s.yOff * Math.exp(-s.t * 22) + Math.sin(s.t * 18) * 0.05;
      }
      s.dir = Math.sign(s.vx) || s.dir;
      const vl = Math.hypot(s.vx, s.vy) || 1;
      const nx = s.vx / vl, ny = s.vy / vl;
      const back = -s.dir;

      s.group.position.set(s.x, s.y, Z);
      // chamas escorrem para trás do movimento
      for (const m of [s.outerMat, s.innerMat]) {
        m.uniforms.time.value += dt;
        m.uniforms.flow.value.set(-nx * 3.5, -ny * 3.5 + 0.8, 0);
      }
      s.outer.rotation.z = Math.atan2(ny, nx);
      const pulse = 1 + Math.sin(time * 38 + s.spin) * 0.1;
      s.halo.scale.setScalar(1.6 * pulse);
      s.outer.scale.setScalar(0.34 * (1 + Math.sin(time * 23 + s.spin) * 0.06));
      // anel rúnico girando em volta, perpendicular ao voo
      s.rune.position.set(s.x - nx * 0.05, s.y - ny * 0.05, Z);
      s.rune.lookAt(s.x + nx, s.y + ny, Z + 0.7);
      s.rune.rotateZ(time * 9 + s.spin);
      if (s.slot) {
        s.slot.light.position.set(s.x, s.y, 1);
        s.slot.light.intensity = 30 * (0.85 + Math.random() * 0.3);
      }

      s.trail.push(s.x, s.y, Z - 0.02);
      s.trail.update(time);

      // partículas do rastro
      for (let i = 0; i < 4; i++) {
        fx.glow({
          x: s.x + rnd(-0.1, 0.1), y: s.y + rnd(-0.1, 0.1), z: Z + rnd(-0.1, 0.1),
          vx: -nx * rnd(1, 3) + rnd(-0.4, 0.4), vy: -ny * rnd(1, 3) + rnd(-0.3, 1), vz: rnd(-0.4, 0.4),
          color: FIRE, colorEnd: FIRE_END, size: rnd(0.3, 0.55), sizeEnd: 0.04, life: rnd(0.16, 0.34), drag: 4, alpha: 0.8,
        });
      }
      for (let k = 0; k < 2; k++) {
        const a = s.t * 26 + s.spin + k * Math.PI;
        // espiral perpendicular à direção de voo
        const px = -ny * Math.cos(a) * 0.3, py = nx * Math.cos(a) * 0.3, pz = Math.sin(a) * 0.3;
        fx.glow({
          x: s.x + px, y: s.y + py, z: Z + pz, vx: -nx * 0.6, vy: -ny * 0.6,
          color: [1, 0.6, 0.2], colorEnd: [0.75, 0.05, 0.12], size: 0.15, sizeEnd: 0, life: 0.35,
        });
      }
      if (Math.random() < 0.3) {
        fx.glow({
          x: s.x, y: s.y, z: Z, vx: back * rnd(1, 3) + rnd(-0.5, 0.5), vy: rnd(0.3, 1.5), vz: rnd(-0.5, 0.5),
          color: [1, 0.9, 0.6], colorEnd: [1, 0.2, 0], size: 0.07, sizeEnd: 0, life: rnd(0.2, 0.4), drag: 3,
        });
      }
      if (Math.random() < 0.4) {
        fx.smoke({
          x: s.x - nx * 0.35, y: s.y - ny * 0.35, z: Z - 0.05, vy: rnd(0.3, 0.9),
          color: [0.12, 0.09, 0.1], colorEnd: [0.06, 0.05, 0.07], size: 0.3, sizeEnd: 1.1, life: rnd(0.6, 1.1), alpha: 0.3,
        });
      }

      const e = hitEnemy(s);
      if (e) {
        world.killByPower(e, s.dir);
        explode(s.x, s.y, { soul: e.kind === 'ghost', big: 1, enemy: true });
        removeShot(s);
        continue;
      }
      if (hitSolid(s)) {
        explode(s.x - s.dir * 0.15, s.y, { big: 0.6 });
        removeShot(s);
        continue;
      }
      if (s.t > LIFETIME) {
        fizzle(s.x, s.y);
        removeShot(s);
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].dead) shots.splice(i, 1);

    // aranhas em chamas
    for (const e of world.enemies()) {
      if (!e.burning) continue;
      for (let i = 0; i < 4; i++) {
        fx.glow({
          x: e.x + rnd(-0.6, 0.6), y: e.y + rnd(0.2, 1), z: rnd(-0.4, 0.6),
          vx: rnd(-0.5, 0.5), vy: rnd(1.5, 3.5), color: FIRE, colorEnd: FIRE_END,
          size: rnd(0.3, 0.65), sizeEnd: 0, life: rnd(0.25, 0.5), drag: 2,
        });
      }
      if (Math.random() < 0.35) {
        fx.smoke({ x: e.x, y: e.y + 0.8, z: 0, vy: 1.4, color: [0.08, 0.06, 0.07], size: 0.4, sizeEnd: 1.5, life: 1, alpha: 0.45 });
      }
    }

    // efeitos
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      f.t += dt;
      if (f.update(f, dt)) fxs.splice(i, 1);
    }

    flashI *= Math.exp(-dt * 13);
    flash.intensity = flashI < 0.5 ? 0 : flashI;
    shake *= Math.exp(-dt * 9);
    heat *= Math.exp(-dt * 5);
  }

  return {
    update,
    poseArm,
    reset,
    trigger,
    prewarm,
    timeScale,
    get charges() { return charges; },
    get rechargeProgress() { return charges >= MAX_CHARGES ? 1 : recharge / RECHARGE; },
    get shake() { return shake; },
    get heat() { return heat; },
    MAX_CHARGES,
  };
}
