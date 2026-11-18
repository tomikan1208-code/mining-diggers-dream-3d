import { MathUtils, Vector3 } from 'three';
import { RESOURCES } from '../game-data.js';
import { foreman, pose, TEAM } from './art.js';
import { CAMP, groundY, LAND, rampY, roadZ, SHAFT } from './locations.js';
import { mineFace } from './mine.js';

const neutral = { cloth: 0x897255, dark: 0x554438, light: 0xc2a078 };
const shaftLane = SHAFT.track + .86;
const entry = (x, y, z, parent, covered = false) => ({
  position: new Vector3(x, y, z), parent, covered,
});

function paths(center, sign) {
  const nodes = { center };
  const add = (key, x, z, parent, y = groundY, covered = false) => {
    nodes[key] = entry(x, y, z, nodes[parent], covered);
  };
  const path = (key, x, parent, covered) => add(key, sign * x, roadZ(x), parent, groundY, covered);
  path('inner', 6.2, 'center');
  path('benchRoad', 13.5, 'inner');
  path('homeRoad', 17.2, 'benchRoad');
  path('yardRoad', 22.3, 'homeRoad');
  path('fork', 27.8, 'yardRoad');
  path('bend', 31.3, 'fork');
  path('road', CAMP.arrivalX, 'bend', true);
  add('stand', sign * CAMP.standX, CAMP.standZ, 'benchRoad');
  add('craft', sign * CAMP.mill, CAMP.millZ + 1.65, 'benchRoad');
  add('crop', sign * CAMP.plot, 1.04, 'inner');
  add('shed', sign * 4.65, -1.22, 'inner');
  add('hold', sign * 4.65, -2.51, 'shed', groundY, true);
  add('machine', sign * 6.75, -2.41, 'inner');
  add('spawner', sign * 6.75, -3.7, 'machine', groundY, true);
  add('stock', sign * CAMP.yard, CAMP.yardZ + 1.45, 'yardRoad');
  Object.keys(RESOURCES).forEach((resource, i) => {
    add(resource + 'Stock', sign * (CAMP.yard + (i - 1.5) * 1.47), CAMP.yardZ + 1.32, 'stock');
  });
  add('trade', sign * 24.75, 2.29, 'yardRoad');
  add('trail', sign * 28.5, .35, 'fork');
  add('pines', sign * 29.5, -1.45, 'trail');
  add('pinesFar', sign * 30.60, -2.11, 'trail');
  add('pinesBack', sign * 29.4, -2.98, 'trail');
  add('lookout', sign * 16.2, 4.05, 'homeRoad');
  const doorX = sign * CAMP.houseX - .68;
  add('houseYard', doorX, -1.47, 'homeRoad');
  add('porch', doorX, CAMP.houseZ + 1.46, 'houseYard', groundY + .21);
  add('lodge', doorX, CAMP.houseZ + .67, 'porch', groundY + .22, true);
  add('rampTurn', sign * 28.18, 6.39, 'fork');
  add('rampTop', sign * 27.14, shaftLane, 'rampTurn');
  add('rampEdge', sign * 26.38, shaftLane, 'rampTop', rampY(26.38) + .14);
  add('rampFoot', sign * SHAFT.startRamp, shaftLane, 'rampEdge', SHAFT.floor + .14);
  add('mine', sign * 19.4, shaftLane, 'rampFoot', SHAFT.floor + .14);
  return nodes;
}

function route(from, to) {
  const upward = [];
  const downward = [];
  for (let point = from; point; point = point.parent) upward.push(point);
  for (let point = to; point; point = point.parent) {
    const shared = upward.indexOf(point);
    if (shared >= 0) return [...upward.slice(1, shared + 1), ...downward.reverse()];
    downward.push(point);
  }
  return [];
}

function walkTo(actor, goal) {
  if (actor.goal === goal) return;
  const next = actor.steps[0];
  actor.goal = goal;
  actor.steps = next ? [next, ...route(next, goal)] : route(actor.node, goal);
}

function arrive(actor, node) {
  actor.node = actor.goal = node;
  actor.model.body.position.copy(node.position);
  actor.steps = [];
  actor.speed = 0;
  actor.stride = 0;
}

