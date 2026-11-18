import * as T from 'three';
import pixelLook from './ink-pixel.glsl?raw';
import { FIRST_OBJECT_PART } from './StageObjects.js';

const parts = FIRST_OBJECT_PART;
const textureWidth = 768; // Three RGBA texels per splat. A row always ends between records.
const stride = 12;
const bins = 2048;
export const PIXEL_DEFAULTS = Object.freeze({ size: 2, dither: 2.9 });

export async function loadInk() {
  const resource = await fetch('/models/coalfield.ink.gz');
  if (!resource.ok) throw new Error('Gaussian data HTTP ' + resource.status);
  const payload = await resource.arrayBuffer();
  const [first, second] = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const compressed = first === 0x1f && second === 0x8b;
  // The development server can serve the gzip as an HTTP encoding.
  const binary = compressed
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : payload;
  const bytes = compressed ? payload.byteLength : Number(resource.headers.get('Content-Length')) || binary.byteLength;
  const length = new DataView(binary).getUint32(0, true);
  const index = JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 4, length)));
  const data = new Float32Array(binary, 4 + Math.ceil(length / 4) * 4);
  if (index.version !== 1 || index.stride !== 11 || data.length !== index.count * index.stride) {
    throw new Error('Invalid Ink Studio asset library');
  }
  const assets = new Map();
  for (const { name, first, count } of index.assets) {
    if (first < 0 || count <= 0 || first + count > index.count || assets.has(name)) {
      throw new Error('Invalid Ink Studio asset range');
    }
    assets.set(name, data.subarray(first * index.stride, (first + count) * index.stride));
  }
  return { assets, bytes, decodedBytes: binary.byteLength };
}

const gaussVertex = `
precision highp float;
precision highp int;
in vec3 position;
in float splatId;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform highp sampler2D source;
uniform highp sampler2D stage;
uniform vec2 viewport;
uniform float section[${parts}];
uniform vec3 daylight;
out vec2 pixelDelta;
flat out vec3 inverseCov;
flat out vec3 depthPlane;
flat out vec3 ink;
flat out float density;

float random3(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}
vec3 srgbToLinear(vec3 c) {
  return mix(c * (1.0 / 12.92), pow((c + .055) / 1.055, vec3(2.4)), greaterThan(c, vec3(.04045)));
}
void main() {
  int i = int(splatId) * 3;
  ivec2 o = ivec2(i % ${textureWidth}, i / ${textureWidth});
  vec4 a = texelFetch(source, o, 0);
  vec4 b = texelFetch(source, o + ivec2(1, 0), 0);
  vec4 c = texelFetch(source, o + ivec2(2, 0), 0);
  vec3 point = a.xyz;
  float spread = 1.0;
  float fade = 1.0;
  if (c.w >= float(${parts})) {
    vec4 offset = texelFetch(stage, ivec2(int(c.w) - ${parts}, 0), 0);
    point += offset.xyz;
  } else if (c.w >= 0.0) {
    float progress = section[int(c.w)];
    if (progress >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      return;
    }
    if (progress > 0.0) {
      float r = random3(point);
      float q = random3(point.zxy + .71);
      float t = max(0.0, (progress - r * .23) / (1.0 - r * .23));
      point += vec3((r - .5) * 1.17 * t, (.24 + .48 * q) * t - 1.84 * t * t, (.08 + q * 1.47) * t);
      spread = mix(1.0, .46, t * t);
      fade = 1.0 - smoothstep(.50, .97, t);
    } else if (progress < 0.0) {
      point.y -= progress * (.38 + .48 * random3(point));
      fade = 1.0 + progress * .64;
    }
  }

  // Orthographic Jacobian. Push the complete 3D covariance into the screen basis.
  mat3 cov = mat3(b.x, b.y, b.z, b.y, c.x, c.y, b.z, c.y, c.z) * spread;
  vec3 dx = .5 * viewport.x * projectionMatrix[0].x * vec3(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x);
  vec3 dy = .5 * viewport.y * projectionMatrix[1].y * vec3(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y);
  vec3 cx = cov * dx;
  vec3 cy = cov * dy;
  float A = dot(dx, cx) + .15;
  float B = dot(dx, cy);
  float C = dot(dy, cy) + .15;
  inverseCov = vec3(C, -B, A) / max(A * C - B * B, 0.001);
  pixelDelta = position.xy * min(3.0 * sqrt(vec2(A, C)), vec2(384.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(point, 1.0);
  // Conditional mean depth of the Gaussian at this pixel. This keeps a sloping
  // splat from sorting in front of rails embedded farther down its same slope.
  vec3 dz = .5 * projectionMatrix[2].z * vec3(viewMatrix[0].z, viewMatrix[1].z, viewMatrix[2].z);
  vec2 crossDepth = vec2(dot(dz, cx), dot(dz, cy));
  depthPlane = vec3(
    dot(crossDepth, inverseCov.xy),
    dot(crossDepth, inverseCov.yz),
    .5 * gl_Position.z + .5
  );
  gl_Position.xy += pixelDelta * (2.0 / viewport);
  density = a.w * fade;
  uint rgb = uint(b.w);
  vec3 color = vec3(uvec3(rgb & 255u, (rgb >> 8u) & 255u, rgb >> 16u)) / 255.0;
  ink = srgbToLinear(clamp(color * daylight, 0.0, 1.0));
}`;

