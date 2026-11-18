/* ============================================================
 * main.js — Shared interface logic
 * Provides: Typewriter, StageUI, RiddleBattle
 * ============================================================ */

/* ── Simple typewriter effect ── */
class Typewriter {
  constructor(el, speed = 26) { this.el = el; this.speed = speed; this._t = null; }
  type(text, onDone) {
    this.stop(); this.el.textContent = ''; let i = 0;
    const tick = () => {
      if (i < text.length) { this.el.textContent += text[i++]; this._t = setTimeout(tick, this.speed); }
      else if (onDone) onDone();
    };
    tick();
  }
  stop() { clearTimeout(this._t); }
}
window.Typewriter = Typewriter;

/* ── StageUI ──────────────────────────────────────────────────
 * Builds and manages all DOM layered over the canvas/3D stage:
 *   HUD (story label + hearts)
 *   In-stage dialogue bubble
 *   Riddle panel
 *   Result popup  ← NEW: congratulations / try-again / win / gameover
 *   Win overlay & Game-over overlay
 *   Control bar
 * ─────────────────────────────────────────────────────────── */
class StageUI {
  constructor(stage, controls, cfg) {
    this.stage    = stage;
    this.controls = controls;
    this.cfg      = cfg || {};
    this.handlers = (cfg && cfg.handlers) || {};
    this.maxLives = 3;
    this._tw      = null;
    this._buildHUD();
    this._buildDialogue();
    this._buildRiddlePanel();
    this._buildResultPopup();
    this._buildOverlays();
    this._buildControlBar();
  }

  /* ── HUD ── */
  _buildHUD() {
    const h = document.createElement('div');
    h.className = 'hud';
    h.innerHTML = '<div class="story-label js-story"></div><div class="hearts-display js-hearts"></div>';
    this.stage.appendChild(h);
    this._storyEl  = h.querySelector('.js-story');
    this._heartsEl = h.querySelector('.js-hearts');
    this.setHearts(this.maxLives);
  }
  setStoryLabel(t) { this._storyEl.textContent = t; }
  setHearts(n, max) {
    if (max) this.maxLives = max;
    let h = '';
    for (let i = 0; i < this.maxLives; i++)
      h += '<span class="heart' + (i >= n ? ' lost' : '') + '">❤</span>';
    this._heartsEl.innerHTML = h;
  }

  /* ── Dialogue bubble ── */
  _buildDialogue() {
    const d = document.createElement('div');
    d.className = 'stage-dialogue';
    d.innerHTML = '<span class="spk"></span><div class="txt"></div>';
    this.stage.appendChild(d);
    this._dlg     = d;
    this._dlgSpk  = d.querySelector('.spk');
    this._dlgTxt  = d.querySelector('.txt');
  }
  showDialogue(speaker, text, onDone) {
    this._dlgSpk.textContent = speaker ? speaker + ':' : '';
    this._dlg.classList.add('visible');
    this._tw = new Typewriter(this._dlgTxt, 24);
    this._tw.type(text, onDone);
  }
  hideDialogue() { if (this._tw) this._tw.stop(); this._dlg.classList.remove('visible'); }

  /* ── Riddle panel ── */
  _buildRiddlePanel() {
    const p = document.createElement('div');
    p.className = 'riddle-panel';
    p.innerHTML = `
      <div class="riddle-card">
        <div class="r-progress js-rp"></div>
        <div class="r-question js-rq"></div>
        <div class="r-options  js-ro"></div>
        <div class="r-foot">
          <button class="btn btn-gold js-hint">💡 Hint</button>
          <span class="hint-txt js-ht"></span>
        </div>
      </div>`;
    this.stage.appendChild(p);
    this.riddlePanel = p;
  }