function stepAlong(actor, dt, maxSpeed, reduced) {
  const next = actor.steps[0];
  if (!next) return false;
  const body = actor.model.body;
  const distance = body.position.distanceTo(next.position);
  const yaw = Math.atan2(next.position.x - body.position.x, next.position.z - body.position.z);
  const turn = Math.atan2(Math.sin(yaw - body.rotation.y), Math.cos(yaw - body.rotation.y));
  if (distance > .001) body.rotation.y += turn * Math.min(1, dt * 10);
  actor.speed = MathUtils.damp(actor.speed, maxSpeed, 8, dt);
  const advance = reduced ? distance : Math.min(distance, dt * actor.speed);
  if (distance > 0) body.position.lerp(next.position, advance / distance);
  actor.stride += advance * 3.8;
  if (advance >= distance) actor.node = actor.steps.shift();
  return true;
}

const posts = ['mine', 'craft', 'crop', 'stock', 'lookout', 'houseYard', 'trade', 'crop', 'craft', 'stock'];
const patrolled = ['lookout', 'houseYard', 'trade', 'stock', 'craft', 'crop'];

export class People {
  constructor(parent, lodges) {
    this.parent = parent;
    this.lodges = lodges;
    const center = entry(0, groundY, roadZ(0));
    this.paths = [-1, 1].map(sign => paths(center, sign));
    this.roster = [];
    this.avatars = TEAM.map(color => this.actor(color, true));
    this.miners = TEAM.map(color => foreman(parent, color));
    this.miners.forEach(miner => miner.body.scale.setScalar(.94));
  }

  actor(color, chief = false) {
    const model = foreman(this.parent, color, chief);
    model.body.visible = false;
    return { model, chief, steps: [], active: false };
  }

  begin(actor, side, from, to, now, delay = 0) {
    const nodes = this.paths[side];
    Object.assign(actor, {
      active: true, side, until: now + delay, patrolAt: now + delay + 3.2, job: null,
      retire: null, lodge: false, transfer: null, fallAt: -Infinity,
    });
    arrive(actor, nodes[from]);
    actor.model.body.rotation.y = -Math.PI / 2 * (side === 0 ? -1 : 1);
    walkTo(actor, nodes[to]);
  }

  reset() {
    for (const actor of [...this.avatars, ...this.roster]) {
      actor.active = actor.model.body.visible = false;
      actor.job = null;
    }
    this.miners.forEach(miner => { miner.body.visible = false; });
    this.minesReady = false;
    this.lodges.forEach(door => { door.rotation.y = 0; });
  }

  presence(side, present, now) {
    const actor = this.avatars[side];
    const nodes = this.paths[side];
    if (present && !actor.active) {
      this.begin(actor, side, 'road', 'stand', now);
      actor.post = 'stand';
    } else if (!present && actor.active && !actor.retire) {
      this.cancel(actor);
      actor.retire = 'exit';
      walkTo(actor, nodes.road);
    }
  }

  available(side) {
    return this.roster.filter(actor => actor.active && actor.side === side && !actor.retire);
  }

  acquire(side, from, to, now, delay = 0, color = TEAM[side]) {
    let actor = this.roster.find(candidate => !candidate.active);
    if (!actor) {
      actor = this.actor(color);
      this.roster.push(actor);
    }
    actor.model.setTeam(color);
    this.begin(actor, side, from, to, now, delay);
    return actor;
  }

  visitor(side, place, now, hold = .5, onArrive, onDone) {
    const actor = this.acquire(side, 'road', place, now, 0, neutral);
    actor.retire = 'visitor';
    this.assign(actor, [{ place, carry: true, hold, onArrive, onDone }, { place: 'road' }]);
  }

  cancel(actor) {
    const job = actor.job;
    if (!job) return;
    for (const step of job.jobs.slice(job.index)) step.onCancel?.();
    actor.job = null;
  }

  assign(actor, jobs) {
    actor.job = { jobs, index: 0, arrived: null };
    walkTo(actor, this.paths[actor.side][jobs[0].place]);
  }

