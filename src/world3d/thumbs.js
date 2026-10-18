// The real 3D mower drawn into the 2D menus (the garage cards and the
// unlock card). A small offscreen renderer draws it, then it's copied onto
// the 2D canvas, so it can still turn, bounce and spin like before.
import { BLOB_LAYER, THREE } from './renderer.js';
import { RoomEnvironment } from '../../vendor/addons/environments/RoomEnvironment.js';
import { Mower3D } from './mower3d.js';
import { DPR } from '../util.js';

const SIZE = 512;
let R = null;
let scene = null;
let camera = null;
const mowers = new Map();
const pose = { x: 0, y: 0, h: 0, heading: 0, size: 1, scale: 1, squash: 0, speed01: 0, travel: 0, airborne: false, vh: 0 };

function setup() {
  const canvas = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  R.setPixelRatio(1);
  R.setSize(SIZE, SIZE, false);
  R.setClearColor(0x000000, 0);
  R.toneMapping = THREE.NeutralToneMapping;
  R.setScissorTest(true);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();
  const sun = new THREE.DirectionalLight('#fff6e0', 2);
  sun.position.set(-1, 3, 2);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa070', 1.6), sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(1.15, 1.25, 2.1);
  camera.lookAt(0, 0.3, 0);
  camera.layers.enable(BLOB_LAYER);
}

function mowerFor(skin) {
  let m = mowers.get(skin);
  if (!m) {
    m = new Mower3D(skin);
    m.root.visible = m.shadow.visible = false;
    scene.add(m.root, m.shadow);
    mowers.set(skin, m);
  }
  return m;
}

// Same idea as drawMower in mower.js: centered on (x, y), about `size` long.
export function drawMower3D(ctx, skin, x, y, size, heading, t, { moving = 0 } = {}) {
  if (!R) setup();
  const m = mowerFor(skin);
  const px = Math.min(SIZE, Math.round(size * 1.6 * DPR));
  pose.heading = heading;
  pose.speed01 = moving;
  pose.travel = t * moving * 1.5;
  m.update(pose, () => 0, t);
  for (const other of mowers.values()) other.root.visible = other.shadow.visible = other === m;
  R.setViewport(0, 0, px, px);
  R.setScissor(0, 0, px, px);
  R.clear();
  R.render(scene, camera);
  const s = px / DPR;
  ctx.drawImage(R.domElement, 0, SIZE - px, px, px, x - s / 2, y - s * 0.55, s, s);
}