  /* ── Result popup ─────────────────────────────────────────
   * Four modes driven by showResult(mode, …):
   *   'ok'       correct answer   → green, Next button
   *   'fail'     wrong answer     → red,   Try Again button
   *   'win'      all 3 correct    → gold,  Continue button
   *   'gameover' lives = 0        → red,   shown via showGameOver
   * ─────────────────────────────────────────────────────── */
  _buildResultPopup() {
    const p = document.createElement('div');
    p.className = 'result-popup';
    p.innerHTML = `
      <div class="result-box js-rbox">
        <span class="r-emoji js-remoji"></span>
        <h2 class="js-rtitle"></h2>
        <p  class="js-rmsg"></p>
        <div class="row" style="justify-content:center;gap:10px">
          <button class="btn js-rbtn1"></button>
          <button class="btn btn-ghost js-rbtn2" style="display:none">🏠 Home</button>
        </div>
      </div>`;
    this.stage.appendChild(p);
    this._rPopup = p;
    this._rBox   = p.querySelector('.js-rbox');
    this._rEmoji = p.querySelector('.js-remoji');
    this._rTitle = p.querySelector('.js-rtitle');
    this._rMsg   = p.querySelector('.js-rmsg');
    this._rBtn1  = p.querySelector('.js-rbtn1');
    this._rBtn2  = p.querySelector('.js-rbtn2');
    this._rBtn2.onclick = () => { this.hideResult(); window.location.href = 'index.html'; };
  }

  /**
   * Show the result popup.
   * @param {'ok'|'fail'|'win'|'gameover'} mode
   * @param {string} title
   * @param {string} msg
   * @param {string} btn1Label
   * @param {Function} btn1Action
   * @param {boolean} [showHome=false]
   */
  showResult(mode, title, msg, btn1Label, btn1Action, showHome = false) {
    this._rBox.className = 'result-box ' + mode;
    const emojiMap = { ok:'🎉', fail:'💔', win:'👑', gameover:'💀' };
    this._rEmoji.textContent = emojiMap[mode] || '❓';
    this._rTitle.textContent = title;
    this._rMsg.textContent   = msg;
    // style the primary button
    const cls = { ok:'btn-green', fail:'btn-gold', win:'btn-primary', gameover:'btn-red' };
    this._rBtn1.className = 'btn ' + (cls[mode] || 'btn-primary');
    this._rBtn1.textContent = btn1Label;
    this._rBtn1.onclick = () => { this.hideResult(); btn1Action && btn1Action(); };
    this._rBtn2.style.display = showHome ? '' : 'none';
    this._rPopup.classList.add('show');
  }
  hideResult() { this._rPopup.classList.remove('show'); }

  /* ── Win / Game-over full-stage overlays ── */
  _buildOverlays() {
    // Win
    const w = document.createElement('div');
    w.className = 'overlay win-ov';
    w.innerHTML = `
      <h2>👑 The Kingdom is Saved!</h2>
      <p class="js-wmsg"></p>
      <div class="row" style="justify-content:center">
        <button class="btn btn-gold js-wreplay">🔁 Play Again</button>
        <button class="btn btn-primary js-whome">🏠 Home</button>
      </div>`;
    this.stage.appendChild(w);
    this._winOv = w;

    // Game-over
    const g = document.createElement('div');
    g.className = 'overlay go-ov';
    g.innerHTML = `
      <h2>💔 Game Over!</h2>
      <p class="js-gomsg"></p>
      <div class="row" style="justify-content:center">
        <button class="btn btn-gold js-goretry">🔁 Try Again</button>
        <button class="btn btn-primary js-gohome">🏠 Home</button>
      </div>`;
    this.stage.appendChild(g);
    this._goOv = g;
  }

