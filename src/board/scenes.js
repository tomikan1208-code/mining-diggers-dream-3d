import { GOAL } from '../game-data.js';
import { CAMP, groundY, LAND, roadZ, SHAFT } from './locations.js';
import { mineFace, planMine, resetMine } from './mine.js';
import { rainbow } from './props.js';

const gold = 0xffcb73;
const teal = 0x95dbc3;
const purple = 0xbf8ce5;
const red = 0xf66946;
const paper = 0xf1dda5;
const miningLimit = value => Math.max(0, Math.min(GOAL, value ?? 0));
const changed = (data, previous, key) => (data?.stage?.[key] ?? 0) - (previous?.stage?.[key] ?? 0);
const resource = (data, key) => data?.resources?.[key] ?? 0;
const getMiners = player => player?.worker ?? 0;
const tools = {
  wooden_pickaxe: 'pick', stone_pickaxe: 'pick', iron_pickaxe: 'ironPick',
  diamond_pickaxe: 'diamondPick', golden_pickaxe: 'goldPick',
  wooden_axe: 'axe', stone_axe: 'stoneAxe', iron_axe: 'ironAxe',
};
const meals = new Set(['beef', 'bread', 'rabbit_stew']);
const houseCards = new Set(['oak_door', 'iron_door', 'beef', 'bread']);
const energyCards = new Set(['command_block', 'iron_sword', 'light_blue_wool', 'blue_wool', 'clock', 'dragon_egg']);
const discharge = {
  torch: { prop: 'lantern', color: gold, place: 'face' },
  wooden_shovel: { prop: 'supply', color: paper, place: 'stock' },
  book: { prop: 'book', color: paper, place: 'bench' },
  blaze_powder: { prop: 'supply', color: red, place: 'stock' },
  glowstone_dust: { prop: 'crystal', color: gold, place: 'bench' },
  chest: { prop: 'treasure', color: gold, place: 'stock' },
  supply: { prop: 'supply', color: paper, place: 'stock' },
  shulker_box: { prop: 'supply', color: teal, place: 'bench' },
  poppy: { prop: 'book', color: teal, place: 'crop' },
  stone_sword: { prop: 'supply', color: paper, place: 'stock' },
  name_tag: { prop: 'book', color: paper, place: 'portal' },
  barrier: { prop: 'book', color: paper, place: 'portal' },
  totem_of_undying: { prop: 'supply', color: gold, place: 'stock' },
};

export class CardScenes {
  constructor({ fx, props, people, abyss, camps, mines, canvas }) {
    Object.assign(this, { fx, props, people, abyss, camps, mines, canvas });
  }

  at(side, place, height = 0) {
    const { sign } = this.camps[side];
    switch (place) {
      case 'stock': return [sign * CAMP.yard, groundY + .13 + height, CAMP.yardZ + 1.35];
      case 'bench': return [sign * CAMP.mill, groundY + .96 + height, CAMP.millZ + .66];
      case 'crop': return [sign * CAMP.plot, groundY + height, .45];
      case 'power': return [sign * CAMP.powerX, 1.88 + height, CAMP.powerZ + .49];
      case 'face': return [mineFace(sign, this.mines[side].goal) + sign * .31, SHAFT.floor + .24 + height, SHAFT.track + 1.15];
      case 'portal': return [sign * (SHAFT.portal - .25), groundY + height, SHAFT.track + 1.02];
      case 'shed': return [sign * 4.65, groundY + height, -1.81];
      case 'spawner': return [sign * 6.75, groundY + height, -2.75];
      case 'trade': return [sign * 24.75, groundY + height, 2.29];
      case 'road': return [sign * 31.3, groundY + height, roadZ(31.3)];
      default: return [sign * CAMP.standX, groundY + height, CAMP.pathZ + .33];
    }
  }

