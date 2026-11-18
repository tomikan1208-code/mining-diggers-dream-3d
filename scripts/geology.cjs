function geology(P, { GOLD, LAND, SHAFT, roadZ }, goal) {
  const rough = P.fields.simplex({ seed: 177 });
  const detail = P.fields.simplex({ seed: 274 });
  const box = (x, y, z, w, h, d, bevel) => {
    const a = Math.abs(x) - w;
    const b = Math.abs(y) - h;
    const c = Math.abs(z) - d;
    return Math.max(a, b, c, (a + b + bevel) * .707, (a + c + bevel) * .707, (b + c + bevel) * .707);
  };
  const { front, back, bottom, halfWidth, slice } = LAND;
  const { floor, roof } = SHAFT;
  const landBounds = { min: [-halfWidth - .7, bottom - .7, back - .7], max: [halfWidth + .7, .7, front + .7] };
  const tunnelProfile = P.geometry.profileDistance([
    [.94, floor - .08], [21.2, floor - .08], [21.50, -4.03], [20.82, roof - .05],
    [1.33, roof + .10], [.94, -3.98],
  ]);
  const abyssProfile = P.geometry.profileDistance([
    [-11.6, -10.65], [-9.95, -11.9], [6.9, -11.85], [10.7, -10.67],
    [8.38, -9.68], [4.68, -9.27], [1.08, -8.55], [-3.48, -9.04], [-7.9, -9.43],
  ]);
  const rockForm = P.forms.superquadric({ radii: [.8, .63, .67], exponents: [3.3, 2.8] });

  function rockBody(x, y, z) {
    const height = rough.value(x * .16, 0, z * .19) * .14;
    const body = box(x, y - (bottom + .14) / 2 - height, z - (back + front) / 2,
      halfWidth, (.14 - bottom) / 2, (front - back) / 2, 1.13);
    const amplitude = y > -.2 ? .084 : .27;
    return body + amplitude * rough.value(x * .87, y * .84, z * .89);
  }

  function tunnel(x, y, z) {
    const waver = rough.value(x * .66, y * 1.05, z * .68);
    const profile = tunnelProfile(Math.abs(x), y + waver * .12);
    return Math.max(profile, SHAFT.back - z + waver * .18);
  }

  function exposedGold(x, y, z) {
    if (Math.abs(x) > 3.1 || Math.abs(y - GOLD.y) > 2 || z < front - 1.9) return 1;
    const rim = Math.hypot(x / 1.61, (y - GOLD.y) / 1.08) - 1;
    return Math.max(rim + .18 * rough.value(x * 2.9, y * 3.1, z), front - 1.04 - z);
  }

  function abyss(x, y, z) {
    return Math.max(abyssProfile(x, y) + rough.value(x * .56, y, z * .82) * .31, 8.91 - z);
  }

  function coalfield([x, y, z]) {
    const a = Math.abs(x);
    const ramp = Math.max(20.28 - a, a - 26.92, floor + (a - SHAFT.startRamp) * SHAFT.grade - y, 7.02 - z);
    return Math.max(rockBody(x, y, z), -Math.min(tunnel(x, y, z), ramp, abyss(x, y, z), exposedGold(x, y, z)));
  }

  function groundInk(x, y, z, nx, ny, nz) {
    const pattern = rough.value(x * .56, y * .70, z * .57);
    const fleck = detail.value(x * 3.2, y * 3.52, z * 3.05);
    if (y > -.11 && ny > .11) {
      if (Math.abs(z - roadZ(x)) < .66 + pattern * .19) {
        return fleck > .17 ? 0xb59b61 : pattern < -.36 ? 0x897441 : 0xa78d56;
      }
      if (pattern < -.27) return 0x65743b;
      if (pattern > .30) return 0x9aa34a;
      return fleck > .13 ? 0x8d9a41 : 0x7e8b3e;
    }
    const warp = pattern * .30 + .31 * Math.sin(x * .29 + z * .33) + .18 * Math.cos(x * .66);
    const band = -y + warp;
    if (y > -.16) return 0x586c35;
    const a = Math.abs(x);
    const ramp = floor + (a - SHAFT.startRamp) * SHAFT.grade;
    if (a > 20.54 && a < 26.47 && z > 6.92 && y > ramp - .32 && y < ramp + .35 && ny > .40) {
      return fleck > .21 ? 0x826449 : 0x6d5244;
    }
    if (a < 20.54 && z > SHAFT.back - .10 && Math.abs(y - floor) < .29 && ny > .39) {
      return fleck > .19 ? 0x594748 : 0x4a4049;
    }
    if (y < -8.42 && z < 9.42 && z > 8.52 && nz > .12) return fleck > .28 ? 0x302a39 : 0x171824;
    if (y < roof && y > floor && z > SHAFT.back - .34 && z < SHAFT.back + .36 && nz > .15) {
      return fleck > .22 ? 0x4a4248 : 0x372f3b;
    }
    if (band < .53) return pattern > .08 ? 0x8f6846 : 0x78583f;
    if (band < 1.03) return fleck > .15 ? 0xb38152 : 0x9a6a46;
    if (band < 1.40) return 0x76523c;
    if (band < 2.60) return pattern > .09 ? 0x936247 : 0x80503e;
    if (band < 2.91) return 0x60423d;
    if (band < 3.53) return fleck > .16 ? 0x9c7157 : 0x885c4c;
    if (band < 4.78) return fleck > .19 ? 0x715553 : 0x654b4a;
    if (band < 5.13) return 0x543d43;
    if (band < 6.48) return pattern > .25 ? 0x70565c : 0x5c464f;
    if (band < 7.01) return fleck > .28 ? 0x9c7157 : 0x815950;
    if (band < 7.80) return 0x5a4647;
    if (band < 8.67) return fleck > .12 ? 0x78625c : 0x685652;
    if (band < 9.13) return 0x4b3e46;
    if (band < 10.13) return pattern > .15 ? 0x795c53 : 0x614c4c;
    if (band < 10.59) return 0x8a6554;
    if (band < 11.63) return fleck > .20 ? 0x68535a : 0x58464f;
    return pattern > .16 ? 0x473e4a : 0x3b3541;
  }

  function bedrockBlock(index, n) {
    const sign = index === 0 ? -1 : 1;
    const hi = SHAFT.first - n * SHAFT.cell;
    const lo = hi - SHAFT.cell - (n === goal - 1 ? .12 : 0);
    const limits = [sign * (lo - .34), sign * (hi + .34)].sort((a, b) => a - b);
    return {
      name: 'Bedrock_' + index + '_' + n,
      bounds: { min: [limits[0], floor - .54, SHAFT.back - .55], max: [limits[1], roof + .60, front + .44] },
      field([x, y, z]) {
        const a = Math.abs(x);
        const shear = b => .12 * Math.sin(y * 1.06 + z * .77 + b * .48) +
          .095 * rough.value(b * .49, y * 1.25, z);
        return Math.max(rockBody(x, y, z), tunnel(x, y, z) - .215, a - hi - shear(hi), lo + shear(lo) - a,
          n >= goal - 2 ? -exposedGold(x, y, z) : -Infinity);
      },
      shade: groundInk, meshStep: .22, splatStep: .29,
    };
  }

  function outcrop([x, y, z]) {
    const rim = box(x, y + 1.71, z, 7.2, 1.86, 4.34, 1.28);
    const base = box(x + .16, y + 2.02, z, 6.57, 1.66, 3.89, .88);
    return Math.min(rim, base) + rough.value(x * .76, y, z * .85) * .22;
  }

  function rock([x, y, z]) {
    return Math.max(rockForm.sd(x, y + .04, z) + rough.value(x * 4, y * 3.1, z * 4) * .16, -.38 - y);
  }

  function pine([x, y, z]) {
    const angle = Math.atan2(z, x);
    const units = Math.hypot(x, z) * (1 + .12 * Math.cos(angle * 6 + y * 3.5));
    let crown = 8;
    for (const [low, height, width] of [[.42, 1.21, 1.02], [.89, 1.10, .81], [1.46, 1.04, .54]]) {
      const level = (y - low) / height;
      const radius = Math.max(.015, width * (1 - level) ** 2 + width * .34 * level * (1 - level));
      crown = Math.min(crown, Math.max(low - y, y - low - height, (units - radius) * .83));
    }
    return Math.min(crown + detail.value(x * 3.4, y * 4.5, z * 3.4) * .078,
      box(x, y - .56, z, .13, .57, .12, .056));
  }
  function pineInk(x, y, z, nx, ny) {
    const grain = detail.value(x * 4, y * 5, z * 4);
    if (Math.hypot(x, z) < .19 && y < .466) return ny < .08 ? 0x573e31 : 0x825c40;
    if (ny < -.14) return grain > .10 ? 0x2d4a39 : 0x1e362e;
    if (y > 1.61) return grain < -.12 ? 0x56754a : 0x728854;
    return grain > .14 ? 0x557748 : 0x3e5d3f;
  }
  const rockInk = (x, y, z, nx, ny) => {
    if (ny < .16) return 0x56535c;
    return detail.value(x * 3, y * 4, z * 3) > .05 ? 0x918980 : 0x776f6e;
  };
  const assets = [
    { name: 'Coalfield', field: coalfield, bounds: landBounds, shade: groundInk, meshStep: .48, splatStep: .38 },
    { name: 'Surface', field: p => Math.max(coalfield(p), slice - p[1]), bounds: { ...landBounds, min: [landBounds.min[0], slice - .16, landBounds.min[2]] }, shade: groundInk, meshStep: .46, splatStep: .37 },
    { name: 'Underground', field: p => Math.max(coalfield(p), p[1] - slice), bounds: { ...landBounds, max: [landBounds.max[0], slice + .16, landBounds.max[2]] }, shade: groundInk, meshStep: .48, splatStep: .38 },
    { name: 'AbyssSeal', field: ([x, y, z]) => Math.max(rockBody(x, y, z), abyss(x, y, z) - .15),
      bounds: { min: [-12.4, -12.6, 8.4], max: [11.4, -8.0, front + .6] }, shade: groundInk, meshStep: .28, splatStep: .29 },
    { name: 'Home', field: outcrop, bounds: { min: [-7.7, -4, -4.9], max: [7.7, .6, 4.9] }, shade: groundInk, meshStep: .25, splatStep: .215 },
    { name: 'Pine', field: pine, bounds: { min: [-1.19, -.13, -1.19], max: [1.19, 2.77, 1.19] }, shade: pineInk, meshStep: .137, splatStep: .117 },
    { name: 'Rock', field: rock, bounds: { min: [-1.05, -.6, -1.05], max: [1.05, .8, 1.05] }, shade: rockInk, meshStep: .15, splatStep: .15 },
  ];
  for (let side = 0; side < 2; side++) {
    for (let n = 0; n < goal; n++) assets.push(bedrockBlock(side, n));
  }
  return assets;
}

module.exports = { geology };
