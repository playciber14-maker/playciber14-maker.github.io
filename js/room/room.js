// Интерактивная 3D-комната: предметы = разделы сайта. Клик → камера подлетает → открывается панель.
// События: шлёт "room:open" {key}; слушает "room:focus" {key} и "room:close".

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { codeScreen, phoneScreen, sticky, windowView, poster } from "./textures.js";
import { isNight, toggleTheme } from "../theme.js";

const stage = document.querySelector(".stage");
const canvas = document.getElementById("room");
const hotspotsEl = document.querySelector(".hotspots");
const root = document.documentElement;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmall = window.matchMedia("(max-width: 767px)").matches;
const lowPower = isSmall || (navigator.hardwareConcurrency || 8) <= 4;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

if (!stage || !canvas || !hasWebGL()) {
  root.classList.add("no-room");
} else {
  // Ждём шрифты (для надписей на текстурах), но не дольше секунды
  Promise.race([document.fonts?.ready || Promise.resolve(), new Promise((r) => setTimeout(r, 1000))])
    .then(() => {
      try {
        init();
      } catch (err) {
        console.error("3D-комната не запустилась:", err);
        root.classList.add("no-room");
        root.dataset.room = "off";
      }
    });
}

/* ================================================================ */

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  /* ---------- Помощники ---------- */
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o });
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat);
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (rt, rb, h, mat, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  const sph = (r, mat, seg = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
  const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

  // Материалы, которые меняют цвет днём и ночью: [материал, дневной, ночной]
  const themed = [];
  const themedMat = (day, night, o) => {
    const m = std(day, o);
    themed.push([m, new THREE.Color(day), new THREE.Color(night)]);
    return m;
  };

  const updaters = [];
  const C = {
    ink: 0x2b2640,
    white: 0xfbfaff,
    wood: 0xe7c6a0,
    purple: 0x7a5cff,
    teal: 0x18c9b0,
    peach: 0xf4a37a,
    yellow: 0xffd56b,
    pink: 0xff9ec0,
  };

  /* ---------- Комната ---------- */
  const floor = at(rbox(12, 0.4, 12, 0.1, themedMat(0xf1d6c0, 0x231c3a)), 0, -0.2, 0);
  const backWall = at(rbox(12, 7, 0.3, 0.06, themedMat(0xe9e2ff, 0x1a1636)), 0, 3.3, -6.15);
  const leftWall = at(rbox(0.3, 7, 12, 0.06, themedMat(0xd9f2ea, 0x132238)), -6.15, 3.3, 0);
  const rug = at(cyl(3.1, 3.1, 0.04, themedMat(0xd4c8ff, 0x372a66), 48), 0.8, 0.02, -1.4);
  const rugInner = at(cyl(2.2, 2.2, 0.045, themedMat(0xe8e1ff, 0x45358a), 48), 0.8, 0.025, -1.4);
  scene.add(floor, backWall, leftWall, rug, rugInner);

  // Плинтусы
  scene.add(at(box(12, 0.25, 0.08, std(C.white)), 0, 0.12, -5.98));
  scene.add(at(box(0.08, 0.25, 12, std(C.white)), -5.98, 0.12, 0));

  // Неоновые ленты (видны ночью)
  const neonMats = [];
  const neon = (geo, color, x, y, z) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false });
    neonMats.push(m);
    const mesh = at(new THREE.Mesh(geo, m), x, y, z);
    scene.add(mesh);
    return mesh;
  };
  neon(new THREE.BoxGeometry(11.6, 0.06, 0.06), C.purple, 0, 6.6, -5.95);
  neon(new THREE.BoxGeometry(0.06, 0.06, 11.6), C.teal, -5.95, 6.6, 0);
  neon(new THREE.BoxGeometry(5.2, 0.05, 0.05), C.teal, 0.5, 2.15, -3.58);

  /* ---------- Окно ---------- */
  const win = new THREE.Group();
  win.add(at(rbox(2.7, 2.5, 0.2, 0.06, std(C.white)), 0, 0, 0));
  const dayView = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1), new THREE.MeshBasicMaterial({ map: windowView(false), transparent: true, toneMapped: false }));
  const nightView = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1), new THREE.MeshBasicMaterial({ map: windowView(true), transparent: true, opacity: 0, toneMapped: false }));
  dayView.position.z = 0.11;
  nightView.position.z = 0.115;
  win.add(dayView, nightView);
  win.add(at(box(0.08, 2.1, 0.06, std(C.white)), 0, 0, 0.14));
  win.add(at(box(2.3, 0.08, 0.06, std(C.white)), 0, 0, 0.14));
  win.add(at(rbox(3.0, 0.14, 0.45, 0.05, std(C.white)), 0, -1.3, 0.2));
  win.position.set(-3.5, 4.6, -5.98);
  scene.add(win);

  /* ---------- Постер ---------- */
  const posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.88), new THREE.MeshBasicMaterial({ map: poster(), toneMapped: false }));
  posterMesh.rotation.y = Math.PI / 2;
  posterMesh.position.set(-5.96, 4.3, 2.4);
  const posterFrame = at(rbox(0.08, 2.04, 1.66, 0.03, std(C.white)), -5.99, 4.3, 2.4);
  scene.add(posterFrame, posterMesh);

  /* ---------- Стол ---------- */
  const desk = new THREE.Group();
  desk.add(at(rbox(5.4, 0.22, 2.3, 0.08, std(C.wood)), 0, 2.3, 0));
  [[-2.5, -0.95], [-2.5, 0.95], [2.5, -0.95], [2.5, 0.95]].forEach(([x, z]) => {
    desk.add(at(cyl(0.07, 0.07, 2.2, std(C.ink)), x, 1.1, z));
  });
  desk.add(at(rbox(1.3, 1.25, 2.0, 0.08, std(C.white)), 1.85, 1.55, 0));
  desk.add(at(box(0.5, 0.06, 0.05, std(C.purple)), 1.85, 1.75, 1.01));
  desk.add(at(box(0.5, 0.06, 0.05, std(C.purple)), 1.85, 1.3, 1.01));
  desk.position.set(0.5, 0, -4.7);
  scene.add(desk);

  // Клавиатура, мышь, кружка
  scene.add(at(rbox(1.8, 0.08, 0.6, 0.04, std(C.white)), 0.3, 2.45, -4.05));
  scene.add(at(rbox(0.22, 0.08, 0.34, 0.08, std(C.white)), 1.45, 2.45, -4.0));
  const mug = new THREE.Group();
  mug.add(at(cyl(0.18, 0.16, 0.38, std(C.teal)), 0, 0.19, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 10, 20), std(C.teal));
  handle.position.set(0.2, 0.2, 0);
  mug.add(handle);
  mug.position.set(-1.15, 2.41, -4.05);
  scene.add(mug);

  // Стул
  const chair = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leg = box(0.75, 0.08, 0.12, std(C.ink));
    leg.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.37, 0.2, Math.sin((i / 5) * Math.PI * 2) * 0.37);
    leg.rotation.y = -(i / 5) * Math.PI * 2;
    chair.add(leg);
    chair.add(at(sph(0.08, std(C.ink)), Math.cos((i / 5) * Math.PI * 2) * 0.72, 0.09, Math.sin((i / 5) * Math.PI * 2) * 0.72));
  }
  chair.add(at(cyl(0.07, 0.07, 1.1, std(0x9aa0b5, { metalness: 0.4, roughness: 0.4 })), 0, 0.8, 0));
  chair.add(at(rbox(1.3, 0.2, 1.2, 0.09, std(C.purple)), 0, 1.4, 0));
  chair.add(at(rbox(1.3, 1.3, 0.18, 0.09, std(C.purple)), 0, 2.15, 0.56));
  chair.position.set(0.6, 0, -2.85);
  scene.add(chair);

  // Растение
  const plant = new THREE.Group();
  plant.add(at(cyl(0.5, 0.38, 0.9, std(C.peach)), 0, 0.45, 0));
  plant.add(at(cyl(0.46, 0.46, 0.06, std(0x6b4a3a)), 0, 0.88, 0));
  const leafMat = std(0x3fbf7f);
  const leaves = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), leafMat);
    leaf.scale.set(0.45, 1.5, 0.22);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.28, 1.45 + (i % 2) * 0.2, Math.sin(a) * 0.28);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    leaves.add(leaf);
  }
  plant.add(leaves);
  plant.position.set(-4.7, 0, 4.0);
  scene.add(plant);
  updaters.push((dt, t) => { if (!reduceMotion) leaves.rotation.z = Math.sin(t * 0.8) * 0.04; });

  /* ================= ИНТЕРАКТИВНЫЕ ПРЕДМЕТЫ ================= */
  const items = {};
  function interactive(key, group, opts) {
    group.userData.key = key;
    items[key] = {
      key,
      group,
      baseY: group.position.y,
      hover: 0,
      label: opts.label,
      anchor: opts.anchor,          // точка метки (локальные координаты группы)
      focus: opts.focus,            // куда смотрит камера (мировые)
      viewDir: opts.viewDir.clone().normalize(),
      viewDist: opts.viewDist,
    };
    scene.add(group);
  }

  /* ---------- Монитор → Проекты ---------- */
  const code = codeScreen();
  updaters.push((dt, t) => code.update(dt, t));
  const monitor = new THREE.Group();
  monitor.add(at(rbox(0.9, 0.06, 0.6, 0.03, std(C.ink)), 0, 0.03, 0));
  monitor.add(at(box(0.12, 0.75, 0.12, std(C.ink)), 0, 0.42, -0.1));
  monitor.add(at(rbox(2.9, 1.78, 0.14, 0.06, std(C.ink)), 0, 1.38, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.72, 1.58), new THREE.MeshBasicMaterial({ map: code.texture, toneMapped: false }));
  screen.position.set(0, 1.38, 0.075);
  monitor.add(screen);
  monitor.position.set(0.3, 2.41, -5.15);
  interactive("projects", monitor, {
    label: "Проекты",
    anchor: new THREE.Vector3(0, 2.45, 0),
    focus: new THREE.Vector3(0.3, 3.75, -5.1),
    viewDir: new THREE.Vector3(0.35, 0.18, 1),
    viewDist: 7.5,
  });

  /* ---------- Робот → Услуги ---------- */
  const robot = new THREE.Group();
  const robotWhite = std(0xf7f6ff, { roughness: 0.45 });
  robot.add(at(rbox(0.38, 0.32, 0.6, 0.1, std(C.ink)), -0.32, 0.16, 0));
  robot.add(at(rbox(0.38, 0.32, 0.6, 0.1, std(C.ink)), 0.32, 0.16, 0));
  robot.add(at(rbox(1.3, 1.25, 0.95, 0.24, robotWhite), 0, 0.95, 0));
  robot.add(at(rbox(0.72, 0.46, 0.06, 0.06, std(C.teal)), 0, 0.92, 0.48));
  robot.add(at(cyl(0.14, 0.14, 0.2, std(C.ink)), 0, 1.66, 0));
  const head = new THREE.Group();
  head.add(at(rbox(1.15, 0.86, 0.9, 0.24, robotWhite), 0, 0, 0));
  head.add(at(rbox(0.9, 0.56, 0.06, 0.12, std(0x1e1a2b, { roughness: 0.3 })), 0, 0, 0.44));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3cf2d6, toneMapped: false });
  const eyeL = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), eyeMat), -0.2, 0.02, 0.48);
  const eyeR = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), eyeMat), 0.2, 0.02, 0.48);
  head.add(eyeL, eyeR);
  head.add(at(cyl(0.03, 0.03, 0.4, std(C.ink)), 0, 0.62, 0));
  const antennaMat = new THREE.MeshBasicMaterial({ color: C.purple, toneMapped: false });
  head.add(at(sph(0.1, antennaMat), 0, 0.86, 0));
  head.add(at(rbox(0.12, 0.3, 0.3, 0.05, std(C.purple)), -0.62, 0, 0));
  head.add(at(rbox(0.12, 0.3, 0.3, 0.05, std(C.purple)), 0.62, 0, 0));
  head.position.set(0, 2.18, 0);
  robot.add(head);
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.74, 1.38, 0);
    const arm = at(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 10), robotWhite), 0, -0.38, 0);
    const hand = at(sph(0.15, std(C.purple)), 0, -0.78, 0);
    pivot.add(arm, hand);
    pivot.rotation.z = side * 0.18;
    robot.add(pivot);
    return pivot;
  };
  makeArm(-1);
  const armR = makeArm(1);
  robot.position.set(3.75, 0, -1.4);
  robot.rotation.y = -0.55;
  interactive("services", robot, {
    label: "Услуги",
    anchor: new THREE.Vector3(0, 3.35, 0),
    focus: new THREE.Vector3(3.75, 1.8, -1.4),
    viewDir: new THREE.Vector3(0.5, 0.35, 1),
    viewDist: 10,
  });
  updaters.push((dt, t) => {
    const h = items.services.hover;
    if (!reduceMotion) {
      head.rotation.y = Math.sin(t * 0.7) * 0.25;
      head.position.y = 2.18 + Math.sin(t * 2) * 0.03;
      // моргание
      const blink = (t % 3.2) < 0.12 ? 0.15 : 1;
      eyeL.scale.y = eyeR.scale.y = blink;
    }
    // машет рукой при наведении
    const wave = h > 0.05 ? 2.5 + Math.sin(t * 9) * 0.35 : 0.18;
    armR.rotation.z += (wave * Math.max(h, 0.07) - armR.rotation.z) * Math.min(1, dt * 8);
    antennaMat.color.setHSL(0.72 - h * 0.25, 0.9, 0.62 + Math.sin(t * 4) * 0.08);
  });

  /* ---------- Полка → Обо мне ---------- */
  const shelf = new THREE.Group();
  shelf.add(at(rbox(0.7, 0.12, 3.8, 0.04, std(C.white)), 0.35, 0, 0));
  shelf.add(at(rbox(0.7, 0.12, 3.8, 0.04, std(C.white)), 0.35, -1.3, 0));
  const bookColors = [C.purple, C.teal, C.peach, C.yellow, C.pink, 0x5aa9ff, C.ink];
  let z = -1.7;
  for (let i = 0; i < 9; i++) {
    const h = 0.55 + ((i * 37) % 30) / 100;
    const w = 0.18 + ((i * 13) % 12) / 100;
    const book = at(rbox(0.5, h, w, 0.03, std(bookColors[i % bookColors.length])), 0.35, 0.06 + h / 2, z + w / 2);
    if (i === 6) { book.rotation.x = 0.25; book.position.y -= 0.03; }
    shelf.add(book);
    z += w + 0.03;
  }
  // кубок
  const gold = std(0xf5c043, { metalness: 0.6, roughness: 0.3 });
  shelf.add(at(cyl(0.16, 0.2, 0.12, gold), 0.35, 0.12, 1.25));
  shelf.add(at(cyl(0.05, 0.05, 0.25, gold), 0.35, 0.3, 1.25));
  shelf.add(at(cyl(0.22, 0.1, 0.32, gold), 0.35, 0.58, 1.25));
  // нижняя полка: стопка книг и кубик
  [0, 1, 2].forEach((i) => shelf.add(at(rbox(0.5, 0.12, 0.7, 0.03, std(bookColors[(i + 2) % 7])), 0.35, -1.18 + i * 0.13, -1.2)));
  shelf.add(at(rbox(0.36, 0.36, 0.36, 0.06, std(C.teal)), 0.35, -1.06, 0.2));
  shelf.add(at(sph(0.2, std(C.pink)), 0.35, -1.04, 1.0));
  shelf.position.set(-5.95, 4.0, -1.4);
  interactive("about", shelf, {
    label: "Обо мне",
    anchor: new THREE.Vector3(0.4, 1.15, 0),
    focus: new THREE.Vector3(-5.5, 3.6, -1.4),
    viewDir: new THREE.Vector3(1, 0.3, 0.55),
    viewDist: 9.5,
  });

  /* ---------- Доска со стикерами → Как я работаю ---------- */
  const board = new THREE.Group();
  board.add(at(rbox(3.3, 2.15, 0.1, 0.05, std(C.white)), 0, 0, 0));
  board.add(at(box(3.05, 1.9, 0.06, std(0xd8a971)), 0, 0, 0.04));
  const notes = [["Задача", "#ffe27a", "01"], ["План", "#a8f0dd", "02"], ["Код", "#ffc2d4", "03"], ["Запуск", "#c9b8ff", "04"]];
  notes.forEach(([txt, col, num], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: sticky(txt, col, num), roughness: 0.9 }));
    m.position.set(-1.08 + i * 0.72, i % 2 ? -0.32 : 0.28, 0.08 + i * 0.002);
    m.rotation.z = [0.06, -0.05, 0.04, -0.07][i];
    board.add(m);
    board.add(at(sph(0.035, std(0xe2435b)), m.position.x, m.position.y + 0.27, 0.1));
  });
  board.position.set(3.7, 4.5, -5.95);
  interactive("process", board, {
    label: "Как я работаю",
    anchor: new THREE.Vector3(0, 1.3, 0.1),
    focus: new THREE.Vector3(3.7, 4.4, -5.9),
    viewDir: new THREE.Vector3(-0.15, 0.05, 1),
    viewDist: 7,
  });

  /* ---------- Телефон → Контакты ---------- */
  const phone = new THREE.Group();
  phone.add(at(rbox(0.52, 0.07, 0.98, 0.05, std(0x1e1a2b, { roughness: 0.3 })), 0, 0.035, 0));
  const phoneScreenMat = new THREE.MeshBasicMaterial({ map: phoneScreen(), toneMapped: false });
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.88), phoneScreenMat);
  ps.rotation.x = -Math.PI / 2;
  ps.position.y = 0.072;
  phone.add(ps);
  const ringMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.6, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.015, 8, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  phone.add(ring);
  phone.position.set(2.15, 2.42, -4.1);
  phone.rotation.y = -0.35;
  interactive("contacts", phone, {
    label: "Контакты",
    anchor: new THREE.Vector3(0, 0.75, 0),
    focus: new THREE.Vector3(2.15, 2.5, -4.1),
    viewDir: new THREE.Vector3(0.45, 1.1, 0.8),
    viewDist: 4.6,
  });
  updaters.push((dt, t) => {
    const k = reduceMotion ? 0.5 : (t * 0.8) % 1;
    ring.scale.setScalar(0.7 + k * 0.9);
    ringMat.opacity = 0.7 * (1 - k);
    phone.position.y = items.contacts.baseY + (reduceMotion ? 0 : Math.max(0, Math.sin(t * 6)) * 0.02 * (Math.sin(t * 0.9) > 0.6 ? 1 : 0));
  });

  /* ---------- Лампа → день/ночь ---------- */
  const lamp = new THREE.Group();
  const lampMat = std(C.purple, { roughness: 0.5 });
  lamp.add(at(cyl(0.32, 0.38, 0.1, lampMat), 0, 0.05, 0));
  const arm1 = at(cyl(0.045, 0.045, 1.2, lampMat), 0.17, 0.66, 0);
  arm1.rotation.z = -0.3;
  lamp.add(arm1);
  lamp.add(at(sph(0.08, lampMat), 0.36, 1.25, 0));
  const arm2 = at(cyl(0.04, 0.04, 0.75, lampMat), 0.68, 1.36, 0);
  arm2.rotation.z = -1.2;
  lamp.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.45, 28, 1, true), new THREE.MeshStandardMaterial({ color: C.purple, roughness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(1.02, 1.32, 0);
  shade.rotation.z = 0.45;
  lamp.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6, toneMapped: false });
  const bulb = at(sph(0.12, bulbMat), 1.1, 1.14, 0);
  lamp.add(bulb);
  lamp.position.set(-1.75, 2.41, -5.0);
  lamp.rotation.y = 0.5;
  interactive("lamp", lamp, {
    label: "День / ночь",
    anchor: new THREE.Vector3(0.5, 1.85, 0),
    focus: new THREE.Vector3(-1.4, 3.2, -5),
    viewDir: new THREE.Vector3(0.4, 0.3, 1),
    viewDist: 5,
  });

  /* ---------- Свет ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xf3d9c6, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
  sun.position.set(7, 13, 9);
  sun.target.position.set(0, 0, -2);
  scene.add(sun, sun.target);
  if (renderer.shadowMap.enabled) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
  }
  const lampLight = new THREE.PointLight(0xffc97a, 0, 9, 0);
  scene.add(lampLight);
  const neonA = new THREE.PointLight(C.purple, 0, 11, 0);
  neonA.position.set(-3.5, 1.2, -4.5);
  const neonB = new THREE.PointLight(C.teal, 0, 11, 0);
  neonB.position.set(4.5, 1.5, -1.5);
  const screenGlow = new THREE.PointLight(0x8fb4ff, 0, 6, 0);
  screenGlow.position.set(0.3, 3.8, -4.2);
  scene.add(neonA, neonB, screenGlow);

  // Тени
  scene.traverse((o) => {
    if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  floor.castShadow = false;
  backWall.castShadow = false;
  leftWall.castShadow = false;

  /* ---------- Пылинки ---------- */
  const dustCount = lowPower ? 120 : 260;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -5.5 + Math.random() * 11;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 6.4;
    dustPos[i * 3 + 2] = -5.5 + Math.random() * 11;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  updaters.push((dt) => {
    if (reduceMotion) return;
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      p[i * 3 + 1] += dt * 0.08;
      p[i * 3] += Math.sin(p[i * 3 + 1] * 2 + i) * dt * 0.03;
      if (p[i * 3 + 1] > 6.7) p[i * 3 + 1] = 0.3;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  /* ================= КАМЕРА ================= */
  const BASE_TARGET = new THREE.Vector3(0, 2.0, -1.4);
  const BASE_DIR = new THREE.Vector3(1, 0.8, 1).normalize();
  const tmp = new THREE.Vector3();

  function basis(pos, target) {
    const fwd = tmp.copy(target).sub(pos).normalize().clone();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { right, up };
  }

  function overviewView() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const aspect = w / h;
    const wide = w >= 760 && aspect >= 1.05; // текст слева, комната справа
    let dist = 25;
    if (wide && aspect < 1.8) dist *= 1 + (1.8 - aspect) * 1.05;
    if (!wide && aspect < 1.3) dist *= 1 + (1.3 - aspect) * 1.45;
    const target = BASE_TARGET.clone();
    const pos = target.clone().addScaledVector(BASE_DIR, dist);
    const { right, up } = basis(pos, target);
    const shift = new THREE.Vector3();
    if (wide) shift.addScaledVector(right, -dist * 0.12).addScaledVector(up, dist * 0.02);
    else shift.addScaledVector(up, dist * 0.125); // телефон: комната ниже текста
    return { pos: pos.add(shift), target: target.add(shift) };
  }

  function itemView(key) {
    const it = items[key];
    const w = stage.clientWidth, h = stage.clientHeight;
    const aspect = w / h;
    // чем уже свободная область, тем дальше камера
    let d = it.viewDist;
    if (w >= 768) d *= Math.max(1, 1.0 * w / Math.max(w - 556, 300) / aspect);
    else d *= 1 + (1 - Math.min(aspect, 1)) * 1.6;
    const target = it.focus.clone();
    const pos = target.clone().addScaledVector(it.viewDir, d);
    const { right, up } = basis(pos, target);
    const shift = new THREE.Vector3();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (w >= 768) {
      // панель справа: ставим предмет в центр свободной левой части
      const panelW = Math.min(540, w - 32) + 16;
      shift.addScaledVector(right, (panelW / w) * d * tanHalf * aspect);
    } else {
      // шторка снизу (72% высоты): предмет — в верхнюю свободную часть
      shift.addScaledVector(up, -0.62 * d * tanHalf);
    }
    return { pos: pos.add(shift), target: target.add(shift) };
  }

  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let tween = null;
  let mode = "overview";
  let focusKey = null;

  function flyTo(view, duration = 1.1) {
    if (reduceMotion || duration <= 0) {
      cam.pos.copy(view.pos);
      cam.target.copy(view.target);
      tween = null;
      return;
    }
    tween = { from: { pos: cam.pos.clone(), target: cam.target.clone() }, to: view, t: 0, d: duration };
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  /* ================= ХОТСПОТЫ ================= */
  const hotspots = {};
  Object.values(items).forEach((it) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hotspot";
    b.setAttribute("aria-label", it.key === "lamp" ? "Переключить день и ночь" : `Открыть раздел «${it.label}»`);
    b.innerHTML = `<span class="hotspot__dot"></span><span class="hotspot__label">${it.label}</span>`;
    b.addEventListener("click", () => select(it.key));
    b.addEventListener("pointerenter", () => { hoverKey = it.key; });
    b.addEventListener("pointerleave", () => { if (hoverKey === it.key) hoverKey = null; });
    hotspotsEl.appendChild(b);
    hotspots[it.key] = b;
  });

  /* ================= ВЫБОР ПРЕДМЕТА ================= */
  let openTimer = 0;
  function select(key) {
    if (!items[key]) return;
    if (key === "lamp") {
      toggleTheme();
      items.lamp.hover = 1.4; // «щёлк»
      return;
    }
    mode = "focus";
    focusKey = key;
    stage.classList.add("is-busy");
    flyTo(itemView(key));
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("room:open", { detail: { key } }));
    }, reduceMotion ? 0 : 380);
  }

  function backToOverview() {
    clearTimeout(openTimer);
    mode = "overview";
    focusKey = null;
    stage.classList.remove("is-busy");
    flyTo(overviewView(), 1.0);
  }

  window.addEventListener("room:focus", (e) => select(e.detail?.key));
  window.addEventListener("room:close", () => { if (mode === "focus") backToOverview(); });

  /* ================= УКАЗАТЕЛЬ ================= */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let hoverKey = null;
  const targets = [];
  Object.values(items).forEach((it) => it.group.traverse((o) => { if (o.isMesh) targets.push(o); }));

  function keyFromObject(o) {
    while (o) {
      if (o.userData && o.userData.key) return o.userData.key;
      o = o.parent;
    }
    return null;
  }
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? keyFromObject(hit.object) : null;
  }

  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === "mouse" && e.target === canvas) {
      hoverKey = pick(e.clientX, e.clientY);
      canvas.style.cursor = hoverKey ? "pointer" : "";
    }
  }, { passive: true });
  stage.addEventListener("pointerleave", () => { hoverKey = null; mouse.tx = mouse.ty = 0; });

  canvas.addEventListener("click", (e) => {
    const key = pick(e.clientX, e.clientY);
    if (key) select(key);
    else if (mode === "focus") window.dispatchEvent(new CustomEvent("room:request-close"));
  });

  /* ================= РАЗМЕР ================= */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const v = mode === "focus" && focusKey ? itemView(focusKey) : overviewView();
    flyTo(v, 0);
  }

  /* ================= СТАРТ ================= */
  resize();
  const start = overviewView();
  if (!reduceMotion) {
    // вступительный облёт
    cam.pos.copy(start.pos).add(new THREE.Vector3(-9, 6, 6));
    cam.target.copy(start.target).add(new THREE.Vector3(0, -1, 0));
    flyTo(start, 1.9);
  }
  window.addEventListener("resize", resize);
  root.dataset.room = "on";

  /* ================= ЦИКЛ ================= */
  let night = isNight() ? 1 : 0;
  let last = performance.now();
  const t0 = last;
  let visible = true;
  const ndc = new THREE.Vector3();
  const parallax = new THREE.Vector3();

  function applyTheme(n) {
    themed.forEach(([m, d, nn]) => m.color.copy(d).lerp(nn, n));
    nightView.material.opacity = n;
    dayView.material.opacity = 1 - n * 0.9;
    neonMats.forEach((m) => (m.opacity = n));
    hemi.intensity = 1.7 - n * 1.1;
    hemi.color.setRGB(1 - n * 0.4, 1 - n * 0.45, 1 - n * 0.1);
    hemi.groundColor.setRGB(0.95 - n * 0.75, 0.85 - n * 0.7, 0.78 - n * 0.55);
    sun.intensity = 2.1 * (1 - n);
    lampLight.intensity = 0.35 + n * 2.4;
    neonA.intensity = n * 2.2;
    neonB.intensity = n * 1.8;
    screenGlow.intensity = n * 1.2;
    bulbMat.color.setRGB(1, 0.95 - n * 0.1, 0.84 - n * 0.35);
    dustMat.color.setRGB(1 - n * 0.6, 1 - n * 0.05, 1 - n * 0.15);
    dustMat.opacity = 0.55 + n * 0.3;
  }
  applyTheme(night);

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - t0) / 1000;

    // тема
    const nt = isNight() ? 1 : 0;
    if (Math.abs(night - nt) > 0.001) {
      night += (nt - night) * Math.min(1, dt * (reduceMotion ? 60 : 3));
      if (Math.abs(night - nt) < 0.002) night = nt;
      applyTheme(night);
    }

    // камера
    if (tween) {
      tween.t += dt / tween.d;
      const k = ease(Math.min(tween.t, 1));
      cam.pos.lerpVectors(tween.from.pos, tween.to.pos, k);
      cam.target.lerpVectors(tween.from.target, tween.to.target, k);
      if (tween.t >= 1) tween = null;
    }
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 4);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 4);
    const pk = mode === "overview" && !reduceMotion ? 1 : 0.15;
    const { right, up } = basis(cam.pos, cam.target);
    parallax.set(0, 0, 0).addScaledVector(right, mouse.x * 0.9 * pk).addScaledVector(up, -mouse.y * 0.5 * pk);
    camera.position.copy(cam.pos).add(parallax);
    camera.lookAt(cam.target);

    // наведение: предмет приподнимается
    Object.values(items).forEach((it) => {
      const target = hoverKey === it.key || focusKey === it.key ? 1 : 0;
      it.hover += (target - it.hover) * Math.min(1, dt * 7);
      const lift = it.key === "process" || it.key === "about" ? 0.06 : 0.18;
      if (it.key !== "contacts") it.group.position.y = it.baseY + it.hover * lift;
      it.group.scale.setScalar(1 + it.hover * 0.03);
    });

    updaters.forEach((fn) => fn(dt, t));
    renderer.render(scene, camera);

    // метки
    const w = stage.clientWidth, h = stage.clientHeight;
    Object.values(items).forEach((it) => {
      const b = hotspots[it.key];
      ndc.copy(it.anchor);
      it.group.localToWorld(ndc);
      ndc.project(camera);
      const hidden = ndc.z > 1 || mode === "focus" || !!tween;
      b.classList.toggle("is-hidden", hidden);
      b.classList.toggle("is-hover", hoverKey === it.key);
      if (!hidden) b.style.transform = `translate(${((ndc.x + 1) / 2) * w - 14}px, ${((1 - ndc.y) / 2) * h - 14}px)`;
    });
  }

  // Цикл крутится всегда (браузер сам ставит rAF на паузу в скрытой вкладке),
  // но рисуем только когда сцена на экране
  let alive = true;
  function loop(now) {
    if (!alive) return;
    if (visible) frame(now);
    else last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    alive = false;
    root.classList.add("no-room");
    root.dataset.room = "off";
  });
}
