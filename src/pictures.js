// Giant pictures hidden in the lawn. They're painted on the ground under the
// tall grass, so mowing slowly reveals them. Each one draws into a box that is
// `aspect` wide and 1 tall (y goes down), with a chunky white outline.
// `name` is spoken as "It's {name}!".

const TAU = Math.PI * 2;

function shape(g, fill, build) {
  g.beginPath();
  build();
  g.fillStyle = fill;
  g.fill();
  g.stroke();
}
const circle = (g, fill, x, y, r) => shape(g, fill, () => g.arc(x, y, r, 0, TAU));
const oval = (g, fill, x, y, rx, ry, rot = 0) => shape(g, fill, () => g.ellipse(x, y, rx, ry, rot, 0, TAU));
const poly = (g, fill, ...pts) =>
  shape(g, fill, () => {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  });
function dot(g, fill, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}
function line(g, color, w, ...pts) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
  g.restore();
}
function face(g, x, y, s) {
  dot(g, '#4e342e', x - s * 0.35, y - s * 0.15, s * 0.1);
  dot(g, '#4e342e', x + s * 0.35, y - s * 0.15, s * 0.1);
  g.save();
  g.strokeStyle = '#4e342e';
  g.lineWidth = s * 0.09;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y + s * 0.02, s * 0.36, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.restore();
}

