import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- textures
function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  return c;
}
function tex(canvas, repeat = 1, repeatY = null, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeatY ?? repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
function grain(ctx, size, amount, base) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  if (base) { ctx.globalAlpha = 0.12; ctx.fillStyle = base; ctx.fillRect(0, 0, size, size); ctx.globalAlpha = 1; }
}
function blotches(ctx, size, count, colors, rMin, rMax, alpha = 0.15) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = rand(rMin, rMax);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const color = colors[(Math.random() * colors.length) | 0];
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}
function crack(ctx, size, color, n = 8) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 3 + (Math.random() * 5 | 0);
    for (let s = 0; s < steps; s++) { x += rand(-18, 18); y += rand(-18, 18); ctx.lineTo(x, y); }
    ctx.globalAlpha = rand(0.15, 0.5); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const TEX = {};
function buildTextures() {
  TEX.concrete = tex(makeCanvas(512, (c, s) => {
    c.fillStyle = '#6e7276'; c.fillRect(0, 0, s, s);
    blotches(c, s, 60, ['92,96,99', '45,48,51', '120,122,118'], 4, 44, 0.2);
    grain(c, s, 42);
    crack(c, s, '24,26,28', 18);
    for (let i = 0; i < 24; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      c.fillStyle = `rgba(30,33,35,${rand(0.08, 0.25)})`;
      c.fillRect(x, y, rand(1, 5), rand(2, 16));
    }
  }), 3);
  TEX.concreteBump = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, s, s); blotches(c, s, 90, ['0,0,0', '255,255,255'], 2, 22, 0.25); grain(c, s, 90);
  }), 3, 3, false);
  TEX.asphalt = tex(makeCanvas(512, (c, s) => {
    c.fillStyle = '#33373a'; c.fillRect(0, 0, s, s);
    blotches(c, s, 55, ['20,23,26', '78,82,84', '48,50,50'], 6, 70, 0.16);
    grain(c, s, 50);
    for (let i = 0; i < 1200; i++) {
      c.fillStyle = `rgba(${rand(70, 130) | 0},${rand(70, 130) | 0},${rand(70, 130) | 0},${rand(0.06, 0.3)})`;
      c.fillRect(Math.random() * s, Math.random() * s, rand(1, 3), rand(1, 3));
    }
    crack(c, s, '14,16,17', 14);
  }), 10);
  TEX.asphaltBump = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#7a7a7a'; c.fillRect(0, 0, s, s); grain(c, s, 120); blotches(c, s, 60, ['0,0,0', '255,255,255'], 2, 20, 0.25);
  }), 10, 10, false);
  TEX.metal = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#3b4147'; c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 2) { c.fillStyle = `rgba(${rand(20, 90) | 0},${rand(20, 90) | 0},${rand(22, 92) | 0},.3)`; c.fillRect(x, 0, 1, s); }
    blotches(c, s, 30, ['10,12,14', '120,110,90', '60,70,75'], 4, 38, 0.15);
    grain(c, s, 24);
  }), 2);
  TEX.container = tex(makeCanvas(512, (c, s) => {
    c.fillStyle = '#5d5142'; c.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 26) {
      const g = c.createLinearGradient(x, 0, x + 26, 0);
      g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.42, 'rgba(255,255,255,.09)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
      c.fillStyle = g; c.fillRect(x, 0, 26, s);
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      c.fillStyle = `rgba(${rand(60, 95) | 0},${rand(40, 58) | 0},${rand(24, 38) | 0},${rand(0.08, 0.3)})`;
      c.fillRect(x, y, rand(2, 7), rand(20, 130));
    }
    grain(c, s, 22);
  }), 2);
  TEX.containerBump = tex(makeCanvas(256, (c, s) => {
    for (let x = 0; x < s; x += 13) {
      const g = c.createLinearGradient(x, 0, x + 13, 0);
      g.addColorStop(0, '#404040'); g.addColorStop(0.45, '#b0b0b0'); g.addColorStop(1, '#303030');
      c.fillStyle = g; c.fillRect(x, 0, 13, s);
    }
    grain(c, s, 30);
  }), 2, 2, false);
  TEX.wood = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#4f4332'; c.fillRect(0, 0, s, s);
    for (let p = 0; p < 4; p++) {
      const y = p * 64;
      c.fillStyle = p % 2 ? '#574a36' : '#4a3e2c'; c.fillRect(0, y, s, 62);
      for (let i = 0; i < 24; i++) {
        c.strokeStyle = `rgba(${rand(25, 60) | 0},${rand(18, 44) | 0},${rand(10, 30) | 0},${rand(0.1, 0.4)})`;
        c.lineWidth = rand(0.5, 2); c.beginPath();
        const yy = y + rand(2, 60); c.moveTo(0, yy);
        for (let x = 0; x <= s; x += 32) c.lineTo(x, yy + Math.sin(x * 0.03 + i) * 2.5);
        c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, y + 62, s, 2);
    }
    grain(c, s, 20);
  }), 1);
  TEX.sandbag = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#5e5943'; c.fillRect(0, 0, s, s);
    blotches(c, s, 40, ['30,30,22', '120,112,82'], 5, 36, 0.2);
    grain(c, s, 55);
    c.strokeStyle = 'rgba(30,30,22,.35)'; c.lineWidth = 2;
    for (let y = 0; y < s; y += 42) { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke(); }
  }), 2);
  TEX.hazard = tex(makeCanvas(256, (c, s) => {
    c.fillStyle = '#151515'; c.fillRect(0, 0, s, s);
    c.save(); c.translate(s / 2, s / 2); c.rotate(-Math.PI / 4); c.translate(-s, -s);
    c.fillStyle = '#c79a34';
    for (let x = 0; x < s * 2; x += 56) c.fillRect(x, 0, 28, s * 2);
    c.restore();
    grain(c, s, 40);
  }), 2);
  TEX.chainlink = (() => {
    const c = makeCanvas(128, (x, s) => {
      x.clearRect(0, 0, s, s); x.strokeStyle = 'rgba(185,195,200,.9)'; x.lineWidth = 1.2;
      for (let i = -s; i < s * 2; i += 16) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke();
        x.beginPath(); x.moveTo(i + s, 0); x.lineTo(i, s); x.stroke();
      }
    });
    const t = tex(c, 6, 6); t.premultiplyAlpha = true; return t;
  })();
  TEX.glow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,225,180,.8)'); g.addColorStop(0.5, 'rgba(255,150,60,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  TEX.moon = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#e2e9f3'; x.beginPath(); x.arc(128, 128, 125, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 14; i++) {
      const mx = rand(40, 216), my = rand(40, 216), r = rand(14, 46);
      const g = x.createRadialGradient(mx, my, 0, mx, my, r);
      g.addColorStop(0, 'rgba(108,120,138,.34)'); g.addColorStop(1, 'rgba(108,120,138,0)');
      x.fillStyle = g; x.beginPath(); x.arc(mx, my, r, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 46; i++) {
      const mx = rand(28, 228), my = rand(28, 228), r = rand(1.5, 7);
      x.strokeStyle = `rgba(120,132,150,${rand(0.18, 0.4)})`; x.lineWidth = rand(0.8, 1.8);
      x.beginPath(); x.arc(mx, my, r, 0, Math.PI * 2); x.stroke();
      x.fillStyle = `rgba(180,192,208,${rand(0.1, 0.22)})`;
      x.beginPath(); x.arc(mx, my, r * 0.65, 0, Math.PI * 2); x.fill();
    }
    const rim = x.createRadialGradient(112, 110, 74, 128, 128, 126);
    rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(0.82, 'rgba(30,40,58,.12)'); rim.addColorStop(1, 'rgba(24,32,48,.5)');
    x.fillStyle = rim; x.beginPath(); x.arc(128, 128, 125, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  TEX.smoke = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    for (let i = 0; i < 20; i++) {
      const g = x.createRadialGradient(rand(30, 98), rand(30, 98), 0, 64, 64, rand(20, 60));
      g.addColorStop(0, 'rgba(160,170,180,.12)'); g.addColorStop(1, 'rgba(120,130,140,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  TEX.rainStreak = (() => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 64;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(200,220,240,0)'); g.addColorStop(0.5, 'rgba(200,220,240,.7)'); g.addColorStop(1, 'rgba(200,220,240,0)');
    x.fillStyle = g; x.fillRect(6, 0, 3, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
}

// ---------------------------------------------------------------- sky
function createSky() {
  const geo = new THREE.SphereGeometry(240, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x03060b) },
      mid: { value: new THREE.Color(0x0a1524) },
      bottom: { value: new THREE.Color(0x1b2430) },
      glow: { value: new THREE.Color(0xb06633) },
      flash: { value: 0 },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 top, mid, bottom, glow; uniform float flash;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y*0.5+0.5, 0.0, 1.0);
        vec3 col = mix(bottom, mid, smoothstep(0.42,0.66,h));
        col = mix(col, top, smoothstep(0.6,1.0,h));
        float horizon = pow(1.0 - clamp(abs(d.y)*2.2,0.0,1.0), 5.0);
        col += glow * horizon * 0.18;
        float cl = 0.0;
        vec2 uv = d.xz / max(d.y+0.28, 0.12);
        for(int i=0;i<4;i++){
          float f = float(i);
          vec2 q = uv*(1.4+f*0.5) + vec2(f*3.1, f*1.7);
          cl += smoothstep(0.55,0.95, sin(q.x*2.2+sin(q.y*3.1))*0.5+0.5) * 0.05;
        }
        col += vec3(0.22,0.28,0.38) * cl * smoothstep(0.42,0.8,h);
        col += vec3(0.55,0.65,0.8) * flash * 0.5;
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function createStars() {
  const n = 900, pos = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().setFromSphericalCoords(200, rand(0.05, 0.85), rand(0, Math.PI * 2));
    pos.set([v.x, Math.abs(v.y) + 12, v.z], i * 3);
    size[i] = rand(0.7, 2.4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.PointsMaterial({ color: 0xaebfd6, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
  return new THREE.Points(g, m);
}

function makeEnvMap(renderer) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04070d'); g.addColorStop(0.42, '#101b2b'); g.addColorStop(0.53, '#2a2b2c'); g.addColorStop(0.7, '#0b0e12'); g.addColorStop(1, '#05070a');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  // horizon light pools
  for (let i = 0; i < 14; i++) {
    const px = Math.random() * 1024, py = rand(225, 275), r = rand(30, 140);
    const rg = x.createRadialGradient(px, py, 0, px, py, r);
    const warm = Math.random() > 0.45;
    rg.addColorStop(0, warm ? 'rgba(255,150,70,.85)' : 'rgba(90,150,255,.65)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  for (let i = 0; i < 120; i++) {
    x.fillStyle = `rgba(180,200,230,${rand(0.1, 0.5)})`;
    x.fillRect(Math.random() * 1024, Math.random() * 190, 1.2, 1.2);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(t).texture;
  pm.dispose(); t.dispose();
  return env;
}

// ---------------------------------------------------------------- world
export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.colliders = [];
    this.hitMeshes = []; // not used for bullets, but for visual-only references
    this.solids = []; // {mesh, x1,z1,x2,z2,h}
    this.spawnPoints = [];
    this.flash = 0;
    this.time = 0;
    this.lightningTimer = rand(8, 18);
    this.searchlights = [];
    this.flickerLights = [];
    this.beacons = [];
    this.rainData = null;
    this.smokePuffs = [];
    this.wetStreaks = [];
    this.textures = TEX;
    buildTextures();
    this.scene.environment = makeEnvMap(renderer);
    this.scene.environmentIntensity = 0.85;
    this.scene.fog = new THREE.FogExp2(0x080d15, 0.0145);
    this.build();
    this.buildRain();
    this.buildMist();
  }

  addCollider(x, z, w, d, h, mesh = null, rot = 0) {
    const cw = Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d;
    const cd = Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d;
    const c = { x1: x - cw / 2, z1: z - cd / 2, x2: x + cw / 2, z2: z + cd / 2, h, mesh };
    this.colliders.push(c); return c;
  }

  box(w, h, d, x, y, z, mat, { rot = 0, collide = false, name = '', cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = rot;
    m.castShadow = cast; m.receiveShadow = receive; m.name = name;
    this.scene.add(m);
    if (collide) { const c = this.addCollider(x, z, w, d, y + h / 2, m, rot); c.mesh = m; this.solids.push(c); }
    return m;
  }

  build() {
    const S = this.scene;
    this.sky = createSky(); S.add(this.sky);
    S.add(createStars());

    // moon
    const moonTex = TEX.glow.clone();
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, color: 0xbcd2ff, transparent: true, opacity: 0.48, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    moon.position.set(-95, 110, -130); moon.scale.set(58, 58, 1); S.add(moon);
    const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(5.4, 48), new THREE.MeshBasicMaterial({ map: TEX.moon, color: 0xdfe8f5, fog: false }));
    moonDisc.position.copy(moon.position); moonDisc.lookAt(0, 2, 0); S.add(moonDisc);

    // lighting
    this.hemi = new THREE.HemisphereLight(0x38557f, 0x0c0f12, 1.15); S.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(0x9cb8e8, 1.25);
    this.moonLight.position.set(-26, 34, -18);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -34; this.moonLight.shadow.camera.right = 34;
    this.moonLight.shadow.camera.top = 34; this.moonLight.shadow.camera.bottom = -34;
    this.moonLight.shadow.camera.near = 1; this.moonLight.shadow.camera.far = 90;
    this.moonLight.shadow.bias = -0.0008; this.moonLight.shadow.normalBias = 0.02;
    S.add(this.moonLight); S.add(this.moonLight.target);
    this.moonLight.target.position.set(0, 0, 0);
    this.fillLight = new THREE.DirectionalLight(0xff9d5c, 0.35);
    this.fillLight.position.set(18, 12, 24); S.add(this.fillLight); S.add(this.fillLight.target);
    this.fillLight.target.position.set(0, 0, 0);
    // diffuse courtyard bounce lights
    const bounce = new THREE.PointLight(0xffa45c, 12, 22, 1.8); bounce.position.set(0, 6.0, 10); S.add(bounce);

    // materials
    const matAsphalt = new THREE.MeshStandardMaterial({ map: TEX.asphalt, bumpMap: TEX.asphaltBump, bumpScale: 0.06, color: 0xc4c8c9, roughness: 0.56, metalness: 0.24, envMapIntensity: 1.25 });
    const matConcrete = new THREE.MeshStandardMaterial({ map: TEX.concrete, bumpMap: TEX.concreteBump, bumpScale: 0.045, color: 0x898f92, roughness: 0.9, metalness: 0.06 });
    const matConcreteDark = new THREE.MeshStandardMaterial({ map: TEX.concrete, bumpMap: TEX.concreteBump, bumpScale: 0.04, color: 0x4c5256, roughness: 0.92, metalness: 0.05 });
    const matMetal = new THREE.MeshStandardMaterial({ map: TEX.metal, color: 0x8d979e, roughness: 0.42, metalness: 0.88, envMapIntensity: 1.1 });
    const matMetalDark = new THREE.MeshStandardMaterial({ map: TEX.metal, color: 0x43494e, roughness: 0.48, metalness: 0.8 });
    const matContainer = new THREE.MeshStandardMaterial({ map: TEX.container, bumpMap: TEX.containerBump, bumpScale: 0.09, color: 0x8a8c84, roughness: 0.72, metalness: 0.42 });
    const matContainer2 = matContainer.clone(); matContainer2.color.setHex(0x5f7770);
    const matContainer3 = matContainer.clone(); matContainer3.color.setHex(0x7b5f52);
    const matWood = new THREE.MeshStandardMaterial({ map: TEX.wood, color: 0x9a8f76, roughness: 0.85, metalness: 0.04 });
    const matSand = new THREE.MeshStandardMaterial({ map: TEX.sandbag, color: 0x9e9a7c, roughness: 0.95, metalness: 0.02 });
    const matHazard = new THREE.MeshStandardMaterial({ map: TEX.hazard, roughness: 0.66, metalness: 0.35, emissive: 0x1a1206, emissiveIntensity: 0.16 });
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x161b1f, roughness: 0.55, metalness: 0.6 });
    const matRust = new THREE.MeshStandardMaterial({ color: 0x5e3c27, roughness: 0.92, metalness: 0.24 });
    const matCyan = new THREE.MeshStandardMaterial({ color: 0x0c1a1d, emissive: 0x39e9d4, emissiveIntensity: 2.6, roughness: 0.3 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0x200706, emissive: 0xff2416, emissiveIntensity: 3.2, roughness: 0.3 });
    const matAmber = new THREE.MeshStandardMaterial({ color: 0x1f1508, emissive: 0xffa53c, emissiveIntensity: 2.8, roughness: 0.3 });
    this.matMats = { matConcrete, matMetal, matMetalDark, matBlack, matRed, matAmber };

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140, 1, 1), matAsphalt);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
    // perimeter apron
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(62, 62), new THREE.MeshStandardMaterial({ map: tex(TEX.asphalt.image, 6), color: 0x8e9294, roughness: 0.7, metalness: 0.16 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = 0.005; apron.receiveShadow = true; S.add(apron);

    // painted courtyard markings
    const paintMat = new THREE.MeshBasicMaterial({ color: 0xb7a05a, transparent: true, opacity: 0.24, depthWrite: false });
    for (let i = -2; i <= 2; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 16), paintMat);
      p.rotation.x = -Math.PI / 2; p.position.set(i * 4.5, 0.012, 6); S.add(p);
    }
    const pad = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.45, 64), new THREE.MeshBasicMaterial({ color: 0xd2b467, transparent: true, opacity: 0.32, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.011; S.add(pad);
    const hPad = new THREE.Mesh(new THREE.CircleGeometry(2.6, 6), new THREE.MeshBasicMaterial({ color: 0xd2b467, transparent: true, opacity: 0.18, depthWrite: false }));
    hPad.rotation.x = -Math.PI / 2; hPad.position.set(0, 0.01, -2); S.add(hPad);

    // wet puddles
    const puddleMat = new THREE.MeshPhysicalMaterial({ color: 0x060a0e, roughness: 0.05, metalness: 0.92, envMapIntensity: 2.2, transparent: true, opacity: 0.92, depthWrite: false });
    for (let i = 0; i < 26; i++) {
      const r = rand(0.7, 3.0);
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), puddleMat);
      p.rotation.x = -Math.PI / 2; p.scale.set(1, rand(0.35, 0.8), 1);
      p.position.set(rand(-24, 24), 0.014, rand(-22, 24)); p.rotation.z = rand(0, 6.28); S.add(p);
    }
    // wet light reflections (fake vertical smears on ground)
    const streakMat = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffa45c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(1.4, 3.6), rand(6, 13)), streakMat.clone());
      m.material.opacity = rand(0.05, 0.15);
      m.rotation.x = -Math.PI / 2; m.rotation.z = rand(-0.5, 0.5);
      m.position.set(rand(-22, 22), 0.018, rand(-20, 20)); S.add(m); this.wetStreaks.push(m);
    }

    this.buildPerimeter(matConcrete, matConcreteDark, matMetalDark);
    this.buildStructures(matContainer, matContainer2, matContainer3, matWood, matMetal, matMetalDark, matHazard, matSand, matBlack, matCyan, matRed, matAmber, matRust);
    this.buildLights(matMetalDark, matAmber, matRed, matCyan);
    this.buildUplink(matMetalDark, matCyan, matRed, matBlack);
    this.buildProps(matWood, matMetalDark, matRust, matSand, matHazard, matBlack);
    this.buildDistant();

    // dust motes
    const dn = 340, dp = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) dp.set([rand(-28, 28), rand(0.4, 9), rand(-28, 28)], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9aa7b4, size: 0.035, transparent: true, opacity: 0.34, depthWrite: false }));
    S.add(this.dust);

    // spawn points around the edges
    this.spawnPoints = [
      new THREE.Vector3(-24, 0, -22), new THREE.Vector3(24, 0, -21),
      new THREE.Vector3(-25, 0, 0), new THREE.Vector3(25, 0, 2),
      new THREE.Vector3(-23, 0, 22), new THREE.Vector3(23, 0, 22),
      new THREE.Vector3(-8, 0, -25), new THREE.Vector3(9, 0, -25),
    ];

    // ambient embers
    this.emberGeo = new THREE.BufferGeometry();
    const en = 130, ep = new Float32Array(en * 3);
    for (let i = 0; i < en; i++) ep.set([rand(-26, 26), rand(0, 8), rand(-26, 26)], i * 3);
    this.emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    this.embers = new THREE.Points(this.emberGeo, new THREE.PointsMaterial({ color: 0xff9248, size: 0.055, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending }));
    S.add(this.embers);
  }

  buildPerimeter(matConcrete, matConcreteDark, matMetalDark) {
    // outer walls
    const wallH = 6.2, wallT = 1.1;
    const sides = [
      { x: 0, z: -28.5, w: 58, d: wallT },
      { x: 0, z: 28.5, w: 58, d: wallT },
      { x: -28.5, z: 0, w: wallT, d: 58 },
      { x: 28.5, z: 0, w: wallT, d: 58 },
    ];
    sides.forEach((s, i) => {
      this.box(s.w, wallH, s.d, s.x, wallH / 2, s.z, matConcrete, { collide: true, name: 'perimeter' });
      // cap
      this.box(s.w + 0.2, 0.22, s.d + 0.2, s.x, wallH + 0.1, s.z, matConcreteDark, {});
    });
    // wall buttresses (instanced)
    const buttressGeo = new THREE.BoxGeometry(1, 1, 1);
    const buttress = new THREE.InstancedMesh(buttressGeo, matConcreteDark, 52);
    const dummy = new THREE.Object3D();
    let bi = 0;
    for (let i = -24; i <= 24; i += 8) {
      for (const [x, z, sx, sz] of [[i, -28.0, 0.62, 0.9], [i, 28.0, 0.62, 0.9], [-28.0, i, 0.9, 0.62], [28.0, i, 0.9, 0.62]]) {
        dummy.position.set(x, (wallH + 0.8) / 2, z);
        dummy.scale.set(sx, wallH + 0.8, sz);
        dummy.updateMatrix(); buttress.setMatrixAt(bi++, dummy.matrix);
        this.addCollider(x, z, sx, sz, wallH + 0.8);
      }
    }
    buttress.instanceMatrix.needsUpdate = true;
    buttress.castShadow = true; buttress.receiveShadow = true;
    this.scene.add(buttress);
    // razor wire coil along tops
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x2c3236, metalness: 0.8, roughness: 0.4 });
    const coilGeo = new THREE.TorusGeometry(0.32, 0.025, 4, 10);
    const coilCount = 4 * Math.ceil(52 / 1.8);
    const coils = new THREE.InstancedMesh(coilGeo, wireMat, coilCount);
    const coilDummy = new THREE.Object3D();
    let ci = 0;
    for (let side = 0; side < 4; side++) {
      const isX = side < 2;
      const sign = side % 2 ? 1 : -1;
      const zOrX = sign * 28.3;
      for (let i = -26; i < 26; i += 1.8) {
        coilDummy.rotation.set(0, 0, 0);
        if (isX) { coilDummy.position.set(i, 6.6, zOrX); coilDummy.rotation.y = Math.PI / 2; }
        else { coilDummy.position.set(zOrX, 6.6, i); coilDummy.rotation.x = Math.PI / 2; }
        coilDummy.updateMatrix(); coils.setMatrixAt(ci++, coilDummy.matrix);
      }
    }
    coils.instanceMatrix.needsUpdate = true;
    this.scene.add(coils);
    // gates
    const gateMat = new THREE.MeshStandardMaterial({ map: TEX.hazard, color: 0x6b6352, roughness: 0.7, metalness: 0.6 });
    for (const [x, z, rot] of [[0, -27.8, 0], [0, 27.8, 0], [-27.8, 10, Math.PI / 2], [27.8, -10, Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
      for (let i = 0; i < 8; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 5.4, 0.09), matMetalDark);
        bar.position.set(0, 2.7, i * 0.62 - 2.2); g.add(bar);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 5.4), matMetalDark); top.position.y = 5.2; g.add(top);
      this.scene.add(g);
    }
    // wall lamps (dim)
    for (const x of [-18, 0, 18]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0x201408, emissive: 0xff8a2a, emissiveIntensity: 1.4 }));
      lamp.position.set(x, 4.2, -27.9); this.scene.add(lamp);
    }
  }

  container(x, z, rot, mat, matTrim) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const W = 2.55, H = 2.65, L = 6.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), mat);
    body.position.y = H / 2 + 0.06; body.castShadow = true; body.receiveShadow = true; g.add(body);
    // top/bottom rails
    for (const yy of [0.06, H + 0.06]) {
      for (const sx of [-W / 2 + 0.06, W / 2 - 0.06]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, L + 0.04), matTrim); rail.position.set(sx, yy, 0); g.add(rail);
      }
    }
    // door end detail
    for (const zz of [-L / 2 - 0.01, L / 2 + 0.01]) {
      for (let i = -1; i <= 1; i++) {
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.3), matTrim); lock.position.set(i * 0.75, 1.4, zz); g.add(lock);
      }
    }
    // number stencil
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 128, 64);
    ctx.font = 'bold 34px monospace'; ctx.fillStyle = '#c9b58a'; ctx.globalAlpha = 0.5;
    ctx.fillText('K-17', 22, 41);
    const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.SRGBColorSpace;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false }));
    decal.position.set(0, 1.7, L / 2 + 0.02); g.add(decal);
    this.scene.add(g);
    const solid = this.addCollider(x, z, W, L, H + 0.1, body, rot); this.solids.push(solid);
    return g;
  }

  buildStructures(matContainer, matContainer2, matContainer3, matWood, matMetal, matMetalDark, matHazard, matSand, matBlack, matCyan, matRed, matAmber, matRust) {
    // shipping containers
    this.container(-13.5, -6.5, 0, matContainer, matMetalDark);
    this.container(-16.5, 1.2, 0, matContainer2, matMetalDark);
    this.container(13.8, -9.5, 0, matContainer3, matMetalDark);
    this.container(17.4, 5.0, Math.PI / 2, matContainer, matMetalDark);
    this.container(11.5, 17.2, Math.PI / 2, matContainer2, matMetalDark);
    this.container(-9.5, 20.5, 0, matContainer3, matMetalDark);
    // stacked short container
    this.container(-24, -15, Math.PI / 2, matContainer2, matMetalDark);
    const stack = this.container(-24, -15, Math.PI / 2, matContainer3, matMetalDark);
    stack.position.y = 2.72;

    // central uplink plaza blast wall (partial)
    this.box(9, 1.1, 0.7, 0, 0.55, 4.6, matHazard, { collide: true, name: 'blastwall' });
    this.box(1.1, 2.2, 0.9, -4.1, 1.1, 4.6, matMetalDark, { collide: true });
    this.box(1.1, 2.2, 0.9, 4.1, 1.1, 4.6, matMetalDark, { collide: true });

    // jersey barriers
    const barrierMat = new THREE.MeshStandardMaterial({ map: TEX.concrete, color: 0x7b7f80, roughness: 0.9 });
    const barrier = (x, z, rot = 0, strip = true) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 0.55), barrierMat); b.position.y = 0.48; b.castShadow = true; b.receiveShadow = true; g.add(b);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.33), barrierMat); top.position.y = 1.06; g.add(top);
      if (strip) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.25, 0.56), matHazard); s.position.y = 0.45; g.add(s);
      }
      this.scene.add(g); const c = this.addCollider(x, z, 3.2, 0.55, 1.2, b, rot); this.solids.push(c);
      return g;
    };
    barrier(-6, 11, 0.1); barrier(6.5, 12.5, -0.15); barrier(-2, 17, Math.PI / 2); barrier(18, -3, 0.3);
    barrier(-20, 10, Math.PI / 2); barrier(20, 13, Math.PI / 2); barrier(-5, -18, 0.2); barrier(7, -19, -0.4);
    barrier(0, 24, 0); barrier(-16, -20, 0.2);

    // sandbag positions
    const bagGeo = new THREE.BoxGeometry(1.15, 0.42, 0.58);
    const bagInst = new THREE.InstancedMesh(bagGeo, matSand, 45);
    const bagDummy = new THREE.Object3D();
    let bgi = 0;
    for (const [cx, cz, rot] of [[-2.8, 8.7, 0], [9.8, 6.5, 0.3], [-11, 16, Math.PI / 2], [22, 2, Math.PI / 2], [-23, -8, 0]]) {
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) {
        const ox = (row % 2) * 0.5;
        bagDummy.position.set(cx + (i - 1) * 1.2 * Math.cos(rot) + ox * Math.sin(rot), 0.22 + row * 0.4, cz + (i - 1) * 1.2 * Math.sin(rot) + ox * Math.cos(rot));
        bagDummy.rotation.set(0, rot + rand(-0.05, 0.05), 0);
        bagDummy.updateMatrix(); bagInst.setMatrixAt(bgi++, bagDummy.matrix);
      }
      this.addCollider(cx, cz, 3.8, 1.7, 1.25);
    }
    bagInst.instanceMatrix.needsUpdate = true;
    bagInst.castShadow = true; bagInst.receiveShadow = true;
    this.scene.add(bagInst);

    // crates
    const crate = (x, z, size, y, rot = 0) => {
      const c = this.box(size, size, size, x, y + size / 2, z, matWood, { rot, collide: true, name: 'crate' });
      // edge framing
      const e = new THREE.MeshStandardMaterial({ color: 0x2a2a27, roughness: 0.8, metalness: 0.5 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, size, 0.06), e);
        bar.position.set(c.position.x + sx * size / 2, c.position.y, c.position.z + sz * size / 2); bar.rotation.y = rot; this.scene.add(bar);
      }
      return c;
    };
    crate(-20, 17, 1.2, 0); crate(-18.7, 17.2, 1.0, 0); crate(-19.4, 17.1, 0.9, 1.2);
    crate(21, 19, 1.4, 0); crate(19.5, 19.2, 1.1, 0, 0.3); crate(22.4, 18.4, 0.9, 0);
    crate(4.5, -12.5, 1.3, 0); crate(5.7, -12.2, 1.05, 0); crate(4.8, -12.3, 0.95, 1.3, 0.2);
    crate(-6.5, 22.5, 1.1, 0, 0.5); crate(-7.7, 22.2, 0.85, 0, 0.3);
    crate(24.5, -5.5, 1.2, 0);

    // watchtower
    this.buildTower(-22, -21, matMetalDark, matMetal, matRed);

    // chain link fence sections
    const fenceMat = new THREE.MeshStandardMaterial({ map: TEX.chainlink, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0x8f9ba2, metalness: 0.7, roughness: 0.4, depthWrite: true });
    const fence = (x, z, w, rot) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.8), fenceMat);
      f.position.set(x, 1.55, z); f.rotation.y = rot; this.scene.add(f);
      const postMat = matMetalDark;
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), postMat);
        p.position.set(x + Math.cos(rot) * s * w / 2, 1.5, z - Math.sin(rot) * s * w / 2); this.scene.add(p);
      }
      this.addCollider(x, z, Math.abs(Math.cos(rot)) * w + 0.2, Math.abs(Math.sin(rot)) * w + 0.2, 3.0);
    };
    fence(-10, -23.5, 8, 0); fence(12, -23.5, 7, 0); fence(23.5, -13, 6, Math.PI / 2);

    // vehicle wreck (armored truck) for cover
    this.buildTruck(7.5, 21, -0.25, matMetalDark, matMetal, matBlack, matRed, matHazard);

    // pipes along walls
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x4a5054, roughness: 0.4, metalness: 0.85 });
    for (const [x, z, len, rot] of [[-27.4, 16, 16, Math.PI / 2], [27.4, 14, 18, Math.PI / 2], [-10, -27.4, 18, 0], [16, 27.4, 12, 0]]) {
      for (const y of [1.4, 1.9]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 8), pipeMat);
        p.rotation.z = Math.PI / 2; p.rotation.y = rot; p.position.set(x, y, z); this.scene.add(p);
      }
    }
    // vertical pipes + valve wheels
    for (const [x, z] of [[-27, 20], [27, 8], [-12, -26.5], [18, -26.6], [-26.8, -5]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), pipeMat);
      p.position.set(x, 2.75, z); this.scene.add(p);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 16), matRed);
      wheel.position.set(x + 0.16, 2.4, z); wheel.rotation.y = Math.PI / 2; this.scene.add(wheel);
    }

    // warning signs
    const signMat = new THREE.MeshBasicMaterial({ color: 0xd9a13c, transparent: true, opacity: 0.8 });
    for (const [x, y, z, rot] of [[-18, 2.4, -27.85, 0], [27.8, 2.6, 2, -Math.PI / 2], [10, 2.4, 27.8, Math.PI]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), signMat);
      s.position.set(x, y, z); s.rotation.y = rot; this.scene.add(s);
    }
  }

  buildTower(x, z, matDark, matMetal, matRed) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const legPos = [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]];
    for (const [lx, lz] of legPos) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 7.2, 0.17), matDark);
      leg.position.set(lx, 3.6, lz); leg.castShadow = true; g.add(leg);
    }
    for (let lvl = 1.4; lvl < 7; lvl += 1.8) {
      const r = 1.72;
      const a = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.09, 0.09), matDark); a.position.set(0, lvl, -r); g.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.09, 0.09), matDark); b.position.set(0, lvl, r); g.add(b);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, r * 2), matDark); c.position.set(-r, lvl, 0); g.add(c);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, r * 2), matDark); d.position.set(r, lvl, 0); g.add(d);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 5.2), matDark); deck.position.y = 7.2; deck.castShadow = true; g.add(deck);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.14, 5.6), matMetal); roof.position.y = 10.1; g.add(roof);
    for (const [rx, rz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.9, 0.11), matDark); post.position.set(rx, 8.75, rz); g.add(post);
    }
    // railings
    for (const [w, d, px, pz] of [[5.2, 0.07, 0, -2.55], [5.2, 0.07, 0, 2.55], [0.07, 5.2, -2.55, 0], [0.07, 5.2, 2.55, 0]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), matMetal); rail.position.set(px, 8.2, pz); g.add(rail);
    }
    // ladder
    for (let i = 0; i < 16; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.045), matMetal);
      rung.position.set(-2.65, 0.5 + i * 0.44, 0); g.add(rung);
    }
    for (const zz of [-0.35, 0.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 7, 0.05), matMetal); rail.position.set(-2.65, 3.8, zz); g.add(rail);
    }
    // beacon
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), matRed); beacon.position.set(2.3, 10.5, 2.3); g.add(beacon);
    const bl = new THREE.PointLight(0xff2a1a, 3.5, 8, 2); bl.position.set(2.3, 10.5, 2.3); g.add(bl);
    // searchlight housing
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.7, 12), matDark);
    housing.rotation.z = Math.PI / 2; housing.position.set(1.4, 8.1, 1.4); g.add(housing);
    this.scene.add(g);
    this.addCollider(x, z, 4.2, 4.2, 7.2);
    this.beacons.push(beacon);
  }

  buildTruck(x, z, rot, matDark, matMetal, matBlack, matRed, matHazard) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 5.4), matDark); body.position.y = 1.55; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.7, 1.7), matDark); cab.position.set(0, 2.0, 2.6); cab.castShadow = true; g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.08, metalness: 0.9 }));
    glass.position.set(0, 2.2, 3.46); g.add(glass);
    for (const [wx, wz] of [[-1.25, 1.9], [1.25, 1.9], [-1.25, -1.7], [1.25, -1.7], [-1.25, -3.0], [1.25, -3.0]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.34, 16), matBlack);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.58, wz); g.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8), matMetal); hub.rotation.z = Math.PI / 2; hub.position.set(wx, 0.58, wz); g.add(hub);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.35), matMetal); bumper.position.set(0, 0.65, 3.55); g.add(bumper);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), matHazard); light.position.set(-0.8, 1.2, 3.53); g.add(light);
    const light2 = light.clone(); light2.position.x = 0.8; g.add(light2);
    this.scene.add(g);
    this.addCollider(x, z, 5.6, 2.7, 2.8, g, rot);
  }

  buildLights(matDark, matAmber, matRed, matCyan) {
    // floodlight poles
    const pads = [[18, 15, 1], [-17, 16, -1], [19, -17, -1], [-19, -14, 1]];
    this.floodlights = [];
    pads.forEach(([x, z, face], idx) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 8.2, 8), matDark); pole.position.y = 4.1; pole.castShadow = true; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), matDark); arm.position.set(face * 0.7, 8.0, 0); g.add(arm);
      const head = new THREE.Group(); head.position.set(face * 1.35, 7.9, 0); head.rotation.z = face * 0.15;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.45), matDark); head.add(body);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.63, 0.3), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
      lens.rotation.x = Math.PI / 2; lens.position.y = -0.18; head.add(lens);
      g.add(head);
      this.scene.add(g);
      let spot = null;
      if (idx < 2) {
        spot = new THREE.SpotLight(0xffa45c, 200, 38, 0.76, 0.65, 1.3);
        spot.position.set(x + face * 1.35, 7.8, z); spot.target.position.set(x * 0.2, 0, z * 0.2);
        this.scene.add(spot); this.scene.add(spot.target);
        this.floodlights.push(spot);
      }
      // glow sprite
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffb066, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x + face * 1.35, 7.8, z); glow.scale.set(2.4, 2.4, 1); this.scene.add(glow);
      // ground reflection streak
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 12), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff9a4a, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
      streak.rotation.x = -Math.PI / 2; streak.position.set(x - face * 2.2, 0.02, z + 1); this.scene.add(streak);
      if (spot) this.flickerLights.push({ light: spot, base: 200, seed: rand(0, 10), flicker: idx === 1 });
    });

    // red pulse beacons on containers/walls
    const beaconPositions = [[-13.5, 3.2, -9.4], [13.8, 3.2, -12.5], [-24, 6.0, -8], [24, 6.0, 8], [8, 2.6, -13.5]];
    beaconPositions.forEach(([x, y, z]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matRed);
      b.position.set(x, y, z); this.scene.add(b);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff2a18, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, y, z); glow.scale.set(0.7, 0.7, 1); this.scene.add(glow);
      this.beacons.push(b);
    });

    // cyan ground lights near uplink / walkway
    for (const [x, z] of [[-7, 7], [7, 7], [-7, -11], [7, -11], [-2, 1], [2, 1]]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.12), matCyan);
      strip.position.set(x, 0.03, z); this.scene.add(strip);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x31e3cf, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, 0.12, z); glow.scale.set(0.8, 0.8, 1); this.scene.add(glow);
    }
    // amber lamp over gate
    const gateLamp = new THREE.PointLight(0xffad55, 9, 14, 2);
    gateLamp.position.set(0, 5.5, -26.5); this.scene.add(gateLamp);
    this.flickerLights.push({ light: gateLamp, base: 9, seed: 3, flicker: true });
    const gateLampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), matAmber);
    gateLampMesh.position.set(0, 5.5, -27.2); this.scene.add(gateLampMesh);

    // generator with blue glow near right wall
    const gen = new THREE.Group(); gen.position.set(24.2, 0, 10.5); gen.rotation.y = -Math.PI / 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.2), matDark); box.position.y = 0.7; box.castShadow = true; gen.add(box);
    for (let i = 0; i < 6; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.08), new THREE.MeshStandardMaterial({ color: 0x22282c, metalness: 0.8, roughness: 0.4 }));
      vent.position.set(-1.0 + i * 0.38, 0.7, 0.63); gen.add(vent);
    }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), matCyan); screen.position.set(0.85, 1.0, 0.612); gen.add(screen);
    this.scene.add(gen);
    this.addCollider(24.2, 10.5, 1.3, 2.7, 1.5);
    const genGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x38d7e8, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    genGlow.position.set(23.5, 1.1, 10.5); genGlow.scale.set(1.2, 1.2, 1); this.scene.add(genGlow);

    // searchlight beams from towers (animated)
    for (const [x, z, phase] of [[-22, -21, 0], [22, 21, 2.2]]) {
      const spot = new THREE.SpotLight(0xa8c6ff, 20, 55, 0.13, 0.5, 1.0);
      spot.position.set(x, 9, z); this.scene.add(spot); this.scene.add(spot.target);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 10, 42, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fbfef, transparent: true, opacity: 0.012, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      cone.geometry.translate(0, -21, 0);
      const pivot = new THREE.Group(); pivot.position.set(x, 9, z); pivot.add(cone); this.scene.add(pivot);
      this.searchlights.push({ spot, cone, pivot, phase, x, z });
    }

    // green/red aviation lights
    for (const [x, y, z, color] of [[-26, 7.4, -26, 0x22ff88], [26, 7.4, 26, 0xff3322], [-26, 7.4, 26, 0xff3322], [26, 7.4, -26, 0x22ff88]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z); this.scene.add(m);
      this.beacons.push(m);
    }
  }

  buildUplink(matDark, matCyan, matRed, matBlack) {
    const g = new THREE.Group(); g.position.set(0, 0, -2); this.scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.25, 0.3, 24), this.matMats.matConcrete);
    base.position.y = 0.15; base.receiveShadow = true; g.add(base);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 1.0), matDark);
    cabinet.position.set(0, 0.85, 0.3); cabinet.castShadow = true; g.add(cabinet);
    for (let i = 0; i < 3; i++) {
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), i === 1 ? matRed : matCyan);
      led.position.set(-0.5 + i * 0.5, 1.08, 0.805); g.add(led);
    }
    // screens
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x39e9d4, transparent: true, opacity: 0.9 });
    for (const [x, y, z, ry] of [[-0.55, 1.25, 0.75, 0], [0.55, 1.25, 0.75, 0], [0.9, 0.95, 0.8, 0.3]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), screenMat);
      s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
    }
    // mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7.2, 8), matDark);
    mast.position.set(-0.85, 3.7, -0.35); g.add(mast);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5 - i * 0.08, 0.02, 4, 12), matDark);
      ring.rotation.x = Math.PI / 2; ring.position.set(-0.85, 3.2 + i * 0.8, -0.35); g.add(ring);
    }
    // dish
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x707a7e, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    dish.rotation.z = 0.8; dish.rotation.y = -0.5; dish.position.set(1.1, 3.5, -0.4); g.add(dish);
    const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), matDark);
    dishArm.rotation.z = 0.8; dishArm.position.set(1.35, 3.6, -0.2); g.add(dishArm);
    // antenna tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), matRed);
    tip.position.set(-0.85, 7.4, -0.35); g.add(tip);
    this.beacons.push(tip);
    // uplink glow
    const uplight = new THREE.PointLight(0x2fd9c6, 6, 9, 2); uplight.position.set(0, 1.8, 1.2); g.add(uplight);
    this.uplinkLight = uplight;
    // cables to tower
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0c0e10 });
    const cablePts = [new THREE.Vector3(-0.85, 7.2, -2.35), new THREE.Vector3(-6, 5.6, -6), new THREE.Vector3(-12, 7.0, -10), new THREE.Vector3(-19, 8.6, -16)];
    const curve = new THREE.CatmullRomCurve3(cablePts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.022, 4, false), cableMat); this.scene.add(cable);
    this.addCollider(0, -1.7, 2.3, 2.6, 1.5);
    this.addCollider(-0.85, -2.35, 0.3, 0.3, 7.2);
  }

  buildProps(matWood, matDark, matRust, matSand, matHazard, matBlack) {
    // barrels
    const barrelMats = [
      new THREE.MeshStandardMaterial({ color: 0x6b3b26, roughness: 0.8, metalness: 0.45 }),
      new THREE.MeshStandardMaterial({ color: 0x3c4b3c, roughness: 0.72, metalness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x5a5f61, roughness: 0.6, metalness: 0.6 }),
    ];
    const barrel = (x, z, mat = barrelMats[0], burning = false) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 14), mat); b.position.y = 0.45; b.castShadow = true; g.add(b);
      for (const y of [0.22, 0.68]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 4, 14), matDark);
        ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 14), matDark); cap.position.y = 0.91; g.add(cap);
      if (burning) {
        const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff7a24, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        fire.position.y = 1.15; fire.scale.set(1.3, 1.7, 1); g.add(fire);
        const light = new THREE.PointLight(0xff7a2a, 10, 8, 2); light.position.y = 1.3; g.add(light);
        this.flickerLights.push({ light, base: 10, seed: rand(0, 10), flicker: true });
        // smoke sprites
        for (let i = 0; i < 4; i++) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, opacity: 0.22, depthWrite: false, color: 0x6b7580 }));
          sp.position.set(x, 1.6 + i * 1.4, z); sp.scale.setScalar(2.4 + i * 1.3);
          this.scene.add(sp); this.smokePuffs.push({ sprite: sp, baseY: 1.6 + i * 1.4, phase: rand(0, 6), speed: 0.35 + i * 0.1, baseScale: 2.4 + i * 1.3 });
        }
      }
      this.scene.add(g);
      this.addCollider(x, z, 0.72, 0.72, 1.0);
    };
    barrel(-7.6, 13.5); barrel(-7.0, 14.2, barrelMats[1]); barrel(-7.9, 14.7, barrelMats[2]);
    barrel(19.2, -15.3, barrelMats[1]); barrel(19.9, -15.9, barrelMats[0]);
    barrel(-24.4, 7.5, barrelMats[0], true); barrel(-23.6, 8.2);
    barrel(22.8, 20.6, barrelMats[2]); barrel(9.0, 13.4, barrelMats[1]);
    // pallet stacks
    for (const [x, z, rot] of [[-21.5, 21.5, 0.2], [15.5, 23, -0.3], [-15.5, 12.5, 0]]) {
      for (let i = 0; i < 3; i++) {
        const p = this.box(1.5, 0.09, 1.1, x, 0.12 + i * 0.15, z, matWood, { rot, collide: false });
        p.receiveShadow = true;
      }
      this.addCollider(x, z, 1.5, 1.1, 0.5);
    }
    // cones
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x8a3c18, roughness: 0.8 });
    const cone = (x, z) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8), coneMat); c.position.set(x, 0.28, z); this.scene.add(c);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xcfd3d1, emissive: 0x333333 })); band.position.set(x, 0.32, z); this.scene.add(band);
    };
    cone(2, 10); cone(-1.4, 12.5); cone(12, -4); cone(-15, 5);
    // generator cables on ground
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0a0c0d });
    const pts = [new THREE.Vector3(24, 0.04, 10.5), new THREE.Vector3(18, 0.04, 8), new THREE.Vector3(12, 0.04, 6), new THREE.Vector3(8, 0.04, 3)];
    const cg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.04, 4, false), cableMat); this.scene.add(cg);
    // ammo / supply crates
    for (const [x, z, rot] of [[-1.5, 15.5, 0.1], [16.5, 8.2, -0.2]]) {
      const ammo = this.box(0.9, 0.45, 0.55, x, 0.225, z, new THREE.MeshStandardMaterial({ color: 0x34452e, roughness: 0.7, metalness: 0.3 }), { rot, collide: true });
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.08), new THREE.MeshBasicMaterial({ color: 0xc6a248 }));
      stripe.position.set(x, 0.35, z + 0.29); stripe.rotation.y = rot; this.scene.add(stripe);
      ammo.castShadow = true;
    }
  }

  buildDistant() {
    // Silhouetted industrial skyline beyond the walls.
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b1017, roughness: 1, metalness: 0 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
      const r = rand(48, 85);
      const w = rand(6, 18), h = rand(4, 28), d = rand(4, 12);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      m.rotation.y = rand(0, 3);
      this.scene.add(m);
      // sparse window lights
      if (Math.random() > 0.45) {
        for (let k = 0; k < 3; k++) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xe0a45b : 0x6fa6d8 }));
          p.position.set(0, rand(-h / 2 + 2, h / 2 - 2), d / 2 + 0.01); m.add(p);
        }
      }
    }
    // cranes
    for (const [x, z] of [[55, -40], [-60, -55], [70, 30]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.4, 36, 1.4), mat); mast.position.y = 18; g.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 1), mat); arm.position.set(8, 34, 0); g.add(arm);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2.5), mat); cab.position.set(-1, 33, 0); g.add(cab);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3524 })); red.position.set(0, 36.3, 0); g.add(red);
      this.scene.add(g);
    }
    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x070b10, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), r = rand(110, 165);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(rand(30, 70), rand(15, 40), 5), hillMat);
      hill.position.set(Math.cos(a) * r, -5, Math.sin(a) * r); this.scene.add(hill);
    }
  }

  buildRain() {
    const n = 1500;
    const pos = new Float32Array(n * 6);
    const data = [];
    for (let i = 0; i < n; i++) {
      const x = rand(-35, 35), y = rand(0, 26), z = rand(-35, 35);
      const len = rand(0.35, 1.1);
      data.push({ x, y, z, len, speed: rand(20, 34) });
      pos.set([x, y, z, x + 0.08, y - len, z + 0.02], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color: 0x9bb1c8, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    this.rain = new THREE.LineSegments(g, m);
    this.rain.frustumCulled = false;
    this.rainData = data;
    this.rainPos = pos;
    this.scene.add(this.rain);
    // splashes: tiny bright rings on the ground near player
    const sn = 90, sp = new Float32Array(sn * 3);
    this.splashData = [];
    for (let i = 0; i < sn; i++) {
      this.splashData.push({ x: rand(-15, 15), y: 0.03, z: rand(-15, 15), life: Math.random(), speed: rand(1.5, 3.5) });
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.splashes = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbcd2e8, size: 0.055, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.splashes.frustumCulled = false;
    this.splashPos = sp;
    this.scene.add(this.splashes);
  }

  buildMist() {
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, opacity: rand(0.05, 0.11), depthWrite: false, color: 0x9aacba }));
      sp.position.set(rand(-26, 26), rand(0.3, 1.6), rand(-26, 26));
      const s = rand(8, 18); sp.scale.set(s, s * 0.35, 1);
      this.scene.add(sp);
      this.smokePuffs.push({ sprite: sp, baseY: sp.position.y, phase: rand(0, 6), speed: rand(0.05, 0.15), baseScale: s, mist: true });
    }
  }

  triggerLightning() {
    this.flash = 1;
    this.lightningTimer = rand(16, 32);
  }

  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    // lightning
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) this.triggerLightning();
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.3);
      const f = this.flash * (0.6 + Math.random() * 0.4);
      this.hemi.intensity = 1.15 + f * 7;
      this.moonLight.intensity = 1.25 + f * 3;
      this.sky.material.uniforms.flash.value = f;
    } else {
      this.hemi.intensity = 1.15; this.moonLight.intensity = 1.25; this.sky.material.uniforms.flash.value = 0;
    }

    // flicker lights
    for (const f of this.flickerLights) {
      if (f.beacon) f.light.intensity = f.base * (0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * 3.1 + f.seed)), 8));
      else if (f.flicker) {
        const n = Math.sin(t * 17 + f.seed) * Math.sin(t * 7.3 + f.seed * 2) * Math.sin(t * 2.1);
        f.light.intensity = f.base * (0.82 + 0.18 * n) * (Math.sin(t * 0.7 + f.seed) > -0.92 ? 1 : 0.15);
      }
    }
    if (this.uplinkLight) this.uplinkLight.intensity = 5 + Math.sin(t * 2.4) * 1.5;

    // searchlights
    for (const s of this.searchlights) {
      const a = t * 0.12 + s.phase;
      const tx = Math.sin(a) * 22, tz = Math.cos(a * 0.8) * 22;
      s.target = s.spot.target;
      s.spot.target.position.set(tx, 0, tz);
      const dir = new THREE.Vector3(tx - s.x, 0 - 9, tz - s.z).normalize();
      s.pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    }

    // rain relative to camera
    if (this.rainData && camera) {
      const cx = camera.position.x, cz = camera.position.z;
      for (let i = 0; i < this.rainData.length; i++) {
        const d = this.rainData[i];
        d.y -= d.speed * dt;
        if (d.y < 0) {
          d.y = rand(18, 30); d.x = cx + rand(-32, 32); d.z = cz + rand(-32, 32);
        }
        const o = i * 6;
        this.rainPos[o] = d.x; this.rainPos[o + 1] = d.y; this.rainPos[o + 2] = d.z;
        this.rainPos[o + 3] = d.x + 0.07; this.rainPos[o + 4] = d.y - d.len; this.rainPos[o + 5] = d.z + 0.02;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;

      // splashes near player
      for (let i = 0; i < this.splashData.length; i++) {
        const s = this.splashData[i];
        s.life -= dt * s.speed;
        if (s.life <= 0) { s.life = 1; s.x = cx + rand(-18, 18); s.z = cz + rand(-18, 18); }
        const o = i * 3;
        this.splashPos[o] = s.x; this.splashPos[o + 1] = 0.025 + (1 - s.life) * 0.04; this.splashPos[o + 2] = s.z;
      }
      this.splashes.geometry.attributes.position.needsUpdate = true;
    }

    // dust drift
    if (this.dust) this.dust.rotation.y += dt * 0.006;

    // embers
    if (this.embers) {
      const p = this.emberGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (0.25 + (i % 5) * 0.08);
        if (y > 9) y = 0.2;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.06);
      }
      p.needsUpdate = true;
    }

    // smoke and mist
    for (const s of this.smokePuffs) {
      const y = s.baseY + (s.mist ? Math.sin(t * 0.2 + s.phase) * 0.3 : ((t * s.speed + s.phase) % 4));
      s.sprite.position.y = s.mist ? y : s.baseY + ((t * s.speed + s.phase) % 4.5);
      if (!s.mist) s.sprite.material.opacity = 0.2 * (1 - ((t * s.speed + s.phase) % 4.5) / 4.5);
    }

    // beacon pulse
    for (let i = 0; i < this.beacons.length; i++) {
      const b = this.beacons[i];
      if (b.material && b.material.emissiveIntensity !== undefined) b.material.emissiveIntensity = 1.6 + Math.sin(t * 3.4 + i) * 1.6;
    }
  }

  // ray vs level AABBs
  raycast(origin, dir, maxDist = 200) {
    let best = maxDist, hit = null;
    for (const c of this.colliders) {
      const b = this.rayBox(origin, dir, c.x1, 0, c.z1, c.x2, c.h, c.z2);
      if (b !== null && b < best) { best = b; hit = c; }
    }
    // ground
    if (dir.y < -0.0001) {
      const t = -origin.y / dir.y;
      if (t > 0.01 && t < best) { best = t; hit = 'ground'; }
    }
    if (!hit) return null;
    return { distance: best, point: origin.clone().addScaledVector(dir, best), collider: hit };
  }

  rayBox(o, d, x1, y1, z1, x2, y2, z2) {
    let tmin = 0, tmax = 1e9;
    for (const [oo, dd, mn, mx] of [[o.x, d.x, x1, x2], [o.y, d.y, y1, y2], [o.z, d.z, z1, z2]]) {
      if (Math.abs(dd) < 1e-8) { if (oo < mn || oo > mx) return null; }
      else {
        let t1 = (mn - oo) / dd, t2 = (mx - oo) / dd;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin > 0.001 ? tmin : (tmax > 0.001 ? tmax : null);
  }

  // simple line of sight check between two world points
  hasLOS(a, b) {
    const dir = b.clone().sub(a);
    const dist = dir.length(); if (dist < 0.001) return true;
    dir.divideScalar(dist);
    for (const c of this.colliders) {
      if (c.h < 1.2) continue;
      const t = this.rayBox(a, dir, c.x1, 0, c.z1, c.x2, c.h, c.z2);
      if (t !== null && t < dist - 0.3) return false;
    }
    return true;
  }

  // collide circle with AABB and resolve
  collide(pos, radius, height = 1.8) {
    let hit = false;
    for (const c of this.colliders) {
      if (c.h < 0.4) continue;
      const nx = Math.max(c.x1, Math.min(pos.x, c.x2));
      const nz = Math.max(c.z1, Math.min(pos.z, c.z2));
      let dx = pos.x - nx, dz = pos.z - nz;
      let d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 0.00001) {
          // inside: push toward nearest edge
          const l = pos.x - c.x1, r = c.x2 - pos.x, t = pos.z - c.z1, b = c.z2 - pos.z;
          const m = Math.min(l, r, t, b);
          if (m === l) pos.x = c.x1 - radius; else if (m === r) pos.x = c.x2 + radius;
          else if (m === t) pos.z = c.z1 - radius; else pos.z = c.z2 + radius;
        } else {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        }
        hit = true;
      }
    }
    return hit;
  }
}
