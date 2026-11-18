import * as T from 'three';
import { GOAL } from '../game-data.js';

// The first parts in the Gaussian atlas are the two shafts' rock segments.
export const FIRST_OBJECT_PART = GOAL * 2;

export class StageObjects {
  constructor(getModel) {
    this.getModel = getModel;
    this.models = [];
    this.moving = [];
    this.revision = 0;
  }

  add(parent, name, transform, animated = false) {
    const [x, y, z, scale = 1, yaw = 0] = transform;
    const mesh = this.getModel(name);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    mesh.rotation.y = yaw;
    parent.add(mesh);
    const part = animated ? FIRST_OBJECT_PART + this.moving.length : undefined;
    const item = { mesh, placement: { name, transform, part }, shown: !animated };
    this.models.push(item);
    if (animated) this.moving.push(item);
    return item;
  }

  prepare() {
    const width = Math.max(this.moving.length, 1);
    this.offsets = new Float32Array(width * 4);
    this.texture = new T.DataTexture(this.offsets, width, 1, T.RGBAFormat, T.FloatType);
    this.texture.needsUpdate = true;
  }

  sync(polygon) {
    for (const model of this.models) model.mesh.visible = polygon && model.shown;
    let changed = false;
    for (const [i, model] of this.moving.entries()) {
      const o = i * 4;
      const position = model.mesh.position;
      const origin = model.placement.transform;
      const x = Math.fround(position.x - origin[0]), y = Math.fround(position.y - origin[1]), z = Math.fround(position.z - origin[2]);
      const w = Number(model.shown);
      if (x === this.offsets[o] && y === this.offsets[o + 1] && z === this.offsets[o + 2] && w === this.offsets[o + 3]) continue;
      this.offsets[o] = x;
      this.offsets[o + 1] = y;
      this.offsets[o + 2] = z;
      this.offsets[o + 3] = w;
      changed = true;
    }
    if (changed) {
      this.revision++;
      this.texture.needsUpdate = true;
    }
  }
}
