// ====================
// 言語設定＆管理モード
// ====================
// 現在の言語（localStorageに保存されてればそれを使う）
let currentLang = localStorage.getItem("lang") || "ja";
// 管理者モード（trueだと下書きも見える）

// ====================
// ページ判定（一覧 or 詳細）
// ====================
function renderCurrentPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  // idがあれば記事詳細、それ以外は一覧表示
  if (id) {
    showPostIfNeeded();
  } else {
    loadPosts();
  }
}

// ====================
// 言語切替
// ====================
function toggleLang() {
  currentLang = currentLang === "ja" ? "en" : "ja";
  localStorage.setItem("lang", currentLang);

  applyLang(); // 表示テキスト更新
  setupCategory(allPosts); // カテゴリの「すべて」も更新
  renderCurrentPage(); // ページ再描画
}

// ====================
// 言語適用
// ====================
function applyLang() {
  document.documentElement.lang = currentLang;
  // data-ja / data-en を持つ要素を書き換え
  document.querySelectorAll("[data-ja]").forEach((el) => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });
  // ボタンテキスト変更
  const btn = document.getElementById("langBtn");
  if (btn) {
    btn.textContent =
      currentLang === "ja" ? "Switch to English" : "日本語に切り替える";
  }
  document.querySelectorAll("[data-ja-placeholder]").forEach((el) => {
    el.placeholder = el.getAttribute("data-" + currentLang + "-placeholder");
  });

  updateFilterToggleLabel();
}

// ====================
// 投稿データ取得（キャッシュあり）
// ====================
let cachedPosts = null;
let searchEventsReady = false;
const GITHUB_POSTS_API_URL =
  "https://api.github.com/repos/ykymji2026-3/blog-ykym/contents/posts.json?ref=main";
const isLocalOrigin = ["localhost", "127.0.0.1"].includes(location.hostname);