export const PICTURES = {
  dino: {
    name: 'a dinosaur', aspect: 1.4,
    draw(g) {
      poly(g, '#43a047', 0.4, 0.58, 0.02, 0.8, 0.42, 0.72);
      for (const x of [0.48, 0.62, 0.8, 0.94]) poly(g, '#388e3c', x, 0.66, x + 0.09, 0.66, x + 0.09, 0.95, x, 0.95);
      oval(g, '#66bb6a', 0.72, 0.6, 0.36, 0.22);
      poly(g, '#66bb6a', 0.86, 0.5, 1.1, 0.16, 1.2, 0.2, 1.02, 0.58);
      oval(g, '#66bb6a', 1.2, 0.17, 0.14, 0.09);
      for (const [x, y, r] of [[0.6, 0.52, 0.05], [0.76, 0.48, 0.04], [0.72, 0.64, 0.05]]) dot(g, '#a5d6a7', x, y, r);
      dot(g, '#1b1b1b', 1.24, 0.14, 0.025);
    },
  },
  rocket: {
    name: 'a rocket', aspect: 0.75,
    draw(g) {
      poly(g, '#ffb300', 0.27, 0.76, 0.375, 0.99, 0.48, 0.76);
      poly(g, '#e53935', 0.2, 0.5, 0.04, 0.84, 0.22, 0.76);
      poly(g, '#e53935', 0.55, 0.5, 0.71, 0.84, 0.53, 0.76);
      shape(g, '#eceff1', () => {
        g.moveTo(0.375, 0.02);
        g.quadraticCurveTo(0.6, 0.25, 0.55, 0.78);
        g.lineTo(0.2, 0.78);
        g.quadraticCurveTo(0.15, 0.25, 0.375, 0.02);
      });
      shape(g, '#e53935', () => {
        g.moveTo(0.375, 0.02);
        g.quadraticCurveTo(0.49, 0.12, 0.53, 0.22);
        g.lineTo(0.22, 0.22);
        g.quadraticCurveTo(0.26, 0.12, 0.375, 0.02);
      });
      circle(g, '#4fc3f7', 0.375, 0.42, 0.09);
    },
  },
  heart: {
    name: 'a big heart', aspect: 1.1,
    draw(g) {
      shape(g, '#e53935', () => {
        g.moveTo(0.55, 0.28);
        g.bezierCurveTo(0.55, 0.02, 0.05, 0.02, 0.05, 0.32);
        g.bezierCurveTo(0.05, 0.6, 0.55, 0.8, 0.55, 0.98);
        g.bezierCurveTo(0.55, 0.8, 1.05, 0.6, 1.05, 0.32);
        g.bezierCurveTo(1.05, 0.02, 0.55, 0.02, 0.55, 0.28);
      });
      oval(g, '#ef9a9a', 0.3, 0.26, 0.1, 0.06, -0.6);
    },
  },
  sun: {
    name: 'the sun', aspect: 1,
    draw(g) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const b = a + 0.18;
        const c = a - 0.18;
        poly(g, '#ffa000', 0.5 + Math.cos(a) * 0.49, 0.5 + Math.sin(a) * 0.49, 0.5 + Math.cos(b) * 0.3, 0.5 + Math.sin(b) * 0.3, 0.5 + Math.cos(c) * 0.3, 0.5 + Math.sin(c) * 0.3);
      }
      circle(g, '#ffeb3b', 0.5, 0.5, 0.31);
      face(g, 0.5, 0.5, 0.3);
    },
  },
  fish: {
    name: 'a fishy', aspect: 1.4,
    draw(g) {
      poly(g, '#ff7043', 0.3, 0.5, 0.02, 0.22, 0.02, 0.78);
      oval(g, '#ff9800', 0.68, 0.5, 0.42, 0.28);
      poly(g, '#ff7043', 0.6, 0.24, 0.8, 0.06, 0.82, 0.26);
      line(g, '#fff3e0', 0.05, 0.55, 0.28, 0.55, 0.72);
      line(g, '#fff3e0', 0.05, 0.75, 0.24, 0.75, 0.76);
      circle(g, '#ffffff', 0.95, 0.42, 0.07);
      dot(g, '#1b1b1b', 0.97, 0.42, 0.035);
      for (const [x, y, r] of [[1.22, 0.3, 0.04], [1.3, 0.16, 0.05], [1.34, 0.03, 0.03]]) circle(g, '#b3e5fc', x, y, r);
    },
  },
  car: {
    name: 'a car', aspect: 1.5,
    draw(g) {
      poly(g, '#e53935', 0.38, 0.22, 1.02, 0.22, 1.16, 0.48, 0.24, 0.48);
      poly(g, '#e53935', 0.04, 0.46, 1.46, 0.46, 1.46, 0.76, 0.04, 0.76);
      poly(g, '#81d4fa', 0.42, 0.28, 0.66, 0.28, 0.66, 0.45, 0.33, 0.45);
      poly(g, '#81d4fa', 0.74, 0.28, 0.98, 0.28, 1.08, 0.45, 0.74, 0.45);
      dot(g, '#fff59d', 1.4, 0.55, 0.04);
      for (const x of [0.38, 1.12]) {
        circle(g, '#212121', x, 0.78, 0.16);
        dot(g, '#bdbdbd', x, 0.78, 0.06);
      }
    },
  },
  cat: {
    name: 'a kitty', aspect: 1,
    draw(g) {
      poly(g, '#ff9800', 0.16, 0.38, 0.14, 0.02, 0.42, 0.22);
      poly(g, '#ff9800', 0.84, 0.38, 0.86, 0.02, 0.58, 0.22);
      circle(g, '#ffa726', 0.5, 0.56, 0.4);
      oval(g, '#c6ff00', 0.34, 0.48, 0.07, 0.09);
      oval(g, '#c6ff00', 0.66, 0.48, 0.07, 0.09);
      dot(g, '#1b1b1b', 0.34, 0.49, 0.035);
      dot(g, '#1b1b1b', 0.66, 0.49, 0.035);
      poly(g, '#f48fb1', 0.45, 0.62, 0.55, 0.62, 0.5, 0.69);
      for (const s of [-1, 1]) {
        line(g, '#4e342e', 0.02, 0.5 + s * 0.12, 0.68, 0.5 + s * 0.4, 0.62);
        line(g, '#4e342e', 0.02, 0.5 + s * 0.12, 0.72, 0.5 + s * 0.4, 0.76);
      }
    },
  },
  butterfly: {
    name: 'a butterfly', aspect: 1.3,
    draw(g) {
      oval(g, '#ab47bc', 0.38, 0.34, 0.28, 0.24, -0.4);
      oval(g, '#ab47bc', 0.92, 0.34, 0.28, 0.24, 0.4);
      oval(g, '#f06292', 0.44, 0.74, 0.2, 0.17, 0.4);
      oval(g, '#f06292', 0.86, 0.74, 0.2, 0.17, -0.4);
      for (const [x, y] of [[0.36, 0.32], [0.94, 0.32], [0.44, 0.74], [0.86, 0.74]]) dot(g, '#fff176', x, y, 0.06);
      oval(g, '#4e342e', 0.65, 0.54, 0.05, 0.36);
      line(g, '#4e342e', 0.025, 0.63, 0.2, 0.52, 0.03);
      line(g, '#4e342e', 0.025, 0.67, 0.2, 0.78, 0.03);
    },
  },
  rainbow: {
    name: 'a rainbow', aspect: 1.6,
    draw(g) {
      const colors = ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'];
      colors.forEach((c, i) => {
        const r = 0.76 - i * 0.08;
        shape(g, c, () => {
          g.arc(0.8, 0.92, r, Math.PI, 0);
          g.arc(0.8, 0.92, r - 0.08, 0, Math.PI, true);
          g.closePath();
        });
      });
      for (const x of [0.14, 1.46]) {
        circle(g, '#ffffff', x - 0.08, 0.9, 0.08);
        circle(g, '#ffffff', x + 0.06, 0.88, 0.1);
      }
    },
  },
  moon: {
    name: 'the moon', aspect: 1,
    draw(g) {
      g.save();
      g.beginPath();
      g.arc(0.46, 0.52, 0.42, 0, TAU);
      g.clip();
      g.beginPath();
      g.arc(0.46, 0.52, 0.42, 0, TAU);
      g.arc(0.66, 0.4, 0.34, 0, TAU);
      g.fillStyle = '#ffee58';
      g.fill('evenodd');
      g.restore();
      g.beginPath();
      g.arc(0.46, 0.52, 0.42, 0.38 * Math.PI, 1.86 * Math.PI);
      g.stroke();
      for (const [x, y, r] of [[0.84, 0.82, 0.07], [0.9, 0.12, 0.05], [0.66, 0.9, 0.04]]) circle(g, '#fff59d', x, y, r);
    },
  },
  icecream: {
    name: 'an ice cream', aspect: 0.8,
    draw(g) {
      poly(g, '#d7a35a', 0.14, 0.52, 0.66, 0.52, 0.4, 0.99);
      line(g, '#a1712f', 0.025, 0.24, 0.6, 0.48, 0.88);
      line(g, '#a1712f', 0.025, 0.56, 0.6, 0.32, 0.88);
      circle(g, '#80cbc4', 0.24, 0.46, 0.15);
      circle(g, '#f48fb1', 0.56, 0.46, 0.15);
      circle(g, '#fff9c4', 0.4, 0.3, 0.18);
      circle(g, '#e53935', 0.42, 0.1, 0.06);
    },
  },
  flower: {
    name: 'a flower', aspect: 1,
    draw(g) {
      poly(g, '#43a047', 0.47, 0.6, 0.53, 0.6, 0.53, 0.99, 0.47, 0.99);
      oval(g, '#66bb6a', 0.66, 0.82, 0.14, 0.06, -0.5);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        circle(g, '#f06292', 0.5 + Math.cos(a) * 0.22, 0.38 + Math.sin(a) * 0.22, 0.14);
      }
      circle(g, '#ffeb3b', 0.5, 0.38, 0.13);
      face(g, 0.5, 0.38, 0.12);
    },
  },
  star: {
    name: 'a star', aspect: 1.05,
    draw(g) {
      shape(g, '#ffd54f', () => {
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 0.5 : 0.22;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const x = 0.525 + Math.cos(a) * r;
          const y = 0.55 + Math.sin(a) * r;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
      });
      face(g, 0.525, 0.56, 0.16);
    },
  },
};

// Each world has its own favorites.
export const THEME_PICTURES = {
  day: ['sun', 'dino', 'flower', 'car', 'butterfly', 'cat'],
  sunset: ['fish', 'heart', 'dino', 'car', 'flower'],
  night: ['moon', 'cat', 'rocket', 'star'],
  candy: ['icecream', 'heart', 'rainbow', 'butterfly'],
  moon: ['rocket', 'moon', 'star', 'dino'],
};

// Draw a picture centered in the box (x, y, w, h), keeping its proportions.
export function drawPicture(g, id, x, y, w, h) {
  const p = PICTURES[id];
  if (!p) return;
  const s = Math.min(h, w / p.aspect);
  g.save();
  g.translate(x + (w - s * p.aspect) / 2, y + (h - s) / 2);
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 0.035;
  g.strokeStyle = '#ffffff';
  p.draw(g);
  g.restore();
}
