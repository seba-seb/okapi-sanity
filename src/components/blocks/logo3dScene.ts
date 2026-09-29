import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

/** Draft-mode canvas-edit hook, published on `globalThis` by CanvasLogo3dEditor. */
type Logo3dEditor = {
  /** Patches numeric fields (rotationX/Y/Z, grain) on the block in the draft. */
  persist: (
    docId: string | undefined,
    path: string | undefined,
    fields: Record<string, number>,
  ) => void;
};
const getEditor = () =>
  (globalThis as { __logo3dEditor?: Logo3dEditor }).__logo3dEditor;

/** Dither block-size multiplier bounds for the on-canvas grain slider. */
const GRAIN_MIN = 0.35;
const GRAIN_MAX = 3;

export type Logo3dSceneOpts = {
  /** Starting orientation in degrees. */
  rotation?: { x: number; y: number; z: number };
  /** Dither block-size multiplier (1 = default grain). */
  grain?: number;
  /** Document id + GROQ path, so the gizmo can persist edits. */
  docId?: string;
  path?: string;
};

export type Logo3dController = {
  /** Tear down the scene, drop listeners, and release GPU resources. */
  dispose: () => void;
  /**
   * Re-read the logo color from the canvas CSS and apply it to the material in
   * place — so switching Primary/Secondary is instant and never rebuilds the
   * scene (which is what made color changes lag / sometimes not apply).
   */
  setColor: () => void;
};

/**
 * Builds and runs the spinning, dithered 3D-logo scene for one canvas — an
 * adaptation of the standalone footer script, generalized to any SVG. Returns a
 * cleanup function that stops the loop, drops listeners, and disposes GPU
 * resources. Loaded lazily by `Logo3d` so three.js is only fetched when a 3D
 * logo is actually on the page.
 *
 * The original hard-coded its mark's path data and was tuned for a 0–42 SVG
 * viewBox; here the SVG is parsed with `SVGLoader` and every size (extrude
 * depth, dither grain, scale) is derived from the shape's own bounds, so any
 * viewBox renders at a consistent world size.
 */
