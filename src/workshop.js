import { CARD_DATA, CRAFT_RECIPES } from './legacy-cards.js';
import { Renderer } from './legacy-card-renderer.js';
import { drawIcon } from './icons.js';
import { canCraft, materialsFor, RESOURCES } from './game-data.js';

function resourceLabel(key) {
  const label = document.createElement('span');
  const icon = document.createElement('i');
  icon.dataset.icon = key;
  drawIcon(icon);
  const count = document.createElement('b');
  label.append(icon, RESOURCES[key], count);
  return { label, count };
}

export function workshop({ player, available, preview, confirm, focus }) {
  const $ = id => document.getElementById(id);
  const dialog = $('craft-dialog');
  const stocks = Object.keys(RESOURCES).map(key => ({ key, ...resourceLabel(key) }));
  $('craft-stock').append(...stocks.map(({ label }) => label));
  const canvas = $('craft-card');
  const context = canvas.getContext('2d');
  let choice = 'wooden_pickaxe';
  let rendered = '';

  const rows = Object.entries(CRAFT_RECIPES).map(([id, recipe]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recipe-row';
    button.dataset.recipe = id;
    const title = document.createElement('span');
    title.textContent = recipe.name;
    const note = document.createElement('small');
    button.append(title, note);
    button.addEventListener('click', () => {
      choice = id;
      preview(id);
      render();
    });
    return { id, button, note };
  });
  $('recipe-list').append(...rows.map(({ button }) => button));

  function render() {
    const hand = player();
    if (!dialog.open || !hand) return;
    const access = available();
    const key = JSON.stringify([choice, hand.resources, hand.craftTable, hand.anvil, access]);
    if (rendered === key) return;
    rendered = key;
    for (const { key, count } of stocks) count.textContent = hand.resources[key];
    for (const { id, button, note } of rows) {
      const ready = canCraft(hand, id);
      button.setAttribute('aria-pressed', String(id === choice));
      button.classList.toggle('unavailable', !ready);
      note.textContent = ready ? (CRAFT_RECIPES[id].usesIron && hand.anvil ? '×2' : '') : '素材不足';
    }
    const recipe = CRAFT_RECIPES[choice];
    const copies = recipe.usesIron && hand.anvil ? 2 : 1;
    $('craft-name').textContent = recipe.name + (copies > 1 ? ' ×' + copies : '');
    const card = CARD_DATA[recipe.result];
    context.clearRect(0, 0, canvas.width, canvas.height);
    Renderer.drawCard(context, recipe.result, 120, 180, 0, false, false, card.healthCost, card.workerCost, 1.91);
    const missing = [];
    $('craft-costs').replaceChildren(...Object.entries(materialsFor(hand, recipe)).map(([key, need]) => {
      const { label, count } = resourceLabel(key);
      const have = hand.resources[key];
      count.textContent = have + ' / ' + need;
      label.classList.toggle('shortfall', have < need);
      if (have < need) missing.push(RESOURCES[key] + ' ' + (need - have));
      return label;
    }));
    $('craft-status').textContent = missing.length ? '不足　' + missing.join('、') : '手札に' + copies + '枚加わります';
    $('craft-confirm').disabled = !access || missing.length > 0;
  }

  $('craft-confirm').addEventListener('click', () => {
    if (!available() || !canCraft(player(), choice)) return;
    dialog.close();
    confirm(choice);
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open) preview(null);
  });

  return {
    show() {
      if (!available() || dialog.open) return;
      rendered = '';
      dialog.showModal();
      focus(dialog.getBoundingClientRect());
      preview(choice);
      render();
      $('recipe-list').querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    },
    render,
  };
}
