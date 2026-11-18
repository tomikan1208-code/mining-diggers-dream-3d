import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { barrel, batch, box, cabin, field, flag, foreman, group, hayBale, instancedProp,
  pose, rng, stockCrate, TEAM } from './art.js';
import { buildMine, mineFace } from './mine.js';
import { skyPainter } from './sky.js';
import { Gaussian, loadInk } from './Gaussian.js';
import { FrameMeter, meshBufferBytes } from './frame-meter.js';
import { CAMP, GOLD, groundY, LAND, SHAFT } from './locations.js';
import { walkAvatar, walkCrew } from './people.js';
import { buildCamp } from './camp.js';
import { StageObjects } from './StageObjects.js';
import { GOAL, REST_MS, TURN_MS } from '../game-data.js';

export const RENDER_MODES = ['gaussian', 'raw', 'polygon'];
const CAMERA = {
  home: { wide: 24.2, tall: 11.0, y: .21, z: .13, pitch: .42, yaw: .30 },
  all: { wide: 67.0, tall: 26.7, y: -3.68, z: -.29, pitch: .389, yaw: .125 },
  surface: { wide: 66.4, tall: 17.2, y: .58, z: -.47, pitch: .53, yaw: .16 },
  underground: { wide: 65.2, tall: 15.0, y: -7.00, z: 4.7, pitch: .205, yaw: .105 },
};
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const smooth = x => x * x * (3 - 2 * x);
const ease = T.MathUtils.damp;
const CHALK = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 2], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 2, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7],
];

function sculpture(model) {
  const copy = model.clone();
  copy.material = new T.MeshLambertMaterial({ vertexColors: true });
  copy.castShadow = true;
  copy.receiveShadow = true;
  return copy;
}

function shiftSign(parent, y, z, mounted = false) {
  const sign = group(parent, 0, y, z);
  if (!mounted) for (const x of [-.57, .57]) box(sign, x, .62, -.055, .18, 1.24, .17, 0x746246);
  box(sign, 0, 1.05, 0, 1.66, 1.0, .14, 0x967951);
  box(sign, 0, 1.05, .075, 1.46, .84, .027, 0x373c32);
  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  const ink = new T.CanvasTexture(canvas);
  ink.colorSpace = T.SRGBColorSpace;
  ink.magFilter = ink.minFilter = T.NearestFilter;
  const face = new T.Mesh(new T.PlaneGeometry(1.43, .80), new T.MeshLambertMaterial({ map: ink }));
  face.position.set(0, 1.05, .092);
  sign.add(face);
  let displayed = null;
  return {
    sign,
    show(round) {
      if (round === displayed) return;
      displayed = round;
      ctx.fillStyle = '#373c32';
      ctx.fillRect(0, 0, 36, 20);
      ctx.fillStyle = '#e6ce9b';
      if (round === undefined) {
        ctx.fillRect(13, 9, 10, 2);
      } else {
        const digits = String(round).padStart(2, '0');
        const pixel = Math.min(2, Math.floor(35 / (digits.length * 4)));
        const start = Math.floor((36 - (digits.length * 4 - 1) * pixel) / 2);
        digits.split('').forEach((digit, d) => CHALK[digit].forEach((row, y) => {
          for (let x = 0; x < 3; x++) {
            if (row & (4 >> x)) ctx.fillRect(start + (d * 4 + x) * pixel, 5 + y * pixel, pixel, pixel);
          }
        }));
      }
      ink.needsUpdate = true;
    },
  };
}

function grass(parent, random, count, spread) {
  for (let i = 0; i < count; i++) {
    const x = (random() - .5) * spread[0];
    const z = (random() - .5) * spread[1] - .55;
    if (Math.abs(z - CAMP.pathZ) < .65 || (Math.abs(x) > 19.6 && z > 6.75) ||
        (spread[0] < 16 && (Math.abs(x) > 5.71 || Math.abs(z) > 2.96))) continue;
    const tuft = group(parent, x, .113, z);
    for (let a = 0; a < 3; a++) {
      const h = .075 + random() * .22;
      box(tuft, a * .061, h * .47, (random() - .5) * .12, .040, h, .045,
        a === 0 ? 0xb4a85a : a === 1 ? 0x626f39 : 0x929547).rotation.z = (a - 1) * .26;
    }
    if (i % 11 === 0) box(tuft, .08, .227, .01, .075, .055, .07, 0xf0d383);
  }
}

