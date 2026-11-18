import { MathUtils } from 'three';
import { batch, beam, box, group, lantern, round } from './art.js';
import { CAMP, groundY, rampY, SHAFT } from './locations.js';

const wood = 0x826348;
const stone = 0x70616b;
const dark = 0x4a4653;
const metal = 0xa99e92;
const brass = 0xcda557;

function base(parent, width, depth) {
  box(parent, 0, .14, 0, width, .28, depth, stone);
  box(parent, 0, .32, 0, width * .84, .10, depth * .85, metal);
}

function altar(parent) {
  base(parent, 1.8, 1.35);
  const shrine = group(parent, 0, .33);
  for (const side of [-1, 1]) {
    box(shrine, side * .62, .49, 0, .22, 1.03, .39, stone);
    lantern(shrine, side * .61, 1.12, .02, .65, 0xe5b3fe);
  }
  box(shrine, 0, .33, 0, .65, .43, .51, dark);
  box(shrine, 0, .74, 0, .43, .46, .36, 0x9774ce, false).rotation.z = Math.PI / 4;
  batch(shrine, true);
  return shrine;
}

function airship(parent) {
  const ship = group(parent);
  box(ship, 0, 0, 0, 1.29, .40, .77, wood);
  box(ship, 0, .28, 0, 1.65, .12, .93, brass);
  for (const s of [-1, 1]) {
    beam(ship, [s * .15, .12, 0], [s * 1.16, .66, 0], .11, .15, dark);
    box(ship, s * .84, .69, 0, .99, .13, .60, 0xd3d0bd);
  }
  lantern(ship, 0, -.24, .14, .59, 0xf9d78c);
  batch(ship);
  return ship;
}

function apparatus(parent) {
  base(parent, 1.75, 1.38);
  for (const side of [-1, 1]) {
    box(parent, side * .67, .99, .12, .20, 1.34, .25, dark);
    box(parent, side * .62, 1.43, .29, .24, .13, .14, 0xb076ad, false);
  }
  box(parent, 0, 1.63, .10, 1.61, .23, .52, dark);
  box(parent, 0, 1.83, .09, .90, .16, .37, metal);
  box(parent, 0, .98, -.37, 1.11, 1.27, .20, stone);
}

function stopGate(parent, color) {
  for (const z of [-.91, .91]) box(parent, 0, .57, z, .21, 1.11, .20, wood);
  box(parent, 0, .70, 0, .19, .27, 2.08, color);
  for (let k = 0; k < 6; k++) {
    box(parent, -.107, .70, (k - 2.5) * .34, .03, .22, .13, 0xf1cf94).rotation.x = -.43;
  }
}

function shelter(parent) {
  for (const side of [-1, 1]) {
    box(parent, side * .68, .74, 0, .18, 1.46, 1.26, wood);
    box(parent, side * .47, 1.51, 0, .99, .19, 1.42, dark).rotation.z = -side * .29;
  }
  box(parent, 0, .69, -.63, 1.37, 1.39, .15, wood);
  lantern(parent, 0, 1.39, .73, .56);
}

function research(parent) {
  base(parent, 2.46, 1.45);
  const frame = group(parent);
  for (const side of [-1, 1]) {
    box(frame, side * .90, .99, 0, .17, 1.45, .18, wood);
    beam(frame, [side * .89, .72, 0], [side * .36, 1.68, 0], .10, .15, wood);
  }
  box(frame, 0, 1.68, 0, 2.02, .19, .28, wood);
  batch(frame);
  const machine = group(parent, 0, .35);
  box(machine, 0, .35, 0, 1.44, .73, .84, dark);
  for (const side of [-1, 1]) {
    round(machine, side * .47, .73, 0, .24, .22, metal);
    box(machine, side * .47, .91, 0, .12, .27, .12, brass);
  }
  batch(machine);
  const light = group(parent, 0, 1.33, 0);
  box(light, 0, 0, 0, .38, .38, .38, 0x80e3c4, false).rotation.z = Math.PI / 4;
  return [frame, machine, light];
}

const treePlaces = [
  [29.5, -2.10, 1.56, -.12, 'pines'],
  [30.60, -2.75, 1.43, .19, 'pinesFar'],
  [29.4, -3.64, 1.77, -.18, 'pinesBack'],
];

