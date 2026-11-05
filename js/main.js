import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { AudioSystem } from './audio.js';
import { Effects } from './fx.js';
import { EnemyManager } from './enemies.js';
import { WeaponSystem } from './weapons.js';
import { HUD } from './hud.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    damage: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 resolution; uniform float damage;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d,d);
      // subtle lens chromatic aberration
      float ca = 0.0011 + r2 * 0.0035;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      // cold shadows, warm highlights
      vec3 lift = vec3(0.004, 0.008, 0.015) * (1.0 - smoothstep(0.0, 0.55, dot(col, vec3(0.333))));
      col += lift;
      col *= vec3(1.02, 1.0, 0.965);
      // vignette
      float vig = smoothstep(0.95, 0.22, length(d) * 1.28);
      col *= mix(0.48, 1.0, vig);
      // damage tint
      col += vec3(0.22, 0.01, 0.0) * damage * (0.25 + r2);
      // film grain
      float g = hash(uv * resolution + vec2(time * 7.13, time * 3.71));
      col += (g - 0.5) * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

class Game {
  constructor() {
    this.state = 'loading';
    this.last = performance.now();
    this.missionTime = 0;
    this.score = 0;
    this.wave = 0;
    this.pendingWave = 0;
    this.intermission = 0;
    this.waveTotal = 0;
    this.waveActive = false;
    this.hadLock = false;
    this.pausedFromLock = false;
    this.deathTimer = 0;
    this.victoryTimer = 0;
    this.best = Number(localStorage.getItem('nightfall.best') || 0);
    this.settings = {
      sens: Number(localStorage.getItem('nightfall.sens') || 1),
      vol: Number(localStorage.getItem('nightfall.vol') || 0.8),
      invert: localStorage.getItem('nightfall.invert') === '1',
    };
    this.heartbeatTimer = 0;
    this.menuTime = 0;
    this._flashPrev = 0;
    this._tmpForward = new THREE.Vector3();
    this.init();
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      document.getElementById('gl-error').classList.remove('hidden');
      document.getElementById('loading').classList.add('hidden');
      console.error(e);
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.25 : 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x05070a, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.04, 320);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.audio = new AudioSystem();
    this.world = new World(this.scene, this.renderer);
    this.input = new Input(canvas);
    this.hud = new HUD();
    this.fx = new Effects(this.scene, this.camera, this.audio);
    this.player = new Player(this.camera, this.input, this.world, this.audio, this.hud);
    this.enemies = new EnemyManager(this.scene, this.world, this.fx, this.audio, this.hud, this.player);
    this.weapons = new WeaponSystem(this.camera, this.scene, this.input, this.player, this.world, this.enemies, this.fx, this.audio, this.hud);

    this.input.sensitivity = this.settings.sens;
    this.input.invert = this.settings.invert;
    this.audio.volume = this.settings.vol;

    this.setupComposer();
    this.setupEvents();
    this.setupEnemyCallbacks();
    this.applySettingsUI();

    this.player.update(0);
    this.camera.position.set(22, 4.4, 20);
    this.camera.lookAt(0, 2.2, -2);

    this.hud.setHealth(100);
    this.hud.setAmmo(30, 180);
    this.hud.setGrenades(3);
    this.hud.setScore(0);
    this.hud.setBoss(1, 1, false);

    this.canvas = canvas;
    window.__nightfall = {
      game: this, player: this.player, enemies: this.enemies, weapons: this.weapons,
      world: this.world, fx: this.fx, hud: this.hud,
      start: () => this.startGame(),
      setState: (s) => { this.state = s; },
      setWave: (n) => { this.startWave(n); },
      spawn: (type) => this.enemies.spawn(type),
      killAll: () => { for (const e of this.enemies.enemies) if (!e.dead) this.enemies.kill(e, false, e.position.clone(), new THREE.Vector3(0, 1, 0)); },
      god: (on = true) => { this.player.godMode = on; },
      heal: () => this.player.heal(100),
      teleport: (x, z) => { this.player.position.set(x, 0, z); },
      fire: () => this.weapons.fire(),
      damagePlayer: (n) => this.player.takeDamage(n, new THREE.Vector3(0, 1, -5)),
      state_info: () => ({ state: this.state, wave: this.wave, pending: this.pendingWave, inter: Math.round(this.intermission * 100) / 100, health: this.player.health, enemies: this.enemies.remaining, score: this.score, fps: Math.round(this.fps || 0), dead: this.player.dead, active: this.enemies.active }),
    };

