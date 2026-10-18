// One WebGL renderer on the back canvas, shared by every 3D screen.
// The 2D canvas on top of it carries the HUD, buttons and menus.
import * as THREE from '../../vendor/three.module.min.js';

export { THREE };

let renderer = null;
const canvas = document.getElementById('world');

export function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  return renderer;
}

export function resizeRenderer(W, H) {
  getRenderer().setSize(W, H, false);
}

export function showWorld(on) {
  canvas.style.visibility = on ? 'visible' : 'hidden';
}

// Sky, sun and fog for each world.
export const LIGHTS = {
  day: { sky: '#bfe9ff', hemiSky: '#ffffff', hemiGround: '#7da35c', hemi: 1.9, sun: 1.5, sunColor: '#fff6e0' },
  sunset: { sky: '#ffcf96', hemiSky: '#ffe2c0', hemiGround: '#8a6a40', hemi: 1.8, sun: 1.6, sunColor: '#ffc27a' },
  night: { sky: '#1a2a4a', hemiSky: '#8fa8ff', hemiGround: '#203040', hemi: 1.3, sun: 0.9, sunColor: '#b8c8ff' },
  candy: { sky: '#ffe0f2', hemiSky: '#ffffff', hemiGround: '#e0a0c0', hemi: 2.0, sun: 1.4, sunColor: '#fff0fa' },
  moon: { sky: '#120c30', hemiSky: '#b0a0ff', hemiGround: '#302060', hemi: 1.4, sun: 1.0, sunColor: '#d8d0ff' },
};

export function makeLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.8);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-8, 20, 10);
  scene.add(hemi, sun, sun.target);
  return {
    hemi,
    sun,
    apply(themeId, center = { x: 0, z: 0 }) {
      const L = LIGHTS[themeId] || LIGHTS.day;
      hemi.color.set(L.hemiSky);
      hemi.groundColor.set(L.hemiGround);
      hemi.intensity = L.hemi;
      sun.color.set(L.sunColor);
      sun.intensity = L.sun;
      sun.position.set(center.x - 8, 20, center.z + 10);
      sun.target.position.set(center.x, 0, center.z);
      if (!scene.background) scene.background = new THREE.Color();
      scene.background.set(L.sky);
      return L;
    },
  };
}

export function isDarkTheme(themeId) {
  return themeId === 'night' || themeId === 'moon';
}
