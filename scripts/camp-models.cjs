const wood = 0x8d623e;
const oak = 0xb88d56;
const shadow = 0x544138;
const steel = 0x7b8791;
const brass = 0xd3a052;

function part(at, color, field, roll = 0) {
  const sin = Math.sin(roll), cos = Math.cos(roll);
  return {
    color,
    distance(x, y, z) {
      const dx = x - at[0], dy = y - at[1];
      return field(dx * cos + dy * sin, -dx * sin + dy * cos, z - at[2]);
    },
  };
}

function block(at, size, color, bevel = .035, roll = 0) {
  const [w, h, d] = size.map(value => value / 2);
  return part(at, color, (x, y, z) => {
    const a = Math.abs(x) - w, b = Math.abs(y) - h, c = Math.abs(z) - d;
    return Math.max(a, b, c, (a + b + bevel) * .707, (a + c + bevel) * .707, (b + c + bevel) * .707);
  }, roll);
}

function disk(at, radius, depth, color, ring = 0) {
  return part(at, color, (x, y, z) =>
    Math.max(ring ? Math.abs(Math.hypot(x, y) - radius) - ring : Math.hypot(x, y) - radius, Math.abs(z) - depth / 2));
}

function pebble(at, radii, color, roll = 0, power = 2.7) {
  const [a, b, c] = radii;
  const scale = Math.min(a, b, c);
  return part(at, color, (x, y, z) =>
    scale * ((Math.abs(x / a) ** power + Math.abs(y / b) ** power + Math.abs(z / c) ** power) ** (1 / power) - 1), roll);
}

function model(name, shapes, min, max, splatStep) {
  return {
    name, bounds: { min, max }, meshStep: splatStep * .90, splatStep,
    field([x, y, z]) {
      let distance = Infinity;
      for (const shape of shapes) distance = Math.min(distance, shape.distance(x, y, z));
      return distance;
    },
    shade(x, y, z) {
      let distance = Infinity, color = wood;
      for (const shape of shapes) {
        const candidate = shape.distance(x, y, z);
        if (candidate < distance) {
          distance = candidate;
          color = shape.color;
        }
      }
      return color;
    },
  };
}

function workshop() {
  const pieces = [
    block([0, .045, .02], [3.70, .14, 2.11], 0x786b55, .099),
    block([0, .29, -.14], [2.86, .115, 1.34], wood),
    ...[-.60, -.22, .17, .56].map((z, i) =>
      block([0, 1.00, z], [3.12, .19, .396], i % 2 ? oak : 0xa57649)),
    block([0, 1.29, -.78], [3.09, .37, .18], shadow),
    block([0, 1.52, -.79], [3.22, .15, .23], oak),
    block([-.98, 1.16, -.32], [.50, .18, .39], 0x535463),
    block([-.98, 1.30, -.32], [.31, .14, .27], 0x666d75),
    block([-.98, 1.42, -.32], [.65, .16, .30], steel),
    block([-1.28, 1.44, -.32], [.31, .12, .21], steel, .05),
    block([1.01, 1.26, -.48], [.52, .38, .43], 0x5a4c46),
    block([1.02, 1.34, -.253], [.31, .16, .06], 0xe2aa56),
    block([1.02, 1.53, -.48], [.65, .11, .54], 0x746a65),
    block([1.43, 1.04, .28], [.25, .28, .58], steel),
    block([1.43, .86, .56], [.098, .10, .32], brass),
  ];
  for (const x of [-1.29, 1.29]) for (const z of [-.57, .56]) {
    pieces.push(block([x, .54, z], [.23, 1.01, .24], shadow),
      block([x, .18, z], [.31, .22, .31], 0x6a6258));
  }
  return model('Workshop', pieces, [-1.98, -.12, -1.16], [1.98, 1.75, 1.18], .088);
}

