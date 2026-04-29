function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

window.showToast = showToast;

function getCurrentLang() {
  return localStorage.getItem("lang") || "ja";
}

function applyLang() {
  const currentLang = getCurrentLang();
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-ja]").forEach((el) => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });

  document.querySelectorAll("[data-ja-placeholder]").forEach((el) => {
    el.placeholder = el.getAttribute("data-" + currentLang + "-placeholder");
  });

  const btn = document.getElementById("langBtn");
  if (btn) {
    btn.textContent =
      currentLang === "ja" ? "Switch to English" : "日本語に切り替える";
  }

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.placeholder = currentLang === "ja" ? "検索..." : "Search...";
  }
}

function toggleLang() {
  const nextLang = getCurrentLang() === "ja" ? "en" : "ja";
  localStorage.setItem("lang", nextLang);
  applyLang();
  document.dispatchEvent(new CustomEvent("language:changed"));
}

window.applyLang = applyLang;
window.getCurrentLang = getCurrentLang;
window.toggleLang = toggleLang;

document.addEventListener("components:ready", applyLang);
document.addEventListener("DOMContentLoaded", applyLang);
