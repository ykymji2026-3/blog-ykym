import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgFf_GZVsiJyQpfgDVH_P4ILRkHAz7F1U",
  authDomain: "blog-e4600.firebaseapp.com",
  projectId: "blog-e4600"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzx6uh9fJPU4GysqK6DetNMf2W6Bf0oXI6P9p3GxipOCgglgg5IpbUfKdaPY6kng5iZ/exec";
const GITHUB_POSTS_API_URL =
  "https://api.github.com/repos/ykymji2026-3/blog-ykym/contents/posts.json?ref=main";
const isLocalOrigin = ["localhost", "127.0.0.1"].includes(location.hostname);
const GAS_ENDPOINT = isLocalOrigin ? "http://localhost:8001/api/gas" : GAS_URL;
let adminPosts = [];
let adminFilterEventsReady = false;

function t(ja, en) {
  return window.getCurrentLang() === "ja" ? ja : en;
}

function getCurrentUser() {
  if (!auth.currentUser) {
    throw new Error("ログイン状態を確認できません。もう一度ログインしてください。");
  }
  return auth.currentUser;
}

async function sendGasAction(payload) {
  const body = JSON.stringify(payload);

  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body
  });
  const result = await res.json();

  if (!res.ok || !result.success) {
    throw new Error(result.error || "処理できませんでした。");
  }

  return result;
}

async function getPostsForAdmin() {
  if (!isLocalOrigin) {
    const res = await fetch(`../posts.json?${Date.now()}`);
    return res.json();
  }

  const res = await fetch(`${GITHUB_POSTS_API_URL}&cacheBust=${Date.now()}`, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error("GitHubの投稿一覧を取得できませんでした。");
  }

  const file = await res.json();
  const binary = atob(file.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8").decode(bytes));
}

async function loadAdminPosts() {
  adminPosts = await getPostsForAdmin();
  setupAdminFilters();
  renderFilteredAdminPosts();
}

function setupAdminFilters() {
  const select = document.getElementById("admin-category-filter");
  if (!select) return;

  const selected = select.value;
  const categories = [...new Set(adminPosts.map((post) => post.category).filter(Boolean))];

  select.innerHTML = `
    <option value="all">${t("すべて", "All")}</option>
  `;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  }
}