function engine() {
  const pieces = [
    block([0, .09, 0], [2.38, .21, 1.46], shadow, .09),
    block([0, .62, -.03], [2.14, .92, 1.19], 0x4e6664, .145),
    block([0, .42, .577], [2.04, .20, .115], 0x77857a),
    block([0, 1.11, -.05], [2.25, .14, 1.22], 0x667d76),
    disk([.67, .69, .634], .292, .15, 0x4d473f),
    disk([.67, .69, .727], .235, .11, brass, .057),
    disk([.67, .69, .769], .090, .10, steel),
    block([.67, .69, .770], [.49, .083, .065], brass, .018, .75),
    block([.67, .69, .777], [.083, .49, .065], brass, .018, .75),
    block([-.71, 1.36, -.30], [.25, .41, .27], 0x697078),
    block([-.71, 1.56, -.30], [.40, .11, .38], 0x999189),
  ];
  for (let i = 0; i < 5; i++) {
    pieces.push(block([-.91 + i * .17, .63, .611], [.082, .39, .04], 0x343e3e, .01));
  }
  return model('PowerUnit', pieces, [-1.3, -.07, -.87], [1.3, 1.73, .92], .084);
}

function bay() {
  const pieces = [
    block([0, .09, 0], [1.37, .18, 1.42], shadow, .064),
    block([0, .32, -.62], [1.37, .41, .12], wood),
    block([0, .20, .63], [1.34, .18, .11], oak),
  ];
  for (const x of [-.61, .61]) {
    pieces.push(block([x, .27, 0], [.13, .33, 1.31], wood),
      block([x, .49, -.60], [.16, .56, .19], oak));
  }
  for (let i = 0; i < 4; i++) {
    pieces.push(block([0, .18, -.48 + i * .29], [1.15, .068, .244], 0x9d774e));
  }
  return model('StockBay', pieces, [-.80, -.05, -.81], [.80, .90, .81], .069);
}

function cargo() {
  const pieces = [
    block([0, .27, 0], [.69, .52, .55], wood, .056),
    block([0, .53, 0], [.77, .11, .61], oak),
    block([0, .22, .288], [.17, .15, .04], brass, .014),
  ];
  for (const x of [-.25, .25]) {
    pieces.push(block([x, .31, 0], [.085, .57, .586], 0x675345, .018));
  }
  return model('SupplyCrate', pieces, [-.47, -.06, -.40], [.47, .69, .40], .057);
}

function supplies() {
  return [
    model('ResourceWood', [
      disk([-.14, .17, .01], .122, .72, 0x604834), disk([.13, .17, -.03], .122, .65, 0x755432),
      disk([0, .33, .01], .121, .66, 0x6a4f36),
      disk([-.14, .17, .376], .098, .042, 0xc59a59), disk([.13, .17, .30], .096, .042, 0xc8a670),
      disk([0, .33, .352], .095, .033, 0xd3aa6f),
    ], [-.34, -.02, -.45], [.34, .49, .47], .050),
    model('ResourceStone', [
      pebble([-.18, .16, .08], [.20, .153, .183], 0x777276, -.31),
      pebble([.18, .15, .04], [.19, .143, .19], 0x646873, .21),
      pebble([.02, .217, -.15], [.25, .216, .22], 0x969290, -.28),
    ], [-.45, -.04, -.44], [.45, .52, .35], .055),
    model('ResourceIron', [
      block([-.15, .09, 0], [.29, .17, .52], 0x7d858b, .075),
      block([.17, .09, .03], [.27, .17, .49], 0xa5a9a2, .065),
      block([0, .25, -.07], [.32, .14, .51], 0xc6c7ad, .075),
    ], [-.39, -.03, -.40], [.39, .40, .36], .052),
    model('ResourceWheat', [
      block([0, .18, 0], [.59, .36, .47], 0xc5a14f, .108),
      block([-.14, .20, 0], [.051, .39, .49], 0x816946),
      block([.14, .20, 0], [.055, .39, .49], 0x816946),
      block([0, .20, .244], [.42, .045, .037], 0xe3c36c, .015),
    ], [-.36, -.04, -.30], [.36, .47, .32], .056),
  ];
}

