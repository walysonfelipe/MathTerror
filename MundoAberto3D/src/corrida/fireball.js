import * as THREE from 'three';

/**
 * Peças visuais do poder:
 * - material de bola de fogo (shader com ruído fbm, deslocamento de vértices e fresnel)
 * - rastro em fita (ribbon) com gradiente e cintilação
 * - texturas: círculo rúnico com símbolos matemáticos, estrela de raios e marca de queimado
 */

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

const FIRE_VERT = /* glsl */ `
  uniform float time;
  uniform float disp;
  uniform float freq;
  uniform vec3 flow;
  varying vec3 vN;
  varying vec3 vView;
  varying float vNoise;
  ${NOISE}
  void main() {
    float n = fbm(normal * freq + flow * time);
    vNoise = n;
    // chamas se esticam para trás (direção do fluxo)
    float tail = max(0.0, dot(normal, normalize(flow))) * 0.9;
    vec3 p = position + normal * (n - 0.35) * disp * (1.0 + tail * 1.6);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const FIRE_FRAG = /* glsl */ `
  uniform vec3 cHot;
  uniform vec3 cMid;
  uniform vec3 cCool;
  uniform float alpha;
  uniform float hotBias;
  varying vec3 vN;
  varying vec3 vView;
  varying float vNoise;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vView)));
    float heat = clamp(vNoise * 1.7 - 0.3 + hotBias - f * 0.8, 0.0, 1.0);
    vec3 col = mix(cCool, cMid, smoothstep(0.0, 0.45, heat));
    col = mix(col, cHot, smoothstep(0.5, 0.95, heat));
    float a = alpha * (0.25 + heat) * (1.0 - pow(f, 2.5) * 0.85);
    gl_FragColor = vec4(col, a);
  }
`;

export function createFireMaterial({
  disp = 0.3, freq = 2.6, hotBias = 0.2, alpha = 0.9,
  hot = 0xfff3c4, mid = 0xff7a1a, cool = 0x8a0e04,
} = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FIRE_VERT,
    fragmentShader: FIRE_FRAG,
    uniforms: {
      time: { value: Math.random() * 10 },
      disp: { value: disp },
      freq: { value: freq },
      flow: { value: new THREE.Vector3(0, 1.5, 0) },
      hotBias: { value: hotBias },
      alpha: { value: alpha },
      cHot: { value: new THREE.Color(hot) },
      cMid: { value: new THREE.Color(mid) },
      cCool: { value: new THREE.Color(cool) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------- rastro em fita ----------
const TRAIL_VERT = /* glsl */ `
  attribute float along;
  attribute float side;
  varying float vAlong;
  varying float vSide;
  void main() {
    vAlong = along;
    vSide = side;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRAIL_FRAG = /* glsl */ `
  uniform float time;
  uniform float fade;
  uniform vec3 cHead;
  uniform vec3 cTail;
  varying float vAlong;
  varying float vSide;
  void main() {
    float edge = 1.0 - vSide * vSide;
    float flick = 0.75 + 0.25 * sin(vAlong * 38.0 - time * 45.0);
    float a = pow(1.0 - vAlong, 1.6) * edge * flick * fade;
    vec3 col = mix(cHead, cTail, smoothstep(0.0, 0.8, vAlong));
    gl_FragColor = vec4(col, a);
  }
`;

export function createTrail(scene, { points = 24, width = 0.42, head = 0xffe6a0, tail = 0xc81a04 } = {}) {
  const N = points;
  const pos = new Float32Array(N * 2 * 3);
  const along = new Float32Array(N * 2);
  const side = new Float32Array(N * 2);
  const index = [];
  for (let i = 0; i < N; i++) {
    along[i * 2] = along[i * 2 + 1] = i / (N - 1);
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < N - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FRAG,
    uniforms: {
      time: { value: 0 }, fade: { value: 1 },
      cHead: { value: new THREE.Color(head) }, cTail: { value: new THREE.Color(tail) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  scene.add(mesh);

  const hist = [];

  function push(x, y, z) {
    hist.unshift([x, y, z]);
    if (hist.length > N) hist.pop();
  }

  function update(time) {
    mat.uniforms.time.value = time;
    const n = hist.length;
    for (let i = 0; i < N; i++) {
      const p = hist[Math.min(i, n - 1)] || [0, 0, 0];
      const a = hist[Math.max(0, Math.min(i - 1, n - 1))] || p;
      const b = hist[Math.min(i + 1, n - 1)] || p;
      let tx = a[0] - b[0], ty = a[1] - b[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const w = width * Math.pow(1 - i / (N - 1), 0.6) * 0.5;
      pos[i * 6] = p[0] - ty * w; pos[i * 6 + 1] = p[1] + tx * w; pos[i * 6 + 2] = p[2];
      pos[i * 6 + 3] = p[0] + ty * w; pos[i * 6 + 4] = p[1] - tx * w; pos[i * 6 + 5] = p[2];
    }
    geo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
  }

  return { push, update, dispose, mat, get length() { return hist.length; }, last: () => hist[0] };
}

// ---------- texturas ----------
function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// círculo mágico com símbolos matemáticos (tema do MathTerror)
export function makeRuneTexture() {
  return canvasTexture(512, (g, S) => {
    const c = S / 2;
    g.translate(c, c);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 14;
    const circle = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    circle(238, 7);
    circle(224, 2);
    circle(168, 4);
    circle(92, 3);
    circle(30, 3);
    // marcas de régua entre os anéis
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, l = i % 6 === 0 ? 14 : 6;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 224, Math.sin(a) * 224);
      g.lineTo(Math.cos(a) * (224 - l), Math.sin(a) * (224 - l));
      g.stroke();
    }
    // símbolos
    const sym = ['∑', 'π', '√', '∞', '∫', 'Δ', 'θ', '±', '÷', '×', 'φ', 'λ'];
    g.font = 'bold 38px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    sym.forEach((s, i) => {
      const a = (i / sym.length) * Math.PI * 2;
      g.save();
      g.rotate(a);
      g.translate(0, -192);
      g.fillText(s, 0, 0);
      g.restore();
    });
    // hexagrama
    g.lineWidth = 3.5;
    for (const off of [0, Math.PI]) {
      g.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = off - Math.PI / 2 + (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 166, y = Math.sin(a) * 166;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * 166, Math.sin(a) * 166, 9, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function makeStarTexture() {
  return canvasTexture(256, (g, S) => {
    const c = S / 2;
    g.translate(c, c);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, c);
    glow.addColorStop(0, '#ffffffff');
    glow.addColorStop(0.15, '#ffffff99');
    glow.addColorStop(1, '#ffffff00');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.1, l = i % 2 ? c * 0.6 : c;
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(Math.cos(a - 0.07) * 8, Math.sin(a - 0.07) * 8);
      g.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      g.lineTo(Math.cos(a + 0.07) * 8, Math.sin(a + 0.07) * 8);
      g.fill();
    }
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, c * 0.35, 0, Math.PI * 2);
    g.fill();
  });
}

export function makeScorchTexture() {
  return canvasTexture(256, (g, S) => {
    const c = S / 2;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * c * 0.45, r = c * (0.25 + Math.random() * 0.35);
      const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, '#000000aa');
      gr.addColorStop(1, '#00000000');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
    // brasas no centro
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * c * 0.4;
      g.fillStyle = `rgba(255,${80 + Math.random() * 90},20,${0.5 + Math.random() * 0.5})`;
      g.beginPath();
      g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}
