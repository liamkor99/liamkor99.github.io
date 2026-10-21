const canvas = document.querySelector('#stl-canvas');
const errorMessage = document.querySelector('#stl-error');
const zoomInButton = document.querySelector('#stl-zoom-in');
const zoomOutButton = document.querySelector('#stl-zoom-out');
const resetButton = document.querySelector('#stl-reset');

const gl = canvas.getContext('webgl', { antialias: true, alpha: false });

if (!gl) {
  canvas.hidden = true;
  errorMessage.hidden = false;
  throw new Error('WebGL is not supported.');
}

const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform float u_rotation_x;
  uniform float u_rotation_y;
  uniform float u_zoom;
  uniform float u_aspect;
  varying vec3 v_normal;

  vec3 rotateX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  }

  vec3 rotateY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    vec3 p = rotateX(rotateY(a_position, u_rotation_y), u_rotation_x);
    vec3 n = rotateX(rotateY(a_normal, u_rotation_y), u_rotation_x);
    gl_Position = vec4((p.x * u_zoom) / u_aspect, p.y * u_zoom, p.z * 0.35, 1.0);
    v_normal = n;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec3 v_normal;

  void main() {
    vec3 normal = normalize(v_normal);
    vec3 lightDirection = normalize(vec3(0.45, 0.75, 1.0));
    float diffuse = abs(dot(normal, lightDirection));
    float light = 0.44 + diffuse * 0.56;
    vec3 baseColor = vec3(0.16, 0.62, 0.64);
    gl_FragColor = vec4(baseColor * light, 1.0);
  }
`;

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function parseBinaryStl(buffer) {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (buffer.byteLength < expectedLength) throw new Error('Invalid binary STL file.');

  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];

  let offset = 84;
  let cursor = 0;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const normal = [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)];
    offset += 12;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = view.getFloat32(offset, true);
        positions[cursor] = value;
        normals[cursor] = normal[axis];
        minimum[axis] = Math.min(minimum[axis], value);
        maximum[axis] = Math.max(maximum[axis], value);
        cursor += 1;
        offset += 4;
      }
    }
    offset += 2;
  }

  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const largestDimension = Math.max(...maximum.map((value, axis) => value - minimum[axis]));
  const scale = 1.7 / largestDimension;
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = (positions[index] - center[0]) * scale;
    positions[index + 1] = (positions[index + 1] - center[1]) * scale;
    positions[index + 2] = (positions[index + 2] - center[2]) * scale;
  }

  return { positions, normals, vertexCount: triangleCount * 3 };
}

const program = createProgram();
const positionLocation = gl.getAttribLocation(program, 'a_position');
const normalLocation = gl.getAttribLocation(program, 'a_normal');
const rotationXLocation = gl.getUniformLocation(program, 'u_rotation_x');
const rotationYLocation = gl.getUniformLocation(program, 'u_rotation_y');
const zoomLocation = gl.getUniformLocation(program, 'u_zoom');
const aspectLocation = gl.getUniformLocation(program, 'u_aspect');

let model;
let rotationX = -0.48;
let rotationY = 0.65;
let zoom = 0.82;
let dragging = false;
let previousX = 0;
let previousY = 0;

function createBuffer(location, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
}

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
}

function render() {
  if (!model) return;
  resizeCanvas();
  gl.clearColor(0.86, 0.91, 0.92, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(program);
  gl.uniform1f(rotationXLocation, rotationX);
  gl.uniform1f(rotationYLocation, rotationY);
  gl.uniform1f(zoomLocation, zoom);
  gl.uniform1f(aspectLocation, canvas.width / canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, model.vertexCount);
}

async function loadModel() {
  try {
    const modelUrl = new URL('./assets/project-media/R2D2/model.stl', import.meta.url).href;
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
    model = parseBinaryStl(await response.arrayBuffer());
    gl.useProgram(program);
    createBuffer(positionLocation, model.positions);
    createBuffer(normalLocation, model.normals);
    render();
  } catch (error) {
    console.error('Unable to load STL model:', error);
    canvas.hidden = true;
    errorMessage.hidden = false;
  }
}

canvas.addEventListener('pointerdown', event => {
  dragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  rotationY += (event.clientX - previousX) * 0.01;
  rotationX += (event.clientY - previousY) * 0.01;
  previousX = event.clientX;
  previousY = event.clientY;
  render();
});

canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = Math.max(0.45, Math.min(1.6, zoom - event.deltaY * 0.001));
  render();
}, { passive: false });

zoomInButton.addEventListener('click', () => { zoom = Math.min(1.6, zoom + 0.12); render(); });
zoomOutButton.addEventListener('click', () => { zoom = Math.max(0.45, zoom - 0.12); render(); });
resetButton.addEventListener('click', () => { rotationX = -0.48; rotationY = 0.65; zoom = 0.82; render(); });
window.addEventListener('resize', render);

loadModel();
