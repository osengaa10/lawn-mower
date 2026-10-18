// Animal actors. makeAnimal('🐶', size) gives a 3D animated model when there
// is one for that emoji, or an emoji cutout when there isn't. Both have the
// same controls, so the rest of the game never has to care which it got:
//   actor.root          put it in the world, move it, scale it
//   actor.face(dx, dz)  turn smoothly toward a direction
//   actor.setMotion(speed, { air })  idle / walk / run / fly to match
//   actor.react('hop' | 'spin' | 'happy')
//   actor.setTilt(a), actor.setSpin(turns), actor.setOpacity(a)
//   actor.update(dt)    once per frame
import { THREE } from './renderer.js';
import { makeEmoji, setEmoji } from './sprites.js';
import { cloneModel, hasModel, registerModels } from './models.js';

// emoji -> model file, how tall it stands (as a fraction of `size`), and
// optional tweaks: tint (multiplies the colors), yaw (if it faces sideways),
// horn (unicorn), sit (driving pose: lift so the head shows over the seat).
export const ANIMALS = {
  '🐶': { model: 'shiba', h: 0.78 },
  '🐕': { model: 'shiba', h: 0.78 },
  '🐱': { model: 'cat', h: 0.72 },
  '🐰': { model: 'rabbit', h: 0.9 },
  '🐤': { model: 'chick', h: 0.85 },
  '🐥': { model: 'chick', h: 0.85 },
  '🦊': { model: 'fox', h: 0.8 },
  '🐷': { model: 'pig', h: 0.72 },
  '🐮': { model: 'cow', h: 0.9 },
  '🐄': { model: 'cow', h: 0.9 },
  '🐑': { model: 'sheep', h: 0.85 },
  '🦙': { model: 'alpaca', h: 1.0 },
  '🦝': { model: 'raccoon', h: 0.72 },
  '🐼': { model: 'panda', h: 0.95 },
  '🦄': { model: 'whitehorse', h: 1.0, horn: true, tint: '#ffe8f6' },
  '🤖': { model: 'robot', h: 0.9 },
  '👽': { model: 'alien', h: 0.9 },
};

registerModels([...new Set(Object.values(ANIMALS).map((a) => a.model))]);

const CLIPS = {
  idle: [/^idle$/i, /idle/i],
  walk: [/^walk$/i, /walk/i],
  run: [/gallop$/i, /^run$/i, /run/i, /gallop/i, /walk/i],
  jump: [/jump_toidle/i, /^jump$/i, /jump/i],
  eat: [/eat/i],
  fly: [/^fly/i, /flying/i, /fly/i],
  happy: [/yes/i, /wave/i, /dance/i, /jump/i],
  sit: [/sitting_idle/i, /^sitting$/i],
};