function onCamp(x, z) {
  const a = Math.abs(x);
  return [[CAMP.houseX, CAMP.houseZ, 2.55, 2.55], [CAMP.mill, CAMP.millZ, 2.4, 2.0],
    [CAMP.yard, CAMP.yardZ, 3.7, 1.45], [CAMP.powerX, CAMP.powerZ, 1.9, 1.45],
    [CAMP.plot, -.64, 2.15, 1.8]]
    .some(([cx, cz, w, d]) => Math.abs(a - cx) < w && Math.abs(z - cz) < d);
}

function growScene(parent, models, home = false) {
  const foliage = home ? [
    [-5.44, .12, -1.71, 1.28], [-4.21, .13, -3.02, 1.55, .55],
    [-2.62, .14, -3.04, 1.31, .30], [4.54, .12, -2.63, .91], [5.26, .1, -.65, .83],
    [-6.16, -.13, .24, .63, -.52], [1.17, .13, -3.20, .73],
  ] : [
    [-25.6, .14, -8.7, 2.19], [-22.8, .12, -10.1, 1.84], [-19.9, .15, -9.8, 1.57],
    [-18.3, .15, -10.76, 2.05], [-15.2, .12, -9.87, 2.01], [-12.22, .12, -7.5, 1.39],
    [-9.54, .12, -9.6, 1.91], [-7.9, .11, -7.66, 1.42], [-4.3, .14, -10.78, 1.93],
    [-.96, .14, -9.2, 1.37], [2.85, .11, -10.6, 2.0], [6.15, .14, -9.26, 1.65],
    [9.2, .13, -8.71, 1.73], [11.54, .17, -10.4, 1.48], [14.87, .12, -10.38, 1.91],
    [18.45, .13, -9.93, 1.98], [22.49, .14, -8.67, 1.80], [25.18, .14, -9.76, 2.22],
    [27.2, .14, -5.31, 1.33], [-27.76, .14, -5.68, 1.44],
    [-24.56, .14, -4.4, 1.29], [23.47, .14, -4.19, 1.25],
    [-5.36, .14, -4.9, .76], [4.62, .14, -5.31, .79], [-9.12, .14, 6.06, .61],
    [6.1, .14, 6.69, .71], [-15.62, .13, 6.68, .73], [15.84, .13, 6.85, .74],
  ];
  const pine = instancedProp(models.Pine, foliage);
  const random = rng(home ? 340 : 624);
  const stones = Array.from({ length: home ? 30 : 97 }, () => [
    (random() - .5) * (home ? 12.9 : 53.9), .15, (random() - .5) * (home ? 7.1 : 20.6) - .68,
    .19 + Math.pow(random(), 3) * (home ? .58 : .78), random() * Math.PI,
  ]).filter(([x, , z]) =>
    Math.abs(z - CAMP.pathZ) > .97 && !(Math.abs(x) > 19.6 && z > 6.75) &&
    (home ? Math.abs(x) < 5.74 && Math.abs(z) < 2.66 : !onCamp(x, z)));
  const boulders = instancedProp(models.Rock, stones);
  parent.add(pine, boulders);
  const detail = group(parent);
  grass(detail, random, home ? 76 : 233, home ? [13.6, 6.9] : [54.3, 20.7]);
  batch(detail);
  return {
    meshes: [pine, boulders],
    splats: [
      ...foliage.map(transform => ({ name: 'Pine', transform })),
      ...stones.map(transform => ({ name: 'Rock', transform })),
    ],
  };
}

function homeLayout(parent, models) {
  parent.add(models.Home);
  const props = group(parent);
  cabin(props, 1.75, -1.23, TEAM[0], .83);
  flag(props, 3.63, .16, .57, TEAM[0]);
  stockCrate(props, 3.8, 1.39, .15, .72);
  barrel(props, 2.85, .36);
  hayBale(props, -3.0, .28);
  field(props, -2.05, -1.37, 62);
  batch(props, true);
  const worker = foreman(parent, TEAM[0], true);
  worker.body.position.set(-1.55, .15, 1.92);
  worker.body.rotation.y = .28;
  worker.body.scale.setScalar(1.28);
  return worker;
}