const gaussFragment = `
precision highp float;
in vec2 pixelDelta;
flat in vec3 inverseCov;
flat in vec3 depthPlane;
flat in vec3 ink;
flat in float density;
uniform bool rawSplat;
out vec4 color;
void main() {
  float q = dot(inverseCov, vec3(pixelDelta.x * pixelDelta.x,
    2.0 * pixelDelta.x * pixelDelta.y, pixelDelta.y * pixelDelta.y));
  if (q > 9.0) discard;
  float mass = density * exp(-0.5 * q);
  float alpha = min(mass, .99);
  if (!rawSplat && density >= 1.0) alpha = .99 * smoothstep(.38, .62, mass);
  if (alpha < .006) discard;
  gl_FragDepth = clamp(dot(depthPlane.xy, pixelDelta) + depthPlane.z, 0.0, 1.0);
  color = vec4(ink * alpha, alpha);
}`;

function storePlacement(target, start, input, placement) {
  const [x0, y0, z0, scale = 1, angle = 0, height = 1] = placement.transform ?? [0, 0, 0];
  const part = placement.part ?? -1;
  const a = Math.cos(angle);
  const b = Math.sin(angle);
  const aa = a * a;
  const bb = b * b;
  const ab = a * b;
  const ss = scale * scale;
  const hs = height * ss;
  for (let i = 0, j = start * stride; i < input.length; i += 11, j += stride) {
    const x = input[i] * scale;
    const z = input[i + 2] * scale;
    target[j] = x0 + a * x + b * z;
    target[j + 1] = y0 + input[i + 1] * scale * height;
    target[j + 2] = z0 - b * x + a * z;
    target[j + 3] = input[i + 3];
    const xx = input[i + 4] * ss;
    const xy = input[i + 5] * hs;
    const xz = input[i + 6] * ss;
    const yz = input[i + 9] * hs;
    const zz = input[i + 10] * ss;
    target[j + 4] = aa * xx + 2 * ab * xz + bb * zz;
    target[j + 5] = a * xy + b * yz;
    target[j + 6] = ab * (zz - xx) + (aa - bb) * xz;
    target[j + 7] = input[i + 7];
    target[j + 8] = input[i + 8] * hs * height;
    target[j + 9] = -b * xy + a * yz;
    target[j + 10] = bb * xx - 2 * ab * xz + aa * zz;
    target[j + 11] = part;
  }
}

