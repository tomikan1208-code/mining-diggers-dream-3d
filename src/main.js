import './style.css';
import { io } from 'socket.io-client';
import { Board, RENDER_MODES } from './board/Board.js';
import { drawIcon } from './icons.js';
import { Renderer } from './legacy-card-renderer.js';
import { CARD_DATA, RAINBOW_CARDS } from './legacy-cards.js';
import { canPlay, GOAL, RESOURCES, TURN_MS } from './game-data.js';
import { workshop } from './workshop.js';

const $ = id => document.getElementById(id);
const text = (node, value) => { if (node.textContent !== String(value)) node.textContent = value; };
const digits = n => String(n).padStart(2, '0');
const visible = (node, yes) => { node.hidden = !yes; };
const socket = io();
const board = new Board($('board'));
const turnPips = Array.from({ length: 12 }, () => document.createElement('i'));
$('day-track').append(...turnPips);

let screen = 'home';
let room = null;
let receivedAt = 0;
let entering = false;
let handOpen = false;
let selected = -1;
let handKey = '';
let busy = false;
let toastTimer;
let developmentPanel;

for (const icon of document.querySelectorAll('[data-icon]')) drawIcon(icon);
$('tab-icon').href = document.querySelector('.brand-icon canvas').toDataURL();

function campHud(element, side) {
  element.innerHTML = `
    <div class="score-readout">
      <div class="camp-heading"><i data-icon="${side === 0 ? 'flag' : 'rival'}"></i><b></b><small>${side === 0 ? 'あなた' : '相手'}</small></div>
      <div class="mine-line"><i data-icon="pick"></i><span>採掘</span><strong>00</strong><span class="goal">/ ${GOAL}</span></div>
      <div class="mine-pips" aria-hidden="true">${'<i></i>'.repeat(GOAL)}</div>
    </div>
    <div class="supply-readout">
      <div class="vitals">
        <span title="カードの体力コスト"><i data-icon="power"></i>動力 <b>—</b><small></small></span>
        <span><i data-icon="worker"></i>作業員 <b>—</b></span>
      </div>
      <div class="power-pips" aria-hidden="true">${'<i hidden></i>'.repeat(20)}</div>
      <div class="goods">${Object.entries(RESOURCES).map(([id, label]) =>
        '<span title="' + label + '" data-resource="' + id + '"><i data-icon="' + id + '"></i><small>' +
        ({ wood: '木', cobble: '石', iron: '鉄', wheat: '麦' })[id] + '</small><b></b></span>'
      ).join('')}</div>
    </div>`;
  for (const icon of element.querySelectorAll('[data-icon]')) drawIcon(icon);
  const name = element.querySelector('.camp-heading b');
  const score = element.querySelector('.mine-line strong');
  const pips = [...element.querySelectorAll('.mine-pips i')];
  const [health, workers] = element.querySelectorAll('.vitals b');
  const max = element.querySelector('.vitals small');
  const power = [...element.querySelectorAll('.power-pips i')];
  const stocks = [...element.querySelectorAll('[data-resource]')];
  return (person, nameValue, active) => {
    text(name, nameValue);
    element.classList.toggle('active', active);
    const mining = person?.mining ?? 0;
    text(score, digits(mining));
    for (const [index, pip] of pips.entries()) pip.classList.toggle('on', index < mining);
    text(health, person?.health ?? '—');
    text(max, person ? '/' + person.maxHealth : '');
    for (const [index, pip] of power.entries()) {
      visible(pip, index < (person?.maxHealth ?? 0));
      pip.classList.toggle('on', index < (person?.health ?? 0));
    }
    text(workers, person?.worker ?? '—');
    for (const stock of stocks) {
      const value = person?.resources[stock.dataset.resource] ?? '—';
      text(stock.querySelector('b'), value);
      stock.setAttribute('aria-label', RESOURCES[stock.dataset.resource] + ' ' + value);
    }
  };
}

