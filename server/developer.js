import { HeadlessGame, ALL_CARDS } from './headless-rules.js';
import { CRAFT_RECIPES } from '../src/legacy-cards.js';
import { RESOURCES, REST_MS, STARTER_DECK, TURN_MS } from '../src/game-data.js';
import { PLAYER_FIELDS, TURN_FIELDS, readValue } from '../src/developer-fields.js';

const names = ['青の鉱夫', '赤の鉱夫'];
const isSide = value => value === 0 || value === 1;
const isCard = id => typeof id === 'string' && Object.hasOwn(ALL_CARDS, id);
const zero = { healthCost: 0, workerCost: 0 };

export class DeveloperGame extends HeadlessGame {
  constructor(now) {
    super(names, STARTER_DECK);
    this.lastTick = now;
    this.eventNumber = 0;
    this.phase = 'turn';
    this.paused = true;
    this.free = true;
    this.turnNumber = 4;
    const [blue, red] = this.players;
    Object.assign(blue, { mining: 7, worker: 4, health: 7 });
    Object.assign(red, { mining: 8, worker: 3, health: 5 });
    Object.assign(blue.resources, { wood: 8, cobble: 6, iron: 3, wheat: 2 });
    Object.assign(red.resources, { wood: 4, cobble: 5, iron: 2, wheat: 3 });
    for (const player of this.players) {
      player.firstTurnDone = true;
      for (const card of ['supply', 'wooden_pickaxe', 'tnt', 'stone_hoe']) this.addCardToHand(player, card, false);
    }
    this.resetClock();
    this.record(0, null, 'dawn', '開発者用の途中盤面');
  }

  record(actor, card, kind, text, outcome) {
    this.event = { id: ++this.eventNumber, actor, card, kind, text, outcome };
  }

  resetClock() {
    this.remainingMs = this.limitMs = Math.max(30000, TURN_MS - this.getCurrentPlayer().buffs.timeLimitReduction * 1000);
    this.spawned = false;
  }

  startTurn() {
    // The headless turn transition calls startTurn synchronously. Hold it during the night.
    if (this.phase === 'rest') return;
    this.resetClock();
    const side = this.currentPlayerIndex;
    const player = this.players[side];
    const wheat = player.resources.wheat;
    super.startTurn();
    if (this.phase !== 'turn') return;
    this.record(side, null, player.resources.wheat > wheat ? 'harvest' : 'dawn', player.name + 'のターン');
  }

  endTurn() {
    if (this.phase !== 'turn' || this.gameEnded) return;
    this.restActor = this.currentPlayerIndex;
    this.restRound = this.turnNumber;
    this.phase = 'rest';
    this.remainingMs = REST_MS;
    super.endTurn();
    this.record(this.restActor, null, 'night', this.players[this.restActor].name + 'がターンを終了');
  }

  tick(now) {
    const elapsed = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    if (this.gameEnded || (this.paused && this.phase === 'turn')) return false;
    this.remainingMs = Math.max(0, this.remainingMs - elapsed);
    if (this.phase === 'turn' && !this.spawned && this.limitMs - this.remainingMs >= 60000) {
      const opponent = this.getOpponentPlayer();
      const before = opponent.worker;
      opponent.worker = Math.min(this.CONSTANTS.MAX_WORKER, opponent.worker + opponent.buffs.spawnerActive);
      if (opponent.worker > before) this.record(1 - this.currentPlayerIndex, null, 'spawn', '生命量産機から作業員が到着');
      this.spawned = true;
      if (this.remainingMs > 0) return true;
    }
    if (this.remainingMs > 0) return false;
    if (this.phase === 'turn') this.endTurn();
    else {
      this.phase = 'turn';
      this.startTurn();
    }
    return true;
  }

  getCardCost(id, player) {
    return this.free ? zero : super.getCardCost(id, player);
  }

