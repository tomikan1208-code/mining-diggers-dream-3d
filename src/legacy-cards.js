// Card definitions and recipes from mining_diggers_dream_2/js/constants.js.
// ゲーム定数
const CONSTANTS = {
    // 勝利条件
    MINING_TO_WIN: 15,

    // ターン制限時間（秒）
    TURN_TIME_LIMIT: 120,

    // 初期値
    INITIAL_HEALTH: 2,
    INITIAL_HEALTH_AFTER_FIRST: 10,
    INITIAL_WORKER: 0,
    INITIAL_MINING: 0,

    // 上限値
    MAX_HEALTH: 10,
    MAX_WORKER: 10,

    // ターン回復
    TURN_HEALTH_RECOVERY: 3,
    INITIAL_DRAW: 3,        // ゲーム開始（各プレイヤー最初のターン）のドロー枚数。以降のターンは支給品+1枚

    //デッキサイズ
    DECK_SIZE: 12
};

// カードデータ（59種類）
const CARD_DATA = {
    // 支給品（自動配布）
    supply: {
        id: 'supply',
        name: '支給品',
        healthCost: 2,
        workerCost: 0,
        description: 'アイテム+1、木材+2\nこのアイテムはターン毎に一度使用できる',
        category: 'auto'
    },

    // 資産トークン（プレイ不可）
    shisan: {
        id: 'shisan',
        name: '資産',
        healthCost: 0,
        workerCost: 0,
        description: 'プレイ不可\n資産運用の効果を失う時、このカードも全て失う',
        category: 'token',
        isToken: true
    },

    // デッキ構築可能カード
    torch: {
        id: 'torch',
        name: '湧き潰し',
        healthCost: 2,
        workerCost: 0,
        description: 'アイテム+3',
        category: 'draw'
    },

    wooden_shovel: {
        id: 'wooden_shovel',
        name: '大区画整備',
        healthCost: 1,
        workerCost: 0,
        description: '作業員が2以上のプレイヤーは\nアイテム+2',
        category: 'draw'
    },

    totem_of_undying: {
        id: 'totem_of_undying',
        name: '僅かな猶予',
        healthCost: 1,
        workerCost: 0,
        description: 'アイテム+1\nターンの経過時間を0秒にする\nこのターンの制限時間を30秒にする',
        category: 'time'
    },

    feather: {
        id: 'feather',
        name: '天への祈り',
        healthCost: 2,
        workerCost: 0,
        description: 'お互いはアイテム+1\nお互いはすべての効果を失う',
        category: 'reset'
    },

    book: {
        id: 'book',
        name: '好奇心と知識欲',
        healthCost: 6,
        workerCost: 0, // variable cost handled in logic
        description: '自分はアイテム+6\n相手の採掘の値と同じだけ\nこのアイテムのコスト-1\n（最大-5）',
        category: 'draw'
    },

    emerald: {
        id: 'emerald',
        name: 'より良い交易',
        healthCost: 2,
        workerCost: 0,
        description: 'アイテム+1\nこのゲーム中、自分が「より良い交易」を\n既に4回以上使用していたなら\nさらに「掘り進めIV」+1',
        category: 'draw'
    },

    blaze_powder: {
        id: 'blaze_powder',
        name: '火気厳禁',
        healthCost: 0,
        workerCost: 0,
        description: '自分はアイテム+1\n相手は「火打石」+1',
        category: 'draw'
    },

    glowstone_dust: {
        id: 'glowstone_dust',
        name: '悠久の煌めき',
        healthCost: 2,
        workerCost: 0,
        description: 'アイテム+2、体力-1\nこれを体力が0になるまで繰り返す',
        category: 'draw'
    },

    chest: {
        id: 'chest',
        name: '秘めたる財宝',
        healthCost: 10,
        workerCost: 0,
        description: '自分のデッキのすべてのアイテムを\n1つずつ得る',
        category: 'draw'
    },

    ghast_tear: {
        id: 'ghast_tear',
        name: '虹の雫',
        healthCost: 3,
        workerCost: 0,
        description: '「色彩の奏I」～「色彩の奏VII」の中から\nランダムに2つ得る',
        category: 'draw'
    },

    shulker_box: {
        id: 'shulker_box',
        name: '私物持ち込み',
        healthCost: 3,
        workerCost: 0,
        description: '「掘り進めI」+2\nこのターン終了時まで、「掘り進めI～IV」のコスト-1\nこの効果はアイテムのコストを0にできる\nこの効果は重複しない',
        category: 'buff'
    },

    elytra: {
        id: 'elytra',
        name: '快適な空の旅',
        healthCost: 1,
        workerCost: 0,
        description: 'このターン中、自分の体力が増加するたび\nアイテム+1\nこの効果は重複しない',
        category: 'buff'
    },

    beacon: {
        id: 'beacon',
        name: '神秘の加護',
        healthCost: 4,
        workerCost: 0,
        description: '次の自分のターン中、自分の採掘が増加する時\n追加で採掘+1\nこの効果は重複しない\n手持ちの鉄が9個以上なら\nこのアイテムのコスト-4',
        category: 'buff'
    },

    crafting_table: {
        id: 'crafting_table',
        name: '上質な工具',
        healthCost: 0,
        workerCost: 0,
        description: 'このターン終了時まで\nクラフトに必要な木材-1\nこの効果は重複しない',
        category: 'buff'
    },

    anvil: {
        id: 'anvil',
        name: '熟練の鍛冶師',
        healthCost: 2,
        workerCost: 0,
        description: 'このターン終了時まで\n素材に鉄を用いるクラフトを行った時\n完成品を2つ作成する\nこの効果は重複しない',
        category: 'buff'
    },

    shield: {
        id: 'shield',
        name: '堅牢な壁',
        healthCost: 0,
        workerCost: 0,
        description: '次の自分のターン開始時まで\n自分はアイテムの効果で体力と作業員を失わない',
        category: 'buff'
    },

    bow: {
        id: 'bow',
        name: '狙いを定めて',
        healthCost: 0,
        workerCost: 0,
        description: '相手は作業員-1\n自分の体力が5以上なら\n相手はさらに作業員-1',
        category: 'debuff'
    },

    cobweb: {
        id: 'cobweb',
        name: '人質の取引',
        healthCost: 1,
        workerCost: 0,
        description: '相手は作業員-1\n次の自分のターン開始時\n相手は作業員+1、自分はアイテム+1',
        category: 'debuff'
    },

    player_head: {
        id: 'player_head',
        name: '洗脳実験',
        healthCost: 1,
        workerCost: 0,
        description: '相手は作業員-1、自分は作業員+1',
        category: 'debuff'
    },

    tnt: {
        id: 'tnt',
        name: '爆破工作',
        healthCost: 5,
        workerCost: 0,
        description: '相手は採掘-5',
        category: 'debuff'
    },

    gold_nugget: {
        id: 'gold_nugget',
        name: '権利の買収',
        healthCost: 7,
        workerCost: 0,
        description: 'お互いの採掘の値を入れ替える\n相手は体力+7\nこのアイテムは「採掘が増減した」判定にならない',
        category: 'special'
    },

    lava_bucket: {
        id: 'lava_bucket',
        name: '足元危険',
        healthCost: 1,
        workerCost: 0,
        description: '次に採掘が増加したプレイヤーは\n「体力を0にする」を行う\nこの効果は重複しない',
        category: 'trap'
    },

    stick: {
        id: 'stick',
        name: '孤立無援',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いは作業員を1にする\n相手は次のターン\n「支給品」を得られなくなる',
        category: 'debuff'
    },

    barrier: {
        id: 'barrier',
        name: '差し止め',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いは採掘が増加しなくなる\nお互いは「許可証」+1',
        category: 'special'
    },

    name_tag: {
        id: 'name_tag',
        name: '許可証',
        healthCost: 2,
        workerCost: 0,
        description: '「掘り進めI」+1\n「差し止め」の効果を失う',
        category: 'special'
    },

    iron_horse_armor: {
        id: 'iron_horse_armor',
        name: '風のように疾く',
        healthCost: 2,
        workerCost: 0,
        description: '次の相手のターン開始時、相手はターンを終了する\n次の自分のターン開始時、自分はターンを終了する',
        category: 'special'
    },

    // 戦の流儀シリーズ
    wooden_sword: {
        id: 'wooden_sword',
        name: '戦の流儀I',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いは作業員+3',
        category: 'buff'
    },

    stone_sword: {
        id: 'stone_sword',
        name: '戦の流儀II',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いはアイテム+2',
        category: 'buff'
    },

    iron_sword: {
        id: 'iron_sword',
        name: '戦の流儀III',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いは体力+2',
        category: 'buff'
    },

    // 切り倒せシリーズ
    wooden_axe: {
        id: 'wooden_axe',
        name: '切り倒せI',
        healthCost: 0,
        workerCost: 1,
        description: '木材+7',
        category: 'resource'
    },

    stone_axe: {
        id: 'stone_axe',
        name: '切り倒せII',
        healthCost: 1,
        workerCost: 1,
        description: '木材+12',
        category: 'resource'
    },

    iron_axe: {
        id: 'iron_axe',
        name: '切り倒せIII',
        healthCost: 1,
        workerCost: 2,
        description: '木材+20',
        category: 'resource'
    },

    oak_sapling: {
        id: 'oak_sapling',
        name: '自然の息吹',
        healthCost: 1,
        workerCost: 0,
        description: 'この先、自分のターン開始時\n木材+1\nこの効果は10回まで重複する',
        category: 'buff'
    },

    // 掘り進めシリーズ
    wooden_pickaxe: {
        id: 'wooden_pickaxe',
        name: '掘り進めI',
        healthCost: 1,
        workerCost: 1,
        description: '採掘+1、丸石+3',
        category: 'mining'
    },

    stone_pickaxe: {
        id: 'stone_pickaxe',
        name: '掘り進めII',
        healthCost: 2,
        workerCost: 2,
        description: '採掘+2、丸石+2、鉄+3',
        category: 'mining'
    },

    iron_pickaxe: {
        id: 'iron_pickaxe',
        name: '掘り進めIII',
        healthCost: 2,
        workerCost: 3,
        description: '採掘+3、丸石+3、鉄+2',
        category: 'mining'
    },

    golden_pickaxe: {
        id: 'golden_pickaxe',
        name: '脆い刃先',
        healthCost: 2,
        workerCost: 0,
        description: '採掘が1以下なら、採掘+2、丸石+2\n採掘が2以上なら、採掘+1、丸石+1',
        category: 'mining'
    },

    oak_fence: {
        id: 'oak_fence',
        name: '共同作業',
        healthCost: 0,
        workerCost: 0,
        description: 'お互いは採掘+1、丸石+2',
        category: 'mining'
    },

    gunpowder: {
        id: 'gunpowder',
        name: '強引な削岩',
        healthCost: 1,
        workerCost: 0, // 効果で両者-1だが、使用コストは0
        description: 'お互いは採掘+2、作業員-1',
        category: 'mining'
    },

    piston: {
        id: 'piston',
        name: '文明の利器',
        healthCost: 15,
        workerCost: 2,
        description: '採掘+4、丸石+2\n現在のターン数と同じだけ\nこのアイテムのコスト-1（最大-14）',
        category: 'mining'
    },

    nether_star: {
        id: 'nether_star',
        name: '大いなる輝き',
        healthCost: 5,
        workerCost: 0,
        description: 'アイテム+1、採掘+1、作業員+1の中から\nランダムに1つ得る\nこれを5回繰り返す',
        category: 'random'
    },

    minecart: {
        id: 'minecart',
        name: '整備された坑道',
        healthCost: 6,
        workerCost: 0,
        description: 'この先、自分のターン終了時\n採掘+1',
        category: 'buff'
    },

    repeater: {
        id: 'repeater',
        name: '技術の盗用',
        healthCost: 1,
        workerCost: 0,
        description: '次の相手のターン中\n相手の採掘が増加したとき\n自分は採掘+1\nこの効果は重複しない',
        category: 'buff'
    },

    lead: {
        id: 'lead',
        name: '日雇い作業員',
        healthCost: 1,
        workerCost: 0,
        description: '相手は作業員-1、丸石+3、鉄+2\n自分は採掘+1',
        category: 'mining'
    },

    // 安息の地シリーズ
    oak_door: {
        id: 'oak_door',
        name: '安息の地I',
        healthCost: 1,
        workerCost: 0,
        description: '作業員+2\nターンを終了する',
        category: 'worker'
    },

    iron_door: {
        id: 'iron_door',
        name: '安息の地II',
        healthCost: 2,
        workerCost: 0,
        description: '作業員+3',
        category: 'worker'
    },

    clock: {
        id: 'clock',
        name: '定時厳守',
        healthCost: 0,
        workerCost: 0,
        description: 'このターンの時間が60秒以内なら\n体力+2、ターンを終了する',
        category: 'special'
    },

    beef: { // cooked_beef -> beef in command
        id: 'beef',
        name: '小さな贅沢',
        healthCost: 1,
        workerCost: 0,
        description: '作業員+1\n体力が5以上なら、体力+1',
        category: 'worker'
    },

    dragon_breath: {
        id: 'dragon_breath',
        name: '怪しげな秘薬',
        healthCost: 2,
        workerCost: 0,
        description: '体力+4\nこの先、自分のターンの制限時間-30秒',
        category: 'health'
    },

    command_block: {
        id: 'command_block',
        name: '絶対の力',
        healthCost: 2,
        workerCost: 0,
        description: 'お互いは体力を2倍にする\n（コストの支払いが先）',
        category: 'health'
    },

    rabbit_stew: {
        id: 'rabbit_stew',
        name: '配給の時間',
        healthCost: 1,
        workerCost: 0,
        description: 'お互いはそれぞれの\n作業員の値と同じだけ、体力+1\nターンを終了する',
        category: 'health'
    },

    dragon_egg: {
        id: 'dragon_egg',
        name: '深淵にて眠る者',
        healthCost: 20,
        workerCost: 0,
        description: '体力の最大値を20にし、体力+10\nこのターン終了時、お互いは採掘+20\nこの時、すべての効果は無視される\nお互いの採掘の値の合計と同じだけ\nこのアイテムのコスト-1（最大-19）',
        category: 'special'
    },

    brick: {
        id: 'brick',
        name: '丈夫な家づくり',
        healthCost: 5,
        workerCost: 0,
        description: '手持ちの丸石1つにつき、体力+1\n手持ちの木材1つにつき、アイテム+1\n（それぞれ最大5）\nその後、丸石-5、木材-5',
        category: 'special'
    },

    stone_hoe: {
        id: 'stone_hoe',
        name: '豊穣の宴',
        healthCost: 2,
        workerCost: 0,
        description: '次の自分のターン開始時、小麦+4',
        category: 'resource'
    },

    poppy: {
        id: 'poppy',
        name: '園芸の心得',
        healthCost: 1,
        workerCost: 0,
        description: '「豊穣の宴」が手持ちにあるなら\nコストを支払わずに1回発動する\n「豊穣の宴」が手持ちにないなら\n「豊穣の宴」+1',
        category: 'special'
    },

    gold_ingot: {
        id: 'gold_ingot',
        name: '資産運用',
        healthCost: 3,
        workerCost: 0,
        description: '「資産」+2\nこの先、自分のターン開始時\n「資産」の数と同じだけ体力+1\nその後、「資産」-1\nこの効果は重複しない',
        category: 'buff'
    },

    turtle_egg: {
        id: 'turtle_egg',
        name: '地に満ちよ',
        healthCost: 3,
        workerCost: 0,
        description: '使用直後と次の自分のターン開始時\nそれぞれ作業員+3',
        category: 'worker'
    },

    spawner: {
        id: 'spawner',
        name: '生命量産機',
        healthCost: 3,
        workerCost: 0,
        description: 'この先、自分のターン開始時と\n相手のターンが60秒経過した時\n自分は作業員+1',
        category: 'buff'
    },

    paper: {
        id: 'paper',
        name: '粗雑な指令書',
        healthCost: 1,
        workerCost: 0,
        description: '自分の作業員が1以下なら、自分は作業員を2にする\n自分の作業員が2以上なら、相手は作業員-2',
        category: 'worker'
    },

    enchanting_table: {
        id: 'enchanting_table',
        name: '利便性を求めて',
        healthCost: 30, // logic reduces to 3
        workerCost: 0,
        description: 'ランダムな永続のエンチャントを得る\nエンチャントは1つしか保持できない\nこのゲーム中に自分がアイテムを\n30回以上使用しているなら\nこのアイテムのコストを3にする',
        category: 'special'
    },

    // 追加カード（他カードから生成される）
    flint_and_steel: {
        id: 'flint_and_steel',
        name: '火打石',
        healthCost: 1,
        workerCost: 0,
        description: '相手は作業員-4\n直前のターンに相手が\n「火気厳禁」を使用していたなら\n代わりに相手は採掘-2',
        category: 'debuff'
    },

    diamond_pickaxe: {
        id: 'diamond_pickaxe',
        name: '掘り進めIV',
        healthCost: 1,
        workerCost: 1,
        description: '採掘+5、丸石+5、鉄+5',
        category: 'mining'
    },

    bread: {
        id: 'bread',
        name: 'パン',
        healthCost: 1,
        workerCost: 0,
        description: '体力+2、作業員+2',
        category: 'health'
    },

    turn_end: {
        id: 'turn_end',
        name: 'ターンエンド',
        healthCost: 0,
        workerCost: 0,
        description: 'ターンエンド',
        category: 'token',
        isToken: true,
        hideCost: true
    }
};

