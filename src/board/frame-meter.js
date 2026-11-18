export function meshBufferBytes(scene, omit) {
  const arrays = new Set();
  const add = attribute => {
    if (!attribute) return;
    arrays.add(attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array);
  };
  scene.traverseVisible(object => {
    if (!object.isMesh || object === omit) return;
    add(object.geometry.index);
    for (const attribute of Object.values(object.geometry.attributes)) add(attribute);
    if (object.isInstancedMesh) {
      add(object.instanceMatrix);
      add(object.instanceColor);
    }
  });
  return [...arrays].reduce((bytes, array) => bytes + (array?.byteLength ?? 0), 0);
}

export class FrameMeter {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.live = { mode: null, since: 0, frames: 0, fps: null };
  }

  measure() {
    return new Promise(resolve => {
      this.sample = {
        resolve, warmUntil: performance.now() + 750, first: 0, last: 0, frames: 0, cpu: 0,
        draws: 0, triangles: 0, gpu: [], queries: [], active: null,
      };
    });
  }

  begin(now) {
    const sample = this.sample;
    if (!sample || now < sample.warmUntil || !this.ext) return;
    const gl = this.gl;
    sample.queries = sample.queries.filter(query => {
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
        sample.gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1000000);
      } else {
        sample.gpu.length = 0;
      }
      gl.deleteQuery(query);
      return false;
    });
    if (sample.queries.length > 3 || sample.frames % 4 !== 0) return;
    const query = gl.createQuery();
    if (!query) return;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    sample.active = query;
  }

  end(mode, start, stop, info) {
    const live = this.live;
    if (mode !== live.mode || stop - live.since > 4000) {
      this.live = { mode, since: stop, frames: 0, fps: null };
    } else {
      live.frames++;
      if (stop - live.since >= 650) {
        live.fps = 1000 * live.frames / (stop - live.since);
        live.since = stop;
        live.frames = 0;
      }
    }
    const sample = this.sample;
    if (!sample) return;
    if (sample.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      sample.queries.push(sample.active);
      sample.active = null;
    }
    if (stop < sample.warmUntil) return;
    if (sample.frames === 0) sample.first = start;
    sample.last = stop;
    sample.frames++;
    sample.cpu += stop - start;
    sample.draws += info.calls;
    sample.triangles += info.triangles;
    if (sample.last - sample.first < 1600 || sample.frames < 3) return;
    this.sample = null;
    for (const query of sample.queries) this.gl.deleteQuery(query);
    sample.resolve({
      fps: 1000 * sample.frames / (sample.last - sample.first),
      cpu: sample.cpu / sample.frames,
      gpu: sample.gpu.length ? sample.gpu.reduce((a, b) => a + b, 0) / sample.gpu.length : null,
      calls: sample.draws / sample.frames,
      triangles: sample.triangles / sample.frames,
    });
  }
}