const camp = [campHud($('hud-blue'), 0), campHud($('hud-red'), 1)];
const actingIndex = () => room?.developer ? room.match.active : room?.index;
const own = () => room?.match?.players[actingIndex()];
const myTurn = () => Boolean(room?.match?.phase === 'turn' && room.match.active === actingIndex());
const workshopSide = () => room?.developer ? actingIndex() : 0;
const cardFor = id => CARD_DATA[id] ?? RAINBOW_CARDS[id];
const costFor = id => room.match.costs?.[id] ?? cardFor(id);
const mayPlay = (player, id) => {
  if (!room.developer) return canPlay(player, id);
  const cost = costFor(id);
  return !cardFor(id).isToken && !room.match.blocked.includes(id) &&
    player.health >= cost.healthCost && player.worker >= cost.workerCost;
};
const workshopUi = workshop({
  player: own,
  available: () => myTurn() && !busy && socket.connected,
  preview: id => board.previewProduct(id, workshopSide()),
  confirm: id => sendAction({ type: 'craft', id }),
  focus(panel) {
    if (board.ready) {
      openBoard('surface');
      board.focusWorkshop(workshopSide(), panel);
    }
  },
});

function toast(message) {
  text($('toast'), message);
  visible($('toast'), true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => visible($('toast'), false), 3100);
}

function showScreen(next) {
  screen = next;
  $('workspace').dataset.screen = next;
  visible($('home-title'), next === 'home');
  visible($('back'), next !== 'home' && !room?.developer);
  visible($('office'), next !== 'match');
  visible($('home-panel'), next === 'home');
  visible($('network-panel'), next === 'network');
  visible($('room-panel'), next === 'room');
  visible($('hud'), next === 'room' || next === 'match');
  visible($('views'), next === 'room' || next === 'match');
  visible($('commands'), next === 'match');
  if (next !== 'match') {
    setHand(false);
    $('craft-dialog').close();
    visible($('result'), false);
  }
}

function openBoard(view) {
  board.setView(view);
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
}

function exitRoom(destination) {
  entering = false;
  busy = false;
  if (socket.connected) socket.emit('leave-room');
  room = null;
  board.enter(null);
  openBoard('all');
  showScreen(destination);
  history.replaceState(null, '', location.pathname);
}

function submit(event, value) {
  if (!socket.connected) {
    toast('対戦サーバーに接続しています');
    return;
  }
  entering = true;
  text($('network-notice'), '');
  socket.emit(event, value);
}

function receive(next) {
  if (!room && !entering) return;
  const newRoom = next.session !== room?.session;
  const eventChanged = next.match?.event?.id !== room?.match?.event?.id;
  const actorChanged = next.developer && next.match?.active !== room?.match?.active;
  room = next;
  entering = false;
  busy = false;
  receivedAt = performance.now();
  if (newRoom) {
    setHand(false);
    handKey = '';
    openBoard('all');
  } else if (actorChanged || (eventChanged && ['card', 'craft'].includes(next.match?.event?.kind))) {
    selected = -1;
  }
  board.enter(room);
  showScreen(room.match ? 'match' : 'room');
  render();
}