// クラフトレシピ
const CRAFT_RECIPES = {
    wooden_sword: {
        id: 'wooden_sword',
        name: '戦の流儀I',
        materials: { wood: 3 },
        result: 'wooden_sword'
    },
    stone_sword: {
        id: 'stone_sword',
        name: '戦の流儀II',
        materials: { wood: 1, cobble: 2 },
        result: 'stone_sword'
    },
    iron_sword: {
        id: 'iron_sword',
        name: '戦の流儀III',
        materials: { wood: 1, iron: 2 },
        result: 'iron_sword',
        usesIron: true
    },
    oak_door: {
        id: 'oak_door',
        name: '安息の地I',
        materials: { wood: 2 },
        result: 'oak_door'
    },
    iron_door: {
        id: 'iron_door',
        name: '安息の地II',
        materials: { iron: 2 },
        result: 'iron_door',
        usesIron: true
    },
    wooden_axe: {
        id: 'wooden_axe',
        name: '切り倒せI',
        materials: { wood: 5 },
        result: 'wooden_axe'
    },
    stone_axe: {
        id: 'stone_axe',
        name: '切り倒せII',
        materials: { wood: 2, cobble: 3 },
        result: 'stone_axe'
    },
    iron_axe: {
        id: 'iron_axe',
        name: '切り倒せIII',
        materials: { wood: 2, iron: 3 },
        result: 'iron_axe',
        usesIron: true
    },
    stone_hoe: {
        id: 'stone_hoe',
        name: '豊穣の宴',
        materials: { wood: 2, cobble: 2 },
        result: 'stone_hoe'
    },
    wooden_pickaxe: {
        id: 'wooden_pickaxe',
        name: '掘り進めI',
        materials: { wood: 5 },
        result: 'wooden_pickaxe'
    },
    stone_pickaxe: {
        id: 'stone_pickaxe',
        name: '掘り進めII',
        materials: { wood: 2, cobble: 3 },
        result: 'stone_pickaxe'
    },
    iron_pickaxe: {
        id: 'iron_pickaxe',
        name: '掘り進めIII',
        materials: { wood: 2, iron: 3 },
        result: 'iron_pickaxe',
        usesIron: true
    },
    wooden_shovel: {
        id: 'wooden_shovel',
        name: '大区画整備',
        materials: { wood: 3 },
        result: 'wooden_shovel'
    },
    shield: {
        id: 'shield',
        name: '堅牢な壁',
        materials: { wood: 3, iron: 1 },
        result: 'shield',
        usesIron: true
    },
    bread: {
        id: 'bread',
        name: 'パン',
        materials: { wheat: 3 },
        result: 'bread'
    }
};