function makeParticles(parent) {
  const palette = [0xb59470, 0x988077, 0x55494c, 0xf2ca82, 0xffa45d, 0xe98245];
  const particles = Array.from({ length: 54 }, (_, index) => {
    const mesh = box(parent, 0, 0, 0, 1, 1, 1, palette[index % palette.length], index % 6 < 3);
    mesh.visible = false;
    return { mesh, active: false };
  });
  let cursor = 0;
  const random = rng(63566);
  return {
    burst(x, y, z, time, kind) {
      const size = kind === 'blast' ? 22 : kind === 'dig' ? 10 : 7;
      for (let i = 0; i < size; i++) {
        const p = particles[cursor++ % particles.length];
        p.mesh.visible = p.active = true;
        Object.assign(p, {
          x: x + (random() - .5) * .53, y: y + random() * .78, z: z + random() * .35,
          vx: (random() - .5) * (kind === 'blast' ? 4.9 : 2.1), vy: .8 + random() * 2.15,
          vz: .4 + random(), born: time, life: .32 + random() * .52, size: .057 + random() * .15,
        });
      }
    },
    frame(now) {
      for (const p of particles) {
        if (!p.active) continue;
        const t = now - p.born;
        if (t > p.life) {
          p.active = p.mesh.visible = false;
          continue;
        }
        p.mesh.position.set(p.x + p.vx * t, p.y + p.vy * t - 4.1 * t * t, p.z + p.vz * t);
        p.mesh.scale.setScalar(p.size * (1 - t / p.life * .74));
        p.mesh.rotation.set(t * 4, t * 2.3, t * 4.4);
      }
    },
    clear() {
      for (const p of particles) p.active = p.mesh.visible = false;
    },
  };
}

export class Board {
  constructor(element) {
    this.element = element;
    this.scene = new T.Scene();
    this.canvas = element.querySelector('.model-canvas');
    this.drawSky = skyPainter(element.querySelector('.sky-canvas'));
    this.labels = [...element.querySelectorAll('[data-marker]')];
    this.camera = new T.OrthographicCamera(-16, 16, 8, -8, .1, 140);
    this.target = new T.Vector3(0, -.25, 0);
    this.cameraSpec = { ...CAMERA.home };
    this.yawOffset = 0;
    this.zoom = 1;
    this.panned = new T.Vector3();
    this.pointer = new Map();
    this.width = 1;
    this.height = 1;
    this.view = 'all';
    this.mode = 'gaussian';
    this.roomKey = null;
    this.room = null;
    this.matchAt = 0;
    this.eventId = null;
    this.eventAt = 0;
    this.splatPaint = new Float32Array(GOAL * 2);
    this.tint = new T.Vector3(1, 1, 1);
    this.labelPoint = new T.Vector3();
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.drawSky(.16, .29, 0);
  }