  update(players, old, { card, kind, outcome, actor, hand, now, initial, night }) {
    const before = old ?? [null, null];
    const delta = players.map((player, i) => (player?.mining ?? 0) - (before[i]?.mining ?? 0));
    const hatch = !initial && delta.every(gain => gain >= 20) &&
      before.some((player, i) => player?.stage?.egg && !players[i]?.stage?.egg);
    const gains = [[], []];

    for (let i = 0; i < 2; i++) {
      const player = players[i];
      const mine = this.mines[i];
      const count = miningLimit(initial || kind === 'edit' || hatch || card === 'gold_nugget'
        ? player?.mining : mine.goal + delta[i]);
      mine.rails = player?.stage?.rails ?? 0;
      if (initial) {
        resetMine(mine, count);
        continue;
      }
      let style = kind === 'edit' ? 'edit' : 'dig';
      if (hatch) style = 'hatch';
      else if (actor >= 0 && i !== actor && card === 'tnt') style = 'blast';
      else if (card === 'gold_nugget') style = 'swap';
      else if (card === 'gunpowder') style = 'charge';
      else if (card === 'flint_and_steel' && delta[i] < 0) style = 'burn';
      else if (i === actor && card === 'piston') style = 'drill';
      else if (i === actor && card === 'diamond_pickaxe') style = 'diamond';
      else if (i === actor && card === 'golden_pickaxe') style = 'gold';
      else if (i === actor && card === 'purple_wool') style = 'arcane';
      else if (night && mine.rails && delta[i] > 0) style = 'cart';

      if (i === actor && outcome?.rolls) {
        let next = mine.goal;
        for (const [index, result] of outcome.rolls.entries()) {
          if (result.kind !== 'mine' || result.amount <= 0) continue;
          next += result.amount;
          planMine(mine, miningLimit(next), now + .10 + index * .27, 'arcane');
        }
      }
      planMine(mine, count, now, style, tools[card]);
    }

    if (hatch) this.abyss.hatch(now);
    else if (card === 'dragon_egg' || (initial && players.some(player => player?.stage?.egg))) this.abyss.wake(now, initial);

    if (!initial) {
      for (let i = 0; i < 2; i++) {
        const next = players[i];
        const increase = getMiners(next) - getMiners(before[i]);
        if (i === actor && outcome?.rolls) {
          gains[i] = outcome.rolls.flatMap(({ kind, amount }, index) =>
            kind === 'worker' && amount > 0 ? [{ delay: index * .27 }] : []);
        } else if (i === actor && houseCards.has(card)) {
          gains[i] = Array.from({ length: Math.max(0, increase) }, () => ({ from: 'lodge', delay: .21 }));
        } else if (i === actor && (kind === 'spawn' || (night && before[i]?.stage?.spawner))) {
          const recruited = before[i]?.stage?.recruitment ? Math.min(3, increase) : 0;
          for (let n = 0; n < increase; n++) gains[i].push(n < recruited ? {} : { from: 'spawner' });
        }
      }
    }
    this.people.counts(players, before, card, actor, now, gains);
    if (initial) return;

    for (let i = 0; i < 2; i++) {
      const player = players[i];
      if (!player) continue;
      const isActor = i === actor;
      let cards = Math.max(0, changed(player, before[i], 'cards'));
      const supplies = Math.max(0, changed(player, before[i], 'supplies'));
      const local = i === hand;
      if (supplies) {
        const groupedDraws = !card && !player.stage?.airlift ? cards : 0;
        this.supply(i, now, local, supplies + groupedDraws);
        cards -= groupedDraws;
      }
      if (isActor && kind === 'craft') {
        this.craft(i, card, player, now, local, cards);
        cards = 0;
      }
      if (isActor && outcome?.rolls) cards -= this.star(i, outcome.rolls, cards, now, local);
      if (cards > 0) this.deliver(i, card, player, cards, now, local, isActor, outcome);
      if (resource(player, 'wheat') > resource(before[i], 'wheat') && changed(player, before[i], 'wheat') < 0) {
        this.farm(i, now, true);
      }
      if (delta[i] > 0 && !hatch && (resource(player, 'cobble') > resource(before[i], 'cobble') ||
          resource(player, 'iron') > resource(before[i], 'iron'))) {
        this.moveOre(i, now);
      }
      if (delta[i] > 0 && !isActor && delta[actor] > 0 && before[i]?.stage?.spy === 1 && card !== 'oak_fence' && card !== 'gunpowder') {
        const start = [this.camps[i].sign * 19.65, 1.63, 4.68];
        this.fx.glow(start, now + .08, teal, 1.24);
        this.props.fly(start, this.at(i, 'face', .5), now + .10, teal, .39, 1.04);
      }
      if (changed(player, before[i], 'lava') < 0 && delta[i] > 0 && card !== 'feather') {
        const at = this.at(i, 'face', .60);
        this.fx.glow(at, now + .30, red, 2.75, .82);
        this.fx.burst(at, now + .33, 'red', 24);
        this.fx.cloud(at, now + .49, { color: 0x8f4945, rise: 1.24, life: 1.32 });
      }
      if (before[i] && player.health > before[i].health && !['command_block', 'iron_sword'].includes(card)) {
        this.power(i, now, rainbow[card] ?? gold);
      }
      if (player.cardUsedCount >= 30 && before[i]?.cardUsedCount < 30) {
        this.fx.glow([this.camps[i].sign * 12.65, 1.51, -5.77], now, teal, 2.2, 1.05);
      }
      if (getMiners(player) > getMiners(before[i]) && (kind === 'spawn' || (night && before[i]?.stage?.spawner))) {
        this.fx.glow(this.at(i, 'spawner', .63), now, purple, 1.32, .74);
      }
      if (night && resource(player, 'wood') > resource(before[i], 'wood') && player.stage?.seedlings) {
        this.people.task(i, [{ place: 'pines', hold: .16 }, { place: 'woodStock', carry: true }]);
      }
    }
    if (kind === 'card' && actor >= 0) this.play(actor, card, players, before, now);
  }

