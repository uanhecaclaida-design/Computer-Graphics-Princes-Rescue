/* ============================================================
 * animation2d.js — Canvas 2D scene for "The Prince's Rescue"
 *
 * Computer-graphics concepts used:
 *   • 2D Transforms   – ctx.translate / scale / rotate anchor shapes
 *   • Parametric anim – legs/arms/cape swing via sine-wave phases
 *   • Easing + gravity– jump is a real parabola (constant accel.)
 *   • Delta-time loop – requestAnimationFrame + dt keeps speed
 *                        frame-rate independent
 *   • Particle system – confetti squares + floating hearts
 *   • Parallax clouds – different drift speeds give depth
 *   • Camera zoom     – finale smoothly zooms toward the reunion
 *
 * Final sequence (fixed):
 *   giant defeated → prince walks to the tower → tower door OPENS →
 *   princess comes DOWN and walks out → they HUG → game ends (WIN).
 * ============================================================ */
(function () {
  'use strict';

  /* ── Canvas setup (HiDPI-aware) ── */
  const canvas = document.getElementById('canvas2d');
  const ctx    = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(180, r.height);
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  /* ── Story states ── */
  const ST = {
    INTRO: 'intro', WALK: 'walk', AT_OBSTACLE: 'atObstacle',
    JUMP: 'jump', PAST_OBS: 'pastObs', WALK2: 'walk2',
    AT_GATE: 'atGate', RIDDLES: 'riddles',
    GIANT_DEFEATED: 'giantDefeated', RESCUE: 'rescue',
    DOOR_OPEN: 'doorOpen',
    PRINCESS_WALK: 'princessWalk', HUG: 'hug',
    WIN: 'win', GAMEOVER: 'gameover'
  };
  const LABELS = {
    intro: 'Chapter 1 — Click Walk to begin',
    walk:  'Chapter 2 — On the Road',
    atObstacle: 'Chapter 2 — Click Jump to clear the log!',
    jump:  'Chapter 2 — Over the Obstacle',
    pastObs: 'Chapter 3 — Click Walk to continue',
    walk2: 'Chapter 3 — Approaching the Gate',
    atGate: "Chapter 4 — The Giant's Challenge",
    riddles: "Chapter 4 — Answer the Riddles",
    giantDefeated: 'Chapter 5 — Click Walk to reach the tower',
    rescue: 'Chapter 6 — To the Tower',
    doorOpen: 'Chapter 6 — The Tower Door Opens!',
    princessWalk: 'Chapter 6 — The Princess Descends!',
    hug:   'Chapter 6 — Reunited! ❤',
    win: 'The End', gameover: 'Game Over'
  };

  /* ── World / characters ── */
  const world = { groundY:0, obstacleX:0, giantX:0, stopX:0, towerDoorX:0, rescueX:0, hugGap:0, clouds:[] };

  const prince = {
    x:0, y:0, vy:0, onGround:true,
    phase:0, capePhase:0, scale:1,
    action:'idle', manualType:null, manualTimer:0
  };
  const giant = {
    shakeT:0, stompT:0, laughT:0, retreatX:0, fade:1, fading:false,
    mouthOpen:0, armUp:0, shrink:0
  };
  const princess = { bob:0, cheer:0,
    out:false,            /* true once she has left the tower door */
    outT:0, x:0, y:0, walkPhase:0 };
  const door = { open:0 };  /* 0 = closed, 1 = fully open */

  /* Particle arrays */
  const confetti = [];
  const floatHearts = [];

  /* ── Camera (used for finale zoom-in) ── */
  const cam = { x:0, y:0, scale:1, targetX:0, targetY:0, targetScale:1 };

  /* ── Runtime ── */
  let state = ST.INTRO;
  let stateTime = 0;
  let playing   = true;
  let speedMul  = 1;
  let battle    = null;
  let ui        = null;
  let screenShakeT = 0;
  let running = false, rafId = null, lastT = 0;

  /* ── Helpers ── */
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand  = (a, b) => a + Math.random() * (b - a);

  /* ── Dialogue queue ──────────────────────────────────────────────
   * BUG FIX (garbled text such as "J aHmoelsd Aornt!hur!"):
   * the dialogue box types its text letter by letter. When a new line
   * was shown while the previous one was still being typed, the two
   * typewriters wrote into the same box and the letters got mixed up.
   * Every line now goes through say(), which waits until the previous
   * line has finished. If your UI types more slowly, increase
   * SAY_MS_PER_CHAR. */
  const SAY_MS_PER_CHAR = 35, SAY_PAD_MS = 400;
  const sayQueue = []; let sayBusyUntil = 0;
  function say(name, text) { sayQueue.push({ name, text }); }
  function sayDone() { return sayQueue.length === 0 && performance.now() >= sayBusyUntil; }
  function pumpSay() {
    if (!ui || !sayQueue.length) return;
    const now = performance.now();
    if (now < sayBusyUntil) return;
    const d = sayQueue.shift();
    ui.hideDialogue();
    ui.showDialogue(d.name, d.text);
    sayBusyUntil = now + d.text.length * SAY_MS_PER_CHAR + SAY_PAD_MS;
  }

  /* ── Layout ── */
  function layout() {
    world.groundY   = H * 0.80;
    world.obstacleX = W * 0.40;
    world.giantX    = W * 0.66;
    world.stopX     = world.giantX - W * 0.11;
    /* centre of the tower door — same formula drawCastle uses for the tower */
    world.towerDoorX = world.giantX + W*.06 + W*.18*.32;
    world.rescueX   = world.towerDoorX - W * 0.15;   /* where the prince waits for her */
    world.hugGap    = H * 0.16;                      /* prince ↔ princess distance in the hug */
    if (!world.clouds.length)
      for (let i = 0; i < 5; i++)
        world.clouds.push({ x:rand(0,W), y:rand(H*.08,H*.38), s:rand(.7,1.4), speed:rand(8,22) });
  }

  /* ══════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════ */

  function drawScene() {
    /* sky */
    const sky = ctx.createLinearGradient(0,0,0,world.groundY);
    sky.addColorStop(0,'#7ec8ff'); sky.addColorStop(.6,'#bfe3ff'); sky.addColorStop(1,'#ffe8c4');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, world.groundY);

    /* sun glow */
    const sx=W*.84, sy=H*.18, sr=Math.max(8,H*.05);
    const glow = ctx.createRadialGradient(sx,sy,sr*.4,sx,sy,sr*3);
    glow.addColorStop(0,'rgba(255,236,170,.9)'); glow.addColorStop(1,'rgba(255,236,170,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx,sy,sr*3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff3c4'; ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();

    /* hills */
    drawHills(world.groundY-H*.02, H*.10, '#9fd38a', .6);
    drawHills(world.groundY,       H*.16, '#7cbf6a', 1);

    /* clouds */
    ctx.fillStyle='rgba(255,255,255,.92)';
    for (const c of world.clouds) drawCloud(c.x, c.y, c.s);

    /* ground */
    const grass = ctx.createLinearGradient(0,world.groundY,0,H);
    grass.addColorStop(0,'#86d36a'); grass.addColorStop(1,'#5cb24a');
    ctx.fillStyle = grass; ctx.fillRect(0, world.groundY, W, H-world.groundY);
    ctx.fillStyle='#d8b984'; ctx.fillRect(0, world.groundY+4, W, 6);

    drawLog(world.obstacleX, world.groundY);
    drawCastle(world.giantX + W*.06, world.groundY);
    /* Only draw giant if still visible */
    if (giant.fade > 0.03) drawGiant(world.giantX + giant.retreatX, world.groundY);
  }

  function drawHills(baseY, h, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, baseY);
    for (let i=0; i<=6; i++) {
      const x = (i/6)*W, y = baseY - h*(.5+.5*Math.sin(i*1.7+1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, baseY); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawCloud(x, y, s) {
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.arc(22,4,22,0,Math.PI*2);
    ctx.arc(46,0,18,0,Math.PI*2); ctx.rect(0,-2,46,16); ctx.fill(); ctx.restore();
  }

  function drawLog(x, baseY) {
    const lw=W*.05, lh=H*.05;
    ctx.save(); ctx.translate(x, baseY-lh*.4);
    ctx.fillStyle='#8a5a2b';
    ctx.beginPath(); ctx.roundRect(-lw,-lh,lw*2,lh*1.2,8); ctx.fill();
    ctx.fillStyle='#a9763f';
    ctx.beginPath(); ctx.arc(-lw,-lh*.4,lh*.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( lw,-lh*.4,lh*.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#6f441f'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(-lw,-lh*.4,lh*.25,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#4f9e3a'; ctx.lineWidth=2;
    for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(i*6,-lh); ctx.lineTo(i*6+2,-lh-6); ctx.stroke(); }
    ctx.restore();
  }

  function doorPath(tx, baseY, dw, dh) {
    ctx.beginPath();
    ctx.moveTo(tx-dw/2, baseY); ctx.lineTo(tx-dw/2, baseY-dh+dw/2);
    ctx.arc(tx, baseY-dh+dw/2, dw/2, Math.PI, 0);
    ctx.lineTo(tx+dw/2, baseY); ctx.closePath();
  }

  function drawCastle(cx, baseY) {
    const cw=W*.18, ch=H*.44, wallY=baseY-ch;
    ctx.save();

    /* ── Main castle wall ── */
    ctx.fillStyle='#c9b6e0'; ctx.fillRect(cx-cw/2, wallY, cw, ch);
    /* Battlements */
    ctx.fillStyle='#b3a0cf';
    const m=cw/8;
    for (let i=0;i<8;i+=2) ctx.fillRect(cx-cw/2+i*m, wallY-m*.9, m, m*.9);

    /* ── Tall round tower (right side, prominent) ── */
    const tr=cw*.26;           /* tower radius */
    const th=ch*1.45;          /* tower height — taller than wall */
    const tx=cx + cw*.32;      /* tower centre-x */
    /* Tower cylinder */
    ctx.fillStyle='#d8c6ec';
    ctx.beginPath();
    ctx.rect(tx-tr, baseY-th, tr*2, th);
    ctx.fill();
    /* Tower top cap (semicircle) */
    ctx.beginPath(); ctx.arc(tx, baseY-th, tr, Math.PI, 0); ctx.fill();
    /* Tower battlements */
    ctx.fillStyle='#c4b0da';
    for (let i=0;i<5;i+=2) ctx.fillRect(tx-tr+i*(tr*.45), baseY-th-m*.7, tr*.4, m*.7);
    /* Tower conical roof */
    ctx.fillStyle='#e0526a';
    ctx.beginPath(); ctx.moveTo(tx-tr*1.1, baseY-th);
    ctx.lineTo(tx+tr*1.1, baseY-th); ctx.lineTo(tx, baseY-th-tr*1.6); ctx.closePath(); ctx.fill();
    /* Flag pole + flag */
    ctx.strokeStyle='#6b6480'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(tx, baseY-th-tr*1.6); ctx.lineTo(tx, baseY-th-tr*2.4); ctx.stroke();
    ctx.fillStyle='#f5c542';
    ctx.beginPath(); ctx.moveTo(tx, baseY-th-tr*2.4); ctx.lineTo(tx+16, baseY-th-tr*2.1);
    ctx.lineTo(tx, baseY-th-tr*1.85); ctx.closePath(); ctx.fill();

    /* ── Tower window (tall arched window where princess stands) ── */
    const winW=tr*.9, winH=tr*1.5, winY=baseY-th*.58;
    ctx.fillStyle='#9ec5ff';
    ctx.beginPath();
    ctx.roundRect(tx-winW/2, winY-winH, winW, winH, [winW/2, winW/2, 0, 0]);
    ctx.fill();
    ctx.strokeStyle='#7aa8dd'; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.roundRect(tx-winW/2, winY-winH, winW, winH, [winW/2, winW/2, 0, 0]);
    ctx.stroke();

    /* ── Tower door at ground level (princess exits here) ──
       Bigger than before, and it really opens: the leaf is hinged on its
       right edge and shrinks toward the hinge as it swings open, revealing
       the dark doorway behind it. */
    const dw=tr*1.0, dh=tr*2.4;
    ctx.fillStyle='#1c1210';                       /* dark doorway */
    doorPath(tx, baseY, dw, dh); ctx.fill();
    ctx.save();
    doorPath(tx, baseY, dw, dh); ctx.clip();
    const leafW = dw * (1 - door.open*.82);
    ctx.fillStyle='#4a2e1c';
    ctx.fillRect(tx+dw/2-leafW, baseY-dh-2, leafW, dh+2);
    ctx.fillStyle='#5f3d26';                       /* plank lines */
    for (let i=1;i<4;i++) ctx.fillRect(tx+dw/2-leafW + leafW*i/4 - 1, baseY-dh, 2, dh);
    ctx.fillStyle='#f5c542';                       /* handle */
    ctx.beginPath(); ctx.arc(tx+dw/2-leafW+leafW*.2, baseY-dh*.45, Math.max(1.5,dw*.05), 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='#3a2414'; ctx.lineWidth=2;
    doorPath(tx, baseY, dw, dh); ctx.stroke();

    /* ── Princess in window — only until she "goes down the stairs" ── */
    if (!princess.out && !(state===ST.DOOR_OPEN && stateTime>.9)) {
      drawPrincess(tx, winY - winH*.35, winW*1.1);
    }

    ctx.restore();
  }

  function limb(x1, y1, x2, y2, w, color) {
    ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }

  /* ── Prince ── */
  function drawPrince() {
    const u = H/100;
    const hugging = (state===ST.HUG || state===ST.WIN);
    ctx.save();
    ctx.translate(prince.x, prince.y);
    ctx.scale(1/prince.scale, prince.scale);
    const mv   = prince.action==='walk'||prince.action==='jump';
    const sw   = mv ? Math.sin(prince.phase) : 0;
    const armSw= prince.action==='wave' ? 0 : (mv ? -Math.sin(prince.phase) : Math.sin(prince.capePhase*.5)*.15);
    /* cape */
    const cs = Math.sin(prince.capePhase)*6*u*(mv?1.4:.6);
    ctx.save(); ctx.fillStyle='#1d3b8a';
    ctx.beginPath();
    ctx.moveTo(-6*u,-30*u); ctx.quadraticCurveTo(-10*u-cs,-18*u,-8*u-cs,-4*u);
    ctx.lineTo(8*u,-4*u); ctx.lineTo(8*u,-30*u); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#f5c542'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-8*u-cs,-4*u); ctx.lineTo(8*u,-4*u); ctx.stroke();
    ctx.restore();
    /* legs */
    limb(0,-16*u, sw*7*u, 0, 4*u,'#2b2a3a');
    limb(0,-16*u,-sw*7*u, 0, 4*u,'#2b2a3a');
    ctx.fillStyle='#3a2a1a';
    ctx.beginPath(); ctx.ellipse( sw*7*u,0,4*u,2*u,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-sw*7*u,0,4*u,2*u,0,0,Math.PI*2); ctx.fill();
    /* body */
    ctx.fillStyle='#fdfdff';
    ctx.beginPath(); ctx.roundRect(-7*u,-30*u,14*u,16*u,4*u); ctx.fill();
    ctx.fillStyle='#3a2a1a'; ctx.fillRect(-7*u,-16*u,14*u,2*u);
    ctx.strokeStyle='#f5c542'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(-7*u,-28*u); ctx.lineTo(7*u,-28*u); ctx.stroke();
    /* arms */
    if (hugging) {
      /* both arms reach forward (toward the princess) for the hug */
      limb( 6*u,-28*u, 15*u,-27*u, 3.5*u,'#fdfdff');
      limb( 5*u,-25*u, 14*u,-23*u, 3.5*u,'#fdfdff');
      ctx.fillStyle='#f1c9a5';
      ctx.beginPath(); ctx.arc(15*u,-27*u,1.8*u,0,Math.PI*2); ctx.fill();
    } else {
      limb( 6*u,-28*u,  6*u+armSw*6*u,-16*u, 3.5*u,'#fdfdff');
      if (prince.action==='wave') {
        const wv = Math.sin(prince.phase*6)*.5;
        limb(-6*u,-28*u,-12*u,-34*u-wv*4*u, 3.5*u,'#fdfdff');
        ctx.fillStyle='#f1c9a5'; ctx.beginPath(); ctx.arc(-12*u,-34*u-wv*4*u,2.4*u,0,Math.PI*2); ctx.fill();
      } else {
        limb(-6*u,-28*u,-6*u-armSw*6*u,-16*u, 3.5*u,'#fdfdff');
      }
    }
    /* head */
    ctx.save(); ctx.translate(0,-34*u);
    ctx.fillStyle='#f1c9a5'; ctx.fillRect(-2*u,0,4*u,3*u);
    ctx.fillStyle='#f7d2ad'; ctx.beginPath(); ctx.arc(0,-4*u,5*u,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#5a3a1a'; ctx.beginPath(); ctx.arc(0,-7*u,5*u,Math.PI,0); ctx.fill();
    ctx.fillStyle='#2b2440'; ctx.beginPath(); ctx.arc(3*u,-4*u,.8*u,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2b2440'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(3*u,-3*u,1.6*u,.1,Math.PI-.1); ctx.stroke();
    /* crown */
    ctx.fillStyle='#f5c542';
    ctx.beginPath(); ctx.moveTo(-5*u,-8*u); ctx.lineTo(-5*u,-11*u); ctx.lineTo(-2.5*u,-9*u);
    ctx.lineTo(0,-12*u); ctx.lineTo(2.5*u,-9*u); ctx.lineTo(5*u,-11*u); ctx.lineTo(5*u,-8*u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff7eb6'; ctx.beginPath(); ctx.arc(0,-10*u,.9*u,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ── Princess (in tower window) ── */
  function drawPrincess(wx, wy, w) {
    const u = H/100, s = w/(28*u);
    ctx.save();
    ctx.translate(wx, wy + Math.sin(princess.bob)*1.5*u);
    ctx.scale(s, s);
    /* window frame */
    ctx.fillStyle='#3a2a4a';
    ctx.beginPath(); ctx.roundRect(-14*u,-16*u,28*u,32*u,6*u); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-14*u,-16*u,28*u,32*u,6*u); ctx.clip();
    ctx.fillStyle='#9ec5ff'; ctx.fillRect(-14*u,-16*u,28*u,32*u);
    /* dress */
    ctx.fillStyle='#ff7eb6';
    ctx.beginPath(); ctx.moveTo(-5*u,12*u); ctx.lineTo(5*u,12*u); ctx.lineTo(8*u,-4*u); ctx.lineTo(-8*u,-4*u); ctx.closePath(); ctx.fill();
    /* arms */
    const ch = princess.cheer;
    limb( 5*u,-2*u,  9*u+ch*3*u,-8*u-ch*4*u, 3*u,'#6b4423');
    limb(-5*u,-2*u, -9*u,-4*u, 3*u,'#6b4423');
    /* head */
    ctx.fillStyle='#6b4423'; ctx.fillRect(-2*u,-6*u,4*u,3*u);
    ctx.fillStyle='#7a4f2a'; ctx.beginPath(); ctx.arc(0,-10*u,5*u,0,Math.PI*2); ctx.fill();
    /* curly hair */
    ctx.fillStyle='#3a2412';
    for (const [cx,cy] of [[-5,-13],[0,-15],[5,-13],[-6,-10],[6,-10],[-4,-7],[4,-7],[0,-16],[-7,-12],[7,-12]])
      { ctx.beginPath(); ctx.arc(cx*u,cy*u,3*u,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#5a3a1a';
    for (const [cx,cy] of [[-3,-14],[3,-14],[0,-12]])
      { ctx.beginPath(); ctx.arc(cx*u,cy*u,1.4*u,0,Math.PI*2); ctx.fill(); }
    /* face */
    ctx.fillStyle='#2b2440';
    ctx.beginPath(); ctx.arc(-1.6*u,-10*u,.7*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 1.6*u,-10*u,.7*u,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2b2440'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,-8.5*u,1.4*u,.2,Math.PI-.2); ctx.stroke();
    /* crown */
    ctx.fillStyle='#f5c542';
    ctx.beginPath(); ctx.moveTo(-5*u,-13*u); ctx.lineTo(-5*u,-16*u); ctx.lineTo(0,-18*u);
    ctx.lineTo(5*u,-16*u); ctx.lineTo(5*u,-13*u); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff7eb6'; ctx.beginPath(); ctx.arc(0,-16*u,.8*u,0,Math.PI*2); ctx.fill();
    ctx.restore(); ctx.restore();
  }

  /* ── Giant ── */
  function drawGiant(gx, baseY) {
    if (giant.fade <= 0.01) return;
    const u = H/100;
    const breathe = Math.sin(stateTime*1.6)*.02;
    const sY = (1+breathe)*(1-giant.shrink*.45);
    const sX = (1-breathe*.4)*(1-giant.shrink*.45);
    const dip = giant.stompT>0 ? Math.sin((1-giant.stompT/.5)*Math.PI)*-6*u : 0;
    const shX = giant.shakeT>0 ? Math.sin(stateTime*40)*3*u*(giant.shakeT/.6) : 0;
    const lB  = giant.laughT>0 ? Math.abs(Math.sin(stateTime*10))*4*u : 0;
    ctx.save();
    ctx.globalAlpha = giant.fade;
    ctx.translate(gx+shX, baseY+dip-lB);
    ctx.scale(sX, sY);
    /* shadow */
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0,2*u,22*u,4*u,0,0,Math.PI*2); ctx.fill();
    /* legs */
    ctx.fillStyle='#5a7d3a'; ctx.fillRect(-14*u,-22*u,9*u,22*u); ctx.fillRect(5*u,-22*u,9*u,22*u);
    ctx.fillStyle='#3a5a26';
    ctx.beginPath(); ctx.ellipse(-9*u,0,8*u,3*u,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10*u,0,8*u,3*u,0,0,Math.PI*2); ctx.fill();
    /* body */
    ctx.fillStyle='#7a9b4a'; ctx.beginPath(); ctx.roundRect(-20*u,-52*u,40*u,32*u,10*u); ctx.fill();
    ctx.fillStyle='#3a5a26'; ctx.fillRect(-20*u,-26*u,40*u,3*u);
    /* arms */
    const au = clamp(giant.armUp+(giant.laughT>0?.6:0),0,1);
    limb(18*u,-46*u, 26*u+au*6*u,-56*u-au*14*u, 7*u,'#7a9b4a');
    limb(-18*u,-46*u,-26*u-au*6*u,-56*u-au*14*u, 7*u,'#7a9b4a');
    ctx.fillStyle='#6b8a3a';
    ctx.beginPath(); ctx.arc( 26*u+au*6*u,-56*u-au*14*u,4*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-26*u-au*6*u,-56*u-au*14*u,4*u,0,Math.PI*2); ctx.fill();
    /* head */
    ctx.fillStyle='#8fb05a'; ctx.beginPath(); ctx.arc(0,-60*u,13*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-13*u,-60*u,3*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 13*u,-60*u,3*u,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a5a26';
    ctx.beginPath(); ctx.arc(-6*u,-71*u,4*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 2*u,-72*u,4*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 7*u,-70*u,3*u,0,Math.PI*2); ctx.fill();
    /* eyes */
    const ey=-62*u;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-5*u,ey,3*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 5*u,ey,3*u,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2b2440';
    ctx.beginPath(); ctx.arc(-5*u+u,ey,1.4*u,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 5*u+u,ey,1.4*u,0,Math.PI*2); ctx.fill();
    /* brows */
    ctx.strokeStyle='#3a5a26'; ctx.lineWidth=2;
    const br = giant.stompT>0 ? -2*u : (giant.laughT>0 ? -4*u : -3*u);
    ctx.beginPath(); ctx.moveTo(-8*u,ey-4*u); ctx.lineTo(-2*u,br+ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 8*u,ey-4*u); ctx.lineTo( 2*u,br+ey); ctx.stroke();
    /* mouth */
    const mo = clamp(giant.mouthOpen+(giant.laughT>0?.6:0),0,1);
    ctx.fillStyle='#3a2a1a'; ctx.beginPath();
    if (mo>.05) {
      ctx.ellipse(0,-54*u,4*u,2*u+mo*4*u,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e0526a'; ctx.beginPath(); ctx.ellipse(0,-52*u+mo*2*u,2.5*u,1.5*u,0,0,Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle='#2b2440'; ctx.lineWidth=2;
      ctx.arc(0,-55*u,4*u,.2,Math.PI-.2); ctx.stroke();
    }
    ctx.restore();
  }

  /* little happy hop shared by the prince and the princess while they hug */
  function hugHop() {
    return state===ST.HUG ? Math.abs(Math.sin(stateTime*5))*H*.03 : 0;
  }

  /* ── Free-walking princess (comes out of the tower door and walks to the prince) ── */
  function drawFreePrincess(px, py) {
    const u = H/100, s = 0.8;
    const hugging = (state===ST.HUG || state===ST.WIN);
    const sw = hugging ? 0 : Math.sin(princess.walkPhase) * .5;
    const bounce = state===ST.HUG ? hugHop()
                 : (state===ST.PRINCESS_WALK ? Math.abs(Math.sin(princess.walkPhase))*H*.008 : 0);
    /* She always faces LEFT, toward the prince (he is on her left, facing right) */
    const facing = -1;
    ctx.save();
    ctx.globalAlpha = clamp(princess.outT/.35, 0, 1);   /* fades in as she steps out of the door */
    ctx.translate(px, py - bounce);
    ctx.scale(facing * s, s);
    /* legs */
    limb(0,-16*u,  sw*7*u, 0, 4*u,'#ff7eb6');
    limb(0,-16*u, -sw*7*u, 0, 4*u,'#ff7eb6');
    /* dress (wider cone) */
    ctx.fillStyle='#ff7eb6';
    ctx.beginPath(); ctx.moveTo(-9*u,0); ctx.lineTo(9*u,0); ctx.lineTo(7*u,-16*u); ctx.lineTo(-7*u,-16*u); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)'; /* sheen */
    ctx.beginPath(); ctx.moveTo(-7*u,-16*u); ctx.lineTo(-3*u,0); ctx.lineTo(-9*u,0); ctx.closePath(); ctx.fill();
    /* body */
    ctx.fillStyle='#ff7eb6'; ctx.fillRect(-5*u,-28*u,10*u,13*u);
    /* arms — wave while walking, reach toward the prince in the hug */
    if (hugging) {
      limb(5*u,-27*u, 14*u,-28*u, 3.5*u,'#7a4f2a');
      limb(4*u,-24*u, 13*u,-24*u, 3.5*u,'#7a4f2a');
    } else {
      limb(-6*u,-26*u,-12*u,-34*u-Math.sin(princess.walkPhase*6)*.3*4*u, 3.5*u,'#7a4f2a');
      limb( 6*u,-26*u, 10*u,-20*u, 3.5*u,'#7a4f2a');
    }
    /* head */
    ctx.save(); ctx.translate(0,-32*u);
    ctx.fillStyle='#6b4423'; ctx.fillRect(-2*u,0,4*u,3*u);
    ctx.fillStyle='#7a4f2a'; ctx.beginPath(); ctx.arc(0,-4*u,5*u,0,Math.PI*2); ctx.fill();
    /* curly hair cluster */
    ctx.fillStyle='#3a2412';
    for (const [cx2,cy] of [[-4,-7],[0,-9],[4,-7],[-5,-5],[5,-5],[0,-11],[-3,-10],[3,-10]])
      { ctx.beginPath(); ctx.arc(cx2*u,cy*u,3*u,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#5a3a1a';
    for (const [cx2,cy] of [[-2,-9],[2,-9],[0,-7]])
      { ctx.beginPath(); ctx.arc(cx2*u,cy*u,1.5*u,0,Math.PI*2); ctx.fill(); }
    /* face — eyes + smile */
    ctx.fillStyle='#2b2440';
    ctx.beginPath(); ctx.arc(2.4*u,-4*u,.7*u,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2b2440'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(2*u,-2.5*u,1.4*u,.2,Math.PI-.2); ctx.stroke();
    /* crown */
    ctx.fillStyle='#f5c542';
    ctx.beginPath(); ctx.moveTo(-4*u,-8*u); ctx.lineTo(-4*u,-10.5*u); ctx.lineTo(0,-12.5*u);
    ctx.lineTo(4*u,-10.5*u); ctx.lineTo(4*u,-8*u); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff7eb6'; ctx.beginPath(); ctx.arc(0,-10.5*u,.8*u,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ── Particles ── */
  function spawnConfetti(n) {
    const cols=['#f5c542','#ff7eb6','#2a5bd6','#7cbf6a','#e0526a','#9b6ad8'];
    for (let i=0;i<n;i++)
      confetti.push({ x:rand(W*.1,W*.95), y:-rand(0,H*.3), vx:rand(-40,40), vy:rand(40,130), rot:rand(0,Math.PI*2), vr:rand(-7,7), size:rand(4,10), color:cols[(Math.random()*cols.length)|0] });
  }
  function spawnFloatHearts(n) {
    for (let i=0;i<n;i++)
      floatHearts.push({ x:rand(W*.45,W*.85), y:world.groundY-rand(0,H*.1), vy:-rand(30,80), vx:rand(-12,12), size:rand(9,18), life:1, color:Math.random()<.5?'#ff7eb6':'#e0526a' });
  }
  function updateParticles(dt) {
    for (let i=confetti.length-1;i>=0;i--) {
      const p=confetti[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=65*dt; p.rot+=p.vr*dt;
      if (p.y>H+30) confetti.splice(i,1);
    }
    for (let i=floatHearts.length-1;i>=0;i--) {
      const p=floatHearts[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*.4;
      if (p.life<=0) floatHearts.splice(i,1);
    }
  }
  function drawParticles() {
    for (const p of confetti) {
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.6);
      ctx.restore();
    }
    for (const p of floatHearts) {
      ctx.save(); ctx.globalAlpha=clamp(p.life,0,1);
      ctx.translate(p.x,p.y); ctx.scale(p.size/10,p.size/10);
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.moveTo(0,3); ctx.bezierCurveTo(-5,-3,-8,2,0,8); ctx.bezierCurveTo(8,2,5,-3,0,3); ctx.fill();
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════
     STORY / SIMULATION
     ══════════════════════════════════════════════════════════ */

  function storyAction(st) {
    if (st===ST.WALK||st===ST.WALK2) return 'walk';
    if (st===ST.RESCUE) return prince.x < world.rescueX ? 'walk' : 'idle';  /* stop "walking on the spot" */
    if (st===ST.JUMP) return 'jump';
    return 'idle';
  }

  /* No manual Jump / Wave during the ending, so it cannot be spoiled */
  function endingLocked() {
    return state===ST.DOOR_OPEN||state===ST.PRINCESS_WALK||state===ST.HUG||state===ST.WIN||state===ST.GAMEOVER;
  }

  /* point the camera at world-x `fx` with zoom `s` (kept inside the scene) */
  function focusCam(fx, s, camY) {
    const maxShift = (s-1)*W/2;
    cam.targetScale = s;
    cam.targetX = clamp(-s*(fx - W/2), -maxShift, maxShift);
    cam.targetY = camY;
  }

  function update(dt) {
    stateTime += dt;
    layout();
    pumpSay();

    /* clouds drift */
    for (const c of world.clouds) { c.x += c.speed*dt*.4; if (c.x>W+60) c.x=-60; }

    /* phase timers */
    const mv = prince.action==='walk';
    prince.phase     += dt*(mv?9:3);
    prince.capePhase += dt*(mv?6:2.5);
    princess.bob     += dt*3;
    /* window princess cheers from the moment the giant is beaten until she goes down */
    princess.cheer    = lerp(princess.cheer, (state===ST.GIANT_DEFEATED||state===ST.RESCUE||state===ST.DOOR_OPEN)?1:0, dt*4);
    if (state===ST.PRINCESS_WALK) princess.walkPhase += dt*9;
    if (princess.out) princess.outT += dt;

    if (prince.manualTimer>0) { prince.manualTimer-=dt; if(prince.manualTimer<=0) prince.manualType=null; }

    /* giant timers */
    if (giant.shakeT>0) giant.shakeT=Math.max(0,giant.shakeT-dt);
    if (giant.stompT>0) giant.stompT=Math.max(0,giant.stompT-dt);
    if (giant.laughT>0) giant.laughT=Math.max(0,giant.laughT-dt);
    giant.mouthOpen = lerp(giant.mouthOpen,0,dt*3);
    giant.armUp     = lerp(giant.armUp,0,dt*3);
    if (screenShakeT>0) screenShakeT=Math.max(0,screenShakeT-dt);

    /* jump physics */
    if (prince.onGround) {
      prince.y = world.groundY;
    } else {
      prince.vy += H*3.0*dt;
      prince.y  += prince.vy*dt;
      if (prince.y >= world.groundY) {
        prince.y=world.groundY; prince.vy=0; prince.onGround=true; prince.scale=1;
        if (state===ST.JUMP) enter(ST.PAST_OBS);
        else if (prince.manualType===null) prince.action=storyAction(state);
      } else {
        prince.scale = lerp(prince.scale, prince.vy<0?1.06:.96, dt*8);
      }
    }
    if (prince.onGround) {
      if      (prince.manualType==='wave') prince.action='wave';
      else prince.action = storyAction(state);
    }

    /* story */
    if (playing) updateStory(dt);

    /* tower door: opens during DOOR_OPEN and stays open afterwards */
    const doorWanted = (state===ST.DOOR_OPEN && stateTime>1) ||
                       state===ST.PRINCESS_WALK || state===ST.HUG || state===ST.WIN;
    door.open = lerp(door.open, doorWanted?1:0, dt*3);

    /* the prince hops together with the princess while hugging */
    if (state===ST.HUG && prince.onGround) prince.y = world.groundY - hugHop();

    /* camera lerp toward target (finale zoom) */
    cam.x     = lerp(cam.x,     cam.targetX,     dt*1.4);
    cam.y     = lerp(cam.y,     cam.targetY,     dt*1.4);
    cam.scale = lerp(cam.scale, cam.targetScale,  dt*1.4);

    /* giant fade — runs every frame so it completes even after state changes */
    if (giant.fading) giant.fade = Math.max(0, giant.fade - dt * 2.2);

    updateParticles(dt);
  }

  function updateStory(dt) {
    switch (state) {
      case ST.INTRO:        break;
      case ST.WALK:         prince.x += W*.07*dt; if(prince.x >= world.obstacleX-W*.05){ prince.x=world.obstacleX-W*.05; enter(ST.AT_OBSTACLE); } break;
      case ST.AT_OBSTACLE:  break;
      case ST.JUMP:         prince.x += W*.05*dt; break;
      case ST.PAST_OBS:     break;
      case ST.WALK2:        prince.x += W*.07*dt; if(prince.x >= world.stopX){ prince.x=world.stopX; enter(ST.AT_GATE); } break;
      case ST.AT_GATE:      if(stateTime>2.4&&!battle){ enter(ST.RIDDLES); startRiddles(); } break;
      case ST.RIDDLES:      break;
      case ST.GIANT_DEFEATED:
        break;

      /* 1) Prince walks to the tower (he stops on the LEFT of it; before, he
            walked past the tower and ended up on its right side) */
      case ST.RESCUE:
        prince.x = Math.min(world.rescueX, prince.x + W*.06*dt);
        if (prince.x >= world.rescueX && sayDone()) enter(ST.DOOR_OPEN);
        break;

      /* 2) The tower door swings open; the princess in the window goes down */
      case ST.DOOR_OPEN:
        focusCam(world.towerDoorX - W*.1, 1.25, -H*.04);
        if (door.open > .9 && sayDone()) enter(ST.PRINCESS_WALK);
        break;

      /* 3) Princess steps out of the door and walks left to the prince.
            She moves at a constant speed, so she always arrives. */
      case ST.PRINCESS_WALK: {
        const tx = prince.x + world.hugGap;
        princess.x = Math.max(tx, princess.x - W*.06*dt);
        focusCam((prince.x + princess.x)/2, 1.3, -H*.06);
        if (princess.x <= tx + .5) { princess.x = tx; enter(ST.HUG); }
        break;
      }

      /* 4) They hug; confetti and hearts; then the game ends */
      case ST.HUG:
        focusCam((prince.x + princess.x)/2, 1.4, -H*.08);
        spawnFloatHearts(Math.random()<.15 ? 1 : 0);
        if (Math.random()<.3) spawnConfetti(4);
        if (stateTime>3 && sayDone()) enter(ST.WIN);
        break;

      /* 5) The End */
      case ST.WIN: break;
    }
  }

  function enter(next) {
    state=next; stateTime=0;
    if (ui) ui.setStoryLabel(LABELS[next]||'');
    if (next===ST.INTRO)
      say('James Arthur','Greetings! I am Prince James Arthur. Click Walk to begin the quest!');
    else if (next===ST.WALK)
      say('James Arthur',"I'm on my way, Princess! Nothing will stop me!");
    else if (next===ST.AT_OBSTACLE)
      say('James Arthur','A log blocks my path — I must Jump over it!');
    else if (next===ST.PAST_OBS)
      say('James Arthur','Made it! Click Walk to continue toward the castle.');
    else if (next===ST.AT_GATE)
      say('The Giant','HALT! None shall pass unless you answer my THREE riddles!');
    else if (next===ST.GIANT_DEFEATED) {
      giant.laughT=1.8; giant.mouthOpen=.7; giant.armUp=.8; giant.fading=true;
      say('The Giant','Hahaha! Beaten by wit! You may pass, clever prince — click Walk!');
    }
    else if (next===ST.RESCUE)
      say('James Arthur',"I'm coming, Claida! Hold on!");
    else if (next===ST.DOOR_OPEN)
      say('Princess Claida',"I hear you, James Arthur! I'm coming down the stairs!");
    else if (next===ST.PRINCESS_WALK) {
      /* She appears in the open doorway and walks toward the prince */
      princess.out = true; princess.outT = 0; princess.walkPhase = 0;
      princess.x = world.towerDoorX;
      princess.y = world.groundY;
      say('Princess Claida','James Arthur! You came for me!');
    }
    else if (next===ST.HUG) {
      princess.x = prince.x + world.hugGap;
      princess.y = world.groundY;
      say('James Arthur','Claida! The kingdom is saved — together at last!');
      spawnConfetti(30);
      spawnFloatHearts(8);
    }
    else if (next===ST.WIN)
      ui.showWinOverlay('Princess Claida Violet is rescued and the kingdom rejoices!', reset);
    else if (next===ST.GAMEOVER)
      ui.showGameOverOverlay('James Arthur has run out of hearts. But every hero rises again!', reset);
  }

  /* ── User commands ── */
  function doJump() {
    if (!prince.onGround) return;
    prince.onGround=false; prince.vy=-H*1.05; prince.action='jump'; prince.scale=1.06;
  }
  function commandWalk() {
    if (state===ST.INTRO) { playing=true; ui.setPlayState(true); enter(ST.WALK); }
    else if (state===ST.PAST_OBS) { playing=true; enter(ST.WALK2); }
    else if (state===ST.GIANT_DEFEATED && stateTime>1) { playing=true; enter(ST.RESCUE); }
  }
  function commandJump() {
    if (state===ST.AT_OBSTACLE) { playing=true; doJump(); enter(ST.JUMP); }
    else if (!endingLocked() && prince.onGround) doJump();
  }
  function commandWave() {
    if (endingLocked()) return;
    prince.manualType='wave'; prince.manualTimer=1.8; prince.phase=0;
  }

  /* ── Riddle battle wiring ── */
  function startRiddles() {
    battle = new RiddleBattle(ui, {
      onCorrect: () => {
        giant.shakeT=.6;
        giant.shrink=clamp(giant.shrink+.18,0,.85);
      },
      onWrong: () => {
        giant.stompT=.5; giant.mouthOpen=.5; screenShakeT=.4;
        ui.shakeStage();
      },
      onAllCorrect: () => { enter(ST.GIANT_DEFEATED); },
      onGameOver:   () => { enter(ST.GAMEOVER); }
    });
    battle.start();
  }

  /* ── Render ── */
  function draw() {
    ctx.clearRect(0,0,W,H);
    let sx=0,sy=0;
    if (screenShakeT>0) {
      const m=screenShakeT/.4;
      sx=Math.sin(stateTime*60)*6*m; sy=Math.cos(stateTime*55)*4*m;
    }
    ctx.save();
    /* apply camera zoom + screen-shake */
    ctx.translate(W/2 + cam.x + sx, H/2 + cam.y + sy);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-W/2, -H/2);
    drawScene();
    drawPrince();
    /* the princess outside the tower (from the moment she steps out of the door) */
    if (princess.out) drawFreePrincess(princess.x, princess.y);
    drawParticles();
    ctx.restore();
  }

  /* ── Loop ── */
  function loop(now) {
    if (!running) return;
    let dt = (now - lastT) / 1000; lastT = now;
    if (dt > .1) dt = .1;
    update(playing ? dt * speedMul : 0);
    draw();
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running=true; lastT=performance.now(); rafId=requestAnimationFrame(loop); } }
  function stop()  { running=false; cancelAnimationFrame(rafId); }

  /* ══════════════════════════════════════════════════════════
     FULL-SCREEN MODE
     • Button (top-right of the stage) or the F key → full screen
     • Esc (handled by the browser) or the "Exit" button → back to normal
     • The whole control bar (Pause, Replay, Speed, Walk, Jump, Wave…) is
       moved INTO the full-screen area, under the game, and put back in its
       original place when you leave. Falls back to a "fake" full screen
       (fixed overlay) on browsers without the Fullscreen API (e.g. iPhone).
     ══════════════════════════════════════════════════════════ */
  function setupFullscreen(stage, controls, opts) {
    opts = opts || {};
    if (!stage || stage.__fsReady) return;
    stage.__fsReady = true;

    if (!document.getElementById('fs-style')) {
      const st = document.createElement('style');
      st.id = 'fs-style';
      st.textContent = [
        '.fs-btn{position:absolute;top:10px;right:10px;z-index:60;padding:7px 14px;border:0;border-radius:999px;',
        '  background:rgba(20,26,51,.78);color:#fff;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;',
        '  box-shadow:0 2px 8px rgba(0,0,0,.25);backdrop-filter:blur(4px)}',
        '.fs-btn:hover{background:rgba(20,26,51,.95)}',
        '.fs-wrap{display:flex;flex-direction:column;gap:10px;padding:10px;box-sizing:border-box;',
        '  background:#10162f;width:100%;height:100%}',
        '.fs-wrap:fullscreen{width:100vw;height:100vh}',
        '.fs-wrap:-webkit-full-screen{width:100vw;height:100vh}',
        '.fs-wrap.fs-fake{position:fixed;inset:0;z-index:9999;width:100vw;height:100vh}',
        '.fs-wrap > .fs-stage{flex:1 1 auto!important;min-height:0!important;width:100%!important;',
        '  max-width:none!important;height:auto!important;max-height:none!important;',
        '  aspect-ratio:auto!important;margin:0!important;overflow:hidden}',
        '.fs-wrap > .fs-stage canvas{width:100%!important;height:100%!important;display:block}',
        '.fs-wrap > .fs-controls{flex:0 0 auto!important;position:relative!important;top:auto!important;',
        '  right:auto!important;bottom:auto!important;left:auto!important;transform:none!important;',
        '  margin:0 auto!important;max-width:100%!important}'
      ].join('\n');
      document.head.appendChild(st);
    }
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'fs-btn';
    stage.appendChild(btn);

    let wrap = null, home = null, active = false, fake = false;
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    function label() {
      btn.textContent = active ? '✕ Exit full screen' : '⛶ Full screen';
      btn.title = active ? 'Exit full screen (Esc)' : 'Full screen (F)';
      btn.setAttribute('aria-label', btn.title);
    }
    /* let the game re-measure its canvas once the layout has settled */
    function nudge() {
      const go = () => { if (opts.beforeResize) opts.beforeResize(); window.dispatchEvent(new Event('resize')); };
      go(); requestAnimationFrame(go); setTimeout(go, 160);
    }

    /* put stage + controls inside a wrapper (this wrapper is what goes full screen) */
    function mount() {
      home = { cP: controls ? controls.parentNode : null, cN: controls ? controls.nextSibling : null };
      wrap = document.createElement('div');
      wrap.className = 'fs-wrap';
      stage.parentNode.insertBefore(wrap, stage);
      stage.classList.add('fs-stage');   wrap.appendChild(stage);
      if (controls) { controls.classList.add('fs-controls'); wrap.appendChild(controls); }
      active = true; label();
    }
    /* …and put everything back exactly where it was */
    function unmount() {
      if (!active) return;
      stage.classList.remove('fs-stage');
      wrap.parentNode.insertBefore(stage, wrap);
      if (controls) {
        controls.classList.remove('fs-controls');
        home.cP.insertBefore(controls, home.cN && home.cN.parentNode === home.cP ? home.cN : null);
      }
      wrap.parentNode.removeChild(wrap);
      wrap = null; active = false;
      if (fake) { fake = false; document.body.style.overflow = ''; }
      label(); nudge();
    }

    function useFake() {
      if (!active) return;
      fake = true; wrap.classList.add('fs-fake');
      document.body.style.overflow = 'hidden';
      label(); nudge();
    }
    function enter() {
      if (active) return;
      mount();
      const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
      if (!req) { useFake(); return; }
      try {
        const p = req.call(wrap);
        if (p && p.catch) p.catch(() => { if (active && !fsElement()) useFake(); });
      } catch (e) { useFake(); }
      nudge();
    }
    function leave() {
      if (!active) return;
      if (!fake && fsElement()) {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {} return; }
      }
      unmount();
    }
    function toggle() { active ? leave() : enter(); }

    btn.addEventListener('click', e => { e.stopPropagation(); toggle(); btn.blur(); });

    /* user pressed Esc (or the browser left full screen by itself) */
    function onFsChange() {
      if (active && !fake && fsElement() !== wrap) unmount();
      else nudge();
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && active && fake) { leave(); return; }
      const tag = (e.target && e.target.tagName) || '';
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey &&
          !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) toggle();
    });

    label();
  }

  /* ── UI init ── */
  function initUI() {
    const stage    = document.getElementById('stage');
    const controls = document.getElementById('controls');
    ui = new StageUI(stage, controls, {
      hasCameraReset: false,
      switchTarget:   '3d',
      switchLabel:    '🏰 Go 3D',
      handlers: {
        onPlayPause:   () => { playing=!playing; ui.setPlayState(playing); },
        onReplay:      () => reset(),
        onWalk:        () => commandWalk(),
        onJump:        () => commandJump(),
        onWave:        () => commandWave(),
        onSpeedChange: v  => { speedMul=v; }
      }
    });
    ui.setPlayState(playing);

    /* full-screen: stage + control bar go full screen together */
    setupFullscreen(stage, controls, {});

    bindKeys({
      onPlayPause:    () => { playing=!playing; ui.setPlayState(playing); },
      onReplay:       () => reset(),
      onWalk:         () => commandWalk(),
      onJump:         () => commandJump(),
      onWave:         () => commandWave(),
      onRiddleAnswer: i  => { if (battle&&battle.active) battle.answer(i); }
    });
  }

  /* ── Reset ── */
  function reset() {
    stop();
    state=ST.INTRO; stateTime=0; playing=true; speedMul=ui?ui.getSpeed():1;
    prince.x=W*.08; prince.y=world.groundY||H*.80;
    prince.vy=0; prince.onGround=true; prince.scale=1;
    prince.action='idle'; prince.manualType=null; prince.manualTimer=0;
    giant.shakeT=giant.stompT=giant.laughT=0;
    giant.shrink=0; giant.retreatX=0; giant.fade=1; giant.fading=false; giant.mouthOpen=giant.armUp=0;
    princess.bob=0; princess.cheer=0;
    princess.out=false; princess.outT=0; princess.x=0; princess.y=0; princess.walkPhase=0;
    door.open=0;
    sayQueue.length=0; sayBusyUntil=0;
    confetti.length=0; floatHearts.length=0;
    battle=null; screenShakeT=0;
    cam.x=0; cam.y=0; cam.scale=1; cam.targetX=0; cam.targetY=0; cam.targetScale=1;
    if (ui) {
      ui.setPlayState(true); ui.setHearts(3);
      ui.setStoryLabel(LABELS.intro); ui.hideDialogue();
      ui.hideOverlays(); ui.hideResult();
    }
    enter(ST.INTRO);
    start();
  }

  /* ── Boot ── */
  function boot() {
    resize(); layout(); initUI();
    prince.x=W*.08; prince.y=world.groundY;
    enter(ST.INTRO); start();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