  blocked(id) {
    if (!this.free && id === 'clock' && this.limitMs - this.remainingMs > 60000) return '定時厳守は最初の60秒のみ使えます';
    if (!this.free && id === 'supply' && this.getCurrentPlayer().buffs.usedSupply) return '支給品は1ターンに1回使えます';
    return '';
  }

  play(id, index) {
    if (!isCard(id)) return 'カードを選んでください';
    if (id === 'turn_end') { this.endTurn(); return; }
    if (ALL_CARDS[id].isToken) return '資産は手札に置くトークンです';
    const player = this.getCurrentPlayer();
    const actor = this.currentPlayerIndex;
    const blocked = this.blocked(id);
    if (blocked) return blocked;
    const cost = this.getCardCost(id, player);
    if (player.health < cost.healthCost || player.worker < cost.workerCost) return '体力または作業員が足りません';
    if (index === undefined) {
      index = player.hand.length;
      this.addCardToHand(player, id, false);
    } else if (!Number.isInteger(index) || player.hand[index] !== id) {
      return '手札が変わりました。カードを選び直してください';
    }
    if (this.free && id === 'supply') player.buffs.usedSupply = false;
    if (!super.playCard(index)) return 'このカードは現在使えません';
    if (id === 'totem_of_undying') this.limitMs = this.remainingMs = 30000;
    if (!this.gameEnded && this.phase === 'turn') this.checkWinCondition();
    this.record(actor, id, 'card', player.name + 'が「' + ALL_CARDS[id].name + '」を使用', this.cardOutcome);
  }

  applyAction({ type, id, index, actor }) {
    if (this.gameEnded || this.phase !== 'turn') return '次のターンまでお待ちください';
    if (actor !== this.currentPlayerIndex) return '手番が切り替わりました';
    if (type === 'play') return this.play(id, index);
    if (type === 'end') return this.endTurn();
    if (type === 'craft') {
      if (!Object.hasOwn(CRAFT_RECIPES, id) || !this.craft(id)) return '必要な資源が揃っていません';
      this.record(actor, id, 'craft', this.players[actor].name + 'が「' + CRAFT_RECIPES[id].name + '」を作成');
    }
  }

  setAsset(player, count) {
    for (let n = player.hand.length - 1; n >= 0; n--) {
      if (player.hand[n] === 'shisan') this._removeCardFromHand(player, n);
    }
    for (let n = 0; n < count; n++) this.addCardToHand(player, 'shisan');
    player.buffs.assetManagement = count > 0;
  }

  applyValues(side, values) {
    const player = this.players[side];
    for (const field of PLAYER_FIELDS) {
      if (!Number.isInteger(values[field.key])) continue;
      const value = readValue(values, field);
      if (field.key === 'asset') this.setAsset(player, value);
      else if (Object.hasOwn(RESOURCES, field.key)) player.resources[field.key] = value;
      else player[field.key] = value;
    }
    player.health = Math.min(player.health, player.maxHealth);
    if (this.phase === 'turn') {
      this.turnNumber = readValue(values, TURN_FIELDS[0], this.turnNumber);
      if (Number.isInteger(values.seconds)) {
        this.remainingMs = readValue(values, TURN_FIELDS[1]) * 1000;
        this.limitMs = Math.max(this.limitMs, this.remainingMs);
      }
    }
    this.record(side, null, 'edit', player.name + 'の状態を更新');
  }

