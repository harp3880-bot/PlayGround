import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const DEFS = {
  rifle: {
    id: 'rifle', name: 'VECTOR-7', mode: 'AUTO / 5.56', magSize: 30, reserveMax: 300,
    damage: 33, headMul: 2.9, rpm: 760, auto: true, reloadTime: 2.05, switchTime: 0.42,
    adsFov: 51, hipSpread: 0.026, adsSpread: 0.0045, moveSpread: 0.012,
    recoil: 0.0095, recoilYaw: 0.0032, adsRecoilMul: 0.55, muzzle: [0, 0.02, -0.96],
    hip: new THREE.Vector3(0.255, -0.19, -0.58), ads: new THREE.Vector3(0, -0.066, -0.56),
    hipRot: new THREE.Euler(0.02, 0.13, -0.02), adsRot: new THREE.Euler(0, 0, 0),
  },
  pistol: {
    id: 'pistol', name: 'P9 SIDEARM', mode: 'SEMI / 9MM', magSize: 12, reserveMax: Infinity,
    damage: 49, headMul: 2.6, rpm: 430, auto: false, reloadTime: 1.55, switchTime: 0.35,
    adsFov: 60, hipSpread: 0.023, adsSpread: 0.006, moveSpread: 0.011,
    recoil: 0.012, recoilYaw: 0.0042, adsRecoilMul: 0.6, muzzle: [0, 0.032, -0.34],
    hip: new THREE.Vector3(0.27, -0.21, -0.56), ads: new THREE.Vector3(0, -0.04, -0.54),
    hipRot: new THREE.Euler(0.02, 0.12, -0.02), adsRot: new THREE.Euler(0, 0, 0),
  },
};

function mat(color, metalness, roughness, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: 1.2, ...extra });
}

function box(w, h, d, x, y, z, m, rot = null) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  if (rot) b.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
  return b;
}
function cyl(r1, r2, h, x, y, z, m, seg = 12) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
  c.rotation.x = Math.PI / 2; c.position.set(x, y, z);
  return c;
}

export class WeaponSystem {
  constructor(camera, scene, input, player, world, enemies, fx, audio, hud) {
    this.camera = camera; this.scene = scene; this.input = input; this.player = player;
    this.world = world; this.enemies = enemies; this.fx = fx; this.audio = audio; this.hud = hud;
    this.defs = DEFS;
    this.current = 'rifle';
    this.ammo = { rifle: { mag: 30, reserve: 180 }, pistol: { mag: 12, reserve: Infinity } };
    this.grenades = 3; this.maxGrenades = 3;
    this.grenadeCooldown = 0;
    this.projectiles = [];
    this.fireTimer = 0; this.triggerHeld = false;
    this.reloading = false; this.reloadT = 0; this.reloadStage = 0;
    this.switching = false; this.switchT = 0; this.switchTarget = null; this.switchStage = 0;
    this.aimT = 0;
    this.recoilVisual = 0; this.recoilVisualVel = 0;
    this.kickZ = 0;
    this.swayX = 0; this.swayY = 0;
    this.prevYaw = 0; this.prevPitch = 0;
    this.bobTime = 0;
    this.muzzleFlashT = 0;
    this.shotsFired = 0; this.shotsHit = 0; this.headshots = 0;
    this.shellTimer = 0;
    this.enabled = false;
    this.holder = new THREE.Group(); this.camera.add(this.holder);
    this.holder.scale.setScalar(0.64);
    this.rifle = this.buildRifle();
    this.pistol = this.buildPistol();
    this.holder.add(this.rifle, this.pistol);
    this.pistol.visible = false;
    this.currentMuzzle = new THREE.Object3D();
    this.rifle.add(this.currentMuzzle); this.currentMuzzle.position.set(...DEFS.rifle.muzzle);
    this.pistolMuzzle = new THREE.Object3D();
    this.pistol.add(this.pistolMuzzle); this.pistolMuzzle.position.set(...DEFS.pistol.muzzle);
    this.flashlight = new THREE.SpotLight(0xdfe9ff, 5.2, 38, 0.42, 0.95, 1.6);
    this.flashlight.position.set(0.06, 0.075, -0.58);
    this.flashlight.target = new THREE.Object3D(); this.flashlight.target.position.set(0.06, 0.02, -22);
    this.holder.add(this.flashlight); this.holder.add(this.flashlight.target);
    this.flashlight.visible = false;
    this.holder.visible = false;
    // dedicated view-model light rig so the weapon reads in the dark
    const key = new THREE.PointLight(0xfff0dc, 2.4, 3.4, 2); key.position.set(0.95, 0.75, 0.2); this.camera.add(key);
    const fill = new THREE.PointLight(0xbcd4ff, 1.6, 3.0, 2); fill.position.set(-0.9, 0.3, -0.2); this.camera.add(fill);
    const rim = new THREE.PointLight(0xff8a4a, 0.9, 2.6, 2); rim.position.set(0.15, -0.32, -1.0); this.camera.add(rim);
    this.viewLights = [key, fill, rim];
    this.reset();
  }

