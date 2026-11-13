// Демо: лендинг ремонтной компании с калькулятором стоимости. Цены условные.

const TYPES = [
  { id: "cosmetic", name: "Косметический", rate: 4500, desc: "обои, покраска, ламинат" },
  { id: "capital", name: "Капитальный", rate: 9000, desc: "демонтаж, стяжка, электрика" },
  { id: "design", name: "Дизайнерский", rate: 15000, desc: "по проекту, авторский надзор" },
];
const EXTRAS = [
  { id: "bath", name: "Санузел под ключ", price: 180000 },
  { id: "electric", name: "Замена электрики", price: 1200, perM2: true },
  { id: "ceiling", name: "Натяжные потолки", price: 900, perM2: true },
  { id: "trash", name: "Вывоз мусора", price: 15000 },
];

const fmt = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";

export function mount(root) {
  let raf = 0;

  root.innerHTML = `
    <div class="ld">
      <div class="ld__bar"><span></span><span></span><span></span><em>remont-demo.ru</em></div>
      <div class="ld__page">
        <nav class="ld__nav">
          <b>СТРОЙ<span>ДОМ</span></b>
          <div><a>Услуги</a><a>Работы</a><a>Контакты</a></div>
        </nav>
        <section class="ld__hero">
          <p class="ld__kicker">Ремонт квартир под ключ</p>
          <h3>Ремонт без сюрпризов в&nbsp;смете</h3>
          <p class="ld__sub">Фиксируем цену в договоре. Гарантия на работы. Посчитайте стоимость за&nbsp;30&nbsp;секунд 👇</p>
          <ul class="ld__facts"><li><b>Фикс</b>цена в договоре</li><li><b>Этапы</b>оплата по факту</li><li><b>Фото</b>отчёты каждый день</li></ul>
        </section>
        <section class="ld__calc" aria-label="Калькулятор стоимости ремонта">
          <h4>Калькулятор ремонта</h4>
          <label class="ld__field">
            <span>Площадь: <b class="ld__area-val">50</b> м²</span>
            <input type="range" min="15" max="200" step="1" value="50" class="ld__area" aria-label="Площадь, м²">
          </label>
          <fieldset class="ld__types">
            <legend>Тип ремонта</legend>
            ${TYPES.map((t, i) => `
              <label class="ld__type">
                <input type="radio" name="ld-type" value="${t.id}" ${i === 1 ? "checked" : ""}>
                <span><b>${t.name}</b><small>${t.desc}</small><em>${t.rate.toLocaleString("ru-RU")} ₽/м²</em></span>
              </label>`).join("")}
          </fieldset>
          <fieldset class="ld__extras">
            <legend>Дополнительно</legend>
            ${EXTRAS.map((x) => `
              <label class="ld__check">
                <input type="checkbox" value="${x.id}">
                <span>${x.name}</span>
              </label>`).join("")}
          </fieldset>
          <div class="ld__result">
            <div><small>Примерная стоимость</small><strong class="ld__total">0 ₽</strong><small class="ld__term"></small></div>
            <button type="button" class="ld__cta">Получить точную смету</button>
          </div>
          <p class="ld__thanks" hidden>Спасибо! Это демо, заявка никуда не отправлена 🙂</p>
        </section>
      </div>
    </div>`;

  const area = root.querySelector(".ld__area");
  const areaVal = root.querySelector(".ld__area-val");
  const total = root.querySelector(".ld__total");
  const term = root.querySelector(".ld__term");
  const cta = root.querySelector(".ld__cta");
  const thanks = root.querySelector(".ld__thanks");

  let shown = 0;

  function calc() {
    const m2 = Number(area.value);
    const typeId = root.querySelector('input[name="ld-type"]:checked').value;
    const type = TYPES.find((t) => t.id === typeId);
    let sum = m2 * type.rate;
    root.querySelectorAll(".ld__extras input:checked").forEach((c) => {
      const x = EXTRAS.find((e) => e.id === c.value);
      sum += x.perM2 ? x.price * m2 : x.price;
    });
    const weeks = Math.max(2, Math.round((m2 / 10) * (typeId === "cosmetic" ? 0.6 : typeId === "capital" ? 1 : 1.4)));
    areaVal.textContent = m2;
    term.textContent = `срок ~${weeks} нед.`;
    animateTo(sum);
  }

  function animateTo(target) {
    cancelAnimationFrame(raf);
    // Первый расчёт и скрытая вкладка — без анимации
    if (!shown || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown = target;
      total.textContent = fmt(target);
      return;
    }
    const from = shown;
    const t0 = performance.now();
    const dur = 450;
    const step = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      shown = from + (target - from) * e;
      total.textContent = fmt(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  root.querySelector(".ld__calc").addEventListener("input", calc);
  cta.addEventListener("click", () => { thanks.hidden = false; });
  calc();

  return () => cancelAnimationFrame(raf);
}