  showWinOverlay(msg, onReplay) {
    if (msg) this._winOv.querySelector('.js-wmsg').textContent = msg;
    this._winOv.classList.add('show');
    this._winOv.querySelector('.js-wreplay').onclick = () => { this._winOv.classList.remove('show'); onReplay && onReplay(); };
    this._winOv.querySelector('.js-whome').onclick   = () => { window.location.href = 'index.html'; };
  }
  showGameOverOverlay(msg, onRetry) {
    if (msg) this._goOv.querySelector('.js-gomsg').textContent = msg;
    this._goOv.classList.add('show');
    this._goOv.querySelector('.js-goretry').onclick = () => { this._goOv.classList.remove('show'); onRetry && onRetry(); };
    this._goOv.querySelector('.js-gohome').onclick  = () => { window.location.href = 'index.html'; };
  }
  hideOverlays() { this._winOv.classList.remove('show'); this._goOv.classList.remove('show'); }

  /* ── Control bar ── */
  _buildControlBar() {
    const c = this.controls;
    const camBtn = this.cfg.hasCameraReset
      ? '<button class="btn btn-ghost js-cam" title="Reset camera (C)">🎥 Cam</button>' : '';
    c.innerHTML = `
      <div class="cg">
        <button class="btn btn-primary js-play"   title="Play / Pause (Space)">⏸ Pause</button>
        <button class="btn btn-ghost  js-replay"  title="Replay (R)">🔁 Replay</button>
      </div>
      <div class="cg">
        <span class="lbl">Speed</span>
        <input type="range" min="0.25" max="2" step="0.05" value="1" class="speed-slider js-speed">
        <span class="hint-txt js-spval">1.0×</span>
      </div>
      <div class="cg">
        <span class="lbl">Actions</span>
        <button class="btn btn-ghost js-walk"  title="Walk forward (W)">🚶 Walk</button>
        <button class="btn btn-ghost js-jump"  title="Jump (J)">⤴ Jump</button>
        <button class="btn btn-ghost js-wave"  title="Wave (V)">👋 Wave</button>
        ${camBtn}
      </div>
      <div class="cg" style="margin-left:auto">
        <button class="btn btn-pink  js-switch">${this.cfg.switchLabel || 'Switch'}</button>
        <button class="btn btn-ghost js-home"  title="Home">🏠 Home</button>
      </div>`;

    this._playBtn = c.querySelector('.js-play');
    this._speedEl = c.querySelector('.js-speed');
    this._spValEl = c.querySelector('.js-spval');
    const H = this.handlers;
    this._playBtn.onclick                   = () => H.onPlayPause  && H.onPlayPause();
    c.querySelector('.js-replay').onclick   = () => H.onReplay     && H.onReplay();
    c.querySelector('.js-walk').onclick     = () => H.onWalk       && H.onWalk();
    c.querySelector('.js-jump').onclick     = () => H.onJump       && H.onJump();
    c.querySelector('.js-wave').onclick     = () => H.onWave       && H.onWave();
    if (this.cfg.hasCameraReset)
      c.querySelector('.js-cam').onclick    = () => H.onCameraReset && H.onCameraReset();
    this._speedEl.oninput = () => {
      const v = +this._speedEl.value;
      this._spValEl.textContent = (v < 1 ? v.toFixed(2) : v.toFixed(1)) + '×';
      H.onSpeedChange && H.onSpeedChange(v);
    };
    c.querySelector('.js-switch').onclick = () => {
      window.location.href = this.cfg.switchTarget === '3d' ? '3d.html' : '2d.html';
    };
    c.querySelector('.js-home').onclick = () => { window.location.href = 'index.html'; };
  }

  setPlayState(p) { this._playBtn.innerHTML = p ? '⏸ Pause' : '▶ Play'; }
  getSpeed()      { return +this._speedEl.value; }
  shakeStage()    { this.stage.classList.remove('shake'); void this.stage.offsetWidth; this.stage.classList.add('shake'); }
  disableActions(s) {
    ['.js-play','.js-replay','.js-walk','.js-jump','.js-wave','.js-cam','.js-speed']
      .forEach(sel => { const e = this.controls.querySelector(sel); if (e) e.disabled = s; });
  }
}
window.StageUI = StageUI;

