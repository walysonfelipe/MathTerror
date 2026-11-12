import * as THREE from 'three';

// Shaders e texturas compartilhados pela fenda da trilha e pela cripta da conta.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// redemoinho de sangue com um olho no meio, que olha para o jogador e pisca
export function makeVortexMaterial(a = 0x2a0002, b = 0xc01208) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) },
      uPower: { value: 1 }, uLook: { value: new THREE.Vector2() }, uEye: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower, uEye;
      uniform vec3 uA, uB;
      uniform vec2 uLook;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float s = sin(ang * 4.0 - r * 13.0 + uTime * 2.6) * 0.5 + 0.5;
        float s2 = sin(ang * 7.0 + r * 21.0 - uTime * 1.7) * 0.5 + 0.5;
        vec3 col = mix(uA, uB, pow(s * s2, 1.6)) * (0.35 + r * 0.9);
        // veias escuras
        col *= 0.75 + 0.25 * sin(ang * 23.0 + sin(r * 30.0 - uTime) * 1.5);
        // olho: pálpebra que abre e fecha (uEye), íris vermelha, pupila em fenda
        float lid = 0.42 * uEye;
        vec2 q = p / vec2(0.62, max(lid, 0.001));
        float eye = 1.0 - smoothstep(0.92, 1.0, length(q));
        vec2 e = p - uLook * 0.12;
        float iris = 1.0 - smoothstep(0.24, 0.27, length(e));
        float fib = 0.6 + 0.4 * sin(atan(e.y, e.x) * 30.0);
        vec3 eyeCol = mix(vec3(0.85, 0.78, 0.62), mix(vec3(0.9, 0.25, 0.02), vec3(1.0, 0.75, 0.1), length(e) * 3.0) * fib, iris);
        float pupil = 1.0 - smoothstep(0.035, 0.05, abs(e.x) + pow(abs(e.y), 2.0) * 0.6);
        eyeCol = mix(eyeCol, vec3(0.0), pupil * iris);
        eyeCol *= 1.0 - smoothstep(0.5, 1.0, length(q)) * 0.6;
        col = mix(col, eyeCol, eye);
        float alpha = smoothstep(1.0, 0.86, r);
        gl_FragColor = vec4(col * uPower, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// túnel de viagem: uma garganta de carne, com anéis escuros passando pela câmera
export function makeTunnelMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float u = vUv.x, v = vUv.y;
        float twist = sin(u * 6.2831 * 2.0 + uTime * 0.8) * 1.4;
        float rib = sin(v * 90.0 - uTime * 30.0 + twist);
        float ribs = smoothstep(0.2, 1.0, rib);
        float vein = smoothstep(0.92, 1.0, sin(u * 6.2831 * 9.0 + sin(v * 40.0 + uTime) * 2.0));
        vec3 flesh = mix(vec3(0.12, 0.0, 0.01), vec3(0.55, 0.04, 0.03), ribs);
        flesh += vein * vec3(0.35, 0.02, 0.02);
        float flick = 0.85 + 0.15 * sin(uTime * 23.0);
        vec3 col = flesh * flick;
        col *= smoothstep(0.0, 0.1, v) * 0.7 + 0.3;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// símbolo em brasa (+ − × ÷) que orbita a fenda
const glyphCache = new Map();
export function glyphTexture(ch, color = '#ff2a10') {
  const key = ch + color;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 92px "Cinzel", Georgia, serif';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = '#ffb8a0';
  g.fillText(ch, 64, 70);
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glyphCache.set(key, t);
  return t;
}