// 虹の奏シリーズ（虹の雫でランダム生成）
const RAINBOW_CARDS = {
    red_wool: {
        id: 'red_wool',
        name: '色彩の奏I',
        healthCost: 0,
        workerCost: 0,
        description: 'アイテム+1',
        category: 'draw'
    },
    orange_wool: {
        id: 'orange_wool',
        name: '色彩の奏II',
        healthCost: 1,
        workerCost: 0,
        description: 'アイテム+2',
        category: 'draw'
    },
    yellow_wool: {
        id: 'yellow_wool',
        name: '色彩の奏III',
        healthCost: 0,
        workerCost: 0,
        description: '作業員+2',
        category: 'worker'
    },
    green_wool: {
        id: 'green_wool',
        name: '色彩の奏IV',
        healthCost: 1,
        workerCost: 0,
        description: '作業員+4',
        category: 'worker'
    },
    light_blue_wool: {
        id: 'light_blue_wool',
        name: '色彩の奏V',
        healthCost: 0,
        workerCost: 0,
        description: '体力+2',
        category: 'health'
    },
    blue_wool: {
        id: 'blue_wool',
        name: '色彩の奏VI',
        healthCost: 1,
        workerCost: 0,
        description: '体力+4',
        category: 'health'
    },
    purple_wool: {
        id: 'purple_wool',
        name: '色彩の奏VII',
        healthCost: 0,
        workerCost: 0,
        description: '採掘+1',
        category: 'mining'
    }
};