  power(side, now, color, resonance = false) {
    const at = this.at(side, 'power');
    this.fx.glow(at, now + .12, color, resonance ? 2.42 : 1.52, .71);
    this.fx.burst(at, now + .13, 'gold', resonance ? 14 : 7, color);
    const sign = this.camps[side].sign;
    this.fx.glow([sign * 18.02, SHAFT.floor + 1.37, SHAFT.back + .53], now + .12, color, 1.45);
  }

  supply(side, now, local, count) {
    const at = this.at(side, 'stock');
    this.props.show('supply', at, now);
    this.fx.cards(this.at(side, 'stock', .66), count, now + .23, paper, local);
  }

  deliver(side, card, player, count, now, local, isActor, outcome) {
    if (isActor && card === 'emerald') {
      this.people.visitor(side, 'trade', now, count > 1 ? 1.1 : .76, position => {
        const at = [position.x, position.y + .25, position.z + .67];
        this.props.show(count > 1 ? 'treasure' : 'supply', at, this.now, 1.82);
        this.fx.cards([at[0], at[1] + .78, at[2]], count, this.now + .27, count > 1 ? teal : gold, local);
      });
      return;
    }
    if (isActor && card === 'name_tag') {
      this.people.visitor(side, 'trade', now, .61, position => {
        this.fx.cards([position.x, position.y + 1.08, position.z], count, this.now, paper, local);
      });
      return;
    }
    if (isActor && card === 'poppy') {
      this.people.visitor(side, 'crop', now, .61, position => {
        const at = [position.x, position.y + .13, position.z];
        this.props.show('book', at, this.now);
        this.fx.cards([at[0], at[1] + .72, at[2]], count, this.now + .18, teal, local);
      });
      return;
    }
    if (isActor && card === 'ghast_tear' && outcome?.rainbow) {
      const at = [this.camps[side].sign * 14, 2.02, -2.93];
      this.props.show('rainbow', at, now, 2);
      outcome.rainbow.forEach((id, i) => {
        const from = [at[0] + (i - .5) * 2.8, at[1] + 3.14, at[2]];
        const to = this.at(side, 'stand', 1.13);
        const time = now + .21 + i * .27;
        this.props.fly(from, to, time, rainbow[id], .53, -.4);
        this.fx.cards(to, 1, time + .53, rainbow[id], local);
      });
      return;
    }

    const options = (isActor || ['wooden_shovel', 'stone_sword', 'barrier', 'blaze_powder'].includes(card)) && discharge[card];
    const airlift = !options && player.stage?.airlift;
    const place = options?.place ?? (rainbow[card] ? 'stand' : 'stock');
    const color = rainbow[card] ?? options?.color ?? (card === 'feather' ? gold : paper);
    const at = airlift ? this.camps[side].equipment.airAt : this.at(side, place);
    const time = now + (card === 'feather' ? .57 : .18);
    if (airlift) {
      const landing = this.at(side, 'stock', .51);
      this.props.fly(at, landing, time, paper, .64, .11);
      this.props.show('supply', this.at(side, 'stock'), time + .54);
      this.fx.cards(landing, count, time + .65, color, local);
    } else {
      if (!rainbow[card]) this.props.show(options?.prop ?? 'supply', at, time - .09, card === 'chest' ? 2.48 : 1.6);
      const origin = [at[0], at[1] + .65, at[2] + .22];
      this.fx.cards(origin, count, time + .17, color, local);
      if (card === 'glowstone_dust') for (let i = 1; i <= Math.min(6, count / 2); i++) {
        this.fx.glow(origin, time + i * .14, gold, 1.42, .27);
      }
    }
  }

