import { RESOURCES } from './game-data.js';
import { CONSTANTS } from './legacy-cards.js';

export const PLAYER_FIELDS = [
  { key: 'health', label: '体力', min: 0, max: 20 },
  { key: 'maxHealth', label: '体力上限', min: 1, max: 20 },
  { key: 'worker', label: '作業員', min: 0, max: CONSTANTS.MAX_WORKER },
  { key: 'mining', label: '採掘', min: 0, max: 99 },
  ...Object.entries(RESOURCES).map(([key, label]) => ({ key, label, min: 0, max: 999 })),
  { key: 'asset', label: '資産', min: 0, max: 99 },
  { key: 'cardUsedCount', label: '使用済みカード', min: 0, max: 999 },
];

export const TURN_FIELDS = [
  { key: 'round', label: 'ターン数', min: 1, max: 999 },
  { key: 'seconds', label: '残り秒', min: 0, max: CONSTANTS.TURN_TIME_LIMIT },
];

export function readValue(input, { key, min, max }, fallback) {
  const value = input[key];
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
