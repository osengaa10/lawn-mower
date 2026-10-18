// Emoji as standing cardboard cutouts in the 3D world, plus soft round shadows.
import { BLOB_LAYER, THREE } from './renderer.js';
import { EMOJI_FONT } from '../util.js';

const textures = new Map();

// Emoji are drawn once into a texture. The glyph's bottom sits near the
// texture's bottom edge so a sprite can stand on the ground.
export function emojiTexture(ch) {
  let t = textures.get(ch);
  if (t) return t;
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${px * 0.78}px ${EMOJI_FONT}`;
  g.fillText(ch, px / 2, px * 0.52);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(ch, t);
  return t;
}

// A billboard that always faces the camera. size is its height in cells.
// The anchor is at the bottom middle, so position it on the ground.
export function makeEmoji(ch, size = 1, { anchorY = 0.08, depthTest = true } = {}) {
  const mat = new THREE.SpriteMaterial({ map: emojiTexture(ch), transparent: true, alphaTest: 0.25, depthTest, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.center.set(0.5, anchorY);
  s.scale.set(size, size, 1);
  s.userData.emoji = ch;
  return s;
}

export function setEmoji(sprite, ch) {
  if (sprite.userData.emoji === ch) return;
  sprite.userData.emoji = ch;
  sprite.material.map = emojiTexture(ch);
  sprite.material.needsUpdate = true;
}

let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// A soft dark blob that sits just above the ground. w/d are width and depth in cells.
// caster: the thing above it casts a real shadow, so the blob only shows when
// real shadows are turned off.
export function makeShadow(w = 1, d = w, opacity = 1, caster = false) {
  const m = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity }),
  );
  m.scale.set(w, 1, d);
  m.renderOrder = 1;
  if (caster) m.layers.set(BLOB_LAYER);
  return m;
}

// Free GPU memory for everything under an object. Shared emoji textures and
// anything marked userData.shared are kept.
export function disposeTree(obj) {
  const shared = new Set(textures.values());
  shared.add(shadowTex);
  obj.traverse((o) => {
    if (o.geometry && o.geometry !== shadowGeo && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      if (m.map && !shared.has(m.map)) m.map.dispose();
      m.dispose();
    }
  });
}