function product(id) {
  const material = id.startsWith('iron_') ? 0xc3c9bd : id.startsWith('stone_') ? 0x899099 : 0xc18f55;
  const handle = block([0, .44, 0], [.16, .83, .16], wood, .046, -.22);
  let parts;
  if (id.endsWith('_pickaxe')) {
    parts = [
      handle, block([.09, .83, .013], [.70, .142, .20], material, .056, .13),
      block([.39, .75, .018], [.19, .14, .168], material, .063, -.67),
      block([-.21, .72, .018], [.21, .14, .164], material, .066, .78),
      block([.066, .76, .045], [.145, .223, .158], shadow, .030, -.24),
    ];
  } else if (id.endsWith('_axe')) {
    parts = [handle, block([.158, .81, 0], [.38, .22, .204], material, .059, .16),
      block([.348, .79, .01], [.22, .36, .17], material, .092, .16)];
  } else if (id.endsWith('_sword')) {
    parts = [
      block([-.091, .19, 0], [.15, .301, .16], shadow, .034, -.23),
      block([-.05, .36, 0], [.41, .122, .20], brass, .042, -.23),
      block([.037, .67, 0], [.24, .56, .12], material, .05, -.23),
      block([.107, .974, 0], [.205, .177, .119], material, .078, -.23),
    ];
  } else if (id.endsWith('_door')) {
    parts = Array.from({ length: 5 }, (_, i) => block([-.292 + i * .146, .59, 0],
      [.145, 1.14, .13], i % 2 ? material : id === 'iron_door' ? 0x8c9397 : wood));
    for (const y of [.22, .92]) parts.push(block([0, y, .057], [.76, .115, .07], shadow));
    parts.push(block([.24, .54, .097], [.103, .11, .085], brass));
  } else if (id === 'wooden_shovel') {
    parts = [handle, block([.098, .91, 0], [.36, .41, .143], material, .103, -.22)];
  } else if (id === 'stone_hoe') {
    parts = [handle, block([.207, .83, 0], [.45, .12, .20], material, .058, -.13),
      block([.38, .75, 0], [.14, .25, .15], material, .047, .22)];
  } else if (id === 'shield') {
    parts = [block([0, .60, 0], [.70, 1.03, .25], steel, .16),
      block([0, .60, .125], [.56, .79, .12], wood, .131),
      disk([0, .67, .217], .146, .135, brass)];
  } else if (id === 'bread') {
    parts = [pebble([0, .257, 0], [.46, .23, .28], 0xbc7c41, -.12),
      pebble([0, .337, .01], [.40, .216, .253], 0xd39550, -.12)];
    for (const x of [-.21, 0, .20]) parts.push(block([x, .48, .085], [.06, .042, .28], 0xeabb74, .016, -.19));
  } else {
    throw new Error('Missing product model for ' + id);
  }
  return model('Craft_' + id, parts, [-.61, -.10, -.40], [.61, 1.29, .42], .043);
}

function gold() {
  const pieces = [
    pebble([.00, -.035, -.07], [.79, .63, .28], 0x615047, -.30),
    pebble([-.46, .29, .03], [.30, .23, .21], 0xc89142, -.31),
    pebble([-.39, .30, .20], [.22, .15, .14], 0xe1aa4f, -.32),
    pebble([-.061, .12, .10], [.30, .24, .23], 0xe1a34c, .22),
    pebble([-.075, .214, .26], [.205, .14, .092], 0xffd373, .22),
    pebble([.18, -.17, .14], [.24, .17, .19], 0xd6994b, .41),
    pebble([.209, -.115, .267], [.137, .094, .083], 0xf3c164, .38),
    pebble([.45, -.34, .07], [.20, .15, .167], 0xe3af58, -.32),
    pebble([-.34, -.20, .127], [.12, .09, .106], 0xb77d3b, -.25),
    pebble([.40, .22, .105], [.14, .125, .12], 0xb48243, -.25),
  ];
  return model('GoalGold', pieces, [-.94, -.79, -.45], [.94, .77, .52], .047);
}

function campModels(recipes) {
  return [gold(), workshop(), engine(), bay(), cargo(), ...supplies(), ...Object.keys(recipes).map(product)];
}

module.exports = { campModels };