class SplatBatch {
  constructor(library, placements, objects) {
    const assets = placements.map(placement => {
      const input = library.assets.get(placement.name);
      if (!input) throw new Error('Missing Gaussian asset ' + placement.name);
      return { input, placement };
    });
    const count = assets.reduce((n, asset) => n + asset.input.length / 11, 0);
    const height = Math.ceil((count * 3) / textureWidth);
    this.count = count;
    this.objects = objects;
    this.data = new Float32Array(textureWidth * height * 4);
    let index = 0;
    for (const { input, placement } of assets) {
      storePlacement(this.data, index, input, placement);
      index += input.length / 11;
    }
    const source = new T.DataTexture(this.data, textureWidth, height, T.RGBAFormat, T.FloatType);
    source.needsUpdate = true;
    this.depths = new Float32Array(count);
    this.buckets = new Uint32Array(bins);
    this.direction = new T.Vector3(Infinity, 0, 0);
    this.objectRevision = -1;
    this.order = new T.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(T.DynamicDrawUsage);
    this.geometry = new T.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute('splatId', this.order);
    this.geometry.instanceCount = count;
    this.material = new T.RawShaderMaterial({
      glslVersion: T.GLSL3,
      vertexShader: gaussVertex,
      fragmentShader: gaussFragment,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: T.CustomBlending,
      blendSrc: T.OneFactor,
      blendDst: T.OneMinusSrcAlphaFactor,
      blendSrcAlpha: T.OneFactor,
      blendDstAlpha: T.OneMinusSrcAlphaFactor,
      uniforms: {
        source: { value: source }, viewport: { value: new T.Vector2() },
        stage: { value: objects.texture },
        section: { value: new Float32Array(parts) }, daylight: { value: new T.Vector3(1, 1, 1) },
        rawSplat: { value: false },
      },
    });
    this.mesh = new T.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  sort(camera) {
    const m = camera.matrixWorldInverse.elements;
    const [x, y, z] = [m[2], m[6], m[10]];
    if (this.objectRevision === this.objects.revision &&
      (x - this.direction.x) ** 2 + (y - this.direction.y) ** 2 + (z - this.direction.z) ** 2 < .000021) return;
    this.direction.set(x, y, z);
    this.objectRevision = this.objects.revision;
    const { data, depths, buckets, count } = this;
    const { offsets } = this.objects;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0, j = 0; i < count; i++, j += stride) {
      let depth = data[j] * x + data[j + 1] * y + data[j + 2] * z;
      const part = data[j + 11];
      if (part >= parts) {
        const o = (part - parts) * 4;
        if (!offsets[o + 3]) {
          depths[i] = NaN;
          continue;
        }
        depth += offsets[o] * x + offsets[o + 1] * y + offsets[o + 2] * z;
      }
      depths[i] = depth = Math.fround(depth);
      lo = Math.min(lo, depth);
      hi = Math.max(hi, depth);
    }
    const scale = (bins - 1) / Math.max(hi - lo, .00001);
    buckets.fill(0);
    for (let i = 0; i < count; i++) {
      if (Number.isFinite(depths[i])) buckets[(scale * (depths[i] - lo)) | 0]++;
    }
    let offset = 0;
    for (let i = 0; i < bins; i++) {
      const length = buckets[i];
      buckets[i] = offset;
      offset += length;
    }
    const order = this.order.array;
    for (let i = 0; i < count; i++) {
      if (Number.isFinite(depths[i])) order[buckets[(scale * (depths[i] - lo)) | 0]++] = i;
    }
    this.geometry.instanceCount = offset;
    this.order.needsUpdate = true;
  }

  memory() {
    const gpu = this.data.byteLength + this.order.array.byteLength + 60;
    return { cpu: gpu + this.depths.byteLength + this.buckets.byteLength, gpu };
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.uniforms.source.value.dispose();
    this.material.dispose();
  }
}

