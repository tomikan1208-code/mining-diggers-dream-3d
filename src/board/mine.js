import { MathUtils } from 'three';
import { batch, beam, box, group, lantern, rng, round, TEAM } from './art.js';
import { GOAL } from '../game-data.js';
import { LAND, SHAFT, rampY } from './locations.js';

const { floor: FLOOR, track: TRACK, cell: CELL, first: FIRST } = SHAFT;
const timber = 0x76563f;
const endGrain = 0xb18759;

export function mineFace(sign, mining) {
  return sign * (FIRST - CELL * Math.min(GOAL, mining));
}

function rails(parent, from, to, sleepers) {
  const [a, low] = from;
  const [b, high] = to;
  for (const side of [-1, 1]) {
    const z = TRACK + side * .29;
    beam(parent, [a, low + .144, z], [b, high + .144, z], .081, .070, 0xaaa093);
  }
  for (let i = 0; i < sleepers; i++) {
    const u = (i + .5) / sleepers;
    box(parent, a + (b - a) * u, low + .035 + (high - low) * u, TRACK, .13, .071, .86, 0x6e5041);
  }
}

function framing(parent, x, lit = false, color = 0xffba6c) {
  const frame = group(parent, x, FLOOR, TRACK);
  for (const s of [-1, 1]) {
    box(frame, 0, 1.19, s * 1.12, .17, 2.38, .18, timber);
    box(frame, 0, .12, s * 1.12, .23, .18, .23, 0x6c625b);
    box(frame, 0, 2.24, s * 1.12, .23, .17, .145, endGrain);
    beam(frame, [0, 1.66, s * 1.12], [0, 2.43, s * .62], .15, .116, 0x94704f);
  }
  box(frame, 0, 2.48, 0, .22, .19, 2.52, endGrain);
  if (lit) lantern(frame, .10, 1.94, .93, 1, color);
}

function portal(parent, sign, index) {
  const color = TEAM[index];
  const gate = group(parent, sign * SHAFT.portal, rampY(SHAFT.portal) - .12, TRACK);
  gate.rotation.y = Math.PI * .5;
  for (const x of [-1.03, 1.03]) {
    box(gate, x, .68, 0, .24, 1.91, .31, timber);
    box(gate, x, .19, 0, .35, .26, .42, 0x746562);
    beam(gate, [x, 1.08, 0], [x * .56, 1.65, 0], .171, .31, endGrain);
  }
  box(gate, 0, 1.67, 0, 2.43, .23, .46, endGrain);
  box(gate, 0, 1.845, 0, 2.62, .135, .68, color.dark);
  box(gate, 0, 1.925, 0, 2.23, .095, .63, color.cloth);
  box(gate, 0, 1.644, sign * .25, .56, .21, .09, color.light);
  lantern(gate, -.78, 1.34, .23, .86);
  return gate;
}

function cart(parent, team) {
  const trolley = group(parent, 0, FLOOR + .13, TRACK);
  for (const side of [-1, 1]) for (const on of [-1, 1]) {
    round(trolley, side * .36, .185, on * .32, .159, .091, 0x414248).rotation.x = Math.PI * .5;
    box(trolley, side * .36, .187, on * .369, .076, .075, .047, 0x807678);
  }
  box(trolley, 0, .29, 0, 1.04, .14, .70, 0x51494c);
  box(trolley, 0, .40, 0, .92, .17, .68, 0x403a3e);
  for (const z of [-.36, .36]) {
    box(trolley, 0, .50, z, 1.04, .267, .091, team.dark);
    box(trolley, 0, .64, z, 1.10, .076, .11, team.light);
  }
  for (const x of [-.51, .51]) {
    box(trolley, x, .49, 0, .092, .277, .79, team.cloth);
    box(trolley, x, .638, 0, .126, .073, .84, team.light);
  }
  box(trolley, -.17, .48, 0, .26, .17, .32, 0x36333a).rotation.y = .15;
  box(trolley, .11, .54, .09, .39, .20, .28, 0x656064).rotation.y = -.25;
  box(trolley, .30, .53, -.12, .25, .13, .31, 0x4e4549).rotation.y = .31;
  lantern(trolley, .43, .53, .48, .59);
  batch(trolley, true);
  return trolley;
}

