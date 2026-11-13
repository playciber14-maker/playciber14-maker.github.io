// Демо: Telegram-бот с оплатой. Платёжные системы здесь имитируются, деньги не списываются.
// Клуб «Код за вечер» и все платежи вымышленные.

const PLANS = [
  { id: "m1", name: "1 месяц", months: 1, price: 490, note: "" },
  { id: "m3", name: "3 месяца", months: 3, price: 1190, note: "−19%" },
  { id: "m12", name: "12 месяцев", months: 12, price: 3990, note: "−32%" },
];
const METHODS = [
  { id: "card", label: "💳 Банковская карта", short: "карта", provider: "ЮKassa", event: "payment.succeeded" },
  { id: "usdt", label: "🪙 USDT (CryptoBot)", short: "USDT", provider: "CryptoBot", event: "invoice_paid" },
  { id: "stars", label: "⭐ Telegram Stars", short: "Stars", provider: "Telegram Stars", event: "successful_payment" },
];
// Курсы условные, только для демонстрации
const amountText = (m, price) =>
  m.id === "usdt" ? `${(price / 100).toFixed(1).replace(".", ",")} USDT` : m.id === "stars" ? `${price / 2} ⭐` : fmt(price);
const OUTCOMES = [
  { id: "ok", label: "Успешная оплата" },
  { id: "funds", label: "Отказ: недостаточно средств" },
  { id: "cancel", label: "Пользователь не завершил оплату" },
];

const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const until = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
};

