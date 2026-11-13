// Проекты и модальное окно с демками. Общий модуль для обеих версий сайта.
// Нужна разметка dialog#modal с #modal-title, #modal-info, #modal-demo и .modal__close.

const $ = (sel, root = document) => root.querySelector(sel);
const PROJECTS = {
  "tg-bot": {
    title: "Бот записи в шиномонтаж",
    task: "Клиенты записываются по телефону, администратор теряет заявки и путается в расписании.",
    done: [
      "меню на кнопках: запись, цены, адрес",
      "выбор услуги, даты и свободного слота",
      "подтверждение и отмена записи",
      "ответ на непонятные сообщения вместо падения",
    ],
    stack: "Python, aiogram, SQLite",
    note: "Демо работает прямо в браузере и имитирует бота. Время в слотах выдуманное.",
    demo: () => import("./demos/tg-bot.js"),
  },
  landing: {
    title: "Лендинг ремонтной компании",
    task: "Компании нужен сайт, где клиент сразу видит примерную цену ремонта и оставляет заявку.",
    done: [
      "первый экран с оффером",
      "калькулятор: площадь, тип ремонта, доп. работы",
      "цена пересчитывается мгновенно",
      "адаптив под телефон",
    ],
    stack: "HTML, CSS, JavaScript",
    note: "Компания и цены вымышленные, это демонстрация.",
    demo: () => import("./demos/landing.js"),
  },
  discord: {
    title: "Discord-бот верификации",
    task: "На сервер заходят боты и спамеры. Нужно проверять новичков и автоматически модерировать.",
    done: [
      "команда /verify с проверкой-вопросом",
      "выдача роли после проверки",
      "/warn: предупреждения со счётчиком",
      "антиспам: удаляет ссылки от непроверенных",
    ],
    stack: "Python, discord.py",
    note: "Попробуй команды /help, /verify, /warn, /rules или отправь ссылку до верификации.",
    demo: () => import("./demos/discord.js"),
  },
  crm: {
    title: "Мини-CRM для заявок",
    task: "Заявки приходят из разных мест и теряются в чатах. Нужна простая доска со статусами.",
    done: [
      "канбан: новые, в работе, готово",
      "перетаскивание мышью, на телефоне кнопками",
      "поиск и суммы по колонкам",
      "данные сохраняются в браузере",
    ],
    stack: "JavaScript, LocalStorage",
    note: "Данные хранятся только в твоём браузере. Кнопка «Сбросить» вернёт пример.",
    demo: () => import("./demos/crm.js"),
  },
  "qr-menu": {
    title: "QR-меню кафе",
    task: "Гости ждут официанта, чтобы сделать заказ, а в часы пик заказы теряются и путаются.",
    done: [
      "меню по категориям с фото-иконками",
      "корзина, комментарий, способ оплаты",
      "заказ с номером стола уходит владельцу в Telegram",
      "кнопки «Принять» и «+10 мин» прямо в сообщении",
    ],
    stack: "HTML, CSS, JavaScript, Telegram Bot API",
    note: "Кафе и цены вымышленные. Слева экран гостя, справа Telegram владельца.",
    demo: () => import("./demos/qr-menu.js"),
  },
  configurator: {
    title: "3D-конфигуратор дисков",
    task: "Клиенту сложно представить, как будут выглядеть диски, и он уходит думать, а не записывается.",
    done: [
      "3D-модель колеса, крутится мышкой и пальцем",
      "диаметр R16–R19, 5 цветов, число спиц, цвет суппорта",
      "цена комплекта пересчитывается сразу",
      "кнопка записи на установку",
    ],
    stack: "Three.js, JavaScript",
    note: "Цены условные. Модель собрана кодом, без загрузки тяжёлых файлов.",
    demo: () => import("./demos/configurator.js"),
  },
  dashboard: {
    title: "Дашборд для владельца бизнеса",
    task: "Владелец не видит, откуда приходят заявки и сколько приносит каждая услуга.",
    done: [
      "KPI: выручка, заказы, конверсия, средний чек",
      "график выручки с подсказкой при наведении",
      "заявки по источникам и топ услуг",
      "переключатель: неделя, месяц, год",
    ],
    stack: "JavaScript, SVG (без тяжёлых библиотек)",
    note: "Данные вымышленные. В реальном проекте берутся из CRM, бота или таблицы.",
    demo: () => import("./demos/dashboard.js"),
  },
  "shop-bot": {
    title: "Telegram-бот магазина",
    task: "Магазину нужен приём заказов в Telegram без сайта и ручной переписки с каждым клиентом.",
    done: [
      "каталог по категориям, выбор размера",
      "корзина и оформление: имя, телефон, доставка",
      "проверка телефона и имени, понятные ошибки",
      "админка: владелец меняет статус, клиенту приходит уведомление",
    ],
    stack: "Python, aiogram, PostgreSQL",
    note: "Попробуй оформить заказ, потом открой вкладку «Админка» и смени статус.",
    demo: () => import("./demos/shop-bot.js"),
  },
};

const modal = $("#modal");
const modalTitle = $("#modal-title");
const modalInfo = $("#modal-info");
const modalDemo = $("#modal-demo");
let cleanupDemo = null;
let lastTrigger = null;
let session = 0; // номер открытия — защищает от гонок при быстром закрытии/открытии

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function openProject(id, trigger) {
  const p = PROJECTS[id];
  if (!p) return;
  teardown();
  const my = ++session;
  lastTrigger = trigger || null;

  modalTitle.textContent = p.title;
  modalInfo.innerHTML = `
    <div><h4>Задача</h4><p>${esc(p.task)}</p></div>
    <div><h4>Что сделано</h4><ul>${p.done.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
    <div><h4>Стек</h4><p>${esc(p.stack)}</p></div>
    <p class="modal__note">${esc(p.note)}</p>`;
  modalDemo.innerHTML = '<p class="demo-loading">Загружаю демо…</p>';

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
  document.body.classList.add("modal-open");

  try {
    const mod = await p.demo();
    if (my !== session || !modal.open) return;
    modalDemo.innerHTML = "";
    cleanupDemo = mod.mount(modalDemo) || null;
  } catch (err) {
    console.error(err);
    if (my === session) modalDemo.innerHTML = '<p class="demo-loading">Не удалось загрузить демо. Обнови страницу.</p>';
  }
}

// Убираем текущую демку (таймеры, разметку). Можно вызывать сколько угодно раз.
function teardown() {
  if (typeof cleanupDemo === "function") cleanupDemo();
  cleanupDemo = null;
  modalDemo.innerHTML = "";
}

function finishClose() {
  session++;
  teardown();
  document.body.classList.remove("modal-open");
  if (lastTrigger) lastTrigger.focus();
}

function closeModal() {
  if (!modal.open) return;
  modal.close();
  finishClose();
}

// Срабатывает и при закрытии по Esc. Если окно уже открыто снова — ничего не трогаем.
modal.addEventListener("close", () => {
  if (!modal.open) finishClose();
});

$(".modal__close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal(); // клик по фону
});

// Делегирование: кнопки «Открыть демо» есть и в секции, и в панели комнаты
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open]");
  if (btn) openProject(btn.dataset.open, btn);
});