function vein(parent, x, index) {
  const random = rng(45 + index * 32);
  for (let i = 0; i < 7; i++) {
    const size = .075 + random() * .159;
    const piece = box(parent, x - .29 + random() * .58, FLOOR + .67 + random() * 1.12,
      SHAFT.back + .13 + random() * .095, size, size * .75, .17,
      index % 2 ? [0x65575b, 0x4d4854, 0x2e2c33][i % 3] : [0xac8e6e, 0x907765, 0x80695f][i % 3]);
    piece.rotation.z = random() * .7;
  }
}

function drillRig(parent) {
  const frame = group(parent, 0, FLOOR + .11, TRACK);
  box(frame, 0, .36, 0, 1.54, .46, 1.03, 0x544a4b);
  box(frame, .18, .69, 0, .86, .48, .91, 0xb38a51);
  for (const side of [-1, 1]) {
    box(frame, 0, .16, side * .55, 1.44, .32, .28, 0x514548);
    lantern(frame, -.25, .81, side * .46, .72, 0x89e4dc);
  }
  batch(frame);
  const head = group(frame, -.66, .58, 0);
  for (let i = 0; i < 6; i++) {
    const bit = group(head, -.13 * i);
    bit.rotation.x = i * .64;
    const width = .78 - i * .10;
    box(bit, 0, 0, 0, .14, width, width, i % 2 ? 0x9c9b9b : 0xc3b3a4);
  }
  batch(head);
  frame.visible = false;
  return { frame, head };
}

export function buildMine(parent, surface, index, getRock) {
  const sign = index === 0 ? -1 : 1;
  const fixtures = group(parent);
  const slope = group(surface);
  portal(slope, sign, index);
  const breakAt = LAND.slice + .08;
  const cut = [sign * (SHAFT.startRamp + (breakAt - FLOOR) / SHAFT.grade), breakAt];
  const lip = SHAFT.portal + .05;
  rails(slope, cut, [sign * lip, rampY(lip)], 8);
  batch(slope, true);
  rails(fixtures, [sign * SHAFT.startRamp, FLOOR], cut, 10);
  rails(fixtures, [sign * SHAFT.startRamp, FLOOR], [sign * FIRST, FLOOR], 14);
  box(fixtures, sign * ((SHAFT.startRamp + FIRST) / 2), FLOOR + .026, TRACK,
    SHAFT.startRamp - FIRST, .052, 2.96, 0x524449);
  framing(fixtures, sign * 19.37, true);
  framing(fixtures, sign * 17.48, true, 0xffbf75);
  vein(fixtures, sign * 18.35, index);
  batch(fixtures);
  const trolleys = Array.from({ length: 3 }, () => cart(parent, TEAM[index]));
  const drill = drillRig(parent);
  const sections = [];
  for (let n = 0; n < GOAL; n++) {
    const x = mineFace(sign, n + .5);
    const cut = group(parent);
    box(cut, x, FLOOR + .021, TRACK, CELL, .033, 2.96, n % 2 === 0 ? 0x54494a : 0x4d4347);
    rails(cut, [x - CELL / 2, FLOOR], [x + CELL / 2, FLOOR], 2);
    if (n % 2 === 0) framing(cut, x, true);
    if (n % 2 === 0) vein(cut, x, n + index);
    batch(cut);
    const name = 'Bedrock_' + index + '_' + n;
    const rock = getRock(name);
    parent.add(rock);
    const rubble = group(parent, x, FLOOR, LAND.front + .065);
    const chips = rng(n * 149 + 750);
    for (let k = 0; k < 7; k++) {
      const chip = box(rubble, (chips() - .5) * .85, .12 + chips() * .44, chips() * .18,
        .19 + chips() * .30, .15 + chips() * .29, .18 + chips() * .29, [0x625056, 0x786368, 0x4b4047][k % 3]);
      chip.rotation.set(chips() * .75, chips() * 2, chips() * 1.1);
    }
    batch(rubble);
    rubble.visible = false;
    sections.push({ cut, rock, rubble, name, part: index * GOAL + n, changed: -Infinity, blocked: false });
  }
  const mine = { trolleys, drill, sections, sign, rails: 0 };
  resetMine(mine, 0);
  return mine;
}