function render() {
  const index = room.index;
  const match = room.match;
  const rival = room.names[1 - index];
  camp[0](match?.players[index], room.names[index], match?.phase === 'turn' && match.active === index);
  camp[1](match?.players[1 - index], rival ?? '相手待ち', match?.phase === 'turn' && match.active !== index);
  text(document.querySelector('[data-marker="red"]'), rival ? '相手' : '相手待ち');
  if (!match) {
    text($('room-code'), room.code);
    text($('own-seat'), room.names[index]);
    text($('rival-seat'), rival ?? '入場を待っています');
    text($('room-note'), rival ? (index === 0 ? '試作デッキで対戦できます' : '部屋主の開始を待っています') : '相手に部屋番号を伝えてください');
    $('start-match').disabled = !rival || index !== 0;
    visible($('start-match'), index === 0);
    updateClock();
    return;
  }
  text($('log-text'), match.event.text);
  const local = own();
  text($('hand-count'), local.handCount);
  text($('drawer-count'), local.handCount);
  $('craft').disabled = !myTurn();
  $('workshop-marker').disabled = !myTurn();
  $('end-turn').disabled = !myTurn() || busy;
  visible($('preview-dusk'), room.preview && match.phase !== 'finished');
  $('preview-dusk').disabled = !myTurn() || match.remainingMs < 4500;
  visible($('preview-again'), room.preview && match.phase === 'finished');
  visible($('result'), match.phase === 'finished');
  if (match.phase === 'finished') {
    text($('result-title'), match.winner === index ? '勝利' : '対戦終了');
    text($('result-text'), match.players[match.winner].name + 'が採掘15に到達');
  }
  if (!myTurn() && $('craft-dialog').open) $('craft-dialog').close();
  workshopUi.render();
  if (room.developer) developmentPanel?.render(room);
  if (handOpen) renderHand();
  updateClock();
}

function updateClock() {
  if (!room) return;
  const match = room.match;
  const limitMs = match?.limitMs ?? TURN_MS;
  const paused = match?.paused && match.phase === 'turn';
  const remaining = match ? Math.max(0, match.remainingMs - (paused ? 0 : performance.now() - receivedAt)) : TURN_MS;
  const seconds = match?.phase === 'rest' ? 0 : Math.ceil(remaining / 1000);
  const light = seconds * 1000 / limitMs;
  const stage = match?.phase === 'rest' || seconds === 0 ? '夜' : light > .75 ? '朝' : light > .283 ? '昼' : '夕';
  const label = !match ? '入場待ち' : match.phase === 'finished' ? '対戦終了'
    : match.phase === 'rest' ? '休息中' : stage;
  const takingTurns = match?.phase === 'turn';
  text($('round'), match ? digits(match.round) : '—');
  text($('clock'), match ? Math.floor(seconds / 60) + ':' + digits(seconds % 60) : '2:00');
  text($('phase-stage'), label);
  visible($('phase-divide'), takingTurns);
  visible($('phase-actor'), takingTurns);
  const actor = room.developer ? (match.active === 0 ? '青の番' : '赤の番') : (myTurn() ? 'あなたの番' : '相手の番');
  text($('phase-actor'), takingTurns ? actor : '');
  drawIcon($('time-icon'), stage === '夜' ? 'moon' : 'sun');
  const until = Math.ceil(12 * light);
  for (const [i, pip] of turnPips.entries()) {
    const targetClass = i >= until ? '' : i < 3 ? 'dusk' : 'day';
    if (pip.className !== targetClass) pip.className = targetClass;
  }
}

function setHand(open) {
  handOpen = open && Boolean(room?.match);
  visible($('hand-drawer'), handOpen);
  $('toggle-hand').setAttribute('aria-expanded', String(handOpen));
  if (handOpen) renderHand();
}