function findClip(clips, kind) {
  for (const re of CLIPS[kind] || []) {
    const c = clips.find((c) => re.test(c.name));
    if (c) return c;
  }
  return null;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class ModelActor {
  constructor(spec, size, m) {
    this.isModel = true;
    this.spec = spec;
    this.root = new THREE.Group();
    this.turn = new THREE.Group(); // yaw toward where it's going
    this.root.add(this.turn);
    const k = (size * (spec.h || 1)) / m.height;
    m.object.scale.setScalar(k);
    m.object.position.y = -m.bottom * k;
    m.object.rotation.y = spec.yaw || 0;
    this.turn.add(m.object);
    this.object = m.object;
    if (spec.tint) this.tint(spec.tint);
    if (spec.horn) this.addHorn(size);
    this.mixer = new THREE.AnimationMixer(m.object);
    this.actions = {};
    for (const kind of Object.keys(CLIPS)) {
      const clip = findClip(m.clips, kind);
      if (clip) this.actions[kind] = this.mixer.clipAction(clip);
    }
    this.current = null;
    this.yaw = 0;
    this.wantYaw = 0;
    this.spin = 0;
    this.oneShot = 0;
    this.play('idle', 0);
    // start each copy at a different point so a group doesn't move in step
    this.mixer.update(Math.random() * 3);
  }

  ownMaterials() {
    if (this.owned) return;
    this.owned = true;
    this.object.traverse((o) => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    });
  }

  tint(color) {
    this.ownMaterials();
    const c = new THREE.Color(color);
    this.object.traverse((o) => {
      if (o.isMesh) for (const m of [o.material].flat()) m.color.multiply(c);
    });
  }

  addHorn(size) {
    // a little golden horn on the head (unicorns are horses with a horn)
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#ffd54f', roughness: 0.3, metalness: 0.4 }));
    horn.scale.setScalar(size);
    horn.position.set(0, size * 0.98, size * 0.42);
    horn.rotation.x = 0.5;
    this.turn.add(horn);
  }

  play(kind, fade = 0.25, speed = 1) {
    const a = this.actions[kind] || (kind === 'run' ? this.actions.walk : null) || this.actions.idle;
    if (!a) return;
    a.timeScale = speed;
    if (a === this.current) return;
    a.reset().play();
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    this.current = a;
  }

  // Sit down if it knows how (for driving). Returns true if it did.
  sit() {
    if (!this.actions.sit) return false;
    this.play('sit', 0);
    this.sitting = true;
    return true;
  }

  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    this.wantYaw = Math.atan2(dx, dz);
  }

  faceNow(dx, dz) {
    this.face(dx, dz);
    this.yaw = this.wantYaw;
  }

  setMotion(speed, { air = false } = {}) {
    if (this.oneShot > 0 || this.sitting) return;
    if (air && this.actions.fly) this.play('fly');
    else if (speed < 0.4) this.play('idle');
    else if (speed < 3.2 || !this.actions.run) this.play('walk', 0.25, Math.max(0.6, Math.min(1.8, speed / 2)));
    else this.play('run', 0.2, Math.max(0.7, Math.min(1.6, speed / 5)));
  }

  react(kind) {
    if (kind === 'spin') {
      this.spinT = 0.6;
      return;
    }
    const a = kind === 'hop' ? 'jump' : kind === 'happy' ? 'happy' : kind;
    if (!this.actions[a]) return;
    this.play(a, 0.1);
    this.oneShot = Math.min(1.2, this.actions[a].getClip().duration);
  }

  setTilt(a) {
    this.turn.rotation.z = a;
  }

  setSpin(turns) {
    this.spin = turns * Math.PI * 2;
  }

  setOpacity(a) {
    if (a >= 1 && !this.faded) return;
    this.ownMaterials();
    this.faded = a < 1;
    this.object.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        m.transparent = a < 1;
        m.opacity = a;
      }
    });
  }

  update(dt) {
    if (this.oneShot > 0) {
      this.oneShot -= dt;
      if (this.oneShot <= 0) this.play(this.sitting ? 'sit' : 'idle', 0.3);
    }
    if (this.spinT > 0) {
      this.spinT = Math.max(0, this.spinT - dt);
      this.spin = (1 - this.spinT / 0.6) * Math.PI * 2;
    }
    this.yaw += wrapAngle(this.wantYaw - this.yaw) * (1 - Math.exp(-dt * 8));
    this.turn.rotation.y = this.yaw + this.spin;
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    if (this.owned)
      this.object.traverse((o) => {
        if (o.isMesh) for (const m of [o.material].flat()) m.dispose();
      });
  }
}

// The same controls for an emoji cutout: it flips to face left or right,
// spins and tilts in the picture plane, and flaps when it flies.
class EmojiActor {
  constructor(e, size) {
    this.isModel = false;
    this.size = size;
    this.root = new THREE.Group();
    this.sprite = makeEmoji(e, size);
    this.root.add(this.sprite);
    this.dir = 1;
    this.tilt = 0;
    this.spin = 0;
    this.flying = false;
    this.t = Math.random() * 3;
  }

  play() {}

  sit() {
    return false;
  }

  face(dx) {
    if (Math.abs(dx) > 0.05) this.dir = dx < 0 ? -1 : 1;
  }

  faceNow(dx, dz) {
    this.face(dx, dz);
  }

  setMotion(speed, { air = false } = {}) {
    this.flying = air;
  }

  react(kind) {
    if (kind === 'spin') this.spinT = 0.6;
  }

  setTilt(a) {
    this.tilt = a;
  }

  setSpin(turns) {
    this.spin = turns * Math.PI * 2;
  }

  setOpacity(a) {
    this.sprite.material.opacity = a;
  }

  setEmoji(e) {
    setEmoji(this.sprite, e);
  }

  update(dt) {
    this.t += dt;
    if (this.spinT > 0) {
      this.spinT = Math.max(0, this.spinT - dt);
      this.spin = (1 - this.spinT / 0.6) * Math.PI * 2;
    }
    const flap = this.flying ? 0.6 + 0.4 * Math.abs(Math.sin(this.t * 14)) : 1;
    this.sprite.scale.set(this.size * flap, this.size, 1);
    this.sprite.material.rotation = this.tilt + this.spin;
  }

  dispose() {
    this.sprite.material.dispose();
  }
}

export function makeAnimal(e, size = 1) {
  const spec = ANIMALS[e];
  if (spec && hasModel(spec.model)) {
    const m = cloneModel(spec.model);
    if (m) return new ModelActor(spec, size, m);
  }
  return new EmojiActor(e, size);
}

export function hasAnimalModel(e) {
  const spec = ANIMALS[e];
  return !!(spec && hasModel(spec.model));
}