  buildRifle() {
    const g = new THREE.Group();
    const gun = mat(0x3d444b, 0.5, 0.42, { envMapIntensity: 1.8 });
    const gunDark = mat(0x22262a, 0.48, 0.5, { envMapIntensity: 1.5 });
    const polymer = mat(0x2d3134, 0.16, 0.68);
    const tan = mat(0x6b5a3e, 0.2, 0.62);
    const accent = mat(0x4f5b64, 0.55, 0.4, { envMapIntensity: 1.7 });
    const rubber = mat(0x0e0f10, 0.05, 0.9);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a1c });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x4f8ea8, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

    // receiver
    g.add(box(0.074, 0.088, 0.36, 0, 0, -0.18, gun));
    g.add(box(0.078, 0.024, 0.34, 0, 0.056, -0.18, gunDark));
    // top rail
    for (let i = 0; i < 12; i++) g.add(box(0.05, 0.008, 0.014, 0, 0.072, -0.34 + i * 0.032, gunDark));
    // handguard
    g.add(box(0.064, 0.072, 0.40, 0, 0.002, -0.56, tan));
    for (let i = 0; i < 7; i++) {
      const s = box(0.066, 0.012, 0.028, 0, -0.006, -0.42 - i * 0.048, gunDark);
      g.add(s);
    }
    g.add(box(0.068, 0.014, 0.38, 0, 0.05, -0.56, tan));
    for (let i = 0; i < 9; i++) g.add(box(0.045, 0.006, 0.012, 0, 0.06, -0.4 - i * 0.04, gunDark));
    // barrel & muzzle
    g.add(cyl(0.014, 0.014, 0.32, 0, 0.012, -0.89, gunDark));
    g.add(cyl(0.023, 0.02, 0.09, 0, 0.012, -1.02, gun));
    g.add(box(0.03, 0.05, 0.06, 0, 0.012, -1.04, gunDark));
    // gas block
    g.add(box(0.036, 0.045, 0.06, 0, 0.035, -0.78, gunDark));
    // stock
    g.add(box(0.05, 0.075, 0.20, 0, -0.005, 0.10, polymer));
    g.add(box(0.056, 0.11, 0.035, 0, -0.012, 0.208, rubber));
    g.add(box(0.045, 0.03, 0.12, 0, 0.028, 0.08, gunDark));
    // pistol grip
    g.add(box(0.052, 0.115, 0.062, 0, -0.092, -0.02, polymer, { x: 0.28 }));
    g.add(box(0.054, 0.018, 0.07, 0, -0.148, -0.035, rubber, { x: 0.28 }));
    // trigger guard
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 5, 12, Math.PI), gunDark);
    guard.rotation.z = Math.PI; guard.position.set(0, -0.062, -0.055); g.add(guard);
    g.add(box(0.008, 0.03, 0.03, 0, -0.055, -0.09, gunDark));
    // magazine
    this.rifleMag = new THREE.Group();
    const magBody = box(0.052, 0.15, 0.085, 0, -0.115, -0.16, gunDark, { x: -0.12 });
    const magBody2 = box(0.05, 0.07, 0.08, 0, -0.205, -0.148, gunDark, { x: -0.24 });
    this.rifleMag.add(magBody, magBody2);
    g.add(this.rifleMag);
    // vertical foregrip
    g.add(box(0.034, 0.10, 0.04, 0, -0.078, -0.52, polymer));
    g.add(box(0.036, 0.012, 0.044, 0, -0.128, -0.52, rubber));
    // flashlight
    g.add(cyl(0.018, 0.018, 0.10, 0.048, 0.005, -0.67, gunDark));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.017, 12), new THREE.MeshStandardMaterial({ color: 0x9db4c2, emissive: 0x5d7888, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.5 }));
    lens.position.set(0.048, 0.005, -0.721); g.add(lens);
    // holo sight
    const sight = new THREE.Group(); sight.position.set(0, 0.098, -0.145);
    sight.add(box(0.05, 0.018, 0.075, 0, -0.024, 0, gunDark));
    sight.add(box(0.008, 0.062, 0.06, -0.026, 0.004, 0, gunDark));
    sight.add(box(0.008, 0.062, 0.06, 0.026, 0.004, 0, gunDark));
    sight.add(box(0.052, 0.008, 0.06, 0, 0.037, 0, gunDark));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.048), lensMat);
    glass.position.set(0, 0.005, -0.003); sight.add(glass);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 12), red);
    dot.position.set(0, 0.005, -0.006); sight.add(dot);
    const reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._reticleTex(), transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    reticle.scale.set(0.032, 0.032, 1); reticle.position.set(0, 0.005, 0.004); sight.add(reticle);
    g.add(sight);
    // laser unit
    g.add(box(0.032, 0.03, 0.05, -0.045, 0.012, -0.63, gunDark));
    // hands
    const glove = mat(0x332c24, 0.08, 0.8);
    const sleeve = mat(0x343930, 0.05, 0.92);
    const rightHand = box(0.065, 0.06, 0.09, 0.005, -0.085, -0.02, glove, { x: 0.3 });
    g.add(rightHand);
    g.add(box(0.08, 0.09, 0.17, 0.03, -0.13, 0.09, sleeve, { x: 0.2, y: 0.2 }));
    const leftHand = box(0.07, 0.065, 0.10, 0.005, -0.078, -0.50, glove, { x: 0.1, z: -0.15 });
    g.add(leftHand);
    g.add(box(0.085, 0.085, 0.22, -0.045, -0.11, -0.38, sleeve, { x: -0.3, y: -0.35, z: 0.2 }));
    // charging handle
    g.add(box(0.03, 0.02, 0.05, 0.035, 0.04, 0.015, gunDark));
    return g;
  }

  buildPistol() {
    const g = new THREE.Group();
    const gun = mat(0x4a5157, 0.52, 0.4, { envMapIntensity: 1.8 });
    const dark = mat(0x24282b, 0.45, 0.5, { envMapIntensity: 1.5 });
    const polymer = mat(0x33373a, 0.14, 0.74);
    const glove = mat(0x3a3128, 0.06, 0.82);
    const sleeve = mat(0x3a4038, 0.04, 0.92);
    g.add(box(0.052, 0.055, 0.21, 0, 0.02, -0.14, gun));
    g.add(box(0.049, 0.036, 0.19, 0, -0.018, -0.125, polymer));
    g.add(cyl(0.014, 0.014, 0.06, 0, 0.02, -0.26, dark));
    g.add(box(0.012, 0.015, 0.18, 0, 0.053, -0.145, dark));
    // grip
    g.add(box(0.05, 0.12, 0.07, 0, -0.088, -0.005, polymer, { x: 0.26 }));
    g.add(box(0.052, 0.02, 0.075, 0, -0.15, -0.018, dark, { x: 0.26 }));
    // trigger guard
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 5, 12, Math.PI), dark);
    guard.rotation.z = Math.PI; guard.position.set(0, -0.052, -0.065); g.add(guard);
    // sights with tritium dots
    g.add(box(0.02, 0.018, 0.02, 0, 0.06, -0.235, dark));
    g.add(box(0.036, 0.016, 0.02, 0, 0.06, -0.045, dark));
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a });
    for (const x of [-0.011, 0.011]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.0024, 8), dotMat);
      d.position.set(x, 0.06, -0.242); g.add(d);
    }
    g.add(box(0.055, 0.005, 0.04, 0, 0.047, -0.16, gun));
    // hands
    g.add(box(0.062, 0.075, 0.075, 0.0, -0.085, 0.0, glove));
    g.add(box(0.075, 0.08, 0.16, 0.035, -0.115, 0.085, sleeve, { x: 0.15, y: 0.28 }));
    const support = box(0.06, 0.07, 0.08, -0.03, -0.085, -0.005, glove, { z: 0.3 });
    g.add(support);
    g.add(box(0.075, 0.085, 0.17, -0.075, -0.115, 0.08, sleeve, { x: 0.12, y: -0.2 }));
    return g;
  }

  _dotTex() {
    if (this._dotTexture) return this._dotTexture;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,90,60,.9)'); g.addColorStop(0.55, 'rgba(255,30,20,.25)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this._dotTexture = new THREE.CanvasTexture(c); this._dotTexture.colorSpace = THREE.SRGBColorSpace;
    return this._dotTexture;
  }

  _reticleTex() {
    if (this._reticleTexture) return this._reticleTexture;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.translate(64, 64);
    x.strokeStyle = 'rgba(255,60,40,.9)'; x.lineWidth = 3;
    x.beginPath(); x.arc(0, 0, 36, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,90,60,.6)';
    x.beginPath(); x.arc(0, 0, 12, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(255,130,90,1)';
    x.beginPath(); x.arc(0, 0, 4.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,60,40,.9)';
    x.fillRect(-52, -1.5, 18, 3); x.fillRect(34, -1.5, 18, 3);
    x.fillRect(-1.5, -52, 3, 18); x.fillRect(-1.5, 34, 3, 18);
    this._reticleTexture = new THREE.CanvasTexture(c); this._reticleTexture.colorSpace = THREE.SRGBColorSpace;
    return this._reticleTexture;
  }

  reset() {
    this.current = 'rifle';
    this.ammo = { rifle: { mag: 30, reserve: 180 }, pistol: { mag: 12, reserve: Infinity } };
    this.grenades = 3;
    this.reloading = false; this.reloadT = 0; this.reloadStage = 0;
    this.switching = false; this.fireTimer = 0;
    this.aimT = 0; this.recoilVisual = 0; this.recoilVisualVel = 0; this.kickZ = 0;
    this.swayX = 0; this.swayY = 0;
    this.shotsFired = 0; this.shotsHit = 0; this.headshots = 0;
    this.rifle.visible = true; this.pistol.visible = false;
    this.projectiles.forEach(p => this.scene.remove(p.mesh)); this.projectiles = [];
    this.hud?.setGrenades(this.grenades);
    this.hud?.setWeapon(this.defs.rifle.name, this.defs.rifle.mode);
    this.hud?.setAmmo(this.ammo.rifle.mag, this.ammo.rifle.reserve);
    this.holder.visible = false;
    this.flashlight.visible = false;
    this.player.fovTarget = 78;
  }

  setEnabled(on) {
    this.enabled = on;
    this.holder.visible = on;
    this.flashlight.visible = on;
    if (this.viewLights) for (const l of this.viewLights) l.visible = on;
    this.player.fovTarget = on ? 78 : this.player.fovTarget;
    if (!on) { this.pistol.visible = false; this.rifle.visible = true; }
  }

  get def() { return this.defs[this.current]; }
  get ammoNow() { return this.ammo[this.current]; }

  addReserve(amount) {
    for (const k of ['rifle', 'pistol']) {
      if (this.ammo[k].reserve === Infinity) continue;
      this.ammo[k].reserve = Math.min(this.defs[k].reserveMax, this.ammo[k].reserve + amount);
    }
    this.hud?.setAmmo(this.ammoNow.mag, this.ammoNow.reserve);
  }

  addGrenades(n) { this.grenades = Math.min(this.maxGrenades, this.grenades + n); this.hud?.setGrenades(this.grenades); }

  key(code) {
    if (!this.enabled) return;
    if (code === 'KeyR') this.reload();
    if (code === 'Digit1') this.switchTo('rifle');
    if (code === 'Digit2') this.switchTo('pistol');
    if (code === 'KeyG') this.throwGrenade();
    if (code === 'KeyQ') this.switchTo(this.current === 'rifle' ? 'pistol' : 'rifle');
  }

  reload() {
    if (this.reloading || this.switching) return;
    if (this.ammoNow.mag >= this.def.magSize) return;
    if (this.ammoNow.reserve !== Infinity && this.ammoNow.reserve <= 0) return;
    this.reloading = true; this.reloadT = 0; this.reloadStage = 0;
    this.hud?.setReloading(true, this.def.reloadTime);
    this.audio?.reload?.(0);
  }

  switchTo(id) {
    if (id === this.current || this.switching) return;
    this.switching = true; this.switchT = 0; this.switchTarget = id; this.switchStage = 0;
    this.reloading = false; this.hud?.setReloading(false);
    this.audio?.switchWeapon?.();
  }

  switchImmediate(id) {
    this.current = id;
    this.rifle.visible = id === 'rifle'; this.pistol.visible = id === 'pistol';
    const d = this.def;
    this.hud?.setWeapon(d.name, d.mode);
    this.hud?.setAmmo(this.ammoNow.mag, this.ammoNow.reserve);
    this.hud?.setSlot(id);
    this.player.fovTarget = 78;
  }

  finishReload() {
    const a = this.ammoNow;
    const need = this.def.magSize - a.mag;
    if (a.reserve === Infinity) a.mag = this.def.magSize;
    else { const take = Math.min(need, a.reserve); a.mag += take; a.reserve -= take; }
    this.reloading = false;
    this.hud?.setReloading(false);
    this.hud?.setAmmo(a.mag, a.reserve);
  }

  throwGrenade() {
    if (!this.enabled || this.grenadeCooldown > 0 || this.grenades <= 0) return;
    this.grenades--; this.hud?.setGrenades(this.grenades); this.grenadeCooldown = 1.1;
    this.audio?.throwGrenade?.();
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone().addScaledVector(dir, 0.45).add(new THREE.Vector3(0, -0.12, 0));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0x39412c, roughness: 0.6, metalness: 0.4 }));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8f2f1a }));
    band.rotation.x = Math.PI / 2; mesh.add(band);
    mesh.position.copy(pos); this.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(15).add(new THREE.Vector3(0, 4.2, 0));
    this.projectiles.push({ mesh, vel, life: 2.7, trail: 0, exploded: false });
    this.player.addShake(0.04);
    this.hud?.hint('FRAG OUT');
  }

  explodeGrenade(p) {
    this.fx.explosion(p, 8);
    this.player.addShake(0.85);
    const pd = this.player.position.clone().setY(1).distanceTo(p);
    if (pd < 8) this.player.takeDamage(Math.round(70 * (1 - pd / 8)), p);
    this.enemies?.damageRadius?.(p, 8, 130);
  }

  fire() {
    if (!this.enabled || this.reloading || this.switching || this.fireTimer > 0) return;
    const a = this.ammoNow;
    if (a.mag <= 0) { this.audio?.dryFire?.(); this.fireTimer = 0.18; this.reload(); return; }
    const def = this.def;
    a.mag--; this.shotsFired++;
    this.fireTimer = 60 / def.rpm;
    if (def.auto) this.triggerHeld = true;
    this.hud?.setAmmo(a.mag, a.reserve);

    const aim = this.aimT;
    const moveFactor = clamp(this.player.speed / 7, 0, 1);
    const spread = lerp(def.hipSpread, def.adsSpread, aim) + moveFactor * def.moveSpread * (1 - aim * 0.7);
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * spread;
    dir.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize();

    // muzzle position in world
    const muzzleObj = this.current === 'rifle' ? this.rifle : this.pistol;
    const muzzleLocal = this.current === 'rifle' ? new THREE.Vector3(...def.muzzle) : new THREE.Vector3(...def.muzzle);
    const muzzle = muzzleObj.localToWorld(muzzleLocal.clone());
    if (this.current === 'rifle' && this.rifleMag && !this.rifleMag.visible) this.rifleMag.visible = true;

    const maxDist = 180;
    const envHit = this.world.raycast(this.camera.position, dir, maxDist);
    const enemyHit = this.enemies?.raycast(this.camera.position, dir, envHit ? envHit.distance : maxDist);
    let end;
    if (enemyHit) {
      end = enemyHit.point;
      const falloff = clamp(1 - Math.max(0, enemyHit.distance - 28) / 90, 0.7, 1);
      const isHead = enemyHit.head;
      const dmg = def.damage * falloff * (isHead ? def.headMul : 1);
      const killed = this.enemies.damage(enemyHit.enemy, dmg, isHead, enemyHit.point, dir);
      this.shotsHit++;
      if (isHead) this.headshots++;
      this.fx.spawnBlood(enemyHit.point, dir, isHead ? 12 : 7);
      this.hud?.hitmarker(isHead, killed);
      this.audio?.hit?.(isHead);
    } else if (envHit) {
      end = envHit.point;
      const mat = this.surfaceOf(envHit.collider);
      const n = this.normalFor(envHit);
      this.fx.impact(end, n, mat);
    } else {
      end = this.camera.position.clone().addScaledVector(dir, maxDist);
    }
    this.fx.tracer(muzzle, end, this.current === 'rifle' ? 0xffd9a0 : 0xffe6c2);
    this.fx.muzzleFlash(muzzle, dir, this.current === 'rifle' ? 1 : 0.75);
    this.audio.shot(this.current);
    this.player.addShake(this.aimT > 0.5 ? 0.045 : 0.095);
    const recoilMul = this.aimT > 0.5 ? def.adsRecoilMul : 1;
    this.player.addRecoil(def.recoil * recoilMul * (this.current === 'rifle' ? rand(0.85, 1.15) : 1), def.recoilYaw * rand(-1, 1) * (this.aimT > 0.5 ? 0.5 : 1));
    this.recoilVisualVel += def.recoil * 11 * recoilMul;
    this.kickZ += 0.028 * recoilMul;

    // eject shell
    this.shellTimer = 0.01;
    if (a.mag === 0) this.audio?.dryFire?.();
  }

  surfaceOf(collider) {
    const name = collider?.mesh?.name || '';
    if (name.includes('crate')) return 'wood';
    if (name) return 'concrete';
    return Math.random() > 0.5 ? 'metal' : 'concrete';
  }

  normalFor(hit) {
    if (hit.collider === 'ground') return new THREE.Vector3(0, 1, 0);
    const c = hit.collider, p = hit.point;
    const eps = 0.03;
    if (Math.abs(p.x - c.x1) < eps) return new THREE.Vector3(-1, 0, 0);
    if (Math.abs(p.x - c.x2) < eps) return new THREE.Vector3(1, 0, 0);
    if (Math.abs(p.z - c.z1) < eps) return new THREE.Vector3(0, 0, -1);
    if (Math.abs(p.z - c.z2) < eps) return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
  }

  update(dt) {
    if (!this.enabled) { this.holder.visible = false; this.flashlight.visible = false; return; }
    this.holder.visible = true; this.flashlight.visible = true;
    const input = this.input;
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);

    // aim
    const canAim = !this.reloading && !this.switching && !this.player.sprinting;
    const wantAim = input.aim && canAim;
    this.aimT = lerp(this.aimT, wantAim ? 1 : 0, clamp(dt * 13, 0, 1));
    this.player.ads = this.aimT > 0.5;
    this.player.fovTarget = lerp(78, this.def.adsFov, this.aimT);
    this.hud?.setAim(this.aimT);

    // fire
    if (input.fire) {
      if (!this.triggerHeld || this.def.auto) this.fire();
      this.triggerHeld = true;
    } else this.triggerHeld = false;

    // reload progress
    if (this.reloading) {
      this.reloadT += dt;
      const k = this.reloadT / this.def.reloadTime;
      if (k >= 0.28 && this.reloadStage === 0) {
        this.reloadStage = 1; this.audio?.reload?.(1);
        if (this.rifleMag) this.rifleMag.position.y -= 0.18;
      }
      if (k >= 0.58 && this.reloadStage === 1) {
        this.reloadStage = 2; this.audio?.reload?.(2);
        if (this.rifleMag) this.rifleMag.position.y = 0;
      }
      if (k >= 0.86 && this.reloadStage === 2) {
        this.reloadStage = 3; this.audio?.reload?.(0);
      }
      if (k >= 1) this.finishReload();
    }

    // switching
    if (this.switching) {
      this.switchT += dt;
      const k = this.switchT / this.def.switchTime;
      if (k >= 0.5 && this.switchStage === 0) { this.switchStage = 1; this.switchImmediate(this.switchTarget); }
      if (k >= 1) { this.switching = false; }
    }

    // shells
    if (this.shellTimer > 0) {
      this.shellTimer -= dt;
      if (this.shellTimer <= 0) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        const pos = this.camera.position.clone().addScaledVector(right, 0.22).addScaledVector(up, -0.05).addScaledVector(this.getForward(), 0.35);
        const dir = right.clone().addScaledVector(up, 0.25);
        this.fx.shell(pos, dir);
      }
    }

    // projectile grenades
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt; p.trail -= dt;
      p.vel.y -= 15 * dt;
      const next = p.mesh.position.clone().addScaledVector(p.vel, dt);
      let explode = false;
      if (next.y <= 0.09) {
        next.y = 0.09;
        if (p.vel.y < -0.5) { p.vel.y = -p.vel.y * 0.36; p.vel.x *= 0.62; p.vel.z *= 0.62; this.audio?.grenadeBounce?.(); }
        else { p.vel.y = 0; p.vel.x *= 0.9; p.vel.z *= 0.9; }
      }
      // collide with walls
      const fromC = p.mesh.position.clone();
      const dir = next.clone().sub(fromC);
      const dist = dir.length();
      if (dist > 0.0001) {
        dir.divideScalar(dist);
        const hit = this.world.raycast(fromC, dir, dist + 0.05);
        if (hit && hit.collider !== 'ground') {
          const n = this.normalFor(hit);
          p.vel.reflect(n).multiplyScalar(0.42);
          next.copy(fromC).addScaledVector(n, 0.03);
          this.audio?.grenadeBounce?.();
        }
      }
      p.mesh.position.copy(next);
      p.mesh.rotation.x += dt * 10; p.mesh.rotation.z += dt * 6;
      if (p.trail <= 0) {
        p.trail = 0.05;
        this.fx.spawnSmoke(p.mesh.position.clone(), new THREE.Vector3(0, 1, 0), 0.18, 0.5, 0.15);
      }
      if (p.life <= 0) explode = true;
      if (explode) {
        this.explodeGrenade(p.mesh.position.clone());
        this.scene.remove(p.mesh); this.projectiles.splice(i, 1);
      }
    }

    // sway/bob/recoil animation
    const yawDelta = this.player.yaw - this.prevYaw;
    const pitchDelta = this.player.pitch - this.prevPitch;
    this.prevYaw = this.player.yaw; this.prevPitch = this.player.pitch;
    this.swayX = lerp(this.swayX, clamp(-yawDelta * 0.7, -0.035, 0.035), clamp(dt * 9, 0, 1));
    this.swayY = lerp(this.swayY, clamp(pitchDelta * 0.6, -0.03, 0.03), clamp(dt * 9, 0, 1));
    this.bobTime += dt * (this.player.moving ? (this.player.sprinting ? 11 : 7.2) : 1.4);
    const bobK = this.player.ads ? 0.15 : 1;
    const bobX = Math.sin(this.bobTime) * 0.006 * bobK * (this.player.moving ? 1 : 0.25);
    const bobY = Math.abs(Math.cos(this.bobTime)) * 0.005 * bobK * (this.player.moving ? 1 : 0.25);

    this.recoilVisualVel += (-this.recoilVisual * 150 - this.recoilVisualVel * 18) * dt;
    this.recoilVisual += this.recoilVisualVel * dt;
    this.kickZ = lerp(this.kickZ, 0, clamp(dt * 12, 0, 1));

    const hip = this.def.hip, ads = this.def.ads;
    let px = lerp(hip.x, ads.x, this.aimT) + this.swayX + bobX;
    let py = lerp(hip.y, ads.y, this.aimT) + this.swayY + bobY;
    let pz = lerp(hip.z, ads.z, this.aimT) + this.kickZ;
    let rx = lerp(this.def.hipRot.x, 0, this.aimT) + this.recoilVisual * 0.6;
    let ry = lerp(this.def.hipRot.y, 0, this.aimT) + this.swayX * 1.6;
    let rz = lerp(this.def.hipRot.z, 0, this.aimT) + this.swayX * 0.8;

    // reload animation pose
    if (this.reloading) {
      const k = clamp(this.reloadT / this.def.reloadTime, 0, 1);
      const s = Math.sin(clamp(k * 1.05, 0, 1) * Math.PI);
      py -= 0.10 * s; px += 0.03 * s; pz += 0.03 * s;
      rx += 0.55 * s; rz -= 0.35 * s; ry += 0.25 * s;
    }
    // switch animation
    if (this.switching) {
      const k = clamp(this.switchT / this.def.switchTime, 0, 1);
      const s = Math.sin(k * Math.PI);
      py -= 0.22 * s; rx += 0.7 * s;
    }
    // sprint pose
    if (this.player.sprinting && this.player.speed > 5) {
      px += 0.025; ry -= 0.22; rz += 0.1; rx -= 0.06;
    }

    this.holder.position.set(px, py, pz);
    this.holder.rotation.set(rx, ry, rz);

    // muzzle flash point light flicker handled by fx
    this.flashlight.intensity = 4.6 + Math.sin(performance.now() * 0.02) * 0.1;

    // crosshair spread
    const moveFactor = clamp(this.player.speed / 7, 0, 1);
    const spread = lerp(this.def.hipSpread, this.def.adsSpread, this.aimT) + moveFactor * this.def.moveSpread * (1 - this.aimT * 0.7);
    this.hud?.setSpread(spread, this.aimT, this.player.sprinting);
  }

  getForward() {
    const d = new THREE.Vector3(); this.camera.getWorldDirection(d); return d;
  }
}
