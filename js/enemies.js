import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

const TYPES = {
  grunt: { health: 100, speed: 2.55, damage: 9, interval: 1.7, accuracy: 0.46, preferred: 11, scale: 1, score: 100, burst: 1 },
  scout: { health: 68, speed: 3.65, damage: 7, interval: 1.25, accuracy: 0.42, preferred: 8, scale: 0.94, score: 130, burst: 1 },
  heavy: { health: 950, speed: 1.65, damage: 13, interval: 2.15, accuracy: 0.52, preferred: 14, scale: 1.48, score: 1200, burst: 4 },
};

function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x, oy = origin.y - center.y, oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  return t > 0 ? t : null;
}

export class EnemyManager {
  constructor(scene, world, fx, audio, hud, player) {
    this.scene = scene; this.world = world; this.fx = fx; this.audio = audio; this.hud = hud; this.player = player;
    this.enemies = [];
    this.queue = [];
    this.spawnTimer = 0;
    this.wave = 0;
    this.maxAlive = 6;
    this.active = false;
    this.spawnInterval = 1;
    this.boss = null;
    this.kills = 0;
    this.headshots = 0;
    this.onKill = null;
    this.onWaveCleared = null;
    this.onBossSpawn = null;
    this.onAllDead = null;
    this._pendingBoss = false;
    this.time = 0;
    this._tmp = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
  }

  reset() {
    for (const e of this.enemies) this._remove(e);
    this.enemies = [];
    this.queue = [];
    this.wave = 0; this.active = false; this.spawnTimer = 0;
    this.boss = null; this.kills = 0; this.headshots = 0;
    this._pendingBoss = false;
  }

  get remaining() {
    let alive = 0;
    for (const e of this.enemies) if (!e.dead) alive++;
    return alive + this.queue.length;
  }
  get aliveCount() {
    let a = 0; for (const e of this.enemies) if (!e.dead) a++;
    return a;
  }