function parsePostDate(dateText) {
  if (!dateText) return null;
  const [datePart, timePart = "00:00"] = dateText.split(" ");
  const [year, month, day] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour || 0, minute || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateInputValue(id, endOfDay = false) {
  const value = document.getElementById(id)?.value;
  if (!value) return null;

  const date = new Date(value);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function getFilteredAdminPosts() {
  const keyword = document.getElementById("admin-keyword-filter")?.value.toLowerCase() || "";
  const category = document.getElementById("admin-category-filter")?.value || "all";
  const startDate = getDateInputValue("admin-start-date");
  const endDate = getDateInputValue("admin-end-date", true);

  return adminPosts.filter((post) => {
    const titleJa = post.title?.ja || "";
    const titleEn = post.title?.en || "";
    const content = post.content || "";
    const contentEn = post.contentEn || "";
    const matchKeyword =
      !keyword ||
      titleJa.toLowerCase().includes(keyword) ||
      titleEn.toLowerCase().includes(keyword) ||
      content.toLowerCase().includes(keyword) ||
      contentEn.toLowerCase().includes(keyword);

    const matchCategory = category === "all" || post.category === category;
    const postDate = parsePostDate(post.date);
    const matchStart = !startDate || (postDate && postDate >= startDate);
    const matchEnd = !endDate || (postDate && postDate <= endDate);

    return matchKeyword && matchCategory && matchStart && matchEnd;
  });
}

function renderFilteredAdminPosts() {
  renderAdminPosts(getFilteredAdminPosts());
}

function renderAdminPosts(posts) {
  const draftList = document.getElementById("draft-list");
  const postList = document.getElementById("admin-post-list");

  draftList.innerHTML = "";
  postList.innerHTML = "";

  posts.forEach((post) => {
    const title = post.title?.[window.getCurrentLang()] || post.title?.ja || post.title;
    const content = window.getCurrentLang() === "en"
      ? post.contentEn || post.content
      : post.content;
    const image = renderAdminEyecatchImage(getPostImageUrl(post));

    // 下書き
    if (post.draft) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="card">
          <strong>${title}</strong>
          <button class="btn danger" onclick="publishPost('${post.id}')">
            ${t("公開", "Publish")}
          </button>
        </div>
      `;
      draftList.appendChild(li);
    }

    // 全投稿
    const li = document.createElement("li");
    li.dataset.postId = post.id;
    li.innerHTML = `
      <div class="card-row">

        <!-- クリックエリア -->
        <div class="card-content" onclick="togglePost('${post.id}')">
          <strong>${title}</strong>
          <div class="meta">${getPostDisplayDate(post)} / ${post.category}</div>
        </div>

        <!-- 削除ボタン -->
        <div class="card-actions">
          <button class="btn danger" onclick="event.stopPropagation(); deletePost('${post.id}')">
            ${t("削除", "Delete")}
          </button>
        </div>
      </div>

      <!-- 展開部分 -->
      <div id="content-${post.id}" class="detail">
        ${image}
        ${content}
      </div>
    `;
    postList.appendChild(li);
  });
}

function getSafeImageUrl(url) {
  if (!url) return "";

  const trimmed = String(url).trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed, location.href);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const driveId = getGoogleDriveFileId(parsed);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
    }
    return parsed.href;
  } catch (error) {
    return "";
  }
}

function getGoogleDriveFileId(url) {
  if (url.hostname !== "drive.google.com") return "";

  const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (filePathMatch) return filePathMatch[1];

  return url.searchParams.get("id") || "";
}

function getPostImageUrl(post) {
  return (
    post.imageUrl ||
    post.eyecatchImageUrl ||
    post.thumbnailUrl ||
    post.imageURL ||
    post.image ||
    post["アイキャッチ画像URL"] ||
    post["画像URL"] ||
    ""
  );
}

function getPostDisplayDate(post) {
  if (!isInvalidDisplayDate(post.date)) return post.date;

  const dateFromId = new Date(Number(post.id));
  if (Number.isNaN(dateFromId.getTime())) return post.date;

  return formatPostDate(dateFromId);
}

function isInvalidDisplayDate(dateText) {
  if (!dateText) return true;

  const parsed = parsePostDate(dateText);
  return !parsed || parsed.getFullYear() < 2000;
}

function formatPostDate(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("/") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderAdminEyecatchImage(url) {
  const safeUrl = getSafeImageUrl(url);
  if (!safeUrl) return "";

  return `<img class="admin-eyecatch" src="${safeUrl}" alt="" loading="lazy">`;
}

async function deletePost(id) {
  if (!confirm(t("本当に削除されますか？", "Are you sure you want to delete this post?"))) return;

  try {
    const token = await getCurrentUser().getIdToken();
    const result = await sendGasAction({ action: "delete", id, idToken: token });

    document.querySelector(`[data-post-id="${id}"]`)?.remove();
    document.querySelector(`#content-${CSS.escape(id)}`)?.remove();
    showToast(t("削除しました", "Deleted"));
    await loadAdminPosts();
  } catch (error) {
    console.error("削除失敗", error);
    showToast(t("削除できませんでした: ", "Could not delete: ") + error.message);
  }
}

async function loadScheduledPosts() {
  try {
    const list = document.getElementById("scheduled-list");
    const token = await getCurrentUser().getIdToken();
    const url = `${GAS_ENDPOINT}?action=listScheduled&idToken=${encodeURIComponent(token)}`;
    const posts = await fetch(url).then((res) => {
      if (!res.ok) throw new Error("スケジュール取得失敗");
      return res.json();
    });
    if (!Array.isArray(posts)) {
      throw new Error(posts.error || "スケジュール取得失敗");
    }

    list.innerHTML = "";

    posts.forEach((post) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="card">
          ${post.title} / ${post.publishAt}
        </div>
      `;
      list.appendChild(li);
    });
  } catch (error) {
    console.error("スケジュール取得失敗", error);
  }
}

function initAdminPage() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById("admin-content").hidden = false;
      setupAdminFilterEvents();
      loadAdminPosts();
      loadScheduledPosts();
    } else {
      location.href = "../auth/login.html";
    }
  });
}

document.addEventListener("DOMContentLoaded", initAdminPage);

function setupAdminFilterEvents() {
  if (adminFilterEventsReady) return;
  adminFilterEventsReady = true;

  const toggle = document.getElementById("admin-filter-toggle");
  const panel = document.getElementById("admin-filter-panel");
  const clear = document.getElementById("admin-filter-clear");

  function updateFilterToggleLabel() {
    const isOpen = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen
      ? t("詳細検索を非表示", "Hide advanced search")
      : t("詳細検索を表示", "Show advanced search");
  }

  updateFilterToggleLabel();

  toggle?.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    updateFilterToggleLabel();
  });

  document
    .getElementById("admin-keyword-filter")
    ?.addEventListener("input", renderFilteredAdminPosts);

  document
    .getElementById("admin-category-filter")
    ?.addEventListener("change", renderFilteredAdminPosts);

  document
    .getElementById("admin-start-date")
    ?.addEventListener("change", renderFilteredAdminPosts);

  document
    .getElementById("admin-end-date")
    ?.addEventListener("change", renderFilteredAdminPosts);

  clear?.addEventListener("click", () => {
    document.getElementById("admin-keyword-filter").value = "";
    document.getElementById("admin-category-filter").value = "all";
    document.getElementById("admin-start-date").value = "";
    document.getElementById("admin-end-date").value = "";
    renderFilteredAdminPosts();
  });
}


async function publishPost(id) {
  try {
    const token = await getCurrentUser().getIdToken();
    const result = await sendGasAction({ action: "publish", id, idToken: token });

    showToast(t("公開しました", "Published"));
    await loadAdminPosts();
  } catch (error) {
    console.error("公開失敗", error);
    showToast(t("公開失敗: ", "Could not publish: ") + error.message);
  }
}

function togglePost(id) {
  const el = document.getElementById(`content-${id}`);

  el.style.display = el.style.display === "block" ? "none" : "block";
}


function logout() {
  signOut(auth)
    .then(() => {
      location.reload();
    })
    .catch((error) => {
      console.error("ログアウト失敗", error);
    });
}

window.logout = logout;
window.publishPost = publishPost;
window.deletePost = deletePost;
window.togglePost = togglePost;

document.addEventListener("language:changed", () => {
  const toggle = document.getElementById("admin-filter-toggle");
  const panel = document.getElementById("admin-filter-panel");
  if (toggle && panel) {
    const isOpen = !panel.hidden;
    toggle.textContent = isOpen
      ? t("詳細検索を非表示", "Hide advanced search")
      : t("詳細検索を表示", "Show advanced search");
  }

  if (adminPosts.length > 0) {
    setupAdminFilters();
    renderFilteredAdminPosts();
  }
});
