// Efeitos sonoros sintetizados (WebAudio), estilo 8-bit
export function createSfx() {
  let ctx = null;
  let master = null;

  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      setTimeout(() => loadSteps(), 0); // já carrega os passos
    }
    ctx.resume();
  }

  function tone(freq, dur, { type = 'square', vol = 0.07, slide = 0, delay = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // trovão: ruído grave filtrado
  function thunder(vol = 0.5) {
    if (!ctx) return;
    const dur = 2.2, n = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(lp).connect(g).connect(master);
    src.start();
  }

  // ruído filtrado com varredura de frequência (whoosh, explosão)
  function noise(dur, { type = 'lowpass', f0 = 800, f1 = 200, q = 1, vol = 0.4, attack = 0.005, delay = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  // ---------- sons de ambiente (arquivos em public/sounds) ----------
  const base = import.meta.env.BASE_URL + 'sounds/';
  const clips = {};
  function clip(name, { loop = false, volume = 0.5 } = {}) {
    if (!clips[name]) {
      const a = new Audio(base + name + '.mp3');
      a.loop = loop;
      a.preload = 'auto';
      clips[name] = a;
    }
    clips[name].volume = volume;
    return clips[name];
  }
  // clipes soltos em andamento (para cortar tudo na morte)
  const active = new Set();
  const solos = {};
  // clipes longos demais para o momento em que tocam: corta com fade
  const MAX_DUR = { respiracao: 6, pedra: 1.6, revelacao: 6, sumico: 2.4, tensao: 4.5, erro: 1.4, asas: 2.5 };
  // clipes que não devem se sobrepor a si mesmos
  const SOLO = new Set(['respiracao', 'tensao', 'sussurros']);

  function fadeTo(a, target, ms = 400, then) {
    clearInterval(a._fade);
    const v0 = a.volume, steps = Math.max(1, Math.round(ms / 40));
    let i = 0;
    a._fade = setInterval(() => {
      i++;
      a.volume = Math.max(0, Math.min(1, v0 + (target - v0) * (i / steps)));
      if (i >= steps) { clearInterval(a._fade); then?.(); }
    }, 40);
  }
  function fadeOutClip(a, ms = 400) {
    for (const k in solos) if (solos[k] === a) delete solos[k]; // libera o "solo" já
    fadeTo(a, 0, ms, () => { a.pause(); active.delete(a); });
  }

  function playClip(name, volume = 0.5, { rate = 1, maxDur = MAX_DUR[name] } = {}) {
    if (!ctx) return null;
    if (SOLO.has(name) && solos[name] && !solos[name].paused && !solos[name].ended) return null;
    const a = clip(name).cloneNode();
    a.volume = volume;
    if (rate !== 1) { a.preservesPitch = false; a.playbackRate = rate; }
    a._t0 = performance.now();
    active.add(a);
    a.addEventListener('ended', () => active.delete(a));
    a.play().catch(() => {});
    if (SOLO.has(name)) solos[name] = a;
    if (maxDur) setTimeout(() => active.has(a) && fadeOutClip(a, 500), maxDur * 1000);
    return a;
  }
  function stopAllClips(ms = 300) {
    // poupa o que acabou de começar (ex.: o baque da queda nos espinhos, que toca junto com a morte)
    const now = performance.now();
    for (const a of active) if (now - a._t0 > 500) fadeOutClip(a, ms);
  }
  // loop de um clipe (batimento na cripta) com fade de saída
  function loopClip(name, volume = 0.5) {
    if (!ctx) return;
    const a = clip(name, { loop: true, volume });
    a.loop = true;
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  }
  function stopClip(name) {
    const a = clips[name];
    if (!a) return;
    const v0 = a.volume;
    let k = 1;
    const id = setInterval(() => {
      k -= 0.1;
      if (k <= 0) { clearInterval(id); a.pause(); a.volume = v0; return; }
      a.volume = v0 * k;
    }, 40);
  }
  const AMBIENCE = [['ambiente-noite', 0.45, 1], ['vento', 0.22, 2]]; // [clipe, volume, quanto abafa]
  function startAmbience() {
    for (const [name, volume] of AMBIENCE) {
      clip(name, { loop: true, volume }).play().catch(() => {});
    }
  }
  // 1 = ao ar livre; 0.3 = dentro do castelo/cripta (vento quase some); 0 = silêncio
  function ambience(k, ms = 1200) {
    for (const [name, volume, pow] of AMBIENCE) {
      const a = clips[name];
      if (a) fadeTo(a, volume * Math.pow(k, pow), ms);
    }
  }

  // passos: gravações reais (Kenney Impact Sounds, CC0), 5 variações por chão
  // surface: 'terra' | 'lama' | 'madeira' | 'pedra' (lama = terra mais grave e abafada)
  const STEP_FILES = { terra: 'terra', lama: 'terra', madeira: 'madeira', pedra: 'pedra' };
  const stepBufs = {};
  let stepsLoading = false;
  function loadSteps() {
    if (stepsLoading || !ctx) return;
    stepsLoading = true;
    for (const name of new Set(Object.values(STEP_FILES))) {
      stepBufs[name] = [];
      for (let i = 0; i < 5; i++) {
        fetch(base + 'passos/' + name + '_' + i + '.mp3')
          .then((r) => r.arrayBuffer())
          .then((ab) => ctx.decodeAudioData(ab))
          .then((buf) => stepBufs[name].push(buf))
          .catch(() => {});
      }
    }
  }
  let lastStep = -1;
  function footstep(surface = 'terra', k = 1) {
    if (!ctx) return;
    loadSteps();
    const list = stepBufs[STEP_FILES[surface] ?? 'terra'];
    if (!list?.length) return;
    let i = Math.floor(Math.random() * list.length);
    if (i === lastStep && list.length > 1) i = (i + 1) % list.length; // nunca o mesmo duas vezes
    lastStep = i;
    const src = ctx.createBufferSource();
    src.buffer = list[i];
    const lama = surface === 'lama';
    src.playbackRate.value = (lama ? 0.82 : 1) * (0.93 + Math.random() * 0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lama ? 1400 : 6000;
    const g = ctx.createGain();
    g.gain.value = 0.55 * k * (0.85 + Math.random() * 0.3);
    src.connect(f).connect(g).connect(master);
    src.start();
  }
  let stepPhase = 0;
  function steps(speed, dt = 0, surface = 'terra') {
    if (!ctx || speed < 0.6) { stepPhase = 0.6; return; } // parado: o próximo passo sai logo
    stepPhase += dt * (1.6 + speed * 0.17); // andar ≈ 2,4 passos/s, correr ≈ 3,5
    if (stepPhase >= 1) {
      stepPhase -= 1;
      footstep(surface, Math.min(1, 0.55 + speed * 0.045));
    }
  }

  return {
    unlock,
    /** tela de carregamento: deixa os clipes criados e bufferizados */
    preloadClips(names) { for (const n of names) clip(n).load(); },
    thunder,
    cast: () => {
      noise(0.4, { type: 'bandpass', f0: 500, f1: 2600, q: 1.2, vol: 0.35, attack: 0.03 });
      tone(240, 0.3, { type: 'sine', slide: 0.4, vol: 0.12 });
      tone(720, 0.12, { type: 'triangle', slide: 1.6, vol: 0.04 });
    },
    boom: (big = 1) => {
      noise(0.9 * big + 0.2, { type: 'lowpass', f0: 1400, f1: 90, q: 0.7, vol: 0.55 * big + 0.15 });
      noise(0.25, { type: 'highpass', f0: 3000, f1: 1200, vol: 0.12 * big });
      tone(70, 0.5, { type: 'sine', slide: 0.5, vol: 0.35 * big });
      // estalos do fogo depois da explosão
      for (let i = 0; i < 6; i++) noise(0.05, { type: 'highpass', f0: 2500, f1: 1800, vol: 0.06 * big, delay: 0.15 + Math.random() * 0.7 });
    },
    empty: () => tone(140, 0.08, { type: 'square', vol: 0.04 }),
    impale: () => {
      tone(55, 0.6, { type: 'sine', slide: 0.6, vol: 0.5 });                     // baque surdo
      noise(0.35, { type: 'lowpass', f0: 900, f1: 120, vol: 0.5 });              // corpo caindo
      noise(0.18, { type: 'bandpass', f0: 2400, f1: 900, q: 6, vol: 0.12, delay: 0.02 }); // metal rasgando
      tone(1180, 0.5, { type: 'triangle', slide: 0.92, vol: 0.05, delay: 0.03 });  // espinho vibrando
      tone(1760, 0.35, { type: 'sine', slide: 0.95, vol: 0.03, delay: 0.03 });
      playClip('queda', 0.6);
    },
    charge: () => {
      tone(180, 0.22, { type: 'sawtooth', slide: 3.2, vol: 0.035 });
      tone(360, 0.22, { type: 'sine', slide: 2.5, vol: 0.06 });
      noise(0.22, { type: 'bandpass', f0: 300, f1: 1800, q: 3, vol: 0.12, attack: 0.15 });
    },
    recharge: () => { tone(880, 0.08, { type: 'sine', vol: 0.03 }); tone(1320, 0.12, { type: 'sine', vol: 0.025, delay: 0.05 }); },
    // ----- fenda e cripta da conta -----
    portal: () => {
      noise(1.4, { type: 'lowpass', f0: 120, f1: 1400, q: 3, vol: 0.45, attack: 0.6 });
      tone(55, 1.4, { type: 'sawtooth', slide: 0.5, vol: 0.08 });
      tone(58, 1.4, { type: 'sine', slide: 0.45, vol: 0.2 });
    },
    // acorde dissonante quando a conta aparece
    gateAppear: () => [220, 233, 311].forEach((f, i) => tone(f, 1.4, { type: 'sine', delay: i * 0.05, vol: 0.05 })),
    gatePlace: () => noise(0.3, { type: 'bandpass', f0: 300, f1: 1200, q: 3, vol: 0.18, attack: 0.03 }),
    gateTick: () => { tone(70, 0.18, { type: 'triangle', vol: 0.35 }); noise(0.12, { type: 'lowpass', f0: 900, f1: 200, vol: 0.2 }); },
    gateUndo: () => tone(300, 0.15, { type: 'triangle', slide: 0.5, vol: 0.06 }),
    // menor descendente: alívio sombrio
    gateOk: () => [659, 523, 440, 330].forEach((f, i) => tone(f, 0.6, { type: 'triangle', delay: i * 0.12, vol: 0.08 })),
    gateBad: () => {
      tone(98, 0.6, { type: 'sawtooth', slide: 0.5, vol: 0.09 });
      tone(104, 0.6, { type: 'sawtooth', slide: 0.5, vol: 0.07 });
      playClip('erro', 0.35);
    },
    rumble: () => { noise(1.8, { type: 'lowpass', f0: 280, f1: 40, vol: 0.6, attack: 0.25 }); tone(41, 1.6, { type: 'sine', vol: 0.32 }); },
    warp: () => {
      noise(2.5, { type: 'lowpass', f0: 100, f1: 2500, q: 4, vol: 0.5, attack: 1.2 });
      tone(45, 2.4, { type: 'sawtooth', slide: 3, vol: 0.06 });
      tone(90, 2.4, { type: 'sine', slide: 0.5, vol: 0.15 });
    },
    loopClip,
    stopClip,
    // ----- mundos -----
    trap: () => {
      noise(0.12, { type: 'highpass', f0: 5000, f1: 2500, vol: 0.35 });
      tone(1900, 0.35, { type: 'square', slide: 0.97, vol: 0.03 });
      tone(90, 0.2, { type: 'triangle', vol: 0.3 });
    },
    splash: () => {
      noise(0.6, { type: 'lowpass', f0: 2400, f1: 300, vol: 0.4, attack: 0.01 });
      noise(0.3, { type: 'bandpass', f0: 900, f1: 500, q: 2, vol: 0.15, delay: 0.1 });
    },
    oil: () => [330, 392, 494].forEach((f, i) => tone(f, 0.12, { type: 'sine', delay: i * 0.06, vol: 0.07 })),
    drop: () => { noise(0.25, { type: 'bandpass', f0: 3000, f1: 800, q: 4, vol: 0.12 }); tone(220, 0.3, { type: 'sawtooth', slide: 0.4, vol: 0.04 }); },
    creak: () => tone(180, 0.6, { type: 'sawtooth', slide: 0.7, vol: 0.03 }),
    playClip,
    stopAllClips,
    startAmbience,
    ambience,
    steps,
    // sopro curto de impulso (nada de "boing")
    jump: () => {
      noise(0.2, { type: 'bandpass', f0: 350, f1: 1100, q: 1.4, vol: 0.12, attack: 0.03 });
      tone(140, 0.16, { type: 'sine', slide: 1.4, vol: 0.05 });
    },
    // moeda velha: tilintar metálico seco
    coin: () => {
      noise(0.03, { type: 'highpass', f0: 6000, f1: 4000, vol: 0.12 });
      tone(2093, 0.05, { type: 'triangle', vol: 0.035 });
      tone(3140, 0.35, { type: 'sine', slide: 0.985, vol: 0.022, delay: 0.025 });
      tone(4410, 0.2, { type: 'sine', slide: 0.99, vol: 0.01, delay: 0.025 });
    },
    // pisão: algo se esmagando
    stomp: () => {
      noise(0.28, { type: 'lowpass', f0: 700, f1: 80, vol: 0.5 });
      noise(0.06, { type: 'bandpass', f0: 1800, f1: 900, q: 3, vol: 0.15 });
      tone(70, 0.22, { type: 'sine', slide: 0.5, vol: 0.3 });
    },
    // cabeçada em bloco / algo batendo no chão: toque surdo
    bump: () => {
      tone(120, 0.1, { type: 'triangle', vol: 0.2 });
      noise(0.08, { type: 'lowpass', f0: 600, f1: 150, vol: 0.2 });
    },
    // aterrissagem de um pulo alto: baque na terra (k = força)
    land: (k = 1) => {
      noise(0.16, { type: 'lowpass', f0: 500, f1: 60, vol: 0.18 + 0.25 * k });
      tone(58, 0.14, { type: 'sine', slide: 0.6, vol: 0.1 + 0.15 * k });
    },
    // tábua encaixando: madeira batendo
    wood: () => {
      noise(0.12, { type: 'bandpass', f0: 420, f1: 260, q: 2.5, vol: 0.35 });
      tone(118, 0.18, { type: 'triangle', slide: 0.8, vol: 0.18 });
      noise(0.05, { type: 'highpass', f0: 2500, f1: 1500, vol: 0.06, delay: 0.02 });
    },
    // pedaço da Chave do Corvo: metal pesado + acorde grave que ressoa
    keyPiece: () => {
      noise(0.08, { type: 'bandpass', f0: 2600, f1: 1800, q: 8, vol: 0.25 });
      tone(1568, 1.2, { type: 'sine', slide: 0.995, vol: 0.025, delay: 0.02 });
      [147, 175, 220, 294].forEach((f, i) => tone(f, 2.2, { type: 'triangle', delay: 0.1 + i * 0.09, vol: 0.06 }));
      playClip('sino', 0.5);
      playClip('revelacao', 0.3, { maxDur: 3 });
    },
    // fantasma / mão se desfazendo
    vanish: () => {
      noise(0.7, { type: 'bandpass', f0: 1800, f1: 300, q: 2, vol: 0.18, attack: 0.05 });
      playClip('sumico', 0.45);
    },
    // lanterna apagando de vez
    lampOut: () => {
      playClip('lanterna', 0.6);
      noise(0.5, { type: 'lowpass', f0: 1200, f1: 100, vol: 0.2, delay: 0.1 });
      tone(62, 2.2, { type: 'sine', vol: 0.18, delay: 0.3 });
    },
    hurt: () => tone(520, 0.45, { type: 'sawtooth', slide: 0.25, vol: 0.05 }),
    // fósforo riscando + chama pegando + sino distante (nada de musiquinha alegre)
    checkpoint: () => {
      noise(0.08, { type: 'highpass', f0: 3000, f1: 1500, vol: 0.25 });
      noise(0.5, { type: 'lowpass', f0: 400, f1: 1600, vol: 0.3, attack: 0.08, delay: 0.06 });
      tone(98, 0.9, { type: 'triangle', vol: 0.12, delay: 0.1 });
      playClip('sino', 0.3);
    },
    // morte: corta o que estava tocando, a noite some e um sino grave dobra
    over: () => {
      stopAllClips(250);
      ambience(0.25, 1500);
      steps(0);
      tone(55, 3, { type: 'sine', vol: 0.3 });
      tone(82, 2.6, { type: 'sine', slide: 0.97, vol: 0.12, delay: 0.05 });
      noise(1.2, { type: 'lowpass', f0: 300, f1: 60, vol: 0.3 });
      playClip('sino', 0.55, { rate: 0.7 });
      playClip('sussurros', 0.35, { maxDur: 4 });
    },
  };
}
