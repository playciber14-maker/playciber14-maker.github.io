// Демо: 3D-конфигуратор колёсных дисков. Крутится мышкой/пальцем, цена пересчитывается. Цены условные.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const DIAMETERS = { 16: 9900, 17: 11900, 18: 14500, 19: 17900 }; // ₽ за диск
const FINISHES = [
  { id: "silver", name: "Серебро", color: "#c9ced6", metal: 0.95, rough: 0.22, add: 0 },
  { id: "graphite", name: "Графит", color: "#4a4e57", metal: 0.85, rough: 0.3, add: 800 },
  { id: "black", name: "Чёрный мат", color: "#1c1c21", metal: 0.4, rough: 0.6, add: 800 },
  { id: "gold", name: "Золото", color: "#c9a24a", metal: 0.95, rough: 0.25, add: 2500 },
  { id: "teal", name: "Бирюза", color: "#18c9b0", metal: 0.6, rough: 0.3, add: 2500 },
];
const SPOKES = { 5: 0, 6: 600, 10: 1500 };
const CALIPERS = [
  { id: "red", name: "Красный", color: "#e2435b" },
  { id: "yellow", name: "Жёлтый", color: "#ffc861" },
  { id: "purple", name: "Фиолетовый", color: "#7a5cff" },
];
const MOUNT = 2400;
const fmt = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";