  star(side, rolls, count, now, hand) {
    let shown = 0;
    for (const [i, roll] of rolls.entries()) {
      const at = this.at(side, roll.kind === 'mine' ? 'portal' : roll.kind === 'worker' ? 'trade' : 'stock');
      const time = now + .12 + .27 * i;
      this.props.show('column', at, time, .37);
      this.fx.glow(at, time, gold, 2.25, .48);
      if (roll.kind === 'draw' && roll.amount && shown < count) {
        this.fx.cards([at[0], at[1] + 1.08, at[2]], 1, time + .15, gold, hand);
        shown++;
      }
    }
    return shown;
  }

  craft(side, card, player, now, hand, cards) {
    const camp = this.camps[side];
    const job = camp.craft(card, player, now, cards, (at, time) => {
      this.fx.cards(at, cards, time, gold, hand);
      this.fx.burst(at, time, 'gold', 14);
    });
    if (!job?.resource) return;
    const assigned = this.people.task(side, [
      { place: job.resource + 'Stock', hold: .18 },
      { place: 'craft', carry: true, onDone: () => { job.due = this.now + .52; } },
      { place: 'craft', tool: 'hammer', hold: .53 },
    ]);
    if (assigned) job.due = now + 7.8;
  }

  moveOre(side, now) {
    const from = this.at(side, 'portal', .36);
    const to = this.at(side, 'stock', .48);
    this.people.task(side, [
      { place: 'mine', hold: .39 },
      { place: 'cobbleStock', carry: true, onDone: () => this.fx.burst(to, this.now, 'stone', 7) },
    ]);
    this.fx.burst(from, now + .66, 'stone', 6);
  }

  farm(side, now, harvest = false) {
    const crop = this.at(side, 'crop', .32);
    const stock = this.at(side, 'stock', .62);
    const jobs = [{
      place: 'crop', tool: 'hoe', hold: .94,
      onArrive: () => this.fx.burst(crop, this.now, harvest ? 'gold' : 'leaf', 12),
    }];
    if (harvest) jobs.push({ place: 'wheatStock', carry: true, onDone: () => this.fx.burst(stock, this.now, 'gold', 9) });
    if (!this.people.task(side, jobs)) this.fx.burst(crop, now + .28, harvest ? 'gold' : 'leaf', 12);
  }