/* ── RiddleBattle ──────────────────────────────────────────────
 * Manages 3 riddles, 3 lives, 1 hint.
 *
 * Correct answer  → shows "Congratulations" result popup with
 *                   "Next" (or "Finish" on the 3rd riddle).
 *                   The renderer is notified via onCorrect().
 *
 * Wrong answer    → loses a life, shows "Try Again" popup.
 *                   If lives reach 0 → shows Game Over popup.
 *                   The renderer is notified via onWrong().
 *
 * All 3 correct   → shows the BIG win popup ("Congratulations,
 *                   you have succeeded to save the princess!"),
 *                   then calls onAllCorrect() so the renderer
 *                   can zoom in on the celebration.
 *
 * Lives reach 0   → calls onGameOver() so the renderer can
 *                   react, then the Game Over overlay appears.
 * ─────────────────────────────────────────────────────────── */
class RiddleBattle {
  constructor(ui, callbacks) {
    this.ui       = ui;
    this.cb       = callbacks || {};
    this.total    = 3;
    this.solved   = 0;
    this.lives    = 3;
    this.hintUsed = false;
    this.riddles  = [];
    this.index    = 0;
    this.active   = false;
    this._locked  = false;
  }

  start() {
    this.riddles  = pickRiddles(this.total);
    this.index    = 0;
    this.solved   = 0;
    this.lives    = 3;
    this.hintUsed = false;
    this.active   = true;
    this._locked  = false;
    this.ui.setHearts(this.lives);
    this.ui.disableActions(true);
    this.ui.riddlePanel.classList.add('open');
    this._render();
  }

  _render() {
    const r = this.riddles[this.index];

    // progress pips
    const prog = this.ui.riddlePanel.querySelector('.js-rp');
    prog.innerHTML = '';
    for (let i = 0; i < this.total; i++) {
      const pip = document.createElement('div');
      pip.className = 'r-pip' + (i < this.solved ? ' done' : i === this.solved ? ' active' : '');
      prog.appendChild(pip);
    }

    this.ui.riddlePanel.querySelector('.js-rq').textContent =
      'Riddle ' + (this.index + 1) + ' of ' + this.total + ': ' + r.question;

    const opts = this.ui.riddlePanel.querySelector('.js-ro');
    opts.innerHTML = '';
    r.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'r-option';
      b.innerHTML = '<span class="rkey">' + (i + 1) + '</span><span>' + opt + '</span>';
      b.onclick = () => this.answer(i);
      opts.appendChild(b);
    });

    const hintBtn = this.ui.riddlePanel.querySelector('.js-hint');
    hintBtn.disabled = this.hintUsed;
    hintBtn.onclick  = () => this.useHint();
    this.ui.riddlePanel.querySelector('.js-ht').textContent = this.hintUsed ? 'Hint used' : '';
  }

  answer(idx) {
    if (this._locked) return;
    this._locked = true;
    const r    = this.riddles[this.index];
    const btns = this.ui.riddlePanel.querySelectorAll('.r-option');
    const chosen = btns[idx];

    if (isCorrect(r, idx)) {
      /* ── CORRECT ── */
      chosen.classList.add('correct');
      this._disableAll();
      this.solved++;
      this.cb.onCorrect && this.cb.onCorrect(r);

      if (this.solved >= this.total) {
        /* All 3 correct → big win popup, then continue */
        this.ui.riddlePanel.classList.remove('open');
        this.ui.showResult(
          'win',
          'Congratulations! 🎉',
          'You have succeeded to save the princess! The giant has been bested by your wit.',
          '🏰 Continue to the rescue!',
          () => { this._complete(); },
          false
        );
      } else {
        /* Intermediate correct answer */
        this.ui.riddlePanel.classList.remove('open');
        this.ui.showResult(
          'ok',
          'Congratulations!',
          r.correct + '\n\nRiddle ' + this.solved + ' of ' + this.total + ' solved!',
          'Next Riddle ▶',
          () => { this._locked = false; this.index++; this.ui.riddlePanel.classList.add('open'); this._render(); },
          false
        );
      }

    } else {
      /* ── WRONG ── */
      chosen.classList.add('wrong');
      chosen.disabled = true;
      this.lives--;
      this.ui.setHearts(this.lives);
      this.cb.onWrong && this.cb.onWrong(r);
      this.ui.shakeStage();

      if (this.lives <= 0) {
        /* Out of lives → Game Over */
        this.ui.riddlePanel.classList.remove('open');
        this.ui.showResult(
          'gameover',
          'Game Over!',
          'James Arthur has run out of hearts. The giant stands undefeated... for now.',
          '🔁 Try Again',
          () => { this._gameOver(); },
          true
        );
      } else {
        /* Still has lives → try again prompt */
        this.ui.riddlePanel.classList.remove('open');
        const livesLeft = this.lives === 1 ? '1 heart left!' : this.lives + ' hearts left.';
        this.ui.showResult(
          'fail',
          'Wrong Answer!',
          'You lost a heart. ' + livesLeft + ' Try a different answer.',
          '🔁 Try Again',
          () => {
            this._locked = false;
            chosen.disabled = true;
            this.ui.riddlePanel.classList.add('open');
            /* Keep the same riddle, just re-open panel with wrong option still disabled */
          },
          false
        );
      }
    }
  }

  _disableAll() { this.ui.riddlePanel.querySelectorAll('.r-option').forEach(b => b.disabled = true); }

  _complete() {
    this.active = false;
    this.ui.disableActions(false);
    this.cb.onAllCorrect && this.cb.onAllCorrect();
  }

  _gameOver() {
    this.active = false;
    this.ui.disableActions(false);
    this.cb.onGameOver && this.cb.onGameOver();
  }

  useHint() {
    if (this.hintUsed) return;
    this.hintUsed = true;
    const r = this.riddles[this.index];
    this.ui.riddlePanel.querySelector('.js-ht').textContent = '🤴 "' + r.hint + '"';
    this.ui.riddlePanel.querySelector('.js-hint').disabled = true;
  }
}
window.RiddleBattle = RiddleBattle;

