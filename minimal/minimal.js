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
