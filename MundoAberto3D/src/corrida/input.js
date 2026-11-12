// Teclado + botões de toque + controle (Xbox / qualquer "standard gamepad")
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyK']);
const LEFT = ['ArrowLeft', 'KeyA', 'PadLeft'];
const RIGHT = ['ArrowRight', 'KeyD', 'PadRight'];
const RUN = ['ShiftLeft', 'ShiftRight', 'KeyJ', 'PadRun'];
const FIRE = new Set(['KeyF', 'KeyX', 'KeyL', 'Enter']);
const USE = new Set(['KeyE', 'ArrowDown', 'KeyS']); // examinar / usar / esconder

/*
 * Controle do Xbox (layout "standard" da Gamepad API)
 *
 *   Jogando                         Menus e puzzles
 *   analógico esq. / D-pad  andar   D-pad / analógico  move a seleção
 *   (sempre na velocidade normal)   A                  confirma
 *   A                       pular   B                  volta / fecha / desfaz
 *   RT (segurar)            correr  Start              começa / OK
 *   B ou RB                 fogo
 *   Y ou D-pad ↓            usar / examinar / esconder
 *   analógico dir. / R3     olhar o quadro de perto (castelo); o analógico dir. vira a cabeça
 *   B                       sai do modo "olhar"
 *
 *   Teclado: G olha o quadro (G de novo ou Esc sai)
 */
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.35;      // zona morta do analógico
const NAV_DELAY = 0.38, NAV_REPEAT = 0.14; // repetição ao segurar a direção nos menus

const $ = (id) => document.getElementById(id);
const visible = (el) => !!el && !el.hidden && el.getClientRects().length > 0;

/** Vibração do controle (se houver): strength 0..1, ms de duração. */
export function rumble(strength = 0.6, ms = 180) {
  for (const gp of navigator.getGamepads?.() ?? []) {
    gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.7 }).catch?.(() => {});
  }
}