export function initLogo3dScene(
  canvas: HTMLCanvasElement,
  svgMarkup: string,
  opts: Logo3dSceneOpts = {},
): Logo3dController {
  const deg2rad = (d: number) => (d * Math.PI) / 180;
  const clampGrain = (g: number) => Math.min(GRAIN_MAX, Math.max(GRAIN_MIN, g));
  let grainValue = clampGrain(opts.grain ?? 1);
  let logoColor: THREE.Color;
  try {
    logoColor = new THREE.Color(getComputedStyle(canvas).color);
  } catch {
    logoColor = new THREE.Color("#CFD9E5");
  }
  const white = new THREE.Color(1, 1, 1);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.5, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping;

  // Soft, even matte lighting; neutral white so the shape's own color stays true.
  scene.add(new THREE.HemisphereLight(white, new THREE.Color(0.16, 0.16, 0.17), 2.2));
  const key = new THREE.DirectionalLight(white, 1.3);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(white, 0.4);
  fill.position.set(-4, -1, 2);
  scene.add(fill);

  // Parse the SVG into filled shapes.
  const shapes: THREE.Shape[] = [];
  try {
    const data = new SVGLoader().parse(svgMarkup);
    for (const p of data.paths) {
      for (const s of SVGLoader.createShapes(p)) shapes.push(s);
    }
  } catch {
    // malformed SVG — leave shapes empty
  }
  if (shapes.length === 0) {
    renderer.render(scene, camera);
    return {
      dispose: () => {
        renderer.forceContextLoss();
        renderer.dispose();
      },
      setColor: () => {},
    };
  }

  // SVG bounds (from shape outlines) → everything else scales off this.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    for (const pt of s.getPoints(6)) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  const svgMax = Math.max(maxX - minX || 1, maxY - minY || 1);
  // The dither block size at grain = 1; the hover slider scales this live.
  const baseBlock = svgMax * (0.1 / 42);

  const extrudeSettings = {
    depth: svgMax * (8 / 42),
    bevelEnabled: false,
    curveSegments: 72,
    steps: 1,
  };
  const partGeometries = shapes.map((shape) =>
    new THREE.ExtrudeGeometry(shape, extrudeSettings).toNonIndexed(),
  );

  // Merge parts into one non-indexed BufferGeometry (no external utils).
  const mergeGeometries = (geos: THREE.BufferGeometry[]) => {
    const merged = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      if (!geos[0].getAttribute(name)) continue;
      const itemSize = geos[0].getAttribute(name).itemSize;
      let total = 0;
      for (const g of geos) total += g.getAttribute(name).array.length;
      const arr = new Float32Array(total);
      let offset = 0;
      for (const g of geos) {
        arr.set(g.getAttribute(name).array as ArrayLike<number>, offset);
        offset += g.getAttribute(name).array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
    }
    return merged;
  };
  const geometry = mergeGeometries(partGeometries);
  geometry.center();
  geometry.rotateX(Math.PI); // SVG is Y-down → flip to Y-up
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;

  const material = new THREE.MeshStandardMaterial({
    color: logoColor,
    metalness: 0,
    roughness: 0.95,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  // Captured when the material compiles, so the hover grain slider can update
  // the dither block size (uBlockSize) live.
  let shaderRef: { uniforms: { uBlockSize: { value: number } } } | null = null;

  // Blocky dither punched into the shape: opaque at the top, fading transparent
  // toward the bottom. Driven by local Y so it holds still as the shape spins.
  material.onBeforeCompile = (shader) => {
    shaderRef = shader as unknown as typeof shaderRef;
    shader.uniforms.uBlockSize = { value: baseBlock * grainValue };
    shader.uniforms.uYMin = { value: bbox.min.y };
    shader.uniforms.uYMax = { value: bbox.max.y };
    shader.uniforms.uFalloff = { value: 2.2 };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLocalPos;\nvarying vec3 vObjNormal;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvLocalPos = position;\nvObjNormal = normal;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
          varying vec3 vLocalPos;
          varying vec3 vObjNormal;
          uniform float uBlockSize;
          uniform float uYMin;
          uniform float uYMax;
          uniform float uFalloff;
          float logoHash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }`,
      )
      .replace(
        "#include <dithering_fragment>",
        `{
            vec3 an = abs(vObjNormal);
            vec2 gp;
            if (an.z >= an.x && an.z >= an.y) { gp = vLocalPos.xy; }
            else if (an.x >= an.y) { gp = vLocalPos.zy; }
            else { gp = vLocalPos.xz; }
            vec2 cell = floor(gp / uBlockSize);
            float t = clamp((vLocalPos.y - uYMin) / (uYMax - uYMin), 0.0, 1.0);
            float m = pow(1.0 - t, uFalloff);
            float hard = step(logoHash(cell), m);
            float cellsPerPixel = length(fwidth(gp)) / uBlockSize;
            float blackness = mix(hard, m, clamp(cellsPerPixel - 1.0, 0.0, 1.0));
            gl_FragColor.a *= (1.0 - blackness);
            if (gl_FragColor.a < 0.01) discard;
          }
          #include <dithering_fragment>`,
      );
  };

  // Normalize world size (matches the original's ~6.7-unit mark) regardless of
  // the SVG's units, so the camera framing and constants below hold.
  const LOGO_SCALE = (42 * 0.16) / svgMax;
  const logo = new THREE.Mesh(geometry, material);
  logo.scale.setScalar(LOGO_SCALE);
  const baseRot = opts.rotation;
  logo.rotation.set(
    deg2rad(baseRot?.x ?? 0),
    deg2rad(baseRot?.y ?? 0),
    deg2rad(baseRot?.z ?? 0),
  );
  scene.add(logo);

  const frameRadius = geometry.boundingSphere!.radius * LOGO_SCALE;
  const shapeHalfHeight = ((bbox.max.y - bbox.min.y) * LOGO_SCALE) / 2;
  const maxHeightFraction = 0.85;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const distForHeight = shapeHalfHeight / (maxHeightFraction * tanHalfFov);
    const distForWidth = frameRadius / (tanHalfFov * camera.aspect);
    camera.position.set(0, 1.5, Math.max(distForHeight, distForWidth));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // --- Motion: idle spin + drag + scroll-scrub, all off for reduced motion. ---
  const autoVelocity = 0.6;
  const dragSensitivity = 0.01;
  const scrollSensitivity = 0.006;
  const returnDamping = 2.5;
  const maxFling = 10;
  const scrollSmoothing = 12;

  let dragging = false;
  let lastPointerX = 0;
  let lastMoveTime = 0;
  let lastScrollY = window.scrollY;
  let pendingScroll = 0;
  let angularVelocity = autoVelocity;
  let inView = false;
  let rafId: number | null = null;

  // Rotation-gizmo edit mode (draft only): pauses the spin while the user drags
  // the rings to set a starting orientation.
  let editing = false;
  let gizmoDragging = false;
  let controls: TransformControls | null = null;

  const clock = new THREE.Clock();
  const tick = () => {
    const delta = Math.min(clock.getDelta(), 0.1);
    // Keep spinning while the gizmo is merely hovered; pause only during an
    // active drag (a ring, or the horizontal spin-drag).
    if (!dragging && !gizmoDragging) {
      angularVelocity = THREE.MathUtils.lerp(
        angularVelocity,
        autoVelocity,
        1 - Math.exp(-returnDamping * delta),
      );
      logo.rotation.y += angularVelocity * delta;
      const scrollStep = pendingScroll * (1 - Math.exp(-scrollSmoothing * delta));
      logo.rotation.y += scrollStep;
      pendingScroll -= scrollStep;
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };
  const startLoop = () => {
    if (rafId === null) {
      clock.getDelta();
      rafId = requestAnimationFrame(tick);
    }
  };
  const stopLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
  const syncLoop = () => {
    if (inView && !reduceMotion) {
      startLoop();
    } else {
      stopLoop();
      if (inView) renderer.render(scene, camera);
    }
  };
  const inViewObserver = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    syncLoop();
  });
  inViewObserver.observe(canvas);

  // --- Rotation gizmo: hover the logo (draft mode) to rotate it across all
  // three axes and set its starting orientation. Uses three.js TransformControls
  // in "rotate" mode (the red/green/blue X/Y/Z rings). ---
  const rad2deg = (r: number) => (r * 180) / Math.PI;
  const norm360 = (d: number) => ((Math.round(d) % 360) + 360) % 360;

  const persistRotation = () => {
    getEditor()?.persist(opts.docId, opts.path, {
      rotationX: norm360(rad2deg(logo.rotation.x)),
      rotationY: norm360(rad2deg(logo.rotation.y)),
      rotationZ: norm360(rad2deg(logo.rotation.z)),
    });
  };

  // Strip TransformControls' rotate gizmo down to the three axis rings. Removes
  // the gray screen-space disc (XYZE) + yellow ring (E) + the drag helper line
  // (the "grey box"), and removes the Y ring's PICKER so the green ring shows
  // but can't be grabbed — horizontal rotation is owned by the drag interaction.
  const trimGizmo = (tc: TransformControls) => {
    // Everything that isn't an X/Y/Z ring, removed by name straight off the
    // gizmo tree (no reliance on the private `_gizmo` layout):
    //  - E     — yellow screen-space rotate ring
    //  - XYZE  — gray screen-space disc
    //  - AXIS / START / END / DELTA — the helper meshes shown ONLY while
    //    dragging (the "grey box" that appears mid-drag).
    const junk = new Set(["E", "XYZE", "AXIS", "START", "END", "DELTA"]);
    const kill: THREE.Object3D[] = [];
    tc.traverse((o) => {
      if (junk.has(o.name)) kill.push(o);
    });
    for (const o of kill) o.parent?.remove(o);

    // Disable the Y (green) ring: drop only its picker, so it stays visible but
    // can't be grabbed — horizontal rotation is owned by the drag interaction.
    const gz = (
      tc as unknown as { _gizmo?: { picker?: Record<string, THREE.Object3D> } }
    )._gizmo;
    const yPickers: THREE.Object3D[] = [];
    gz?.picker?.rotate?.traverse((o) => {
      if (o.name === "Y") yPickers.push(o);
    });
    for (const o of yPickers) o.parent?.remove(o);
  };

  // --- Grain slider: a hover control (draft mode) that scrubs the dither block
  // size live. A native <input type="range"> — the browser owns the drag, and
  // the spin-drag already ignores <input> targets (see `overCanvas`). It lives
  // inside the block element (position: relative) so hovering it doesn't count
  // as leaving the logo. ---
  const host = canvas.parentElement ?? canvas;
  let sliderEl: HTMLElement | null = null;
  let sliderDragging = false;

  const ensureSlider = () => {
    if (sliderEl) return;
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:absolute;left:50%;bottom:6%;transform:translateX(-50%);" +
      "display:none;align-items:center;padding:5px 10px;border-radius:999px;" +
      "background:rgba(15,15,22,0.5);backdrop-filter:blur(6px);" +
      "-webkit-backdrop-filter:blur(6px);z-index:6;";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(GRAIN_MIN);
    input.max = String(GRAIN_MAX);
    input.step = "0.01";
    input.value = String(grainValue);
    input.setAttribute("aria-label", "Dither grain");
    input.style.cssText = "width:118px;cursor:ew-resize;accent-color:#8b83ff;";
    input.addEventListener("input", () => {
      grainValue = clampGrain(parseFloat(input.value));
      if (shaderRef) shaderRef.uniforms.uBlockSize.value = baseBlock * grainValue;
      renderer.render(scene, camera);
    });
    input.addEventListener("change", () => {
      getEditor()?.persist(opts.docId, opts.path, { grain: grainValue });
    });
    input.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      sliderDragging = true;
    });
    wrap.appendChild(input);
    host.appendChild(wrap);
    sliderEl = wrap;
  };
  const clearSliderDrag = () => {
    sliderDragging = false;
  };
  window.addEventListener("pointerup", clearSliderDrag);

  const enterEdit = () => {
    if (editing || !getEditor()) return;
    editing = true;
    const tc = new TransformControls(camera, canvas);
    tc.setMode("rotate");
    tc.setSpace("world"); // rings stay fixed while the logo spins under them
    tc.attach(logo);
    trimGizmo(tc);
    scene.add(tc);
    tc.addEventListener("change", () => renderer.render(scene, camera));
    tc.addEventListener("mouseDown", () => {
      gizmoDragging = true;
    });
    tc.addEventListener("mouseUp", () => {
      gizmoDragging = false;
      persistRotation();
    });
    controls = tc;
    ensureSlider();
    if (sliderEl) sliderEl.style.display = "flex";
    startLoop(); // keep rendering while editing (spin is paused by `editing`)
  };

  const exitEdit = () => {
    if (!editing || gizmoDragging || sliderDragging) return;
    editing = false;
    if (sliderEl) sliderEl.style.display = "none";
    if (controls) {
      controls.detach();
      scene.remove(controls);
      controls.dispose();
      controls = null;
    }
    syncLoop();
    renderer.render(scene, camera);
  };

  host.addEventListener("pointerenter", enterEdit);
  host.addEventListener("pointerleave", exitEdit);

  const overCanvas = (event: PointerEvent) => {
    const t = event.target as Element | null;
    if (t?.closest?.("a, button, input, textarea, select, label, [role='button']")) {
      return false;
    }
    const rect = canvas.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  };
  const onPointerDown = (event: PointerEvent) => {
    if (reduceMotion || !overCanvas(event)) return;
    // In edit mode, a grab on an X/Z ring belongs to TransformControls; anywhere
    // else (incl. the disabled Y ring) drives horizontal rotation via the drag.
    if (editing && controls?.axis) return;
    event.preventDefault();
    dragging = true;
    angularVelocity = 0;
    pendingScroll = 0;
    lastPointerX = event.clientX;
    lastMoveTime = performance.now();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max((now - lastMoveTime) / 1000, 0.001);
    const deltaAngle = (event.clientX - lastPointerX) * dragSensitivity;
    logo.rotation.y += deltaAngle;
    angularVelocity = deltaAngle / dt;
    lastPointerX = event.clientX;
    lastMoveTime = now;
    if (rafId === null) renderer.render(scene, camera);
  };
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (editing) {
      // Setting the starting orientation — hold still (no fling) and save Y.
      angularVelocity = 0;
      persistRotation();
    } else {
      angularVelocity = THREE.MathUtils.clamp(angularVelocity, -maxFling, maxFling);
    }
    if (rafId === null) renderer.render(scene, camera);
  };
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  const onScroll = () => {
    const y = window.scrollY;
    const deltaY = y - lastScrollY;
    lastScrollY = y;
    if (reduceMotion || !inView || dragging) return;
    pendingScroll += deltaY * scrollSensitivity;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  renderer.render(scene, camera);

  const setColor = () => {
    try {
      material.color.set(getComputedStyle(canvas).color);
    } catch {
      // unparseable color — keep the current one
    }
    renderer.render(scene, camera);
  };

  const dispose = () => {
    stopLoop();
    resizeObserver.disconnect();
    inViewObserver.disconnect();
    host.removeEventListener("pointerenter", enterEdit);
    host.removeEventListener("pointerleave", exitEdit);
    window.removeEventListener("pointerup", clearSliderDrag);
    sliderEl?.remove();
    if (controls) {
      controls.detach();
      scene.remove(controls);
      controls.dispose();
      controls = null;
    }
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("scroll", onScroll);
    partGeometries.forEach((g) => g.dispose());
    geometry.dispose();
    material.dispose();
    // Release the WebGL context now (don't wait for GC) so rapid shape swaps
    // don't pile up contexts and hit the browser's ~16-context cap.
    renderer.forceContextLoss();
    renderer.dispose();
  };

  return { dispose, setColor };
}
