const GAME_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','KeyR','KeyG','KeyC','Space','ShiftLeft','ShiftRight','Digit1','Digit2','Tab','KeyQ','KeyE']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { left: false, right: false };
    this.lookX = 0; this.lookY = 0;
    this.pointerLocked = false;
    this.enabled = false;
    this.sensitivity = 1;
    this.invert = false;
    this.touch = { moveX: 0, moveY: 0, fire: false, aim: false, active: false };
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.onLockChange = null;
    this.onKey = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (GAME_KEYS.has(e.code)) e.preventDefault(); return; }
      if (GAME_KEYS.has(e.code) || e.code === 'Escape') {
        if (this.enabled || e.code === 'Escape') e.preventDefault();
      }
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.onKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; this.touch.fire = false; });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.pointerLocked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      this.lookX += mx * this.sensitivity;
      this.lookY += my * this.sensitivity * (this.invert ? -1 : 1);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    this._bindTouch();
  }

  _bindTouch() {
    const stickZone = document.getElementById('stick-zone');
    const knob = document.getElementById('stick-knob');
    const lookZone = document.getElementById('look-zone');
    if (!stickZone || !lookZone) return;
    let stickId = null, lookId = null, lx = 0, ly = 0;

    const stickRect = () => stickZone.getBoundingClientRect();
    const updateStick = (e) => {
      const r = stickRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * 0.34;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.touch.moveX = dx / max; this.touch.moveY = dy / max;
      if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    stickZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault(); e.stopPropagation();
      stickId = e.pointerId; stickZone.setPointerCapture(e.pointerId); this.touch.active = true;
      updateStick(e);
    });
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      e.preventDefault(); updateStick(e);
    });
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null; this.touch.moveX = this.touch.moveY = 0;
      if (knob) knob.style.transform = 'translate(0px,0px)';
    };
    stickZone.addEventListener('pointerup', endStick);
    stickZone.addEventListener('pointercancel', endStick);

    lookZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault(); lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      e.preventDefault();
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.lookX += dx * 1.55 * this.sensitivity;
      this.lookY += dy * 1.55 * this.sensitivity * (this.invert ? -1 : 1);
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    const hold = (id, on, off) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); on(); });
      const end = (e) => { e.preventDefault(); el.classList.remove('on'); off?.(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
    };
    hold('t-fire', () => { this.touch.fire = true; }, () => { this.touch.fire = false; });
    hold('t-aim', () => { this.touch.aim = !this.touch.aim; }, null);
    hold('t-reload', () => this.onKey?.('KeyR'), null);
    hold('t-jump', () => this.onKey?.('Space'), null);
    hold('t-switch', () => this.onKey?.('Digit2'), null);
    hold('t-nade', () => this.onKey?.('KeyG'), null);
  }

  requestLock() {
    if (this.isTouch) return;
    if (!this.pointerLocked) this.canvas.requestPointerLock?.();
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  consumeLook() {
    const x = this.lookX, y = this.lookY;
    this.lookX = 0; this.lookY = 0;
    return { x, y };
  }

  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }

  get forward() { return (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.touch.moveY; }
  get strafe() { return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touch.moveX; }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get jump() { return this.keys.has('Space'); }
  get crouch() { return this.keys.has('KeyC'); }
  get fire() { return this.mouse.left || this.touch.fire; }
  get aim() { return this.mouse.right || this.touch.aim; }
}