const colors = [
  0x161723, 0x252738, 0x393446, 0x463d48, 0x51505a, 0x66606a, 0x847d7a, 0xac9e8e,
  0x2f2632, 0x483639, 0x5d403b, 0x704b40, 0x865c45, 0x9a6b4d, 0xb4815a, 0xcfa475,
  0x253931, 0x345042, 0x426145, 0x53754a, 0x677e43, 0x798d48, 0x8e9f56, 0xb0b768,
  0x243a56, 0x335374, 0x426e9b, 0x628db0, 0x83acc4, 0xb5c8cf,
  0x593331, 0x753c33, 0x954b37, 0xb76042, 0xcf8155, 0xe19971,
  0x695234, 0x85663c, 0xa0804a, 0xba9a57, 0xd4ae62, 0xf3cb76, 0xffe5a3, 0xf8ecce,
];
const palette = Array.from({ length: 48 }, (_, i) => {
  const h = colors[i] ?? 0;
  return new T.Vector3((h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
});

function nearestPaletteTexture() {
  const size = 32;
  const channels = new Uint8Array(size ** 3 * 2);
  let offset = 0;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    let best = 0;
    let solid = 0;
    let distance = Infinity;
    for (let i = 1; i < colors.length; i++) {
      const chip = palette[i];
      const d = .30 * (chip.x - r / 31) ** 2 + .55 * (chip.y - g / 31) ** 2 + .15 * (chip.z - b / 31) ** 2;
      if (d >= distance) continue;
      solid = i;
      distance = d;
    }
    best = solid;
    const bg = palette[0];
    if (.30 * (bg.x - r / 31) ** 2 + .55 * (bg.y - g / 31) ** 2 + .15 * (bg.z - b / 31) ** 2 <= distance) best = 0;
    channels[offset++] = best;
    channels[offset++] = solid;
  }
  const lut = new T.Data3DTexture(channels, size, size, size);
  lut.format = T.RGFormat;
  lut.needsUpdate = true;
  return lut;
}

// The Ink resolve normally gets a depth pass from its host. Shared alpha coverage carries the same
// silhouette mask for both splats and the existing opaque props, while leaving the painted sky behind it.
const resolveKernel = pixelLook
  .replace(/int pixelNearest[\s\S]*?(?=vec3 pixelMapped)/, `
    int pixelNearest(vec3 c, bool solid) {
      vec2 indices = texelFetch(nearestPalette, ivec3(round(clamp(c, 0.0, 1.0) * 31.0)), 0).rg;
      return int(round((solid ? indices.g : indices.r) * 255.0));
    }
  `)
  .replace('ivec2 q = p * 2; float d', 'float d')
  .replace('pixelAt(q + ivec2(x, y))', 'pixelAt(cellSample(p, ivec2(x, y)))')
  .replace('pixelAt(p * 2 + ivec2(i & 1, i >> 1))', 'pixelAt(cellSample(p, ivec2(i & 1, i >> 1)))')
  .replace('texelFetch(u_depth, pixelAt(cellSample(p, ivec2(x, y))), 0).r', 'coverageDepth(pixelAt(cellSample(p, ivec2(x, y))))')
  .replaceAll('texelFetch(u_depth, q, 0).r', 'coverageDepth(q)')
  .replaceAll('texelFetch(u_scene, q, 0).rgb', 'surfaceColor(q)');

const fullscreen = `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const linearToSrgb = `
vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - .055, greaterThan(c, vec3(.0031308)));
}`;

const resolveFragment = `
precision highp float;
precision highp int;
uniform highp sampler2D u_scene;
uniform highp sampler3D nearestPalette;
uniform int u_n;
uniform vec3 u_pal[48];
uniform vec3 u_out[48];
uniform float u_grade;
uniform float u_dither;
uniform ivec2 u_grid;
out vec4 color;
#define u_depth u_scene
#define PIXEL_NATIVE
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
vec4 sampleSurface(ivec2 p) { return texelFetch(u_scene, p, 0); }
float coverageDepth(ivec2 p) { return sampleSurface(p).a >= .46 ? 0.0 : 1.0; }
${linearToSrgb}
vec3 surfaceColor(ivec2 p) {
  vec4 v = sampleSurface(p);
  return srgb(v.rgb / max(.004, v.a));
}
ivec2 cellSample(ivec2 cell, ivec2 corner) {
  vec2 center = vec2(cell) + vec2(.25) + .5 * vec2(corner);
  return ivec2(floor(center * vec2(textureSize(u_scene, 0)) / vec2(u_grid)));
}
vec4 groupColor(ivec2 p) {
  return (sampleSurface(cellSample(p, ivec2(0, 0))) + sampleSurface(cellSample(p, ivec2(1, 0))) +
    sampleSurface(cellSample(p, ivec2(0, 1))) + sampleSurface(cellSample(p, ivec2(1, 1)))) * .25;
}
vec3 pixelNative(ivec2 p) {
  vec4 v = groupColor(p);
  return srgb(v.rgb / max(v.a, .004));
}
${resolveKernel}
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  if (groupColor(cell).a < .36) { color = vec4(0.0); return; }
  color = vec4(pixelResolve(cell), 1.0);
}`;

function screenPass(fragmentShader, uniforms) {
  const scene = new T.Scene();
  const pass = new T.Mesh(new T.PlaneGeometry(2, 2), new T.RawShaderMaterial({
    glslVersion: T.GLSL3, vertexShader: fullscreen, fragmentShader, uniforms, depthTest: false, depthWrite: false,
  }));
  pass.frustumCulled = false;
  scene.add(pass);
  return scene;
}

export class Gaussian {
  constructor(library, scene, objects) {
    this.library = library;
    this.scene = scene;
    this.objects = objects;
    this.camera = new T.Camera();
    this.pixelSize = PIXEL_DEFAULTS.size;
    this.high = new T.WebGLRenderTarget(2, 2, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    this.pixel = new T.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    this.resolve = screenPass(resolveFragment, {
      u_scene: { value: this.high.texture }, u_pal: { value: palette }, u_out: { value: palette },
      nearestPalette: { value: nearestPaletteTexture() },
      u_n: { value: colors.length }, u_grade: { value: 0 }, u_dither: { value: PIXEL_DEFAULTS.dither / 100 },
      u_grid: { value: new T.Vector2(1, 1) },
    });
    this.copy = screenPass(`