  startWave(n) {
    this.wave = n; this.active = true;
    this.maxAlive = Math.min(3 + n, 7);
    this.spawnInterval = Math.max(0.55, 1.25 - n * 0.09);
    const q = [];
    const push = (type, count) => { for (let i = 0; i < count; i++) q.push(type); };
    if (n === 1) push('grunt', 4);
    else if (n === 2) { push('grunt', 5); push('scout', 1); }
    else if (n === 3) { push('grunt', 6); push('scout', 2); }
    else if (n === 4) { push('grunt', 7); push('scout', 3); }
    else if (n === 5) { push('grunt', 6); push('scout', 2); push('heavy', 1); }
    else { push('grunt', 8 + n); push('scout', 2); }
    // shuffle but keep boss last
    const boss = q.filter(t => t === 'heavy');
    const rest = q.filter(t => t !== 'heavy');
    for (let i = rest.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
    // ensure first few aren't all scouts
    this.queue = rest.concat(boss);
    this.spawnTimer = 0.2;
    this.active = true;
    this._spawnIndex = 0;
    return q.length;
  }

  spawn(type) {
    const def = TYPES[type];
    const g = this.buildSoldier(type);
    // choose spawn point far from player
    let point = null, bestD = -1;
    for (let i = 0; i < 4; i++) {
      const sp = this.world.spawnPoints[(Math.random() * this.world.spawnPoints.length) | 0];
      const wp = sp.clone().add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
      const d = wp.distanceTo(this.player.position);
      if (d > bestD && d > 14) { bestD = d; point = wp; }
    }
    if (!point) point = this.world.spawnPoints[0].clone();
    // nudge out of obstacles
    this.world.collide(point, 0.6, 1.8);
    g.position.copy(point);
    g.scale.setScalar(def.scale);
    g.rotation.y = Math.atan2(this.player.position.x - point.x, this.player.position.z - point.z);
    this.scene.add(g);
    const matList = [];
    g.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive) {
        const mat = o.material;
        if (mat.userData.baseEmissive === undefined) {
          mat.userData.baseEmissive = mat.emissive.getHex();
          mat.userData.baseIntensity = mat.emissiveIntensity;
        }
        matList.push(mat);
      }
    });

    const e = {
      type, def, group: g, position: point.clone(), yaw: g.rotation.y,
      health: def.health, maxHealth: def.health, dead: false, deathT: 0,
      fireTimer: rand(0.8, 1.8), burstLeft: 0, burstTimer: 0,
      state: 'spawn', spawnT: 0, walkPhase: rand(0, 6), strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeTimer: rand(1, 3), hitFlash: 0, flinch: 0, stagger: 0, mats: matList, hits: 0,
      moveSpeed: def.speed * rand(0.9, 1.1), lastSeen: 0, fireAnim: 0,
      scale: def.scale, headOffset: type === 'heavy' ? 2.9 : 1.68, torsoOffset: type === 'heavy' ? 2.12 : 1.2, legOffset: type === 'heavy' ? 1.05 : 0.62, aimTime: 0, visible: true,
      patrolAngle: rand(0, 6.28),
    };
    e.root = g;
    e.legL = g.getObjectByName('legL'); e.legR = g.getObjectByName('legR');
    e.armL = g.getObjectByName('armL'); e.armR = g.getObjectByName('armR');
    e.gun = g.getObjectByName('gun');
    e.muzzle = new THREE.Object3D();
    if (e.gun) { e.muzzle.position.set(0, 0.08, -0.62); e.gun.add(e.muzzle); }
    else { e.muzzle.position.set(0.3, 1.35, 0.4); g.add(e.muzzle); }
    this.enemies.push(e);
    if (type === 'heavy') { this.boss = e; this.hud?.setBoss(e.health, e.maxHealth, true); this.onBossSpawn?.(e); }
    // spawn effect
    this.fx.spawnSmoke(point.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 1.4, 1.2, 0.3);
    this.fx.spawnSparks(point.clone().add(new THREE.Vector3(0, 1.1, 0)), new THREE.Vector3(0, 1, 0), 8, 0xff4a33, 2.5);
    return e;
  }

  buildSoldier(type) {
    const heavy = type === 'heavy';
    const scout = type === 'scout';
    const g = new THREE.Group(); g.name = 'soldier';
    const uniform = new THREE.MeshStandardMaterial({ color: scout ? 0x41463f : 0x474c45, roughness: 0.92, metalness: 0.08 });
    const armor = new THREE.MeshStandardMaterial({ color: heavy ? 0x3f3330 : 0x2c3234, roughness: 0.55, metalness: 0.55 });
    const vest = new THREE.MeshStandardMaterial({ color: heavy ? 0x51332e : 0x4d5143, roughness: 0.85, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.7, metalness: 0.3 });
    const helmet = new THREE.MeshStandardMaterial({ color: heavy ? 0x463431 : 0x343a35, roughness: 0.6, metalness: 0.45 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8a735e, roughness: 0.9 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x1a0503, emissive: heavy ? 0xff1a0a : 0xff3a1c, emissiveIntensity: 2.2, roughness: 0.3 });
    const redAccent = new THREE.MeshStandardMaterial({ color: 0x3a0e0b, emissive: 0x7a1008, emissiveIntensity: 0.35, roughness: 0.8 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x191a18, roughness: 0.9 });

    const s = heavy ? 1.18 : 1;
    // legs (pivot at hip)
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.name = side < 0 ? 'legL' : 'legR';
      leg.position.set(side * 0.13 * s, 0.92, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.46 * s, 0.19 * s), uniform); thigh.position.y = -0.23 * s; leg.add(thigh);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.1 * s, 0.2 * s), dark); knee.position.y = -0.46 * s; leg.add(knee);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.145 * s, 0.42 * s, 0.16 * s), uniform); shin.position.y = -0.68 * s; leg.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.14 * s, 0.28 * s), dark); boot.position.set(0, -0.92 * s, 0.04 * s); leg.add(boot);
      // knee pad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.12 * s, 0.06 * s), armor); pad.position.set(0, -0.48 * s, 0.1 * s); leg.add(pad);
      g.add(leg);
    }
    // torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46 * s, 0.52 * s, 0.26 * s), uniform); torso.position.y = 1.22 * s; g.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.50 * s, 0.42 * s, 0.32 * s), vest); chest.position.y = 1.24 * s; g.add(chest);
    // pouches
    for (const x of [-0.16, 0, 0.16]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.13 * s, 0.06 * s), armor); p.position.set(x * s, 1.14 * s, 0.18 * s); g.add(p);
    }
    // belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.08 * s, 0.28 * s), dark); belt.position.y = 0.98 * s; g.add(belt);
    // backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.38 * s, 0.16 * s), vest); pack.position.set(0, 1.26 * s, -0.2 * s); g.add(pack);
    const packTop = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.09 * s, 0.18 * s), armor); packTop.position.set(0, 1.48 * s, -0.19 * s); g.add(packTop);
    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.185 * s, 0.19 * s, 0.19 * s), skin); head.position.y = 1.63 * s; g.add(head);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.15 * s, 0.25 * s), helmet); helm.position.y = 1.735 * s; g.add(helm);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.035 * s, 0.08 * s), helmet); brim.position.set(0, 1.69 * s, 0.13 * s); g.add(brim);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.045 * s, 0.02 * s), visorMat); visor.position.set(0, 1.645 * s, 0.103 * s); g.add(visor);
    // mask
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.09 * s, 0.06 * s), dark); mask.position.set(0, 1.575 * s, 0.1 * s); g.add(mask);
    // headset earpieces
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.035 * s, 8), dark);
      ear.rotation.z = Math.PI / 2; ear.position.set(side * 0.11 * s, 1.65 * s, 0); g.add(ear);
    }
    if (heavy) {
      const aura = new THREE.PointLight(0xff2a16, 2.6, 6, 2); aura.position.set(0, 1.55 * s, 0.25); g.add(aura);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), redAccent); crest.position.set(0, 1.81 * s, 0); g.add(crest);
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.3), armor);
        shoulder.position.set(side * 0.33, 1.48 * s, 0); shoulder.rotation.z = side * -0.25; g.add(shoulder);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.34), redAccent);
        plate.position.set(side * 0.28, 1.31, 0); plate.rotation.z = side * -0.1; g.add(plate);
      }
    } else {
      // shoulder patches
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), redAccent);
      patch.position.set(-0.19 * s, 1.4 * s, 0.17 * s); g.add(patch);
    }
    // arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.name = side < 0 ? 'armL' : 'armR';
      arm.position.set(side * 0.29 * s, 1.44 * s, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.32 * s, 0.16 * s), uniform); upper.position.y = -0.15 * s; arm.add(upper);
      const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.16 * s, 0.17 * s), armor); elbow.position.y = -0.33 * s; arm.add(elbow);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.115 * s, 0.3 * s, 0.13 * s), uniform); fore.position.y = -0.48 * s; fore.position.z = 0.02; arm.add(fore);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.11 * s, 0.13 * s), glove); hand.position.set(0, -0.65 * s, 0.04); arm.add(hand);
      // pose arms forward holding rifle
      arm.rotation.x = side < 0 ? -1.15 : -1.28;
      arm.rotation.z = side * 0.18;
      g.add(arm);
    }
    // weapon
    const gun = new THREE.Group(); gun.name = 'gun';
    const gm = new THREE.MeshStandardMaterial({ color: 0x191c1e, metalness: 0.8, roughness: 0.4 });
    const gm2 = new THREE.MeshStandardMaterial({ color: 0x2b2e2a, metalness: 0.3, roughness: 0.7 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, heavy ? 0.8 : 0.55), gm); receiver.position.z = -0.1; gun.add(receiver);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, heavy ? 0.55 : 0.35, 8), gm); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, heavy ? -0.75 : -0.5); gun.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.08), gm2); mag.position.set(0, -0.14, 0.0); mag.rotation.x = -0.2; gun.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.2), gm2); stock.position.z = 0.28; gun.add(stock);
    if (heavy) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), gm2); drum.rotation.z = Math.PI / 2; drum.position.set(0.09, -0.03, 0.05); gun.add(drum);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.2), visorMat); glow.position.set(0, 0.07, -0.2); gun.add(glow);
    }
    gun.position.set(0.13 * s, 1.28 * s, 0.34 * s);
    gun.rotation.y = 0.04;
    g.add(gun);
    // muzzle flash sprite placeholder
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fx.glow, color: 0xffc070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.set(0, 0.015, heavy ? -1.02 : -0.72); flash.scale.set(0.35, 0.35, 1); gun.add(flash);
    g.userData.flash = flash;
    // eyes / visor glow sprite
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fx.glow, color: 0xff3a1a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 1.645 * s, 0.13 * s); glow.scale.set(0.34, 0.19, 1); g.add(glow);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  _remove(e) { this.scene.remove(e.group); }

  raycast(origin, dir, maxDist = 200) {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const p = e.position;
      const scale = e.scale;
      const head = this._tmp.set(p.x, p.y + e.headOffset, p.z);
      const ht = raySphere(origin, dir, head, 0.21 * scale);
      if (ht !== null && ht < maxDist && (!best || ht < best.distance)) {
        best = { enemy: e, distance: ht, point: origin.clone().addScaledVector(dir, ht), head: true };
      }
      const torso = this._tmp.set(p.x, p.y + e.torsoOffset, p.z);
      const bt = raySphere(origin, dir, torso, 0.4 * scale);
      if (bt !== null && bt < maxDist && (!best || bt < best.distance)) {
        best = { enemy: e, distance: bt, point: origin.clone().addScaledVector(dir, bt), head: false };
      }
      const legs = this._tmp.set(p.x, p.y + e.legOffset, p.z);
      const lt = raySphere(origin, dir, legs, 0.34 * scale);
      if (lt !== null && lt < maxDist && (!best || lt < best.distance)) {
        best = { enemy: e, distance: lt, point: origin.clone().addScaledVector(dir, lt), head: false };
      }
    }
    return best;
  }

  damage(e, amount, head, point, dir) {
    if (!e || e.dead) return false;
    e.health -= amount;
    e.hitFlash = 0.14;
    e.flinch = 0.18;
    if (head) { e.stagger = 0.3; }
    // alert
    if (e.state === 'spawn') e.state = 'seek';
    e.fireTimer = Math.min(e.fireTimer, 0.6);
    if (e === this.boss) this.hud?.setBoss(Math.max(0, e.health), e.maxHealth, true);
    if (e.health <= 0) {
      this.kill(e, head, point, dir);
      return true;
    }
    return false;
  }

  kill(e, head, point, dir) {
    if (e.dead) return;
    e.dead = true; e.deathT = 0; e.health = 0;
    e.group.userData.flash.material.opacity = 0;
    for (const m of e.mats) { if (m.emissive) { m.emissive.setHex(m.userData.baseEmissive ?? 0x000000); m.emissiveIntensity = m.userData.baseIntensity ?? 0; } }
    this.kills++; if (head) this.headshots++;
    this.fx.spawnBlood(point || e.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dir || new THREE.Vector3(0, 1, 0), head ? 22 : 12);
    this.fx.spawnSparks(e.position.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, 1, 0), 6, 0x9c1a10, 3);
    if (e === this.boss) { this.hud?.setBoss(0, e.maxHealth, false); }
    this.onKill?.(e, head);
  }

  damageRadius(p, radius, maxDamage) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.position.clone().setY(1).distanceTo(p);
      if (d < radius) {
        const dmg = maxDamage * (1 - d / radius);
        const dir = e.position.clone().sub(p).setY(0).normalize();
        this.fx.spawnBlood(e.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dir, 10);
        this.damage(e, dmg, false, e.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dir);
      }
    }
  }

  update(dt, camera) {
    this.time += dt;
    // spawn queue
    if (this.active) {
      this.spawnTimer -= dt;
      if (this.queue.length > 0 && this.aliveCount < this.maxAlive && this.spawnTimer <= 0) {
        const type = this.queue.shift();
        this.spawn(type);
        this.spawnTimer = this.spawnInterval * rand(0.8, 1.25);
      }
      if (this.queue.length === 0 && this.aliveCount === 0) {
        this.active = false;
        this.onAllDead?.(this.wave);
      }
    }

    for (const e of this.enemies) {
      if (e.dead) { this.updateDead(e, dt); continue; }
      this.updateAlive(e, dt, camera);
    }
    // remove long dead
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && e.deathT > 7) { this._remove(e); this.enemies.splice(i, 1); }
    }
  }

  updateDead(e, dt) {
    e.deathT += dt;
    const k = clamp(e.deathT / 0.85, 0, 1);
    const er = 1 - Math.pow(1 - k, 2);
    e.group.rotation.x = -er * 1.35;
    e.group.position.y = e.position.y + Math.sin(k * Math.PI) * 0.05;
    if (e.deathT > 4.5) {
      e.group.position.y = e.position.y - (e.deathT - 4.5) * 0.12;
    }
    if (e.deathT > 6.5) e.group.visible = false;
  }

  updateAlive(e, dt, camera) {
    const player = this.player;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.flinch > 0) e.flinch -= dt;
    if (e.stagger > 0) e.stagger -= dt;
    // material flash
    for (const m of e.mats) {
      if (!m.emissive) continue;
      if (e.hitFlash > 0) { m.emissive.setHex(0x661108); m.emissiveIntensity = 0.9; }
      else { m.emissive.setHex(m.userData.baseEmissive ?? 0x000000); m.emissiveIntensity = m.userData.baseIntensity ?? 0; }
    }
    if (e.def.health > 300) {
      // boss stays angry-lit
    }

    if (e.state === 'spawn') {
      e.spawnT += dt;
      const k = clamp(e.spawnT / 0.55, 0, 1);
      e.group.scale.setScalar(e.scale * lerp(0.3, 1, k));
      e.group.position.y = e.position.y + (1 - k) * 0.5;
      if (k >= 1) { e.state = 'seek'; e.group.scale.setScalar(e.scale); }
      return;
    }
    const toPlayer = new THREE.Vector3(player.position.x - e.position.x, 0, player.position.z - e.position.z);
    const dist = toPlayer.length();
    toPlayer.normalize();
    const eye = new THREE.Vector3(e.position.x, e.position.y + 1.55 * e.scale, e.position.z);
    const playerEye = new THREE.Vector3(player.position.x, player.position.y + player.eyeCurrent, player.position.z);
    const los = dist < 34 && this.world.hasLOS(eye, playerEye);
    e.lastSeen = los ? 0 : e.lastSeen + dt;

    // face player when close / attacking
    const targetYaw = Math.atan2(player.position.x - e.position.x, player.position.z - e.position.z);
    let dy = targetYaw - e.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    e.yaw += dy * clamp(dt * (los ? 5 : 2.5), 0, 1);
    e.group.rotation.y = e.yaw;

    // movement
    let moveX = 0, moveZ = 0, moving = false;
    const preferred = e.def.preferred;
    if (e.stagger > 0) {
      // recoil in place
    } else if (!los || dist > preferred + 3) {
      moveX = toPlayer.x; moveZ = toPlayer.z; moving = true;
    } else if (dist < preferred - 4) {
      moveX = -toPlayer.x; moveZ = -toPlayer.z; moving = true;
    } else {
      // strafe around the player
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) { e.strafeDir *= -1; e.strafeTimer = rand(1.4, 3.2); }
      moveX = -toPlayer.z * e.strafeDir * 0.7;
      moveZ = toPlayer.x * e.strafeDir * 0.7;
      moving = true;
    }
    // separation
    for (const other of this.enemies) {
      if (other === e || other.dead) continue;
      const dx = e.position.x - other.position.x, dz = e.position.z - other.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 2.2 && d2 > 0.001) { const d = Math.sqrt(d2); moveX += (dx / d) * 0.8; moveZ += (dz / d) * 0.8; }
    }
    const ml = Math.hypot(moveX, moveZ);
    if (ml > 0.001 && moving) {
      moveX /= ml; moveZ /= ml;
      const speed = e.moveSpeed * (los ? 0.75 : 1.15);
      const nx = e.position.x + moveX * speed * dt;
      const nz = e.position.z + moveZ * speed * dt;
      const before = e.position.clone();
      e.position.x = nx; e.position.z = nz;
      this.world.collide(e.position, 0.42 * e.scale, 1.8);
      // if stuck, steer
      if (Math.hypot(e.position.x - before.x, e.position.z - before.z) < speed * dt * 0.35) {
        e.strafeDir *= -1;
        const px = -toPlayer.z * e.strafeDir, pz = toPlayer.x * e.strafeDir;
        e.position.x = before.x + px * speed * dt;
        e.position.z = before.z + pz * speed * dt;
        this.world.collide(e.position, 0.42 * e.scale, 1.8);
      }
    }
    e.group.position.x = e.position.x;
    e.group.position.z = e.position.z;

    // footsteps / walk animation
    if (moving) {
      e.walkPhase += dt * (e.moveSpeed * 2.6);
      const swing = Math.sin(e.walkPhase) * 0.55;
      if (e.legL) e.legL.rotation.x = swing;
      if (e.legR) e.legR.rotation.x = -swing;
      if (e.armL) e.armL.rotation.x = -1.15 + Math.sin(e.walkPhase + Math.PI) * 0.08;
      if (e.armR) e.armR.rotation.x = -1.28 + Math.sin(e.walkPhase) * 0.05;
      e.group.position.y = e.position.y + Math.abs(Math.sin(e.walkPhase * 2)) * 0.025;
    } else {
      if (e.legL) e.legL.rotation.x = lerp(e.legL.rotation.x, 0, dt * 6);
      if (e.legR) e.legR.rotation.x = lerp(e.legR.rotation.x, 0, dt * 6);
      e.group.position.y = e.position.y;
    }

    // shooting
    e.fireAnim = Math.max(0, e.fireAnim - dt * 6);
    const flash = e.group.userData.flash;
    if (flash) flash.material.opacity = e.fireAnim > 0.5 ? 1 : 0;
    if (los && dist < 36 && e.stagger <= 0 && !e.dead) {
      e.state = 'attack';
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        if (e.burstLeft <= 0) e.burstLeft = e.def.burst;
        this.enemyShoot(e, dist, camera);
        e.burstLeft--;
        e.fireAnim = 1;
        if (e.burstLeft > 0) e.fireTimer = 0.13;
        else e.fireTimer = e.def.interval * rand(0.8, 1.3);
      }
    } else {
      e.fireTimer = Math.max(e.fireTimer - dt, 0);
    }
    // flinch
    if (e.flinch > 0) e.group.rotation.z = Math.sin(e.flinch * 80) * 0.025;
    else e.group.rotation.z = 0;
  }

  enemyShoot(e, dist, camera) {
    const origin = e.muzzle.getWorldPosition(new THREE.Vector3());
    const target = new THREE.Vector3(this.player.position.x, this.player.position.y + 1.2, this.player.position.z);
    const toTarget = target.clone().sub(origin);
    const len = toTarget.length(); toTarget.divideScalar(len);
    // accuracy affected by distance and player movement
    let chance = e.def.accuracy * clamp(1.2 - dist / 55, 0.35, 1.1);
    if (this.player.sprinting) chance *= 0.62;
    if (this.player.speed > 2) chance *= 0.8;
    if (this.player.ads) chance *= 0.9;
    const hit = Math.random() < chance;
    let end;
    if (hit) {
      end = target.clone();
      const dmg = e.def.damage * rand(0.8, 1.2);
      this.player.takeDamage(dmg, e.position);
      // tracer appears to pass
      end.add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.1, 0.1), rand(-0.2, 0.2)));
    } else {
      const miss = new THREE.Vector3(rand(-1.2, 1.2), rand(-0.4, 1.0), rand(-1.2, 1.2));
      end = target.clone().add(miss);
      // check if misses hit environment
      const env = this.world.raycast(origin, toTarget, len);
      if (env) { end = env.point; this.fx.impact(env.point, this.fxNormal(env), 'concrete'); }
    }
    this.fx.tracer(origin, end, 0xffb090, 1);
    this.fx.muzzleFlash(origin, toTarget, e.scale * 0.8, 0xffb36a, false);
    // pan by angle relative to camera
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const rel = origin.clone().sub(camera.position);
    const pan = clamp(rel.normalize().dot(right), -1, 1);
    this.audio?.enemyShot?.(dist, pan);
  }

  fxNormal(hit) {
    if (hit.collider === 'ground') return new THREE.Vector3(0, 1, 0);
    const c = hit.collider, p = hit.point;
    const eps = 0.03;
    if (Math.abs(p.x - c.x1) < eps) return new THREE.Vector3(-1, 0, 0);
    if (Math.abs(p.x - c.x2) < eps) return new THREE.Vector3(1, 0, 0);
    if (Math.abs(p.z - c.z1) < eps) return new THREE.Vector3(0, 0, -1);
    if (Math.abs(p.z - c.z2) < eps) return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
  }
}
