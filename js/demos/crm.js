// Демо: мини-CRM (канбан заявок). Данные хранятся в localStorage этого браузера.

const KEY = "quarsell-crm-demo-v1";
const COLUMNS = [
  { id: "new", name: "Новые" },
  { id: "work", name: "В работе" },
  { id: "done", name: "Готово" },
];
const SAMPLE = [
  { id: 1, name: "Ирина", service: "Лендинг для студии", price: 35000, col: "new" },
  { id: 2, name: "Кафе «Север»", service: "Telegram-бот для заказов", price: 45000, col: "new" },
  { id: 3, name: "Максим", service: "Discord-бот модерации", price: 20000, col: "work" },
  { id: 4, name: "Автосервис", service: "Бот записи", price: 40000, col: "work" },
  { id: 5, name: "Ольга", service: "Сайт-визитка", price: 25000, col: "done" },
];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU") + " ₽";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (Array.isArray(data)) return data.filter((x) => x && COLUMNS.some((c) => c.id === x.col));
  } catch { /* хранилище недоступно — работаем в памяти */ }
  return SAMPLE.map((x) => ({ ...x }));
}
function save(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function mount(root) {
  let items = load();
  let query = "";
  let dragId = null;

  root.innerHTML = `
    <div class="crm">
      <div class="crm__top">
        <input type="search" class="crm__search" placeholder="Поиск по заявкам" aria-label="Поиск по заявкам">
        <button type="button" class="crm__reset">Сбросить</button>
      </div>
      <form class="crm__add">
        <input name="name" placeholder="Клиент" aria-label="Клиент" maxlength="40" required>
        <input name="service" placeholder="Что нужно" aria-label="Что нужно" maxlength="60" required>
        <input name="price" type="number" min="0" max="10000000" step="1000" placeholder="Бюджет, ₽" aria-label="Бюджет в рублях">
        <button type="submit">+ Заявка</button>
      </form>
      <p class="crm__error" hidden></p>
      <div class="crm__board"></div>
      <p class="crm__total"></p>
    </div>`;

  const board = root.querySelector(".crm__board");
  const totalEl = root.querySelector(".crm__total");
  const search = root.querySelector(".crm__search");
  const addForm = root.querySelector(".crm__add");
  const errorEl = root.querySelector(".crm__error");

  function move(id, dir) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const i = COLUMNS.findIndex((c) => c.id === it.col);
    const ni = i + dir;
    if (ni < 0 || ni >= COLUMNS.length) return;
    it.col = COLUMNS[ni].id;
    commit();
  }

  function commit() {
    save(items);
    render();
  }

  function render() {
    const q = query.toLowerCase();
    const visible = items.filter((x) => !q || x.name.toLowerCase().includes(q) || x.service.toLowerCase().includes(q));
    board.innerHTML = COLUMNS.map((c, ci) => {
      const list = visible.filter((x) => x.col === c.id);
      const sum = list.reduce((s, x) => s + (Number(x.price) || 0), 0);
      return `
        <section class="crm__col" data-col="${c.id}">
          <header><b>${c.name}</b><span>${list.length}</span></header>
          <p class="crm__sum">${fmt(sum)}</p>
          <div class="crm__list">
            ${list.map((x) => `
              <article class="crm__card" draggable="true" data-id="${x.id}">
                <b>${escapeHtml(x.name)}</b>
                <p>${escapeHtml(x.service)}</p>
                <div class="crm__card-foot">
                  <span>${fmt(x.price)}</span>
                  <div>
                    <button type="button" data-move="-1" aria-label="Переместить влево" ${ci === 0 ? "disabled" : ""}>←</button>
                    <button type="button" data-move="1" aria-label="Переместить вправо" ${ci === COLUMNS.length - 1 ? "disabled" : ""}>→</button>
                    <button type="button" data-del aria-label="Удалить заявку">✕</button>
                  </div>
                </div>
              </article>`).join("") || '<p class="crm__empty">Пусто</p>'}
          </div>
        </section>`;
    }).join("");
    const all = items.reduce((s, x) => s + (Number(x.price) || 0), 0);
    const done = items.filter((x) => x.col === "done").reduce((s, x) => s + (Number(x.price) || 0), 0);
    totalEl.textContent = `Всего заявок: ${items.length} · общий бюджет ${fmt(all)} · закрыто на ${fmt(done)}`;
  }

  // Кнопки на карточках
  board.addEventListener("click", (e) => {
    const card = e.target.closest(".crm__card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const mv = e.target.closest("[data-move]");
    if (mv) return move(id, Number(mv.dataset.move));
    if (e.target.closest("[data-del]")) {
      items = items.filter((x) => x.id !== id);
      commit();
    }
  });

  // Drag & drop (мышь)
  board.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".crm__card");
    if (!card) return;
    dragId = Number(card.dataset.id);
    card.classList.add("is-drag");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(dragId)); } catch { /* ignore */ }
  });
  board.addEventListener("dragend", () => {
    dragId = null;
    board.querySelectorAll(".is-drag, .is-over").forEach((el) => el.classList.remove("is-drag", "is-over"));
  });
  board.addEventListener("dragover", (e) => {
    const col = e.target.closest(".crm__col");
    if (!col || dragId == null) return;
    e.preventDefault();
    board.querySelectorAll(".is-over").forEach((el) => el !== col && el.classList.remove("is-over"));
    col.classList.add("is-over");
  });
  board.addEventListener("drop", (e) => {
    const col = e.target.closest(".crm__col");
    if (!col || dragId == null) return;
    e.preventDefault();
    const it = items.find((x) => x.id === dragId);
    if (it) it.col = col.dataset.col;
    dragId = null;
    commit();
  });

  search.addEventListener("input", () => { query = search.value.trim(); render(); });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const name = String(fd.get("name") || "").trim();
    const service = String(fd.get("service") || "").trim();
    const price = Math.max(0, Math.min(10000000, Math.round(Number(fd.get("price")) || 0)));
    if (name.length < 2 || service.length < 2) {
      errorEl.textContent = "Заполните клиента и задачу (минимум 2 символа).";
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    const id = items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    items.push({ id, name, service, price, col: "new" });
    addForm.reset();
    commit();
  });

  root.querySelector(".crm__reset").addEventListener("click", () => {
    items = SAMPLE.map((x) => ({ ...x }));
    query = "";
    search.value = "";
    commit();
  });

  render();
}
