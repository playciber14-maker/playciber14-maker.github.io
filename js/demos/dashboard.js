// Демо: дашборд владельца бизнеса. Данные вымышленные, генерируются детерминированно.
// Цвета графиков проверены валидатором палитры на тёмном фоне (#17142a).

const C_LINE = "#1aa18c";
const C_BAR = "#8c74f2";
const PERIODS = {
  week: { name: "Неделя", n: 7, labels: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], base: 38000, seed: 7 },
  month: { name: "Месяц", n: 30, labels: Array.from({ length: 30 }, (_, i) => String(i + 1)), base: 36000, seed: 30 },
  year: { name: "Год", n: 12, labels: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"], base: 1050000, seed: 12 },
};
const SOURCES = ["Telegram-бот", "Сайт", "Звонки", "Соцсети"];
const SERVICES = ["Шиномонтаж", "Замена масла", "Диагностика", "Развал-схождение", "Ремонт подвески"];

function rng(seed) {
  let a = seed * 9301 + 49297;
  return () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
}

function makeData(key) {
  const p = PERIODS[key];
  const r = rng(p.seed);
  const revenue = Array.from({ length: p.n }, (_, i) => {
    const season = key === "year" ? 1 + 0.35 * Math.sin(((i - 2) / 12) * Math.PI * 2) : 1;
    const weekend = key === "week" && i >= 5 ? 1.25 : 1;
    const trend = 1 + i / p.n * 0.15;
    return Math.round(p.base * season * weekend * trend * (0.8 + r() * 0.4) / 100) * 100;
  });
  const total = revenue.reduce((s, x) => s + x, 0);
  const avg = Math.round((key === "year" ? 4300 : 4100) * (0.9 + r() * 0.2) / 10) * 10;
  const orders = Math.round(total / avg);
  const leads = Math.round(orders / (0.34 + r() * 0.12));
  const shares = [0.41, 0.27, 0.2, 0.12].map((s) => s * (0.85 + r() * 0.3));
  const shareSum = shares.reduce((s, x) => s + x, 0);
  const sources = SOURCES.map((name, i) => ({ name, value: Math.round((leads * shares[i]) / shareSum) }));
  const services = SERVICES.map((name, i) => ({ name, value: Math.round(total * [0.31, 0.22, 0.18, 0.16, 0.13][i] * (0.9 + r() * 0.2)) }))
    .sort((a, b) => b.value - a.value);
  const delta = () => Math.round((r() * 30 - 8) * 10) / 10;
  return { p, revenue, total, orders, leads, avg, conv: orders / leads, sources, services, deltas: [delta(), delta(), delta(), delta()] };
}

const money = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";
const short = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млн" : n >= 1e3 ? Math.round(n / 1e3) + " тыс" : String(n));

function niceMax(v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s);
  return step * pow;
}

