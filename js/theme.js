// День / ночь. Единый источник: атрибут data-theme на <html>.

const KEY = "quarsell-theme";

export function isNight() {
  return document.documentElement.dataset.theme === "night";
}

export function setTheme(night) {
  const root = document.documentElement;
  if (night) root.dataset.theme = "night";
  else delete root.dataset.theme;
  try { localStorage.setItem(KEY, night ? "night" : "day"); } catch { /* хранилище недоступно */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = night ? "#0d0b1a" : "#f5efe8";
  document.querySelectorAll(".theme-toggle").forEach((b) => {
    b.setAttribute("aria-label", night ? "Включить дневной режим" : "Включить ночной режим");
  });
}

export function toggleTheme() {
  setTheme(!isNight());
}
