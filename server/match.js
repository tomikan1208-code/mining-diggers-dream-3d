import { randomInt } from 'node:crypto';
import { CARD_DATA, CONSTANTS, CRAFT_RECIPES } from '../src/legacy-cards.js';
import { canCraft, canPlay, GOAL, materialsFor, REST_MS, STARTER_DECK, TURN_MS } from '../src/game-data.js';

const clamp = (value, max) => Math.max(0, Math.min(value, max));
const stamina = (player, amount) => { player.health = clamp(player.health + amount, player.maxHealth); };
const workers = (player, amount, effect = true) => {
  if (amount >= 0 || !effect || !player.shield) player.worker = clamp(player.worker + amount, CONSTANTS.MAX_WORKER);
};
const mine = (player, sections) => { player.mining = Math.max(0, player.mining + sections); };
const collect = (player, resources) => {
  for (const [key, value] of Object.entries(resources)) player.resources[key] += value;
};
const draw = (player, count) => {
  for (let i = 0; i < count; i++) player.hand.push(STARTER_DECK[randomInt(STARTER_DECK.length)]);
  player.cardsReceived += count;
};

function createPlayer(name, index) {
  return {
    name,
    health: index === 0 ? 2 : 3,
    maxHealth: CONSTANTS.MAX_HEALTH,
    worker: 0,
    mining: 0,
    resources: { wood: 0, cobble: 0, iron: 0, wheat: 0 },
    hand: [],
    cardsReceived: 0,
    suppliesReceived: 0,
    cardUsedCount: 0,
    firstTurn: true,
    minecart: 0,
    saplings: 0,
    wheatPending: 0,
    shield: false,
    craftTable: false,
    anvil: false,
  };
}

function record(match, actor, card, kind, text) {
  match.event = { id: ++match.eventNumber, actor, card, kind, text };
}

function startTurn(match, now) {
  const player = match.players[match.active];
  if (!player.firstTurn) stamina(player, CONSTANTS.TURN_HEALTH_RECOVERY);
  player.shield = false;
  collect(player, { wood: player.saplings, wheat: player.wheatPending });
  const harvested = player.wheatPending > 0;
  player.wheatPending = 0;
  player.hand.push('supply');
  player.suppliesReceived++;
  draw(player, player.firstTurn ? CONSTANTS.INITIAL_DRAW : 1);
  player.firstTurn = false;
  match.phase = 'turn';
  match.deadline = now + TURN_MS;
  record(match, match.active, null, harvested ? 'harvest' : 'dawn', player.name + 'のターン');
}

export function createMatch(names, now, preview = false) {
  const match = {
    players: names.map(createPlayer), active: 0, round: 1,
    phase: 'turn', winner: null, deadline: now, event: null, eventNumber: 0,
  };
  startTurn(match, now);
  if (preview) {
    match.round = 4;
    const [own, other] = match.players;
    Object.assign(own, {
      mining: 7, health: 7, worker: 4, resources: { wood: 8, cobble: 6, iron: 3, wheat: 2 },
      hand: ['wooden_pickaxe', 'tnt', 'wooden_axe', 'stone_hoe', 'supply', 'paper'],
    });
    Object.assign(other, {
      firstTurn: false,
      mining: 8, health: 5, worker: 3, resources: { wood: 4, cobble: 5, iron: 2, wheat: 3 },
      hand: ['wooden_pickaxe', 'golden_pickaxe', 'torch', 'supply'],
    });
    record(match, 0, null, 'dawn', 'プレビュー用の途中盤面');
  }
  return match;
}

function checkWin(match) {
  const order = [match.active, 1 - match.active];
  const winner = order.find(index => match.players[index].mining >= GOAL);
  if (winner === undefined) return false;
  match.winner = winner;
  match.phase = 'finished';
  return true;
}

export function endTurn(match, now, timedOut = false) {
  const player = match.players[match.active];
  mine(player, player.minecart);
  player.hand = player.hand.filter(id => id !== 'supply');
  player.craftTable = false;
  player.anvil = false;
  if (checkWin(match)) return;
  match.phase = 'rest';
  match.deadline = now + REST_MS;
  if (timedOut) record(match, match.active, null, 'night', '日没。' + player.name + 'のターン終了');
}

export function advanceClock(match, now) {
  if (match.phase === 'finished' || now < match.deadline) return false;
  if (match.phase === 'turn') {
    endTurn(match, now, true);
  } else {
    match.active = 1 - match.active;
    if (match.active === 0) match.round++;
    startTurn(match, now);
  }
  return true;
}

