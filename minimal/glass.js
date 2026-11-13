// Панель рифлёного стекла на первом экране (Three.js, один шейдер).
// Фон и заголовок рисуются в текстуру ровно там, где они стоят в DOM, а шейдер
// «ломает» картинку под панелью на вертикальные рёбра, как настоящее ребристое стекло.
// DOM-заголовок остаётся для чтения с экрана и поиска.

import * as THREE from "three";

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uRes;      // размер первого экрана, px
  uniform vec4 uBox;      // панель: центр x, центр y, половина ширины, половина высоты
  uniform float uRadius;  // скругление углов
  uniform float uRib;     // ширина одного ребра
  uniform float uHi;      // сила бликов (в тёмной теме слабее)
  varying vec2 vUv;

  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
    vec2 p = px - uBox.xy;
    float d = box(p, uBox.zw, uRadius);
    float inside = 1.0 - smoothstep(-1.0, 0.5, d);

    // положение внутри ребра: -0.5 слева, +0.5 справа
    float c = fract((p.x + uBox.z) / uRib) - 0.5;
    // каждое ребро работает как цилиндрическая линза: растягивает картинку от своего центра
    float shift = c * uRib * 1.55;
    float ca = c * uRib * 0.16; // лёгкая радужная кайма

    vec2 uv = vUv;
    uv.x += inside * shift / uRes.x;
    float dx = inside * ca / uRes.x;
    vec3 col = vec3(
      texture2D(uTex, vec2(uv.x + dx, uv.y)).r,
      texture2D(uTex, uv).g,
      texture2D(uTex, vec2(uv.x - dx, uv.y)).b
    );

    // объём ребра: блик на одной кромке, тень на другой
    float hi = smoothstep(0.26, 0.5, c);
    float sh = smoothstep(0.26, 0.5, -c);
    col = mix(col, vec3(1.0), inside * hi * 0.15 * uHi);
    col *= 1.0 - inside * (sh * 0.15 + 0.035);
    // тонкая светлая кромка самой панели и мягкая тень снаружи
    float edge = smoothstep(-2.5, -0.5, d) * inside;
    col = mix(col, vec3(1.0), edge * 0.35 * uHi);
    float outer = (1.0 - inside) * (1.0 - smoothstep(0.0, 46.0, d));
    col *= 1.0 - outer * outer * 0.10;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function initGlass(hero) {
  const title = hero.querySelector(".hero__title");
  const foot = hero.querySelector(".hero__foot");
  const canvas = document.createElement("canvas");
  canvas.className = "hero__gl";
  canvas.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  } catch (err) {
    return false; // нет WebGL: остаётся обычный заголовок
  }
  hero.prepend(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const tcan = document.createElement("canvas");
  const tex = new THREE.CanvasTexture(tcan);
  tex.colorSpace = THREE.NoColorSpace; // цвета выводим как есть, без пересчёта
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;

  const uniforms = {
    uTex: { value: tex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRadius: { value: 20 },
    uRib: { value: 24 },
    uHi: { value: 1 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG })));

  let W = 0, H = 0, half = 100, cx = 0, ax = 0;
  let x = 0, tx = 0, auto = true, visible = true, raf = 0;

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function blob(c, bx, by, r, color) {
    const g = c.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(128,128,128,0)");
    c.fillStyle = g;
    c.fillRect(bx - r, by - r, r * 2, r * 2);
  }

  // Рисуем фон и заголовок в текстуру, слово за словом, ровно там, где они стоят в DOM
  function paint() {
    const h = hero.getBoundingClientRect();
    W = h.width; H = h.height;
    tcan.width = Math.round(W * dpr);
    tcan.height = Math.round(H * dpr);
    const c = tcan.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = cssVar("--paper");
    c.fillRect(0, 0, W, H);
    const m = Math.max(W, H);
    blob(c, W * 0.86, H * 0.08, m * 0.5, cssVar("--blob-a"));
    blob(c, W * 0.08, H * 0.95, m * 0.42, cssVar("--blob-b"));

    const ink = cssVar("--ink"), accent = cssVar("--accent");
    c.textBaseline = "alphabetic";
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const st = getComputedStyle(node.parentElement);
      c.fillStyle = node.parentElement.closest("em") ? accent : ink; // курсив заголовка акцентным цветом
      c.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      if ("letterSpacing" in c) c.letterSpacing = st.letterSpacing;
      const mt = c.measureText("Hg");
      const asc = mt.fontBoundingBoxAscent, desc = mt.fontBoundingBoxDescent;
      const re = /\S+/g;
      for (let w = re.exec(node.data); w; w = re.exec(node.data)) {
        range.setStart(node, w.index);
        range.setEnd(node, w.index + w[0].length);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        c.fillText(w[0], r.left - h.left, r.top - h.top + (r.height - (asc + desc)) / 2 + asc);
      }
    }
    tex.dispose();
    tex.needsUpdate = true;
  }

  function size() {
    paint();
    renderer.setSize(W, H, false);
    uniforms.uRes.value.set(W, H);

    const h = hero.getBoundingClientRect(), t = title.getBoundingClientRect(), f = foot.getBoundingClientRect();
    const small = W < 768;
    const rib = small ? 15 : Math.round(Math.min(Math.max(W * 0.017, 20), 28));
    const ribs = small ? 7 : 9;
    half = (rib * ribs) / 2;
    // панель по высоте: чуть выше и ниже заголовка, но не залезает на шапку и нижний текст
    const top = Math.max(t.top - h.top - (small ? 56 : 90), 84);
    const bottom = Math.min(t.bottom - h.top + (small ? 56 : 90), f.top - h.top - 20);
    uniforms.uBox.value.set(0, (top + bottom) / 2, half, (bottom - top) / 2);
    uniforms.uRib.value = rib;
    uniforms.uRadius.value = small ? 14 : 20;
    uniforms.uHi.value = window.matchMedia("(prefers-color-scheme: dark)").matches ? 0.4 : 1;

    cx = t.left - h.left + t.width / 2;
    ax = Math.max(0, Math.min(t.width / 2 - half * 0.5, cx - half - 12, W - cx - half - 12));
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    if (auto) tx = cx + Math.sin(now / 1000 * 0.28) * ax;
    tx = Math.min(Math.max(tx, half + 8), W - half - 8);
    x += (tx - x) * (auto ? 0.04 : 0.09);
    uniforms.uBox.value.x = x;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    auto = false;
    tx = e.clientX - hero.getBoundingClientRect().left;
  });
  hero.addEventListener("pointerleave", () => { auto = true; });

  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 120); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", size);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(hero);
  }
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    hero.classList.remove("has-gl"); // возвращаем обычный заголовок
    visible = false;
  });

  // заголовок должен стоять на месте до замера: доводим анимацию появления до конца
  title.getAnimations({ subtree: true }).forEach((a) => a.finish());
  size();
  x = tx = cx + ax * 0.6;
  frame(performance.now());
  hero.classList.add("has-gl");
  return true;
}
