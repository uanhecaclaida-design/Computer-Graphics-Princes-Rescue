/* ============================================================
 * animation3d.js — Three.js 3D scene for "The Prince's Rescue"
 *
 * Computer-graphics concepts used:
 *   • Scene graph     – characters built as Group hierarchies
 *   • Primitives      – spheres, boxes, cylinders, cones
 *   • Lighting        – ambient + directional with shadow maps
 *   • Animation loop  – delta-time requestAnimationFrame
 *   • Particle system – THREE.Points confetti cloud
 *   • Camera zoom     – finale smoothly tweens camera toward the reunion
 *   • OrbitControls   – mouse rotate / zoom
 *
 * Final sequence (fixed):
 *   giant defeated → prince walks to the tower → tower door OPENS →
 *   princess comes DOWN and walks out → they HUG → game ends (WIN).
 * ============================================================ */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    document.getElementById('threeCanvas').parentElement.innerHTML =
      '<p style="color:#fff;padding:30px;text-align:center">Three.js could not load from the CDN. Please check your connection.</p>';
    return;
  }

  /* ── Story states ── */
  const ST = {
    INTRO:'intro', WALK:'walk', AT_OBSTACLE:'atObstacle',
    JUMP:'jump', PAST_OBS:'pastObs', WALK2:'walk2',
    AT_GATE:'atGate', RIDDLES:'riddles',
    GIANT_DEFEATED:'giantDefeated', RESCUE:'rescue',
    DOOR_OPEN:'doorOpen',
    PRINCESS_WALK:'princessWalk', HUG:'hug',
    WIN:'win', GAMEOVER:'gameover'
  };
  const LABELS = {
    intro:'Chapter 1 — Click Walk to begin', walk:'Chapter 2 — On the Road',
    atObstacle:'Chapter 2 — Click Jump!', jump:'Chapter 2 — Over the Obstacle',
    pastObs:'Chapter 3 — Click Walk', walk2:'Chapter 3 — Approaching the Gate',
    atGate:"Chapter 4 — The Giant's Challenge", riddles:'Chapter 4 — Answer the Riddles',
    giantDefeated:'Chapter 5 — Click Walk to the tower', rescue:'Chapter 6 — To the Tower',
    doorOpen:'Chapter 6 — The Tower Door Opens!',
    princessWalk:'Chapter 6 — The Princess Descends!', hug:'Chapter 6 — Reunited! ❤',
    win:'The End', gameover:'Game Over'
  };

  /* ── Finale layout constants ── */
  const RESCUE_X = 4.0;   /* where the prince stops in front of the tower        */
  const HUG_GAP  = 0.95;  /* distance between prince and princess when they meet */
  const HUG_Z    = 0.0;   /* depth (z) where the hug happens                     */

  /* ── Renderer setup ── */
  const canvas = document.getElementById('threeCanvas');
  let W = canvas.clientWidth  || 800;
  let H = canvas.clientHeight || 450;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0ff);
  scene.fog = new THREE.Fog(0xbfe3ff, 30, 150);

  /* ── Camera ── */
  const camera = new THREE.PerspectiveCamera(50, W/H, .1, 500);
  const camHome   = new THREE.Vector3(-2, 8, 22);
  const camFinale = new THREE.Vector3(6, 4.5, 12);   /* zoom toward the reunion */
  const baseTarget   = new THREE.Vector3(0, 2, 0);
  const finaleTarget = new THREE.Vector3(5.5, 2, .5);
  camera.position.copy(camHome);
  let camTargetPos = camHome.clone();
  let camTargetLook = baseTarget.clone();

  const oc = new THREE.OrbitControls(camera, renderer.domElement);
  oc.target.copy(baseTarget); oc.enableDamping=true; oc.dampingFactor=.08; oc.update();

  function onResize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (W>0&&H>0) { camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H); }
  }
  window.addEventListener('resize', onResize);

  /* ── Lights ── */
  scene.add(new THREE.AmbientLight(0xffffff, .6));
  const sun = new THREE.DirectionalLight(0xfff2cc, .95);
  sun.position.set(12,20,10); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  ['left','right','top','bottom'].forEach((k,i)=>{ sun.shadow.camera[k]=[-30,30,30,-30][i]; });
  sun.shadow.camera.near=1; sun.shadow.camera.far=90;
  scene.add(sun);

  /* ── Shared material factory ── */
  const M = {};
  const mats = {
    skin:'#f7d2ad', shirt:'#fdfdff', trouser:'#2b2a3a', cape:'#1d3b8a',
    gold:'#f5c542', dark:'#2b2440', hair:'#5a3a1a',
    gSkin:'#8fb05a', gDark:'#5a7d3a', gFoot:'#3a5a26', eyeW:'#ffffff',
    wall:'#c9b6e0', tower:'#d8c6ec', roof:'#e0526a', gate:'#5a3a2a',
    win:'#3a2a4a', log:'#8a5a2b', boot:'#3a2a1a',
    pSkin:'#7a4f2a', pDress:'#ff7eb6', pHair:'#3a2412', ground:'#6cb24a'
  };
  Object.entries(mats).forEach(([k,v])=>{ M[k]=new THREE.MeshStandardMaterial({color:v}); });
  M.cape.side = THREE.DoubleSide;

  function mesh(geo, mat, x=0, y=0, z=0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true; return m;
  }
  function armGroup(w, h, mat) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,w), mat);
    m.position.y = -h/2; m.castShadow=true; g.add(m); return g;
  }

  /* ── Ground ── */
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(400,400), M.ground);
  gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd);

  /* ── Castle ── */
  const castle = new THREE.Group(); scene.add(castle);
  castle.add(mesh(new THREE.BoxGeometry(2.6,4,.5), M.wall, 7,2,0));
  for(let i=0;i<3;i++) castle.add(mesh(new THREE.BoxGeometry(.5,.5,.5),M.wall,6+i*.7,4.25,0));
  castle.add(mesh(new THREE.BoxGeometry(1.4,2.4,.6), M.gate, 7,1.2,.28));
  castle.add(mesh(new THREE.CylinderGeometry(.8,.9,7,16), M.tower, 7,3.5,1));
  castle.add(mesh(new THREE.ConeGeometry(1,1.8,16), M.roof, 7,7.9,1));
  castle.add(mesh(new THREE.CylinderGeometry(.04,.04,1.2,8),M.dark,7,8.9,1));
  castle.add(mesh(new THREE.PlaneGeometry(.6,.4),M.gold,7.25,9,1));
  /* Tower window: a framed niche so the princess looks like she is INSIDE the tower */
  const wy = 4.7;
  castle.add(mesh(new THREE.BoxGeometry(.9,1.4,.05), M.win,  7,    wy,    1.86));  /* dark room behind her */
  castle.add(mesh(new THREE.BoxGeometry(.2,1.8,.7),  M.wall, 6.45, wy,    1.95));  /* left frame  */
  castle.add(mesh(new THREE.BoxGeometry(.2,1.8,.7),  M.wall, 7.55, wy,    1.95));  /* right frame */
  castle.add(mesh(new THREE.BoxGeometry(1.3,.2,.7),  M.wall, 7,    wy+.8, 1.95));  /* top frame   */
  castle.add(mesh(new THREE.BoxGeometry(1.5,.2,.8),  M.wall, 7,    wy-.8, 1.95));  /* sill        */

  /* Tower door at the base. It is hinged on its RIGHT edge so that it swings
     outward (toward the camera) and the princess can walk out of it. */
  const door = { open:0 };                                   /* 0 = closed, 1 = fully open */
  const doorPivot = new THREE.Group();
  doorPivot.position.set(7.4, 0, 1.95);
  castle.add(doorPivot);
  doorPivot.add(mesh(new THREE.BoxGeometry(.8,1.6,.3), M.gate, -.4, .8, 0));
  const archTop = mesh(new THREE.CylinderGeometry(.4,.4,.3,16), M.gate, -.4, 1.6, 0);
  archTop.rotation.x = Math.PI/2; doorPivot.add(archTop);
  /* dark doorway that is revealed once the door swings open */
  castle.add(mesh(new THREE.BoxGeometry(.8,1.6,.1), M.win, 7, .8, 1.93));
  const archDark = mesh(new THREE.CylinderGeometry(.4,.4,.1,16), M.win, 7, 1.6, 1.93);
  archDark.rotation.x = Math.PI/2; castle.add(archDark);

  /* ── Log obstacle ── */
  const log = mesh(new THREE.CylinderGeometry(.5,.5,2.4,12),M.log,-4,.5,0);
  log.rotation.z=Math.PI/2; scene.add(log);

  /* ── Prince ── */
  const prince = new THREE.Group(); scene.add(prince);
  const legL = armGroup(.22,1,M.trouser); legL.position.set(-.22,1,0); prince.add(legL);
  const legR = armGroup(.22,1,M.trouser); legR.position.set( .22,1,0); prince.add(legR);
  prince.add(mesh(new THREE.BoxGeometry(.26,.2,.34),M.boot,-.22,.1,.05));
  prince.add(mesh(new THREE.BoxGeometry(.26,.2,.34),M.boot, .22,.1,.05));
  prince.add(mesh(new THREE.BoxGeometry(.6,.95,.34),M.shirt,0,1.95,0));
  prince.add(mesh(new THREE.BoxGeometry(.62,.12,.36),M.boot,0,1.5,0));
  const cape3 = mesh(new THREE.PlaneGeometry(.7,1.3),M.cape,0,1.9,-.22); prince.add(cape3);
  const armL = armGroup(.16,.8,M.shirt); armL.position.set(-.42,2.3,0); prince.add(armL);
  const armR = armGroup(.16,.8,M.shirt); armR.position.set( .42,2.3,0); prince.add(armR);
  prince.add(mesh(new THREE.SphereGeometry(.3,20,20),M.skin,0,2.75,0));
  prince.add(mesh(new THREE.SphereGeometry(.31,16,16,0,Math.PI*2,0,Math.PI/2),M.hair,0,2.78,0));
  prince.add(mesh(new THREE.CylinderGeometry(.32,.32,.14,12),M.gold,0,3.02,0));
  for(let i=0;i<3;i++) prince.add(mesh(new THREE.ConeGeometry(.06,.18,8),M.gold,-.18+i*.18,3.14,0));
  prince.add(mesh(new THREE.SphereGeometry(.05,8,8),M.dark,-.12,2.78,.27));
  prince.add(mesh(new THREE.SphereGeometry(.05,8,8),M.dark, .12,2.78,.27));

  /* ── Giant ── */
  const giantG = new THREE.Group(); scene.add(giantG); giantG.position.set(4,0,0);
  giantG.add(mesh(new THREE.BoxGeometry(.9,2.4,.9),M.gDark,-.6,1.2,0));
  giantG.add(mesh(new THREE.BoxGeometry(.9,2.4,.9),M.gDark, .6,1.2,0));
  giantG.add(mesh(new THREE.BoxGeometry(1.1,.4,1.2),M.gFoot,-.6,.2,.1));
  giantG.add(mesh(new THREE.BoxGeometry(1.1,.4,1.2),M.gFoot, .6,.2,.1));
  giantG.add(mesh(new THREE.BoxGeometry(3,3.2,1.4),M.gSkin,0,3.8,0));
  giantG.add(mesh(new THREE.BoxGeometry(3.1,.4,1.5),M.gDark,0,2.4,0));
  const gArmL = armGroup(.5,2.4,M.gSkin); gArmL.position.set(-1.7,4.8,0); giantG.add(gArmL);
  const gArmR = armGroup(.5,2.4,M.gSkin); gArmR.position.set( 1.7,4.8,0); giantG.add(gArmR);
  giantG.add(mesh(new THREE.SphereGeometry(1.3,20,20),M.gSkin,0,6.2,0));
  giantG.add(mesh(new THREE.SphereGeometry(.3,12,12),M.eyeW,-.45,6.4,1.05));
  giantG.add(mesh(new THREE.SphereGeometry(.3,12,12),M.eyeW, .45,6.4,1.05));
  giantG.add(mesh(new THREE.SphereGeometry(.14,10,10),M.dark,-.4,6.4,1.25));
  giantG.add(mesh(new THREE.SphereGeometry(.14,10,10),M.dark, .5,6.4,1.25));
  giantG.add(mesh(new THREE.SphereGeometry(.6,12,12),M.gDark,-.4,7.3,0));
  giantG.add(mesh(new THREE.SphereGeometry(.5,12,12),M.gDark, .4,7.4,0));
  /* clone each material only ONCE (it used to clone on every frame) */
  function setGiantAlpha(a) {
    giantG.traverse(c=>{
      if(c.isMesh){
        if(!c.userData.own){ c.material=c.material.clone(); c.userData.own=true; }
        c.material.transparent=true; c.material.opacity=a;
      }
    });
  }

  /* ── Princess ── */
  const princessG = new THREE.Group(); scene.add(princessG); princessG.position.set(7,0,1.7); princessG.visible=false;
  princessG.add(mesh(new THREE.ConeGeometry(.7,1.6,16),M.pDress,0,.8,0));
  /* little shoes peeking out under the dress */
  princessG.add(mesh(new THREE.BoxGeometry(.2,.12,.3),M.boot,-.2,.06,.62));
  princessG.add(mesh(new THREE.BoxGeometry(.2,.12,.3),M.boot, .2,.06,.62));
  princessG.add(mesh(new THREE.CylinderGeometry(.3,.4,.8,12),M.pDress,0,1.5,0));
  princessG.add(mesh(new THREE.SphereGeometry(.4,18,18),M.pSkin,0,2.2,0));
  for(const [cx,cy] of [[-.35,2.5],[.35,2.5],[-.3,2.6],[.3,2.6],[0,2.65],[-.2,2.7],[.2,2.7],[0,2.55]])
    princessG.add(mesh(new THREE.SphereGeometry(.22,10,10),M.pHair,cx,cy,0));
  princessG.add(mesh(new THREE.CylinderGeometry(.42,.42,.12,12),M.gold,0,2.45,0));
  const pArmR = armGroup(.12,.5,M.pSkin); pArmR.position.set(.35,1.6,0); princessG.add(pArmR);
  const pArmL = armGroup(.12,.5,M.pSkin); pArmL.position.set(-.35,1.6,0); princessG.add(pArmL);
  princessG.add(mesh(new THREE.SphereGeometry(.045,8,8),M.dark,-.13,2.25,.36));
  princessG.add(mesh(new THREE.SphereGeometry(.045,8,8),M.dark, .13,2.25,.36));

  /* ── Princess inside the tower window (bust only; the sill hides the rest) ── */
  const princessWin = new THREE.Group(); scene.add(princessWin);
  princessWin.position.set(7,3.8,2.05); princessWin.scale.setScalar(.5);
  princessWin.add(mesh(new THREE.CylinderGeometry(.35,.45,1.2,12),M.pDress,0,.7,0));
  princessWin.add(mesh(new THREE.CylinderGeometry(.3,.4,.8,12),M.pDress,0,1.5,0));
  princessWin.add(mesh(new THREE.SphereGeometry(.4,18,18),M.pSkin,0,2.2,0));
  for(const [cx,cy] of [[-.35,2.5],[.35,2.5],[-.3,2.6],[.3,2.6],[0,2.65],[-.2,2.7],[.2,2.7],[0,2.55]])
    princessWin.add(mesh(new THREE.SphereGeometry(.22,10,10),M.pHair,cx,cy,0));
  princessWin.add(mesh(new THREE.CylinderGeometry(.42,.42,.12,12),M.gold,0,2.45,0));
  princessWin.add(mesh(new THREE.SphereGeometry(.045,8,8),M.dark,-.13,2.25,.36));
  princessWin.add(mesh(new THREE.SphereGeometry(.045,8,8),M.dark, .13,2.25,.36));
  const pwArmR = armGroup(.12,.5,M.pSkin); pwArmR.position.set(.35,1.6,0); princessWin.add(pwArmR);
  const pwArmL = armGroup(.12,.5,M.pSkin); pwArmL.position.set(-.35,1.6,0); princessWin.add(pwArmL);

  /* ── Confetti particle system ── */
  const CMAX = 200;
  const cPos = new Float32Array(CMAX*3), cVel = new Float32Array(CMAX*3), cCol = new Float32Array(CMAX*3);
  for(let i=0;i<CMAX;i++) cPos[i*3+1]=-50;
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos,3));
  cGeo.setAttribute('color',    new THREE.BufferAttribute(cCol,3));
  const cMat = new THREE.PointsMaterial({size:.22,vertexColors:true,sizeAttenuation:true});
  const cPts = new THREE.Points(cGeo,cMat); cPts.frustumCulled=false; scene.add(cPts);
  const cPal=[0xf5c542,0xff7eb6,0x2a5bd6,0x7cbf6a,0xe0526a];
  function spawnConfetti(n){
    for(let k=0;k<n;k++){
      const i=Math.floor(Math.random()*CMAX);
      cPos[i*3]=3+Math.random()*5; cPos[i*3+1]=7+Math.random()*5; cPos[i*3+2]=-1+Math.random()*3;
      cVel[i*3]=(-1+Math.random()*2); cVel[i*3+1]=-1-Math.random()*2; cVel[i*3+2]=(-1+Math.random()*2);
      const c=new THREE.Color(cPal[(Math.random()*cPal.length)|0]); cCol[i*3]=c.r; cCol[i*3+1]=c.g; cCol[i*3+2]=c.b;
    }
    cGeo.attributes.color.needsUpdate=true;
  }
  function updateConfetti(dt){
    for(let i=0;i<CMAX;i++){
      if(cPos[i*3+1]<-5) continue;
      cPos[i*3]+=cVel[i*3]*dt; cPos[i*3+1]+=cVel[i*3+1]*dt; cPos[i*3+2]+=cVel[i*3+2]*dt;
      cVel[i*3+1]-=2*dt;
      if(cPos[i*3+1]<0) cPos[i*3+1]=-50;
    }
    cGeo.attributes.position.needsUpdate=true;
  }

  /* ── State ── */
  const pr = { x:-10, y:0, vy:0, onGround:true, phase:0, action:'idle', manualType:null, manualTimer:0 };
  const gi = { shakeT:0, stompT:0, laughT:0, shrink:0, retreatZ:0, fade:1, pulse:0 };
  let state=ST.INTRO, stateTime=0, playing=true, speedMul=1, screenShakeT=0, battle=null, ui=null;
  let running=false, rafId=null, lastT=0;
  const lerp = (a,b,t)=>a+(b-a)*t;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

  /* ── Dialogue queue ──────────────────────────────────────────────
   * BUG FIX (garbled text such as "J aHmoelsd Aornt!hur!"):
   * the dialogue box types its text letter by letter. When a new line
   * was shown while the previous one was still being typed, the two
   * typewriters wrote into the same box and the letters got mixed up
   * (this is what happened to "James Arthur!" when the Walk to the
   * tower ended quickly). Now every line goes through say(), which waits
   * until the previous line has finished before showing the next one.
   * If the text in your UI types more slowly, increase SAY_MS_PER_CHAR. */
  const SAY_MS_PER_CHAR = 35, SAY_PAD_MS = 400;
  const sayQueue = []; let sayBusyUntil = 0;
  function say(name, text){ sayQueue.push({name, text}); }
  function sayDone(){ return sayQueue.length===0 && performance.now()>=sayBusyUntil; }
  function pumpSay(){
    if(!ui || !sayQueue.length) return;
    const now = performance.now();
    if(now < sayBusyUntil) return;
    const d = sayQueue.shift();
    ui.hideDialogue();
    ui.showDialogue(d.name, d.text);
    sayBusyUntil = now + d.text.length*SAY_MS_PER_CHAR + SAY_PAD_MS;
  }

  function storyAction(st){
    if(st===ST.WALK||st===ST.WALK2) return 'walk';
    if(st===ST.RESCUE) return pr.x<RESCUE_X ? 'walk' : 'idle';   /* stop walking on the spot once he arrives */
    if(st===ST.JUMP) return 'jump';
    return 'idle';
  }

  /* No manual Jump / Wave during the ending, so it cannot be spoiled */
  function endingLocked(){
    return state===ST.DOOR_OPEN||state===ST.PRINCESS_WALK||state===ST.HUG||state===ST.WIN||state===ST.GAMEOVER;
  }

  function doJump(){ if(!pr.onGround)return; pr.onGround=false; pr.vy=6.4; pr.action='jump'; }
  function commandWalk(){
    if(state===ST.INTRO){ playing=true; ui.setPlayState(true); enter(ST.WALK); }
    else if(state===ST.PAST_OBS){ playing=true; enter(ST.WALK2); }
    else if(state===ST.GIANT_DEFEATED&&stateTime>1){ playing=true; enter(ST.RESCUE); }
  }
  function commandJump(){
    if(state===ST.AT_OBSTACLE){ playing=true; ui.setPlayState(true); doJump(); enter(ST.JUMP); }
    else if(!endingLocked() && pr.onGround) doJump();
  }
  function commandWave(){ if(endingLocked()) return; pr.manualType='wave'; pr.manualTimer=1.8; pr.phase=0; }
  function cameraReset(){ camTargetPos.copy(camHome); camTargetLook.copy(baseTarget); }

  function startRiddles(){
    battle=new RiddleBattle(ui,{
      onCorrect:()=>{ gi.shakeT=.6; gi.pulse=.2; gi.shrink=clamp(gi.shrink+.18,0,.85); },
      onWrong:()=>{ gi.stompT=.5; screenShakeT=.4; ui.shakeStage(); },
      onAllCorrect:()=>{ enter(ST.GIANT_DEFEATED); },
      onGameOver:()=>{ enter(ST.GAMEOVER); }
    });
    battle.start();
  }

  function updateStory(dt){
    switch(state){
      case ST.INTRO:        break;
      case ST.WALK:         pr.x+=3.2*dt; if(pr.x>=-4.6){ pr.x=-4.6; enter(ST.AT_OBSTACLE); } break;
      case ST.AT_OBSTACLE:  break;
      case ST.JUMP:         pr.x+=2.2*dt; break;
      case ST.PAST_OBS:     break;
      case ST.WALK2:        pr.x+=3.2*dt; if(pr.x>=2.2){ pr.x=2.2; enter(ST.AT_GATE); } break;
      case ST.AT_GATE:      if(stateTime>2.4&&!battle){ enter(ST.RIDDLES); startRiddles(); } break;
      case ST.RIDDLES:      break;

      case ST.GIANT_DEFEATED:
        /* Fade the giant out completely */
        gi.fade = lerp(gi.fade, 0, dt*2.5);
        setGiantAlpha(gi.fade);
        if(gi.fade<.02) giantG.visible=false;
        break;

      /* 1) Prince walks to the foot of the tower */
      case ST.RESCUE:
        pr.x=Math.min(RESCUE_X, pr.x+2.6*dt);
        if(pr.x>=RESCUE_X && sayDone()) enter(ST.DOOR_OPEN);
        break;

      /* 2) The tower door swings open (the princess in the window "goes down the stairs") */
      case ST.DOOR_OPEN:
        camTargetPos.lerp(camFinale, dt*.5);
        camTargetLook.lerp(finaleTarget, dt*.5);
        if(door.open>.9 && sayDone()) enter(ST.PRINCESS_WALK);
        break;

      /* 3) Princess steps out of the door and walks to the prince.
            She moves at a constant speed toward waypoints, so she always
            arrives (the old version used lerp() and never got there, which
            left the game stuck before the hug). */
      case ST.PRINCESS_WALK: {
        camTargetPos.lerp(camFinale, dt*.8);
        camTargetLook.lerp(finaleTarget, dt*.8);
        const p  = princessG.position;
        const tx = pr.x + HUG_GAP, tz = HUG_Z;
        p.y = Math.abs(Math.sin(stateTime*9))*.06;               /* little walking bounce */
        if(p.z<2.7 && p.x>6.5){
          p.z = Math.min(2.7, p.z + 1.6*dt);                     /* step out of the doorway first */
        } else {
          const gz = (p.x<5.4) ? tz : 2.7;                        /* stay in front of the tower until clear of it */
          const dx = tx-p.x, dz = gz-p.z, d = Math.hypot(dx,dz), sp = 2.2*dt;
          if(d>sp){ p.x+=dx/d*sp; p.z+=dz/d*sp; } else { p.x=tx; p.z=gz; }
          if(Math.abs(p.x-tx)<.02 && Math.abs(p.z-tz)<.02){ p.y=0; enter(ST.HUG); }
        }
        break;
      }

      /* 4) They hug, confetti falls, then the game ends */
      case ST.HUG: {
        camTargetPos.lerp(camFinale, dt*1.2);
        camTargetLook.lerp(finaleTarget, dt*1.2);
        const p = princessG.position;
        p.x = lerp(p.x, pr.x + HUG_GAP - .15, dt*2);             /* step a little closer */
        p.z = lerp(p.z, HUG_Z, dt*2);
        spawnConfetti(3);
        if(stateTime>3 && sayDone()) enter(ST.WIN);
        break;
      }

      /* 5) The End */
      case ST.WIN: break;
    }
  }

  function enter(next){
    state=next; stateTime=0; if(ui) ui.setStoryLabel(LABELS[next]||'');
    if(next===ST.INTRO) say('James Arthur','Greetings! I am Prince James Arthur. Click Walk to begin the quest!');
    else if(next===ST.WALK) say('James Arthur',"I'm on my way, Princess! Nothing will stop me!");
    else if(next===ST.AT_OBSTACLE) say('James Arthur','A log blocks my path — I must Jump over it!');
    else if(next===ST.PAST_OBS) say('James Arthur','Made it! Click Walk to continue toward the castle.');
    else if(next===ST.AT_GATE) say('The Giant','HALT! None shall pass unless you answer my THREE riddles!');
    else if(next===ST.GIANT_DEFEATED){ gi.laughT=1.8; say('The Giant','Hahaha! Beaten by wit! You may pass, clever prince — click Walk!'); }
    else if(next===ST.RESCUE) say('James Arthur',"I'm coming, Claida! Hold on!");
    else if(next===ST.DOOR_OPEN) say('Princess Claida',"I hear you, James Arthur! I'm coming down the stairs!");
    else if(next===ST.PRINCESS_WALK){
      /* she appears in the open doorway (partly inside the tower) and walks out */
      princessG.position.set(7,0,1.7); princessG.rotation.set(0,0,0); princessG.visible=true;
      say('Princess Claida','James Arthur! You came for me!');
    }
    else if(next===ST.HUG){ say('James Arthur','Claida! The kingdom is saved — together at last!'); spawnConfetti(60); }
    else if(next===ST.WIN) ui.showWinOverlay('Princess Claida Violet is rescued and the kingdom rejoices!', reset);
    else if(next===ST.GAMEOVER) ui.showGameOverOverlay('James Arthur has run out of hearts. But every hero rises again!', reset);
  }

  function update(dt){
    stateTime+=dt;
    pumpSay();
    const mv=pr.action==='walk';
    pr.phase+=dt*(mv?9:3);
    if(pr.manualTimer>0){ pr.manualTimer-=dt; if(pr.manualTimer<=0)pr.manualType=null; }
    if(gi.shakeT>0)gi.shakeT=Math.max(0,gi.shakeT-dt);
    if(gi.stompT>0)gi.stompT=Math.max(0,gi.stompT-dt);
    if(gi.laughT>0)gi.laughT=Math.max(0,gi.laughT-dt);
    gi.pulse=lerp(gi.pulse,0,dt*3);
    if(screenShakeT>0)screenShakeT=Math.max(0,screenShakeT-dt);

    if(pr.onGround) pr.y=0;
    else{ pr.vy-=14*dt; pr.y+=pr.vy*dt; if(pr.y<=0){ pr.y=0; pr.vy=0; pr.onGround=true; if(state===ST.JUMP)enter(ST.PAST_OBS); else if(pr.manualType===null)pr.action=storyAction(state); } }
    if(pr.onGround){ if(pr.manualType==='wave')pr.action='wave'; else pr.action=storyAction(state); }

    if(playing) updateStory(dt);

    /* ── scene-graph animation ── */
    prince.position.set(pr.x,pr.y,0);
    const sw=Math.sin(pr.phase);
    if(pr.action==='walk'){ legL.rotation.z=sw*.5; legR.rotation.z=-sw*.5; armL.rotation.z=-sw*.5; armR.rotation.z=sw*.5; }
    else if(pr.action==='jump'){ legL.rotation.z=.4; legR.rotation.z=.4; armL.rotation.z=-.6; armR.rotation.z=-.6; }
    else if(pr.action==='wave'){ legL.rotation.z=0; legR.rotation.z=0; armL.rotation.z=0; armR.rotation.z=-2.4+Math.sin(pr.phase*8)*.3; }
    else{ legL.rotation.z=lerp(legL.rotation.z,0,dt*5); legR.rotation.z=lerp(legR.rotation.z,0,dt*5); armL.rotation.z=lerp(armL.rotation.z,0,dt*5); armR.rotation.z=lerp(armR.rotation.z,0,dt*5); }
    cape3.rotation.z=Math.sin(pr.phase*.8)*.2*(mv?1.3:.6)+(pr.action==='jump'?.5:0);

    /* tower door: opens during DOOR_OPEN and stays open afterwards */
    const doorWanted = (state===ST.DOOR_OPEN&&stateTime>1)||state===ST.PRINCESS_WALK||state===ST.HUG||state===ST.WIN;
    door.open = lerp(door.open, doorWanted?1:0, dt*3);
    doorPivot.rotation.y = door.open*1.6;

    /* giant */
    const br=Math.sin(stateTime*1.6)*.02;
    const gs=(1-gi.shrink*.45)*(1+gi.pulse);
    giantG.scale.setScalar((1+br)*gs);
    giantG.position.x=4+(gi.shakeT>0?Math.sin(stateTime*40)*.15*(gi.shakeT/.6):0);
    const dip=gi.stompT>0?Math.sin((1-gi.stompT/.5)*Math.PI)*-.5:0;
    const lB=gi.laughT>0?Math.abs(Math.sin(stateTime*10))*.3:0;
    giantG.position.y=dip-lB;
    const au=clamp((gi.laughT>0?.6:0),0,1);
    gArmL.rotation.z=lerp(gArmL.rotation.z,-au*1.4,dt*8);
    gArmR.rotation.z=lerp(gArmR.rotation.z, au*1.4,dt*8);
    /* giant disappears once defeated — handled in updateStory */

    /* princess — lives inside the tower window until she "goes down the stairs" */
    const inTower = !(state===ST.PRINCESS_WALK||state===ST.HUG||state===ST.WIN)
                 && !(state===ST.DOOR_OPEN&&stateTime>.9);
    princessWin.visible = inTower;
    princessWin.position.y = 3.8+Math.sin(stateTime*3)*.03;
    const cheerWin = (state===ST.GIANT_DEFEATED||state===ST.RESCUE||state===ST.DOOR_OPEN);
    pwArmR.rotation.z = cheerWin ? (-2+Math.sin(stateTime*8)*.4) : .3;
    pwArmL.rotation.z = -pwArmR.rotation.z;

    const hugging = (state===ST.HUG||state===ST.WIN);
    if(hugging) princessG.visible=true;
    const cheer = (state===ST.PRINCESS_WALK);
    pArmR.rotation.z = hugging ? 0 : (cheer ? (-2+Math.sin(stateTime*8)*.4) : .3);
    pArmL.rotation.z = -pArmR.rotation.z;   /* mirror so both hands go up together */

    /* hug pose: both turn toward each other and reach their arms forward */
    prince.rotation.y   = lerp(prince.rotation.y,   hugging ?  Math.PI/4 : 0, dt*5);
    princessG.rotation.y= lerp(princessG.rotation.y,hugging ? -Math.PI/4 : 0, dt*5);
    const armFwd = hugging ? -1.35 : 0;
    for(const a of [armL,armR,pArmL,pArmR]) a.rotation.x = lerp(a.rotation.x, armFwd, dt*6);

    /* happy bounce while hugging, then both stand still on WIN */
    if(state===ST.HUG){
      const b = Math.abs(Math.sin(stateTime*5))*.12;
      prince.position.y = b; princessG.position.y = b;
    } else if(state===ST.WIN){
      princessG.position.y = 0;
    }

    updateConfetti(dt);

    /* camera */
    if(screenShakeT>0){
      const m=screenShakeT/.4;
      oc.target.set(camTargetLook.x+Math.sin(stateTime*60)*.3*m,camTargetLook.y+Math.cos(stateTime*55)*.2*m,camTargetLook.z);
    } else {
      oc.target.lerp(camTargetLook,dt*2);
    }
    camera.position.lerp(camTargetPos,dt*1.5);
    oc.update();
    renderer.render(scene,camera);
  }

  function loop(now){
    if(!running)return;
    let dt=(now-lastT)/1000; lastT=now; if(dt>.1)dt=.1;
    update(playing?dt*speedMul:0);
    rafId=requestAnimationFrame(loop);
  }
  function start(){ if(!running){ running=true; lastT=performance.now(); rafId=requestAnimationFrame(loop); } }
  function stop() { running=false; cancelAnimationFrame(rafId); }

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

  function initUI(){
    const stage=document.getElementById('stage3d');
    const ctrl=document.getElementById('controls3d');
    ui=new StageUI(stage,ctrl,{
      hasCameraReset:false, switchTarget:'2d', switchLabel:'🛡️ Go 2D',
      handlers:{
        onPlayPause:()=>{playing=!playing;ui.setPlayState(playing);},
        onReplay:()=>reset(),
        onWalk:()=>commandWalk(), onJump:()=>commandJump(), onWave:()=>commandWave(),
        onCameraReset:()=>cameraReset(), onSpeedChange:v=>{speedMul=v;}
      }
    });
    ui.setPlayState(playing);
    /* full-screen: stage + control bar go full screen together */
    setupFullscreen(stage, ctrl, { beforeResize:()=>{ canvas.style.width=''; canvas.style.height=''; } });

    bindKeys({
      onPlayPause:()=>{playing=!playing;ui.setPlayState(playing);},
      onReplay:()=>reset(),
      onWalk:()=>commandWalk(), onJump:()=>commandJump(), onWave:()=>commandWave(),
      onCameraReset:()=>cameraReset(),
      onRiddleAnswer:i=>{if(battle&&battle.active)battle.answer(i);}
    });
  }

  function reset(){
    stop();
    state=ST.INTRO; stateTime=0; playing=true; speedMul=ui?ui.getSpeed():1;
    pr.x=-10; pr.y=0; pr.vy=0; pr.onGround=true; pr.phase=0; pr.action='idle'; pr.manualType=null; pr.manualTimer=0;
    gi.shakeT=gi.stompT=gi.laughT=gi.shrink=gi.pulse=gi.retreatZ=0; gi.fade=1;
    giantG.visible=true; giantG.position.set(4,0,0); giantG.scale.set(1,1,1); setGiantAlpha(1);
    prince.position.set(pr.x,0,0); prince.rotation.set(0,0,0);
    for(const a of [armL,armR,pArmL,pArmR]) a.rotation.x=0;
    princessG.position.set(7,0,1.7); princessG.rotation.set(0,0,0); princessG.visible=false; princessWin.visible=true;
    door.open=0; doorPivot.rotation.y=0;
    sayQueue.length=0; sayBusyUntil=0;
    for(let i=0;i<CMAX;i++) cPos[i*3+1]=-50; cGeo.attributes.position.needsUpdate=true;
    camTargetPos.copy(camHome); camTargetLook.copy(baseTarget);
    battle=null; screenShakeT=0;
    if(ui){ ui.setPlayState(true); ui.setHearts(3); ui.setStoryLabel(LABELS.intro); ui.hideDialogue(); ui.hideOverlays(); ui.hideResult(); }
    enter(ST.INTRO); start();
  }

  function boot(){ onResize(); initUI(); prince.position.set(pr.x,0,0); enter(ST.INTRO); start(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();