function renderHand() {
  const player = own();
  const key = JSON.stringify([player.hand, player.health, player.worker, myTurn(),
    room.developer ? player.hand.map(id => [costFor(id), mayPlay(player, id)]) : null]);
  if (handKey !== key) {
    handKey = key;
    const list = $('hand-list');
    const scroll = list.scrollLeft;
    const focus = list.contains(document.activeElement) ? document.activeElement.dataset.index : null;
    list.replaceChildren(...player.hand.map((id, index) => {
      const card = cardFor(id);
      const cost = costFor(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hand-card';
      button.dataset.index = index;
      button.classList.toggle('unavailable', !mayPlay(player, id));
      button.setAttribute('aria-label', card.name + '。体力' + cost.healthCost + '、作業員' + cost.workerCost);
      button.title = card.name;
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 360;
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d');
      Renderer.drawCard(ctx, id, 120, 180, 0, false, false, cost.healthCost, cost.workerCost, 1.91);
      button.append(canvas);
      button.addEventListener('click', () => {
        selected = index;
        cardDetail();
      });
      return button;
    }));
    list.scrollLeft = scroll;
    if (focus !== null) list.querySelector('[data-index="' + focus + '"]')?.focus({ preventScroll: true });
  }
  cardDetail();
}

function cardDetail() {
  const player = own();
  const id = player?.hand[selected];
  const card = cardFor(id);
  visible($('card-action'), Boolean(card));
  if (!card) selected = -1;
  for (const button of $('hand-list').children) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.index) === selected));
  }
  if (!card) return;
  const cost = costFor(id);
  text($('card-name'), card.name + '　体力 ' + cost.healthCost + '　作業員 ' + cost.workerCost);
  text($('card-desc'), card.description.replaceAll('\n', ' '));
  $('play-card').disabled = !myTurn() || !mayPlay(player, id) || busy;
}

function sendAction(request) {
  if (busy || !myTurn() || !socket.connected) return;
  busy = true;
  $('play-card').disabled = true;
  $('end-turn').disabled = true;
  socket.emit('action', room.developer ? { ...request, actor: actingIndex() } : request);
}

async function copyInvite() {
  if (!room?.code) return;
  const invite = new URL(location.pathname, location.origin);
  invite.searchParams.set('room', room.code);
  try {
    await navigator.clipboard.writeText(invite.href);
    toast('招待リンクをコピーしました');
  } catch {
    toast('部屋番号 ' + room.code + ' を相手に伝えてください');
  }
}

function connection(status) {
  $('connection').className = 'connection ' + status;
  text($('connection').querySelector('b'), status === 'online' ? '接続済み' : '再接続中');
}

socket.on('connect', () => {
  connection('online');
  if (new URLSearchParams(location.search).get('preview') === '1' && !room) submit('preview');
});
socket.on('disconnect', () => {
  connection('offline');
  if (room) {
    exitRoom('network');
    toast('対戦サーバーとの接続が切れました');
  }
});
socket.on('connect_error', () => connection('offline'));
socket.on('developer-ready', async () => {
  entering = true;
  document.title = '炭鉱掘りは夢を見る 3D 開発者版';
  text(document.querySelector('.build-label'), '開発者版');
  if (!developmentPanel) {
    const { developerPanel } = await import('./developer.js');
    developmentPanel = developerPanel({
      send: request => socket.emit('developer', request),
      tune(settings) {
        if (board.tunePixelLook(settings)) updateRenderBadge();
      },
      restart: () => submit('preview'),
    });
  }
  if (room?.developer) developmentPanel.render(room);
});
socket.on('room', receive);
socket.on('room-closed', reason => { exitRoom('network'); toast(reason); });
socket.on('notice', message => {
  entering = false;
  if (screen === 'network') text($('network-notice'), message);
  else toast(message);
});

const boardReady = board.load();
boardReady.then(() => {
  visible($('model-note'), false);
  for (const button of modeButtons) button.disabled = button.dataset.renderMode !== 'polygon' && !board.gaussian;
  $('render-compare').disabled = !board.gaussian;
  updateRenderBadge();
  if (board.gaussianError) toast('Gaussian模型を読み込めません。ポリゴンで表示しています。');
}).catch(error => {
  console.error(error);
  text($('model-note'), '3D模型を読み込めません。WebGL 2が利用できるブラウザーで開いてください。');
});

const modeLabels = { gaussian: 'ドット', raw: '生Gaussian', polygon: 'ポリゴン' };
const modeButtons = document.querySelectorAll('[data-render-mode]');
const mib = bytes => (bytes / 1048576).toFixed(2) + ' MiB';
const units = {
  fps: n => n.toFixed(1) + ' fps', cpu: n => n.toFixed(2) + ' ms', gpu: n => n === null ? '—' : n.toFixed(2) + ' ms',
  calls: n => Math.round(n).toLocaleString(), count: n => n.toLocaleString(), triangles: n => Math.round(n).toLocaleString(),
  cpuBytes: mib, gpuBytes: mib, fileBytes: mib,
};