precision highp float;
uniform sampler2D image;
in vec2 vUv;
out vec4 color;
void main() { color = texture(image, vUv); }`, { image: { value: this.pixel.texture } });
    this.raw = screenPass(`
precision highp float;
uniform sampler2D image;
in vec2 vUv;
out vec4 color;
${linearToSrgb}
void main() {
  vec4 linear = texture(image, vUv);
  color = vec4(srgb(linear.rgb / max(.0001, linear.a)) * linear.a, linear.a);
}`, { image: { value: this.high.texture } });
  }

  use(key, placements) {
    if (this.key === key) return;
    this.batch?.dispose();
    this.batch = new SplatBatch(this.library, placements, this.objects);
    this.scene.add(this.batch.mesh);
    this.key = key;
  }

  resize(width, height) {
    this.high.setSize(2 * Math.max(1, Math.floor(width / 2)), 2 * Math.max(1, Math.floor(height / 2)));
    this.resizeGrid();
  }

  resizeGrid() {
    this.pixel.setSize(Math.max(1, Math.round(this.high.width / this.pixelSize)),
      Math.max(1, Math.round(this.high.height / this.pixelSize)));
    this.resolve.children[0].material.uniforms.u_grid.value.set(this.pixel.width, this.pixel.height);
  }

  tunePixelLook({ size, dither }) {
    this.resolve.children[0].material.uniforms.u_dither.value = dither / 100;
    if (size === this.pixelSize) return;
    this.pixelSize = size;
    this.resizeGrid();
  }

  render(renderer, camera, paint, light, raw) {
    const { batch } = this;
    batch.sort(camera);
    const uniforms = batch.material.uniforms;
    uniforms.section.value.set(paint);
    uniforms.viewport.value.set(this.high.width, this.high.height);
    uniforms.daylight.value.copy(light);
    uniforms.rawSplat.value = raw;
    renderer.setRenderTarget(this.high);
    renderer.render(this.scene, camera);
    if (raw) {
      renderer.setRenderTarget(null);
      renderer.render(this.raw, this.camera);
      return;
    }
    renderer.setRenderTarget(this.pixel);
    renderer.render(this.resolve, this.camera);
    renderer.setRenderTarget(null);
    renderer.render(this.copy, this.camera);
  }

  memory(raw) {
    const batch = this.batch.memory();
    // RGBA8 at both sizes and a 32-bit allocation for the high-resolution depth attachment.
    const targets = this.high.width * this.high.height * 8 + (raw ? 0 : this.pixel.width * this.pixel.height * 4);
    const lutBytes = raw ? 0 : this.resolve.children[0].material.uniforms.nearestPalette.value.image.data.byteLength;
    const stageBytes = this.objects.offsets.byteLength;
    return {
      cpu: batch.cpu + lutBytes + stageBytes,
      gpu: batch.gpu + targets + lutBytes + stageBytes,
      count: this.batch.geometry.instanceCount,
    };
  }
}
