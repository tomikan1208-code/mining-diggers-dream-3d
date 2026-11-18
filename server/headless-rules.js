// Base card and turn rules adapted from mining_diggers_dream_2/js/ai/headless/headless-game.js.
import { CARD_DATA, CONSTANTS, CRAFT_RECIPES, RAINBOW_CARDS } from '../src/legacy-cards.js';
import { materialsFor } from '../src/game-data.js';

export const ALL_CARDS = { ...CARD_DATA, ...RAINBOW_CARDS };
const RAINBOW_WOOLS = Object.keys(RAINBOW_CARDS);

export class HeadlessGame {
    constructor(names, deck) {
        this.CONSTANTS = CONSTANTS;
        this.players = names.map(name => this.createPlayer(name, deck));
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gameEnded = false;
        this.winner = null;
        this.players[1].health = 0;
    }

    createPlayer(name, deck) {
        return {
            name: name,
            health: this.CONSTANTS.INITIAL_HEALTH,
            maxHealth: this.CONSTANTS.MAX_HEALTH,
            worker: this.CONSTANTS.INITIAL_WORKER,
            mining: this.CONSTANTS.INITIAL_MINING,
            selectedDeck: [...deck],
            hand: [],
            handCounts: {},
            cardsReceived: 0,
            suppliesReceived: 0,
            firstTurnDone: false, // ゲーム開始の3枚ドロー判定用
            resources: { wood: 0, cobble: 0, iron: 0, wheat: 0 },
            buffs: {
                naturalBreath: 0, assetManagement: false, minecartBonus: 0,
                beaconTurns: 0, shieldTurns: 0, elytraActive: false,
                craftTableActive: false, anvilActive: false, shulkerBoxActive: false,
                repeaterTurns: 0, spawnerActive: 0, turtleEggNext: false,
                hostageNext: false, feastNext: 0, windyTurns: 0,
                timeLimitReduction: 0, barrierActive: false,
                noSupplyNext: false, lavaActive: false, emeraldCount: 0,
                usedBlazePowder: false, usedSupply: false, dragonEggActive: false
            },
            cardUsedCount: 0,
            enchantment: null
        };
    }

    getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }
    getOpponentPlayer() { return this.players[1 - this.currentPlayerIndex]; }
    getOtherPlayer(player) { return this.players[1 - this.players.indexOf(player)]; }

    // ===== ターン進行 =====

    startTurn() {
        if (this.gameEnded) return;
        const player = this.getCurrentPlayer();

        if (this.turnNumber === 1 && this.currentPlayerIndex === 0) {
            player.health = this.CONSTANTS.INITIAL_HEALTH;
            this._clearHand(player);
        } else {
            this.healPlayer(player, this.CONSTANTS.TURN_HEALTH_RECOVERY);
        }

        // 自分のターン開始時に失効するフラグ類（本体と同一）
        player.buffs.shieldTurns = 0;
        player.buffs.usedSupply = false;
        player.buffs.usedBlazePowder = false;

        this.triggerStartOfTurnEffects(player);

        if (!player.buffs.noSupplyNext) {
            this.addCardToHand(player, 'supply');
        }
        player.buffs.noSupplyNext = false;

        // ターン開始時ドロー：各プレイヤーの最初のターンは3枚、以降は支給品＋1枚（本体と同一）
        const drawCount = player.firstTurnDone ? 1 : (this.CONSTANTS.INITIAL_DRAW || 3);
        player.firstTurnDone = true;
        for (let i = 0; i < drawCount; i++) {
            const card = this.drawRandomCard(player);
            if (card) this.addCardToHand(player, card);
        }

        // 風のように疾く：ターン開始時の効果は通常通り発動した上で強制終了
        if (player.buffs.windyTurns > 0) {
            player.buffs.windyTurns--;
            this.endTurn();
        }
    }

    triggerStartOfTurnEffects(player) {
        if (player.buffs.naturalBreath > 0) {
            player.resources.wood += player.buffs.naturalBreath;
        }

        if (player.buffs.assetManagement) {
            const shisanCount = (player.handCounts['shisan'] || 0);
            if (shisanCount > 0) {
                this.healPlayer(player, shisanCount);
                this._removeCardFromHandById(player, 'shisan');
            }
        }

        if (player.buffs.feastNext > 0) {
            player.resources.wheat += player.buffs.feastNext;
            player.buffs.feastNext = 0;
        }

        if (player.buffs.turtleEggNext) {
            player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 3);
            player.buffs.turtleEggNext = false;
        }

        if (player.buffs.hostageNext) {
            const opponent = this.getOtherPlayer(player);
            opponent.worker = Math.min(this.CONSTANTS.MAX_WORKER, opponent.worker + 1);
            this.addCardToHand(player, this.drawRandomCard(player));
            player.buffs.hostageNext = false;
        }

        if (player.buffs.spawnerActive > 0) {
            player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + player.buffs.spawnerActive);
        }
    }

    endTurn() {
        if (this.gameEnded) return;

        const player = this.getCurrentPlayer();

        // 使われなかった支給品を回収
        for (let i = player.hand.length - 1; i >= 0; i--) {
            if (player.hand[i] === 'supply') {
                this._removeCardFromHand(player, i);
            }
        }

        this.triggerEndOfTurnEffects(player);

        // ターン限定バフをクリア
        player.buffs.elytraActive = false;
        player.buffs.craftTableActive = false;
        player.buffs.anvilActive = false;
        player.buffs.shulkerBoxActive = false;

        // 神秘の加護：自分のターン終了で1減少（=1の間だけ有効）
        if (player.buffs.beaconTurns > 0) player.buffs.beaconTurns--;

        // 技術の盗用：毎ターン終了時に両者とも1減少
        this.players.forEach(p => {
            if (p.buffs.repeaterTurns > 0) p.buffs.repeaterTurns--;
        });

        if (this.gameEnded) return;

        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        if (this.currentPlayerIndex === 0) {
            this.turnNumber++;
        }

        this.startTurn();
    }

    triggerEndOfTurnEffects(player) {
        if (player.buffs.minecartBonus > 0) {
            this.addMining(player, player.buffs.minecartBonus);
        }

        if (player.buffs.dragonEggActive) {
            // すべての効果（差し止め・罠・加護等）を無視して直接加算
            this.players[0].mining += 20;
            this.players[1].mining += 20;
            player.buffs.dragonEggActive = false;
            this.checkWinCondition();
        }
    }

    // ===== 共通処理 =====

    healPlayer(player, amount) {
        const before = player.health;
        player.health = Math.min(player.health + amount, player.maxHealth);
        const actual = player.health - before;

        if (actual > 0 && player.buffs.elytraActive) {
            this.addCardToHand(player, this.drawRandomCard(player));
        }
    }

    addMining(player, amount) {
        // 差し止め
        if (player.buffs.barrierActive) return;

        // 神秘の加護（次の自分のターン中のみ＝カウンター1の間）
        if (player.buffs.beaconTurns === 1) amount += 1;

        // エンチャント
        if (player.enchantment) {
            switch (player.enchantment) {
                case 'efficiency': amount += 1; break;
                case 'unbreaking': player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 2); break;
                case 'fortune': player.resources.cobble += 2; player.resources.iron += 2; break;
                case 'silk_touch':
                    this.addCardToHand(player, this.drawRandomCard(player));
                    this.addCardToHand(player, this.drawRandomCard(player));
                    break;
            }
        }

        player.mining += amount;

        // 足元危険（発動で両者から罠を除去）
        if (player.buffs.lavaActive) {
            player.health = 0;
            this.players.forEach(p => { p.buffs.lavaActive = false; });
        }

        // 技術の盗用：ターンプレイヤーの採掘増加時、非ターン側の発動者(=1)が+1
        const other = this.getOtherPlayer(player);
        if (player === this.getCurrentPlayer() &&
            other.buffs.repeaterTurns === 1 &&
            !other.buffs.barrierActive) {
            other.mining += 1;
        }

        this.checkWinCondition();
    }

    checkWinCondition() {
        const p1 = this.players[0];
        const p2 = this.players[1];

        if (p1.mining >= this.CONSTANTS.MINING_TO_WIN && p2.mining >= this.CONSTANTS.MINING_TO_WIN) {
            // 同時到達はターンプレイヤーの負け
            this.winner = 1 - this.currentPlayerIndex;
            this.gameEnded = true;
        } else if (p1.mining >= this.CONSTANTS.MINING_TO_WIN) {
            this.winner = 0;
            this.gameEnded = true;
        } else if (p2.mining >= this.CONSTANTS.MINING_TO_WIN) {
            this.winner = 1;
            this.gameEnded = true;
        }
    }

    // ===== 手札管理 =====

    addCardToHand(player, cardId, received = true) {
        if (!cardId) return;
        player.hand.push(cardId);
        player.handCounts[cardId] = (player.handCounts[cardId] || 0) + 1;
        if (received && cardId === 'supply') player.suppliesReceived++;
        else if (received && cardId !== 'shisan') player.cardsReceived++;
    }

    _removeCardFromHand(player, index) {
        if (index < 0 || index >= player.hand.length) return;
        const cardId = player.hand[index];
        player.hand.splice(index, 1);
        if (player.handCounts[cardId]) {
            player.handCounts[cardId]--;
            if (player.handCounts[cardId] <= 0) delete player.handCounts[cardId];
        }
    }

    _removeCardFromHandById(player, cardId) {
        const index = player.hand.indexOf(cardId);
        if (index !== -1) this._removeCardFromHand(player, index);
    }

    _clearHand(player) {
        player.hand = [];
        player.handCounts = {};
    }

    drawRandomCard(player) {
        if (player.selectedDeck.length === 0) return null;
        const drawableCards = player.selectedDeck.filter(cardId => {
            return cardId !== 'shisan' && cardId !== 'name_tag' && cardId !== 'supply' && cardId !== 'bread';
        });
        if (drawableCards.length === 0) return null;
        return drawableCards[Math.floor(Math.random() * drawableCards.length)];
    }

    // ===== コストとプレイ =====

    getCardCost(cardId, player) {
        const base = ALL_CARDS[cardId];
        if (!base) return null;

        let healthCost = base.healthCost;
        const workerCost = base.workerCost;
        const opponent = this.getOtherPlayer(player);

        if (cardId === 'book') {
            healthCost = Math.max(1, healthCost - Math.min(5, opponent.mining));
        } else if (cardId === 'beacon') {
            if (player.resources.iron >= 9) healthCost = Math.max(0, healthCost - 4);
        } else if (cardId === 'piston') {
            healthCost = Math.max(1, healthCost - Math.min(14, this.turnNumber));
        } else if (cardId === 'dragon_egg') {
            const totalMining = this.players[0].mining + this.players[1].mining;
            healthCost = Math.max(1, healthCost - Math.min(19, totalMining));
        } else if (cardId === 'enchanting_table') {
            if (player.cardUsedCount >= 30) healthCost = 3;
        }

        if (player.buffs.shulkerBoxActive &&
            (cardId.includes('pickaxe') || cardId === 'diamond_pickaxe')) {
            healthCost = Math.max(0, healthCost - 1);
        }

        return { healthCost, workerCost };
    }

    playCard(handIndex) {
        const player = this.getCurrentPlayer();

        if (handIndex < 0 || handIndex >= player.hand.length) {
            return false;
        }

        const cardId = player.hand[handIndex];
        const cost = this.getCardCost(cardId, player);
        if (!cost || ALL_CARDS[cardId].isToken) {
            return false;
        }

        // 使用制限
        if (cardId === 'supply' && player.buffs.usedSupply) return false;

        if (player.health < cost.healthCost) return false;
        if (player.worker < cost.workerCost) return false;

        player.health -= cost.healthCost;
        player.worker -= cost.workerCost;

        this._removeCardFromHand(player, handIndex);
        player.cardUsedCount++;

        if (cardId === 'blaze_powder') {
            player.buffs.usedBlazePowder = true;
        }

        this.cardOutcome = this._executeCardEffect(cardId);
        return true;
    }

    craft(recipeId) {
        const player = this.getCurrentPlayer();
        const recipe = CRAFT_RECIPES[recipeId];
        if (!recipe) return false;

        const materials = materialsFor({ craftTable: player.buffs.craftTableActive }, recipe);
        if (Object.entries(materials).some(([key, cost]) => player.resources[key] < cost)) return false;
        for (const [key, cost] of Object.entries(materials)) player.resources[key] -= cost;
        this.addCardToHand(player, recipe.result);
        if (player.buffs.anvilActive && recipe.usesIron) this.addCardToHand(player, recipe.result);
        return true;
    }

    // ===== カード効果 =====

    _executeCardEffect(cardId) {
        const player = this.getCurrentPlayer();
        const opponent = this.getOpponentPlayer();

        switch (cardId) {
            case 'supply':
                this.addCardToHand(player, this.drawRandomCard(player));
                player.resources.wood += 2;
                player.buffs.usedSupply = true;
                break;
            case 'torch':
                for (let i = 0; i < 3; i++) this.addCardToHand(player, this.drawRandomCard(player));
                break;
            case 'wooden_shovel':
                // 作業員2以上の両プレイヤーがアイテム+2
                [player, opponent].forEach(p => {
                    if (p.worker >= 2) {
                        for (let i = 0; i < 2; i++) this.addCardToHand(p, this.drawRandomCard(p));
                    }
                });
                break;
            case 'book':
                for (let i = 0; i < 6; i++) this.addCardToHand(player, this.drawRandomCard(player));
                break;
            case 'blaze_powder':
                this.addCardToHand(player, this.drawRandomCard(player));
                if (opponent.buffs.shieldTurns <= 0) {
                    this.addCardToHand(opponent, 'flint_and_steel');
                }
                break;
            case 'wooden_pickaxe':
                this.addMining(player, 1);
                player.resources.cobble += 3;
                break;
            case 'stone_pickaxe':
                this.addMining(player, 2);
                player.resources.cobble += 2;
                player.resources.iron += 3;
                break;
            case 'iron_pickaxe':
                this.addMining(player, 3);
                player.resources.cobble += 3;
                player.resources.iron += 2;
                break;
            case 'diamond_pickaxe':
                this.addMining(player, 5);
                player.resources.cobble += 5;
                player.resources.iron += 5;
                break;
            case 'golden_pickaxe':
                if (player.mining <= 1) {
                    this.addMining(player, 2);
                    player.resources.cobble += 2;
                } else {
                    this.addMining(player, 1);
                    player.resources.cobble += 1;
                }
                break;
            case 'oak_fence':
                this.addMining(player, 1);
                this.addMining(opponent, 1);
                player.resources.cobble += 2;
                opponent.resources.cobble += 2;
                break;
            case 'gunpowder':
                this.addMining(player, 2);
                this.addMining(opponent, 2);
                player.worker = Math.max(0, player.worker - 1);
                opponent.worker = Math.max(0, opponent.worker - 1);
                break;
            case 'piston':
                this.addMining(player, 4);
                player.resources.cobble += 2;
                break;
            case 'lead':
                if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 1);
                }
                opponent.resources.cobble += 3;
                opponent.resources.iron += 2;
                this.addMining(player, 1);
                break;
            case 'wooden_sword':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 3);
                opponent.worker = Math.min(this.CONSTANTS.MAX_WORKER, opponent.worker + 3);
                break;
            case 'stone_sword':
                for (let i = 0; i < 2; i++) {
                    this.addCardToHand(player, this.drawRandomCard(player));
                    this.addCardToHand(opponent, this.drawRandomCard(opponent));
                }
                break;
            case 'iron_sword':
                this.healPlayer(player, 2);
                this.healPlayer(opponent, 2);
                break;
            case 'wooden_axe':
                player.resources.wood += 7;
                break;
            case 'stone_axe':
                player.resources.wood += 12;
                break;
            case 'iron_axe':
                player.resources.wood += 20;
                break;
            case 'oak_door':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 2);
                this.endTurn();
                break;
            case 'iron_door':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 3);
                break;
            case 'stone_hoe':
                player.buffs.feastNext += 4;
                break;
            case 'poppy': {
                const hoeIndex = player.hand.indexOf('stone_hoe');
                if (hoeIndex !== -1) {
                    this._removeCardFromHand(player, hoeIndex);
                    this._executeCardEffect('stone_hoe');
                } else {
                    this.addCardToHand(player, 'stone_hoe');
                }
                break;
            }
            case 'beef':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 1);
                if (player.health >= 5) this.healPlayer(player, 1);
                break;
            case 'turtle_egg':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 3);
                player.buffs.turtleEggNext = true;
                break;
            case 'paper':
                if (player.worker <= 1) {
                    player.worker = 2;
                } else if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 2);
                }
                break;
            case 'bow':
                if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 1);
                    if (player.health >= 5) {
                        opponent.worker = Math.max(0, opponent.worker - 1);
                    }
                }
                break;
            case 'cobweb':
                if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 1);
                    player.buffs.hostageNext = true;
                }
                break;
            case 'player_head':
                if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 1);
                }
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 1);
                break;
            case 'tnt':
                // 盾は採掘減少を防げない
                opponent.mining = Math.max(0, opponent.mining - 5);
                break;
            case 'stick':
                player.worker = 1;
                if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = 1;
                    opponent.buffs.noSupplyNext = true;
                }
                break;
            case 'shield':
                player.buffs.shieldTurns = 1;
                break;
            case 'elytra':
                player.buffs.elytraActive = true;
                break;
            case 'beacon':
                // 2=使用ターン(不発), 1=次の自分のターン(有効)
                player.buffs.beaconTurns = 2;
                break;
            case 'crafting_table':
                player.buffs.craftTableActive = true;
                break;
            case 'anvil':
                player.buffs.anvilActive = true;
                break;
            case 'shulker_box':
                this.addCardToHand(player, 'wooden_pickaxe');
                this.addCardToHand(player, 'wooden_pickaxe');
                player.buffs.shulkerBoxActive = true;
                break;
            case 'oak_sapling':
                player.buffs.naturalBreath = Math.min(10, player.buffs.naturalBreath + 1);
                break;
            case 'minecart':
                player.buffs.minecartBonus += 1;
                break;
            case 'repeater':
                // 2=使用ターン(不発), 1=次の相手ターン(有効)
                player.buffs.repeaterTurns = 2;
                break;
            case 'spawner':
                player.buffs.spawnerActive += 1;
                break;
            case 'gold_ingot':
                this.addCardToHand(player, 'shisan');
                this.addCardToHand(player, 'shisan');
                player.buffs.assetManagement = true;
                break;
            case 'command_block':
                // 体力2倍＝現在値分の回復（上限・快適な空の旅も処理）
                this.healPlayer(player, player.health);
                this.healPlayer(opponent, opponent.health);
                break;
            case 'dragon_breath':
                this.healPlayer(player, 4);
                player.buffs.timeLimitReduction += 30;
                break;
            case 'rabbit_stew':
                this.healPlayer(player, player.worker);
                this.healPlayer(opponent, opponent.worker);
                this.endTurn();
                break;
            case 'feather': {
                this.addCardToHand(player, this.drawRandomCard(player));
                this.addCardToHand(opponent, this.drawRandomCard(opponent));
                this.players.forEach(p => this._resetBuffs(p));
                break;
            }
            case 'totem_of_undying':
                this.addCardToHand(player, this.drawRandomCard(player));
                break;
            case 'clock':
                // ヘッドレスでは時間概念がないため常に成功扱い
                this.healPlayer(player, 2);
                this.endTurn();
                break;
            case 'barrier':
                [player, opponent].forEach(p => {
                    p.buffs.barrierActive = true;
                    this.addCardToHand(p, 'name_tag');
                });
                break;
            case 'name_tag':
                this.addCardToHand(player, 'wooden_pickaxe');
                player.buffs.barrierActive = false;
                break;
            case 'lava_bucket':
                player.buffs.lavaActive = true;
                opponent.buffs.lavaActive = true;
                break;
            case 'gold_nugget': {
                const tempMining = player.mining;
                player.mining = opponent.mining;
                opponent.mining = tempMining;
                this.healPlayer(opponent, 7);
                break;
            }
            case 'emerald':
                this.addCardToHand(player, this.drawRandomCard(player));
                player.buffs.emeraldCount++;
                // 「既に4回以上使用していたなら」＝5回目以降
                if (player.buffs.emeraldCount >= 5) {
                    this.addCardToHand(player, 'diamond_pickaxe');
                }
                break;
            case 'ghast_tear': {
                const rainbow = [];
                for (let i = 0; i < 2; i++) {
                    const color = RAINBOW_WOOLS[Math.floor(Math.random() * RAINBOW_WOOLS.length)];
                    this.addCardToHand(player, color);
                    rainbow.push(color);
                }
                return { rainbow };
            }
            case 'red_wool':
                this.addCardToHand(player, this.drawRandomCard(player));
                break;
            case 'orange_wool':
                for (let i = 0; i < 2; i++) this.addCardToHand(player, this.drawRandomCard(player));
                break;
            case 'yellow_wool':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 2);
                break;
            case 'green_wool':
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 4);
                break;
            case 'light_blue_wool':
                this.healPlayer(player, 2);
                break;
            case 'blue_wool':
                this.healPlayer(player, 4);
                break;
            case 'purple_wool':
                this.addMining(player, 1);
                break;
            case 'glowstone_dust': {
                let loopCount = 0;
                while (player.health > 0 && loopCount < 25) {
                    for (let i = 0; i < 2; i++) this.addCardToHand(player, this.drawRandomCard(player));
                    player.health = Math.max(0, player.health - 1);
                    loopCount++;
                }
                break;
            }
            case 'chest': {
                const uniqueDeckCards = [...new Set(player.selectedDeck)];
                uniqueDeckCards.forEach(cId => this.addCardToHand(player, cId));
                break;
            }
            case 'iron_horse_armor':
                player.buffs.windyTurns = 1;
                opponent.buffs.windyTurns = 1;
                break;
            case 'nether_star': {
                const rolls = [];
                for (let i = 0; i < 5; i++) {
                    const r = Math.floor(Math.random() * 3);
                    if (r === 0) {
                        const card = this.drawRandomCard(player);
                        this.addCardToHand(player, card);
                        rolls.push({ kind: 'draw', amount: Number(Boolean(card)) });
                    } else if (r === 1) {
                        const before = player.mining;
                        this.addMining(player, 1);
                        rolls.push({ kind: 'mine', amount: player.mining - before });
                    } else {
                        const before = player.worker;
                        player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 1);
                        rolls.push({ kind: 'worker', amount: player.worker - before });
                    }
                }
                return { rolls };
            }
            case 'dragon_egg':
                // 最大体力20は永続（天への祈りでも消えない）
                player.maxHealth = 20;
                this.healPlayer(player, 10);
                player.buffs.dragonEggActive = true;
                break;
            case 'brick': {
                const cobbleCount = Math.min(5, player.resources.cobble);
                const woodCount = Math.min(5, player.resources.wood);
                if (cobbleCount > 0) this.healPlayer(player, cobbleCount);
                for (let i = 0; i < woodCount; i++) this.addCardToHand(player, this.drawRandomCard(player));
                player.resources.cobble = Math.max(0, player.resources.cobble - 5);
                player.resources.wood = Math.max(0, player.resources.wood - 5);
                break;
            }
            case 'enchanting_table': {
                const enchants = ['unbreaking', 'efficiency', 'fortune', 'silk_touch'];
                player.enchantment = enchants[Math.floor(Math.random() * enchants.length)];
                break;
            }
            case 'flint_and_steel':
                if (opponent.buffs.usedBlazePowder) {
                    // 採掘-2は盾で防げない
                    opponent.mining = Math.max(0, opponent.mining - 2);
                    opponent.buffs.usedBlazePowder = false;
                } else if (opponent.buffs.shieldTurns <= 0) {
                    opponent.worker = Math.max(0, opponent.worker - 4);
                }
                break;
            case 'bread':
                this.healPlayer(player, 2);
                player.worker = Math.min(this.CONSTANTS.MAX_WORKER, player.worker + 2);
                break;
            default:
                throw new Error('Unknown card effect ' + cardId);
        }
    }

    _resetBuffs(p) {
        // 天への祈り：継続効果を失う
        // ※深淵にて眠る者の効果（maxHealth 20 / dragonEggActive）は消えない
        const b = p.buffs;
        b.naturalBreath = 0;
        b.assetManagement = false;
        b.minecartBonus = 0;
        b.beaconTurns = 0;
        b.shieldTurns = 0;
        b.elytraActive = false;
        b.craftTableActive = false;
        b.anvilActive = false;
        b.shulkerBoxActive = false;
        b.repeaterTurns = 0;
        b.spawnerActive = 0;
        b.turtleEggNext = false;
        b.hostageNext = false;
        b.feastNext = 0;
        b.windyTurns = 0;
        b.barrierActive = false;
        b.noSupplyNext = false;
        b.lavaActive = false;
        // 資産トークンも失う
        for (let i = p.hand.length - 1; i >= 0; i--) {
            if (p.hand[i] === 'shisan') this._removeCardFromHand(p, i);
        }
    }
}
