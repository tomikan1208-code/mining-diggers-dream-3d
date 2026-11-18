import './developer.css';
import { CARD_DATA, RAINBOW_CARDS, compareCardOrder } from './legacy-cards.js';
import { PIXEL_DEFAULTS } from './board/Gaussian.js';
import { PLAYER_FIELDS, TURN_FIELDS } from './developer-fields.js';
import { Renderer } from './legacy-card-renderer.js';

const cards = { ...CARD_DATA, ...RAINBOW_CARDS };
const ordered = Object.keys(cards).sort(compareCardOrder);

export function developerPanel({ send, tune, restart }) {
  const toggle = document.getElementById('developer-toggle');
  const panel = document.createElement('aside');
  panel.className = 'developer-panel';
  panel.id = 'developer-panel';
  panel.setAttribute('aria-labelledby', 'developer-title');
  panel.innerHTML = `
    <div class="developer-heading">
      <h2 id="developer-title">開発ツール</h2>
      <div>
        <button type="button" class="quiet" id="developer-restart">盤面を初期化</button>
        <button type="button" class="quiet" id="developer-close">閉じる</button>
      </div>
    </div>
    <section class="developer-section developer-look" aria-labelledby="developer-look-title">
      <div class="developer-heading">
        <h3 id="developer-look-title">ピクセル描画</h3>
        <button type="button" class="quiet" id="developer-style-reset">描画設定を戻す</button>
      </div>
      <div class="developer-slider">
        <label for="developer-pixel">ピクセルサイズ</label>
        <output id="developer-pixel-value" for="developer-pixel"></output>
        <input type="range" id="developer-pixel" min="1" max="8" step="1" value="${PIXEL_DEFAULTS.size}">
      </div>
      <div class="developer-slider">
        <label for="developer-dither">ディザリング</label>
        <output id="developer-dither-value" for="developer-dither"></output>
        <input type="range" id="developer-dither" min="0" max="15" step=".1" value="${PIXEL_DEFAULTS.dither}">
      </div>
    </section>
    <section class="developer-section" aria-labelledby="developer-card-title">
      <h3 id="developer-card-title">カードを試す</h3>
      <div class="developer-sides" role="group" aria-label="操作する陣営">
        <button type="button" class="pixel-button" data-actor="0" aria-pressed="true">青の拠点</button>
        <button type="button" class="pixel-button" data-actor="1" aria-pressed="false">赤の拠点</button>
        <button type="button" class="quiet" id="developer-turn">手番にする</button>
      </div>
      <input id="developer-search" type="search" autocomplete="off" aria-label="カード名・IDで探す" placeholder="カード名・IDで探す">
      <select id="developer-card" aria-label="カード"></select>
      <div class="developer-card-detail">
        <canvas id="developer-card-image" width="180" height="270" aria-hidden="true"></canvas>
        <div>
          <p id="developer-card-description"></p>
          <label class="developer-check"><input type="checkbox" id="developer-free"> コストと使用制限を省略</label>
        </div>
      </div>
      <div class="developer-actions">
        <button type="button" class="pixel-button" id="developer-deal">手札に加える</button>
        <button type="button" class="pixel-button brass" id="developer-use">今すぐ使う</button>
      </div>
    </section>
    <section class="developer-section" aria-labelledby="developer-values-title">
      <h3 id="developer-values-title">拠点とターン</h3>
      <form id="developer-values">
        <div id="developer-fields" class="developer-fields"></div>
        <div class="developer-value-actions">
          <label class="developer-check"><input type="checkbox" id="developer-paused"> 時計を止める</label>
          <button type="submit" id="developer-apply" class="pixel-button">反映する</button>
        </div>
      </form>
    </section>
  `;
  document.getElementById('workspace').append(panel);
  const $ = id => panel.querySelector('#developer-' + id);
  const sides = [...panel.querySelectorAll('[data-actor]')];
  const search = $('search');
  const choice = $('card');
  const context = $('card-image').getContext('2d');
  const applied = new Set();
  let actor = 0;
  let match;
  let drawnCard = '';
  let chosenId = 'wooden_pickaxe';

  const fields = [...PLAYER_FIELDS, ...TURN_FIELDS].map(field => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = field.min;
    input.max = field.max;
    input.step = '1';
    input.name = field.key;
    input.id = 'developer-' + field.key;
    input.addEventListener('input', () => applied.add(field.key));
    label.append(field.label, input);
    $('fields').append(label);
    return { ...field, input };
  });

  function activate(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  function populate() {
    const query = search.value.trim().toLowerCase();
    const matches = ordered.filter(id => (cards[id].name + ' ' + id).toLowerCase().includes(query));
    choice.replaceChildren(...matches.map(id => new Option(cards[id].name, id)));
    if (matches.includes(chosenId)) choice.value = chosenId;
    choice.disabled = !matches.length;
    updateCard();
  }

  function updateCard() {
    const id = choice.value;
    const card = cards[id];
    const cost = match?.costs[id] ?? card;
    const player = match?.players[actor];
    const pays = cost && player && player.health >= cost.healthCost && player.worker >= cost.workerCost;
    const turn = match?.active === actor && match.phase === 'turn';
    $('deal').disabled = !card || !match || id === 'turn_end';
    $('use').disabled = !turn || !pays || !card || (card.isToken && id !== 'turn_end') || match.blocked.includes(id);
    $('use').textContent = id === 'turn_end' ? 'ターン終了' : '今すぐ使う';
    $('card-description').textContent = card?.description.replaceAll('\n', ' ') ?? '該当するカードがありません';
    const key = JSON.stringify([id, cost?.healthCost, cost?.workerCost]);
    if (key === drawnCard) return;
    drawnCard = key;
    context.clearRect(0, 0, 180, 270);
    if (card) Renderer.drawCard(context, id, 90, 135, 0, false, false, cost.healthCost, cost.workerCost, 1.45);
  }

  function render(snapshot) {
    match = snapshot?.match;
    if (!match) return;
    const player = match.players[actor];
    const values = { ...player, ...player.resources, round: match.round, seconds: Math.ceil(match.remainingMs / 1000) };
    for (const { input, key } of fields) {
      if (!applied.has(key)) input.value = values[key];
      if (key === 'round' || key === 'seconds') input.disabled = match.phase !== 'turn';
    }
    $('turn').disabled = match.active === actor && match.phase === 'turn';
    $('free').checked = match.free;
    $('paused').checked = match.paused;
    updateCard();
  }

  function settings(apply) {
    const size = Number($('pixel').value);
    const dither = Number($('dither').value);
    $('pixel-value').textContent = size + ' px';
    $('dither-value').textContent = dither.toFixed(1) + '%';
    if (apply) tune({ size, dither });
  }

  search.addEventListener('input', populate);
  choice.addEventListener('change', () => {
    chosenId = choice.value;
    updateCard();
  });
  for (const button of sides) {
    button.addEventListener('click', () => {
      actor = Number(button.dataset.actor);
      for (const side of sides) side.setAttribute('aria-pressed', String(button === side));
      applied.clear();
      if (match) render({ match });
    });
  }
  $('turn').addEventListener('click', () => send({ type: 'turn', actor }));
  $('deal').addEventListener('click', () => send({ type: 'deal', actor, id: choice.value }));
  $('use').addEventListener('click', () => send({ type: 'use', actor, id: choice.value }));
  $('free').addEventListener('change', event => send({ type: 'free', enabled: event.target.checked }));
  $('paused').addEventListener('change', event => send({ type: 'paused', enabled: event.target.checked }));
  $('values').addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(fields.filter(({ input, key }) => applied.has(key) && !input.disabled &&
      Number.isInteger(input.valueAsNumber)).map(({ input, key }) => [key, input.valueAsNumber]));
    applied.clear();
    send({ type: 'edit', actor, values });
  });
  for (const id of ['pixel', 'dither']) $(id).addEventListener('input', () => settings(true));
  $('style-reset').addEventListener('click', () => {
    $('pixel').value = PIXEL_DEFAULTS.size;
    $('dither').value = PIXEL_DEFAULTS.dither;
    settings(true);
  });
  $('restart').addEventListener('click', () => {
    applied.clear();
    restart();
  });
  $('close').addEventListener('click', () => { activate(false); toggle.focus(); });
  toggle.addEventListener('click', () => activate(panel.hidden));
  toggle.hidden = false;
  activate(matchMedia('(min-width: 881px)').matches);
  populate();
  settings(false);
  return { render };
}