export function buildEquipment(parent, sign, getModel, shoots) {
  const put = (x, z, y = groundY) => group(parent, sign * x, y, z);
  const kit = put(14.0, -1.64);
  box(kit, 0, .27, 0, .77, .54, .57, dark);
  box(kit, 0, .57, 0, .79, .13, .61, brass);
  box(kit, .10, .65, .05, .64, .079, .08, metal).rotation.y = -.44;
  const forge = put(11.67, -2.39);
  base(forge, 1.03, .72);
  box(forge, 0, .53, 0, .52, .31, .46, dark);
  box(forge, 0, .71, 0, .82, .12, .33, metal);
  lantern(forge, -.39, .56, .28, .56, 0xff9258);
  const shrine = put(3.46, -5.20);
  const crystal = altar(shrine);
  const flyAt = put(22.7, -2.65, 4.4);
  const ship = airship(flyAt);
  const tower = put(19.65, 4.68);
  base(tower, .93, .93);
  box(tower, 0, .82, 0, .30, 1.16, .30, wood);
  const tube = group(tower, 0, 1.48, 0);
  tube.rotation.z = sign * -.25;
  box(tube, 0, 0, 0, 1.24, .22, .22, dark);
  box(tube, -sign * .53, 0, 0, .21, .36, .36, metal);
  lantern(tower, .0, 1.12, .20, .46, 0xa2e7dc);
  const spawner = put(6.75, -3.81);
  apparatus(spawner);
  const hold = put(4.65, -2.68);
  shelter(hold);
  const shield = put(24.32, 5.7);
  shield.rotation.y = -.63 * sign;
  stopGate(shield, 0x4c6170);
  box(shield, 0, .45, 0, .28, .78, 1.65, 0x71676b);
  const gate = put(26.42, SHAFT.track, rampY(26.42) + .10);
  stopGate(gate, 0xb44838);
  const guard = put(25.63, 2.12);
  stopGate(guard, 0xa76946);
  const lab = put(12.65, -5.77);
  const stages = research(lab);
  const assets = put(20.18, -2.76);
  const ingots = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const z = (i % 2) * .34;
      const ingot = group(assets, (i - (3 - row) * .5) * .38, row * .17 + .12, z);
      box(ingot, 0, 0, 0, .38, .15, .28, 0xc99c3e);
      box(ingot, 0, .065, 0, .31, .073, .21, 0xefd077);
      batch(ingot);
      ingots.push(ingot);
    }
  }
  const smallTrees = Array.from({ length: 5 }, (_, i) => {
    const tree = getModel('Pine');
    tree.position.set(sign * (5.44 + (i % 3) * 1.07), groundY, -6.52 - Math.floor(i / 3) * 1.29);
    parent.add(tree);
    return tree;
  });
  const trees = treePlaces.map(([x, z, scale, angle, place]) => {
    const stand = put(x, z);
    round(stand, 0, .18, 0, .17, .35, wood);
    round(stand, 0, .35, 0, .18, .023, brass);
    const hinge = group(stand);
    const pine = getModel('Pine');
    pine.rotation.y = angle;
    pine.scale.setScalar(scale);
    hinge.add(pine);
    return { hinge, place, cutAt: -Infinity, reserved: false };
  });
  tower.remove(tube);
  for (const prop of [kit, forge, tower, spawner, hold, shield, gate, guard]) batch(prop, true);
  tower.add(tube);
  const installations = [kit, forge, shrine, flyAt, tower, spawner, hold, shield, gate, guard, ...stages, ...ingots, ...smallTrees]
    .map(model => ({ model, level: 0, target: 0 }));
  let crop = .24;

  return {
    trees, airAt: [sign * 22.7, 4.4, -2.65],
    reset() {
      for (const item of installations) {
        item.level = item.target = 0;
        item.model.visible = false;
      }
      for (const tree of trees) { tree.cutAt = -Infinity; tree.reserved = false; }
      crop = .24;
    },
    frame(data, now, dt, reduced, holding) {
      const state = data?.stage ?? {};
      const builds = data?.cardUsedCount ?? 0;
      const targets = [
        data?.craftTable || state.toolkit, data?.anvil, state.altar > 0, state.airlift, state.spy > 0, state.spawner > 0,
        state.hostage || holding, state.shield, state.barrier, state.noSupply,
        builds >= 10, builds >= 20, builds >= 30,
        ...ingots.map((_, i) => i < (data?.asset ?? 0)),
        ...smallTrees.map((_, i) => i < (state.seedlings ?? 0)),
      ];
      for (const [i, item] of installations.entries()) {
        item.target = Number(Boolean(targets[i]));
        item.level = reduced ? item.target : MathUtils.damp(item.level, item.target, item.target ? 5.8 : 8.5, dt);
        item.model.visible = item.level > .023;
        item.model.scale.set(1, Math.max(.03, item.level), 1);
      }
      flyAt.position.y = 4.4 + (reduced ? 0 : .20 * Math.sin(now * 1.43));
      ship.rotation.z = reduced ? 0 : .07 * Math.cos(now * 1.43);
      tube.rotation.y = reduced ? 0 : .22 * Math.sin(now * 1.7);
      crystal.scale.y = reduced ? 1 : MathUtils.damp(crystal.scale.y, state.altar === 2 ? .48 : 1, 3, dt);
      stages[2].rotation.y = reduced ? .54 : now * 1.7;
      crop = reduced ? (state.wheat ? 1 : .24) : MathUtils.damp(crop, state.wheat ? 1 : .24, state.wheat ? .96 : 1.45, dt);
      shoots.scale.y = crop;
      for (const tree of trees) {
        const elapsed = now - tree.cutAt;
        const fall = MathUtils.clamp(elapsed / .67, 0, 1);
        const growth = elapsed > 9.5 ? MathUtils.clamp((elapsed - 9.5) / 4.4, .05, 1) : 0;
        tree.hinge.visible = fall < 1 || growth > 0;
        tree.hinge.rotation.z = sign * (growth > 0 ? 0 : fall ** 2 * 1.63);
        tree.hinge.scale.setScalar(growth || 1);
      }
    },
  };
}