    // Boot sequence
    this.loadTimer = 0;
    this.loadSmooth = 0;
    const statuses = [
      'ESTABLISHING SECURE UPLINK…',
      'DECRYPTING SATELLITE IMAGERY…',
      'SYNCHRONIZING OPERATOR VITALS…',
      'NIGHTFALL PROTOCOL READY',
    ];
    const fill = document.getElementById('load-fill');
    if (fill) fill.style.width = '100%';
    const st = document.getElementById('load-status');
    if (st) st.textContent = statuses[3];
    setTimeout(() => this.enterMenu(), 260);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());
    this.onResize();
  }

  setupComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.45, 0.86);
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.resolution.value.set(size.x, size.y);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
  }

  setupEvents() {
    this.input.onKey = (code) => this.onKey(code);
    this.input.onLockChange = (locked) => {
      if (locked) { this.hadLock = true; return; }
      if (this.state === 'playing' && this.hadLock && !this.player?.dead) this.pauseGame();
    };

    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-brief').addEventListener('click', () => this.openModal('briefing'));
    document.getElementById('btn-controls').addEventListener('click', () => this.openModal('controls'));
    document.getElementById('brief-deploy').addEventListener('click', () => this.startGame());
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModal(b.dataset.close)));
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-abort').addEventListener('click', () => this.abortToMenu());
    document.getElementById('btn-redeploy').addEventListener('click', () => this.startGame());
    document.getElementById('btn-menu').addEventListener('click', () => this.abortToMenu());

    this.bindSettings();
    window.addEventListener('resize', () => this.onResize());

    // Menu background responds to pointer slightly
    window.addEventListener('pointermove', (e) => {
      if (this.state !== 'menu') return;
      this.menuLook = { x: (e.clientX / window.innerWidth - 0.5), y: (e.clientY / window.innerHeight - 0.5) };
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
  }

  setupEnemyCallbacks() {
    this.enemies.onKill = (e, head) => {
      const base = e.def.score;
      this.score += base + (head ? 75 : 0);
      this.hud.setScore(this.score);
      this.hud.killfeed(e.type === 'heavy' ? 'WARDEN' : e.type === 'scout' ? 'SCOUT' : 'HOSTILE', head, e.type === 'heavy');
      this.audio.kill(head);
      if (e.type === 'heavy') {
        this.hud.notice('WARDEN ELIMINATED', 4);
        this.hud.setBoss(0, 1, false);
        this.player.addShake(0.4);
      }
    };
    this.enemies.onWaveCleared = (n) => this.onWaveCleared(n);
    this.enemies.onAllDead = (n) => this.onWaveCleared(n);
    this.enemies.onBossSpawn = () => {
      this.hud.notice('WARDEN ON SITE', 5);
      this.hud.banner('PRIORITY TARGET', 'WARDEN', 'HEAVY ASSAULT // ELIMINATE', 4);
      this.audio.alarm();
    };
  }

  bindSettings() {
    const sens = document.getElementById('sens'), vol = document.getElementById('vol'), invert = document.getElementById('invert');
    sens.value = this.settings.sens;
    vol.value = this.settings.vol;
    invert.checked = this.settings.invert;
    document.getElementById('sens-out').textContent = Number(this.settings.sens).toFixed(2);
    document.getElementById('vol-out').textContent = Math.round(this.settings.vol * 100) + '%';
    sens.addEventListener('input', () => {
      this.settings.sens = Number(sens.value); this.input.sensitivity = this.settings.sens;
      document.getElementById('sens-out').textContent = this.settings.sens.toFixed(2);
      localStorage.setItem('nightfall.sens', String(this.settings.sens));
    });
    vol.addEventListener('input', () => {
      this.settings.vol = Number(vol.value); this.audio.setVolume(this.settings.vol);
      document.getElementById('vol-out').textContent = Math.round(this.settings.vol * 100) + '%';
      localStorage.setItem('nightfall.vol', String(this.settings.vol));
    });
    invert.addEventListener('change', () => {
      this.settings.invert = invert.checked; this.input.invert = this.settings.invert;
      localStorage.setItem('nightfall.invert', invert.checked ? '1' : '0');
    });
  }

  applySettingsUI() {
    document.getElementById('best-score').textContent = this.best > 0 ? String(this.best).padStart(6, '0') : '—';
  }

  enterMenu() {
    this.state = 'menu';
    const loading = document.getElementById('loading');
    loading.classList.add('out');
    setTimeout(() => loading.classList.add('hidden'), 750);
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('menu').style.opacity = '0';
    requestAnimationFrame(() => {
      document.getElementById('menu').style.transition = 'opacity .8s ease';
      document.getElementById('menu').style.opacity = '1';
    });
    this.applySettingsUI();
    this.menuTime = 0;
    this.weapons.setEnabled(false);
    this.hud.hide();
  }

  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    this.audio.ui(true);
  }
  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    this.audio.ui(false);
  }

  startGame() {
    this.audio.init(); this.audio.resume();
    this.audio.setVolume(this.settings.vol);
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('briefing').classList.add('hidden');
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    this.hud.show();
    if (this.input.isTouch) document.getElementById('touch-controls').classList.remove('hidden');

    this.state = 'playing';
    this.missionTime = 0; this.score = 0; this.wave = 0; this.pendingWave = 1; this.intermission = 1.6;
    this.waveActive = false; this.deathTimer = 0; this.victoryTimer = 0;
    this.enemies.reset();
    this.player.reset();
    this.weapons.reset();
    this.weapons.setEnabled(true);
    this.fx.flashes.forEach(f => this.fx.scene.remove(f.light));
    this.fx.flashes = [];
    this.hud.setHealth(100); this.hud.setScore(0); this.hud.setWave(1, 5, 0, 1);
    this.hud.setObjective('SECURE THE COURTYARD');
    this.hud.setBoss(1, 1, false);
    this.hud.banner('OPERATION NIGHTFALL', 'BLACKSITE K-17', 'HOLD THE COURTYARD // SURVIVE FIVE WAVES', 4.5);
    this.hud.subtitle('GHOST-07, YOU ARE CLEARED HOT. HOSTILES INBOUND FROM ALL SECTORS.', 5);
    this.hud.setAmmo(30, 180);
    this.hud.setSlot('rifle');
    this.hadLock = false;
    if (!this.input.isTouch) this.input.requestLock();
    this.player.invuln = 1.5;
    this.audio.alarm();
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
  }

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.pendingWave = 0;
    this.intermission = 0;
    const count = this.enemies.startWave(n);
    this.waveTotal = count;
    this.hud.setWave(n, 5, count, count);
    this.hud.setBoss(1, 1, false);
    const objectives = [
      'ELIMINATE HOSTILE ASSAULT ELEMENT',
      'HOLD THE COURTYARD — SECOND ASSAULT',
      'DEFEND THE UPLINK — THIRD ASSAULT',
      'HOLD POSITION — HEAVY CONTACT',
      'ELIMINATE THE WARDEN',
    ];
    this.hud.setObjective(objectives[Math.min(n - 1, objectives.length - 1)]);
    if (n === 1) this.hud.banner('FIRST CONTACT', 'WAVE <em>01</em>', 'HOSTILES INBOUND // WEAPONS FREE', 3.4);
    else this.hud.banner(`ASSAULT ${String(n).padStart(2, '0')}`, 'WAVE <em>' + String(n).padStart(2, '0') + '</em>', n === 5 ? 'WARDEN ESCORT APPROACHING' : 'NEW CONTACTS INBOUND // HOLD THE LINE', 3.2);
    this.audio.alarm();
  }

  onWaveCleared(n) {
    if (n >= 5) { this.victory(); return; }
    this.waveActive = false;
    this.score += 500;
    this.hud.setScore(this.score);
    this.hud.setWave(n, 5, 0, this.waveTotal);
    this.hud.banner('SECTOR CLEAR', 'WAVE <em>' + String(n).padStart(2, '0') + '</em> CLEARED', `RESUPPLY INBOUND // NEXT ASSAULT ${String(n + 1).padStart(2, '0')}`, 3.6);
    this.hud.subtitle(n === 4 ? 'UPLINK AT 82%. WARDEN IS MOVING. PREPARE FOR HEAVY CONTACT.' : 'UPLINK STABLE. RESUPPLYING AMMUNITION AND FRAG GRENADES.', 4.5);
    this.weapons.addReserve(90);
    this.weapons.addGrenades(2);
    this.player.heal(45);
    this.audio.pickup();
    this.intermission = 6.5;
    this.pendingWave = n + 1;
    this.hud.setObjective('REGROUP — RESUPPLY IN PROGRESS');
  }

  victory() {
    this.state = 'victory';
    this.victoryTimer = 0;
    this.waveActive = false;
    this.score += 1500;
    this.hud.setScore(this.score);
    this.hud.banner('OPERATION COMPLETE', 'EXFIL INBOUND', 'WARDEN ELIMINATED // UPLINK SECURE', 6);
    this.hud.setObjective('MISSION ACCOMPLISHED');
    this.weapons.setEnabled(false);
    this.audio.victory();
    this.input.exitLock();
    if (this.input.isTouch) document.getElementById('touch-controls').classList.add('hidden');
  }

  showResult(victory) {
    const acc = this.weapons.shotsFired > 0 ? this.weapons.shotsHit / this.weapons.shotsFired : 0;
    const newBest = this.score > this.best;
    if (newBest) { this.best = this.score; localStorage.setItem('nightfall.best', String(this.best)); this.applySettingsUI(); }
    this.hud.setResult({
      victory, waves: victory ? 5 : Math.max(0, this.wave - 1), kills: this.enemies.kills,
      headshots: this.enemies.headshots, accuracy: acc, time: this.missionTime, score: this.score,
      best: this.best, newBest,
    });
    document.getElementById('gameover').classList.remove('hidden');
    if (this.input.isTouch) document.getElementById('touch-controls').classList.add('hidden');
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.exitLock();
    document.getElementById('pause').classList.remove('hidden');
    if (this.input.isTouch) document.getElementById('touch-controls').classList.add('hidden');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    document.getElementById('pause').classList.add('hidden');
    this.state = 'playing';
    if (this.input.isTouch) document.getElementById('touch-controls').classList.remove('hidden');
    if (!this.input.isTouch) this.input.requestLock();
  }

  abortToMenu() {
    this.state = 'menu';
    this.input.exitLock();
    this.weapons.setEnabled(false);
    this.enemies.reset();
    this.hud.hide();
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('touch-controls').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('menu').style.opacity = '1';
    this.applySettingsUI();
    this.player.reset();
    this.camera.position.set(22, 4.4, 20);
  }

  onKey(code) {
    if (code === 'Escape' || code === 'KeyP') {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
      else if (this.state === 'menu') { /* no-op */ }
      return;
    }
    if (this.state !== 'playing') return;
    if (code === 'KeyR' || code === 'Digit1' || code === 'Digit2' || code === 'KeyG' || code === 'KeyQ') this.weapons.key(code);
    if (code === 'KeyM') {
      this.audio.setEnabled(!this.audio.enabled);
      this.hud.notice(this.audio.enabled ? 'AUDIO ON' : 'AUDIO MUTED');
    }
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 800 ? 1.25 : 1.5));
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    if (this.grade) this.grade.uniforms.resolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    const touch = document.getElementById('touch-controls');
    if (touch && this.input?.isTouch) touch.classList.toggle('hidden', this.state !== 'playing');
  }

  updateMenuCamera(dt) {
    this.menuTime += dt;
    const t = this.menuTime * 0.055;
    const mx = this.menuLook?.x || 0, my = this.menuLook?.y || 0;
    const x = -2 + Math.sin(t * 0.9) * 4.5 - mx * 3;
    const z = 24.5 - Math.cos(t * 0.7) * 1.4 - my * 1.5;
    const y = 3.35 + Math.sin(this.menuTime * 0.13) * 0.22;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 2.25 + my * 1.2, -2);
    this.camera.rotation.z = Math.sin(this.menuTime * 0.09) * 0.005;
  }

  loop() {
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.fps = (this.fps || 60) * 0.92 + (1 / Math.max(0.0001, raw)) * 0.08;
    if (this.state === 'loading') { this.renderMenuScene(dt); return; }
    if (this.state === 'menu' || this.state === 'briefing') {
      this.updateMenuCamera(dt);
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.hud.update(dt);
      this.checkLightning();
      this.render(dt);
      return;
    }
    if (this.state === 'paused') {
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.checkLightning();
      this.render(dt);
      return;
    }
    if (this.state === 'playing') {
      this.missionTime += dt;
      this.player.update(dt);
      this.weapons.update(dt);
      this.enemies.update(dt, this.camera);
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.hud.update(dt);
      this.hud.setScore(this.score);
      if (this.waveActive) this.hud.setWave(this.wave, 5, this.enemies.remaining, this.waveTotal);
      this.intermission -= dt;
      if (this.pendingWave && this.intermission <= 0 && !this.player.dead) this.startWave(this.pendingWave);
      this.heartbeat(dt);
      this.checkLightning();
      if (this.player.dead) { this.state = 'dying'; this.deathTimer = 0; this.weapons.setEnabled(false); if (this.input.isTouch) document.getElementById('touch-controls').classList.add('hidden'); }
      this.render(dt);
      this.input.endFrame();
      return;
    }
    if (this.state === 'dying') {
      this.deathTimer += dt;
      this.player.update(dt);
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.enemies.update(dt, this.camera);
      this.hud.update(dt);
      this.checkLightning();
      if (this.deathTimer > 2.1) { this.state = 'gameover'; this.showResult(false); }
      this.render(dt);
      return;
    }
    if (this.state === 'victory') {
      this.victoryTimer += dt;
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.enemies.update(dt, this.camera);
      this.hud.update(dt);
      this.checkLightning();
      if (this.victoryTimer > 2.4) { this.state = 'won'; this.showResult(true); }
      this.render(dt);
      return;
    }
    if (this.state === 'gameover' || this.state === 'won') {
      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.hud.update(dt);
      this.checkLightning();
      this.render(dt);
      return;
    }
    this.renderMenuScene(dt);
  }

  renderMenuScene(dt) {
    if (!this.world) return;
    this.world.update(dt, this.camera);
    this.fx.update(dt);
    this.render(dt);
  }

  render(dt) {
    this.grade.uniforms.time.value = performance.now() * 0.001;
    this.grade.uniforms.damage.value = this.player ? this.player.damageFlash : 0;
    this.composer.render(dt);
  }

  heartbeat(dt) {
    if (this.player.health < 30 && !this.player.dead) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) { this.heartbeatTimer = 1.05; this.audio.heartbeat(); }
    } else this.heartbeatTimer = 0;
  }

  checkLightning() {
    const f = this.world.flash;
    if (f > 0.92 && this._flashPrev <= 0.92) {
      setTimeout(() => this.audio.thunder(), 180 + Math.random() * 700);
    }
    this._flashPrev = f;
  }
}

window.addEventListener('error', (e) => console.error('NIGHTFALL ERROR:', e.message));
new Game();
