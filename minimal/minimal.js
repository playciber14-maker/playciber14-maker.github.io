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

/* ---------- Панель рифлёного стекла на первом экране ---------- */
// Тяжёлый модуль с Three.js грузим отдельно, когда заголовок уже появился.
const hero = $(".hero");
if (hero && !reduceMotion) {
  const fontsReady = document.fonts?.ready || Promise.resolve();
  Promise.all([fontsReady, new Promise((r) => setTimeout(r, 1400))])
    .then(() => import("./glass.js?v=6"))
    .then((m) => m.initGlass(hero))
    .catch((err) => console.warn("Стекло не загрузилось, остаётся обычный заголовок", err));
}

/* ---------- Текст проявляется по словам при прокрутке ---------- */
$$(".scrub").forEach((el) => {
  if (reduceMotion) return;
  const words = [];
  const wrap = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.data.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const sp = document.createElement("span");
          sp.className = "scrub__w";
          sp.textContent = part;
          words.push(sp);
          frag.append(sp);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrap(n);
    });
  };
  wrap(el);
  el.classList.add("is-split");
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    // 0, когда верх блока на 88% высоты экрана; 1, когда низ блока поднялся до 55%
    const p = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (r.height + vh * 0.33)));
    const lit = p * words.length;
    words.forEach((w, i) => { w.style.opacity = Math.min(1, Math.max(0.18, lit - i + 0.18)).toFixed(2); });
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", req);
  update();
});

/* ---------- Линия прогресса прокрутки ---------- */
{
  let raf = 0;
  const upd = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4) : 0);
  };
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  window.addEventListener("resize", upd);
  upd();
}

/* ---------- Курсор-акцент и магнитные ссылки (только мышь) ---------- */
if (canHover) {
  const cur = document.createElement("div");
  cur.className = "cur";
  cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = "<span>Открыть</span>";
  document.body.append(cur);

  let x = -100, y = -100, tx = -100, ty = -100, raf = 0, seen = false;
  const loop = () => {
    const k = reduceMotion ? 1 : 0.22;
    x += (tx - x) * k;
    y += (ty - y) * k;
    cur.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    raf = Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { x = tx; y = ty; seen = true; cur.classList.add("is-on"); }
    const el = e.target.closest?.(".row, a, button");
    cur.classList.toggle("is-row", !!el?.classList.contains("row"));
    cur.classList.toggle("is-link", !!el && !el.classList.contains("row"));
    cur.classList.toggle("is-hidden", !!e.target.closest?.("dialog[open]"));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
  document.documentElement.addEventListener("pointerenter", () => { if (seen) cur.classList.add("is-on"); });

  // Магнитные: большая ссылка в контактах и кнопка в шапке чуть тянутся к курсору
  if (!reduceMotion) {
    $$(".contact__big, .bar__cta").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }
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