export function mount(root) {
  const state = { d: 18, finish: "graphite", spokes: 5, caliper: "red", mount: true };

  root.innerHTML = `
    <div class="cfg">
      <div class="cfg__view">
        <canvas class="cfg__canvas" aria-label="3D-модель колеса. Тяните, чтобы повернуть."></canvas>
        <p class="cfg__drag">↔ тяни, чтобы покрутить</p>
        <p class="cfg__fallback" hidden>3D не поддерживается этим браузером, но конфигуратор и цена работают.</p>
      </div>
      <form class="cfg__panel" onsubmit="return false">
        <fieldset><legend>Диаметр</legend>
          <div class="cfg__seg">${Object.keys(DIAMETERS).map((d) => `<label><input type="radio" name="cfg-d" value="${d}" ${+d === state.d ? "checked" : ""}><span>R${d}</span></label>`).join("")}</div>
        </fieldset>
        <fieldset><legend>Цвет диска</legend>
          <div class="cfg__swatches">${FINISHES.map((f) => `<label title="${f.name}"><input type="radio" name="cfg-f" value="${f.id}" ${f.id === state.finish ? "checked" : ""}><span style="--c:${f.color}"></span><em>${f.name}</em></label>`).join("")}</div>
        </fieldset>
        <fieldset><legend>Спицы</legend>
          <div class="cfg__seg">${Object.keys(SPOKES).map((s) => `<label><input type="radio" name="cfg-s" value="${s}" ${+s === state.spokes ? "checked" : ""}><span>${s}</span></label>`).join("")}</div>
        </fieldset>
        <fieldset><legend>Суппорт</legend>
          <div class="cfg__swatches cfg__swatches--sm">${CALIPERS.map((c) => `<label title="${c.name}"><input type="radio" name="cfg-c" value="${c.id}" ${c.id === state.caliper ? "checked" : ""}><span style="--c:${c.color}"></span><em>${c.name}</em></label>`).join("")}</div>
        </fieldset>
        <label class="cfg__check"><input type="checkbox" name="cfg-m" checked> Шиномонтаж и балансировка (+${fmt(MOUNT)})</label>
        <div class="cfg__total">
          <small>Комплект из 4 дисков</small>
          <strong class="cfg__price">—</strong>
          <small class="cfg__note">цены условные</small>
        </div>
        <button type="button" class="cfg__cta">Записаться на установку</button>
        <p class="cfg__thanks" hidden>Это демо: заявка никуда не ушла 🙂</p>
      </form>
    </div>`;

  const canvas = root.querySelector(".cfg__canvas");
  const priceEl = root.querySelector(".cfg__price");
  const form = root.querySelector(".cfg__panel");

  function price() {
    const f = FINISHES.find((x) => x.id === state.finish);
    return (DIAMETERS[state.d] + f.add + SPOKES[state.spokes]) * 4 + (state.mount ? MOUNT : 0);
  }
  function updatePrice() { priceEl.textContent = fmt(price()); }

  /* ---------- 3D ---------- */
  let renderer = null, raf = 0, ro = null, pmrem = null;
  let rebuild = () => {};
  const cleanup = [];

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.25, 6.2);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

    // «пол»-тень
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.45;
    shadow.scale.set(1, 0.35, 1);
    scene.add(shadow);

    const holder = new THREE.Group(); // повороты мышью
    scene.add(holder);
    let wheel = new THREE.Group();
    holder.add(wheel);

    const disposeGroup = (g) => g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });

    rebuild = () => {
      disposeGroup(wheel);
      holder.remove(wheel);
      wheel = new THREE.Group();
      holder.add(wheel);

      const f = FINISHES.find((x) => x.id === state.finish);
      const metal = new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metal, roughness: f.rough });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 });
      const rubber = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.92, metalness: 0 });

      const outer = 1.42;
      const rimR = 0.74 + (state.d - 16) * 0.085;   // больше диаметр → ниже профиль шины
      const tube = (outer - rimR) / 2;
      const width = 0.78;

      // шина
      const tire = new THREE.Mesh(new THREE.TorusGeometry(rimR + tube, tube, 28, 96), rubber);
      tire.scale.z = width / (tube * 2) * 0.95;
      wheel.add(tire);
      // протектор: насечки
      const grooveMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 1 });
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, width * 0.7), grooveMat);
        g.position.set(Math.cos(a) * (outer - 0.04), Math.sin(a) * (outer - 0.04), 0);
        g.rotation.z = a;
        wheel.add(g);
      }

      // обод
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.85, 64, 1, true), metal);
      barrel.rotation.x = Math.PI / 2;
      wheel.add(barrel);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.035, 12, 96), metal);
      lip.position.z = width * 0.42;
      wheel.add(lip);

      // тормозной диск и суппорт
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.06, 48), new THREE.MeshStandardMaterial({ color: 0x8a8d94, metalness: 0.9, roughness: 0.45 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.z = -0.1;
      wheel.add(disc);
      const cal = CALIPERS.find((x) => x.id === state.caliper);
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.24), new THREE.MeshStandardMaterial({ color: cal.color, roughness: 0.35, metalness: 0.2 }));
      caliper.position.set(rimR * 0.52, rimR * 0.52, -0.02);
      caliper.rotation.z = -Math.PI / 4;
      wheel.add(caliper);

      // спицы
      const n = state.spokes;
      const inner = 0.3;
      const len = rimR - inner;
      const thick = n === 10 ? 0.07 : n === 6 ? 0.12 : 0.16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(thick, len, 0.1), metal);
        sp.position.set(Math.cos(a) * (inner + len / 2), Math.sin(a) * (inner + len / 2), width * 0.3);
        sp.rotation.z = a - Math.PI / 2;
        sp.rotation.x = 0.12; // лёгкий «вогнутый» профиль
        wheel.add(sp);
      }

      // ступица, гайки, колпачок
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.16, 40), metal);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = width * 0.32;
      wheel.add(hub);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 6), dark);
        nut.rotation.x = Math.PI / 2;
        nut.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, width * 0.42);
        wheel.add(nut);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0x7a5cff, metalness: 0.5, roughness: 0.3 }));
      cap.rotation.x = Math.PI / 2;
      cap.position.z = width * 0.43;
      wheel.add(cap);
    };
    rebuild();

    // вращение мышью / пальцем
    let dragging = false, px = 0, py = 0;
    const rot = { y: -0.5, x: 0.05, ty: -0.5, tx: 0.05 };
    let idle = 0;
    const down = (e) => { dragging = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); idle = 0; };
    const move = (e) => {
      if (!dragging) return;
      rot.ty += (e.clientX - px) * 0.01;
      rot.tx = Math.max(-0.6, Math.min(0.6, rot.tx + (e.clientY - py) * 0.006));
      px = e.clientX; py = e.clientY;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = Math.max(6.2, 6.4 / (w / h)); // узкое окно → камера дальше
      camera.updateProjectionMatrix();
    };
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      idle += dt;
      if (!dragging && idle > 2 && !reduce) rot.ty += dt * 0.35; // сам медленно поворачивается
      rot.y += (rot.ty - rot.y) * Math.min(1, dt * 8);
      rot.x += (rot.tx - rot.x) * Math.min(1, dt * 8);
      holder.rotation.set(rot.x, rot.y, 0);
      if (!reduce) wheel.rotation.z -= dt * 0.25; // колесо «катится»
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    cleanup.push(() => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      disposeGroup(wheel);
      envTex.dispose();
    });
  } catch (err) {
    console.warn("Конфигуратор без 3D:", err);
    root.querySelector(".cfg__fallback").hidden = false;
    root.querySelector(".cfg__drag").hidden = true;
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "cfg-d") state.d = +t.value;
    if (t.name === "cfg-f") state.finish = t.value;
    if (t.name === "cfg-s") state.spokes = +t.value;
    if (t.name === "cfg-c") state.caliper = t.value;
    if (t.name === "cfg-m") state.mount = t.checked;
    if (t.name !== "cfg-m") rebuild();
    updatePrice();
  });
  root.querySelector(".cfg__cta").addEventListener("click", () => { root.querySelector(".cfg__thanks").hidden = false; });
  updatePrice();

  return () => {
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    cleanup.forEach((fn) => fn());
    if (pmrem) pmrem.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
  };
}
