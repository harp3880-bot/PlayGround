import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,190,110,.55)', outer = 'rgba(255,120,30,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.25, mid); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Effects {
  constructor(scene, camera, audio) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.tracers = [];
    this.decals = [];
    this.flashes = [];
    this.shells = [];
    this.smoke = [];
    this.rings = [];
    this.time = 0;
    this.tracerPool = [];
    this.glow = glowTexture();
    this.smokeTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      for (let i = 0; i < 18; i++) {
        const g = x.createRadialGradient(rand(30, 98), rand(30, 98), 0, 64, 64, rand(24, 60));
        g.addColorStop(0, 'rgba(190,195,200,.1)'); g.addColorStop(1, 'rgba(120,125,130,0)');
        x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();

    this.initSparks();
    this.initBlood();
    this.initShells();
    this.initSmokePool();
  }

  initSparks() {
    this.sparkCount = 500;
    const pos = new Float32Array(this.sparkCount * 3);
    const col = new Float32Array(this.sparkCount * 3);
    pos.fill(-9999);
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.sparkMat = new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
    this.sparkData = Array.from({ length: this.sparkCount }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
    this.sparkCursor = 0;
  }

  initBlood() {
    this.bloodCount = 260;
    const pos = new Float32Array(this.bloodCount * 3); pos.fill(-9999);
    this.bloodGeo = new THREE.BufferGeometry(); this.bloodGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.bloodMat = new THREE.PointsMaterial({ color: 0x6b0d0a, size: 0.075, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
    this.blood = new THREE.Points(this.bloodGeo, this.bloodMat); this.blood.frustumCulled = false;
    this.scene.add(this.blood);
    this.bloodData = Array.from({ length: this.bloodCount }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
    this.bloodCursor = 0;
  }

  initShells() {
    const geo = new THREE.CylinderGeometry(0.012, 0.014, 0.05, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb08d3e, metalness: 0.9, roughness: 0.3, emissive: 0x221100 });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.castShadow = false;
      this.scene.add(m); this.shells.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3() });
    }
    this.shellCursor = 0;
  }

  initSmokePool() {
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0x8f979e }));
      s.visible = false; this.scene.add(s);
      this.smoke.push({ sprite: s, life: 0, max: 0, vy: 0, scale: 1, grow: 1 });
    }
    this.smokeCursor = 0;
  }

  spawnSparks(point, normal, count = 9, color = 0xffb260, speed = 5) {
    const p = this.sparkGeo.attributes.position, c = this.sparkGeo.attributes.color;
    const col = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.sparkCursor; this.sparkCursor = (this.sparkCursor + 1) % this.sparkCount;
      const d = new THREE.Vector3(normal.x + rand(-0.8, 0.8), normal.y + rand(-0.4, 1.0), normal.z + rand(-0.8, 0.8)).normalize();
      const v = speed * rand(0.35, 1.35);
      const data = this.sparkData[i];
      data.life = rand(0.2, 0.62); data.max = data.life;
      data.vx = d.x * v; data.vy = d.y * v; data.vz = d.z * v;
      p.setXYZ(i, point.x, point.y, point.z);
      c.setXYZ(i, col.r, col.g, col.b);
    }
    p.needsUpdate = true; c.needsUpdate = true;
  }

  spawnBlood(point, dir, count = 7) {
    const p = this.bloodGeo.attributes.position;
    for (let k = 0; k < count; k++) {
      const i = this.bloodCursor; this.bloodCursor = (this.bloodCursor + 1) % this.bloodCount;
      const d = new THREE.Vector3(dir.x + rand(-0.6, 0.6), rand(-0.1, 0.8), dir.z + rand(-0.6, 0.6)).normalize();
      const data = this.bloodData[i];
      data.life = rand(0.25, 0.6); data.max = data.life;
      data.vx = d.x * rand(1, 4); data.vy = d.y * rand(1, 4); data.vz = d.z * rand(1, 4);
      p.setXYZ(i, point.x, point.y, point.z);
    }
    p.needsUpdate = true;
  }

  tracer(from, to, color = 0xffd9a0, width = 1) {
    let t = this.tracerPool.find(o => !o.active);
    if (!t) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(geo, mat); line.frustumCulled = false; this.scene.add(line);
      t = { line, active: false, life: 0, max: 1 }; this.tracerPool.push(t);
    }
    t.active = true; t.life = 0.075; t.max = 0.075; t.line.visible = true;
    t.line.material.color.setHex(color); t.line.material.opacity = 0.95;
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, from.x, from.y, from.z); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true;
    // bright head glow
    this.spawnSparks(to, new THREE.Vector3(0, 1, 0), 1, 0xffe4b0, 0.2);
  }

  muzzleFlash(pos, dir, scale = 1, color = 0xffc47a, withLight = true) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); sp.scale.setScalar(rand(0.35, 0.55) * scale); this.scene.add(sp);
    let light = null;
    if (withLight) {
      light = new THREE.PointLight(color, 14 * scale, 7 * scale, 2);
      light.position.copy(pos); this.scene.add(light);
    }
    this.flashes.push({ sprite: sp, light, life: 0.055, max: 0.055 });
    // small smoke wisp
    this.spawnSmoke(pos, dir, 0.4, 0.35, 0.8);
  }

  spawnSmoke(pos, dir, scale = 1, life = 0.8, opacity = 0.3) {
    const s = this.smoke[this.smokeCursor]; this.smokeCursor = (this.smokeCursor + 1) % this.smoke.length;
    s.sprite.visible = true; s.sprite.position.copy(pos).addScaledVector(dir, 0.1);
    s.life = life; s.max = life; s.vy = rand(0.2, 0.6); s.scale = scale * rand(0.7, 1.2); s.grow = rand(1.6, 2.8);
    s.opacity = opacity;
    s.sprite.scale.setScalar(s.scale); s.sprite.material.opacity = opacity;
  }

  impact(point, normal, materialType = 'concrete') {
    const color = materialType === 'metal' ? 0xffd68a : materialType === 'wood' ? 0xd5a46a : 0xffb063;
    this.spawnSparks(point, normal, materialType === 'metal' ? 14 : 8, color, materialType === 'metal' ? 7 : 4.5);
    this.spawnSmoke(point, normal, rand(0.3, 0.6), rand(0.4, 0.9), 0.22);
    this.spawnDecal(point, normal);
    this.audio?.impact?.(materialType);
  }

  spawnDecal(point, normal) {
    let d = this.decals.find(o => !o.active);
    if (!d) {
      if (this.decals.length > 70) { d = this.decals.shift(); }
      else {
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), new THREE.MeshBasicMaterial({ map: this.glow, color: 0x090909, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        this.scene.add(mesh); d = { mesh, active: false, life: 0 };
      }
    }
    d.active = true; d.life = 30;
    d.mesh.visible = true; d.mesh.material.opacity = 0.55;
    d.mesh.position.copy(point).addScaledVector(normal, 0.012);
    d.mesh.lookAt(point.clone().add(normal));
    d.mesh.rotateZ(rand(0, Math.PI * 2));
    d.mesh.scale.setScalar(rand(0.6, 1.35));
    this.decals.push(d);
  }

  shell(pos, dir) {
    const s = this.shells[this.shellCursor]; this.shellCursor = (this.shellCursor + 1) % this.shells.length;
    s.life = 1.6; s.mesh.visible = true; s.mesh.position.copy(pos);
    s.mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    s.vx = dir.x * rand(0.8, 2) + rand(-0.6, 0.6);
    s.vy = rand(1.2, 2.6);
    s.vz = dir.z * rand(0.8, 2) + rand(-0.6, 0.6);
    s.spin.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
    s.bounced = false;
  }

  explosion(point, radius = 7) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    sphere.position.copy(point); this.scene.add(sphere);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffa45a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(point); ring.rotation.x = -Math.PI / 2; this.scene.add(ring);
    const light = new THREE.PointLight(0xffa24a, 90, radius * 4, 2); light.position.copy(point).add(new THREE.Vector3(0, 1, 0)); this.scene.add(light);
    this.flashes.push({ sphere, ring, light, life: 0.55, max: 0.55, explosion: true });
    for (let i = 0; i < 55; i++) {
      const n = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize();
      const p = point.clone().addScaledVector(n, rand(0.2, 1.2));
      this.spawnSparks(p, n, 1, i % 3 === 0 ? 0xffe0a0 : 0xff7b2e, rand(9, 22));
    }
    for (let i = 0; i < 8; i++) {
      this.spawnSmoke(point.clone().add(new THREE.Vector3(rand(-1.6, 1.6), rand(0, 2), rand(-1.6, 1.6))), new THREE.Vector3(0, 1, 0), rand(1.4, 3), rand(1.4, 2.6), 0.38);
    }
    this.audio?.explosion?.();
  }

  update(dt) {
    this.time += dt;

    // tracers
    for (const t of this.tracerPool) {
      if (!t.active) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max) * 0.95;
      if (t.life <= 0) { t.active = false; t.line.visible = false; }
    }
    // flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      if (f.sphere) {
        const s = 1 + (1 - k) * 6;
        f.sphere.scale.setScalar(s); f.sphere.material.opacity = k * 0.85;
        f.ring.scale.setScalar(1 + (1 - k) * 14); f.ring.material.opacity = k * 0.6;
        f.light.intensity = 90 * k;
      } else {
        f.sprite.material.opacity = k; f.sprite.scale.setScalar(f.sprite.scale.x * (1 + dt * 4));
        if (f.light) f.light.intensity = 14 * k;
      }
      if (f.life <= 0) {
        if (f.sprite) { this.scene.remove(f.sprite); f.sprite.material.dispose(); }
        if (f.sphere) { this.scene.remove(f.sphere); this.scene.remove(f.ring); f.sphere.material.dispose(); f.ring.material.dispose(); }
        if (f.light) this.scene.remove(f.light);
        this.flashes.splice(i, 1);
      }
    }
    // spark particles
    const sp = this.sparkGeo.attributes.position; let dirty = false;
    for (let i = 0; i < this.sparkCount; i++) {
      const d = this.sparkData[i];
      if (d.life <= 0) continue;
      d.life -= dt; dirty = true;
      if (d.life <= 0) { sp.setXYZ(i, 0, -9999, 0); continue; }
      d.vy -= 13 * dt;
      sp.setXYZ(i, sp.getX(i) + d.vx * dt, sp.getY(i) + d.vy * dt, sp.getZ(i) + d.vz * dt);
    }
    if (dirty) sp.needsUpdate = true;
    // blood
    const bp = this.bloodGeo.attributes.position; let bdirty = false;
    for (let i = 0; i < this.bloodCount; i++) {
      const d = this.bloodData[i];
      if (d.life <= 0) continue;
      d.life -= dt; bdirty = true;
      if (d.life <= 0) { bp.setXYZ(i, 0, -9999, 0); continue; }
      d.vy -= 9 * dt;
      bp.setXYZ(i, bp.getX(i) + d.vx * dt, bp.getY(i) + d.vy * dt, bp.getZ(i) + d.vz * dt);
    }
    if (bdirty) bp.needsUpdate = true;
    // shells
    for (const s of this.shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.vy -= 15 * dt;
      s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; s.mesh.rotation.z += s.spin.z * dt;
      if (s.mesh.position.y < 0.02) {
        s.mesh.position.y = 0.02;
        if (!s.bounced) { s.vy = -s.vy * 0.35; s.vx *= 0.5; s.vz *= 0.5; s.bounced = true; }
        else { s.vy = 0; s.vx *= 0.75; s.vz *= 0.75; }
        s.spin.multiplyScalar(0.7);
      }
    }
    // smoke
    for (const s of this.smoke) {
      if (s.life <= 0) { if (s.sprite.visible) s.sprite.visible = false; continue; }
      s.life -= dt;
      const k = Math.max(0, s.life / s.max);
      s.sprite.material.opacity = k * s.opacity;
      s.sprite.scale.setScalar(s.scale * (1 + (1 - k) * s.grow));
      s.sprite.position.y += s.vy * dt;
      if (s.life <= 0) s.sprite.visible = false;
    }
    // decals fade
    for (const d of this.decals) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life < 3) d.mesh.material.opacity = Math.max(0, d.life / 3) * 0.55;
      if (d.life <= 0) { d.active = false; d.mesh.visible = false; }
    }
  }

  dispose() {
    for (const t of this.tracerPool) this.scene.remove(t.line);
    for (const d of this.decals) this.scene.remove(d.mesh);
    for (const s of this.shells) this.scene.remove(s.mesh);
    for (const s of this.smoke) this.scene.remove(s.sprite);
    for (const f of this.flashes) this.scene.remove(f.light);
    this.scene.remove(this.sparks); this.scene.remove(this.blood);
  }
}
