// Демо: 3D-сайт концепта MacBook Pro. Сам сайт собран отдельно (React + Three.js) и лежит в /macbook-pro/.
// В окне — живой сайт во фрейме и кнопка, чтобы открыть его на весь экран.

const URL = "/macbook-pro/";

export function mount(root) {
  root.innerHTML = `
    <div class="mbp">
      <iframe class="mbp__frame" src="${URL}" title="3D-сайт MacBook Pro (концепт)" loading="lazy" allow="fullscreen"></iframe>
      <a class="mbp__open" href="${URL}" target="_blank" rel="noopener">Открыть сайт на весь экран ↗</a>
    </div>`;
  // убираем фрейм при закрытии окна, чтобы освободить WebGL
  return () => {
    root.querySelector(".mbp__frame")?.remove();
  };
}
