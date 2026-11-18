import * as T from 'three';
import { group, rng } from './art.js';
import { CAMP, LAND, roadZ, SHAFT } from './locations.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const mix = T.MathUtils.lerp;
const chipLimit = 220;
const cloudLimit = 110;
const scopeAt = ([, y]) => y < LAND.slice ? 'underground' : 'surface';

function cloudTexture(soft) {
  const canvas = document.createElement('canvas');
  const size = canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const random = rng(41422);
  const puffs = [[48, 48, 46, 1]];
  if (!soft) for (let i = 0; i < 26; i++) {
    const angle = i * 2.39996;
    const distance = Math.sqrt(random()) * 32;
    puffs.push([48 + distance * Math.cos(angle), 48 + distance * Math.sin(angle), 6 + random() * 14, .16 + random() * .38]);
  }
  for (const [x, y, radius, opacity] of puffs) {
    const ink = ctx.createRadialGradient(x, y, 0, x, y, radius);
    ink.addColorStop(0, 'rgba(255,255,255,' + opacity + ')');
    ink.addColorStop(soft ? .22 : .5, 'rgba(255,255,255,' + opacity * (soft ? .57 : .31) + ')');
    ink.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, size, size);
  }
  return new T.CanvasTexture(canvas);
}

function sprite(parent, texture, order) {
  const material = new T.SpriteMaterial({ map: texture, depthWrite: false, opacity: 0 });
  const model = new T.Sprite(material);
  model.visible = false;
  model.renderOrder = order;
  parent.add(model);
  return model;
}