/* ── Keyboard shortcuts binder ── */
function bindKeys(handlers) {
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space')                   { e.preventDefault(); handlers.onPlayPause  && handlers.onPlayPause(); }
    else if (e.key === 'j' || e.key === 'J') { handlers.onJump       && handlers.onJump(); }
    else if (e.key === 'w' || e.key === 'W') { handlers.onWalk       && handlers.onWalk(); }
    else if (e.key === 'v' || e.key === 'V') { handlers.onWave       && handlers.onWave(); }
    else if (e.key === 'r' || e.key === 'R') { handlers.onReplay     && handlers.onReplay(); }
    else if (e.key === 'c' || e.key === 'C') { handlers.onCameraReset && handlers.onCameraReset(); }
    else if (e.key >= '1' && e.key <= '4')   { handlers.onRiddleAnswer && handlers.onRiddleAnswer(+e.key - 1); }
  });
}
window.bindKeys = bindKeys;

/* ── Homepage typewriter ── */
function startHeroTypewriter() {
  const el = document.getElementById('heroDialogue');
  if (!el) return;
  const lines = [
    "Greetings, traveler! I am Prince James Arthur of this realm.",
    "A fearsome giant guards the tower where Princess Claida Violet is held!",
    "But he fights with riddles, not swords — cleverness is my blade!",
    "I shall answer his three riddles and rescue her from the tower.",
    "Will you guide me on this quest? Choose your adventure below!"
  ];
  let i = 0;
  const tw = new Typewriter(el, 28);
  const next = () => { if (i >= lines.length) i = 0; tw.type(lines[i++], () => setTimeout(next, 2600)); };
  next();
}
window.startHeroTypewriter = startHeroTypewriter;
