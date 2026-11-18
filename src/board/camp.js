import { CRAFT_RECIPES } from '../legacy-cards.js';
import { RESOURCES, materialsFor } from '../game-data.js';
import { barrel, batch, box, cabin, field, flag, group, hayBale, paint, TEAM } from './art.js';
import { CAMP, groundY, SHAFT } from './locations.js';
import { buildEquipment } from './equipment.js';

const amber = 0xf3bd69;
const lampOff = 0x49454c;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const stockModels = {
  wood: 'ResourceWood', cobble: 'ResourceStone', iron: 'ResourceIron', wheat: 'ResourceWheat',
};
const stockViews = [
  { minimum: 1, x: -.29, y: .18, z: .20 },
  { minimum: 4, x: .29, y: .18, z: .09 },
  { minimum: 9, x: -.17, y: .18, z: -.34 },
  { minimum: 18, x: .19, y: .44, z: -.22 },
];

function powerReadout(parent, x, y, z) {
  const housing = group(parent, x, y, z);
  const rows = Array.from({ length: 2 }, (_, row) => {
    const tray = group(housing, 0, row * .35);
    box(tray, 0, .14, .02, 1.93, .30, .195, 0x47433d);
    box(tray, 0, .299, .028, 2.01, .047, .224, 0x9d8056);
    const lamps = Array.from({ length: 10 }, (_, i) => {
      const at = (i - 4.5) * .174;
      box(tray, at, .14, .127, .151, .19, .066, 0x302c2d);
      return box(tray, at, .14, .168, .106, .132, .025, lampOff, false);
    });
    return { tray, lamps };
  });
  return {
    update(value, limit) {
      for (const [index, row] of rows.entries()) {
        row.tray.visible = index === 0 || limit > index * 10;
        for (const [digit, lamp] of row.lamps.entries()) {
          const unit = index * 10 + digit;
          lamp.visible = unit < limit;
          lamp.material = paint(unit < value ? amber : lampOff, false);
        }
      }
    },
  };
}

function storage(parent, sign, objects) {
  const depot = group(parent);
  box(depot, sign * CAMP.yard, .075, CAMP.yardZ, 6.15, .14, 1.83, 0x8b7357);
  for (const [i, resource] of Object.keys(RESOURCES).entries()) {
    const x = sign * (CAMP.yard + (i - 1.5) * 1.47);
    const band = [0xc18a54, 0x8f8383, 0xc4bfaa, 0xc6ab61][i];
    objects.add(parent, 'StockBay', [x, groundY, CAMP.yardZ]);
    box(depot, x, .397, CAMP.yardZ + .75, .58, .10, .061, band);
  }
  batch(depot, true);
  return Object.fromEntries(Object.entries(stockModels).map(([resource, asset], i) => {
    const x = sign * (CAMP.yard + (i - 1.5) * 1.47);
    const bins = stockViews.map(slot => ({
      ...slot,
      model: objects.add(parent, asset, [x + sign * slot.x, groundY + slot.y, CAMP.yardZ + slot.z, .86], true),
    }));
    return [resource, bins];
  }));
}

export function buildCamp(parent, mineParent, index, objects, getModel) {
  const sign = index === 0 ? -1 : 1;
  const team = TEAM[index];
  const work = group(parent);
  const marker = flag(work, sign * 13.95, .14, -4.12, team);
  const lodge = cabin(work, sign * CAMP.houseX, CAMP.houseZ, team);
  const plot = field(work, sign * CAMP.plot, -.64, 821 + index, true);
  const equipment = buildEquipment(work, sign, getModel, plot.userData.shoots);
  const scenery = group(work);
  barrel(scenery, sign * 19.66, -2.83);
  hayBale(scenery, sign * 7.58, -2.16);
  hayBale(scenery, sign * 7.19, -2.64, .11, .8);
  for (let i = 0; i < 7; i++) {
    const x = sign * (12.34 + i * .60);
    box(scenery, x, .145, 5.17 + (i % 3) * .17, .40, .055, .42, i % 2 ? 0x7e7058 : 0x8e7d60);
  }
  batch(scenery, true);
  objects.add(work, 'Workshop', [sign * CAMP.mill, groundY, CAMP.millZ]);
  objects.add(work, 'PowerUnit', [sign * CAMP.powerX, groundY, CAMP.powerZ]);
  const generator = powerReadout(work, sign * CAMP.powerX, 1.36, CAMP.powerZ + .44);
  const underground = powerReadout(mineParent, sign * 18.02, SHAFT.floor + .87, SHAFT.back + .26);
  const stock = storage(work, sign, objects);
  const items = new Map(Object.keys(CRAFT_RECIPES).map(id => [id, [-.35, .35].map(offset =>
    objects.add(work, 'Craft_' + id, [sign * CAMP.mill + offset, groundY + 1.18, CAMP.millZ + .48, 1.10], true))]));
  const jobs = [];
  let previewId = null;
  let completion = null;
  let data = null;

  function hideItems(id) {
    for (const item of items.get(id) ?? []) item.shown = false;
  }

  return {
    sign, marker, door: lodge.userData.door, equipment,
    update(player) {
      data = player;
      generator.update(player?.health ?? 0, player?.maxHealth ?? 10);
      underground.update(player?.health ?? 0, player?.maxHealth ?? 10);
      for (const [key, bins] of Object.entries(stock)) {
        for (const bin of bins) bin.model.shown = (player?.resources[key] ?? 0) >= bin.minimum;
      }
    },
    reset() {
      hideItems(previewId);
      hideItems(completion?.id);
      jobs.length = 0;
      completion = null;
      previewId = null;
      equipment.reset();
    },
    preview(id) {
      if (previewId === id) return;
      hideItems(previewId);
      previewId = items.has(id) ? id : null;
    },
    craft(id, player, now, cards, onFinish) {
      const recipe = CRAFT_RECIPES[id];
      if (!recipe || !player) return;
      const materials = materialsFor(player, recipe);
      const resource = Object.keys(materials).find(key => materials[key] > 0);
      const job = { id, due: now + .88, copies: cards, onFinish, resource };
      jobs.push(job);
      return job;
    },
    frame(now, dt, reduced, holding) {
      equipment.frame(data, now, dt, reduced, holding);
      const ready = jobs.findIndex(job => now >= job.due);
      if (ready >= 0) {
        const [job] = jobs.splice(ready, 1);
        hideItems(completion?.id);
        completion = { id: job.id, copies: job.copies, at: now };
        job.onFinish([sign * CAMP.mill, groundY + 1.29, CAMP.millZ + .25], now);
      }
      if (completion && now - completion.at >= 4.3) {
        hideItems(completion.id);
        completion = null;
      }
      const display = previewId ? { id: previewId, copies: 1, at: now } : completion;
      if (previewId && completion?.id !== previewId) hideItems(completion?.id);
      if (!display) return;
      const rise = reduced ? 0 : .27 * Math.sin(Math.PI * clamp((now - display.at) * 2.1, 0, 1));
      for (const [index, model] of items.get(display.id).entries()) {
        model.shown = index < display.copies;
        const [x, y, z] = model.placement.transform;
        model.mesh.position.set(display.copies === 1 ? sign * CAMP.mill : x, y + rise, z);
      }
    },
  };
}
