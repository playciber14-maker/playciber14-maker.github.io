// Демо: Discord-бот верификации и модерации. Всё имитируется в браузере.

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const MEMBERS = ["spam_bot99", "newbie_kate", "alex_dev"];

export function mount(root) {
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };

  const state = { verified: false, warns: {}, pendingAnswer: null };

  root.innerHTML = `
    <div class="dc">
      <aside class="dc__servers" aria-hidden="true"><span class="is-active">Q</span><span>D</span><span>+</span></aside>
      <aside class="dc__channels">
        <b>Dev Community</b>
        <p># правила</p><p class="is-active"># верификация</p><p># общий-чат</p>
        <div class="dc__me"><i></i><span>Вы<small class="dc__role">без роли</small></span></div>
      </aside>
      <div class="dc__main">
        <div class="dc__top"># верификация</div>
        <div class="dc__log" role="log" aria-live="polite"></div>
        <div class="dc__chips"></div>
        <form class="dc__input">
          <input type="text" placeholder="Написать в #верификация" aria-label="Сообщение или команда" maxlength="200" autocomplete="off">
        </form>
      </div>
    </div>`;

  const log = root.querySelector(".dc__log");
  const chipsEl = root.querySelector(".dc__chips");
  const form = root.querySelector(".dc__input");
  const input = form.querySelector("input");
  const roleEl = root.querySelector(".dc__role");

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const now = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  function message(author, html, { bot = false, own = false } = {}) {
    const el = document.createElement("div");
    el.className = "dc__msg";
    el.innerHTML = `
      <i class="dc__ava ${bot ? "dc__ava--bot" : own ? "dc__ava--me" : ""}">${bot ? "🤖" : escapeHtml(author[0].toUpperCase())}</i>
      <div>
        <div class="dc__meta"><b class="${bot ? "dc__bot" : ""}">${escapeHtml(author)}</b>${bot ? '<span class="dc__tag">БОТ</span>' : ""}<small>сегодня в ${now()}</small></div>
        <div class="dc__text">${html}</div>
      </div>`;
    log.appendChild(el);
    scroll();
    return el;
  }

  function embed({ color = "#5865f2", title, body, buttons = [] }) {
    const el = message("Guardian", "", { bot: true });
    const box = document.createElement("div");
    box.className = "dc__embed";
    box.style.borderLeftColor = color;
    box.innerHTML = `<b>${title}</b><p>${body}</p>`;
    if (buttons.length) {
      const row = document.createElement("div");
      row.className = "dc__btns";
      buttons.forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.text;
        if (b.style) btn.classList.add(`dc__btn--${b.style}`);
        btn.addEventListener("click", () => {
          row.querySelectorAll("button").forEach((x) => (x.disabled = true));
          b.action();
        });
        row.appendChild(btn);
      });
      box.appendChild(row);
    }
    el.querySelector(".dc__text").appendChild(box);
    scroll();
  }

  function botReply(fn) {
    later(fn, 450);
  }

  const help = () =>
    embed({
      title: "Команды Guardian",
      body:
        "<code>/verify</code>: пройти проверку и получить роль<br>" +
        "<code>/rules</code>: правила сервера<br>" +
        "<code>/warn @ник причина</code>: выдать предупреждение (модерация)<br>" +
        "<code>/help</code>: этот список",
    });

  const rules = () =>
    embed({
      color: "#faa61a",
      title: "📜 Правила",
      body: "1. Уважайте участников.<br>2. Без рекламы и ссылок до верификации.<br>3. Спам — предупреждение, 3 предупреждения — мут.",
    });

  function verify() {
    if (state.verified) {
      embed({ color: "#3ba55c", title: "Вы уже проверены ✅", body: "Роль <b>Участник</b> уже выдана." });
      return;
    }
    const a = 2 + Math.floor(Math.random() * 6);
    const b = 2 + Math.floor(Math.random() * 6);
    const right = a + b;
    const opts = new Set([right]);
    while (opts.size < 3) opts.add(right + Math.floor(Math.random() * 7) - 3);
    const shuffled = [...opts].filter((n) => n > 0).sort(() => Math.random() - 0.5);
    embed({
      title: "🔐 Проверка новичка",
      body: `Докажите, что вы не бот: сколько будет <b>${a} + ${b}</b>?`,
      buttons: shuffled.map((n) => ({
        text: String(n),
        action: () => botReply(() => (n === right ? passVerify() : failVerify())),
      })),
    });
  }

  function passVerify() {
    state.verified = true;
    roleEl.textContent = "Участник";
    roleEl.classList.add("is-ok");
    embed({ color: "#3ba55c", title: "Проверка пройдена ✅", body: "Вам выдана роль <b>Участник</b>. Доступ к #общий-чат открыт." });
  }

  function failVerify() {
    embed({
      color: "#ed4245",
      title: "Неверно ❌",
      body: "Попробуйте ещё раз.",
      buttons: [{ text: "Новая проверка", action: () => botReply(verify) }],
    });
  }

  function warn(args) {
    const m = args.match(/^@?(\S+)\s*(.*)$/);
    if (!m) {
      embed({ color: "#ed4245", title: "Ошибка", body: "Использование: <code>/warn @ник причина</code>" });
      return;
    }
    const user = m[1];
    const reason = m[2].trim() || "без причины";
    if (!MEMBERS.includes(user)) {
      embed({ color: "#ed4245", title: "Пользователь не найден", body: `На сервере нет <b>${escapeHtml(user)}</b>. Попробуйте: ${MEMBERS.map((x) => `<code>@${x}</code>`).join(", ")}` });
      return;
    }
    state.warns[user] = (state.warns[user] || 0) + 1;
    const n = state.warns[user];
    if (n >= 3) {
      embed({ color: "#ed4245", title: `🔇 ${escapeHtml(user)} получил мут на 1 час`, body: `3 предупреждения из 3. Последняя причина: ${escapeHtml(reason)}` });
      state.warns[user] = 0;
    } else {
      embed({ color: "#faa61a", title: `⚠️ Предупреждение для ${escapeHtml(user)}`, body: `Причина: ${escapeHtml(reason)}<br>Предупреждений: <b>${n}/3</b>` });
    }
  }

  function handle(raw) {
    const text = raw.trim();
    if (!text) return;
    const own = message("Вы", escapeHtml(text), { own: true });

    if (/(https?:\/\/|www\.|\.ru\b|\.com\b|t\.me\/)/i.test(text) && !state.verified) {
      botReply(() => {
        own.classList.add("is-deleted");
        own.querySelector(".dc__text").innerHTML = "<i>сообщение удалено ботом</i>";
        embed({ color: "#ed4245", title: "🚫 Ссылки запрещены", body: "Новичкам нельзя отправлять ссылки до верификации. Используйте <code>/verify</code>." });
      });
      return;
    }

    if (!text.startsWith("/")) {
      if (!state.verified) botReply(() => embed({ title: "Добро пожаловать! 👋", body: "Чтобы писать в чатах, пройдите проверку: <code>/verify</code>" }));
      else botReply(() => embed({ color: "#3ba55c", title: "Сообщение принято", body: "Вы верифицированы и можете общаться в #общий-чат." }));
      return;
    }

    const [cmd, ...rest] = text.split(/\s+/);
    const args = rest.join(" ");
    switch (cmd.toLowerCase()) {
      case "/help": return botReply(help);
      case "/rules": return botReply(rules);
      case "/verify": return botReply(verify);
      case "/warn": return botReply(() => warn(args));
      default:
        return botReply(() => embed({ color: "#ed4245", title: "Неизвестная команда", body: `<code>${escapeHtml(cmd)}</code> не найдена. Список: <code>/help</code>` }));
    }
  }

  ["/help", "/verify", "/rules", "/warn @spam_bot99 реклама", "смотрите https://spam.ru"].forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c;
    b.addEventListener("click", () => handle(c));
    chipsEl.appendChild(b);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    handle(v);
  });

  message("newbie_kate", "привет, как тут получить доступ к чату?");
  later(() => embed({ title: "Добро пожаловать на сервер! 👋", body: "Я Guardian. Чтобы открыть чаты, отправьте <code>/verify</code>. Все команды: <code>/help</code>" }), 500);

  return () => timers.forEach(clearTimeout);
}
