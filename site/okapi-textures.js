/*
 * Okapi textures — WebGL2 fragment shaders, no dependencies.
 *
 *   <canvas data-okapi-tex="cebra"></canvas>
 *   <script src="okapi-textures.js"></script>
 *
 * Textures: cebra · glitch · puntos · relieve · fin
 * Optional attributes: data-bg="#2b2ed6" data-fg="#f2eee3" data-speed="1" data-scale="1"
 * Respects prefers-reduced-motion (renders one still frame) and pauses offscreen.
 */
(() => {
  const PALETTE = {
    ultramar: "#2B2ED6", // background from the UDO reference / the okapi's tongue
    noche: "#07081F",
    crema: "#F2EEE3",
    lengua: "#6F78FF", // the bright tongue blue from the landing, for light-on-dark
    tierra: "#16100D", // orange direction: background (the okapi's coat)
    naranja: "#C2562C", // orange direction: accent (chestnut)
  };

  // Shared GLSL: hash, value noise, fbm and the zebra field everything is built on.
  const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uBg; uniform vec3 uFg; uniform float uScale;
out vec4 outColor;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
// Zebra field: warped domain + thickness noise -> stripes that fork and taper. Sign = stripe / gap.
float zebra(vec2 p, float t){
  vec2 q = p + 2.0*vec2(fbm(p*0.55 + vec2(3.1, t*0.04)), fbm(p*0.55 - vec2(1.7, t*0.03)));
  float f = q.y*4.2 + q.x*0.9 + 1.2*fbm(q*0.9);
  // thickness noise at a finer scale makes stripes taper to points and fork (Y shapes)
  return sin(f*6.2831) + 3.2*(fbm(q*2.6 + 5.0) - 0.5) - 0.1;
}
vec2 uvAspect(){ return (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y); }
float grain(){ return hash(gl_FragCoord.xy + fract(uTime)*100.0) - 0.5; }
`;

  const FRAG = {
    // Crisp zebra stripes, cream on ultramarine, film grain.
    cebra: `
void main(){
  vec2 p = uvAspect() * 1.6 * uScale;
  float z = zebra(p, uTime);
  float m = smoothstep(-fwidth(z), fwidth(z), z);
  vec3 c = mix(uBg, uFg, m) + grain()*0.06;
  outColor = vec4(c, 1.0);
}`,
    // Zebra cut into horizontal slices that slide; the lower half "melts" more (UDO U24).
    glitch: `
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float rows = 46.0;
  float band = floor(uv.y * rows);
  float tick = floor(uTime * 2.0);
  float pick = step(0.72, hash(vec2(band, tick)));
  float melt = smoothstep(0.55, 0.0, uv.y);              // stronger toward the bottom
  float shift = (hash(vec2(band, tick + 7.0)) - 0.5) * (0.25*pick + 0.12*melt*hash(vec2(band, 3.0)));
  vec2 p = uvAspect() * 1.6 * uScale;
  p.x += shift * 2.0;
  float z = zebra(p, uTime);
  float m = smoothstep(-fwidth(z), fwidth(z), z);
  float scan = 0.94 + 0.06*step(0.5, fract(uv.y*rows));   // faint slice seams
  vec3 c = mix(uBg, uFg, m) * scan + grain()*0.07;
  outColor = vec4(c, 1.0);
}`,
    // Halftone dots on night: dot radius follows the smooth zebra field, with a slow glow sweep.
    puntos: `
void main(){
  float cell = 14.0 * (uRes.y / 900.0 + 0.4);
  vec2 g = floor(gl_FragCoord.xy / cell);
  vec2 center = (g + 0.5) * cell;
  vec2 p = ((center - 0.5*uRes) / min(uRes.x, uRes.y)) * 1.6 * uScale;
  float z = 0.06 + 0.94*smoothstep(-0.35, 0.35, zebra(p, uTime));  // full dots in a stripe, specks in the gaps
  float glow = 0.45 + 0.55*smoothstep(0.25, 0.85, fbm(p*0.5 + vec2(uTime*0.05, 0.0)));
  float r = cell * 0.46 * sqrt(z * glow);
  float d = length(gl_FragCoord.xy - center);
  float dot_ = 1.0 - smoothstep(r - 1.0, r + 0.5, d);
  vec3 c = mix(uBg, uFg, dot_ * (0.55 + 0.45*glow)) + grain()*0.03;
  outColor = vec4(c, 1.0);
}`,
    // Page ending: halftone dots that grow denser toward the bottom — irregular tongues from a
    // warped noise field, never straight rows — and always pure background at the top.
    fin: `
void main(){
  float cell = uRes.x * 0.014 * uScale;                        // same grid as "puntos" (~20px at 1440)
  vec2 g = floor(gl_FragCoord.xy / cell);
  vec2 center = (g + 0.5) * cell;
  vec2 uv = center / uRes;                                      // y = 0 at the bottom edge
  float yb = uv.y;                                              // 0 at the bottom, 1 at the top
  vec2 p = vec2(uv.x * uRes.x / uRes.y, yb);
  // warped domain -> the field drips and melts instead of forming rows/columns
  // the field drifts sideways and boils upward, so the footer is always alive
  vec2 q = p + 0.45 * vec2(fbm(p * 1.4 + vec2(uTime * 0.18, 0.0)), fbm(p * 1.4 + vec2(4.2, -uTime * 0.22)));
  float shape = fbm(q * vec2(2.6, 3.6) + vec2(7.0 - uTime * 0.12, 7.0 - uTime * 0.3)) - 0.5;
  float rise = 1.0 - yb;
  float wave = 0.16 * sin(p.x * 5.0 - uTime * 1.4 + yb * 7.0) * rise;   // a slow swell running through the dots
  float k = pow(rise, 2.4) * 1.3 + 1.9 * shape * (0.25 + rise) + wave + (hash(g) - 0.5) * 0.22 * rise;
  k *= smoothstep(0.88, 0.5, yb);                               // the top always ends in black
  k = clamp(k, 0.0, 1.35);
  float r = cell * 0.46 * sqrt(min(k, 1.0));
  float d = length(gl_FragCoord.xy - center);
  float dot_ = 1.0 - smoothstep(r - 0.8, r + 0.6, d);
  outColor = vec4(mix(uBg, uFg, dot_ * (0.3 + 0.7 * min(k, 1.0))) + grain() * 0.03, 1.0);
}`,
    // Stripes as relief: zebra field = height, lit from the top-left. Blue on blue + heavy grain.
    relieve: `
float h(vec2 p){ return smoothstep(-0.6, 0.6, zebra(p, uTime)); }
void main(){
  vec2 p = uvAspect() * 1.6 * uScale;
  float e = 0.004;
  float c0 = h(p);
  vec3 n = normalize(vec3(h(p - vec2(e,0)) - h(p + vec2(e,0)), h(p - vec2(0,e)) - h(p + vec2(0,e)), 0.05));
  float light = clamp(dot(n, normalize(vec3(-0.6, 0.7, 0.45))), 0.0, 1.0);
  vec3 deep = uBg * 0.18;
  vec3 c = mix(deep, uBg, 0.25 + 0.75*light) * (0.75 + 0.25*c0);
  c += uFg * pow(light, 12.0) * 0.25;                    // a little sheen on the ridges
  c += grain() * 0.12;
  outColor = vec4(c, 1.0);
}`,
  };

  const DEFAULTS = {
    cebra: { bg: PALETTE.ultramar, fg: PALETTE.crema },
    glitch: { bg: PALETTE.ultramar, fg: PALETTE.crema },
    puntos: { bg: PALETTE.noche, fg: PALETTE.lengua },
    relieve: { bg: PALETTE.ultramar, fg: PALETTE.crema },
    fin: { bg: PALETTE.tierra, fg: PALETTE.naranja },
  };

  const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(canvas) {
    const name = canvas.dataset.okapiTex;
    if (!FRAG[name]) return console.warn(`okapi-textures: unknown texture "${name}"`);
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return; // ponytail: no WebGL2 -> leave the canvas's CSS background as the fallback

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, COMMON + FRAG[name]));
    gl.linkProgram(prog); gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(prog, n);
    const d = DEFAULTS[name];
    gl.uniform3fv(u("uBg"), rgb(canvas.dataset.bg || d.bg));
    gl.uniform3fv(u("uFg"), rgb(canvas.dataset.fg || d.fg));
    gl.uniform1f(u("uScale"), parseFloat(canvas.dataset.scale || "1"));
    const speed = parseFloat(canvas.dataset.speed || "1");

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u("uRes"), canvas.width, canvas.height);
    };
    const draw = (t) => { gl.uniform1f(u("uTime"), t); gl.drawArrays(gl.TRIANGLES, 0, 3); };

    let visible = true, start = performance.now();
    new ResizeObserver(() => { resize(); draw((performance.now() - start) / 1000 * speed); }).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    resize();
    if (reduced) return draw(12.0);
    const loop = (now) => { if (visible) draw((now - start) / 1000 * speed); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  const init = () => document.querySelectorAll("canvas[data-okapi-tex]").forEach(mount);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
  window.OkapiTextures = { mount, PALETTE };
})();
