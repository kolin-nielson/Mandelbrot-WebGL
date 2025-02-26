#ifdef GL_ES
precision mediump float;
#endif

const int MAX_ITER = 256;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_bucket;
uniform float u_scale;

int MandelbrotTest(float cr, float ci) {
  float zr = 0.0;
  float zi = 0.0;
  for (int i = 0; i < MAX_ITER; i++) {
    float zr2 = zr * zr;
    float zi2 = zi * zi;
    if (zr2 + zi2 > 4.0) return i;
    float temp = zr2 - zi2 + cr;
    zi = 2.0 * zr * zi + ci;
    zr = temp;
  }
  return MAX_ITER;
}

// New palette: For low t values, interpolate between a very dark blue and a medium blue,
// then for higher t values transition from medium blue to a bright yellow.
vec3 palette(float t) {
  if (t < 0.5) {
    // t from 0.0 to 0.5: dark blue to medium blue.
    return mix(vec3(0.0, 0.0, 0.3), vec3(0.0, 0.5, 1.0), t * 2.0);
  } else {
    // t from 0.5 to 1.0: medium blue to bright yellow.
    return mix(vec3(0.0, 0.5, 1.0), vec3(0.9, 0.9, 0.1), (t - 0.5) * 2.0);
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  float cr = u_bucket.x + u_center.x + (uv.x - 0.5) * u_scale;
  float ci = u_bucket.y + u_center.y + (uv.y - 0.5) * (u_scale / aspect);
  int iter = MandelbrotTest(cr, ci);
  
  // For points inside the Mandelbrot set, render a dark color.
  if (iter == MAX_ITER) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float t = float(iter) / float(MAX_ITER);
    vec3 color = palette(t);
    gl_FragColor = vec4(color, 1.0);
  }
}