  async load() {
    const renderer = new T.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: false, powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.info.autoReset = false;
    this.renderer = renderer;
    this.meter = new FrameMeter(renderer.getContext());
    const meshFile = fetch('/models/coalfield.glb').then(response => {
      if (!response.ok) throw new Error('Polygon data HTTP ' + response.status);
      return response.arrayBuffer();
    });
    const [binary, ink] = await Promise.all([meshFile, loadInk().catch(error => {
      console.warn(error);
      this.gaussianError = true;
      return null;
    })]);
    this.meshBytes = binary.byteLength;
    const models = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(binary, '/models/');
    const get = name => {
      const source = models.scenes.find(scene => scene.name === name);
      if (!source) throw new Error('モデルが見つかりません ' + name);
      return sculpture(source.children[0]);
    };
    const assets = Object.fromEntries(['Coalfield', 'Surface', 'Underground', 'Home', 'Pine', 'Rock'].map(name => [name, get(name)]));
    this.objects = new StageObjects(get);
    this.home = group(this.scene);
    this.homeWorker = homeLayout(this.home, assets);
    this.homeGrove = growScene(this.home, assets, true);
    this.homeLand = assets.Home;
    const homeBench = this.objects.add(this.home, 'Workshop', [-.12, groundY, -.43, .57]);
    this.arena = group(this.scene);
    this.land = { all: assets.Coalfield, surface: assets.Surface, underground: assets.Underground };
    this.arena.add(...Object.values(this.land));
    this.field = group(this.arena);
    this.caves = group(this.arena);
    this.shiftSigns = [shiftSign(this.field, .16, -2.38), shiftSign(this.caves, -8.12, LAND.front + .12, true)];
    const goalGold = this.objects.add(this.caves, 'GoalGold', [0, GOLD.y, GOLD.z, GOLD.scale]);
    const campStart = this.objects.models.length;
    this.camps = TEAM.map((_, index) => buildCamp(this.field, this.caves, index, this.objects));
    const campPlacement = this.objects.models.slice(campStart).map(model => model.placement);
    this.objects.prepare();
    this.arenaGrove = growScene(this.field, assets);
    this.mines = TEAM.map((_, index) => buildMine(this.caves, this.field, index, get));
    this.avatars = TEAM.map(team => foreman(this.arena, team, true));
    this.crews = TEAM.map(team => Array.from({ length: 10 }, () => foreman(this.arena, team)));
    this.particles = makeParticles(this.arena);
    const dug = this.mines.flatMap(mine => mine.sections.map(({ name, part }) => ({ name, part })));
    this.placements = {
      home: [{ name: 'Home' }, homeBench.placement, ...this.homeGrove.splats],
      all: [{ name: 'Coalfield' }, goalGold.placement, ...this.arenaGrove.splats, ...dug, ...campPlacement],
      surface: [{ name: 'Surface' }, ...this.arenaGrove.splats, ...campPlacement],
      underground: [{ name: 'Underground' }, goalGold.placement, ...dug],
    };
    this.gaussian = ink ? new Gaussian(ink, this.scene, this.objects) : null;
    if (!ink) this.mode = 'polygon';
    this.hemi = new T.HemisphereLight(0xf0eddf, 0x746063, 1.56);
    this.sun = new T.DirectionalLight(0xffe3bb, 2.42);
    this.sun.castShadow = true;
    const shadow = this.sun.shadow;
    shadow.mapSize.set(1024, 1024);
    Object.assign(shadow.camera, { left: -37, right: 37, top: 26, bottom: -28, near: .8, far: 110 });
    shadow.bias = -.0003;
    shadow.normalBias = .031;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.presence = [null, null];
    this.ready = true;
    this.enter(this.room);
    const observer = new ResizeObserver(([entry]) => this.resize(entry.contentRect));
    observer.observe(this.element);
    this.bindCamera();
    this.last = performance.now() / 1000;
    requestAnimationFrame(this.frame);
  }

  resize(rect) {
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const ratio = Math.min(.9, 1040 / this.width, 760 / this.height);
    this.renderer.setSize(Math.round(this.width * ratio), Math.round(this.height * ratio), false);
    this.gaussian?.resize(this.canvas.width, this.canvas.height);
  }