  task(side, jobs, chief = false) {
    const first = this.paths[side][jobs[0].place];
    const candidates = chief ? [this.avatars[side]] : [...this.available(side), this.avatars[side]];
    const underground = first.position.y < LAND.slice;
    const actor = candidates.filter(candidate => {
      if (!candidate.active || candidate.job || candidate.lodge) return false;
      if (underground) return candidate.node === first || candidate.goal === first;
      return candidate.model.body.position.y >= 0;
    })
      .sort((a, b) => a.model.body.position.distanceToSquared(first.position) - b.model.body.position.distanceToSquared(first.position))[0];
    if (!actor) return false;
    this.assign(actor, jobs);
    return true;
  }

  counts(players, previous, card, actorSide, now, gains = [[], []]) {
    if (actorSide >= 0 && (card === 'player_head' || card === 'lead')) {
      const other = 1 - actorSide;
      const list = this.available(other);
      const lostWorker = list.length > players[other].worker;
      const gainedWorker = this.available(actorSide).length < players[actorSide].worker;
      if (lostWorker && (gainedWorker || card === 'lead')) {
        const worker = list.at(-1);
        const destination = this.paths[actorSide];
        this.cancel(worker);
        worker.side = actorSide;
        worker.lodge = false;
        if (card === 'lead') {
          worker.retire = 'visitor';
          this.assign(worker, [{ place: 'mine', hold: .68, tool: 'pick' }, { place: 'road' }]);
        } else {
          worker.post = 'lookout';
          worker.transfer = { sign: actorSide === 0 ? -1 : 1, color: TEAM[actorSide] };
          walkTo(worker, destination[worker.post]);
        }
      }
    }

    for (let side = 0; side < 2; side++) {
      const nodes = this.paths[side];
      const desired = players[side]?.worker ?? 0;
      const list = this.available(side);
      let missing = desired - list.length;
      const holdingSide = 1 - side;
      if (previous?.[holdingSide]?.stage?.hostage && !players[holdingSide]?.stage?.hostage) {
        const captive = this.roster.find(actor => actor.active && actor.side === side && actor.retire === 'held');
        if (captive) {
          const returnToCrew = missing > 0;
          captive.retire = returnToCrew ? null : 'exit';
          this.cancel(captive);
          walkTo(captive, nodes[returnToCrew ? captive.post : 'road']);
          if (returnToCrew) missing--;
        }
      }
      if (missing > 0) {
        const count = missing;
        for (let i = 0; i < count; i++) {
          const post = posts[(desired - count + i) % posts.length];
          const { from = 'road', delay = 0 } = gains[side][i] ?? {};
          const worker = this.acquire(side, from, post, now, delay + i * .29);
          worker.post = post;
        }
      } else if (missing < 0) {
        const leaving = list.slice(missing);
        leaving.forEach((worker, index) => {
          this.cancel(worker);
          worker.lodge = false;
          worker.retire = card === 'cobweb' && side !== actorSide ? 'held' : 'exit';
          worker.until = Math.min(worker.until, now) + .15 * index;
          if (side !== actorSide && card === 'bow') worker.fallAt = now + .72 + index * .13;
          const target = worker.retire === 'held' ? this.paths[actorSide].hold : nodes.road;
          walkTo(worker, target);
        });
      }
    }
  }

  work(actor, now) {
    const job = actor.job;
    if (!job) return null;
    const role = job.jobs[job.index];
    if (actor.steps.length) return role.carry ? { carry: true } : null;
    if (job.arrived === null) {
      job.arrived = now;
      role.onArrive?.(actor.model.body.position);
    }
    if (now - job.arrived < (role.hold ?? 0)) return role;
    role.onDone?.(actor.model.body.position);
    if (++job.index < job.jobs.length) {
      job.arrived = null;
      const next = job.jobs[job.index];
      walkTo(actor, this.paths[actor.side][next.place]);
      return next.carry ? { carry: true } : null;
    }
    actor.job = null;
    return null;
  }

