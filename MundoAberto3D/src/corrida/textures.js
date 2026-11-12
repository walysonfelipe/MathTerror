import * as THREE from 'three';

// Gerador pseudoaleatório com semente (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Desenha algo também nas cópias deslocadas, para a textura emendar sem costura
function wrapped(w, h, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy);
}

function blobs(g, w, h, R, n, rMin, rMax, colors) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rMin + R() * (rMax - rMin);
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    wrapped(w, h, (dx, dy) => {
      g.beginPath();
      g.ellipse(x + dx, y + dy, r, r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
    });
  }
}

// galho recursivo (árvores e arbustos mortos)
function branch(g, R, x, y, ang, len, width, depth) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + Math.cos(ang + 0.3) * len * 0.5, y + Math.sin(ang + 0.3) * len * 0.5, x2, y2);
  g.stroke();
  if (depth <= 0) return;
  const n = 2 + (R() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    branch(g, R, x2, y2, ang + (R() - 0.5) * 1.3, len * (0.55 + R() * 0.2), width * 0.62, depth - 1);
  }
}

export function makeTextures() {
  const R = rng(13);
  const tex = {};

  tex.sky = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#05040a');
    gr.addColorStop(0.5, '#151127');
    gr.addColorStop(0.8, '#2e1c36');
    gr.addColorStop(1, '#4a2230');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });

  tex.dirt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#35261d';
    g.fillRect(0, 0, w, h);
    blobs(g, w, h, R, 40, 4, 12, ['#2a1d16', '#403024', '#2f2119']);
    blobs(g, w, h, R, 10, 2, 4, ['#5a5048', '#1a120d']);
    // ossinhos enterrados
    for (let i = 0; i < 3; i++) {
      const x = 15 + R() * 98, y = 15 + R() * 98, a = R() * Math.PI;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = '#b9ae98';
      g.fillRect(-9, -2, 18, 4);
      for (const s of [-1, 1]) for (const t of [-1, 1]) { g.beginPath(); g.arc(s * 9, t * 2.5, 2.8, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  });

  tex.grassTop = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3b3a26';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const x = R() * w, y = R() * h;
      g.strokeStyle = ['#2c2b1b', '#4f4b2f', '#45402a'][Math.floor(R() * 3)];
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 6, y - 3 - R() * 5);
      g.stroke();
    }
  });

  // Faixa de grama seca da borda, com franja recortada (usa alphaTest)
  tex.lip = canvasTex(128, 64, (g, w) => {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#5e5a38');
    gr.addColorStop(1, '#23221a');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, 0);
    const n = 10, step = w / n;
    for (let i = n; i > 0; i--) {
      const x0 = i * step, x1 = (i - 1) * step;
      g.lineTo(x0, 28);
      g.lineTo((x0 + x1) / 2, 40 + (i % 3) * 8);
    }
    g.lineTo(0, 28);
    g.closePath();
    g.fill();
    g.fillStyle = '#7c7650';
    g.fillRect(0, 0, w, 4);
  });

  tex.brick = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#100d12';
    g.fillRect(0, 0, w, h);
    const rows = 4, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 32 : 0;
      for (let c = -1; c < 3; c++) {
        const x = c * 64 + off, y = r * bh;
        g.fillStyle = `hsl(270, 6%, ${24 + R() * 9}%)`;
        g.fillRect(x + 3, y + 3, 58, bh - 6);
        g.fillStyle = '#ffffff14';
        g.fillRect(x + 3, y + 3, 58, 3);
      }
    }
    // musgo e rachaduras
    blobs(g, w, h, R, 8, 3, 8, ['#2f4a24aa', '#3d5a2a99']);
    g.strokeStyle = '#08060a';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      let x = R() * w, y = R() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (R() - 0.5) * 20; y += 6 + R() * 8; g.lineTo(x, y); }
      g.stroke();
    }
  });

  const rivets = (g, w, color) => {
    g.fillStyle = color;
    for (const [x, y] of [[16, 16], [w - 16, 16], [16, w - 16], [w - 16, w - 16]]) {
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
  };

  // Bloco "?" amaldiçoado: brilha no escuro (também usado como emissiveMap)
  tex.qblock = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#1a0c06';
    g.fillRect(0, 0, w, w);
    const gr = g.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, 80);
    gr.addColorStop(0, '#e0741c');
    gr.addColorStop(1, '#6a2406');
    g.fillStyle = gr;
    g.fillRect(6, 6, w - 12, w - 12);
    rivets(g, w, '#2a1006');
    g.font = 'bold 86px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a0e04';
    g.fillText('?', w / 2 + 4, w / 2 + 8);
    g.fillStyle = '#ffe2a0';
    g.fillText('?', w / 2, w / 2 + 4);
  }, { repeat: false });

  tex.used = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#0d0a08';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#2e241e';
    g.fillRect(6, 6, w - 12, w - 12);
    rivets(g, w, '#0d0a08');
  }, { repeat: false });

  tex.stone = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#16171b';
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) {
      for (let c = -1; c < 2; c++) {
        const x = c * 64 + (r % 2) * 32, y = r * 64;
        g.fillStyle = `hsl(230, 6%, ${26 + R() * 8}%)`;
        g.fillRect(x + 3, y + 3, 58, 58);
        g.fillStyle = '#ffffff12';
        g.fillRect(x + 3, y + 3, 58, 4);
      }
    }
    blobs(g, w, h, R, 6, 3, 7, ['#2f4a2488']);
  });

  // ---------- sprites 2D (planos recortados) ----------
  tex.bush = canvasTex(256, 128, (g) => {
    g.strokeStyle = '#141011';
    for (let i = 0; i < 9; i++) {
      branch(g, R, 60 + R() * 136, 128, -Math.PI / 2 + (R() - 0.5) * 1.6, 30 + R() * 25, 6, 3);
    }
  }, { repeat: false });

  tex.tree = canvasTex(256, 384, (g) => {
    g.strokeStyle = '#110d0f';
    branch(g, R, 128, 384, -Math.PI / 2 + (R() - 0.5) * 0.2, 150, 26, 5);
  }, { repeat: false });

  tex.tree2 = canvasTex(256, 384, (g) => {
    g.strokeStyle = '#140f12';
    branch(g, R, 128, 384, -Math.PI / 2 - 0.15, 130, 22, 5);
    // galho grosso saindo do tronco, quase horizontal, para pendurar a corda
    g.strokeStyle = '#140f12';
    g.lineCap = 'round';
    const bx0 = 110, by0 = 286, bx1 = 214, by1 = 236;
    for (const [lw, t] of [[13, 0.55], [8, 0.85], [4, 1]]) {
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(bx0, by0);
      g.quadraticCurveTo(160, 252, bx0 + (bx1 - bx0) * t, by0 + (by1 - by0) * t - Math.sin(t * Math.PI) * 6);
      g.stroke();
    }
    // corda amarrada no galho (com voltas do nó) caindo reta até a forca
    const rx = 182, ry = 250;
    g.strokeStyle = '#7a6848';
    g.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      g.beginPath(); g.ellipse(rx + i * 3, ry, 2.2, 6, 0.2, 0, Math.PI * 2); g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(rx, ry + 5); g.lineTo(rx + 1, 322); g.stroke();
    g.fillStyle = '#7a6848';
    g.fillRect(rx - 3, 318, 8, 9); // nó da forca
    g.beginPath(); g.ellipse(rx + 1, 340, 10, 14, 0, 0, Math.PI * 2); g.stroke();
  }, { repeat: false });

  tex.cloud = canvasTex(256, 128, (g) => {
    for (let j = 0; j < 7; j++) {
      const x = 40 + j * 28, y = 70 + Math.sin(j * 1.7) * 14, r = 22 + (j % 3) * 8;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, '#4a4560cc');
      gr.addColorStop(1, '#2a263800');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });

  tex.tuft = canvasTex(128, 64, (g) => {
    for (let i = 0; i < 14; i++) {
      const x = 10 + R() * 108, hgt = 24 + R() * 34;
      g.fillStyle = ['#3b3824', '#55502f', '#262418'][Math.floor(R() * 3)];
      g.beginPath();
      g.moveTo(x - 5, 64);
      g.quadraticCurveTo(x + (R() - 0.5) * 24, 64 - hgt * 0.6, x + (R() - 0.5) * 18, 64 - hgt);
      g.lineTo(x + 5, 64);
      g.fill();
    }
  }, { repeat: false });


  // rosto de abóbora (fica na frente da esfera laranja)
  tex.pumpkinFace = canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffd25a';
    g.shadowColor = '#ff8a00';
    g.shadowBlur = 12;
    const tri = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.7); g.lineTo(x - s, y + s * 0.7); g.fill(); };
    tri(40, 50, 15);
    tri(88, 50, 15);
    g.beginPath();
    g.moveTo(24, 78);
    const pts = [[36, 92], [46, 82], [56, 96], [64, 84], [72, 96], [82, 82], [92, 92], [104, 78]];
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(96, 104); g.lineTo(32, 104);
    g.closePath(); g.fill();
  }, { repeat: false });

  tex.puff = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffffff');
    gr.addColorStop(0.6, '#ffffffaa');
    gr.addColorStop(1, '#ffffff00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }, { repeat: false });

  tex.mist = canvasTex(256, 64, (g) => {
    for (let i = 0; i < 12; i++) {
      const x = 30 + R() * 196, y = 30 + R() * 10, r = 20 + R() * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, '#ffffff66');
      gr.addColorStop(1, '#ffffff00');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 64);
    }
  }, { repeat: false });

  tex.moon = canvasTex(256, 256, (g) => {
    const glow = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    glow.addColorStop(0, '#e8e4ff55');
    glow.addColorStop(1, '#e8e4ff00');
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);
    const disc = g.createRadialGradient(115, 110, 5, 128, 128, 46);
    disc.addColorStop(0, '#fffdf2');
    disc.addColorStop(1, '#d8d2c0');
    g.fillStyle = disc;
    g.beginPath(); g.arc(128, 128, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b9b3a2aa';
    for (const [x, y, r] of [[110, 115, 9], [145, 140, 12], [132, 102, 5], [112, 150, 6]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });

  // ---------- camadas de parallax (emendam na horizontal) ----------
  const layer = (w, h, draw) => {
    const t = canvasTex(w, h, draw);
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };

  tex.stars = layer(1024, 256, (g, w, h) => {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`;
      const s = R() < 0.1 ? 2 : 1;
      g.fillRect(R() * w, R() * h, s, s);
    }
  });

  // ruído 1D periódico (emenda nas bordas da textura)
  const periodic = (W, octaves) => {
    const L = octaves.map(([cells, amp]) => ({ cells, amp, v: Array.from({ length: cells }, () => R()) }));
    const total = L.reduce((s, o) => s + o.amp, 0);
    return (x) => {
      let s = 0;
      for (const o of L) {
        const t = (((x / W) % 1 + 1) % 1) * o.cells;
        const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
        const a = o.v[i % o.cells], b = o.v[(i + 1) % o.cells];
        s += (a + (b - a) * u) * o.amp;
      }
      return s / total;
    };
  };

  // Cordilheira com castelo num rochedo e vila na encosta
  tex.mountains = layer(2048, 640, (g, w, h) => {
    const farN = periodic(w, [[3, 1], [7, 0.55], [17, 0.28], [43, 0.12], [110, 0.05]]);
    const nearN = periodic(w, [[4, 1], [9, 0.5], [23, 0.22], [61, 0.09], [160, 0.035]]);
    const CX = w * 0.3;             // castelo
    const VX = w * 0.68;            // vila
    const PLATEAU = 330;            // altura do rochedo do castelo
    const wrapD = (x, c) => { const d = Math.abs(x - c) % w; return Math.min(d, w - d); };

    const farH = (x) => 230 + Math.pow(farN(x), 1.5) * 420;
    const baseNear = (x) => 110 + Math.pow(nearN(x), 1.3) * 200;
    const nearH = (x) => {
      const d = wrapD(x, CX);
      if (d < 120) return PLATEAU + Math.sin(x * 0.35) * 1.5;      // topo plano do rochedo
      if (d < 175) {                                               // penhasco íngreme
        const t = (d - 120) / 55;
        return PLATEAU + (baseNear(x) - PLATEAU) * Math.pow(t, 0.55) + Math.sin(x * 0.9) * 6 * t;
      }
      // a vila fica numa encosta mais suave
      const dv = wrapD(x, VX);
      if (dv < 170) {
        const t = dv / 170, flat = 175 + (x - VX) * -0.12;
        return flat + (baseNear(x) - flat) * t * t;
      }
      return baseNear(x);
    };

    const ridge = (fn, fill, rim, haze) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) g.lineTo(x, h - fn(x));
      g.lineTo(w, h);
      g.fill();
      if (haze) {
        const gr = g.createLinearGradient(0, h - 380, 0, h);
        gr.addColorStop(0, '#00000000');
        gr.addColorStop(1, haze);
        g.fillStyle = gr;
        g.fill();
      }
      // borda iluminada pela lua
      g.strokeStyle = rim;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 2) x ? g.lineTo(x, h - fn(x)) : g.moveTo(x, h - fn(x));
      g.stroke();
    };

    ridge(farH, '#221d33', '#3d365a', '#2b2340cc');
    ridge(nearH, '#15121d', '#2f2943');

    const SIL = '#0d0b13';
    const lit = (x, y, ww, hh, arch = true) => {
      g.save();
      g.fillStyle = '#ffb347';
      g.shadowColor = '#ff9a30';
      g.shadowBlur = 10;
      g.fillRect(x, y + (arch ? ww / 2 : 0), ww, hh - (arch ? ww / 2 : 0));
      if (arch) { g.beginPath(); g.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, 0); g.fill(); }
      g.restore();
    };
    const merlons = (x0, x1, y, size = 7) => {
      for (let x = x0; x < x1 - 2; x += size * 1.8) g.fillRect(x, y - size, size, size + 1);
    };

    // ---------- castelo ----------
    const gy = h - PLATEAU;
    g.fillStyle = SIL;
    // base de pedra assentada no rochedo
    g.beginPath();
    g.moveTo(CX - 118, gy + 2); g.lineTo(CX - 104, gy - 14); g.lineTo(CX + 104, gy - 14); g.lineTo(CX + 118, gy + 2);
    g.fill();
    // muralha com ameias
    g.fillRect(CX - 100, gy - 50, 200, 40);
    merlons(CX - 100, CX + 100, gy - 50);
    // portão iluminado
    lit(CX - 9, gy - 34, 18, 22);
    // torres: [deslocamento, largura, altura, telhado]
    const towers = [[-100, 30, 92, 40], [100, 30, 80, 36], [-52, 24, 122, 46], [52, 22, 168, 62], [0, 60, 130, 0]];
    for (const [ox, tw, th, roof] of towers) {
      const x = CX + ox - tw / 2;
      g.fillStyle = SIL;
      g.fillRect(x, gy - 12 - th, tw, th);
      if (roof) {
        g.beginPath();
        g.moveTo(x - 5, gy - 12 - th + 2);
        g.lineTo(CX + ox, gy - 12 - th - roof);
        g.lineTo(x + tw + 5, gy - 12 - th + 2);
        g.fill();
      } else {
        merlons(x, x + tw, gy - 12 - th, 8);
        // torrinha no canto da torre de menagem
        g.fillRect(x + tw - 14, gy - 12 - th - 30, 14, 30);
        g.beginPath();
        g.moveTo(x + tw - 17, gy - 12 - th - 29); g.lineTo(x + tw - 7, gy - 12 - th - 52); g.lineTo(x + tw + 3, gy - 12 - th - 29);
        g.fill();
      }
      // janelas por andar (algumas acesas)
      for (let y = gy - 12 - th + 16; y < gy - 60; y += 24) {
        if (R() < 0.5) lit(CX + ox - 3, y, 6, 11);
      }
    }
    // estandarte na torre mais alta
    g.strokeStyle = SIL;
    g.lineWidth = 2;
    const fx = CX + 52, fy = gy - 12 - 168 - 62;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 22); g.stroke();
    g.fillStyle = '#6a0f12';
    g.beginPath(); g.moveTo(fx, fy - 22); g.lineTo(fx + 20, fy - 17); g.lineTo(fx, fy - 12); g.fill();

    // ---------- trilha com lampiões do portão até a vila ----------
    g.strokeStyle = '#2a2438';
    g.lineWidth = 2;
    g.beginPath();
    const path = [];
    for (let x = CX + 20; x <= VX - 60; x += 4) {
      const d = wrapD(x, CX);
      const y = d < 120 ? gy - 1 : h - nearH(x) + 10 + Math.sin(x * 0.03) * 6;
      path.push([x, y]);
    }
    path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    path.forEach(([x, y], i) => {
      if (i % 14 !== 7) return;
      g.save();
      g.fillStyle = '#ffcf70';
      g.shadowColor = '#ffa030';
      g.shadowBlur = 8;
      g.beginPath(); g.arc(x, y - 4, 1.8, 0, Math.PI * 2); g.fill();
      g.restore();
    });

    // ---------- vila na encosta ----------
    const house = (x, tw, th, roof, chimney) => {
      // apoia nos dois cantos e afunda a fundação no terreno
      const yl = h - nearH(x - tw / 2), yr = h - nearH(x + tw / 2);
      const base = Math.min(yl, yr) + 2;
      g.fillStyle = SIL;
      g.fillRect(x - tw / 2, base - th, tw, th + Math.abs(yl - yr) + 30);
      g.beginPath();
      g.moveTo(x - tw / 2 - 4, base - th + 1);
      g.lineTo(x, base - th - roof);
      g.lineTo(x + tw / 2 + 4, base - th + 1);
      g.fill();
      if (chimney) {
        g.fillRect(x + tw * 0.18, base - th - roof * 0.75, 5, roof * 0.6);
        // fumaça da chaminé
        for (let i = 0; i < 4; i++) {
          g.fillStyle = `rgba(70,62,92,${0.25 - i * 0.05})`;
          g.beginPath();
          g.ellipse(x + tw * 0.18 + 3 + i * 5, base - th - roof * 0.8 - 8 - i * 9, 4 + i * 2, 3 + i, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (R() < 0.75) lit(x - 3, base - th * 0.68, 6, 7, false);
      if (tw > 26 && R() < 0.6) lit(x + tw / 2 - 10, base - th * 0.68, 5, 7, false);
      return base;
    };
    // igreja com campanário e cruz
    const chx = VX + 80;
    const cb = house(chx, 34, 30, 18, false);
    g.fillStyle = SIL;
    g.fillRect(chx - 34, cb - 62, 16, 62);
    g.beginPath(); g.moveTo(chx - 37, cb - 61); g.lineTo(chx - 26, cb - 96); g.lineTo(chx - 15, cb - 61); g.fill();
    g.fillRect(chx - 27, cb - 110, 2, 14);
    g.fillRect(chx - 31, cb - 105, 10, 2);
    lit(chx - 29, cb - 52, 6, 10);
    // casas
    for (const [ox, tw, th, roof] of [[-150, 24, 18, 13], [-118, 30, 22, 15], [-80, 22, 16, 12], [-48, 28, 24, 16], [-12, 24, 18, 13], [28, 30, 20, 15], [130, 26, 18, 14], [165, 22, 16, 12]]) {
      house(VX + ox, tw, th, roof, R() < 0.6);
    }
  });

  const wave = (g, w, h, base, parts) => {
    const ys = [];
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      let y = base;
      for (const [k, a, ph] of parts) y += a * Math.sin((2 * Math.PI * k * x) / w + ph);
      ys.push(y);
      g.lineTo(x, h - y);
    }
    g.lineTo(w, h);
    g.fill();
    return (x) => ys[Math.min(ys.length - 1, Math.round(x / 4))];
  };

  tex.hills = layer(1024, 256, (g, w, h) => {
    g.fillStyle = '#1a1d22';
    wave(g, w, h, 150, [[2, 36, 0.3], [5, 18, 1.7]]);
    g.fillStyle = '#121518';
    const front = wave(g, w, h, 95, [[3, 28, 2.1], [7, 12, 0.9]]);
    // silhuetas: cruzes, lápides e árvores secas sobre a colina da frente
    g.fillStyle = '#121518';
    g.strokeStyle = '#121518';
    for (let i = 0; i < 26; i++) {
      const x = 8 + R() * (w - 16), y = h - front(x) + 2, r = R();
      if (r < 0.4) { g.fillRect(x - 1.5, y - 22, 3, 22); g.fillRect(x - 7, y - 16, 14, 3); }
      else if (r < 0.75) { g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 6, y - 12); g.arc(x, y - 12, 6, Math.PI, 0); g.lineTo(x + 6, y); g.fill(); }
      else branch(g, R, x, y, -Math.PI / 2, 26, 4, 3);
    }
  });

  tex.cloudsLayer = layer(1024, 256, (g, w) => {
    for (let i = 0; i < 7; i++) {
      const cx = i * (w / 7) + R() * 80, cy = 60 + R() * 140, s = 0.6 + R() * 0.8;
      wrapped(w, 0, (dx) => {
        for (let j = 0; j < 6; j++) {
          const x = cx + dx + (j - 2.5) * 30 * s, y = cy - (j % 2) * 8 * s, r = (34 - Math.abs(j - 2.5) * 5) * s;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, '#3a3550aa');
          gr.addColorStop(1, '#3a355000');
          g.fillStyle = gr;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
      });
    }
  });


  // =================== MUNDOS NOVOS ===================
  const skyGrad = (stops) => canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
  tex.skyForest = skyGrad([[0, '#010201'], [0.55, '#070d0a'], [0.85, '#121c15'], [1, '#1c2619']]);
  tex.skySwamp = skyGrad([[0, '#020304'], [0.5, '#0a1013'], [0.82, '#18201f'], [1, '#283028']]);

  // corpo pendurado (silhueta) preso num galho em (x, y)
  const hanged = (g, x, y, len, s = 1) => {
    g.lineWidth = 1.2 * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke();
    const by = y + len;
    g.beginPath(); g.arc(x, by + 4 * s, 4 * s, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 4 * s, by + 7 * s, 8 * s, 16 * s);
    g.fillRect(x - 4 * s, by + 22 * s, 3 * s, 14 * s);
    g.fillRect(x + 1 * s, by + 22 * s, 3 * s, 15 * s);
  };

  // Floresta dos Enforcados: paredão de árvores mortas com corpos nos galhos
  tex.forestFar = layer(2048, 640, (g, w, h) => {
    for (const [col, n, hMin, hMax, wid] of [['#0f1712', 70, 260, 520, 9], ['#0a100c', 46, 200, 420, 14]]) {
      g.fillStyle = col;
      g.strokeStyle = col;
      wave(g, w, h, 90, [[3, 20, 0.4], [9, 8, 1.1]]);
      for (let i = 0; i < n; i++) {
        const x = R() * w, th = hMin + R() * (hMax - hMin);
        const sd = (R() * 1e9) | 0, lean = (R() - 0.5) * 0.15;
        wrapped(w, 0, (dx) => {
          g.lineWidth = wid;
          branch(g, rng(sd), x + dx, h - 60, -Math.PI / 2 + lean, th * 0.45, wid, 4);
        });
        if (R() < 0.35) {
          const bx = x + (R() - 0.5) * 50, by = h - 60 - th * 0.55, len = 30 + R() * 50;
          wrapped(w, 0, (dx) => hanged(g, bx + dx, by, len, 1.3));
        }
      }
    }
  });
  tex.forestNear = layer(1024, 256, (g, w, h) => {
    g.fillStyle = '#060907';
    g.strokeStyle = '#060907';
    wave(g, w, h, 70, [[2, 18, 0.7], [6, 10, 2.2]]);
    for (let i = 0; i < 22; i++) {
      const x = R() * w;
      const sd = (R() * 1e9) | 0, a = -Math.PI / 2 + (R() - 0.5) * 0.3, len = 60 + R() * 70, wd = 10 + R() * 8;
      wrapped(w, 0, (dx) => branch(g, rng(sd), x + dx, h - 50, a, len, wd, 3));
      // raízes
      for (let k = 0; k < 3; k++) {
        const sk = (R() * 1e9) | 0, ra = R() < 0.5 ? 0.2 : Math.PI - 0.2, rl = 20 + R() * 20;
        wrapped(w, 0, (dx) => branch(g, rng(sk), x + dx, h - 55, ra, rl, 5, 1));
      }
    }
  });
  tex.forestDirt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1c1612';
    g.fillRect(0, 0, w, h);
    blobs(g, w, h, R, 40, 4, 12, ['#15100c', '#241c15', '#1a130e']);
    g.strokeStyle = '#2e2218';
    for (let i = 0; i < 6; i++) {
      const x = R() * w, y = R() * h, sd = (R() * 1e9) | 0, a = R() * 6, len = 18 + R() * 16;
      wrapped(w, h, (dx, dy) => branch(g, rng(sd), x + dx, y + dy, a, len, 3, 1));
    }
  });
  tex.forestTop = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#241a12';
    g.fillRect(0, 0, w, h);
    blobs(g, w, h, R, 160, 2, 5, ['#3a2414', '#4a2c12', '#2a1c10', '#5a3010', '#1a120a']);
  });

  // Pântano Afogado: horizonte baixo, água parada, capela em ruínas ao longe
  tex.swampFar = layer(2048, 640, (g, w, h) => {
    g.fillStyle = '#141b1b';
    const far = wave(g, w, h, 120, [[2, 22, 0.2], [7, 9, 1.4]]);
    g.strokeStyle = '#141b1b';
    for (let i = 0; i < 26; i++) {
      const x = R() * w, sd = (R() * 1e9) | 0, a = -Math.PI / 2 + (R() - 0.5) * 0.5, len = 50 + R() * 80;
      wrapped(w, 0, (dx) => branch(g, rng(sd), x + dx, h - far(x) + 4, a, len, 5, 3));
    }
    // capela torta
    const cx = w * 0.55, cy = h - far(w * 0.55);
    g.beginPath();
    g.moveTo(cx - 40, cy); g.lineTo(cx - 40, cy - 70); g.lineTo(cx - 5, cy - 120); g.lineTo(cx + 34, cy - 66); g.lineTo(cx + 36, cy);
    g.fill();
    g.fillRect(cx - 12, cy - 170, 12, 60);
    g.fillRect(cx - 24, cy - 158, 36, 8);
    g.fillStyle = '#3a2a10';
    g.fillRect(cx - 6, cy - 60, 10, 16); // janela com luz fraca
    // espelho d'água
    g.fillStyle = '#1e2828';
    g.fillRect(0, h - 70, w, 4);
    g.fillStyle = '#0c1212';
    g.fillRect(0, h - 66, w, 66);
  });
  tex.swampNear = layer(1024, 256, (g, w, h) => {
    g.fillStyle = '#070a09';
    g.strokeStyle = '#070a09';
    const front = wave(g, w, h, 60, [[3, 10, 0.5], [8, 5, 2.0]]);
    // juncos e cruzes afundadas
    for (let i = 0; i < 160; i++) {
      const x = R() * w, y = h - front(x) + 3, len = 18 + R() * 40;
      g.lineWidth = 2;
      const bend = (R() - 0.5) * 14;
      wrapped(w, 0, (dx) => { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + 4, y - len / 2, x + dx + bend, y - len); g.stroke(); });
    }
    for (let i = 0; i < 10; i++) {
      const x = R() * w, y = h - front(x) + 6, a = (R() - 0.5) * 0.6;
      wrapped(w, 0, (dx) => {
        g.save(); g.translate(x + dx, y); g.rotate(a);
        g.fillRect(-2, -30, 4, 30); g.fillRect(-10, -24, 20, 4);
        g.restore();
      });
    }
  });
  tex.mud = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1a1c14';
    g.fillRect(0, 0, w, h);
    blobs(g, w, h, R, 40, 5, 14, ['#14160f', '#22241a', '#1c1a12']);
    blobs(g, w, h, R, 8, 4, 9, ['#0e1412', '#2a2c22']);
  });
  tex.mudTop = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1e2616';
    g.fillRect(0, 0, w, h);
    blobs(g, w, h, R, 120, 2, 7, ['#2a3418', '#151c10', '#334020', '#1a1a10']);
  });
  return tex;
}
