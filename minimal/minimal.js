// Минималистичная версия: контакты, появление блоков, превью строк. Модалка с демками — общий модуль.

import "../js/projects.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

$("#year").textContent = new Date().getFullYear();

/* ---------- Контакты из js/config.js ---------- */
const cfg = window.SITE_CONFIG || {};
const tg = String(cfg.telegram || "").replace(/^@/, "").trim();
const email = String(cfg.email || "").trim();

$$('[data-contact="telegram"]').forEach((a) => { if (tg) a.href = `https://t.me/${encodeURIComponent(tg)}`; });
$$('[data-contact-label="telegram"]').forEach((el) => { if (tg) el.textContent = `@${tg}`; });
$$('[data-contact="email"]').forEach((a) => { if (email) a.href = `mailto:${email}`; });
$$('[data-contact-label="email"]').forEach((el) => { if (email) el.textContent = email; });

/* ---------- Шапка: тонкая линия после прокрутки ---------- */
const bar = $(".bar");
const onScroll = () => bar.classList.toggle("is-scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Появление ---------- */
document.documentElement.classList.add("is-ready"); // запускает анимацию заголовка
const targets = $$(".rv, .block__head, .index li");
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const sibs = [...en.target.parentElement.children].filter((c) => targets.includes(c));
      en.target.style.transitionDelay = `${Math.min(Math.max(0, sibs.indexOf(en.target)), 6) * 60}ms`;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
  targets.forEach((el) => { el.classList.add("rv-on"); io.observe(el); });
}

/* ---------- Стеклянная линза на первом экране ---------- */
// Внутри линзы лежит копия первого экрана, увеличенная вокруг центра линзы.
// С мышью линза идёт за курсором, без мыши сама медленно плавает над заголовком.
const hero = $(".hero");
if (hero && !reduceMotion) {
  const ZOOM = 1.22;
  const lens = document.createElement("div");
  lens.className = "lens";
  lens.setAttribute("aria-hidden", "true");
  lens.inert = true;
  const inner = document.createElement("div");
  inner.className = "hero hero--clone";
  inner.innerHTML = hero.innerHTML;
  lens.appendChild(inner);
  // Линза лежит рядом с первым экраном, а не внутри: под ней в самом экране вырезается «дырка»,
  // поэтому стекло остаётся прозрачным и сквозь него виден фон.
  hero.after(lens);

  const title = $(".hero__title", hero);
  let R = 0, W = 0, H = 0, cx = 0, cy = 0, ax = 0, ay = 0; // радиус, центр и размах плавания
  let x = 0, y = 0, tx = 0, ty = 0, auto = true, visible = true, raf = 0, started = false;

  const size = () => {
    const h = hero.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    inner.style.width = `${h.width}px`;
    inner.style.height = `${h.height}px`;
    R = lens.offsetWidth / 2;
    W = h.width; H = h.height;
    hero.style.setProperty("--lr", `${R}px`);
    cx = t.left - h.left + t.width / 2;
    cy = t.top - h.top + t.height / 2;
    // не даём линзе уезжать за край экрана
    ax = Math.max(0, Math.min(t.width / 2 - R * 0.6, cx - R - 8, h.width - cx - R - 8));
    ay = t.height * 0.3;
  };

  const frame = (now) => {
    raf = 0;
    if (!visible) return;
    if (auto) {
      const t = now / 1000;
      tx = cx + Math.sin(t * 0.33) * ax;
      ty = cy + Math.sin(t * 0.52 + 1) * ay;
    }
    tx = Math.min(Math.max(tx, R), W - R);
    ty = Math.min(Math.max(ty, R), H - R);
    const k = auto ? 0.04 : 0.14;
    x += (tx - x) * k;
    y += (ty - y) * k;
    lens.style.transform = `translate3d(${(x - R).toFixed(1)}px, ${(y - R).toFixed(1)}px, 0)`;
    hero.style.setProperty("--lx", `${x.toFixed(1)}px`);
    hero.style.setProperty("--ly", `${y.toFixed(1)}px`);
    inner.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    inner.style.transform = `translate(${(R - x).toFixed(1)}px, ${(R - y).toFixed(1)}px) scale(${ZOOM})`;
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && visible && started) raf = requestAnimationFrame(frame); };

  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const h = hero.getBoundingClientRect();
    auto = false;
    tx = e.clientX - h.left;
    ty = e.clientY - h.top;
  });
  hero.addEventListener("pointerleave", () => { auto = true; });
  window.addEventListener("resize", size);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(hero);
  }

  // Ждём шрифты и появление заголовка, потом показываем линзу
  const start = () => {
    size();
    x = tx = cx; y = ty = cy;
    started = true;
    frame(performance.now()); // сразу ставим линзу на место, потом показываем
    hero.classList.add("has-lens");
    lens.classList.add("is-on");
    run();
  };
  const fontsReady = document.fonts?.ready || Promise.resolve();
  Promise.all([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(start);
}

/* ---------- Превью строки, следует за курсором ---------- */
const pv = $(".pv");
if (canHover && pv) {
  const big = $("b", pv);
  const cap = $("small", pv);
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, shown = false;

  const tick = () => {
    const k = reduceMotion ? 1 : 0.16;
    x += (tx - x) * k;
    y += (ty - y) * k;
    pv.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    raf = shown || Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
  };
  // По горизонтали карточка стоит на месте: в просвете между названиями и типом проекта,
  // а если просвета нет, то поверх правой колонки. За курсором идёт только по вертикали.
  let anchorX = null;
  const measure = () => {
    const w = pv.offsetWidth;
    const range = document.createRange();
    let nameRight = 0, kindLeft = Infinity, rowRight = 0;
    $$(".row").forEach((row) => {
      range.selectNodeContents($(".row__name", row));
      nameRight = Math.max(nameRight, range.getBoundingClientRect().right);
      kindLeft = Math.min(kindLeft, $(".row__kind", row).getBoundingClientRect().left);
      rowRight = Math.max(rowRight, row.getBoundingClientRect().right);
    });
    anchorX = kindLeft - nameRight >= w + 72 ? kindLeft - w - 36 : rowRight - w;
  };
  window.addEventListener("resize", () => { anchorX = null; });
  const place = (e) => {
    const h = pv.offsetHeight;
    if (anchorX === null) measure();
    tx = anchorX;
    ty = Math.min(Math.max(e.clientY - h / 2, 16), window.innerHeight - h - 16);
  };

  $$(".row").forEach((row) => {
    row.addEventListener("pointerenter", (e) => {
      big.textContent = row.dataset.pv || "";
      cap.textContent = row.dataset.cap || "";
      place(e);
      if (!shown) { x = tx; y = ty; }
      shown = true;
      pv.classList.add("is-on");
      if (!raf) raf = requestAnimationFrame(tick);
    });
    row.addEventListener("pointermove", place);
    row.addEventListener("pointerleave", () => { shown = false; pv.classList.remove("is-on"); });
    row.addEventListener("click", () => { shown = false; pv.classList.remove("is-on"); });
  });
}