  applyControl(request) {
    const { type, actor, values, id, enabled } = request;
    if (type === 'paused' && typeof enabled === 'boolean') this.paused = enabled;
    if (type === 'free' && typeof enabled === 'boolean') this.free = enabled;
    if (type === 'dusk' && !this.gameEnded && this.phase === 'turn') {
      this.paused = false;
      this.remainingMs = Math.min(this.remainingMs, 4100);
    }
    if (!isSide(actor)) return;
    if (type === 'edit' && values && typeof values === 'object') this.applyValues(actor, values);
    if (type === 'turn') {
      if (actor === this.currentPlayerIndex && this.phase === 'turn' && !this.gameEnded) return;
      this.currentPlayerIndex = actor;
      this.phase = 'turn';
      this.gameEnded = false;
      this.winner = null;
      this.resetClock();
      this.record(actor, null, 'edit', this.players[actor].name + 'に手番を変更');
    }
    if (type === 'deal' && isCard(id) && id !== 'turn_end') {
      const player = this.players[actor];
      if (player.hand.length >= 160) return '手札が多すぎます。盤面を初期化してください';
      this.addCardToHand(player, id, false);
      this.record(actor, id, 'deal', player.name + 'の手札に「' + ALL_CARDS[id].name + '」を追加');
    }
    if (type === 'use') return this.applyAction({ type: 'play', id, actor });
  }

  snapshot() {
    const phase = this.gameEnded ? 'finished' : this.phase;
    const rest = phase === 'rest';
    return {
      round: rest ? this.restRound : this.turnNumber,
      active: rest ? this.restActor : this.currentPlayerIndex,
      phase, winner: this.winner, event: this.event,
      limitMs: this.limitMs, paused: this.paused, free: this.free,
      remainingMs: this.gameEnded ? 0 : this.remainingMs,
      costs: Object.fromEntries(Object.keys(ALL_CARDS).map(id => [id, this.getCardCost(id, this.getCurrentPlayer())])),
      blocked: Object.keys(ALL_CARDS).filter(id => this.blocked(id)),
      players: this.players.map(player => ({
        name: player.name, health: player.health, maxHealth: player.maxHealth, worker: player.worker,
        mining: player.mining, resources: player.resources, hand: player.hand, handCount: player.hand.length,
        asset: player.handCounts.shisan ?? 0, cardUsedCount: player.cardUsedCount,
        craftTable: player.buffs.craftTableActive, anvil: player.buffs.anvilActive,
        stage: {
          cards: player.cardsReceived, supplies: player.suppliesReceived,
          seedlings: player.buffs.naturalBreath, wheat: player.buffs.feastNext,
          rails: player.buffs.minecartBonus, shield: player.buffs.shieldTurns > 0,
          altar: player.buffs.beaconTurns, airlift: player.buffs.elytraActive, spy: player.buffs.repeaterTurns,
          spawner: player.buffs.spawnerActive, toolkit: player.buffs.shulkerBoxActive,
          barrier: player.buffs.barrierActive, hostage: player.buffs.hostageNext, noSupply: player.buffs.noSupplyNext,
          recruitment: player.buffs.turtleEggNext, wind: player.buffs.windyTurns,
          lava: player.buffs.lavaActive, egg: player.buffs.dragonEggActive, trades: player.buffs.emeraldCount,
          timeCut: player.buffs.timeLimitReduction,
        },
      })),
    };
  }
}

export function bindDeveloper(socket) {
  let game = new DeveloperGame(Date.now());
  let session = 0;
  let second = -1;
  const send = () => socket.emit('room', {
    session: 'developer-' + session, code: null, index: 0, names,
    preview: true, developer: true, match: game.snapshot(),
  });
  const update = handler => (request = {}) => {
    if (!request || typeof request !== 'object') return;
    game.tick(Date.now());
    const error = handler(request);
    if (error) socket.emit('notice', error);
    send();
  };
  socket.on('action', update(request => game.applyAction(request)));
  socket.on('developer', update(request => game.applyControl(request)));
  socket.on('preview-dusk', update(() => game.applyControl({ type: 'dusk' })));
  socket.on('preview', () => {
    game = new DeveloperGame(Date.now());
    session++;
    send();
  });
  const timer = setInterval(() => {
    const changed = game.tick(Date.now());
    const nextSecond = Math.ceil(game.remainingMs / 1000);
    if (changed || (!game.gameEnded && nextSecond !== second)) {
      second = nextSecond;
      send();
    }
  }, 50);
  socket.on('disconnect', () => clearInterval(timer));
  socket.emit('developer-ready');
  send();
}