  frame(now, dt, clock, view, reduced, mines, playing) {
    const night = clock.bedtime > .27 || clock.rest > .15;
    const doors = [false, false];
    for (const actor of [...this.avatars, ...this.roster]) {
      if (!actor.active) continue;
      const { model, side } = actor;
      const body = model.body;
      const nodes = this.paths[side];
      if (now < actor.until) {
        body.visible = false;
        continue;
      }
      if (!actor.retire && !actor.job) {
        if (night && actor.post !== 'mine' && !actor.lodge && !actor.node.covered) {
          actor.lodge = true;
          walkTo(actor, nodes.lodge);
        } else if (actor.lodge && !night && actor.node === nodes.lodge) {
          actor.lodge = false;
          walkTo(actor, nodes[actor.post]);
        } else if (!actor.lodge && !actor.steps.length && now >= actor.patrolAt) {
          const destination = actor.chief || actor.post === 'mine' || actor.node !== nodes[actor.post]
            ? actor.post : patrolled[(Math.floor(now * 2) + side) % patrolled.length];
          walkTo(actor, nodes[destination]);
          actor.patrolAt = now + 2 + (Math.abs(body.position.x) % 3);
        }
      }
      const fall = now - actor.fallAt;
      const stumbling = fall >= 0 && fall < .72;
      const pace = actor.chief ? 6.1 : actor.retire === 'exit' || actor.lodge ? 6.4 : actor.job ? 5.7 : 4.8;
      const walking = !stumbling && stepAlong(actor, dt, pace, reduced);
      const action = this.work(actor, now);
      if (actor.transfer && body.position.x * actor.transfer.sign > .5) {
        actor.model.setTeam(actor.transfer.color);
        actor.transfer = null;
      }
      const inside = !actor.steps.length && actor.node.covered;
      if (inside && ['exit', 'visitor'].includes(actor.retire)) actor.active = false;
      const below = body.position.y < LAND.slice;
      body.visible = actor.active && !inside && (view === 'all' || below === (view === 'underground'));
      const swing = action?.tool && !reduced ? .83 + .54 * Math.sin(now * 13.7) : 0;
      const lean = stumbling && !reduced ? .86 * Math.sin(Math.PI * fall / .72) : 0;
      pose(model, actor.stride, walking && !reduced ? .93 : 0, swing, lean, action?.tool, action?.carry);
      if (actor.steps.length && Math.abs(body.position.x - nodes.lodge.position.x) < .69 &&
          Math.abs(body.position.z - (CAMP.houseZ + 1.30)) < 1.29) doors[side] = true;
    }
    this.lodges.forEach((door, i) => { door.rotation.y = MathUtils.damp(door.rotation.y, doors[i] ? -1.62 : 0, 12, dt); });
    this.frameMiners(now, dt, view, reduced, mines, playing);
  }

  frameMiners(now, dt, view, reduced, mines, playing) {
    for (const [index, mine] of mines.entries()) {
      const miner = this.miners[index];
      const body = miner.body;
      body.visible = playing && view !== 'surface';
      if (!playing) continue;
      const work = mine.active;
      const retreat = work?.style === 'blast' || work?.style === 'hatch' || work?.style === 'charge';
      const end = Math.abs(mineFace(mine.sign, retreat ? Math.min(work.to, mine.count) : mine.count));
      const x = mine.sign * Math.min(19.86, end + (retreat ? 1.49 : .66));
      if (!this.minesReady || reduced) body.position.set(x, SHAFT.floor + .13, shaftLane);
      const from = body.position.x;
      const stride = Math.min(Math.abs(x - from), (retreat ? 11.5 : 4.0) * dt);
      body.position.x += Math.sign(x - from) * stride;
      const moving = stride > .01 && !reduced;
      body.rotation.y = MathUtils.damp(body.rotation.y,
        (moving && (x - from) * mine.sign > 0 ? mine.sign : -mine.sign) * Math.PI / 2, 10, dt);
      const hammering = !retreat && work && !moving;
      pose(miner, now * 12, moving ? .97 : 0, hammering && !reduced ? .82 + .71 * Math.sin(now * 17) : 0,
        0, hammering ? work.tool ?? 'pick' : null);
    }
    if (playing) this.minesReady = true;
  }
}
