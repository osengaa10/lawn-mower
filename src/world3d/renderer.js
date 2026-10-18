// One WebGL renderer on the back canvas, shared by every 3D screen.
// The 2D canvas on top of it carries the HUD, buttons and menus.
import * as THREE from '../../vendor/three.module.min.js';
import { RoomEnvironment } from '../../vendor/addons/environments/RoomEnvironment.js';

export { THREE };

let renderer = null;
let envMap = null;
const canvas = document.getElementById('world');

// Blob shadows under things that cast a real shadow go on this layer, and
// only show when real shadows are off.
export const BLOB_LAYER = 1;

export function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxRatio));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const render = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      if (quality.shadows) camera.layers.disable(BLOB_LAYER);
      else camera.layers.enable(BLOB_LAYER);
      render(scene, camera);
    };
  }
  return renderer;
}

// Soft studio lighting for the shiny toy materials, made once.
export function getEnvMap() {
  if (!envMap) {
    const pm = new THREE.PMREMGenerator(getRenderer());
    envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envMap;
}

export function resizeRenderer(W, H) {
  getRenderer().setSize(W, H, false);
}

export function showWorld(on) {
  canvas.style.visibility = on ? 'visible' : 'hidden';
}

// ---------- quality ----------

// Starts at full quality and steps down (never back up) if frames are slow:
// first fewer pixels, then smaller shadows, then no real shadows.
const LEVELS = [
  { maxRatio: 2, shadows: 2048 },
  { maxRatio: 1.5, shadows: 1024 },
  { maxRatio: 1.25, shadows: 0 },
];
export const quality = { level: 0, ...LEVELS[0] };
const suns = new Set();
let slow = { t: 0, sum: 0, n: 0, wait: 3 };

export function setQuality(level) {
  quality.level = Math.max(0, Math.min(LEVELS.length - 1, level));
  Object.assign(quality, LEVELS[quality.level]);
  getRenderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxRatio));
  for (const sun of suns) setSunShadow(sun);
}

function setSunShadow(sun) {
  sun.castShadow = quality.shadows > 0;
  if (quality.shadows && sun.shadow.mapSize.x !== quality.shadows) {
    sun.shadow.mapSize.set(quality.shadows, quality.shadows);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
}

// Call once per rendered 3D frame with the real frame time in seconds.
export function trackFrame(dt) {
  if (dt > 0.25 || quality.locked) return; // a hiccup or a hidden tab, not a slow device
  if (slow.wait > 0) {
    slow.wait -= dt;
    return;
  }
  slow.t += dt;
  slow.sum += dt;
  slow.n++;
  if (slow.t < 2) return;
  const avg = slow.sum / slow.n;
  slow = { t: 0, sum: 0, n: 0, wait: 0 };
  if (avg > 0.022 && quality.level < LEVELS.length - 1) {
    setQuality(quality.level + 1);
    slow.wait = 3;
  }
}

// Give the frame-time check a moment to settle after a new screen loads.
export function settleQuality() {
  slow = { t: 0, sum: 0, n: 0, wait: 3 };
}

// ---------- lights and sky ----------

// Sky, sun and fog for each world.
export const LIGHTS = {
  day: { sky: '#bfe9ff', skyTop: '#5fb4f0', hemiSky: '#ffffff', hemiGround: '#7da35c', hemi: 1.7, sun: 1.9, sunColor: '#fff6e0', env: 0.5 },
  sunset: { sky: '#ffcf96', skyTop: '#f08a6a', hemiSky: '#ffe2c0', hemiGround: '#8a6a40', hemi: 1.6, sun: 2.0, sunColor: '#ffc27a', env: 0.45 },
  night: { sky: '#1a2a4a', skyTop: '#070d24', hemiSky: '#8fa8ff', hemiGround: '#203040', hemi: 1.2, sun: 1.1, sunColor: '#b8c8ff', env: 0.25 },
  candy: { sky: '#ffe0f2', skyTop: '#ff9fd2', hemiSky: '#ffffff', hemiGround: '#e0a0c0', hemi: 1.8, sun: 1.7, sunColor: '#fff0fa', env: 0.5 },
  moon: { sky: '#120c30', skyTop: '#04020f', hemiSky: '#b0a0ff', hemiGround: '#302060', hemi: 1.3, sun: 1.2, sunColor: '#d8d0ff', env: 0.3 },
};

const SUN_DIR = new THREE.Vector3(-8, 20, 10).normalize();

export function makeLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.8);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-8, 20, 10);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  suns.add(sun);
  setSunShadow(sun);
  scene.add(hemi, sun, sun.target);
  scene.environment = getEnvMap();
  return {
    hemi,
    sun,
    apply(themeId, center = { x: 0, z: 0 }, radius) {
      const L = LIGHTS[themeId] || LIGHTS.day;
      hemi.color.set(L.hemiSky);
      hemi.groundColor.set(L.hemiGround);
      hemi.intensity = L.hemi;
      sun.color.set(L.sunColor);
      sun.intensity = L.sun;
      scene.environmentIntensity = L.env;
      this.aim(center.x, center.z, radius);
      if (!scene.background) scene.background = new THREE.Color();
      scene.background.set(L.sky);
      return L;
    },
    // Point the sun at (x, z) and fit its shadow to a circle of this radius.
    aim(x, z, radius = this.radius || 20) {
      this.radius = radius;
      const d = radius + 30;
      sun.position.set(x + SUN_DIR.x * d, SUN_DIR.y * d, z + SUN_DIR.z * d);
      sun.target.position.set(x, 0, z);
      const cam = sun.shadow.camera;
      if (cam.right !== radius) {
        cam.left = cam.bottom = -radius;
        cam.right = cam.top = radius;
        cam.near = 1;
        cam.far = d + radius + 10;
        cam.updateProjectionMatrix();
      }
    },
  };
}