export function mount(root) {
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  // Данные владельца: два вымышленных платежа «с утра»
  const log = [
    { time: "11:40", who: "Игорь П.", plan: "1 месяц", method: "USDT", amount: 490, event: "invoice_paid" },
    { time: "10:12", who: "Анна К.", plan: "3 месяца", method: "карта", amount: 1190, event: "payment.succeeded" },
  ];
  let revenue = 1680, subs = 2, fails = 0, receipt = 5001, invoiceNo = 311;
  const mine = []; // платежи этого посетителя
  let busy = false;

  root.innerHTML = `
    <div class="pb">
      <div class="tg pb__tg">
        <div class="tg__head">
          <div class="tg__avatar">🎓</div>
          <div><div class="tg__name">Код за вечер</div><div class="tg__status">бот закрытого клуба</div></div>
        </div>
        <div class="tg__chat" role="log" aria-live="polite"></div>
        <div class="pb__sheet" role="dialog" aria-label="Оплата" hidden></div>
      </div>
      <div class="pb__owner">
        <header><b>Панель владельца</b><small>события от платёжных систем</small></header>
        <div class="pb__stats">
          <div><small>Выручка сегодня</small><b data-s="revenue"></b></div>
          <div><small>Подписчиков</small><b data-s="subs"></b></div>
          <div><small>Отказов</small><b data-s="fails"></b></div>
        </div>
        <ul class="pb__log" aria-live="polite"></ul>
      </div>
    </div>`;

  const chat = root.querySelector(".tg__chat");
  const sheet = root.querySelector(".pb__sheet");
  const logEl = root.querySelector(".pb__log");
  const stat = (k) => root.querySelector(`[data-s="${k}"]`);
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };

  function renderOwner(freshFirst = false) {
    stat("revenue").textContent = fmt(revenue);
    stat("subs").textContent = String(subs);
    stat("fails").textContent = String(fails);
    logEl.innerHTML = log.map((l, i) => `
      <li class="${freshFirst && i === 0 ? "is-new" : ""}">
        <div><b>+${fmt(l.amount)}</b><span>${esc(l.who)} · ${esc(l.plan)} · ${esc(l.method)}</span></div>
        <div><code>${esc(l.event)}</code><small>${l.time}</small></div>
      </li>`).join("");
  }

  /* ---------- чат ---------- */
  function userMsg(text) {
    const el = document.createElement("div");
    el.className = "tg__msg tg__msg--out";
    el.innerHTML = `${esc(text)}<span class="tg__time">${now()}</span>`;
    chat.appendChild(el);
    scroll();
  }

  function botMsg(html, rows = []) {
    const typing = document.createElement("div");
    typing.className = "tg__msg tg__msg--in tg__typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(typing);
    scroll();
    later(() => {
      typing.remove();
      const el = document.createElement("div");
      el.className = "tg__msg tg__msg--in";
      el.innerHTML = `${html}<span class="tg__time">${now()}</span>`;
      chat.appendChild(el);
      if (rows.length) {
        const kb = document.createElement("div");
        kb.className = "tg__kb";
        rows.forEach((row) => {
          const r = document.createElement("div");
          r.className = "tg__kb-row";
          row.forEach((b) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = b.text;
            btn.addEventListener("click", () => {
              if (busy) return;
              kb.querySelectorAll("button").forEach((x) => (x.disabled = true)); // повторное нажатие невозможно
              userMsg(b.text);
              b.action();
            });
            r.appendChild(btn);
          });
          kb.appendChild(r);
        });
        chat.appendChild(kb);
      }
      scroll();
    }, 450);
  }

  const menu = () => [
    [{ text: "💳 Оформить доступ", action: plans }],
    [{ text: "ℹ️ Что внутри", action: about }, { text: "🧾 Мои платежи", action: myPayments }],
  ];

  function start() {
    botMsg("Привет! 👋 Это закрытый клуб <b>«Код за вечер»</b>: короткие уроки по программированию и разбор задач.<br>Доступ по подписке, оплата прямо в боте.", menu());
  }

  function about() {
    botMsg("Внутри клуба:<br>• новый мини-урок каждую неделю<br>• чат с разбором ваших задач<br>• архив всех уроков", menu());
  }

  function plans() {
    botMsg("Выберите тариф:", [
      ...PLANS.map((p) => [{ text: `${p.name} · ${fmt(p.price)}${p.note ? ` (${p.note})` : ""}`, action: () => methods(p) }]),
      [{ text: "← Назад", action: home }],
    ]);
  }

  function home() { botMsg("Главное меню:", menu()); }

  function methods(p) {
    botMsg(`Тариф <b>${p.name}</b>, ${fmt(p.price)}.<br>Как удобнее оплатить?`, [
      ...METHODS.map((m) => [{ text: m.label, action: () => invoice(p, m) }]),
      [{ text: "← К тарифам", action: plans }],
    ]);
  }

  function invoice(p, m, again) {
    const no = again ?? ++invoiceNo; // «Повторить» открывает тот же счёт
    botMsg(
      `🧾 <b>Счёт №${no}</b><br>Тариф: ${p.name}<br>Сумма: <b>${amountText(m, p.price)}</b><br>Способ: ${m.provider}<br><small>Счёт действует 15 минут. Курсы в демо условные.</small>`,
      [[{ text: `Оплатить ${amountText(m, p.price)}`, keep: true, action: () => openSheet(p, m, no) }], [{ text: "Отмена", action: home }]]
    );
  }

  function myPayments() {
    if (!mine.length) {
      botMsg("Платежей пока нет. Оформите доступ, и чек появится здесь.", menu());
      return;
    }
    botMsg(
      "Ваши платежи:<br>" + mine.map((x) => `• Чек №${x.receipt}: ${x.plan}, ${x.amount}, доступ до ${x.until}`).join("<br>"),
      menu()
    );
  }

  /* ---------- форма оплаты платёжной системы ---------- */
  function openSheet(p, m, no) {
    const detail =
      m.id === "card" ? "Тестовая карта •••• 4477" : m.id === "usdt" ? "Кошелёк @CryptoBot · тестовая сеть" : "Баланс: 3 000 ⭐ (тест)";
    sheet.innerHTML = `
      <div class="pb__sheet-head"><b>${m.provider} · тестовый режим</b><button type="button" class="pb__x" aria-label="Закрыть">✕</button></div>
      <p class="pb__sum">${amountText(m, p.price)}</p>
      <p class="pb__who">Счёт №${no} · ${esc(detail)}</p>
      <label class="pb__field"><span>Эмуляция ответа платёжной системы</span>
        <select>${OUTCOMES.map((o) => `<option value="${o.id}">${o.label}</option>`).join("")}</select>
      </label>
      <button type="button" class="pb__pay">Оплатить ${amountText(m, p.price)}</button>
      <small>Деньги не списываются. В реальном проекте ответ приходит от платёжной системы вебхуком.</small>`;
    sheet.hidden = false;
    sheet.querySelector(".pb__x").addEventListener("click", closeSheet);
    sheet.querySelector(".pb__pay").addEventListener("click", () => pay(p, m, no));
    sheet.querySelector("select").focus();
  }

  function closeSheet() {
    if (busy) return;
    sheet.hidden = true;
    sheet.innerHTML = "";
  }

  function pay(p, m, no) {
    if (busy) return;
    const outcome = sheet.querySelector("select").value;
    busy = true;
    const btn = sheet.querySelector(".pb__pay");
    btn.disabled = true;
    btn.textContent = "Обработка…";
    sheet.querySelector("select").disabled = true;
    sheet.querySelector(".pb__x").disabled = true;
    later(() => {
      busy = false;
      closeSheet();
      if (outcome === "ok") success(p, m, no);
      else failure(p, m, outcome, no);
    }, 1300);
  }

  function success(p, m, no) {
    const rc = ++receipt;
    const date = until(p.months);
    mine.push({ receipt: rc, plan: p.name, amount: amountText(m, p.price), until: date });
    revenue += p.price;
    subs += 1;
    log.unshift({ time: now(), who: "Вы (демо)", plan: p.name, method: m.short, amount: p.price, event: m.event });
    renderOwner(true);
    botMsg(
      `✅ <b>Оплата прошла</b><br>Счёт №${no}, чек №${rc}<br>Доступ открыт до <b>${date}</b>.<br>🔗 Ссылка-приглашение (одноразовая): <code>t.me/+демо</code>`,
      [[{ text: "🧾 Мои платежи", action: myPayments }, { text: "🏠 В начало", action: home }]]
    );
  }

  function failure(p, m, outcome, no) {
    fails += 1;
    renderOwner();
    const text =
      outcome === "funds"
        ? "❌ <b>Платёж отклонён</b>: недостаточно средств.<br>Счёт остался активным: можно повторить или выбрать другой способ."
        : "⌛ <b>Оплата не завершена.</b><br>Ничего не списано. Счёт остался активным, можно вернуться к оплате.";
    botMsg(text, [
      [{ text: "🔁 Повторить", action: () => invoice(p, m, no) }],
      [{ text: "💳 Другой способ", action: () => methods(p) }],
      [{ text: "Отмена", action: home }],
    ]);
  }

  renderOwner();
  start();
  return () => { timers.forEach(clearTimeout); timers.clear(); };
}