async function getPosts() {
  // 一度取得したら再利用
  if (cachedPosts) return cachedPosts;

  if (!isLocalOrigin) {
    const res = await fetch(`../posts.json?${Date.now()}`);
    cachedPosts = await res.json();
    return cachedPosts;
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
  cachedPosts = JSON.parse(new TextDecoder("utf-8").decode(bytes));
  return cachedPosts;
}
// 全投稿データ
let allPosts = [];

// -------------------
// 投稿一覧読み込み
// -------------------
async function loadPosts() {
  allPosts = await getPosts();
  const list = document.getElementById("post-list");
  // 管理者なら全部、一般は下書き除外
  const visiblePosts = allPosts.filter((p) => !p.draft);
  list.innerHTML = "";
  setupCategory(visiblePosts); // カテゴリ生成
  filterPosts(); // 一覧表示
}

// ====================
// 投稿一覧描画
// ====================
function renderList(posts, keyword = "") {
  const list = document.getElementById("post-list");
  list.innerHTML = ""; // 一度リセット

  posts.forEach((post) => {
    const li = document.createElement("li");
    li.className = "card";

    const rawTitle = post.title?.[currentLang] || post.title;
    const title = highlight(rawTitle, keyword);
    const image = renderEyecatchImage(getPostImageUrl(post), "post-card-image");

    li.innerHTML = `
      ${image}
      <a href="?id=${post.id}">
        ${post.memberOnly ? "🔒 " : ""}${title}
      </a>
      <div class="meta">${getPostDisplayDate(post)} / ${post.category}</div>
    `;

    list.appendChild(li);
  });
}

// ====================
// 記事詳細描画
// ====================
function renderPost(post) {
  const image = renderEyecatchImage(getPostImageUrl(post), "post-eyecatch");

  return `
    <section>
        <div class="container">
            <!-- タイトル -->
            <h1 class="post-title">
                ${(post.title && post.title[currentLang]) || post.title}
            </h1>

            <!-- メタ情報 -->
            <div class="meta">
                ${getPostDisplayDate(post)} / ${post.category}
            </div>
            ${image}
            <!-- 本文 -->
            <div class="post-content">
              ${
                currentLang === "en"
                  ? post.contentEn || post.content
                  : post.content
              }
            </div>

            <a href="./"
              class="back-btn"
              data-ja="← 戻る"
              data-en="← Back">
              ← 戻る
            </a>
        </div>
    </section>
    `;
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

function renderEyecatchImage(url, className) {
  const safeUrl = getSafeImageUrl(url);
  if (!safeUrl) return "";

  return `<img class="${className}" src="${safeUrl}" alt="" loading="lazy">`;
}

// ====================
// カテゴリ生成
// ====================
function setupCategory(posts) {
  const select = document.getElementById("admin-category-filter");
  if (!select) return;

  const selected = select.value;
  // 重複なしカテゴリ
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];

  // 初期（すべて）
  select.innerHTML = `
    <option value="all">${currentLang === "ja" ? "すべて" : "All"}</option>
  `;

  // カテゴリ追加
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
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

function updateFilterToggleLabel() {
  const toggle = document.getElementById("admin-filter-toggle");
  const panel = document.getElementById("admin-filter-panel");
  if (!toggle || !panel) return;

  const isOpen = !panel.hidden;
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.textContent =
    currentLang === "ja"
      ? isOpen
        ? "詳細検索を非表示"
        : "詳細検索を表示"
      : isOpen
        ? "Hide advanced search"
        : "Show advanced search";
}

// ====================
// 検索＆フィルタ
// ====================
function filterPosts() {
  const keyword = document.getElementById("admin-keyword-filter")?.value.toLowerCase() || "";
  const category = document.getElementById("admin-category-filter")?.value || "all";
  const startDate = getDateInputValue("admin-start-date");
  const endDate = getDateInputValue("admin-end-date", true);
  const resultCount = document.getElementById("result-count");

  let filtered = allPosts
    .filter((p) => !p.draft)
    .filter((post) => {
      // タイトル＆本文検索
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

  // 件数表示
  if (resultCount) {
    resultCount.textContent =
      !keyword && category === "all" && !startDate && !endDate
        ? ""
        : currentLang === "ja"
          ? `${filtered.length}件ヒットしました`
          : `${filtered.length} results found`;
  }

  // 0件の場合はメッセージ表示
  if (filtered.length === 0) {
    const list = document.getElementById("post-list");
    list.innerHTML = `
        <p class="no-result">
          ${currentLang === "ja" ? "該当する記事がありません" : "No posts found"}
        </p>
      `;

    return;
  }

  renderList(filtered, keyword);
}

function highlight(text, keyword) {
  if (!keyword) return text;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");

  return text.replace(regex, '<span class="highlight">$1</span>');
}

// ====================
// イベント登録
// ====================
function setupSearchEvents() {
  if (searchEventsReady) return;
  searchEventsReady = true;

  const toggle = document.getElementById("admin-filter-toggle");
  const panel = document.getElementById("admin-filter-panel");
  const clear = document.getElementById("admin-filter-clear");

  updateFilterToggleLabel();

  toggle?.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    updateFilterToggleLabel();
  });

  document
    .getElementById("admin-keyword-filter")
    ?.addEventListener("input", filterPosts);

  document
    .getElementById("admin-category-filter")
    ?.addEventListener("change", filterPosts);

  document
    .getElementById("admin-start-date")
    ?.addEventListener("change", filterPosts);

  document
    .getElementById("admin-end-date")
    ?.addEventListener("change", filterPosts);

  clear?.addEventListener("click", () => {
    document.getElementById("admin-keyword-filter").value = "";
    document.getElementById("admin-category-filter").value = "all";
    document.getElementById("admin-start-date").value = "";
    document.getElementById("admin-end-date").value = "";
    filterPosts();
  });
}

// -------------------
// 記事詳細表示
// -------------------
async function showPostIfNeeded() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) return;

  const posts = await getPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return;

  const main = document.querySelector("main");

  main.innerHTML = renderPost(post);
  applyLang();
}

// ====================
// 初期処理
// ====================
function initPage() {
  setupSearchEvents();
  applyLang();
  renderCurrentPage();
}

document.addEventListener("components:ready", initPage);
