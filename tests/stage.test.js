import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group } from 'three';
import { DeveloperGame } from '../server/developer.js';
import { action, createMatch, stateFor } from '../server/match.js';
import { GOAL } from '../src/game-data.js';
import { buildMine, planMine, resetMine, updateMine } from '../src/board/mine.js';
import { People } from '../src/board/people.js';
import { CardScenes } from '../src/board/scenes.js';
import { SceneProps } from '../src/board/props.js';
import { LAND } from '../src/board/locations.js';

function fixture(index = 1) {
  const mine = buildMine(new Group(), new Group(), index, () => new Group());
  const paint = new Float32Array(GOAL * 2);
  const blasts = [];
  const fx = { collapse: (_mine, from, to, time) => blasts.push({ from, to, time }), burst() {}, glow() {} };
  return { mine, paint, blasts, frame: now => updateMine(mine, now, .016, fx, paint, 'polygon', false) };
}

test('a sabotage closes all five dug sections in the same frame and leaves them blocked', () => {
  const { mine, paint, blasts, frame } = fixture();
  resetMine(mine, 8);
  planMine(mine, 3, 0, 'blast');
  frame(0);
  frame(.63);
  assert.equal(mine.count, 8);
  frame(.65);
  assert.equal(mine.count, 3);
  assert.deepEqual(blasts, [{ from: 8, to: 3, time: .65 }]);
  for (const [i, section] of mine.sections.entries()) {
    assert.equal(section.cut.visible, i < 3);
    assert.equal(section.rubble.visible, i >= 3 && i < 8);
    if (section.rubble.visible) {
      assert.equal(section.changed, .65);
      assert.equal(paint[section.part], -1);
    }
  }
  frame(1.24);
  assert.ok(mine.sections.slice(3, 8).every(section => section.rock.visible && section.rock.position.y < .001));
  planMine(mine, 4, 2);
  frame(2);
  frame(2.5);
  assert.equal(mine.sections[3].rubble.visible, false);
  assert.equal(mine.sections[3].cut.visible, true);
});

test('fast consecutive blasts retain their order and stop at zero', () => {
  const { mine, blasts, frame } = fixture();
  resetMine(mine, 8);
  planMine(mine, 3, 0, 'blast');
  planMine(mine, 0, .01, 'blast');
  planMine(mine, 0, .02, 'blast');
  for (let time = 0; time < 2.4; time += .02) frame(time);
  assert.deepEqual(blasts.map(({ from, to }) => [from, to]), [[8, 3], [3, 0], [0, 0]]);
  assert.equal(mine.count, 0);
});

test('the preview and developer game both publish a real five-point loss', () => {
  const normal = createMatch(['Blue', 'Red'], 1, true);
  assert.equal(action(normal, 0, { type: 'play', id: 'tnt', index: 1 }, 1), undefined);
  const state = stateFor(normal, 0, 1);
  assert.equal(state.players[1].mining, 3);
  assert.deepEqual(state.players[1].hand, []);
  const developer = new DeveloperGame(1);
  assert.equal(developer.play('tnt'), undefined);
  assert.equal(developer.snapshot().players[1].mining, 3);
});

test('sabotage removes five visual sections even for an edited score past the end of the model', () => {
  const game = new DeveloperGame(0);
  game.applyValues(1, { mining: 18 });
  const old = game.snapshot().players;
  game.play('tnt');
  const mines = [fixture(0).mine, fixture(1).mine];
  const cards = new CardScenes({
    mines, people: { counts() {} }, fx: {}, props: {},
  });
  cards.update(old, null, { initial: true, actor: -1, now: 0 });
  cards.update(game.snapshot().players, old, { card: 'tnt', kind: 'card', actor: 0, now: 1 });
  assert.equal(mines[1].count, GOAL);
  assert.equal(mines[1].goal, GOAL - 5);
  cards.update(game.snapshot().players, game.snapshot().players, { actor: -1, now: 2 });
  assert.equal(mines[1].queue.length, 1);
});

test('a departing worker walks out from the current position while cameras share the same route', () => {
  const people = new People(new Group(), [new Group(), new Group()]);
  const clock = { bedtime: 0, rest: 0 };
  const present = [{ worker: 1 }, { worker: 0 }];
  people.counts(present, null, null, -1, 0);
  const worker = people.available(0)[0];
  const body = worker.model.body;
  assert.ok(Math.abs(body.position.x) > LAND.halfWidth - 2);
  for (let frame = 0; frame < 130; frame++) {
    const previous = body.position.clone();
    people.frame(frame * .02, .02, clock, frame % 2 ? 'surface' : 'underground', false, [], false);
    assert.ok(body.position.distanceTo(previous) < .14);
  }
  const current = body.position.clone();
  assert.ok(Math.abs(current.x) < LAND.halfWidth - 5);
  people.counts([{ worker: 0 }, { worker: 0 }], present, null, -1, 2.6);
  assert.ok(body.position.equals(current));
  assert.equal(worker.active, true);
  for (let frame = 130; frame < 640; frame++) people.frame(frame * .02, .02, clock, 'all', false, [], false);
  assert.equal(worker.active, false);
  assert.equal(body.visible, false);
});

test('defection reuses the worker while they walk through the center', () => {
  const people = new People(new Group(), [new Group(), new Group()]);
  const clock = { bedtime: 0, rest: 0 };
  const current = [{ worker: 1 }, { worker: 2 }];
  people.counts(current, null, null, -1, 0);
  for (let frame = 0; frame < 300; frame++) people.frame(frame * .02, .02, clock, 'all', false, [], false);
  const worker = people.available(1).at(-1);
  const body = worker.model.body;
  const start = body.position.clone();
  people.counts([{ worker: 2 }, { worker: 1 }], current, 'player_head', 0, 6);
  assert.ok(body.position.equals(start));
  assert.ok(people.available(0).includes(worker));
  assert.ok(worker.transfer);
  for (let frame = 300; frame < 900; frame++) people.frame(frame * .02, .02, clock, 'all', false, [], false);
  assert.equal(worker.transfer, null);
  assert.ok(body.position.x < 0);
});

test('special card results carry actual color and pulse order to the board', () => {
  const game = new DeveloperGame(1);
  const before = game.snapshot().players[0].stage.cards;
  game.play('ghast_tear');
  const rainbow = game.snapshot();
  assert.equal(rainbow.event.outcome.rainbow.length, 2);
  assert.equal(rainbow.players[0].stage.cards, before + 2);
  assert.ok(rainbow.event.outcome.rainbow.every(card => rainbow.players[0].hand.includes(card)));
  game.play('nether_star');
  const { rolls } = game.snapshot().event.outcome;
  assert.equal(rolls.length, 5);
  assert.ok(rolls.every(({ kind, amount }) => ['mine', 'worker', 'draw'].includes(kind) && amount >= 0));
});

test('scheduling later light columns keeps the earlier five-beat sequence intact', () => {
  const props = new SceneProps(new Group());
  for (let i = 0; i < 5; i++) props.show('column', [i, 0, 0], i * .27, .37);
  for (let i = 0; i < 5; i++) {
    props.frame(.18 + i * .27, 'all', false);
    assert.deepEqual(props.items.filter(item => item.model.visible).map(item => item.model.position.x), [i]);
  }
});
