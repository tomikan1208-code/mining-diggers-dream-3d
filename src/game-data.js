import { CARD_DATA, CONSTANTS, CRAFT_RECIPES } from './legacy-cards.js';

export const GOAL = CONSTANTS.MINING_TO_WIN;
export const TURN_MS = CONSTANTS.TURN_TIME_LIMIT * 1000;
export const REST_MS = 1000;
export const RESOURCES = { wood: '木材', cobble: '丸石', iron: '鉄', wheat: '小麦' };
export const STARTER_DECK = Object.freeze([
  'wooden_pickaxe', 'golden_pickaxe', 'oak_fence', 'gunpowder', 'tnt', 'paper',
  'torch', 'oak_sapling', 'stone_hoe', 'crafting_table', 'minecart', 'anvil',
]);

export function materialsFor(player, recipe) {
  return Object.fromEntries(Object.entries(recipe.materials).map(([key, value]) => [
    key, key === 'wood' && player.craftTable ? Math.max(0, value - 1) : value,
  ]));
}

export function canCraft(player, id) {
  const recipe = CRAFT_RECIPES[id];
  return Object.hasOwn(CRAFT_RECIPES, id) &&
    Object.entries(materialsFor(player, recipe)).every(([key, amount]) => player.resources[key] >= amount);
}

export function canPlay(player, id) {
  const card = CARD_DATA[id];
  return Boolean(card && !card.isToken && player.health >= card.healthCost && player.worker >= card.workerCost);
}
