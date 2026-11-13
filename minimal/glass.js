// Капля жидкого стекла на первом экране (Three.js).
// Заголовок рисуется в текстуру на плоскости, а перед ней плавает прозрачная капля,
// которая по-настоящему преломляет текст. DOM-заголовок остаётся для чтения с экрана и поиска.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const FOV = 30;
const TAN = Math.tan((FOV / 2) * Math.PI / 180);

export function initGlass(hero) {
  const title = hero.querySelector(".hero__title");
  const canvas = document.createElement("canvas");
  canvas.className = "hero__gl";
  canvas.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    return false; // нет WebGL: остаётся обычный заголовок
  }
  hero.prepend(canvas);

  const small = window.matchMedia("(max-width: 767px)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 8000);

  /* ----- Плоскость с фоном и заголовком ----- */
  const tcan = document.createElement("canvas");
  const tex = new THREE.CanvasTexture(tcan);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scene.add(plane);

  /* ----- Капля ----- */
  const SEG_W = small ? 72 : 112, SEG_H = small ? 48 : 72;
  const geo = new THREE.SphereGeometry(1, SEG_W, SEG_H);
  const base = geo.attributes.position.array.slice(); // единичные направления
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, metalness: 0,
    transmission: 1, ior: 1.3, thickness: 0.9, dispersion: 1.5, // толщина в единицах модели: three сам умножает её на масштаб
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.5,
  });
  const drop = new THREE.Mesh(geo, mat);
  scene.add(drop);

  /* ----- Мягкая тень под каплей ----- */
  const scan = document.createElement("canvas");
  scan.width = scan.height = 128;
  const sc = scan.getContext("2d");
  const sg = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, "rgba(0,0,0,.55)");
  sg.addColorStop(0.5, "rgba(0,0,0,.2)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  sc.fillStyle = sg;
  sc.fillRect(0, 0, 128, 128);
  const shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(scan), transparent: true, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.position.z = 1;
  scene.add(shadow);

  let W = 0, H = 0, R = 100, cx = 0, cy = 0, ax = 0, ay = 0;
  let x = 0, y = 0, tx = 0, ty = 0, auto = true, visible = true, raf = 0;

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
    camera.aspect = W / H;
    camera.position.z = H / 2 / TAN; // 1 единица сцены = 1 пиксель на плоскости
    camera.updateProjectionMatrix();
    plane.scale.set(W, H, 1);

    R = Math.min(Math.max(Math.min(W, H) * 0.155, 64), 150);
    drop.scale.setScalar(R);
    drop.position.z = R * 1.5;
    shadow.scale.set(R * 3.4, R * 3.4, 1);

    const t = title.getBoundingClientRect(), h = hero.getBoundingClientRect();
    cx = t.left - h.left + t.width / 2;
    cy = t.top - h.top + t.height / 2;
    ax = Math.max(0, Math.min(t.width / 2 - R * 0.5, cx - R - 12, W - cx - R - 12));
    ay = t.height * 0.28;

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    shadowMat.opacity = dark ? 0.75 : 0.3;
    mat.envMapIntensity = dark ? 0.3 : 0.32;
  }

  // Живая форма капли: радиус меняется по трём волнам, нормали считаются по формуле
  const A = [0.1, 0.085, 0.07], F = [2.0, 2.5, 3.1], S = [0.55, 0.7, 0.45];
  function deform(t) {
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
    for (let i = 0; i < base.length; i += 3) {
      const nx = base[i], ny = base[i + 1], nz = base[i + 2];
      const a = F[0] * nx + t * S[0], b = F[1] * ny + t * S[1] + 1.3, c = F[2] * nz + t * S[2] + 2.1;
      const r = 1 + A[0] * Math.sin(a) + A[1] * Math.sin(b) + A[2] * Math.sin(c);
      const gx = A[0] * F[0] * Math.cos(a), gy = A[1] * F[1] * Math.cos(b), gz = A[2] * F[2] * Math.cos(c);
      const gn = gx * nx + gy * ny + gz * nz;
      let mx = nx * r - (gx - gn * nx), my = ny * r - (gy - gn * ny), mz = nz * r - (gz - gn * nz);
      const l = Math.hypot(mx, my, mz) || 1;
      pos[i] = nx * r; pos[i + 1] = ny * r; pos[i + 2] = nz * r;
      nor[i] = mx / l; nor[i + 1] = my / l; nor[i + 2] = mz / l;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const t = now / 1000;
    if (auto) {
      tx = cx + Math.sin(t * 0.31) * ax;
      ty = cy + Math.sin(t * 0.47 + 1) * ay;
    }
    tx = Math.min(Math.max(tx, R * 0.6), W - R * 0.6);
    ty = Math.min(Math.max(ty, R * 0.6), H - R * 0.6);
    const k = auto ? 0.035 : 0.09;
    x += (tx - x) * k;
    y += (ty - y) * k;

    deform(t);
    drop.position.x = x - W / 2;
    drop.position.y = H / 2 - y;
    drop.rotation.y = t * 0.12 + (tx - x) * 0.002; // чуть поворачивается при движении
    drop.rotation.x = Math.sin(t * 0.2) * 0.2 + (ty - y) * 0.002;
    shadow.position.x = drop.position.x + R * 0.25;
    shadow.position.y = drop.position.y - R * 0.75;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const h = hero.getBoundingClientRect();
    auto = false;
    tx = e.clientX - h.left;
    ty = e.clientY - h.top;
  });
  hero.addEventListener("pointerleave", () => { auto = true; });

  let rt = 0;
  const resized = () => { clearTimeout(rt); rt = setTimeout(size, 120); };
  window.addEventListener("resize", resized);
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
  x = tx = cx; y = ty = cy;
  frame(performance.now());
  hero.classList.add("has-gl");
  return true;
}