// A gradient sky dome that follows the camera, with a few puffy clouds in
// the bright worlds and stars in the dark ones.
export function makeSky(scene) {
  const uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position);

  const clouds = new THREE.Group();
  const puff = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
  const ball = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(ball, puff);
      const r = 5 + Math.random() * 4;
      m.scale.set(r, r * 0.7, r);
      m.position.set((k - 2) * 6 + Math.random() * 3, Math.random() * 3 - (Math.abs(k - 2) * 1.5), Math.random() * 4);
      c.add(m);
    }
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const e = 0.12 + Math.random() * 0.22;
    c.position.set(Math.cos(a) * Math.cos(e) * 200, Math.sin(e) * 200, Math.sin(a) * Math.cos(e) * 200);
    c.lookAt(0, c.position.y, 0);
    clouds.add(c);
  }
  dome.add(clouds);

  const pts = [];
  for (let i = 0; i < 500; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
    v.normalize().multiplyScalar(230);
    pts.push(v.x, v.y, v.z);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  dome.add(stars);
  scene.add(dome);

  const _c = new THREE.Color();
  return {
    dome,
    horizon: uniforms.horizon.value,
    // Move toward a world's sky. k = 1 jumps straight there.
    blend(themeId, k = 1) {
      const L = LIGHTS[themeId] || LIGHTS.day;
      uniforms.top.value.lerp(_c.set(L.skyTop), k);
      uniforms.horizon.value.lerp(_c.set(L.sky), k);
      const dark = isDarkTheme(themeId);
      stars.material.opacity += ((dark ? 0.9 : 0) - stars.material.opacity) * k;
      const cloudy = themeId === 'day' || themeId === 'sunset' || themeId === 'candy';
      clouds.scale.setScalar(clouds.scale.x + ((cloudy ? 1 : 0.001) - clouds.scale.x) * k);
      clouds.visible = clouds.scale.x > 0.01;
      if (themeId === 'candy') puff.color.lerp(_c.set('#ffe6f5'), k);
      else puff.color.lerp(_c.set(themeId === 'sunset' ? '#ffe8d0' : '#ffffff'), k);
    },
    update(dt) {
      clouds.rotation.y += dt * 0.004;
    },
  };
}

// ---------- materials and shadows ----------

// Painted-toy material for models. Shared and cached by its settings, so
// disposeTree keeps it; use newToy() for one that will be changed later.
const toys = new Map();
export function toy(color, opts = {}) {
  const key = color + Object.entries(opts).map(([k, v]) => `|${k}:${v?.isTexture ? v.uuid : v}`).join('');
  let m = toys.get(key);
  if (!m) {
    m = newToy(color, opts);
    m.userData.shared = true;
    toys.set(key, m);
  }
  return m;
}

export function newToy(color, { rough = 0.6, metal = 0, ...extra } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

// Everything solid under obj casts (and catches) real shadows.
export function castAll(obj) {
  obj.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.transparent && !m.depthWrite) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return obj;
}

export function isDarkTheme(themeId) {
  return themeId === 'night' || themeId === 'moon';
}