  bindCamera() {
    const canvas = this.canvas;
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.scale(Math.exp(-clamp(event.deltaY, -160, 160) * .0029));
    }, { passive: false });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', event => {
      const old = this.pointer.get(event.pointerId);
      if (!old) return;
      const other = [...this.pointer.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(old.x - other.x, old.y - other.y);
        if (before > 8) this.scale(Math.hypot(event.clientX - other.x, event.clientY - other.y) / before);
      } else if (event.shiftKey) {
        this.yawOffset = clamp(this.yawOffset - (event.clientX - old.x) * .003, -.28, .28);
      } else {
        this.pan(event.clientX - old.x, event.clientY - old.y);
      }
      this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    const up = event => {
      this.pointer.delete(event.pointerId);
      if (this.pointer.size === 0) canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('keydown', event => {
      const movement = { ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] };
      if (movement[event.key]) {
        event.preventDefault();
        this.pan(...movement[event.key]);
      }
    });
  }

  pan(dx, dy) {
    const world = ((this.camera.top - this.camera.bottom) || 12) / this.height;
    const x = this.yawOffset + this.cameraSpec.yaw;
    this.panned.x = clamp(this.panned.x - dx * world * Math.cos(x), -39, 39);
    this.panned.z = clamp(this.panned.z + dx * world * Math.sin(x), -22, 22);
    this.panned.y = clamp(this.panned.y + dy * world, -22, 22);
  }

  scale(factor) {
    this.zoom = clamp(this.zoom * factor, .72, 3.2);
  }

  reset() {
    this.zoom = 1;
    this.panned.set(0, 0, 0);
    this.yawOffset = 0;
  }

  setView(view) {
    if (!Object.hasOwn(this.land ?? CAMERA, view)) return;
    this.view = view;
    this.reset();
    if (this.ready) this.visibility();
  }

  setMode(mode) {
    if (!this.ready || !RENDER_MODES.includes(mode) || (mode !== 'polygon' && !this.gaussian)) return false;
    this.mode = mode;
    this.visibility();
    return true;
  }

  previewProduct(id, side) {
    for (const [index, camp] of (this.camps ?? []).entries()) camp.preview(index === side ? id : null);
  }

  focusWorkshop(side, panel) {
    if (!this.ready) return;
    const rect = this.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const spec = CAMERA.surface;
    this.zoom = 3;
    const aspect = rect.width / rect.height;
    const units = Math.max(spec.tall, spec.wide / aspect) / (this.zoom * rect.height);
    const beside = panel.left - rect.left;
    const up = panel.top - rect.top;
    const stacked = beside < 160;
    const right = stacked ? 0 : (rect.width / 2 - beside * .56) * units;
    const raised = stacked ? (up * .54 - rect.height / 2) * units : 0;
    this.panned.set(this.camps[side].sign * CAMP.mill + right * Math.cos(spec.yaw),
      1.66 - spec.y + raised / Math.cos(spec.pitch), CAMP.millZ - spec.z - right * Math.sin(spec.yaw));
  }

  tunePixelLook(settings) {
    if (!this.gaussian || this.frozen) return false;
    this.gaussian.tunePixelLook(settings);
    return this.setMode('gaussian');
  }

  async compare(report) {
    if (!this.ready || !this.gaussian || this.frozen) return;
    const saved = this.mode;
    const results = {};
    this.frozen = true;
    try {
      for (const mode of RENDER_MODES) {
        this.setMode(mode);
        report(mode);
        const timing = await this.meter.measure();
        const bytes = meshBufferBytes(this.scene, this.gaussian.batch.mesh);
        const splats = mode === 'polygon' ? { cpu: 0, gpu: 0, count: 0 } : this.gaussian.memory(mode === 'raw');
        const frame = this.canvas.width * this.canvas.height * 8;
        const shadow = this.sun.shadow.mapSize.x * this.sun.shadow.mapSize.y * 8;
        results[mode] = {
          ...timing,
          triangles: Math.max(0, timing.triangles - (mode === 'polygon' ? 0 : splats.count * 2 + (mode === 'raw' ? 2 : 4))),
          count: splats.count,
          cpuBytes: bytes + splats.cpu,
          gpuBytes: bytes + splats.gpu + frame + shadow,
          fileBytes: mode === 'polygon' ? this.meshBytes : this.gaussian.library.bytes,
        };
      }
      return results;
    } finally {
      this.frozen = false;
      this.setMode(saved);
      if (this.pendingRoom) {
        this.enter(this.pendingRoom.value);
        this.pendingRoom = null;
      }
    }
  }

  visibility() {
    const splats = this.mode !== 'polygon';
    this.home.visible = !this.room;
    this.arena.visible = Boolean(this.room);
    for (const [key, mesh] of Object.entries(this.land)) mesh.visible = !splats && key === this.view;
    this.homeLand.visible = !splats;
    for (const mesh of [...this.homeGrove.meshes, ...this.arenaGrove.meshes]) mesh.visible = !splats;
    this.field.visible = this.view !== 'underground';
    this.caves.visible = this.view !== 'surface';
    this.shiftSigns[1].sign.visible = this.view === 'underground';
    for (const mine of this.mines) {
      for (const [i, section] of mine.sections.entries()) section.rock.visible = !splats && i >= mine.count;
    }
    if (splats) {
      const key = this.room ? this.view : 'home';
      this.gaussian.use(key, this.placements[key]);
    }
    if (this.gaussian?.batch) this.gaussian.batch.mesh.visible = splats;
    this.objects.sync(!splats);
    this.element.dataset.renderer = this.mode;
  }

  enter(room) {
    if (this.frozen) {
      this.pendingRoom = { value: room };
      return;
    }
    const key = room?.session ?? null;
    const change = key !== this.roomKey;
    const previous = this.room?.match;
    this.room = room;
    this.roomKey = key;
    this.matchAt = performance.now() / 1000;
    if (!this.ready) return;
    if (change || !this.initialized) {
      this.reset();
      if (change) this.view = 'all';
      this.presence.fill(null);
      this.eventId = null;
      this.work = null;
      this.particles.clear();
      this.camps.forEach(camp => camp.reset());
      this.orbit = 0;
      this.firstDay = null;
      this.morningAt = -Infinity;
      this.initialized = true;
    }
    this.visibility();
    if (!room) return;
    if (room.match) {
      const { round, active, phase } = room.match;
      const calendarDay = (round - 1) * 2 + active;
      this.firstDay ??= calendarDay;
      this.day = calendarDay - this.firstDay;
      if (phase === 'rest' && previous?.phase !== 'rest') {
        this.restOrbit = this.orbit;
        this.restWalk = this.clockBedtime ?? 0;
      }
      if (!change && phase === 'turn' && previous?.phase === 'rest') {
        this.morningAt = this.matchAt;
        this.orbit = 0;
      }
      if (room.developer && phase === 'turn' && room.match.event.id !== previous?.event.id &&
          (room.match.event.kind === 'edit' || room.match.event.card === 'totem_of_undying')) {
        this.orbit = .5 * clamp(1 - room.match.remainingMs / room.match.limitMs, 0, 1);
      }
    }
    for (const sign of this.shiftSigns) sign.show(room.match?.round);
    const rival = 1 - room.index;
    const sides = [room.index, rival];
    const fresh = this.eventId === null;
    const event = room.match?.event;
    if (event && event.id !== this.eventId) {
      this.eventId = event.id;
      this.eventAt = this.matchAt;
      this.work = { index: sides.indexOf(event.actor), kind: event.kind === 'card' ? event.card : event.kind };
      if (!fresh) {
        const camp = this.camps[this.work.index];
        if (event.kind === 'craft') camp.craft(event.card, room.match.players[event.actor], this.matchAt);
        else if (event.kind === 'harvest' || ['wooden_axe', 'stone_axe', 'iron_axe', 'stone_hoe'].includes(event.card)) {
          const x = event.kind === 'harvest' || event.card === 'stone_hoe' ? CAMP.plot : CAMP.yard;
          this.particles.burst(camp.sign * x, .62, .15, this.matchAt, 'work');
        }
      }
    }
    for (const [index, player] of sides.entries()) {
      if (room.names[player] && this.presence[index] === null) this.presence[index] = this.matchAt;
      if (!room.names[player]) this.presence[index] = null;
      const data = room.match?.players[player];
      const mine = this.mines[index];
      const camp = this.camps[index];
      const count = clamp(data?.mining ?? 0, 0, GOAL);
      if (fresh || !room.match) {
        mine.count = count;
        for (const section of mine.sections) section.changed = -Infinity;
      }
      if (mine.goal !== count) {
        mine.next = this.matchAt + .11;
        mine.goal = count;
        mine.blast = event?.card === 'tnt';
      }
      camp.update(data);
    }
  }

  clock(now, dt) {
    if (!this.room?.match) return { orbit: .16, tone: .29, rest: 0, bedtime: 0, morning: 1 };
    const match = this.room.match;
    const paused = match.paused && match.phase === 'turn';
    const remaining = Math.max(0, match.remainingMs - (paused ? 0 : (now - this.matchAt) * 1000));
    let rest = 0, bedtime = 0, target;
    if (match.phase === 'rest') {
      const elapsed = clamp(1 - remaining / REST_MS, 0, 1);
      const from = this.restOrbit ?? .5;
      target = elapsed < .19 ? T.MathUtils.lerp(from, .53, elapsed / .19) : .53 + (elapsed - .19) * (.47 / .81);
      bedtime = T.MathUtils.lerp(this.restWalk ?? 0, 1, clamp(elapsed / .39, 0, 1));
      rest = smooth(clamp(elapsed / .28, 0, 1)) * (1 - smooth(clamp((elapsed - .82) / .18, 0, 1)));
    } else {
      target = match.phase === 'finished' ? .28 : .5 * clamp(1 - remaining / (match.limitMs ?? TURN_MS), 0, 1);
      if (match.phase === 'turn') bedtime = .81 * clamp(1 - remaining / 3300, 0, 1);
    }
    if (match.phase === 'turn' && this.orbit > .52) this.orbit = 0;
    const forward = match.phase === 'rest' || match.phase === 'turn';
    const orbit = this.orbit = forward ? Math.max(this.orbit, match.phase === 'rest' ? target : ease(this.orbit, target, 9, dt)) : target;
    this.clockBedtime = bedtime;
    const tone = orbit <= .52 ? .05 + 1.50 * orbit :
      orbit < .89 ? Math.min(1, .83 + (orbit - .52) * 1.39) : 1 - .95 * (orbit - .89) / .11;
    return { orbit, tone, rest, bedtime, morning: clamp((now - this.morningAt) / 1.28, 0, 1) };
  }

  positionWorkers(index, now, clock) {
    const entrance = this.presence[index];
    const sign = this.camps[index].sign;
    const mine = this.mines[index];
    const player = index === 0 ? this.room.index : 1 - this.room.index;
    const workers = this.room.match?.players[player].worker ?? 0;
    const action = now - this.eventAt < 2.2 && this.work?.index === index && clock.rest < .2 ? this.work.kind : '';
    walkAvatar(this.avatars[index], sign, entrance, now, clock, this.view, this.reduceMotion);
    walkCrew(this.crews[index], sign, workers, mine, now, action, clock, this.view, this.reduceMotion, entrance !== null);
    const marker = this.camps[index].marker;
    marker.rotation.y = this.reduceMotion ? 0 : .088 * Math.sin(now * 2 + index * 3);
  }

  updateMines(now, dt) {
    for (const mine of this.mines) {
      if (mine.count !== mine.goal && now >= mine.next) {
        const direction = Math.sign(mine.goal - mine.count);
        const at = mineFace(mine.sign, mine.count);
        mine.sections[direction > 0 ? mine.count : mine.count - 1].changed = now;
        if (this.view !== 'surface') {
          this.particles.burst(at, SHAFT.floor + .88, direction < 0 ? LAND.front - .14 : SHAFT.track + .52,
            now, mine.blast ? 'blast' : 'dig');
        }
        mine.count += direction;
        mine.next = now + (mine.blast ? .10 : .18);
      }
      for (const [i, section] of mine.sections.entries()) {
        const open = i < mine.count;
        const elapsed = this.reduceMotion ? 1 : clamp((now - section.changed) / .52, 0, 1);
        section.cut.visible = open;
        section.rock.visible = this.mode === 'polygon' && !open;
        section.rock.position.y = open ? 0 : .66 * (1 - elapsed * elapsed);
        this.splatPaint[section.part] = open ? elapsed : elapsed - 1;
      }
      const start = SHAFT.startRamp - .74;
      const end = Math.max(Math.abs(mineFace(mine.sign, mine.count)) + .89, 5.5);
      const range = start - end;
      const to = mine.sign * (start - range * (.54 + .37 * Math.cos(now * .49)));
      mine.trolley.position.x = this.reduceMotion ? mine.sign * (start - range * .39) : ease(mine.trolley.position.x, to, 3, dt);
    }
  }

  moveCamera(dt) {
    const goal = CAMERA[this.room ? this.view : 'home'];
    const spec = this.cameraSpec;
    for (const key of Object.keys(goal)) spec[key] = this.reduceMotion ? goal[key] : ease(spec[key], goal[key], 6, dt);
    const aspect = this.width / this.height;
    const half = Math.max(spec.tall, spec.wide / aspect) * .5 / this.zoom;
    const camera = this.camera;
    camera.left = -aspect * half;
    camera.right = aspect * half;
    camera.top = half;
    camera.bottom = -half;
    const yaw = spec.yaw + this.yawOffset;
    const depth = 64 * Math.cos(spec.pitch);
    const shift = !this.room && this.width > 660 ? Math.min(3.23, camera.right * .29) : 0;
    this.target.set(shift, spec.y, spec.z).add(this.panned);
    camera.position.set(Math.sin(yaw) * depth, Math.sin(spec.pitch) * 64, Math.cos(yaw) * depth).add(this.target);
    camera.lookAt(this.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  placeLabels() {
    for (const label of this.labels) {
      const kind = label.dataset.marker;
      const index = kind === 'red' ? 1 : 0;
      const home = kind === 'home';
      const workshop = kind === 'workshop';
      if (home === Boolean(this.room) || (workshop && (!this.room?.match || this.view === 'underground'))) {
        label.hidden = true;
        continue;
      }
      const p = this.labelPoint;
      const sign = index === 0 ? -1 : 1;
      if (workshop) {
        const side = this.room.developer ? this.room.match.active : 0;
        p.set(this.camps[side].sign * CAMP.mill + .20, 3.22, CAMP.millZ + .3);
      }
      else if (home) p.set(-1.55, 2.13, 1.92);
      else if (this.view === 'underground') p.set(sign * 14.55, SHAFT.roof + .27, SHAFT.track + 1.05);
      else if (this.avatars[index].body.visible) {
        p.copy(this.avatars[index].body.position);
        p.y += 1.65;
      } else p.set(sign * CAMP.houseX, 3.34, CAMP.houseZ + .27);
      p.project(this.camera);
      const show = Math.abs(p.x) < .94 && Math.abs(p.y) < .92;
      label.hidden = !show;
      label.style.setProperty('--x', (p.x * .5 + .5) * 100 + '%');
      label.style.setProperty('--y', (-p.y * .5 + .5) * 100 + '%');
    }
  }

  animate(now, dt) {
    const clock = this.clock(now, dt);
    const { orbit, tone } = clock;
    this.drawSky(orbit, tone, this.day ?? 0);
    const angle = orbit * 2 * Math.PI;
    const altitude = Math.sin(angle);
    const night = smooth(clamp(-altitude * 1.45, 0, 1));
    const dusk = orbit > .35 && orbit < .57 ? 1 - clamp(Math.abs(orbit - .47) / .12, 0, 1) : 0;
    this.sun.position.set(Math.cos(angle) * 35, 6 + altitude * 33, 22);
    this.sun.intensity = (1.71 + .51 * Math.max(0, altitude)) * (1 - night * .94);
    this.sun.color.set(dusk > .42 ? 0xffc09b : 0xffe5c3);
    this.hemi.intensity = 1.32 - night * .75;
    this.hemi.color.set(night > .4 ? 0x859dcc : 0xe8eee0);
    this.tint.set(1 - .49 * night + .049 * dusk, 1 - .40 * night - .094 * dusk, 1 - .25 * night - .16 * dusk);
    if (this.room) {
      this.updateMines(now, dt);
      this.positionWorkers(0, now, clock);
      this.positionWorkers(1, now, clock);
      for (const camp of this.camps) camp.frame(now, this.reduceMotion,
        (x, y, z) => this.particles.burst(x, y, z, now, 'work'));
      this.objects.sync(this.mode === 'polygon');
      this.particles.frame(now);
    } else {
      pose(this.homeWorker, now, 0, this.reduceMotion ? 0 : Math.max(0, Math.sin(now * 1.3)) * .1);
    }
    this.moveCamera(dt);
    this.placeLabels();
  }

  frame = ms => {
    requestAnimationFrame(this.frame);
    const now = ms / 1000;
    const dt = clamp(now - this.last, .001, .075);
    this.last = now;
    if (document.hidden || this.width <= 1) return;
    if (!this.frozen) this.animate(now, dt);
    const stamp = performance.now();
    this.meter.begin(stamp);
    this.renderer.info.reset();
    if (this.mode !== 'polygon') this.gaussian.render(this.renderer, this.camera, this.splatPaint, this.tint, this.mode === 'raw');
    else this.renderer.render(this.scene, this.camera);
    this.meter.end(this.mode, stamp, performance.now(), this.renderer.info.render);
  };
}
