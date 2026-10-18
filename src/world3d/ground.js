// The ground: a hilly mesh with the lawn painted on it (mowed stripes and the
// hidden picture). A tiny per-cell mask darkens cells that still have tall
// grass, so the picture only shows where he has mowed.
import { THREE } from './renderer.js';
import { MOWER_CELLS, TALL } from '../lawn.js';
import { drawPicture } from '../pictures.js';
import { hillHeight, mulberry32 } from '../terrain.js';

export const YARD = 10; // cells of yard around the lawn

// Paint the lawn in grid units (the caller sets up the transform).
export function paintLawn(g, lawn, { picture = true } = {}) {
  const { cols, rows, path, theme } = lawn;
  g.save();
  g.translate(0.12, 0.22);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fill(path);
  g.restore();
  g.lineJoin = 'round';
  g.lineWidth = 0.7;
  g.strokeStyle = theme.edge;
  g.stroke(path);

  g.save();
  g.clip(path);
  const landscape = cols >= rows;
  const span = landscape ? cols : rows;
  for (let s = 0, k = 0; s < span + MOWER_CELLS; s += MOWER_CELLS, k++) {
    g.fillStyle = k % 2 ? theme.cutA : theme.cutB;
    if (landscape) g.fillRect(s, 0, MOWER_CELLS + 0.02, rows);
    else g.fillRect(0, s, cols, MOWER_CELLS + 0.02);
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let r = 0; r < rows; r++) for (let c = r % 2; c < cols; c += 2) g.fillRect(c, r, 1, 1);
  if (picture && lawn.pictureBox) {
    const b = lawn.pictureBox;
    g.globalAlpha = 0.92;
    drawPicture(g, lawn.def.picture, b.x, b.y, b.w, b.h);
    g.globalAlpha = 1;
  }
  for (const o of lawn.obstacles) {
    if (o.kind !== 'pond') continue;
    g.fillStyle = '#8d6e63';
    g.beginPath();
    g.ellipse(o.gx, o.gy, o.gr * 1.12, o.gr * 0.95, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = theme.id === 'candy' ? '#80d8ff' : theme.id === 'moon' ? '#4fc3f7' : '#42a5f5';
    g.beginPath();
    g.ellipse(o.gx, o.gy, o.gr, o.gr * 0.83, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(o.gx - o.gr * 0.3, o.gy - o.gr * 0.3, o.gr * 0.35, o.gr * 0.14, -0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function paintYard(g, lawn, x0, z0, w, h) {
  const { theme } = lawn;
  g.fillStyle = theme.bg[1];
  g.fillRect(x0, z0, w, h);
  const gr = g.createRadialGradient(lawn.cols / 2, lawn.rows / 2, 0, lawn.cols / 2, lawn.rows / 2, Math.max(w, h) * 0.5);
  gr.addColorStop(0, theme.bg[0]);
  gr.addColorStop(1, theme.bg[1]);
  g.fillStyle = gr;
  g.fillRect(x0, z0, w, h);
  const rng = mulberry32(lawn.seed + 7);
  const n = Math.floor(w * h * 1.4);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.25 + rng() * 0.45;
    g.fillStyle = theme.sprinkle[Math.floor(rng() * theme.sprinkle.length)];
    g.beginPath();
    g.arc(x0 + rng() * w, z0 + rng() * h, 0.04 + rng() * 0.07, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// Adds the tall-grass mask to a Lambert material.
function addTallMask(mat, uniforms) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec2 vLawnXZ;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvLawnXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
    );
    shader.fragmentShader =
      'uniform sampler2D tallMap;\nuniform vec2 tallSize;\nuniform vec3 tallColor;\nvarying vec2 vLawnXZ;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float tall = smoothstep(0.3, 0.7, texture2D(tallMap, (vLawnXZ + 1.0) / tallSize).r);
        diffuseColor.rgb = mix(diffuseColor.rgb, tallColor, tall);`,
      );
  };
}

export class Ground {
  constructor(lawn) {
    this.lawn = lawn;
    const { cols, rows, theme } = lawn;
    const w = cols + YARD * 2;
    const h = rows + YARD * 2;
    const ppc = Math.min(40, 2048 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * ppc);
    c.height = Math.round(h * ppc);
    const g = c.getContext('2d');
    g.setTransform(ppc, 0, 0, ppc, YARD * ppc, YARD * ppc);
    paintYard(g, lawn, -YARD, -YARD, w, h);
    paintLawn(g, lawn);
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    // one texel per cell, with an empty border so the edges fade out
    const tw = cols + 2;
    const th = rows + 2;
    this.tall = new Uint8Array(tw * th);
    this.tallTex = new THREE.DataTexture(this.tall, tw, th, THREE.RedFormat, THREE.UnsignedByteType);
    this.tallTex.magFilter = THREE.LinearFilter;
    this.tallTex.minFilter = THREE.LinearFilter;
    for (let i = 0; i < lawn.grid.length; i++) if (lawn.grid[i] === TALL) this.setTall(i, true);
    this.tallTex.needsUpdate = true;

    const seg = 2;
    const geo = new THREE.PlaneGeometry(w, h, Math.ceil(w * seg), Math.ceil(h * seg));
    geo.rotateX(-Math.PI / 2);
    geo.translate(cols / 2, 0, rows / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, hillHeight(lawn.hills, pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ map: this.texture });
    addTallMask(mat, {
      tallMap: { value: this.tallTex },
      tallSize: { value: new THREE.Vector2(tw, th) },
      tallColor: { value: new THREE.Color(theme.tallBase) },
    });
    this.mesh = new THREE.Mesh(geo, mat);

    // plain ground out to the horizon
    this.far = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2).translate(cols / 2, -0.03, rows / 2),
      new THREE.MeshLambertMaterial({ color: theme.bg[1] }),
    );
    this.group = new THREE.Group();
    this.group.add(this.far, this.mesh);
  }

  setTall(i, on) {
    const { cols } = this.lawn;
    const c = i % cols;
    const r = (i / cols) | 0;
    this.tall[(r + 1) * (cols + 2) + c + 1] = on ? 255 : 0;
    this.dirty = true;
  }

  clearAll() {
    this.tall.fill(0);
    this.dirty = true;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.tallTex.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.tallTex.dispose();
    for (const m of [this.mesh, this.far]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
