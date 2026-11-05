import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

export class Player {
  constructor(camera, input, world, audio, hud) {
    this.camera = camera;
    this.input = input;
    this.world = world;
    this.audio = audio;
    this.hud = hud;
    this.position = new THREE.Vector3(0, 0, 19);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eye = 1.68; this.crouchEye = 1.08; this.eyeCurrent = 1.68;
    this.radius = 0.38;
    this.maxHealth = 100; this.health = 100;
    this.dead = false;
    this.onGround = true;
    this.ads = false;
    this.sprinting = false;
    this.moving = false;
    this.speed = 0;
    this.regenTimer = 0;
    this.damageFlash = 0;
    this.trauma = 0;
    this.recoilPitch = 0; this.recoilYaw = 0;
    this.recoilVelP = 0; this.recoilVelY = 0;
    this.bobPhase = 0; this.bobAmp = 0;
    this.stepDist = 0;
    this.fovTarget = 78;
    this.godMode = false;
    this.invuln = 0;
    this.time = 0;
    this.landKick = 0;
    this.deathTime = 0;
    this.lastDamageDir = 0;
    this.damageDirTime = 0;
    this.hitDirection = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._shake = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    this._wasGrounded = true;
    camera.rotation.order = 'YXZ';
  }

  reset() {
    this.position.set(0, 0, 19);
    this.velocity.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.eyeCurrent = this.eye;
    this.regenTimer = 0;
    this.trauma = 0; this.recoilPitch = 0; this.recoilYaw = 0;
    this.damageFlash = 0;
    this.time = 0;
    this.landKick = 0;
    this.updateCamera(0);
  }

  addShake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  addRecoil(pitch, yaw) {
    this.recoilVelP -= pitch;
    this.recoilVelY += yaw;
    this.recoilPitch += pitch * 0.55;
    this.recoilYaw += yaw * 0.55;
  }