export function createInput() {
  const keys = new Set();
  let jumpQueued = false;
  let fireQueued = false;
  let useQueued = false;
  let lookQueued = null;   // 'toggle' (G / R3: entra e sai) ou 'enter' (empurrar o analógico direito: só entra)
  let backQueued = false;  // Esc / B: sair do modo "olhar"
  const look = { x: 0, y: 0 }; // analógico direito (-1..1)
  const mouse = { x: 0, y: 0 }; // posição do mouse na tela (-1..1), para olhar em volta no teclado
  addEventListener('mousemove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });

  // body.pad = último dispositivo usado foi o controle (troca os ícones das dicas)
  const setPad = (on) => document.body.classList.toggle('pad', on);

  addEventListener('keydown', (e) => {
    if (e.padSynthetic) return; // eventos que o controle dispara para os menus
    setPad(false);
    if (JUMP.has(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
    if (JUMP.has(e.code) && !e.repeat) jumpQueued = true;
    if (FIRE.has(e.code) && !e.repeat) fireQueued = true;
    if (USE.has(e.code) && !e.repeat) useQueued = true;
    if (e.code === 'KeyG' && !e.repeat) lookQueued = 'toggle';
    if (e.code === 'KeyQ' && !e.repeat) backQueued = true;
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => { if (!e.padSynthetic) keys.delete(e.code); });
  addEventListener('blur', () => keys.clear());
  addEventListener('pointerdown', () => setPad(false));

  // Botões de toque: data-key="TouchLeft|TouchRight|TouchJump"
  for (const btn of document.querySelectorAll('[data-key]')) {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      keys.add(k);
      if (k === 'TouchJump') jumpQueued = true;
      if (k === 'TouchFire') fireQueued = true;
      if (k === 'TouchUse') useQueued = true;
      btn.classList.add('on');
    };
    const up = () => { keys.delete(k); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  }

  // ---------------- controle ----------------
  let prev = [];          // botões do quadro anterior
  let stickRWas = false;  // analógico direito já estava empurrado
  const nav = { dir: null, t: 0, kind: null };
  let lastT = performance.now();

  // Tela/janela aberta por cima do jogo? (aí o controle navega em vez de jogar)
  function uiContext() {
    if (visible($('cmodal'))) return { kind: 'modal', root: $('cm-card') };
    if (visible($('help-screen'))) return { kind: 'help', root: $('help-screen') };
    if (visible($('over-screen'))) return { kind: 'over', root: $('over-screen'), main: $('btn-again') };
    if (visible($('title-screen'))) return { kind: 'title', root: $('title-screen'), main: $('btn-start') };
    if (visible($('gate-hud'))) return { kind: 'gate' };
    return null;
  }

  const FOCUSABLE = 'button:not(:disabled), [data-k], [data-i], [data-v]';
  function focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => visible(el) && !el.closest('[hidden]'));
  }
  // primeiro foco: o primeiro botão de conteúdo (o ✕ de fechar fica para o B)
  const firstOf = (list) => list.find((el) => !el.matches('.cm-close')) ?? list[0];
  function padFocus(el) {
    document.querySelectorAll('.pad-focus').forEach((x) => x.classList.remove('pad-focus'));
    if (!el) return;
    el.classList.add('pad-focus');
    el.focus({ preventScroll: false });
  }
  // move o foco para o botão mais próximo na direção pedida
  function moveFocus(root, dir) {
    const list = focusables(root);
    if (!list.length) return;
    const cur = list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) return padFocus(firstOf(list));
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestS = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (main <= 4) continue;
      const s = main + side * 2.2;
      if (s < bestS) { bestS = s; best = el; }
    }
    if (best) padFocus(best);
  }

  // dispara uma "tecla" para quem já escuta o teclado (castelo, portão, menus)
  function synth(code, key = code) {
    const e = new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true });
    e.padSynthetic = true;
    dispatchEvent(e);
  }

  function clearPadKeys() { keys.delete('PadLeft'); keys.delete('PadRight'); keys.delete('PadRun'); keys.delete('PadJump'); }

  function pollPad() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    requestAnimationFrame(pollPad);

    const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected);
    if (!gp) { clearPadKeys(); prev = []; look.x = look.y = 0; return; }

    const pressed = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    const hit = (i) => pressed[i] && !prev[i];
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const left = pressed[BTN.LEFT] || ax < -DEAD;
    const right = pressed[BTN.RIGHT] || ax > DEAD;
    const up = pressed[BTN.UP] || ay < -0.6;
    const down = pressed[BTN.DOWN] || ay > 0.6;

    // analógico direito: vira a cabeça no modo "olhar"; empurrar = entrar nele
    const rx = gp.axes[2] ?? 0, ry = gp.axes[3] ?? 0;
    const rMag = Math.hypot(rx, ry);
    look.x = rMag > 0.2 ? rx : 0;
    look.y = rMag > 0.2 ? ry : 0;
    if (pressed.some(Boolean) || Math.abs(ax) > DEAD || Math.abs(ay) > DEAD || rMag > DEAD) setPad(true);

    const ui = uiContext();
    if (!ui) {
      // ---- jogando: mesmos estados do teclado ----
      left && !right ? keys.add('PadLeft') : keys.delete('PadLeft');
      right && !left ? keys.add('PadRight') : keys.delete('PadRight');
      // analógico/direcional só andam (velocidade normal); correr = segurar RT junto
      const run = (gp.buttons[BTN.RT]?.value ?? 0) > 0.3;
      run ? keys.add('PadRun') : keys.delete('PadRun');
      pressed[BTN.A] ? keys.add('PadJump') : keys.delete('PadJump');
      if (hit(BTN.A)) jumpQueued = true;
      if (hit(BTN.B) || hit(BTN.RB)) fireQueued = true;
      if (hit(BTN.Y) || hit(BTN.DOWN)) useQueued = true;
      if (hit(BTN.B)) backQueued = true;
      if (hit(BTN.R3)) lookQueued = 'toggle';
      else if (rMag > 0.6 && !stickRWas) lookQueued ??= 'enter';
      nav.dir = null;
      nav.kind = null;
    } else {
      // ---- menus e puzzles ----
      clearPadKeys();
      const dir = left ? 'left' : right ? 'right' : up ? 'up' : down ? 'down' : null;
      let step = false;
      // tela nova: a direção que já vinha apertada (ex.: correndo até o portão) não conta
      if (ui.kind !== nav.kind) { nav.kind = ui.kind; nav.dir = dir; nav.t = Infinity; }
      if (dir !== nav.dir) { nav.dir = dir; nav.t = NAV_DELAY; step = !!dir; }
      else if (dir) { nav.t -= dt; if (nav.t <= 0) { nav.t = NAV_REPEAT; step = true; } }

      if (ui.kind === 'gate') {
        if (step && (dir === 'left' || dir === 'right')) synth(dir === 'left' ? 'PadLeft' : 'PadRight');
        if (hit(BTN.A)) synth('PadA');
        if (hit(BTN.B) || hit(BTN.X)) synth('Backspace');
      } else {
        if (step) moveFocus(ui.root, dir);
        if (hit(BTN.A)) {
          const list = focusables(ui.root);
          const cur = list.includes(document.activeElement) ? document.activeElement : null;
          if (cur) { padFocus(cur); cur.click(); }
          else if (ui.main && !ui.main.disabled) { padFocus(ui.main); ui.main.click(); }
          else padFocus(firstOf(list));
        }
        if (hit(BTN.B)) synth('KeyQ', 'q');
        if (hit(BTN.START)) {
          if (ui.main && !ui.main.disabled) ui.main.click();
          else synth('Enter'); // cadeado do castelo: OK
        }
        if (hit(BTN.X) && ui.kind === 'modal') synth('Backspace'); // cadeado: apaga
      }
    }
    stickRWas = rMag > 0.6 ? true : rMag < 0.3 ? false : stickRWas;
    prev = pressed;
  }
  requestAnimationFrame(pollPad);
  addEventListener('gamepadconnected', () => setPad(true));

  const any = (list) => list.some((k) => keys.has(k));

  return {
    get left() { return any(LEFT) || keys.has('TouchLeft'); },
    get right() { return any(RIGHT) || keys.has('TouchRight'); },
    // no toque, andar já é correr
    get run() { return any(RUN) || keys.has('TouchLeft') || keys.has('TouchRight'); },
    get jumpHeld() { return [...JUMP].some((k) => keys.has(k)) || keys.has('TouchJump') || keys.has('PadJump'); },
    consumeJump() { const j = jumpQueued; jumpQueued = false; return j; },
    consumeFire() { const f = fireQueued; fireQueued = false; return f; },
    fire() { fireQueued = true; },
    consumeUse() { const u = useQueued; useQueued = false; return u; },
    consumeLook() { const l = lookQueued; lookQueued = null; return l; },
    consumeBack() { const b = backQueued; backQueued = false; return b; },
    look, // analógico direito { x, y }
    mouse, // mouse { x, y } (-1..1)
    clear() {
      for (const k of [...keys]) if (!k.startsWith('Pad')) keys.delete(k);
      jumpQueued = false; fireQueued = false; useQueued = false; lookQueued = null; backQueued = false;
    },
  };
}
