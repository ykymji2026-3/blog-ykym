async function loadComponent(target) {
  const src = target.getAttribute("data-component");
  if (!src) return;

  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`Failed to load component: ${src}`);
  }

  target.innerHTML = await res.text();
  target.dispatchEvent(
    new CustomEvent("component:loaded", {
      bubbles: true,
      detail: { src },
    }),
  );
}

async function loadComponents() {
  const targets = [...document.querySelectorAll("[data-component]")];
  await Promise.all(targets.map(loadComponent));
  placeHeaderActions();
  document.dispatchEvent(new CustomEvent("components:ready"));
}

function placeHeaderActions() {
  const leftTarget = document.querySelector("[data-header-actions-left]");
  const rightTarget = document.querySelector("[data-header-actions-right]");

  document.querySelectorAll("[data-header-action]").forEach((action) => {
    const position = action.getAttribute("data-header-action");
    const target = position === "left" ? leftTarget : rightTarget;
    if (!target) return;

    action.removeAttribute("data-header-action");
    target.appendChild(action);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadComponents().catch((error) => {
    console.error(error);
    window.showToast?.("画面部品の読み込みに失敗しました。");
  });
});
