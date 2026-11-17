import { PIT_FLOOR } from './world.js';
import { phaseFromVy } from '../jumpClips.js';
import { rumble } from './input.js';

// Física de plataforma (estilo Mario) para o personagem 3D, preso ao plano z = 0
const GRAV = 42;
const JUMP_V = 18.5; // ~4 m de altura (o topo das fileiras de blocos fica a 3,8 m)
const MAX_FALL = 24;
const ACC_GROUND = 34;
const ACC_AIR = 22;
const FRICTION = 28;
const MAX_WALK = 5.5; // andar calmo; os buracos maiores (6 m) ainda pedem correr (RT / Shift)
const MAX_RUN = 9.5; // perto do andar: sem "arrancada" exagerada (era 4,5 → 11)
const EPS = 1e-4;
const MAX_HEARTS = 3;
const YAW = Math.PI / 2 - 0.35; // de perfil, levemente virado para a câmera

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createPlayer(ch, world, sfx, impale) {
  const P = {
    x: 0, y: 0, vx: 0, vy: 0, w: 0.7, h: 1.7,
    grounded: false, coyote: 0, jumpBuf: 0, jumping: false, airTime: 0,
    facing: 1, yaw: YAW, invuln: 0, hearts: MAX_HEARTS, dead: false, deadT: 0,
    safe: { x: 0, y: 0 }, maxX: 0, falls: 0,
  };
  let jumpHeld = false;

  // pulo normal ou longo (correndo). O tempo do clipe segue a velocidade vertical (ver sync).
  const LONG_JUMP_SPEED = MAX_WALK + 0.5;
  function startJumpAnim(long) {
    const name = long && ch.actions.jump_long ? 'jump_long' : ch.actions.jump_normal ? 'jump_normal' : null;
    P.jumpAnim = name;
    P.jumpV0 = Math.max(P.vy, 1);
    if (name) ch.play(name, { fade: 0.08, timeScale: 0, restart: true });
    else ch.play('jump', { fade: 0.08, timeScale: 1.6, restart: true });
  }

  function reset(x, y) {
    Object.assign(P, {
      x, y, vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuf: 0, jumping: false, airTime: 0,
      facing: 1, yaw: YAW, invuln: 0, hearts: MAX_HEARTS, dead: false, deadT: 0, maxX: x, inPit: false, deathKind: null, deathCause: null, jumpAnim: null, tip: 0, ground: null, w: 0.7,
    });
    P.safe = { x, y };
    ch.root.visible = true;
    ch.play('idle', { fade: 0, restart: true });
  }

  const hits = (s, x, y) =>
    x + P.w / 2 > s.minX + EPS && x - P.w / 2 < s.maxX - EPS && y + P.h > s.minY + EPS && y < s.maxY - EPS;

  function moveX(dx) {
    P.x += dx;
    for (const s of world.solidsNear(P.x - 2, P.x + 2)) {
      if (!hits(s, P.x, P.y)) continue;
      P.x = dx > 0 ? s.minX - P.w / 2 : s.maxX + P.w / 2;
      P.vx = 0;
    }
  }

  function moveY(dy) {
    P.y += dy;
    let landed = null, bumped = null, best = 0;
    for (const s of world.solidsNear(P.x - 2, P.x + 2)) {
      if (!hits(s, P.x, P.y)) continue;
      if (dy <= 0) {
        P.y = s.maxY;
        landed = s;
      } else {
        P.y = s.minY - P.h;
        const ov = Math.min(P.x + P.w / 2, s.maxX) - Math.max(P.x - P.w / 2, s.minX);
        if (ov > best) { best = ov; bumped = s; }
      }
    }
    if (landed || bumped) P.vy = 0;
    if (bumped) world.hitBlock(bumped);
    return landed;
  }

  const DEATH_SPEED = 0.9; // um pouco mais lenta, mais dramática
  const BREAK_FROM = 3.0, BREAK_TO = 6.5;
  const BODY_LEN = 1.1;   // até onde o tronco alcança ao desabar de costas (a partir dos pés)
  const TIP_DELAY = 0.9;  // o corpo começa a pender depois de perder o equilíbrio
  const TIP_SPEED = 3.2;  // velocidade com que escorrega da borda
  const TIP_EXTRA = 0.9;  // tempo a mais antes do modal, para ver o corpo chegar ao chão

  // morreu em cima de um bloco/plataforma: o centro de massa do corpo caído fica fora do apoio?
  // devolve -1/+1 (lado para onde tomba) ou 0 se o corpo fica em cima
  function tipSide() {
    const s = P.grounded ? P.ground : null;
    if (!s) return 0;
    if (P.x < s.minX) return -1;               // já estava com o centro para fora
    if (P.x > s.maxX) return 1;
    const back = -P.facing;                    // cai para trás
    const com = P.x + back * BODY_LEN * 0.55;  // centro de massa do corpo deitado
    if (com < s.minX || com > s.maxX) return back;
    return 0;
  }

  function die() {
    P.dead = true;
    P.deadT = 0;
    P.vx = 0;
    P.invuln = 0;
    P.tip = tipSide();
    ch.root.visible = true;
    // coruja: "break_fall" desaba de verdade entre 3s e 6,5s do clipe; senão usa defeat_03
    if (ch.actions?.break_fall) {
      ch.play('break_fall', { fade: 0.2, timeScale: DEATH_SPEED, restart: true, from: BREAK_FROM });
      P.deathDur = (BREAK_TO - BREAK_FROM) / DEATH_SPEED + 1.0;
    } else {
      const a = ch.play('defeat_03', { fade: 0.2, timeScale: DEATH_SPEED, restart: true });
      // o modal só aparece depois da animação inteira + uma pausa
      P.deathDur = (a ? a.getClip().duration / DEATH_SPEED : 2) + 1.0;
    }
    if (P.tip) P.deathDur += TIP_EXTRA;
    sfx.over();
  }
  // morte nos espinhos do buraco: pose congelada de queda + corpo deitado (impale.js)
  let freezeAction = null;
  function dieImpaled() {
    P.dead = true;
    P.deadT = 0;
    P.vx = 0;
    P.invuln = 0;
    P.deathKind = 'spikes';
    P.deathCause = 'spikes';
    ch.root.visible = true;
    freezeAction = ch.play('fall', { fade: 0.06, timeScale: 1.4, restart: true });
    P.deathDur = 3.6;
    impale?.start(P.x, P.facing);
    sfx.over();
  }

  // última vida perdida na água do pântano: afunda e some
  function drown() {
    P.dead = true;
    P.deadT = 0;
    P.vx = 0;
    P.invuln = 0;
    P.deathKind = 'drown';
    P.deathCause = 'drown';
    P.deathDur = 2.6;
    ch.root.visible = false;
    sfx.over();
  }

  // a animação de morte acabou?
  const deathDone = () => P.dead && P.deadT >= P.deathDur;

  // cause: o que machucou (tipo do bicho, 'trap', 'dama'…) — vira o título da tela de fim
  function hurt(fromX, cause = 'enemy') {
    if (P.invuln > 0 || P.dead) return;
    P.hearts--;
    sfx.hurt();
    if (P.hearts <= 0) { P.deathCause = cause; rumble(1, 600); return die(); }
    rumble(0.55, 200);
    P.invuln = 1.8;
    P.vx = Math.sign(P.x - fromX || -1) * 7;
    P.vy = 9;
    P.grounded = false;
  }

  function bounce() {
    P.vy = jumpHeld ? 18 : 11;
    P.jumping = true;
    P.airTime = 0;
    startJumpAnim(false);
  }

  // saída do portal: reaparece em x mantendo vidas e distância
  function teleport(x, y) {
    Object.assign(P, { x, y, vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuf: 0, jumping: false, airTime: 0, facing: 1, yaw: YAW, invuln: 1.2, jumpAnim: null });
    P.safe = { x, y };
    P.maxX = Math.max(P.maxX, x);
    ch.root.visible = true;
    ch.play('idle', { fade: 0, restart: true });
  }

  function heal() { P.hearts = Math.min(MAX_HEARTS, P.hearts + 1); }
  function setSafe(x, y) { P.safe = { x, y }; }

  function fellInPit() {
    P.hearts--;
    P.falls++;
    sfx.hurt();
    rumble(0.8, 350);
    world.pitFall?.(P.x);
    if (P.hearts <= 0 && world.isWater?.()) {
      P.y = PIT_FLOOR;
      P.vy = 0;
      drown();
      return null;
    }
    if (P.hearts <= 0) {
      // última vida: morre ali mesmo, no fundo do buraco
      P.y = PIT_FLOOR;
      P.vy = 0;
      P.inPit = true;
      dieImpaled();
      return null;
    }
    world.clearEnemiesNear(P.safe.x, 6);
    Object.assign(P, { x: P.safe.x, y: P.safe.y + 0.01, vx: 0, vy: 0, invuln: 1.8, grounded: false, jumpAnim: null });
    return 'respawn';
  }

  function update(dt, input, camLeft, time) {
    jumpHeld = input.jumpHeld;
    if (P.dead) {
      P.deadT += dt;
      input.consumeJump();
      // tombou na borda: escorrega para fora do bloco e despenca até o chão
      if (P.tip && P.deadT > TIP_DELAY) {
        if (P.grounded && P.vx === 0 && P.ground && P.x >= P.ground.minX - 0.05 && P.x <= P.ground.maxX + 0.05) P.vx = P.tip * TIP_SPEED;
        P.w = 0.12; // corpo mole: só o centro se apoia, então passa da quina e cai
        moveX(P.vx * dt);
      }
      // o corpo cai até o chão se morreu no ar
      P.vy = Math.max(P.vy - GRAV * dt, -MAX_FALL);
      const landed = moveY(P.vy * dt);
      P.grounded = !!landed;
      if (landed) {
        // chegou num apoio novo (o chão lá embaixo): para de escorregar
        if (P.tip && landed !== P.ground) { P.vx = 0; P.tip = 0; }
        P.ground = landed;
      } else if (P.tip) {
        P.vx *= Math.max(0, 1 - dt * 1.5);
      }
      if (P.y < PIT_FLOOR) { P.y = PIT_FLOOR; P.vy = 0; }
      if (P.inPit && P.y < PIT_FLOOR) { P.y = PIT_FLOOR; P.vy = 0; }
      if (P.deathKind === 'spikes' || P.deathKind === 'drown') { P.y = PIT_FLOOR; P.vy = 0; }
      return null;
    }
    P.invuln = Math.max(0, P.invuln - dt);

    // ---------- movimento horizontal ----------
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // o lugar pode ajustar o passo (Trem Fantasma: velocidade fixa, para o pulo ter sempre o mesmo tamanho)
    const tune = world.tune?.();
    const max = (input.run && !tune?.noRun ? MAX_RUN : MAX_WALK) * (tune?.speed ?? 1);
    const acc = P.grounded ? ACC_GROUND : ACC_AIR;
    if (dir) {
      const turning = Math.sign(P.vx) === -dir;
      P.vx += dir * acc * dt * (turning ? 2.2 : 1);
      P.facing = dir;
    } else if (P.grounded) {
      const f = FRICTION * dt;
      P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
    }
    if (Math.abs(P.vx) > max) {
      // soltou o "correr": desacelera aos poucos
      P.vx = Math.sign(P.vx) * Math.max(max, Math.abs(P.vx) - (FRICTION + (tune?.strict ? acc : 0)) * dt);
    }

    // ---------- pulo (buffer + coyote time + altura variável) ----------
    P.jumpBuf = input.consumeJump() ? 0.12 : P.jumpBuf - dt;
    P.coyote = P.grounded ? 0.1 : P.coyote - dt;
    if (P.jumpBuf > 0 && P.coyote > 0) {
      P.vy = JUMP_V + Math.abs(P.vx) * 0.15;
      P.jumpBuf = 0;
      P.coyote = 0;
      P.grounded = false;
      P.jumping = true;
      P.airTime = 0;
      sfx.jump();
      startJumpAnim(Math.abs(P.vx) > LONG_JUMP_SPEED);
    }
    let g = GRAV;
    if (P.vy > 0 && !input.jumpHeld) g *= 2.4;
    else if (P.vy < 0) g *= 1.15;
    P.vy = Math.max(P.vy - g * dt, -MAX_FALL);

    // ---------- colisão (em 2 sub-passos) ----------
    const fallV = P.vy, wasGrounded = P.grounded;
    P.grounded = false;
    let ground = null;
    const N = 2;
    for (let i = 0; i < N; i++) {
      moveX((P.vx * dt) / N);
      if (P.x - P.w / 2 < camLeft) {
        P.x = camLeft + P.w / 2;
        if (P.vx < 0) P.vx = 0;
      }
      const landed = moveY((P.vy * dt) / N);
      if (landed) { P.grounded = true; ground = landed; }
    }
    P.maxX = Math.max(P.maxX, P.x);
    P.groundKind = ground?.kind ?? null;
    P.ground = ground;
    // pouso: pulinho = passo firme; pulo alto = baque (k cresce com a velocidade da queda)
    if (P.grounded && !wasGrounded && fallV < -5) {
      const gk = P.groundKind;
      const surf = gk === 'plank' ? 'madeira' : gk === 'block' || gk === 'pillar' || gk === 'roof' ? 'pedra' : 'terra';
      sfx.land?.(clamp((-fallV - 10) / 14, 0, 1), surf);
    }

    if (P.grounded && ground.kind === 'ground' && P.x > ground.minX + 1.2 && P.x < ground.maxX - 1.2) {
      P.safe = { x: P.x, y: ground.maxY };
    }

    if (P.y < PIT_FLOOR) return fellInPit();
    return null;
  }

  // ---------- visual: posição, rumo, piscar e animações ----------
  function sync(dt, time) {
    const root = ch.root;
    if (P.deathKind === 'drown') { root.visible = false; return; }
    root.position.set(P.x, P.y, 0);
    const target = P.facing * YAW;
    P.yaw += (target - P.yaw) * Math.min(1, dt * 14);
    root.rotation.set(0, P.yaw, 0);
    root.visible = P.dead || P.invuln <= 0 || Math.floor(time * 18) % 2 === 0;

    if (P.deathKind === 'spikes') {
      // corpo mole: congela a pose de queda logo após o impacto
      if (freezeAction && P.deadT > 0.1) { freezeAction.timeScale = 0; freezeAction = null; }
      impale?.pose(root, P.yaw);
      return;
    }

    if (P.dead) return;
    const s = Math.abs(P.vx);
    if (P.grounded) {
      P.airTime = 0;
      P.jumping = false;
      P.jumpAnim = null;
      if (s < 0.4) ch.play('idle', { fade: 0.2, soft: true }); // soft: não corta o feitiço
      // a coruja tem perna curta (passada natural pequena): limite alto para os pés não deslizarem
      // andando (mesmo no máximo) = animação calma; 'run' só quando passa da velocidade de andar
      // passada calma: no máximo 2x a velocidade do clipe (mais que isso parece corrida)
      else if (s <= MAX_WALK + 0.5) ch.play('walk', { fade: 0.2, timeScale: clamp((s / MAX_WALK) * 2, 0.7, 2) });
      else ch.play('run', { fade: 0.2, timeScale: clamp(s / (ch.speeds.run || 5), 0.8, 4) });
    } else {
      P.airTime += dt;
      const ja = P.jumpAnim && ch.actions[P.jumpAnim];
      if (ja && P.airTime < 1.6) {
        // arrasta o clipe: decolagem → topo → pronto para aterrissar
        ja.time = phaseFromVy(P.vy, P.jumpV0) * ja.getClip().duration;
      } else if (P.vy < 0 && (P.airTime > 0.35 || !P.jumping)) ch.play('fall', { fade: 0.25 });
    }
  }

  return { P, reset, teleport, update, sync, hurt, bounce, heal, setSafe, deathDone };
}
