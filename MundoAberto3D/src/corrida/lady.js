import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A Dama de Branco: fantasma do castelo, agora com o modelo assets/ghost.glb.
 * De frente para +z, pés na origem (flutua um pouco acima do chão).
 *
 * Animações do modelo e quando cada uma toca:
 *  - wait            surge do nada e fica parada te encarando
 *  - walk / run      persegue (anda; corre quando está perto ou com fúria alta)
 *  - idle            parada colada no jogador
 *  - sit             agacha e fareja na frente do armário onde você se escondeu
 *  - turn            vira as costas e some
 *  - standing_relax  respira parada depois de te pegar, antes de sumir
 * Por cima dos clipes, no código: a cabeça segue o jogador (com trancos),
 * os braços se esticam para agarrar quando ela chega perto, ela flutua e "falha".
 */

const MODEL_URL = new URL('../../assets/ghost.glb', import.meta.url).href;
const TARGET_HEIGHT = 2.05;               // altura da Dama em metros
const LOOPING = new Set(['idle', 'wait', 'walk', 'run', 'standing_relax']);
const WALK_MAX = 2.6;                     // acima disso (m/s) ela corre

// carrega uma vez só (o castelo pode ser recriado várias vezes na mesma partida)
let gltfPromise = null;
export function loadGhost(onProgress) {
  gltfPromise ??= new GLTFLoader().loadAsync(MODEL_URL, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  });
  return gltfPromise;
}

// gira um osso em torno de uma rotação dada no espaço do mundo
const _pq = new THREE.Quaternion();
const _q = new THREE.Quaternion();
function rotateBoneWorld(bone, qWorld) {
  bone.parent.getWorldQuaternion(_pq);
  _q.copy(_pq).invert().multiply(qWorld).multiply(_pq);
  bone.quaternion.premultiply(_q);
  bone.updateMatrixWorld(true);
}

// tira o deslocamento de root motion do osso Hip (quem move a Dama é o castelo)
function stripRootMotion(clip, hipName) {
  const track = clip.tracks.find((t) => t.name === `${hipName}.position`);
  if (!track) return null;
  const v = track.values, times = track.times, n = times.length;
  const T = times[n - 1] - times[0] || 1;
  const d = new THREE.Vector3(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]);
  for (let i = 0; i < n; i++) {
    const t = (times[i] - times[0]) / T;
    v[i * 3] -= d.x * t; v[i * 3 + 1] -= d.y * t; v[i * 3 + 2] -= d.z * t;
  }
  return { d, T };
}