const effects = {
  supply: p => { draw(p, 1); collect(p, { wood: 2 }); },
  wooden_pickaxe: p => { mine(p, 1); collect(p, { cobble: 3 }); },
  stone_pickaxe: p => { mine(p, 2); collect(p, { cobble: 2, iron: 3 }); },
  iron_pickaxe: p => { mine(p, 3); collect(p, { cobble: 3, iron: 2 }); },
  golden_pickaxe: p => {
    const gain = p.mining <= 1 ? 2 : 1;
    mine(p, gain);
    collect(p, { cobble: gain });
  },
  oak_fence: (p, q) => {
    for (const player of [p, q]) { mine(player, 1); collect(player, { cobble: 2 }); }
  },
  gunpowder: (p, q) => {
    for (const player of [p, q]) { mine(player, 2); workers(player, -1); }
  },
  tnt: (_p, q) => { mine(q, -5); },
  paper: (p, q) => { if (p.worker <= 1) p.worker = 2; else workers(q, -2); },
  torch: p => { draw(p, 3); },
  wooden_shovel: (p, q) => { for (const player of [p, q]) if (player.worker >= 2) draw(player, 2); },
  wooden_axe: p => { collect(p, { wood: 7 }); },
  stone_axe: p => { collect(p, { wood: 12 }); },
  iron_axe: p => { collect(p, { wood: 20 }); },
  stone_hoe: p => { p.wheatPending += 4; },
  oak_sapling: p => { p.saplings = Math.min(10, p.saplings + 1); },
  minecart: p => { p.minecart++; },
  crafting_table: p => { p.craftTable = true; },
  anvil: p => { p.anvil = true; },
  wooden_sword: (p, q) => { workers(p, 3); workers(q, 3); },
  stone_sword: (p, q) => { draw(p, 2); draw(q, 2); },
  iron_sword: (p, q) => { stamina(p, 2); stamina(q, 2); },
  oak_door: p => { workers(p, 2); },
  iron_door: p => { workers(p, 3); },
  bread: p => { stamina(p, 2); workers(p, 2); },
  shield: p => { p.shield = true; },
};

if (STARTER_DECK.length !== CONSTANTS.DECK_SIZE || new Set(STARTER_DECK).size !== CONSTANTS.DECK_SIZE ||
    [...STARTER_DECK, ...Object.keys(CRAFT_RECIPES)].some(id => !CARD_DATA[id] || !effects[id])) {
  throw new Error('The prototype decks and recipes must use implemented cards.');
}

export function action(match, actor, request, now) {
  advanceClock(match, now);
  if (match.phase !== 'turn') return '次のターンまでお待ちください';
  if (actor !== match.active) return '相手のターンです';
  const player = match.players[actor];
  const { type, id, index } = request;

  if (type === 'end') {
    record(match, actor, null, 'night', player.name + 'がターンを終了');
    endTurn(match, now);
    return;
  }

  if (type === 'craft') {
    if (!canCraft(player, id)) return '必要な資源が揃っていません';
    const recipe = CRAFT_RECIPES[id];
    for (const [key, value] of Object.entries(materialsFor(player, recipe))) player.resources[key] -= value;
    const copies = recipe.usesIron && player.anvil ? 2 : 1;
    for (let i = 0; i < copies; i++) player.hand.push(recipe.result);
    player.cardsReceived += copies;
    record(match, actor, id, 'craft', player.name + 'が「' + recipe.name + '」を作成');
    return;
  }

  if (type !== 'play' || !Number.isInteger(index) || player.hand[index] !== id || !Object.hasOwn(effects, id)) {
    return '手札が変わりました。カードを選び直してください';
  }
  if (!canPlay(player, id)) return '体力または作業員が足りません';
  const card = CARD_DATA[id];
  stamina(player, -card.healthCost);
  workers(player, -card.workerCost, false);
  player.hand.splice(index, 1);
  player.cardUsedCount++;
  effects[id](player, match.players[1 - actor]);
  record(match, actor, id, 'card', player.name + 'が「' + card.name + '」を使用');
  if (!checkWin(match) && id === 'oak_door') endTurn(match, now);
}

export function stateFor(match, viewer, now) {
  return {
    round: match.round, active: match.active, phase: match.phase, winner: match.winner,
    remainingMs: match.phase === 'finished' ? 0 : Math.max(0, match.deadline - now),
    event: match.event,
    players: match.players.map((player, index) => ({
      name: player.name, health: player.health, maxHealth: player.maxHealth, worker: player.worker,
      mining: player.mining, resources: player.resources, craftTable: player.craftTable,
      anvil: player.anvil, hand: viewer === index ? player.hand : [], handCount: player.hand.length,
      cardUsedCount: player.cardUsedCount,
      stage: {
        cards: player.cardsReceived, supplies: player.suppliesReceived,
        seedlings: player.saplings, wheat: player.wheatPending, rails: player.minecart, shield: player.shield,
      },
    })),
  };
}
