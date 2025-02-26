'use strict';

(async function() {
  const canvas = document.getElementById('glCanvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert("WebGL not supported!");
    return;
  }

  // --- Global view parameters (for bucket recentering) ---
  let center = { x: -0.5, y: 0.0 };
  let bucket = { x: 0.0, y: 0.0 };
  let scale = 3.0;
  const MAX_ITER = 256; // constant loop count in shader

  // --- Resize canvas ---
  function resize() {
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Shader loader ---
  async function loadShaderSource(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.statusText}`);
    return await res.text();
  }

  // --- Load shaders ---
  const vsSource = await loadShaderSource('vertex.glsl');
  const fsSource = await loadShaderSource('mandelbrot.frag');

  // --- Compile shader ---
  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertexShader = compileShader(vsSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fsSource, gl.FRAGMENT_SHADER);

  // --- Create program ---
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // --- Get attribute and uniform locations ---
  const aPosLoc = gl.getAttribLocation(program, 'a_position');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uCenter = gl.getUniformLocation(program, 'u_center');
  const uBucket = gl.getUniformLocation(program, 'u_bucket');
  const uScale = gl.getUniformLocation(program, 'u_scale');
  // (We no longer use a uniform for max iterations since we use a constant in the shader)

  // --- Setup full-screen quad ---
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  // 2D positions for a full-screen triangle strip (or two triangles)
  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  // --- Bucket recentering helper ---
  function updateBucket() {
    const thresh = 0.5;
    if (Math.abs(center.x) > thresh) {
      const shift = Math.floor(center.x / thresh) * thresh;
      center.x -= shift;
      bucket.x += shift;
    }
    if (Math.abs(center.y) > thresh) {
      const shift = Math.floor(center.y / thresh) * thresh;
      center.y -= shift;
      bucket.y += shift;
    }
  }

  // --- Set uniforms ---
  function setUniforms() {
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform2f(uCenter, center.x, center.y);
    gl.uniform2f(uBucket, bucket.x, bucket.y);
    gl.uniform1f(uScale, scale);
  }

  // --- Input Handling ---
  // Zoom with mouse wheel.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    // Compute the complex coordinate under the mouse.
    const c_re = center.x + (normX - 0.5) * scale;
    const c_im = center.y + (normY - 0.5) * scale * (canvas.width / canvas.height);
    const zoom = e.deltaY < 0 ? 0.9 : 1.1;
    scale *= zoom;
    // Adjust center so that the point under the mouse stays fixed.
    center.x = c_re - (normX - 0.5) * scale;
    center.y = c_im - (normY - 0.5) * scale * (canvas.width / canvas.height);
    updateBucket();
  }, { passive: false });

  // Pan with mouse drag.
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    // Adjust center based on mouse movement.
    center.x -= dx / canvas.width * scale;
    center.y += dy / canvas.height * scale; // Invert Y
    lastMouse = { x: e.clientX, y: e.clientY };
    updateBucket();
  });
  canvas.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('mouseleave', () => { dragging = false; });

  // Pan with arrow keys.
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // --- Main Render Loop ---
  function render() {
    resize();
    // Arrow key panning.
    const panSpeed = scale * 0.01;
    if (keys['ArrowLeft']) center.x -= panSpeed;
    if (keys['ArrowRight']) center.x += panSpeed;
    if (keys['ArrowUp']) center.y += panSpeed;
    if (keys['ArrowDown']) center.y -= panSpeed;
    updateBucket();
    setUniforms();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  render();
})();
