// Интерфейс: меню, контакты, тема, панели разделов из 3D-комнаты, появление блоков, модалки с демками.

import { isNight, setTheme, toggleTheme } from "./theme.js";
import "./projects.js";

const $ =(sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- Год в футере ---------- */
$("#year").textContent = new Date().getFullYear();

/* ---------- Контакты из config.js ---------- */
const cfg = window.SITE_CONFIG || {};
const tg = String(cfg.telegram || "").replace(/^@/, "").trim();
const email = String(cfg.email || "").trim();

$$('[data-contact="telegram"]').forEach((a) => {
  if (tg) a.href = `https://t.me/${encodeURIComponent(tg)}`;
});
$$('[data-contact="email"]').forEach((a) => {
  if (email) {
    a.href = `mailto:${email}`;
    a.removeAttribute("target");
  }
});
$$('[data-contact-label="email"]').forEach((el) => {
  if (email) el.textContent = email;
});

/* ---------- Тема (день / ночь) ---------- */
setTheme(isNight()); // синхронизируем подписи кнопок
$$(".theme-toggle").forEach((b) => b.addEventListener("click", toggleTheme));

/* ---------- Шапка ---------- */
const header = $(".header");
const onScroll = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 20);
  // ушли вниз к обычной версии — закрываем панель комнаты
  if (panelKey && window.scrollY > window.innerHeight * 0.6) closePanel();
};
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------- Мобильное меню ---------- */
const burger = $(".burger");
const nav = $("#nav");
const setMenu = (open) => {
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  nav.classList.toggle("is-open", open);
};
burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
$$("a", nav).forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (nav.classList.contains("is-open")) setMenu(false);
  else if (panelKey && !$("#modal").open) closePanel();
});

/* ---------- Панель раздела (из 3D-комнаты) ---------- */
const TITLES = { about: "Обо мне", services: "Что я делаю", projects: "Проекты", process: "Как я работаю", contacts: "Контакты" };
const panel = $("#panel");
const panelTitle = $("#panel-title");
const panelBody = $("#panel-body");
let panelKey = null;
panel.inert = true;

function openPanel(key) {
  const src = document.getElementById(key);
  if (!src || !TITLES[key]) return;
  // Берём содержимое обычной секции — один источник текста для комнаты и HTML-версии
  panelBody.innerHTML = src.querySelector(".container").innerHTML;
  panelBody.querySelectorAll(".reveal").forEach((el) => el.classList.remove("reveal"));
  panelBody.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
  panelBody.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  panelTitle.textContent = TITLES[key];
  panelBody.scrollTop = 0;
  panel.inert = false;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  panelKey = key;
  panel.focus({ preventScroll: true });
  requestAnimationFrame(() => { panelBody.scrollTop = 0; });
}

function closePanel() {
  if (!panelKey) return;
  panelKey = null;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  panel.inert = true;
  window.dispatchEvent(new CustomEvent("room:close"));
}

window.addEventListener("room:open", (e) => openPanel(e.detail?.key));
window.addEventListener("room:request-close", closePanel);
$(".panel__close").addEventListener("click", closePanel);
onScroll();

// Пункты меню и кнопки с data-room: при работающей комнате — подлёт к предмету, иначе обычный якорь
$$("[data-room]").forEach((a) => {
  a.addEventListener("click", (e) => {
    if (document.documentElement.dataset.room !== "on") return;
    e.preventDefault();
    setMenu(false);
    const go = () => window.dispatchEvent(new CustomEvent("room:focus", { detail: { key: a.dataset.room } }));
    if (window.scrollY > 10) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      setTimeout(go, reduceMotion ? 0 : 550);
    } else go();
  });
});

/* ---------- Появление при прокрутке ---------- */
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const siblings = $$(".reveal", entry.target.parentElement);
        const i = Math.max(0, siblings.indexOf(entry.target));
        entry.target.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));
} else {
  $$(".reveal").forEach((el) => el.classList.add("is-visible"));
}

/* ---------- 3D-наклон карточек ---------- */
if (canHover && !reduceMotion) {
  $$(".tilt").forEach((card) => {
    const max = 6;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.transitionDelay = "0ms";
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}
