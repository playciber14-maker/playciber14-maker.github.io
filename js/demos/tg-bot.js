// Демо: Telegram-бот записи в шиномонтаж. Полностью в браузере, без сервера.

const SERVICES = [
  { id: "change", name: "Сезонная замена шин", price: "от 2 000 ₽", min: 40 },
  { id: "balance", name: "Балансировка колёс", price: "от 1 200 ₽", min: 30 },
  { id: "repair", name: "Ремонт прокола", price: "от 600 ₽", min: 20 },
  { id: "storage", name: "Хранение шин", price: "от 3 500 ₽ / сезон", min: 15 },
];
const TIMES = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const DAY_NAMES = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function mount(root) {
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };

  // Псевдо-случайно «занятые» слоты, стабильные в рамках сессии
  const busy = new Set();
  for (let d = 0; d < 4; d++) {
    TIMES.forEach((t, i) => { if ((d * 7 + i * 3) % 5 === 0) busy.add(`${d}|${t}`); });
  }

  const state = { step: "idle", service: null, day: null, time: null, booking: null };

  root.innerHTML = `
    <div class="tg">
      <div class="tg__head">
        <div class="tg__avatar">🛞</div>
        <div><div class="tg__name">Шиномонтаж «Протектор»</div><div class="tg__status">бот</div></div>
      </div>
      <div class="tg__chat" role="log" aria-live="polite"></div>
      <div class="tg__chips"></div>
      <form class="tg__input">
        <input type="text" placeholder="Сообщение" aria-label="Сообщение боту" maxlength="200" autocomplete="off">
        <button type="submit" aria-label="Отправить">➤</button>
      </form>
    </div>`;

  const chat = root.querySelector(".tg__chat");
  const chips = root.querySelector(".tg__chips");
  const form = root.querySelector(".tg__input");
  const input = form.querySelector("input");

  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  const time = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  function userMsg(text) {
    const el = document.createElement("div");
    el.className = "tg__msg tg__msg--out";
    el.innerHTML = `${escapeHtml(text)}<span class="tg__time">${time()}</span>`;
    chat.appendChild(el);
    scroll();
  }

  // buttons: [[{text, action}]] — ряды инлайн-кнопок
  function botMsg(html, buttons = []) {
    const typing = document.createElement("div");
    typing.className = "tg__msg tg__msg--in tg__typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    chat.appendChild(typing);
    scroll();
    later(() => {
      typing.remove();
      const el = document.createElement("div");
      el.className = "tg__msg tg__msg--in";
      el.innerHTML = `${html}<span class="tg__time">${time()}</span>`;
      chat.appendChild(el);
      if (buttons.length) {
        const kb = document.createElement("div");
        kb.className = "tg__kb";
        buttons.forEach((row) => {
          const r = document.createElement("div");
          r.className = "tg__kb-row";
          row.forEach((b) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = b.text;
            btn.disabled = !!b.disabled;
            btn.addEventListener("click", () => {
              kb.querySelectorAll("button").forEach((x) => (x.disabled = true));
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
    }, 550);
  }

  function days() {
    const res = [];
    const now = new Date();
    for (let i = 1; i <= 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      res.push({ idx: i - 1, label: `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}` });
    }
    return res;
  }

  const mainMenu = () => [
    [{ text: "📅 Записаться", action: chooseService }],
    [{ text: "💰 Цены", action: showPrices }, { text: "📍 Адрес", action: showAddress }],
    [{ text: "🗂 Моя запись", action: showBooking }],
  ];

  function start() {
    state.step = "idle";
    botMsg("Здравствуйте! 👋 Я бот шиномонтажа «Протектор».<br>Помогу записаться без звонков. Что нужно?", mainMenu());
  }

  function chooseService() {
    state.step = "service";
    botMsg("Выберите услугу:", SERVICES.map((s) => [{ text: s.name, action: () => { state.service = s; chooseDay(); } }]));
  }

  function chooseDay() {
    state.step = "day";
    botMsg(
      `<b>${escapeHtml(state.service.name)}</b> · ${state.service.price}, ~${state.service.min} мин.<br>Выберите день:`,
      [...days().map((d) => [{ text: d.label, action: () => { state.day = d; chooseTime(); } }]), [{ text: "← Назад", action: chooseService }]]
    );
  }

  function chooseTime() {
    state.step = "time";
    const rows = [];
    for (let i = 0; i < TIMES.length; i += 3) {
      rows.push(
        TIMES.slice(i, i + 3).map((t) => {
          const taken = busy.has(`${state.day.idx}|${t}`);
          return { text: taken ? `✕ ${t}` : t, disabled: taken, action: () => { state.time = t; askName(); } };
        })
      );
    }
    rows.push([{ text: "← Другой день", action: chooseDay }]);
    botMsg(`${escapeHtml(state.day.label)}. Свободное время (✕ — занято):`, rows);
  }

  function askName() {
    state.step = "name";
    botMsg("Как к вам обращаться? Напишите имя в поле ниже ✍️");
    input.focus();
  }

  function confirm(name) {
    state.step = "confirm";
    state.pendingName = name;
    botMsg(
      `Проверьте запись:<br>👤 ${escapeHtml(name)}<br>🛞 ${escapeHtml(state.service.name)}<br>📅 ${escapeHtml(state.day.label)}, ${state.time}`,
      [[{ text: "✅ Подтвердить", action: book }, { text: "✏️ Изменить", action: chooseService }]]
    );
  }

  function book() {
    busy.add(`${state.day.idx}|${state.time}`);
    state.booking = { name: state.pendingName, service: state.service, day: state.day, time: state.time };
    state.step = "idle";
    botMsg(
      `Готово, вы записаны! ✅<br>Ждём вас <b>${escapeHtml(state.day.label)} в ${state.time}</b>.<br>Напомню за 2 часа до визита.`,
      mainMenu()
    );
  }

  function showBooking() {
    const b = state.booking;
    if (!b) {
      botMsg("У вас пока нет записей.", [[{ text: "📅 Записаться", action: chooseService }]]);
      return;
    }
    botMsg(
      `Ваша запись:<br>🛞 ${escapeHtml(b.service.name)}<br>📅 ${escapeHtml(b.day.label)}, ${b.time}`,
      [[{ text: "❌ Отменить запись", action: cancel }], [{ text: "🏠 Меню", action: start }]]
    );
  }

  function cancel() {
    const b = state.booking;
    if (b) busy.delete(`${b.day.idx}|${b.time}`);
    state.booking = null;
    botMsg("Запись отменена. Время снова свободно.", mainMenu());
  }

  function showPrices() {
    botMsg(SERVICES.map((s) => `• ${escapeHtml(s.name)} — ${s.price}`).join("<br>"), [[{ text: "📅 Записаться", action: chooseService }]]);
  }

  function showAddress() {
    botMsg("📍 ул. Примерная, 12 (вымышленный адрес)<br>🕘 Ежедневно 9:00–19:00", mainMenu());
  }

  function renderChips() {
    chips.innerHTML = "";
    ["/start", "/prices", "Привет"].forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => handleText(c));
      chips.appendChild(b);
    });
  }

  function handleText(raw) {
    const text = raw.trim();
    if (!text) return;
    userMsg(text);
    const low = text.toLowerCase();

    if (state.step === "name") {
      const name = text.replace(/[^\p{L}\s-]/gu, "").trim().slice(0, 30);
      if (name.length < 2) {
        botMsg("Похоже, это не имя 🙂 Напишите, пожалуйста, как к вам обращаться.");
        return;
      }
      confirm(name);
      return;
    }
    if (low === "/start" || low === "меню") return start();
    if (low === "/prices" || low.includes("цен")) return showPrices();
    if (low.includes("привет") || low.includes("здравств")) return start();
    if (low.includes("запис")) return chooseService();
    if (low.includes("адрес")) return showAddress();
    botMsg("Не совсем понял 🤔 Нажмите кнопку в меню или отправьте /start.", mainMenu());
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    handleText(v);
  });

  renderChips();
  start();

  return () => timers.forEach(clearTimeout);
}
