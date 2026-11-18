import * as T from 'three';
import { batch, box, group, paint, rng } from './art.js';
import { ABYSS, LAND, SHAFT } from './locations.js';

const violet = 0xd08ce8;

export class Abyss {
  constructor(parent, seal, fx) {
    this.seal = seal;
    this.fx = fx;
    this.egg = group(parent, ABYSS.x, ABYSS.y + .68, ABYSS.z);
    const shell = new T.Mesh(new T.IcosahedronGeometry(.66, 1), paint(0x3a2549));
    shell.scale.set(.87, 1.24, .81);
    this.egg.add(shell);
    const random = rng(24563);
    for (let i = 0; i < 19; i++) {
      const yaw = random() * Math.PI * 2;
      const t = random() - .5;
      const radius = Math.sqrt(1 - t * t);
      const fleck = box(this.egg, Math.cos(yaw) * radius * .52, t * 1.28, Math.sin(yaw) * radius * .54,
        .082, .06 + random() * .13, .061, i % 3 ? 0x8652a6 : 0xb876c6, false);
      fleck.rotation.y = -yaw;
    }
    batch(this.egg);

    this.dragon = group(parent);
    box(this.dragon, 0, .1, 0, .59, .55, 1.66, 0x322940);
    box(this.dragon, 0, .44, .79, .48, .38, .54, 0x46334f);
    box(this.dragon, 0, .53, 1.13, .53, .40, .54, 0x322940);
    box(this.dragon, 0, .46, 1.44, .43, .23, .31, 0x44334d);
    for (const side of [-1, 1]) {
      box(this.dragon, side * .278, .59, 1.22, .05, .09, .17, violet, false);
      box(this.dragon, side * .19, .77, 1.03, .09, .24, .10, 0x80708f).rotation.x = -.37;
    }
    for (let i = 0; i < 6; i++) {
      box(this.dragon, 0, .31, .58 - i * .35, .11, .23 - i * .025, .22, 0x6b4c80);
      if (i > 2) box(this.dragon, 0, .08 + .035 * (i - 3), .35 - i * .43, .54 - .066 * i, .21, .58, 0x322940);
    }
    batch(this.dragon);
    this.wings = [-1, 1].map(side => {
      const wing = group(this.dragon, side * .25, .28, .32);
      for (let i = 0; i < 7; i++) {
        box(wing, side * (.18 + i * .22), 0, -.095 * i, .29, .072, 1.31 - i * .14,
          i % 3 ? 0x6b4b79 : 0x473950);
      }
      batch(wing);
      return wing;
    });
    this.reset();
  }

  reset() {
    this.open = false;
    this.openAt = this.wakeAt = this.hatchAt = -Infinity;
    this.egg.visible = this.dragon.visible = false;
    this.seal.mesh.position.y = 0;
    this.seal.shown = true;
  }

  wake(now, initial = false) {
    if (!this.open) this.openAt = now - (initial ? 2 : 0);
    this.open = true;
    this.wakeAt = now;
    if (initial) return;
    const at = [ABYSS.x, ABYSS.y + 1.18, LAND.front + .16];
    this.fx.glow(at, now + .18, violet, 3.1, .76, 2.1);
    for (let i = 0; i < 5; i++) {
      this.fx.cloud([(i - 2) * 3.0, ABYSS.y + .63, LAND.front + .08], now + i * .07,
        { color: 0x686071, size: 1.9, rise: .57, drift: (i - 2) * .45, life: 1.42 });
    }
  }

  hatch(now) {
    if (!this.open) this.wake(now);
    this.hatchAt = now + .55;
    this.fx.glow([ABYSS.x, ABYSS.y + 1, LAND.front + .45], this.hatchAt, 0xe5b0fc, 4.5, .68);
    this.fx.burst([ABYSS.x, ABYSS.y + .64, LAND.front + .27], this.hatchAt, 'stone', 30, violet);
    for (const sign of [-1, 1]) for (let i = 0; i < 10; i++) {
      const x = sign * (1.7 + i * 1.85);
      const at = [x, SHAFT.floor + 1.52, LAND.front + .35];
      this.fx.glow(at, this.hatchAt + .045 * i, 0xc477e5, 2.39, .47, 1.55);
    }
  }

  frame(now, active, reduced) {
    const reveal = this.open ? T.MathUtils.clamp((now - this.openAt) / (reduced ? .08 : .63), 0, 1) : 0;
    this.seal.shown = reveal < 1;
    this.seal.mesh.position.y = -4.2 * reveal ** 2;
    const hatching = Number.isFinite(this.hatchAt) && now < this.hatchAt;
    const eggTime = now - this.wakeAt;
    this.egg.visible = this.open && reveal > .52 && (active || hatching);
    this.egg.rotation.z = reduced ? 0 : Math.sin(now * (hatching ? 23 : 9)) * (hatching ? .19 : Math.max(0, .09 - eggTime * .026));
    const flight = (now - this.hatchAt) / (reduced ? .55 : 1.85);
    this.dragon.visible = flight >= 0 && flight < 1;
    if (this.dragon.visible) {
      this.dragon.position.set(ABYSS.x + flight ** 2 * 3.4, ABYSS.y + .67 + 4.2 * flight, ABYSS.z + .92 + flight * 2.7);
      this.dragon.rotation.y = .51 + flight * .76;
      this.dragon.scale.setScalar(.68 + .50 * Math.sin(flight * Math.PI));
      for (const [i, wing] of this.wings.entries()) wing.rotation.z = (i === 0 ? -1 : 1) * Math.sin(flight * 27) * .77;
    }
  }
}