export function createLady() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // flutuação e "falhas" de imagem
  root.add(body);

  let ready = false;
  let model, mixer, mats = [], bones = {};
  const actions = {};
  const speeds = {};
  let current = null;

  loadGhost().then((gltf) => {
    model = gltf.scene;
    // modelo fantasma: pálido, translúcido e com brilho frio
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // a caixa do SkinnedMesh não acompanha a animação
      const m = o.material.clone();
      m.transparent = true;
      m.emissive = new THREE.Color(0x7a88b8);
      m.emissiveIntensity = 0.32;
      m.color.multiplyScalar(1.05);
      o.material = m;
      mats.push(m);
    });
    model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    model.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.computeBoundingBox();
        box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    const scale = TARGET_HEIGHT / (box.max.y - box.min.y);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    body.add(model);

    for (const n of ['Hip', 'Head', 'NeckTwist01', 'L_Upperarm', 'R_Upperarm', 'L_Hand', 'R_Hand']) bones[n] = model.getObjectByName(n);
    const hip = bones.Hip;
    const hipParentMat = new THREE.Matrix3().setFromMatrix4(hip.parent.matrixWorld);

    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      clip.name = clip.name.replace(/\.\d+$/, '');
      if (clip.name === 'walk' || clip.name === 'run') {
        const rm = stripRootMotion(clip, hip.name);
        if (rm) {
          const w = rm.d.clone().applyMatrix3(hipParentMat);
          w.y = 0;
          speeds[clip.name] = (w.length() * scale) / rm.T; // m/s natural do clipe
        }
      }
      const a = mixer.clipAction(clip);
      if (!LOOPING.has(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[clip.name] = a;
    }
    play('wait', 0);
    ready = true;
  }).catch((e) => console.warn('Dama de Branco: falha ao carregar ghost.glb', e));

  function play(name, fade = 0.35, timeScale = 1) {
    const a = actions[name];
    if (!a) return;
    a.timeScale = timeScale;
    if (current === a) return;
    a.reset().play();
    if (current) a.crossFadeFrom(current, fade, true);
    current = a;
  }

  // ---------- estado da animação ----------
  let mode = '', modeT = 0;
  let twitch = 0, twitchT = 2, twitchDir = 1, reachK = 0, glitch = 0, lookK = 0;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qId = new THREE.Quaternion();
  const rootQ = new THREE.Quaternion();

  // escolhe o clipe a partir do que o castelo diz que ela está fazendo
  function pickClip(state, speed, dist, dt) {
    if (state !== mode) { mode = state; modeT = 0; } else modeT += dt;
    switch (state) {
      case 'appear':
        play('wait', 0.2);
        break;
      case 'hunt':
        if (speed <= 0.05) play('idle', 0.3);
        else if (speed > WALK_MAX || dist < 3.2) play('run', 0.25, THREE.MathUtils.clamp(speed / (speeds.run || 5), 0.55, 1.3));
        else play('walk', 0.3, THREE.MathUtils.clamp(speed / (speeds.walk || 1.5), 0.7, 1.8));
        break;
      case 'search':
        // agacha na frente do armário e se inclina, farejando
        play('sit', 0.4, 2.2);
        break;
      case 'caught':
        play('standing_relax', 0.3, 1.4);
        break;
      case 'leave':
        play('turn', 0.4, 1.6);
        break;
    }
  }

  /**
   * opts:
   *  alpha (0..1), reach (0..1: braços estendidos), near (0..1: perto do jogador),
   *  state ('appear' | 'hunt' | 'search' | 'caught' | 'leave'), speed (m/s), dist (m),
   *  look (THREE.Vector3 no mundo: para onde ela olha, normalmente a cabeça do jogador)
   */
  function update(dt, time, opts) {
    const { alpha = 1, reach = 0, near = 0, state = 'hunt', speed = 0, dist = 99, look = null } = opts;
    for (const m of mats) m.opacity = alpha * 0.88;

    // flutua; às vezes "falha" e salta alguns centímetros (como um vídeo com defeito)
    glitch -= dt;
    if (glitch < -2 - Math.random() * 4) glitch = 0.12;
    const gx = glitch > 0 ? (Math.random() - 0.5) * 0.14 : 0;
    body.position.set(gx, 0.12 + Math.sin(time * 1.7) * 0.06, 0);
    body.rotation.x = state === 'hunt' && speed > 0 ? 0.08 : 0.02;

    if (!ready) return;
    pickClip(state, speed, dist, dt);
    mixer.update(dt);
    root.updateMatrixWorld(true);

    // ---------- por cima do clipe: cabeça seguindo o jogador ----------
    root.getWorldQuaternion(rootQ);
    fwd.set(0, 0, 1).applyQuaternion(rootQ);
    side.set(1, 0, 0).applyQuaternion(rootQ);
    const wantLook = look && state !== 'leave' ? 1 : 0;
    lookK += (wantLook - lookK) * Math.min(1, dt * 4);

    // tranco de cabeça de vez em quando (mais forte quando está perto)
    twitchT -= dt;
    if (twitchT <= 0) { twitch = 0.22; twitchT = 1.2 + Math.random() * (3 - near * 1.5); twitchDir = Math.random() < 0.5 ? -1 : 1; }
    twitch = Math.max(0, twitch - dt);

    if (bones.Head && bones.NeckTwist01) {
      if (look && lookK > 0.01) {
        bones.Head.getWorldPosition(v1);
        v2.copy(look).sub(v1).normalize();
        qa.setFromUnitVectors(fwd, v2);
        // não vira mais que ~75° (fica natural mesmo com o jogador atrás)
        const ang = 2 * Math.acos(Math.min(1, Math.abs(qa.w)));
        const k = lookK * Math.min(1, 1.3 / Math.max(ang, 1e-3));
        qb.slerpQuaternions(qId, qa, k * 0.5);
        rotateBoneWorld(bones.NeckTwist01, qb);
        rotateBoneWorld(bones.Head, qb);
      }
      // cabeça pendendo para o lado; o tranco é seco e rápido
      const tilt = (0.22 + (twitch > 0 ? 0.35 : 0)) * twitchDir * (0.4 + near * 0.6);
      qa.setFromAxisAngle(fwd, tilt);
      rotateBoneWorld(bones.Head, qa);
    }

    // ---------- braços esticando para agarrar ----------
    const reachTarget = reach * Math.max(0.25, near);
    reachK += (reachTarget - reachK) * Math.min(1, dt * 3);
    if (reachK > 0.01) {
      for (const [n, lag] of [['L_Upperarm', 0], ['R_Upperarm', 0.6]]) {
        const b = bones[n];
        if (!b) continue;
        qa.setFromAxisAngle(side, -reachK * (1.25 + Math.sin(time * 1.4 + lag) * 0.12));
        rotateBoneWorld(b, qa);
      }
      // mãos tremendo
      for (const [n, ph] of [['L_Hand', 0], ['R_Hand', 1.7]]) {
        const b = bones[n];
        if (!b) continue;
        qa.setFromAxisAngle(side, Math.sin(time * 13 + ph) * 0.18 * reachK);
        rotateBoneWorld(b, qa);
      }
    }
  }

  return { root, update };
}
