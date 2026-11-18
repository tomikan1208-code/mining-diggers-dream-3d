import { rng } from './art.js';

const palettes = [
  [0,    0x435e69, 0xc3ad88, 0x859184, 0x596e62, 0x354d45, 0xffdfa3],
  [0.43, 0x477886, 0xb8c4a0, 0x839b8a, 0x5a7969, 0x3d6155, 0xffedbd],
  [0.79, 0x505366, 0xd5a272, 0x9f817d, 0x6d5c64, 0x4c484e, 0xffc181],
  [1,    0x141e34, 0x46546c, 0x43516a, 0x293d51, 0x202c3b, 0xd2e0df],
];

function rgb(a, b, t) {
  const mix = shift => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return 'rgb(' + [mix(16), mix(8), mix(0)].join(',') + ')';
}

function ridge(height, offset, span, peaks) {
  return x => {
    let y = height + Math.sin(x / span + offset) * 14 + Math.cos(x * .019 + offset) * 12;
    for (const [at, width, rise] of peaks) y -= Math.max(0, 1 - Math.abs(x - at) / width) * rise;
    return Math.round(y / 3) * 3;
  };
}

const layers = [
  ridge(267, .5, 43, [[61, 81, 50], [199, 94, 46], [502, 118, 50], [590, 101, 39]]),
  ridge(295, 2.8, 50, [[74, 124, 49], [332, 104, 49], [568, 121, 70]]),
  ridge(331, 3.1, 73, [[-8, 120, 29], [197, 169, 31], [660, 193, 54]]),
];

const random = rng(99184);
const stars = Array.from({ length: 75 }, () => [random() * 640, random() * 206, random()]);

export function orbitPoint(orbit, opposite = false) {
  const angle = 2 * Math.PI * orbit + (opposite ? Math.PI : 0);
  return [320 + Math.cos(angle) * 194, 211 - Math.sin(angle) * 127];
}

function moon(ctx, cx, cy, day) {
  const age = (day % 16) / 16;
  const terminator = Math.cos(age * Math.PI * 2);
  const waning = age <= .5;
  const radius = 14;
  ctx.fillStyle = '#61748c';
  for (let dy = -radius; dy <= radius; dy++) {
    const extent = Math.floor(Math.sqrt(radius * radius - dy * dy));
    ctx.fillRect(cx - extent, cy + dy, extent * 2 + 1, 1);
    const cut = Math.round(extent * terminator);
    ctx.fillStyle = '#e4d9bd';
    if (age === 0) ctx.fillRect(cx - extent, cy + dy, extent * 2 + 1, 1);
    else if (age !== .5) {
      if (waning) ctx.fillRect(cx - extent, cy + dy, extent + cut, 1);
      else ctx.fillRect(cx - cut + 1, cy + dy, extent + cut, 1);
    }
    ctx.fillStyle = '#61748c';
  }
  for (const [x, y, size] of [[-6, -4, 4], [-3, 4, 3], [6, -5, 3], [4, 5, 4], [1, -3, 2]]) {
    const limit = Math.sqrt(radius * radius - y * y) * terminator;
    if (age === 0 || (waning ? x + size <= limit : x >= -limit)) {
      ctx.fillStyle = '#bdb4a5';
      ctx.fillRect(cx + x, cy + y, size, size - 1);
    }
  }
}

export function skyPainter(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 400;
  let previous = '';
  return (orbit, tone, day) => {
    const tick = Math.round(tone * 180);
    const position = Math.round(orbit * 360);
    const key = tick + '/' + position + '/' + day;
    if (previous === key) return;
    previous = key;
    const p = tick / 180;
    const edge = palettes.findIndex(([mark], index) => index > 0 && mark >= p);
    const a = palettes[edge - 1];
    const b = palettes[edge];
    const mix = (p - a[0]) / (b[0] - a[0]);
    const color = i => rgb(a[i], b[i], mix);
    ctx.fillStyle = color(1);
    ctx.fillRect(0, 0, 640, 400);
    for (let y = 0; y < 264; y += 8) {
      ctx.globalAlpha = Math.pow(y / 265, 1.15);
      ctx.fillStyle = color(2);
      ctx.fillRect(0, y, 640, 8);
    }
    ctx.globalAlpha = 1;
    if (p > .83) {
      ctx.fillStyle = '#d5d8c2';
      for (const [x, y, value] of stars) {
        ctx.globalAlpha = (p - .83) * 5 * (0.25 + value * .75);
        ctx.fillRect(Math.round(x), Math.round(y), value > .9 ? 2 : 1, value > .9 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
    const [sunX, sunY] = orbitPoint(orbit).map(Math.round);
    if (orbit < .53 || orbit > .99) {
      ctx.fillStyle = color(6);
      ctx.globalAlpha = 1 - .30 * Math.max(0, (p - .80) * 5);
      for (let y = -13; y <= 13; y++) {
        const w = Math.round(Math.sqrt(14 * 14 - y * y));
        ctx.fillRect(sunX - w, sunY + y, w * 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (orbit > .515 && orbit < .985) {
      const [moonX, moonY] = orbitPoint(orbit, true).map(Math.round);
      ctx.globalAlpha = Math.min(1, (orbit - .515) * 16, (.985 - orbit) * 18);
      moon(ctx, moonX, moonY, day);
      ctx.globalAlpha = 1;
    }
    const cloud = (x, y, w) => {
      ctx.fillRect(x, y, w, 4);
      ctx.fillRect(x + Math.floor(w * .21), y - 4, Math.floor(w * .58), 4);
      ctx.fillRect(x + Math.floor(w * .44), y - 8, Math.floor(w * .21), 4);
      ctx.fillRect(x + 8, y + 4, Math.floor(w * .61), 3);
    };
    ctx.fillStyle = color(6);
    ctx.globalAlpha = .24 - p * .16;
    cloud(45, 102, 83);
    cloud(316, 138, 129);
    cloud(521, 80, 69);
    cloud(546, 180, 100);
    ctx.globalAlpha = 1;
    layers.forEach((layer, i) => {
      ctx.fillStyle = color(3 + i);
      for (let x = 0; x < 640; x += 2) {
        const y = layer(x);
        ctx.fillRect(x, y, 2, 400 - y);
      }
    });
  };
}