export function resetMine(mine, count) {
  Object.assign(mine, { count, goal: count, queue: [], active: null });
  for (const section of mine.sections) {
    section.changed = -Infinity;
    section.blocked = false;
  }
  for (const [i, trolley] of mine.trolleys.entries()) {
    trolley.position.x = mine.sign * (SHAFT.startRamp - .74 - i * 1.2);
    trolley.visible = i === 0;
  }
  mine.drill.frame.visible = false;
}

export function planMine(mine, to, now, style = 'dig', tool) {
  if (to === mine.goal && style !== 'blast') return;
  mine.queue.push({ to, at: now, style, tool });
  mine.goal = to;
}

const delay = {
  blast: .64, charge: .56, drill: .42, cart: .60, hatch: .71,
  dig: .48, diamond: .43, gold: .46, arcane: .25, swap: .25, burn: .34, edit: .06,
};
const simultaneous = new Set(['blast', 'charge', 'hatch', 'swap', 'burn', 'edit']);

// Each queue entry owns a complete transition, so a second card can arrive while a mine is still clearing.
export function updateMine(mine, now, dt, fx, paint, mode, reduced) {
  if (!mine.active && mine.queue[0]?.at <= now) {
    const action = mine.queue.shift();
    mine.active = { ...action, from: mine.count, next: now + delay[action.style] * (reduced ? .16 : 1) };
  }
  const active = mine.active;
  if (active && now >= active.next) {
    const { from, to, style } = active;
    const isBatch = simultaneous.has(style);
    const next = isBatch ? to : mine.count + Math.sign(to - mine.count);
    const open = next > mine.count;
    if (style === 'blast') fx.collapse(mine, from, to, now, reduced);
    for (let i = Math.min(next, mine.count); i < Math.max(next, mine.count); i++) {
      const section = mine.sections[i];
      section.changed = style === 'edit' ? -Infinity : now;
      section.blocked = !open && style !== 'edit';
      if (style === 'blast' || style === 'edit') continue;
      const x = mineFace(mine.sign, i + .51);
      const at = [x, FLOOR + .84, TRACK + .61];
      const accent = { diamond: 0x6be1dc, gold: 0xeac36d, arcane: 0xc399f3, hatch: 0xb16ee5, swap: 0xebbd7a }[style];
      fx.burst(at, now, ['charge', 'burn'].includes(style) ? 'red' : 'stone',
        reduced ? 3 : isBatch ? 6 : 12, accent);
      if (accent || style === 'charge' || style === 'burn') {
        fx.glow([x, FLOOR + 1.03, LAND.front + .12], now, accent ?? 0xff6c36, isBatch ? 1.64 : 1.1, .41);
      }
    }
    mine.count = next;
    active.next = now + (reduced ? .02 : ['drill', 'diamond'].includes(style) ? .12 : .20);
    if (next === to) mine.active = null;
  }

  for (const [i, section] of mine.sections.entries()) {
    const open = i < mine.count;
    const elapsed = reduced ? 1 : Math.min(1, Math.max(0, (now - section.changed) / (open ? .63 : .59)));
    section.cut.visible = open;
    section.rock.visible = mode === 'polygon' && !open;
    section.rock.position.y = open ? 0 : 1.16 * (1 - elapsed ** 2);
    section.rubble.visible = section.blocked && !open;
    section.rubble.position.y = FLOOR + .57 * (1 - elapsed ** 2);
    paint[section.part] = open ? elapsed : elapsed ** 2 - 1;
  }

  const start = SHAFT.startRamp - .74;
  const end = Math.max(Math.abs(mineFace(mine.sign, mine.count)) + .85, 2.6);
  const { frame, head } = mine.drill;
  frame.visible = active?.style === 'drill';
  if (frame.visible) {
    frame.position.x = MathUtils.damp(frame.position.x, mine.sign * (end + .55), 13, dt);
    frame.rotation.y = mine.sign > 0 ? 0 : Math.PI;
    head.rotation.x = reduced ? 0 : now * 29;
  } else frame.position.x = mine.sign * (end + .55);
  for (const [i, trolley] of mine.trolleys.entries()) {
    trolley.visible = i <= Math.min(2, mine.rails);
    if (!trolley.visible) continue;
    const moving = active?.style === 'cart';
    const target = moving ? end + i * .72 : start - i * 1.06;
    const safe = Math.max(end, target);
    trolley.position.x = reduced ? mine.sign * safe : MathUtils.damp(trolley.position.x, mine.sign * safe, moving ? 7 : 3, dt);
  }
}
