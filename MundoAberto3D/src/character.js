import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildJumpClips } from './jumpClips.js';

const MODEL_URL = new URL('../assets/coruja.glb', import.meta.url).href;
const TARGET_HEIGHT = 1.8; // altura do personagem em metros

// Animações que devem repetir em loop (as demais tocam uma vez)
const LOOPING = new Set([
  'idle', 'walk', 'run', 'fall', 'dance_02', 'dance_03', 'dance_05',
  'standing_relax', 'fold_arms', 'wait', 'look_around', 'flee_01', 'flee_02',
]);

// Clipes da coruja com nomes longos (gerados por prompt) -> nomes curtos
const RENAME = [
  [/^preciso que anime uma jogada de poder/i, 'spell_throw'], // arremesso de feitiço com as duas mãos
  [/^humanoid character falling violently/i, 'break_fall'],   // desaba no chão
  [/^faz uma animacao dele caindo/i, 'shatter'],               // ergue os braços e treme
];

// Animações que o código pede mas o modelo atual não tem -> clipe substituto
const FALLBACK = {
  afraid: 'cry',
  frightened: 'defeat_02',
  standing_relax: 'fold_arms',
  dance_03: 'dance_02',
  dance_05: 'dance_02',
  flee_01: 'flee_02',
  turn: 'look_around',
};

// Nomes de ossos do modelo antigo -> esqueleto Mixamo (o GLTFLoader remove o ":")
const BONE_ALIASES = {
  Hip: 'mixamorigHips',
  Head: 'mixamorigHead',
  L_Upperarm: 'mixamorigLeftArm', L_Forearm: 'mixamorigLeftForeArm', L_Hand: 'mixamorigLeftHand',
  R_Upperarm: 'mixamorigRightArm', R_Forearm: 'mixamorigRightForeArm', R_Hand: 'mixamorigRightHand',
  L_Thigh: 'mixamorigLeftUpLeg', L_Calf: 'mixamorigLeftLeg', L_Foot: 'mixamorigLeftFoot', L_ToeBase: 'mixamorigLeftToeBase',
  R_Thigh: 'mixamorigRightUpLeg', R_Calf: 'mixamorigRightLeg', R_Foot: 'mixamorigRightFoot', R_ToeBase: 'mixamorigRightToeBase',
};

/**
 * Carrega o personagem, normaliza escala/orientação e prepara as animações.
 * Retorna { root, play, actions, speeds, mixer }.
 */
export async function loadCharacter(onProgress) {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  });
  const model = gltf.scene;

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // bounding box de SkinnedMesh não acompanha a animação
    }
  });
  model.updateMatrixWorld(true);

  // Mede a altura real (já com os ossos aplicados) para escalar até ~1.8 m
  const box = new THREE.Box3();
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
  });
  const scale = TARGET_HEIGHT / (box.max.y - box.min.y);

  // Root motion: o osso "Hip" se desloca nos clipes de andar/correr.
  // Medimos a velocidade natural de cada clipe e removemos o deslocamento,
  // pois quem move o personagem é o código (assim os pés não escorregam).
  const bone = (name) => model.getObjectByName(name) ?? model.getObjectByName(BONE_ALIASES[name] ?? '');
  const hip = bone('Hip');
  const hipParentMat = new THREE.Matrix3().setFromMatrix4(hip.parent.matrixWorld);
  const speeds = {};
  const forward = new THREE.Vector3(0, 0, 1);

  const clips = gltf.animations.map((clip) => {
    clip.name = clip.name.replace(/\.\d+$/, ''); // "walk.001" -> "walk"
    for (const [re, short] of RENAME) if (re.test(clip.name)) clip.name = short;
    const track = clip.tracks.find((t) => t.name === `${hip.name}.position`);
    if (track) {
      const v = track.values;
      const times = track.times;
      const n = times.length;
      const T = times[n - 1] - times[0] || 1;
      const d = new THREE.Vector3(
        v[(n - 1) * 3] - v[0],
        v[(n - 1) * 3 + 1] - v[1],
        v[(n - 1) * 3 + 2] - v[2],
      );
      for (let i = 0; i < n; i++) {
        const t = (times[i] - times[0]) / T;
        v[i * 3] -= d.x * t;
        v[i * 3 + 1] -= d.y * t;
        v[i * 3 + 2] -= d.z * t;
      }
      const world = d.clone().applyMatrix3(hipParentMat);
      world.y = 0;
      speeds[clip.name] = (world.length() * scale) / T;
      if (clip.name === 'walk' && world.lengthSq() > 1e-8) forward.copy(world).normalize();
    }
    return clip;
  });

  // Pulos procedurais (normal e longo), feitos sobre o esqueleto
  clips.push(...buildJumpClips(model, clips, bone));

  // Estrutura: root (posição/rumo no mundo) -> pivot (corrige orientação) -> model
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
  pivot.rotation.y = -Math.atan2(forward.x, forward.z); // frente do modelo = +Z do root
  pivot.add(model);
  root.add(pivot);

  // Mixer e actions
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of clips) {
    const a = mixer.clipAction(clip);
    if (!LOOPING.has(clip.name)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions[clip.name] = a;
  }
  // substitutos: cópia do clipe com o nome pedido (o evento 'finished' continua batendo pelo nome)
  for (const [want, have] of Object.entries(FALLBACK)) {
    if (actions[want] || !actions[have]) continue;
    const c = actions[have].getClip().clone();
    c.name = want;
    const a = mixer.clipAction(c);
    if (!LOOPING.has(want)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[want] = a;
  }

  let current = null;
  let lockUntil = -1; // enquanto o mixer não passar daqui, chamadas "soft" não trocam a animação
  // from: começa o clipe a partir desse segundo; lock: segura a animação por N s contra chamadas soft
  function play(name, { fade = 0.25, timeScale = 1, restart = false, from = 0, lock = 0, soft = false } = {}) {
    const next = actions[name];
    if (!next) return null;
    if (soft && mixer.time < lockUntil && current !== next) return current;
    lockUntil = lock > 0 ? mixer.time + lock : -1;
    next.timeScale = timeScale;
    if (current === next && !restart) return next;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (from > 0) next.time = from;
    if (current && current !== next) current.fadeOut(fade);
    current = next;
    return next;
  }

  return {
    root,
    pivot,
    model,
    mixer,
    actions,
    speeds,
    play,
    bone,
    get current() { return current?.getClip().name; },
  };
}
