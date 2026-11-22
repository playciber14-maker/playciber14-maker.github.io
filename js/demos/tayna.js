// Реальный проект: сайт эко-лоджа «Тайна Мзымты». В окне скриншоты и кнопка на живой сайт.
const URL = "https://tayna-mzymty.ru/";
const SHOTS = [
  { src: "/assets/tayna/home-desktop.jpg", alt: "Главная страница сайта «Тайна Мзымты»: дом в горах и меню", w: 1424, h: 900 },
  { src: "/assets/tayna/vozdukh-desktop.jpg", alt: "Страница дома «Воздух»: терраса и список удобств", w: 1424, h: 900 },
  { src: "/assets/tayna/banya-desktop.jpg", alt: "Страница бани «Вода и огонь»", w: 1424, h: 900 },
];
const MOBILE = { src: "/assets/tayna/home-mobile.jpg", alt: "Главная страница на телефоне", w: 780, h: 1688 };

export function mount(root) {
  const fig = (s, cls = "") =>
    `<figure class="tay__fig ${cls}"><img src="${s.src}" alt="${s.alt}" width="${s.w}" height="${s.h}" loading="lazy"></figure>`;
  root.innerHTML = `
    <div class="tay">
      <a class="tay__open" href="${URL}" target="_blank" rel="noopener">Открыть живой сайт ↗</a>
      ${SHOTS.map((s) => fig(s)).join("")}
      ${fig(MOBILE, "tay__fig--phone")}
    </div>`;
  return () => {};
}
