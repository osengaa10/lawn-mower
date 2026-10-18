// Loads the animated animal models (assets/models/*.glb) once at startup and
// hands out independent copies. Anything that fails to load is simply
// missing, and the game shows that animal as an emoji cutout instead.
import { THREE } from './renderer.js';
import { GLTFLoader } from '../../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../../vendor/addons/utils/SkeletonUtils.js';

const models = new Map();

// Every model file in assets/models (keep in sync with sw.js).
export const MODEL_NAMES = [];

export function registerModels(names) {
  for (const n of names) if (!MODEL_NAMES.includes(n)) MODEL_NAMES.push(n);
}

// Resolves when every model has loaded or failed, or after `timeout` ms.
export function loadModels(timeout = 6000) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const all = Promise.all(
    MODEL_NAMES.map((name) =>
      loader
        .loadAsync(`assets/models/${name}.glb`)
        .then((gltf) => models.set(name, prepare(gltf)))
        .catch((e) => console.warn(`model ${name} not loaded`, e)),
    ),
  );
  return Promise.race([all, new Promise((r) => setTimeout(r, timeout))]);
}

// Measure the model standing still, so copies can be scaled to a height
// and stood on the ground.
function prepare(gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the animation
    for (const m of [o.material].flat()) m.userData.shared = true;
    o.geometry.userData.shared = true;
  });
  // skinned meshes measure themselves through their bones
  const box = new THREE.Box3().setFromObject(scene);
  return { scene, clips: gltf.animations, box };
}

export function hasModel(name) {
  return models.has(name);
}

// A fresh copy: { object, clips, height, bottom } (height/bottom in model units).
export function cloneModel(name) {
  const m = models.get(name);
  if (!m) return null;
  const object = cloneSkinned(m.scene);
  const size = m.box.getSize(new THREE.Vector3());
  return { object, clips: m.clips, height: size.y, length: Math.max(size.x, size.z), bottom: m.box.min.y };
}
