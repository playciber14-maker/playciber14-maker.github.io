// Демо: Telegram-бот магазина + админка. Всё работает в браузере, магазин вымышленный.

const PRODUCTS = [
  { id: "hoodie", cat: "Одежда", name: "Худи «Ship it»", price: 3990, icon: "🧥", sizes: true, bg: "linear-gradient(135deg,#7a5cff,#18c9b0)" },
  { id: "tee", cat: "Одежда", name: "Футболка «Hello, world»", price: 1490, icon: "👕", sizes: true, bg: "linear-gradient(135deg,#ff9ec0,#ffc861)" },
  { id: "cap", cat: "Одежда", name: "Кепка", price: 1190, icon: "🧢", sizes: false, bg: "linear-gradient(135deg,#2b2640,#5aa9ff)" },
  { id: "mug", cat: "Аксессуары", name: "Кружка «404 coffee»", price: 690, icon: "☕", sizes: false, bg: "linear-gradient(135deg,#f4a37a,#e2435b)" },
  { id: "bag", cat: "Аксессуары", name: "Шоппер", price: 890, icon: "👜", sizes: false, bg: "linear-gradient(135deg,#18c9b0,#3cf2d6)" },
  { id: "stick", cat: "Аксессуары", name: "Стикерпак", price: 290, icon: "✨", sizes: false, bg: "linear-gradient(135deg,#ffc861,#7a5cff)" },
];
const STATUSES = ["Новый", "Собирается", "Отправлен", "Доставлен"];
const DELIVERY = 300;
const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function mount(root) {
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  const cart = []; // {id, size, qty}
  const orders = [
    { no: 1024, name: "Дмитрий", phone: "+7 9•• •••-12-40", items: ["Кепка × 1", "Стикерпак × 2"], total: 1770, status: 2, mine: false },
  ];
  let nextNo = 1025;
  let step = "idle"; // idle | name | phone
  const draft = {};
  let unseen = 0;

  root.innerHTML = `
    <div class="sb">
      <div class="sb__tabs" role="tablist">
        <button type="button" role="tab" class="is-active" data-tab="client" aria-selected="true">👤 Покупатель</button>
        <button type="button" role="tab" data-tab="admin" aria-selected="false">🛠 Админка <span class="sb__badge" hidden>0</span></button>
      </div>
      <div class="sb__pane" data-pane="client">
        <div class="tg sb__tg">
          <div class="tg__head">
            <div class="tg__avatar">🛍</div>
            <div><div class="tg__name">Merch Lab</div><div class="tg__status">бот магазина</div></div>
          </div>
          <div class="tg__chat" role="log" aria-live="polite"></div>
          <form class="tg__input">
            <input type="text" placeholder="Сообщение" aria-label="Сообщение боту" maxlength="60" autocomplete="off">
            <button type="submit" aria-label="Отправить">➤</button>
          </form>
        </div>
      </div>
      <div class="sb__pane" data-pane="admin" hidden>
        <div class="sb__admin">
          <header><b>Заказы</b><small>панель владельца</small></header>
          <div class="sb__orders"></div>
        </div>
      </div>
    </div>`;

  const app = root.querySelector(".sb");
  const chat = root.querySelector(".tg__chat");
  const form = root.querySelector(".tg__input");
  const input = form.querySelector("input");
  const ordersEl = root.querySelector(".sb__orders");
  const badge = root.querySelector(".sb__badge");
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };

  /* ---------- чат ---------- */
  function userMsg(text) {
    const el = document.createElement("div");
    el.className = "tg__msg tg__msg--out";
    el.innerHTML = `${esc(text)}<span class="tg__time">${now()}</span>`;
    chat.appendChild(el);
    scroll();
  }

  function botMsg(html, rows = [], extraClass = "") {
    const typing = document.createElement("div");
    typing.className = "tg__msg tg__msg--in tg__typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(typing);
    scroll();
    later(() => {
      typing.remove();
      const el = document.createElement("div");
      el.className = `tg__msg tg__msg--in ${extraClass}`;
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
              if (b.keep !== true) kb.querySelectorAll("button").forEach((x) => (x.disabled = true));
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
    }, 500);
  }

  const cartCount = () => cart.reduce((s, x) => s + x.qty, 0);
  const cartTotal = () => cart.reduce((s, x) => s + PRODUCTS.find((p) => p.id === x.id).price * x.qty, 0);
  const lineName = (x) => { const p = PRODUCTS.find((q) => q.id === x.id); return `${p.name}${x.size ? ` (${x.size})` : ""}`; };

  const menu = () => [
    [{ text: "🛍 Каталог", action: catalog }],
    [{ text: `🛒 Корзина${cartCount() ? ` (${cartCount()})` : ""}`, action: showCart }, { text: "📦 Мои заказы", action: myOrders }],
  ];

  function start() {
    step = "idle";
    botMsg("Привет! 👋 Это магазин мерча <b>Merch Lab</b>.<br>Выбирай товары, оформляй заказ — статус пришлю сюда.", menu());
  }

  function catalog() {
    botMsg("Выберите категорию:", [
      [{ text: "👕 Одежда", action: () => category("Одежда") }, { text: "☕ Аксессуары", action: () => category("Аксессуары") }],
    ]);
  }

  function category(cat) {
    const list = PRODUCTS.filter((p) => p.cat === cat);
    list.forEach((p, i) => {
      later(() => {
        const rows = p.sizes
          ? [["S", "M", "L"].map((s) => ({ text: `Размер ${s}`, action: () => add(p, s) }))]
          : [[{ text: "➕ В корзину", action: () => add(p) }]];
        botMsg(
          `<div class="sb__product" style="background:${p.bg}"><span>${p.icon}</span></div><b>${esc(p.name)}</b><br>${fmt(p.price)}`,
          rows,
          "sb__card"
        );
      }, i * 260);
    });
    later(() => botMsg("Что-то ещё?", [[{ text: "🛒 Корзина", action: showCart }, { text: "← Категории", action: catalog }]]), list.length * 260 + 650);
  }

  function add(p, size) {
    const ex = cart.find((x) => x.id === p.id && x.size === size);
    if (ex) ex.qty = Math.min(ex.qty + 1, 9); else cart.push({ id: p.id, size, qty: 1 });
    botMsg(`✅ Добавлено: ${esc(p.name)}${size ? ` (${size})` : ""}<br>В корзине: ${cartCount()} шт. на ${fmt(cartTotal())}`,
      [[{ text: "🛒 Корзина", action: showCart }, { text: "🛍 Ещё товары", action: catalog }]]);
  }

  function showCart() {
    if (!cart.length) {
      botMsg("Корзина пуста 🙂", [[{ text: "🛍 Каталог", action: catalog }]]);
      return;
    }
    const lines = cart.map((x) => `• ${esc(lineName(x))} × ${x.qty} — ${fmt(PRODUCTS.find((p) => p.id === x.id).price * x.qty)}`).join("<br>");
    botMsg(`<b>Корзина</b><br>${lines}<br><br>Итого: <b>${fmt(cartTotal())}</b>`, [
      [{ text: "✅ Оформить заказ", action: checkout }],
      [{ text: "🗑 Очистить", action: () => { cart.length = 0; botMsg("Корзина очищена.", menu()); } }, { text: "🛍 Каталог", action: catalog }],
    ]);
  }

  function checkout() {
    step = "name";
    botMsg("Как вас зовут? Напишите имя ✍️");
    input.focus();
  }

  function askPhone() {
    step = "phone";
    botMsg("Телефон для связи? Например: +7 900 123-45-67");
  }

  function askDelivery() {
    step = "idle";
    botMsg("Как получить заказ?", [
      [{ text: `🚚 Курьер (+${fmt(DELIVERY)})`, action: () => confirm(true) }],
      [{ text: "🏪 Самовывоз (бесплатно)", action: () => confirm(false) }],
    ]);
  }

  function confirm(courier) {
    draft.courier = courier;
    const sum = cartTotal() + (courier ? DELIVERY : 0);
    botMsg(
      `Проверьте заказ:<br>👤 ${esc(draft.name)}, ${esc(draft.phone)}<br>${cart.map((x) => `• ${esc(lineName(x))} × ${x.qty}`).join("<br>")}<br>${courier ? "🚚 Курьер" : "🏪 Самовывоз"}<br><b>Итого: ${fmt(sum)}</b>`,
      [[{ text: "✅ Подтвердить", action: () => place(sum) }, { text: "✏️ Изменить", action: showCart }]]
    );
  }

  function place(sum) {
    const order = {
      no: nextNo++,
      name: draft.name,
      phone: draft.phone.replace(/(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})$/, "•••-$2-$3"),
      items: cart.map((x) => `${lineName(x)} × ${x.qty}`),
      total: sum,
      status: 0,
      mine: true,
      courier: draft.courier,
    };
    orders.unshift(order);
    cart.length = 0;
    renderOrders();
    unseen++;
    badge.hidden = false;
    badge.textContent = String(unseen);
    botMsg(`🎉 Заказ <b>№${order.no}</b> оформлен!<br>Статус пришлю сюда.<br><small>Подсказка: открой вкладку «Админка» и смени статус.</small>`, menu());
  }

  function myOrders() {
    const mine = orders.filter((o) => o.mine);
    if (!mine.length) { botMsg("У вас пока нет заказов.", [[{ text: "🛍 Каталог", action: catalog }]]); return; }
    botMsg(mine.map((o) => `📦 №${o.no} — ${fmt(o.total)} · <b>${STATUSES[o.status]}</b>`).join("<br>"), menu());
  }

  function handleText(raw) {
    const text = raw.trim();
    if (!text) return;
    userMsg(text);
    if (step === "name") {
      const name = text.replace(/[^\p{L}\s-]/gu, "").trim().slice(0, 30);
      if (name.length < 2) { botMsg("Похоже, это не имя 🙂 Напишите, как к вам обращаться."); return; }
      draft.name = name;
      askPhone();
      return;
    }
    if (step === "phone") {
      const digits = text.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) { botMsg("Номер выглядит неверно. Нужно 10–11 цифр, например +7 900 123-45-67."); return; }
      const d = digits.slice(-10);
      draft.phone = `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
      askDelivery();
      return;
    }
    const low = text.toLowerCase();
    if (low === "/start" || low.includes("привет")) return start();
    if (low.includes("каталог")) return catalog();
    if (low.includes("корзин")) return showCart();
    botMsg("Не понял 🤔 Используйте кнопки или /start.", menu());
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    handleText(v);
  });

  /* ---------- админка ---------- */
  function renderOrders() {
    ordersEl.innerHTML = orders.map((o) => `
      <article class="sb__order ${o.mine ? "is-new" : ""}">
        <header><b>№${o.no}</b><span class="sb__status sb__status--${o.status}">${STATUSES[o.status]}</span></header>
        <p>${esc(o.name)} · ${esc(o.phone)}</p>
        <ul>${o.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        <footer>
          <b>${fmt(o.total)}</b>
          ${o.status < STATUSES.length - 1
            ? `<button type="button" data-next="${o.no}">→ ${STATUSES[o.status + 1]}</button>`
            : `<span class="sb__done">✓ Завершён</span>`}
        </footer>
      </article>`).join("");
  }

  function advance(no) {
    const o = orders.find((x) => x.no === no);
    if (!o || o.status >= STATUSES.length - 1) return;
    o.status++;
    renderOrders();
    if (o.mine) {
      const icons = ["🆕", "📦", "🚚", "✅"];
      botMsg(`${icons[o.status]} Заказ №${o.no}: статус «<b>${STATUSES[o.status]}</b>»`);
    }
  }

  function setTab(tab) {
    app.querySelectorAll(".sb__tabs button").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    app.querySelectorAll(".sb__pane").forEach((p) => { p.hidden = p.dataset.pane !== tab; });
    if (tab === "admin") { unseen = 0; badge.hidden = true; }
    if (tab === "client") scroll();
  }

  app.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) setTab(t.dataset.tab);
    if (t.dataset.next) advance(+t.dataset.next);
  });

  renderOrders();
  start();
  return () => timers.forEach(clearTimeout);
}
