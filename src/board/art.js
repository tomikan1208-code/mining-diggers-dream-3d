import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TEAM = [
  { cloth: 0x3e70ad, light: 0x78a5d6, dark: 0x29496e, name: '青' },
  { cloth: 0xaa553b, light: 0xd58559, dark: 0x6e362b, name: '赤' },
];

const cube = new T.BoxGeometry(1, 1, 1);
const disk = new T.CylinderGeometry(1, 1, 1, 8);
const materials = new Map();

export function paint(color, lit = true) {
  const key = color * 2 + Number(lit);
  if (!materials.has(key)) {
    const Type = lit ? T.MeshLambertMaterial : T.MeshBasicMaterial;
    materials.set(key, new Type({ color }));
  }
  return materials.get(key);
}

export function group(parent, x = 0, y = 0, z = 0) {
  const child = new T.Group();
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

function solid(geometry, parent, x, y, z, width, height, depth, color, lit) {
  const child = new T.Mesh(geometry, paint(color, lit));
  child.position.set(x, y, z);
  child.scale.set(width, height, depth);
  child.receiveShadow = true;
  parent.add(child);
  return child;
}

export function box(parent, x, y, z, w, h, d, color, lit = true) {
  return solid(cube, parent, x, y, z, w, h, d, color, lit);
}

export function round(parent, x, y, z, r, h, color) {
  return solid(disk, parent, x, y, z, r, h, r, color, true);
}

export function beam(parent, from, to, width, depth, color) {
  const start = new T.Vector3(...from);
  const delta = new T.Vector3(...to).sub(start);
  const part = box(parent, ...start.addScaledVector(delta, 0.5).toArray(), width, delta.length(), depth, color);
  part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return part;
}

export function batch(parent, castShadow = false) {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const sets = new Map();
  parent.traverse(child => {
    if (!child.isMesh) return;
    const material = child.material;
    if (!sets.has(material)) sets.set(material, []);
    sets.get(material).push(child.geometry.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
  });
  parent.clear();
  for (const [material, pieces] of sets) {
    const merged = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

export function rng(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function instancedProp(geometry, positions, material = geometry.material) {
  const object = new T.InstancedMesh(geometry.geometry, material, positions.length);
  const placement = new T.Object3D();
  positions.forEach(([x, y, z, scale, angle = 0, height = 1], index) => {
    placement.position.set(x, y, z);
    placement.scale.set(scale, scale * height, scale);
    placement.rotation.y = angle;
    placement.updateMatrix();
    object.setMatrixAt(index, placement.matrix);
  });
  object.castShadow = true;
  object.receiveShadow = true;
  object.computeBoundingSphere();
  return object;
}

export function lantern(parent, x, y, z, scale = 1, color = 0xffbf65) {
  const lamp = group(parent, x, y, z);
  lamp.scale.setScalar(scale);
  box(lamp, 0, 0, 0, .21, .29, .2, color, false);
  box(lamp, 0, .16, 0, .28, .065, .26, 0x393533);
  box(lamp, 0, -.16, 0, .26, .06, .25, 0x393533);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    box(lamp, a * .10, 0, b * .096, .035, .30, .035, 0x77553b);
  }
  return lamp;
}

function windowFrame(parent, x, y, z, width) {
  box(parent, x, y, z, width + .16, .68, .10, 0x594639);
  box(parent, x, y, z + .056, width, .51, .06, 0xffc17d, false);
  box(parent, x, y, z + .092, .055, .51, .03, 0x67513c);
  box(parent, x, y, z + .093, width, .055, .03, 0x67513c);
  box(parent, x, y - .34, z + .083, width + .25, .105, .26, 0xa58456);
}

export function cabin(parent, x, z, team, scale = 1) {
  const home = group(parent, x, .12, z);
  home.scale.setScalar(scale);
  box(home, 0, .13, 0, 3.6, .26, 2.48, 0x55474b);
  box(home, -.68, .99, .22, .84, 1.63, 1.38, 0x594633);
  box(home, -1.37, .99, -.02, .55, 1.63, 2.26, 0x886341);
  box(home, .69, .99, -.02, 1.89, 1.63, 2.26, 0x886341);
  for (let i = 0; i < 13; i++) {
    const color = [0xb08655, 0xa6794d, 0x996e46, 0xb48e61][i % 4];
    const x = (i - 6) * .247;
    if (x < -1.10 || x > -.22) box(home, x, .98, 1.137, .229, 1.49, .035, color);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      box(home, side * 1.65, .98, (i - 4) * .247, .048, 1.49, .23,
        i % 3 === 0 ? 0xa0784c : 0x916a48);
    }
    for (const end of [-1, 1]) box(home, side * 1.66, 1, end * 1.14, .18, 1.73, .18, 0x574431);
    for (let i = 0; i < 6; i++) {
      const w = 2.93 - i * .48;
      box(home, 0, 1.84 + i * .14, 0, w, .165, 2.25, 0x8d6844);
    }
    const roof = group(home, side * .96, 2.22, 0);
    roof.rotation.z = side * -.47;
    box(roof, 0, -.075, 0, 2.15, .14, 2.84, team.dark);
    for (let i = 0; i < 13; i++) {
      box(roof, 0, .02, (i - 6) * .21, 2.16, .095, .204, i % 4 === 2 ? team.light : team.cloth);
      box(roof, 0, .075, (i - 6) * .21 - .095, 2.16, .026, .03, team.dark);
    }
    for (const end of [-1, 1]) box(roof, .018, -.04, end * 1.426, 2.22, .19, .09, 0xc79769);
  }
  box(home, 0, 2.74, 0, .17, .15, 2.94, team.dark);
  box(home, -.99, 2.44, -.59, .39, 1.27, .37, 0x72636a);
  box(home, -.99, 3.10, -.59, .54, .15, .49, 0x9f8c82);
  box(home, -.99, 3.19, -.59, .29, .075, .26, 0x423c40);
  box(home, -.68, 1.72, 1.167, .99, .15, .15, 0x583b31);
  for (const side of [-1.15, -.22]) box(home, side, .93, 1.18, .09, 1.62, .13, 0x583b31);
  box(home, -.68, .18, 1.4, 1.21, .22, .51, 0xa78858);
  box(home, -.68, .09, 1.65, 1.39, .105, .37, 0x735d3d);
  windowFrame(home, .73, 1.12, 1.16, .8);
  lantern(home, 0, 1.29, 1.245, .56);
  batch(home, true);
  const door = group(home, -1.10, .25, 1.20);
  box(door, .41, .69, 0, .82, 1.39, .085, 0x583b31);
  for (let i = 0; i < 4; i++) box(door, .12 + i * .193, .68, .061, .175, 1.26, .04, 0x795441);
  box(door, .69, .65, .107, .095, .085, .06, 0xe4b173);
  batch(door, true);
  home.userData.door = door;
  return home;
}

export function stockCrate(parent, x, z, y = .16, w = .61) {
  const prop = group(parent, x, y + w * .4, z);
  box(prop, 0, 0, 0, w, w * .78, w, 0x8c653d);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    box(prop, a * w * .42, 0, b * w * .44, w * .15, w * .84, w * .14, 0xbe965e);
  }
  for (const a of [-1, 1]) {
    box(prop, 0, a * w * .32, 0, w * 1.05, w * .135, w * 1.05, 0xae8050);
    box(prop, 0, 0, a * w * .506, w * .075, w * .9, .034, 0xba8c56).rotation.z = .65;
  }
  return prop;
}

export function barrel(parent, x, z, y = .14) {
  round(parent, x, y + .31, z, .29, .58, 0x936b45);
  for (const r of [.13, .47]) round(parent, x, y + r, z, .307, .065, 0x585455);
  round(parent, x, y + .609, z, .24, .044, 0xaf8655);
}

export function logPile(parent, x, z, count = 6, scale = 1) {
  const bundle = group(parent, x, .12, z);
  bundle.scale.setScalar(scale);
  for (let k = 0; k < count; k++) {
    const layer = k < 3 ? 0 : k < 5 ? 1 : 2;
    const slot = k - [0, 3, 5][layer] - (2 - layer) * .5;
    const px = slot * .355;
    const py = .20 + layer * .29;
    const pz = .08 * (k % 3);
    round(bundle, px, py, pz, .18, 1.24, 0x6e543a).rotation.x = Math.PI / 2;
    round(bundle, px, py, pz + .625, .145, .029, 0xc5a477).rotation.x = Math.PI / 2;
    round(bundle, px + .01, py, pz + .646, .074, .023, 0xa9804e).rotation.x = Math.PI / 2;
  }
  return bundle;
}

export function hayBale(parent, x, z, y = .13, scale = 1) {
  const bale = group(parent, x, y + .26 * scale, z);
  bale.scale.setScalar(scale);
  box(bale, 0, 0, 0, .85, .52, .58, 0xb59a54);
  for (let i = 0; i < 5; i++) {
    box(bale, 0, (i - 2) * .077, .292, .81 - i * .024, .021, .024, i % 2 ? 0xd6b767 : 0x978044);
  }
  for (const a of [-1, 1]) box(bale, a * .257, 0, 0, .06, .541, .60, 0x8c734e);
  return bale;
}

export function workbench(parent, x, z) {
  const prop = group(parent, x, .15, z);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    box(prop, a * .61, .32, b * .32, .14, .64, .14, 0x72583a);
  }
  box(prop, 0, .64, 0, 1.58, .17, .89, 0xb18655);
  box(prop, 0, .21, 0, 1.47, .09, .71, 0x9b704a);
  for (const z of [-.22, .05, .29]) box(prop, 0, .73, z, 1.51, .009, .02, 0x6b5136);
  box(prop, -.41, .81, -.15, .41, .15, .36, 0x55535e);
  box(prop, -.41, .91, -.15, .67, .088, .29, 0x70727c);
  box(prop, .32, .76, .16, .65, .04, .07, 0x75583b).rotation.y = -.4;
  box(prop, .59, .783, .26, .2, .077, .18, 0x93939a);
}

export function field(parent, x, z, seed, animated = false) {
  const field = group(parent, x, .14, z);
  const shoots = group(field);
  box(field, 0, .01, 0, 2.5, .087, 1.97, 0x6c5939);
  const random = rng(seed);
  for (let r = 0; r < 4; r++) {
    const row = -.73 + r * .48;
    box(field, 0, .04, row, 2.42, .08, .24, 0x89693f);
    for (let i = 0; i < 9; i++) {
      const a = -.99 + i * .25 + .07 * random();
      const b = row + (random() - .5) * .2;
      const h = .31 + random() * .27;
      const stem = box(shoots, a, h * .5 + .06, b, .035, h, .035, 0xb3944f);
      stem.rotation.z = (random() - .5) * .21;
      const wheat = box(shoots, a + .015, h + .044, b, .107, .168, .10, r % 2 ? 0xd4b363 : 0xe0c978);
      wheat.rotation.z = stem.rotation.z;
    }
  }
  for (const side of [-1, 1]) {
    for (const x of [-1.33, 0, 1.33]) box(field, x, .29, side * 1.07, .12, .58, .12, 0x775b3d);
    box(field, 0, .23, side * 1.07, 2.78, .075, .09, 0xa17d52);
    if (side < 0) box(field, 0, .43, side * 1.07, 2.78, .075, .09, 0x9a774b);
  }
  if (animated) {
    field.remove(shoots);
    batch(field, true);
    batch(shoots);
    field.add(shoots);
    field.userData.shoots = shoots;
  }
  return field;
}

export function flag(parent, x, y, z, team) {
  const flag = group(parent, x, y, z);
  box(flag, 0, 1.47, 0, .10, 2.94, .105, 0x9d7951);
  box(flag, 0, 2.99, 0, .17, .14, .149, 0xe2bb72);
  box(flag, .44, 2.56, 0, .86, .62, .085, team.cloth);
  box(flag, .47, 2.36, .052, .79, .065, .033, team.light);
  box(flag, .33, 2.59, .051, .15, .247, .036, 0xe5d5a1);
  box(flag, .33, 2.59, .054, .28, .12, .037, 0xe5d5a1);
  box(flag, .91, 2.66, 0, .19, .42, .084, team.cloth).rotation.y = .24;
  return flag;
}

export function foreman(parent, team, chief = false) {
  const body = group(parent);
  const trunk = group(body);
  const helm = chief ? 0xeac271 : 0xc6a96b;
  box(trunk, 0, .70, 0, .38, .44, .29, team.cloth);
  box(trunk, 0, .61, .151, .36, .113, .045, team.dark);
  box(trunk, -.108, .755, .164, .055, .33, .059, team.light);
  box(trunk, .108, .755, .164, .055, .33, .059, team.light);
  box(trunk, 0, .715, -.174, .3, .28, .13, 0x5f4d3e);
  box(trunk, 0, 1.052, 0, .292, .28, .288, 0xc88e68);
  box(trunk, 0, 1.244, 0, .38, .17, .356, helm);
  box(trunk, 0, 1.186, .07, .434, .063, .433, helm);
  box(trunk, 0, 1.242, .194, .14, .111, .077, 0x55473c);
  box(trunk, 0, 1.243, .242, .095, .074, .027, 0xffdc8d, false);
  for (const a of [-1, 1]) box(trunk, a * .074, 1.062, .151, .031, .038, .018, 0x322a29);
  batch(trunk, true);
  const uniform = Object.fromEntries(['cloth', 'dark', 'light'].map(key =>
    [key, trunk.children.filter(mesh => mesh.material === paint(team[key]))]));
  const legs = [];
  const arms = [];
  for (const a of [-1, 1]) {
    const leg = group(body, a * .102, .51);
    box(leg, 0, -.204, 0, .162, .408, .181, 0x504d4c);
    box(leg, 0, -.446, .033, .177, .124, .252, 0x433630);
    legs.push(leg);
    const arm = group(body, a * .245, .907);
    uniform.cloth.push(box(arm, 0, -.149, 0, .128, .29, .169, team.cloth));
    box(arm, 0, -.334, 0, .136, .117, .157, 0xc88e68);
    arms.push(arm);
  }
  const tools = {};
  for (const [name, w, h, z, color] of [
    ['pick', .53, .075, .405, 0xb3aaa6], ['axe', .29, .23, .355, 0xb6aba0],
    ['ironPick', .57, .092, .405, 0xd2d3d7], ['diamondPick', .64, .095, .405, 0x5dd9dd],
    ['goldPick', .57, .085, .405, 0xedbd58], ['stoneAxe', .33, .23, .355, 0x817983],
    ['ironAxe', .39, .28, .37, 0xc6cccc],
    ['hoe', .19, .13, .39, 0x938580], ['hammer', .28, .18, .34, 0xb0a6a2],
  ]) {
    const tool = group(arms[1], 0, -.338, .095);
    box(tool, 0, 0, .165, .059, .061, .38, 0x9c7553);
    box(tool, name === 'axe' ? .054 : 0, 0, z, w, h, .10, color);
    if (name.toLowerCase().endsWith('pick')) for (const side of [-1, 1]) {
      box(tool, side * w * .5, -.017, z - .022, .09, .085, .077, color).rotation.y = side * .38;
    }
    tool.visible = false;
    tools[name] = tool;
  }
  const bow = group(arms[1], 0, -.36, .17);
  beam(bow, [0, -.36, 0], [0, 0, .21], .065, .058, 0x95653a);
  beam(bow, [0, 0, .21], [0, .36, 0], .065, .058, 0x95653a);
  box(bow, 0, 0, 0, .021, .70, .021, 0xe8dbac);
  bow.visible = false;
  tools.bow = bow;
  const cargo = stockCrate(body, 0, .43, .53, .44);
  batch(cargo);
  cargo.visible = false;
  return {
    body, trunk, legs, arms, tools, cargo,
    setTeam(color) {
      for (const [key, meshes] of Object.entries(uniform)) for (const mesh of meshes) mesh.material = paint(color[key]);
    },
  };
}

export function pose(worker, cycle, walking, swing = 0, rest = 0, tool = null, carrying = false) {
  const step = walking * .55 * Math.sin(cycle);
  const { legs, arms, trunk, body } = worker;
  body.rotation.z = -rest * 1.52;
  trunk.position.y = walking * .026 * Math.cos(cycle * 2);
  legs[0].rotation.x = step;
  legs[1].rotation.x = -step;
  arms[0].rotation.x = -step;
  arms[1].rotation.x = step - swing;
  if (carrying) arms[0].rotation.x = arms[1].rotation.x = -1.23;
  for (const [name, model] of Object.entries(worker.tools)) model.visible = name === tool;
  worker.cargo.visible = carrying;
}