function updateRenderBadge() {
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.renderMode === board.mode));
  const fps = board.meter?.live;
  text($('live-fps'), fps?.fps && fps.mode === board.mode ? Math.round(fps.fps) + ' fps' : '— fps');
}

function setRenderedMetric(field, index, value) {
  text($('render-dialog').querySelectorAll('[data-measure="' + field + '"] td')[index], units[field](value));
}

for (const button of modeButtons) button.addEventListener('click', () => {
  if (board.setMode(button.dataset.renderMode)) updateRenderBadge();
});
$('render-compare').addEventListener('click', () => {
  RENDER_MODES.forEach((mode, i) => setRenderedMetric('fileBytes', i,
    mode === 'polygon' ? board.meshBytes : board.gaussian.library.bytes));
  $('render-dialog').showModal();
});
$('measure-render').addEventListener('click', async () => {
  $('measure-render').disabled = true;
  try {
    const stats = await board.compare(mode => {
      text($('measure-status'), modeLabels[mode] + 'を測定中');
      updateRenderBadge();
    });
    RENDER_MODES.forEach((mode, i) => {
      Object.keys(units).forEach(field => setRenderedMetric(field, i, stats[mode][field]));
    });
    text($('measure-status'), '測定完了');
  } catch (error) {
    console.error(error);
    text($('measure-status'), '測定できませんでした');
  } finally {
    $('measure-render').disabled = false;
    updateRenderBadge();
  }
});
setInterval(updateRenderBadge, 400);

$('network').addEventListener('click', () => { showScreen('network'); $('player-name').focus(); });
$('preview').addEventListener('click', () => submit('preview'));
$('preview-again').addEventListener('click', () => submit('preview'));
$('create-room').addEventListener('click', () => submit('create-room', $('player-name').value));
$('join-form').addEventListener('submit', event => {
  event.preventDefault();
  submit('join-room', { code: $('room-input').value, name: $('player-name').value });
});
$('room-input').addEventListener('input', event => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
$('back').addEventListener('click', () => { exitRoom('home'); $('network').focus(); });
$('leave-room').addEventListener('click', () => exitRoom('network'));
$('start-match').addEventListener('click', () => socket.emit('start-match'));
$('copy-room').addEventListener('click', copyInvite);
$('toggle-hand').addEventListener('click', () => setHand(!handOpen));
$('hide-hand').addEventListener('click', () => { setHand(false); $('toggle-hand').focus(); });
$('play-card').addEventListener('click', () => sendAction({ type: 'play', id: own()?.hand[selected], index: selected }));
$('craft').addEventListener('click', workshopUi.show);
$('workshop-marker').addEventListener('click', workshopUi.show);
$('end-turn').addEventListener('click', () => sendAction({ type: 'end' }));
$('preview-dusk').addEventListener('click', () => socket.emit('preview-dusk'));
$('zoom-out').addEventListener('click', () => board.scale(1 / 1.22));
$('zoom-in').addEventListener('click', () => board.scale(1.22));
$('zoom-reset').addEventListener('click', () => board.reset());
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => openBoard(button.dataset.view));
}
$('help').addEventListener('click', () => $('help-dialog').showModal());
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => $(button.dataset.close).close());
}
document.addEventListener('keydown', event => {
  if (event.code === 'KeyH' && screen === 'match' && !event.repeat &&
      !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    setHand(!handOpen);
  }
});

const code = new URLSearchParams(location.search).get('room');
if (code && /^[A-Z0-9]{4}$/i.test(code)) {
  $('room-input').value = code.toUpperCase();
  showScreen('network');
}
setInterval(updateClock, 120);
