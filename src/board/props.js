import * as T from 'three';
import { batch, beam, box, group, lantern, paint } from './art.js';
import { LAND } from './locations.js';

export const rainbow = {
  red_wool: 0xf16958, orange_wool: 0xffa555, yellow_wool: 0xf0ce62, green_wool: 0xa7d974,
  light_blue_wool: 0x8bdade, blue_wool: 0x719afb, purple_wool: 0xcb93ed,
};

function chest(prop, large) {
  const width = large ? 1.67 : .93;
  const y = large ? .57 : .36;
  const edge = 0xb78857;
  box(prop, 0, y * .49, 0, width, y, width * .62, large ? 0x826042 : 0x9c754d);
  for (const sign of [-1, 1]) {
    box(prop, sign * width * .36, y * .49, width * .319, width * .10, y, .055, edge);
    box(prop, 0, sign > 0 ? y * .91 : .09, width * .326, width * 1.03, .086, .043, edge);
  }
  box(prop, 0, y * .73, width * .34, .154, .138, .073, 0xe6bf66);
  batch(prop);
  const lid = group(prop, 0, y, -width * .32);
  box(lid, 0, .09, width * .32, width * 1.03, .19, width * .66, edge);
  box(lid, 0, .178, width * .32, width * .89, .046, width * .49, 0xad8a5b);
  batch(lid);
  return t => { lid.rotation.x = -Math.min(1.30, t * 3.5); };
}

function book(prop, crystal) {
  box(prop, 0, .13, 0, .95, .26, .56, 0x795a4d);
  if (crystal) {
    for (const sign of [-1, 0, 1]) {
      box(prop, sign * .30, .43 + .07 * (1 - Math.abs(sign)), -.07, .25, .44 + .12 * (1 - Math.abs(sign)), .23,
        sign ? 0xe7af62 : 0xffda89, false).rotation.z = sign * -.38;
    }
  } else {
    for (const sign of [-1, 1]) {
      const leaf = box(prop, sign * .23, .34, .02, .43, .097, .58, 0xd3c99a);
      leaf.rotation.z = sign * .23;
      for (let i = 0; i < 3; i++) box(prop, sign * .22, .398, -.11 + i * .1, .21, .022, .026, 0x8a745f);
    }
  }
  batch(prop);
}

function food(prop, bread) {
  box(prop, 0, .16, 0, 1.11, .25, .72, 0x846344);
  for (const x of [-.28, 0, .27]) {
    const loaf = box(prop, x, .38, 0, .27, .21, .37, bread ? 0xd9ad5f : 0xa85f43);
    loaf.rotation.y = x * 1.6;
    box(prop, x, .491, 0, .047, .03, .27, bread ? 0xf3d597 : 0xffd17c).rotation.y = x * 1.6;
  }
  batch(prop);
}

function foundation(prop) {
  for (let i = 0; i < 11; i++) {
    const row = Math.floor(i / 4), column = i % 4;
    box(prop, (column - 1.5) * .31 + row * .095, .09 + row * .18, 0,
      .28, .17, .46, [0x77676b, 0x87746a, 0x917b6d][i % 3]);
  }
  batch(prop);
}

function arch(prop) {
  for (const [i, color] of Object.values(rainbow).entries()) {
    prop.add(new T.Mesh(new T.TorusGeometry(3.5 - i * .18, .078, 5, 30, Math.PI), paint(color, false)));
  }
  return t => { prop.rotation.y = .12 * Math.sin(t * 2); };
}

function column(prop) {
  for (const i of [0, 1, 2]) box(prop, 0, 2.9, 0, .12 + i * .155, 5.8 - i * .28, .12 + i * .155,
    [0xfff2bd, 0xf0cc87, 0xbba374][i], false);
}

const build = {
  supply: prop => chest(prop, false), treasure: prop => chest(prop, true),
  book: prop => book(prop, false), crystal: prop => book(prop, true),
  bread: prop => food(prop, true), meal: prop => food(prop, false), foundation,
  lantern: prop => { lantern(prop, 0, .54, 0, 1.05); batch(prop); },
  rainbow: arch, column,
};

export class SceneProps {
  constructor(parent) {
    this.parent = parent;
    this.items = [];
    this.flights = [];
    this.time = -Infinity;
  }

  clear() {
    for (const entry of [...this.items, ...this.flights]) {
      entry.until = -Infinity;
      entry.model.visible = false;
    }
  }

  show(kind, at, now, life = 1.65) {
    let entry = this.items.find(item => item.kind === kind && item.until <= this.time);
    if (!entry) {
      const model = group(this.parent);
      entry = { kind, model, animate: build[kind](model) };
      model.visible = false;
      this.items.push(entry);
    }
    Object.assign(entry, { at, now, until: now + life, life });
  }

  fly(from, to, now, color, life = .60, arc = .32) {
    let flight = this.flights.find(item => item.until <= this.time && item.color === color);
    if (!flight) {
      const model = group(this.parent);
      beam(model, [0, 0, -.3], [0, 0, .3], .085, .085, color);
      box(model, 0, 0, .36, .14, .14, .17, color, false).rotation.z = .72;
      model.visible = false;
      flight = { model, color };
      this.flights.push(flight);
    }
    Object.assign(flight, { from, to, now, until: now + life, life, arc });
  }

  frame(now, view, reduced) {
    this.time = now;
    for (const { at, now: start, until, life, model, animate } of this.items) {
      if (until === -Infinity) continue;
      const below = at[1] < LAND.slice;
      const t = (now - start) / life;
      model.visible = t >= 0 && now < until && (view === 'all' || below === (view === 'underground'));
      if (!model.visible) continue;
      const reveal = reduced ? 1 : Math.min(1, t * 8, (1 - t) * 5.4);
      model.position.set(...at);
      model.scale.set(.82 + .18 * reveal, Math.max(.04, reveal), .82 + .18 * reveal);
      animate?.(t);
    }
    for (const { from, to, now: start, until, life, model, arc } of this.flights) {
      if (until === -Infinity) continue;
      const t = (now - start) / life;
      const y = T.MathUtils.lerp(from[1], to[1], t) + arc * 4 * t * (1 - t);
      model.visible = !reduced && t >= 0 && now < until && (view === 'all' || (y < LAND.slice) === (view === 'underground'));
      if (!model.visible) continue;
      const x = T.MathUtils.lerp(from[0], to[0], t);
      const z = T.MathUtils.lerp(from[2], to[2], t);
      model.position.set(x, y, z);
      model.lookAt(x + to[0] - from[0], y + to[1] - from[1] + arc * (4 - 8 * t), z + to[2] - from[2]);
    }
  }
}
