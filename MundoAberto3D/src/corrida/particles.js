import * as THREE from 'three';

/**
 * Sistema de partículas em GPU (um único THREE.Points por modo de mistura).
 * - "glow": mistura aditiva (fogo, faíscas, almas)
 * - "smoke": mistura normal (fumaça escura)
 * Cada partícula interpola cor, tamanho e opacidade ao longo da vida.
 */

const VERT = /* glsl */ `
  attribute float size;
  attribute vec4 rgba;
  varying vec4 vColor;
  uniform float scale;
  void main() {
    vColor = rgba;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec4 vColor;
  uniform float softness;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, softness);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }
`;

function createSystem(max, blending, softness) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const rgba = new Float32Array(max * 4);
  const size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('rgba', new THREE.BufferAttribute(rgba, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { scale: { value: 500 }, softness: { value: softness } },
    transparent: true,
    depthWrite: false,
    blending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;

  // estado de simulação
  const vel = new Float32Array(max * 3);
  const c0 = new Float32Array(max * 3);
  const c1 = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const age = new Float32Array(max).fill(1e9);
  const s0 = new Float32Array(max);
  const s1 = new Float32Array(max);
  const a0 = new Float32Array(max);
  const drag = new Float32Array(max);
  const grav = new Float32Array(max);
  let next = 0;
  let alive = 0;

  function emit(p) {
    const i = next;
    next = (next + 1) % max;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    vel[i * 3] = p.vx || 0; vel[i * 3 + 1] = p.vy || 0; vel[i * 3 + 2] = p.vz || 0;
    const from = p.color, to = p.colorEnd || p.color;
    c0[i * 3] = from[0]; c0[i * 3 + 1] = from[1]; c0[i * 3 + 2] = from[2];
    c1[i * 3] = to[0]; c1[i * 3 + 1] = to[1]; c1[i * 3 + 2] = to[2];
    life[i] = p.life;
    age[i] = 0;
    s0[i] = p.size;
    s1[i] = p.sizeEnd ?? 0;
    a0[i] = p.alpha ?? 1;
    drag[i] = p.drag ?? 0;
    grav[i] = p.gravity ?? 0;
  }

  function update(dt) {
    alive = 0;
    for (let i = 0; i < max; i++) {
      if (age[i] >= life[i]) {
        if (size[i] !== 0) size[i] = 0;
        continue;
      }
      alive++;
      age[i] += dt;
      const t = Math.min(1, age[i] / life[i]);
      const k = Math.exp(-drag[i] * dt);
      const j = i * 3;
      vel[j] *= k; vel[j + 1] = vel[j + 1] * k - grav[i] * dt; vel[j + 2] *= k;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      rgba[i * 4] = c0[j] + (c1[j] - c0[j]) * t;
      rgba[i * 4 + 1] = c0[j + 1] + (c1[j + 1] - c0[j + 1]) * t;
      rgba[i * 4 + 2] = c0[j + 2] + (c1[j + 2] - c0[j + 2]) * t;
      // entra rápido, some suave
      rgba[i * 4 + 3] = a0[i] * Math.min(1, t * 10) * (1 - t) * (1 - t);
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.rgba.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }

  function clear() {
    age.fill(1e9);
    size.fill(0);
    geo.attributes.size.needsUpdate = true;
  }

  return { points, emit, update, clear, mat, get alive() { return alive; } };
}

export function createParticles(scene) {
  const glow = createSystem(2500, THREE.AdditiveBlending, 1.6);
  const smoke = createSystem(800, THREE.NormalBlending, 1.2);
  smoke.points.renderOrder = 9;
  scene.add(smoke.points, glow.points);

  function resize(renderer, camera) {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    glow.mat.uniforms.scale.value = s;
    smoke.mat.uniforms.scale.value = s;
  }

  return {
    glow: glow.emit,
    smoke: smoke.emit,
    update(dt) { glow.update(dt); smoke.update(dt); },
    clear() { glow.clear(); smoke.clear(); },
    resize,
  };
}