  log(side, card, now) {
    const { equipment, sign } = this.camps[side];
    const tree = equipment.trees.filter(tree => !tree.reserved).sort((a, b) => a.cutAt - b.cutAt)[0];
    if (!tree) return;
    const cut = () => {
      tree.cutAt = this.now;
      tree.reserved = false;
      const at = tree.hinge.parent.position;
      this.fx.burst([at.x, at.y + .97, at.z + .43], this.now, 'leaf', 19);
    };
    tree.reserved = true;
    const assigned = this.people.task(side, [
      { place: tree.place, hold: card === 'iron_axe' ? .62 : card === 'stone_axe' ? .86 : 1.14, tool: tools[card],
        onDone: cut, onCancel: () => { tree.reserved = false; } },
      { place: 'woodStock', carry: true, onDone: () => this.fx.burst(this.at(side, 'stock', .42), this.now, 'leaf', 10) },
    ]);
    if (!assigned) {
      tree.cutAt = now + .72;
      tree.reserved = false;
      this.fx.burst([sign * 29.5, .7, -1.3], now + .72, 'leaf', 15);
    }
  }

  play(side, card, players, old, now) {
    const rival = 1 - side;
    const at = place => this.at(side, place);
    const gained = (i, key) => (players[i][key] ?? 0) - (old[i]?.[key] ?? 0);
    if (card.endsWith('_axe')) this.log(side, card, now);
    if (card === 'stone_hoe' || (card === 'poppy' && changed(players[side], old[side], 'wheat') > 0)) {
      if (card === 'poppy') this.people.visitor(side, 'crop', now, .63, () => this.farm(side, this.now));
      else this.farm(side, now);
    }
    if (meals.has(card)) {
      for (const i of card === 'rabbit_stew' ? [side, rival] : [side]) {
        this.props.show(card === 'bread' ? 'bread' : 'meal', this.at(i, 'stand'), now, 2.62);
        this.fx.glow(this.at(i, 'stand', .49), now + .17, gold, 1.28, .58);
      }
    }
    if (rainbow[card] && !discharge[card]) {
      const place = card === 'purple_wool' ? 'face' : energyCards.has(card) ? 'power' :
        ['yellow_wool', 'green_wool'].includes(card) ? 'road' : 'trade';
      const to = this.at(side, place, .63);
      this.props.fly([to[0], to[1] + 3.17, to[2] - .63], to, now, rainbow[card], .48, -.25);
      this.fx.glow(to, now + .45, rainbow[card], 2.1, .48);
    }
    if (old[rival]?.stage?.shield && gained(rival, 'worker') === 0 &&
        ['cobweb', 'player_head', 'stick', 'lead', 'blaze_powder'].includes(card)) {
      this.fx.glow([this.camps[rival].sign * 24.32, .82, 5.7], now + .14, teal, 1.93, .62);
    }
    if (old[side]?.stage?.toolkit && tools[card]?.toLowerCase().endsWith('pick')) {
      this.fx.glow(this.at(side, 'face', .60), now + .24, teal, 1.43, .53);
    }
    switch (card) {
      case 'bow': {
        const start = this.at(side, 'stand', 1.05);
        const end = this.at(rival, 'stand', .99);
        this.people.task(side, [{ place: 'lookout', tool: 'bow', hold: .73 }], true);
        this.props.fly(start, end, now + .14, paper, .56, 1.7);
        if (old[rival]?.stage?.shield) this.fx.glow(end, now + .70, teal, 1.73);
        break;
      }
      case 'cobweb':
        this.fx.glow(this.at(gained(rival, 'worker') < 0 ? side : rival, 'shed', .62), now, paper, 1.02);
        break;
      case 'paper':
        this.props.show('book', gained(side, 'worker') > 0 ? at('trade') : this.at(rival, 'stock'), now, 1.15);
        break;
      case 'gold_nugget': {
        const own = this.at(side, 'face', 1.08), other = this.at(rival, 'face', 1.08);
        this.props.fly(own, other, now, gold, .66, .36);
        this.props.fly(other, own, now + .09, gold, .66, -.36);
        break;
      }
      case 'flint_and_steel': {
        const end = this.at(rival, 'stock', .47);
        if (gained(rival, 'worker') < 0) {
          this.fx.burst(end, now, 'red', 25);
          this.fx.glow(end, now, red, 2.3, .7);
          this.fx.cloud(end, now + .16, { color: 0x605052, rise: 1.12 });
        } else if (old[rival]?.stage?.shield && gained(rival, 'mining') === 0) this.fx.glow(end, now, teal, 1.2);
        break;
      }
      case 'wooden_shovel':
        for (const i of [side, rival]) {
          if (getMiners(players[i]) >= 2) this.people.task(i, [{ place: 'stock', tool: 'hammer', hold: .58 }]);
        }
        break;
      case 'torch':
        this.fx.glow(this.at(side, 'face', .95), now + .06, gold, 2.5, 1.65);
        break;
      case 'brick':
        if (resource(players[side], 'cobble') < resource(old[side], 'cobble') || resource(players[side], 'wood') < resource(old[side], 'wood')) {
          this.props.show('foundation', [this.camps[side].sign * 14, groundY, -3.86], now, 5.3);
          this.people.task(side, [{ place: 'houseYard', tool: 'hammer', hold: .78 }]);
        }
        break;
      case 'dragon_breath':
        this.fx.tonic(this.canvas, this.reduced);
        this.fx.cloud(this.at(side, 'stand', .75), now, { color: purple, size: 1.15, rise: 1.27 });
        break;
      case 'iron_horse_armor':
        for (const i of [side, rival]) {
          const { sign } = this.camps[i];
          this.fx.cloud(this.at(i, 'road', 1.1), now, { color: 0xc7c6b7, width: 2.2, opacity: .40, rise: .4, drift: -sign * 10.0 });
        }
        break;
      case 'command_block':
      case 'iron_sword':
        for (const i of [side, rival]) this.power(i, now, gold, card === 'command_block');
        break;
      case 'crafting_table':
      case 'anvil':
        this.fx.glow(this.at(side, 'bench', .33), now, card === 'anvil' ? red : teal, 1.89, .8);
        this.people.task(side, [{ place: 'craft', tool: 'hammer', hold: 1.1 }]);
        break;
      case 'gold_ingot':
        this.fx.glow([this.camps[side].sign * 20.18, .52, -2.7], now, gold, 1.36, .76);
        break;
      case 'enchanting_table':
        this.fx.glow([this.camps[side].sign * 12.65, .9, -5.77], now, teal, 2.2, .75);
        break;
      case 'feather':
        for (const i of [side, rival]) {
          const spot = this.at(i, 'stand');
          this.props.show('column', spot, now, .67);
          this.fx.glow(spot, now, gold, 2.5, .66);
        }
        break;
      case 'lead':
        if (resource(players[rival], 'iron') > resource(old[rival], 'iron')) {
          this.props.show('supply', this.at(rival, 'stock'), now + .31);
          this.fx.burst(this.at(rival, 'stock', .64), now + .58, 'stone', 10);
        }
        break;
      case 'supply':
        this.people.task(side, [{ place: 'trade', hold: .12 }, { place: 'woodStock', carry: true, hold: .12 }]);
        break;
      case 'oak_door':
      case 'iron_door':
      case 'clock':
        this.fx.glow([this.camps[side].sign * CAMP.houseX - .68, 1.16, CAMP.houseZ + 1.45], now, gold, 1.5, .72);
        break;
      default:
        if (energyCards.has(card) && gained(side, 'health') === 0) this.power(side, now, rainbow[card] ?? gold);
    }
  }
}