// カード図鑑・デッキ構築の表示順（テーマ／系統でまとめた正準順）。
// 英語名順だと「掘り進めI〜IV」や「色彩の奏」がバラけるため、ここで明示的に並べる。
// この配列に無いカードは末尾に名前順で並ぶ（将来カード追加時の保険）。
const CARD_ORDER = [
    // ── アイテムドロー・入手系 ──
    'supply',
    'torch', 'wooden_shovel', 'book', 'emerald', 'blaze_powder', 'glowstone_dust', 'chest',
    'ghast_tear', // 虹の雫 → 直後に「色彩の奏」を並べる
    'red_wool', 'orange_wool', 'yellow_wool', 'green_wool', 'light_blue_wool', 'blue_wool', 'purple_wool',
    'nether_star',
    // ── 採掘系（掘り進めI〜IVをまとめる）──
    'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe', 'golden_pickaxe',
    'oak_fence', 'gunpowder', 'lead', 'piston',
    // ── 作業員系 ──
    'oak_door', 'iron_door', 'beef', 'turtle_egg', 'paper',
    // ── 伐採・資源系（切り倒せI〜III）──
    'wooden_axe', 'stone_axe', 'iron_axe', 'stone_hoe',
    // ── 体力・回復系 ──
    'dragon_breath', 'command_block', 'rabbit_stew', 'bread',
    // ── バフ・強化系（戦の流儀I〜III）──
    'wooden_sword', 'stone_sword', 'iron_sword',
    'shulker_box', 'elytra', 'beacon', 'crafting_table', 'anvil', 'shield', 'oak_sapling',
    'minecart', 'repeater', 'gold_ingot', 'spawner',
    // ── 妨害・罠系 ──
    'bow', 'cobweb', 'player_head', 'tnt', 'stick', 'flint_and_steel', 'lava_bucket',
    // ── 特殊・ユーティリティ系 ──
    'gold_nugget', 'barrier', 'name_tag', 'iron_horse_armor', 'clock', 'poppy',
    'totem_of_undying', 'feather', 'enchanting_table', 'brick', 'dragon_egg',
];

// 並び順インデックス（高速比較用）
const CARD_ORDER_INDEX = {};
CARD_ORDER.forEach((id, i) => { CARD_ORDER_INDEX[id] = i; });

// カードIDの正準順比較（未登録カードは末尾→名前順）
function compareCardOrder(idA, idB) {
    const ia = (idA in CARD_ORDER_INDEX) ? CARD_ORDER_INDEX[idA] : Number.MAX_SAFE_INTEGER;
    const ib = (idB in CARD_ORDER_INDEX) ? CARD_ORDER_INDEX[idB] : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    const na = (CARD_DATA[idA] || RAINBOW_CARDS[idA] || {}).name || idA;
    const nb = (CARD_DATA[idB] || RAINBOW_CARDS[idB] || {}).name || idB;
    return na.localeCompare(nb, 'ja');
}

export { CONSTANTS, CARD_DATA, CRAFT_RECIPES, RAINBOW_CARDS, compareCardOrder };