  takeDamage(amount, sourcePos = null) {
    if (this.dead || this.godMode || this.invuln > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.regenTimer = 0;
    this.damageFlash = Math.min(1, this.damageFlash + 0.35 + amount / 60);
    this.addShake(Math.min(0.55, 0.16 + amount / 90));
    this.audio?.hurt?.();
    if (sourcePos) {
      const dir = Math.atan2(sourcePos.x - this.position.x, sourcePos.z - this.position.z);
      this.lastDamageDir = dir - this.yaw;
      this.damageDirTime = 1.2;
    }
    this.hud?.damage(amount);
    this.hud?.setHealth(this.health);
    if (this.health <= 0) {
      this.dead = true;
      this.deathTime = 0;
      this.input.exitLock();
      this.audio?.defeat?.();
      this.hud?.lowHealth(false);
    } else if (this.health < 30) this.hud?.lowHealth(true);
  }

  heal(amount) {
    if (this.dead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.hud?.setHealth(this.health);
    if (this.health >= 30) this.hud?.lowHealth(false);
  }

  update(dt) {
    if (this.dead) { this.deathTime += dt; this.updateDeathCamera(dt); return; }
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;

    const look = this.input.consumeLook();
    this.yaw -= look.x * 0.00215;
    this.pitch -= look.y * 0.00215;
    this.pitch = clamp(this.pitch, -1.46, 1.38);

    // movement input
    let fwd = clamp(this.input.forward, -1, 1);
    let strafe = clamp(this.input.strafe, -1, 1);
    const len = Math.hypot(fwd, strafe);
    if (len > 1) { fwd /= len; strafe /= len; }
    const wantsSprint = this.input.sprint && fwd > 0.25 && !this.ads && !this.input.crouch;
    this.sprinting = wantsSprint && !this.dead;
    const crouching = this.input.crouch && this.onGround;
    this.eyeCurrent = lerp(this.eyeCurrent, crouching ? this.crouchEye : this.eye, clamp(dt * 10, 0, 1));

    let maxSpeed = 5.1;
    if (crouching) maxSpeed = 2.5;
    else if (this.ads) maxSpeed = 3.0;
    else if (this.sprinting) maxSpeed = 7.4;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (-sin * fwd + cos * strafe);
    const wishZ = (-cos * fwd - sin * strafe);
    const accel = this.onGround ? (len > 0 ? 34 : 22) : 6;
    const targetVX = wishX * maxSpeed, targetVZ = wishZ * maxSpeed;
    this.velocity.x = lerp(this.velocity.x, targetVX, clamp(accel * dt, 0, 1));
    this.velocity.z = lerp(this.velocity.z, targetVZ, clamp(accel * dt, 0, 1));

    // jump
    if (this.input.jump && this.onGround) {
      this.velocity.y = 5.0; this.onGround = false;
      this.audio?.step?.(false);
    }
    if (!this.onGround) this.velocity.y -= 16.5 * dt;

    // integrate + collide
    const beforeY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 0) {
      if (!this._wasGrounded && this.velocity.y < -3) { this.addShake(0.12); this.landKick = 0.06; this.audio?.step?.(false); }
      this.position.y = 0; this.velocity.y = 0; this.onGround = true;
    } else this.onGround = false;
    this._wasGrounded = this.onGround;
    this.world.collide(this.position, this.radius, this.eye);

    const horiz = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = horiz;
    this.moving = horiz > 0.4;
    if (this.moving && this.onGround) {
      this.bobPhase += dt * (5.2 + horiz * 0.85);
      this.bobAmp = lerp(this.bobAmp, this.ads ? 0.006 : this.sprinting ? 0.05 : 0.028, dt * 6);
      this.stepDist += horiz * dt;
      const stepGap = this.sprinting ? 2.1 : 2.5;
      if (this.stepDist > stepGap) { this.stepDist = 0; this.audio?.step?.(false); }
    } else {
      this.bobAmp = lerp(this.bobAmp, 0, dt * 5);
    }

    // regen
    this.regenTimer += dt;
    if (this.regenTimer > 5.2 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 17 * dt);
      this.hud?.setHealth(this.health);
      if (this.health >= 30) this.hud?.lowHealth(false);
    }

    // recoil spring
    this.recoilVelP += (-this.recoilPitch * 190 - this.recoilVelP * 24) * dt;
    this.recoilPitch += this.recoilVelP * dt;
    this.recoilVelY += (-this.recoilYaw * 190 - this.recoilVelY * 24) * dt;
    this.recoilYaw += this.recoilVelY * dt;

    // damage flash & directional
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    if (this.damageDirTime > 0) this.damageDirTime -= dt;

    // trauma
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const t2 = this.trauma * this.trauma;
    const s = this._shake;
    s.x = (Math.random() - 0.5) * 0.045 * t2;
    s.y = (Math.random() - 0.5) * 0.045 * t2;
    s.z = (Math.random() - 0.5) * 0.03 * t2;
    s.rx = (Math.random() - 0.5) * 0.003 * t2;
    s.ry = (Math.random() - 0.5) * 0.003 * t2;
    s.rz = (Math.random() - 0.5) * 0.006 * t2;
    this.landKick *= Math.exp(-dt * 9);

    // fov
    const sprintFov = this.sprinting ? 5 : 0;
    const target = this.fovTarget + sprintFov;
    if (Math.abs(this.camera.fov - target) > 0.02) {
      this.camera.fov = lerp(this.camera.fov, target, clamp(dt * 10, 0, 1));
      this.camera.updateProjectionMatrix();
    }
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const bob = this.bobAmp;
    const by = Math.sin(this.bobPhase * 2) * bob;
    const bx = Math.cos(this.bobPhase) * bob * 0.7;
    const roll = Math.cos(this.bobPhase) * bob * 0.7;
    this.camera.position.set(
      this.position.x + bx + this._shake.x,
      this.position.y + this.eyeCurrent + by + this._shake.y - this.landKick,
      this.position.z + this._shake.z
    );
    this.camera.rotation.y = this.yaw + this._shake.ry;
    this.camera.rotation.x = this.pitch - this.recoilPitch + this._shake.rx;
    this.camera.rotation.z = roll + this._shake.rz;
  }

  updateDeathCamera(dt) {
    // fall to the ground and tilt the view
    const k = clamp(this.deathTime * 1.6, 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    this.camera.position.y = lerp(this.position.y + this.eyeCurrent, this.position.y + 0.32, e);
    this.camera.rotation.z = lerp(0, 1.2, e);
    this.camera.rotation.x = lerp(this.pitch - this.recoilPitch, 0.5, e);
  }
}
