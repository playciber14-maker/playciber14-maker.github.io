// Демо: QR-меню кафе. Гость заказывает с телефона, владельцу приходит сообщение в Telegram.

const MENU = {
  "Кофе": [
    { id: "esp", name: "Эспрессо", desc: "30 мл, двойная обжарка", price: 150, icon: "☕" },
    { id: "cap", name: "Капучино", desc: "300 мл, молоко на выбор", price: 230, icon: "☕" },
    { id: "raf", name: "Раф лавандовый", desc: "350 мл, сливки, сироп", price: 290, icon: "🥛" },
    { id: "ice", name: "Айс-латте", desc: "400 мл, со льдом", price: 260, icon: "🧊" },
  ],
  "Завтраки": [
    { id: "syr", name: "Сырники", desc: "сметана, ягодный соус", price: 340, icon: "🥞" },
    { id: "omel", name: "Омлет с сыром", desc: "3 яйца, тост", price: 310, icon: "🍳" },
    { id: "gran", name: "Гранола", desc: "йогурт, банан, мёд", price: 280, icon: "🥣" },
  ],
  "Десерты": [
    { id: "chz", name: "Чизкейк", desc: "нью-йорк, кусочек", price: 320, icon: "🍰" },
    { id: "crs", name: "Круассан", desc: "сливочное масло", price: 180, icon: "🥐" },
    { id: "mac", name: "Макарон, 3 шт.", desc: "фисташка, малина, ваниль", price: 240, icon: "🍪" },
  ],
};
const ALL = Object.values(MENU).flat();
const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function mount(root) {
  const cart = new Map(); // id -> qty
  let cat = Object.keys(MENU)[0];
  let orderNo = 41;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  root.innerHTML = `
    <div class="qr">
      <div class="qr__phone">
        <div class="qr__screen">
          <header class="qr__top">
            <div><b>Кофейня «Зерно»</b><small>Стол №7 · заказ по QR</small></div>
            <span class="qr__logo" aria-hidden="true">☕</span>
          </header>
          <nav class="qr__cats" role="tablist"></nav>
          <div class="qr__list"></div>
          <button type="button" class="qr__cart" hidden></button>
          <div class="qr__sheet" hidden></div>
        </div>
      </div>
      <div class="qr__owner">
        <p class="qr__owner-label">Telegram владельца</p>
        <div class="qr__tg" role="log" aria-live="polite">
          <p class="qr__tg-empty">Здесь появятся новые заказы 👇<br>Добавь блюда и оформи заказ в меню слева.</p>
        </div>
      </div>
    </div>`;

  const catsEl = root.querySelector(".qr__cats");
  const listEl = root.querySelector(".qr__list");
  const cartBtn = root.querySelector(".qr__cart");
  const sheet = root.querySelector(".qr__sheet");
  const tg = root.querySelector(".qr__tg");

  const total = () => [...cart].reduce((s, [id, q]) => s + ALL.find((x) => x.id === id).price * q, 0);
  const count = () => [...cart.values()].reduce((s, q) => s + q, 0);

  function renderCats() {
    catsEl.innerHTML = Object.keys(MENU).map((c) =>
      `<button type="button" role="tab" aria-selected="${c === cat}" class="${c === cat ? "is-active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  }

  function renderList() {
    listEl.innerHTML = MENU[cat].map((it) => {
      const q = cart.get(it.id) || 0;
      return `
        <article class="qr__item">
          <span class="qr__icon" aria-hidden="true">${it.icon}</span>
          <div class="qr__info"><b>${esc(it.name)}</b><small>${esc(it.desc)}</small><span>${fmt(it.price)}</span></div>
          ${q
            ? `<div class="qr__qty"><button type="button" data-dec="${it.id}" aria-label="Убрать одну порцию">−</button><b>${q}</b><button type="button" data-inc="${it.id}" aria-label="Добавить ещё">+</button></div>`
            : `<button type="button" class="qr__add" data-inc="${it.id}" aria-label="Добавить ${esc(it.name)}">+</button>`}
        </article>`;
    }).join("");
  }

  function renderCart() {
    const n = count();
    cartBtn.hidden = n === 0;
    cartBtn.innerHTML = `<span>Корзина · ${n}</span><b>${fmt(total())}</b>`;
  }

  function renderAll() { renderCats(); renderList(); renderCart(); }

  function change(id, d) {
    const q = (cart.get(id) || 0) + d;
    if (q <= 0) cart.delete(id); else cart.set(id, Math.min(q, 20));
    renderList();
    renderCart();
    if (!sheet.hidden && sheet.dataset.view === "cart") openCart();
  }

  function openCart() {
    if (!count()) { closeSheet(); return; }
    // сохраняем введённое при перерисовке корзины
    const prevComment = sheet.querySelector(".qr__comment")?.value || "";
    const prevPay = sheet.querySelector('input[name="qr-pay"]:checked')?.value;
    sheet.dataset.view = "cart";
    sheet.hidden = false;
    sheet.innerHTML = `
      <div class="qr__sheet-head"><b>Ваш заказ</b><button type="button" class="qr__x" aria-label="Закрыть">✕</button></div>
      <ul class="qr__lines">
        ${[...cart].map(([id, q]) => {
          const it = ALL.find((x) => x.id === id);
          return `<li><span>${esc(it.name)}</span><div class="qr__qty qr__qty--sm"><button type="button" data-dec="${id}" aria-label="Меньше">−</button><b>${q}</b><button type="button" data-inc="${id}" aria-label="Больше">+</button></div><em>${fmt(it.price * q)}</em></li>`;
        }).join("")}
      </ul>
      <label class="qr__field"><span>Комментарий</span><input type="text" maxlength="80" placeholder="Например: без сахара" class="qr__comment"></label>
      <div class="qr__pay">
        <label><input type="radio" name="qr-pay" value="Картой официанту" checked> Картой официанту</label>
        <label><input type="radio" name="qr-pay" value="Наличными"> Наличными</label>
      </div>
      <button type="button" class="qr__submit">Отправить заказ · ${fmt(total())}</button>`;
    sheet.querySelector(".qr__comment").value = prevComment;
    if (prevPay) sheet.querySelectorAll('input[name="qr-pay"]').forEach((r) => { r.checked = r.value === prevPay; });
  }

  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ""; }

  function submit() {
    if (!count()) return;
    const comment = (sheet.querySelector(".qr__comment")?.value || "").trim().slice(0, 80);
    const pay = sheet.querySelector('input[name="qr-pay"]:checked')?.value || "";
    const no = ++orderNo;
    const lines = [...cart].map(([id, q]) => `${ALL.find((x) => x.id === id).name} × ${q}`);
    const sum = total();
    sheet.dataset.view = "done";
    sheet.innerHTML = `
      <div class="qr__done">
        <span class="qr__check">✓</span>
        <b>Заказ №${no} принят!</b>
        <p>Готовим. Официант принесёт к столу №7 примерно через 10 минут.</p>
        <button type="button" class="qr__again">Вернуться в меню</button>
      </div>`;
    cart.clear();
    renderList();
    renderCart();

    // сообщение владельцу
    tg.querySelector(".qr__tg-empty")?.remove();
    const typing = document.createElement("div");
    typing.className = "tg__msg tg__msg--in tg__typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    tg.appendChild(typing);
    tg.scrollTop = tg.scrollHeight;
    later(() => {
      typing.remove();
      const msg = document.createElement("div");
      msg.className = "tg__msg tg__msg--in qr__order";
      msg.innerHTML = `
        <b>🔔 Новый заказ №${no}</b><br>
        🪑 Стол №7<br>
        ${lines.map((l) => `• ${esc(l)}`).join("<br>")}<br>
        ${comment ? `💬 ${esc(comment)}<br>` : ""}
        💳 ${esc(pay)}<br>
        <b>Итого: ${fmt(sum)}</b>
        <div class="qr__order-btns"><button type="button">✅ Принять</button><button type="button">⏱ +10 мин</button></div>
        <span class="tg__time">${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>`;
      msg.querySelectorAll(".qr__order-btns button").forEach((b, i) => b.addEventListener("click", () => {
        msg.querySelector(".qr__order-btns").innerHTML = `<i>${i === 0 ? "✅ Принят в работу" : "⏱ Гостю отправлено: заказ задержится на 10 мин"}</i>`;
      }));
      tg.appendChild(msg);
      tg.scrollTop = tg.scrollHeight;
    }, 700);
  }

  // слушаем на своём контейнере (root переиспользуется другими демками)
  root.querySelector(".qr").addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.cat) { cat = t.dataset.cat; renderCats(); renderList(); listEl.scrollTop = 0; return; }
    if (t.dataset.inc) return change(t.dataset.inc, 1);
    if (t.dataset.dec) return change(t.dataset.dec, -1);
    if (t === cartBtn) return openCart();
    if (t.classList.contains("qr__x") || t.classList.contains("qr__again")) return closeSheet();
    if (t.classList.contains("qr__submit")) return submit();
  });

  renderAll();
  return () => timers.forEach(clearTimeout);
}
