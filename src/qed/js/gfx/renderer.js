const VERTEX = `
attribute vec2 a_position;
attribute vec3 a_look;
uniform vec2 u_view;
uniform vec2 u_offset;
uniform float u_size;
varying float v_alpha;
varying float v_tint;
void main() {
  vec2 p = (a_position - u_offset) / u_view * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  gl_PointSize = u_size * a_look.y;
  v_alpha = a_look.x;
  v_tint = a_look.z;
}`;

const FRAGMENT = `
precision mediump float;
uniform vec3 u_ink;
uniform vec3 u_accent;
uniform float u_glow;
varying float v_alpha;
varying float v_tint;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = v_alpha * smoothstep(1.0, 0.3, dot(d, d) * 4.0);
  // Premultiplied colour. Lowering the written alpha lets grains add up to light (chalk on a
  // board) instead of covering what is behind them (ink on paper).
  gl_FragColor = vec4(mix(u_ink, u_accent, v_tint) * a, a * (1.0 - u_glow));
}`;

// Grain diameter in CSS pixels.
const GRAIN = 1.7;
const STRIDE = 5;

/**
 * @typedef {object} Frame
 * @property {number} offsetX paper x at the left edge of the viewport
 * @property {number} offsetY paper y at the top edge of the viewport
 * @property {number[]} ink rgb, each 0..1
 * @property {number[]} accent rgb, each 0..1
 * @property {number} glow 0 = grains cover, 1 = grains add light
 */

function createWebglRenderer(canvas, keepFrames) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: keepFrames });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = { view: uniform('u_view'), offset: uniform('u_offset'), size: uniform('u_size'), ink: uniform('u_ink'), accent: uniform('u_accent'), glow: uniform('u_glow') };
  const position = gl.getAttribLocation(program, 'a_position');
  const look = gl.getAttribLocation(program, 'a_look');

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(look);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, STRIDE * 4, 0);
  gl.vertexAttribPointer(look, 3, gl.FLOAT, false, STRIDE * 4, 8);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let packed = new Float32Array(0);
  let width = 1;
  let height = 1;
  let dpr = 1;

  return {
    resize(w, h, ratio) {
      width = w;
      height = h;
      dpr = ratio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(P, frame) {
      if (packed.length !== P.count * STRIDE) {
        packed = new Float32Array(P.count * STRIDE);
        gl.bufferData(gl.ARRAY_BUFFER, packed.byteLength, gl.DYNAMIC_DRAW);
      }
      for (let i = 0, o = 0; i < P.count; i++, o += STRIDE) {
        packed[o] = P.x[i];
        packed[o + 1] = P.y[i];
        packed[o + 2] = P.alpha[i];
        packed[o + 3] = P.size[i];
        packed[o + 4] = P.tint[i];
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed);
      gl.uniform2f(u.view, width, height);
      gl.uniform2f(u.offset, frame.offsetX, frame.offsetY);
      gl.uniform1f(u.size, GRAIN * dpr);
      gl.uniform3fv(u.ink, frame.ink);
      gl.uniform3fv(u.accent, frame.accent);
      gl.uniform1f(u.glow, frame.glow);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, P.count);
    },
  };
}

function createCanvasRenderer(canvas) {
  const g = canvas.getContext('2d');
  let dpr = 1;
  const css = (rgb) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(' ')})`;
  return {
    resize(w, h, ratio) {
      dpr = ratio;
    },
    draw(P, frame) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      const ink = css(frame.ink);
      const accent = css(frame.accent);
      for (let i = 0; i < P.count; i++) {
        if (P.alpha[i] < 0.02) continue;
        const s = GRAIN * 0.7 * P.size[i];
        g.globalAlpha = Math.min(1, P.alpha[i]);
        g.fillStyle = P.tint[i] > 0.5 ? accent : ink;
        g.fillRect(P.x[i] - frame.offsetX - s / 2, P.y[i] - frame.offsetY - s / 2, s, s);
      }
    },
  };
}

/**
 * Creates the grain renderer for a canvas: WebGL points where available, 2D rectangles otherwise.
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} [keepFrames] keep each drawn frame readable after it is shown, which filming
 *   needs and which costs a full-canvas copy per frame
 * @returns {{resize(width: number, height: number, dpr: number): void,
 *   draw(P: ReturnType<import('./particles.js').createParticles>, frame: Frame): void,
 *   accelerated: boolean}} resize takes the viewport in CSS pixels; call it after the canvas
 *   backing store has been sized
 */
export function createRenderer(canvas, keepFrames = false) {
  const webgl = createWebglRenderer(canvas, keepFrames);
  return webgl ? { ...webgl, accelerated: true } : { ...createCanvasRenderer(canvas), accelerated: false };
}