export class StageEffects {
  constructor(parent, field, element) {
    this.root = group(parent);
    this.element = element;
    this.random = rng(22887);
    this.plume = cloudTexture(false);
    this.bloom = cloudTexture(true);
    this.mist = [-1, 1].flatMap(sign => Array.from({ length: 10 }, (_, i) => {
      const model = sprite(field, this.plume, 5);
      const x = 29.4 + i * .69;
      const z = roadZ(x) + .25 + (i % 3) * .96;
      model.visible = true;
      return { model, sign, x, z, phase: this.random() * 6.28 };
    }));
    this.clouds = [];
    this.chips = [];
    this.shards = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshBasicMaterial(), chipLimit);
    this.shards.count = 0;
    this.shards.frustumCulled = false;
    this.shards.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.root.add(this.shards);
    this.placement = new T.Object3D();
    this.color = new T.Color();
    this.projection = new T.Vector3();
    this.flights = [];
    this.overlay = document.createElement('div');
    this.overlay.className = 'card-flights';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.element.append(this.overlay);
    this.hand = document.getElementById('toggle-hand');
  }

  clear() {
    for (const cloud of this.clouds) cloud.model.visible = false;
    this.chips.length = 0;
    this.shards.count = 0;
    this.flights.length = 0;
    this.overlay.replaceChildren();
    this.distortion?.cancel();
  }

  cloud(at, now, options = {}) {
    const {
      color = 0x8e7974, life = 1.6, size = 1.1, width = 1, growth = 2.6, opacity = .67,
      rise = .75, drift = 0, depth = 0, glow = false, scope = scopeAt(at),
    } = options;
    let cloud = this.clouds.find(item => item.until <= now);
    if (!cloud && this.clouds.length < cloudLimit) {
      cloud = { model: sprite(this.root, this.plume, 6) };
      this.clouds.push(cloud);
    }
    if (!cloud) cloud = this.clouds.reduce((oldest, item) => oldest.until < item.until ? oldest : item);
    const { model } = cloud;
    const map = glow ? this.bloom : this.plume;
    if (model.material.map !== map) {
      model.material.map = map;
      model.material.needsUpdate = true;
    }
    model.material.color.setHex(color);
    model.material.rotation = glow ? 0 : (this.random() - .5) * 1.5;
    Object.assign(cloud, { at, now, until: now + life, life, size, growth, width, opacity, rise, drift, depth, glow, scope });
  }

  glow(at, now, color, size = 2, life = .48, width = 1) {
    this.cloud(at, now, { color, size, width, life, growth: 1.7, glow: true, rise: 0, opacity: .96 });
  }

  burst(at, now, style = 'stone', count = 12, accent) {
    const random = this.random;
    const palettes = {
      stone: [0x776465, 0x927666, 0x53464d, 0xb49877],
      red: [0xf45732, 0xf58d38, 0xffcb6c, 0x4d3839, 0xa24e40],
      gold: [0xffd986, 0xdba85d, 0xffedb0],
      leaf: [0x799b58, 0x81914b, 0xa98555],
      water: [0x84c3db, 0x588aa9, 0xa9d7e0],
    };
    if (this.chips.length + count > chipLimit) this.chips.splice(0, this.chips.length + count - chipLimit);
    const colors = palettes[style];
    for (let i = 0; i < count; i++) {
      const embers = style === 'red';
      this.chips.push({
        at: [at[0] + (random() - .5) * .7, at[1] + random() * .44, at[2] + random() * .36],
        start: now, life: .43 + random() * (embers ? .94 : .53),
        vx: (random() - .5) * (embers ? 4.9 : 2.8), vy: 1.2 + random() * (embers ? 4.4 : 2.65),
        vz: .13 + random() * 1.48, spin: (random() - .5) * 9,
        size: .065 + random() ** 2 * (embers ? .27 : .21), color: accent ?? colors[i % colors.length], scope: scopeAt(at),
      });
    }
  }

  collapse(mine, from, to, now, reduced) {
    const shockX = mine.sign * (SHAFT.first - (from + to) * .5 * SHAFT.cell);
    const colors = [0x756465, 0x4d434a, 0x927574, 0x81534d];
    for (let i = to; i < from; i++) {
      const x = mine.sign * (SHAFT.first - (i + .5) * SHAFT.cell);
      const flash = [x, SHAFT.floor + 1.35, LAND.front + .18];
      this.glow(flash, now, reduced ? 0xe25e42 : 0xff4d22, reduced ? 1.42 : 2.38, .42);
      if (!reduced) this.glow([x, SHAFT.floor + 1.08, LAND.front + .24], now, 0xffbe70, 1.28, .21);
      this.burst(flash, now, 'red', reduced ? 3 : 15);
      for (let k = 0; k < 4; k++) {
        this.cloud([x + (this.random() - .5) * .64, SHAFT.floor + .59 + this.random() * 1.4, LAND.front + .34],
          now + .07 + this.random() * .16, {
            color: colors[k], life: 1.32 + this.random() * .8, size: .88 + this.random() * .45, growth: 2.9,
            rise: .46 + this.random() * .63, drift: (x - shockX) * .37 + (this.random() - .5) * .48, opacity: .74,
          });
      }
    }
    if (from === to) {
      const end = [mine.sign * (SHAFT.first + .35), SHAFT.floor + 1.25, LAND.front + .12];
      this.glow(end, now, 0xee5b38, 2.45);
      this.cloud(end, now + .14, { color: 0x6b5a61, size: 1.38, rise: .85 });
    } else {
      this.glow([shockX, SHAFT.floor + 1.55, LAND.front + .16], now, 0xec3a26, 2.3, .48, 1 + .38 * (from - to));
    }
    for (let k = 0; k < 4; k++) {
      const vent = [mine.sign * (SHAFT.portal - .67 - k * .15), .32 + k * .19, SHAFT.track + .75];
      this.cloud(vent, now + k * .065, { color: colors[k], life: 1.7, size: 1.08, growth: 2.5, rise: 2.5, drift: mine.sign });
      if (!k) this.glow(vent, now, 0xfe6537, 2.1, .42);
    }
  }

  cards(at, count, now, color, hand) {
    if (!count) return;
    this.glow(at, now, color, 1.8, .68);
    this.burst(at, now, 'gold', Math.min(22, 4 + count * 2), color);
    if (!hand) return;
    const paperCount = Math.min(count, 5);
    for (let i = 0; i < paperCount; i++) {
      const token = document.createElement('i');
      token.style.setProperty('--paper-edge', '#' + color.toString(16).padStart(6, '0'));
      this.overlay.append(token);
      this.flights.push({ at, token, start: now + i * .08, lane: i - (paperCount - 1) * .5, life: .64 });
    }
  }

  tonic(canvas, reduced) {
    if (reduced) return;
    this.distortion?.cancel();
    this.distortion = canvas.animate([
      { filter: 'none', transform: 'none' },
      { filter: 'hue-rotate(28deg) saturate(1.34)', transform: 'scale(1.026) skewX(-.6deg)' },
      { filter: 'hue-rotate(-18deg)', transform: 'scale(1.014) skewX(.42deg)' },
      { filter: 'none', transform: 'none' },
    ], { duration: 630, easing: 'ease-in-out' });
  }

  frame(now, view, camera, night, reduced) {
    for (const { model, sign, x, z, phase } of this.mist) {
      const drift = reduced ? 0 : Math.sin(now * .22 + phase);
      model.position.set(sign * (x + .54 * drift), .80 + .27 * Math.sin(phase) + .14 * drift, z);
      model.scale.set(4.1 + (x - 29) * .22, 1.45 + (x - 29) * .28, 1);
      model.material.color.setRGB(.43 - night * .19, .52 - night * .19, .49 - night * .11);
      model.material.opacity = (.18 + (x - 29) * .075) * (.94 + .06 * drift);
    }
    for (const cloud of this.clouds) {
      const { model, at, life, size, width, growth, rise, drift, depth, opacity, glow, scope } = cloud;
      const elapsed = now - cloud.now;
      model.visible = elapsed >= 0 && now < cloud.until && (view === 'all' || view === scope);
      if (!model.visible) continue;
      const t = elapsed / life;
      const swell = size * mix(.64, growth, 1 - (1 - t) ** 2);
      model.position.set(at[0] + drift * elapsed, at[1] + rise * elapsed, at[2] + depth * elapsed);
      model.scale.set(swell * width, swell * (glow ? 1 : .77), 1);
      model.material.opacity = opacity * Math.min(1, elapsed / (glow ? .06 : .17)) * (1 - t) ** (glow ? 1.1 : .84);
    }
    this.chips = this.chips.filter(chip => now < chip.start + chip.life);
    let count = 0;
    for (const chip of this.chips) {
      const { at, start, life, vx, vy, vz, size, color, scope, spin } = chip;
      const t = now - start;
      if (t < 0 || (view !== 'all' && scope !== view)) continue;
      const object = this.placement;
      object.position.set(at[0] + t * vx, at[1] + t * vy - 4.4 * t * t, at[2] + t * vz);
      object.scale.setScalar(size * (1 - .87 * t / life));
      object.rotation.set(t * spin, t * 2, t * 5);
      object.updateMatrix();
      this.shards.setMatrixAt(count, object.matrix);
      this.shards.setColorAt(count++, this.color.setHex(color));
    }
    this.shards.count = count;
    this.shards.instanceMatrix.needsUpdate = true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    this.frameCards(now, view, camera);
  }

  frameCards(now, view, camera) {
    if (!this.flights.length) return;
    const board = this.element.getBoundingClientRect();
    const hand = this.hand.getBoundingClientRect();
    this.flights = this.flights.filter(({ at, token, start, lane, life }) => {
      const t = (now - start) / life;
      if (t >= 1 || !hand.width) {
        token.remove();
        return false;
      }
      token.hidden = t < 0;
      if (t < 0) return true;
      const [x, y, z] = at;
      const point = this.projection.set(x, view === 'underground' ? Math.min(y, SHAFT.floor + 1.9) : y, z).project(camera);
      const fromX = clamp01((point.x + 1) / 2) * board.width;
      const fromY = clamp01((1 - point.y) / 2) * board.height;
      const toX = hand.left + hand.width * .62 - board.left;
      const toY = Math.min(board.height - 7, hand.top + hand.height / 2 - board.top);
      const spread = Math.sin(Math.PI * t);
      token.style.transform = 'translate(' + (mix(fromX, toX, t) + lane * spread * 20) + 'px,' +
        (mix(fromY, toY, t ** 1.24) - 53 * spread) + 'px) rotate(' + lane * spread * 21 + 'deg) scale(' + (1 - t * .48) + ')';
      token.style.opacity = String(Math.min(1, t * 11, (1 - t) * 7));
      return true;
    });
  }
}