export function mount(root) {
  let period = "month";

  root.innerHTML = `
    <div class="db">
      <header class="db__head">
        <div><b>Автосервис «Мотор»</b><small>аналитика · данные вымышленные</small></div>
        <div class="db__seg" role="tablist" aria-label="Период">
          ${Object.entries(PERIODS).map(([k, p]) => `<button type="button" role="tab" data-p="${k}">${p.name}</button>`).join("")}
        </div>
      </header>
      <div class="db__kpis"></div>
      <section class="db__card db__card--wide">
        <h4>Выручка</h4>
        <div class="db__chart db__line"></div>
      </section>
      <div class="db__row">
        <section class="db__card">
          <h4>Заявки по источникам</h4>
          <div class="db__chart db__bars"></div>
        </section>
        <section class="db__card">
          <h4>Топ услуг по выручке</h4>
          <ul class="db__top"></ul>
        </section>
      </div>
      <div class="db__tip" role="status" hidden></div>
    </div>`;

  const kpis = root.querySelector(".db__kpis");
  const lineEl = root.querySelector(".db__line");
  const barsEl = root.querySelector(".db__bars");
  const topEl = root.querySelector(".db__top");
  const tip = root.querySelector(".db__tip");
  const app = root.querySelector(".db");

  function showTip(html, x, y) {
    const r = app.getBoundingClientRect();
    tip.innerHTML = html;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    let left = x - r.left + 14;
    if (left + tw > r.width - 8) left = x - r.left - tw - 14;
    tip.style.transform = `translate(${Math.max(4, left)}px, ${y - r.top - 16}px)`;
  }
  const hideTip = () => { tip.hidden = true; };

  function renderKpis(d) {
    const items = [
      ["Выручка", money(d.total)],
      ["Заказы", d.orders.toLocaleString("ru-RU")],
      ["Конверсия заявок", Math.round(d.conv * 100) + "%"],
      ["Средний чек", money(d.avg)],
    ];
    kpis.innerHTML = items.map(([label, val], i) => {
      const dv = d.deltas[i];
      const up = dv >= 0;
      return `<div class="db__kpi"><small>${label}</small><b>${val}</b>
        <span class="db__delta ${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${Math.abs(dv).toLocaleString("ru-RU")}% <em>к прошлому периоду</em></span></div>`;
    }).join("");
  }

  function renderLine(d) {
    const W = 640, H = 220, L = 52, R = 12, T = 12, B = 28;
    const max = niceMax(Math.max(...d.revenue) * 1.08);
    const n = d.revenue.length;
    const x = (i) => L + (i * (W - L - R)) / (n - 1);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const pts = d.revenue.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => max * k);
    const every = n > 12 ? 5 : 1;
    lineEl.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Выручка за период: всего ${money(d.total)}, максимум ${money(Math.max(...d.revenue))}">
        <defs><linearGradient id="dbArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C_LINE}" stop-opacity=".28"/><stop offset="1" stop-color="${C_LINE}" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="db__grid"/><text x="${L - 8}" y="${y(t) + 4}" class="db__axis" text-anchor="end">${short(t)}</text>`).join("")}
        ${d.p.labels.map((lb, i) => (i % every === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 8}" class="db__axis" text-anchor="middle">${lb}</text>` : "")).join("")}
        <polygon points="${L},${y(0)} ${pts.join(" ")} ${x(n - 1)},${y(0)}" fill="url(#dbArea)"/>
        <polyline points="${pts.join(" ")}" fill="none" stroke="${C_LINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <line class="db__cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
        <circle class="db__dot" r="5" fill="${C_LINE}" stroke="#17142a" stroke-width="2" visibility="hidden"/>
        <rect class="db__hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
      </svg>`;
    const svg = lineEl.querySelector("svg");
    const cross = svg.querySelector(".db__cross");
    const dot = svg.querySelector(".db__dot");
    const hit = svg.querySelector(".db__hit");
    const onMove = (e) => {
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / (W - L - R)) * (n - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(d.revenue[i])); dot.setAttribute("visibility", "visible");
      const label = period === "month" ? `${d.p.labels[i]} число` : d.p.labels[i];
      showTip(`<small>${label}</small><b>${money(d.revenue[i])}</b>`, r.left + (x(i) / W) * r.width, r.top + (y(d.revenue[i]) / H) * r.height);
    };
    const onLeave = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); hideTip(); };
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerdown", onMove);
    hit.addEventListener("pointerleave", onLeave);
  }

  function renderBars(d) {
    const W = 320, H = 200, L = 8, R = 8, T = 22, B = 28;
    const max = niceMax(Math.max(...d.sources.map((s) => s.value)) * 1.1);
    const bw = (W - L - R) / d.sources.length;
    const barW = Math.min(46, bw - 18);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    barsEl.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Заявки по источникам: ${d.sources.map((s) => `${s.name} ${s.value}`).join(", ")}">
        <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="db__grid"/>
        ${d.sources.map((s, i) => {
          const cx = L + bw * i + bw / 2;
          const top = y(s.value);
          const h = y(0) - top;
          const rr = Math.min(4, h);
          return `<g class="db__barg" data-i="${i}">
            <rect x="${cx - bw / 2 + 2}" y="${T}" width="${bw - 4}" height="${H - T - B}" fill="transparent"/>
            <path d="M${cx - barW / 2},${y(0)} V${top + rr} Q${cx - barW / 2},${top} ${cx - barW / 2 + rr},${top} H${cx + barW / 2 - rr} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + rr} V${y(0)} Z" fill="${C_BAR}"/>
            <text x="${cx}" y="${top - 6}" text-anchor="middle" class="db__val">${s.value}</text>
            <text x="${cx}" y="${H - 8}" text-anchor="middle" class="db__axis">${s.name}</text>
          </g>`;
        }).join("")}
      </svg>`;
    barsEl.querySelectorAll(".db__barg").forEach((g) => {
      const s = d.sources[+g.dataset.i];
      const share = Math.round((s.value / d.leads) * 100);
      const on = (e) => { g.classList.add("is-hover"); showTip(`<small>${s.name}</small><b>${s.value} заявок</b><small>${share}% от всех</small>`, e.clientX, e.clientY); };
      g.addEventListener("pointermove", on);
      g.addEventListener("pointerdown", on);
      g.addEventListener("pointerleave", () => { g.classList.remove("is-hover"); hideTip(); });
    });
  }

  function renderTop(d) {
    const max = d.services[0].value;
    topEl.innerHTML = d.services.map((s) => `
      <li><div><span>${s.name}</span><b>${money(s.value)}</b></div>
      <i style="--w:${((s.value / max) * 100).toFixed(1)}%; --c:${C_LINE}"></i></li>`).join("");
  }

  function render() {
    const d = makeData(period);
    root.querySelectorAll(".db__seg button").forEach((b) => {
      const on = b.dataset.p === period;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    renderKpis(d);
    renderLine(d);
    renderBars(d);
    renderTop(d);
    hideTip();
  }

  root.querySelector(".db__seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]");
    if (!b) return;
    period = b.dataset.p;
    render();
  });

  render();
}
