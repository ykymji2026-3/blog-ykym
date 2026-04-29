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
  // 検索バーのプレースホルダ変更
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.placeholder = currentLang === "ja" ? "検索..." : "Search...";
  }
}

// ====================
// 投稿データ取得（キャッシュあり）
// ====================
let cachedPosts = null;

async function getPosts() {
  // 一度取得したら再利用
  if (cachedPosts) return cachedPosts;

  const res = await fetch("posts.json");
  cachedPosts = await res.json();
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
  renderList(visiblePosts); // 一覧表示
  setupCategory(visiblePosts); // カテゴリ生成
}

// ====================
// 投稿一覧描画
// ====================
function renderList(posts) {
  const list = document.getElementById("post-list");
  list.innerHTML = ""; // 一度リセット

  posts.forEach((post) => {
    const li = document.createElement("li");
    li.className = "card";

    const rawTitle = post.title?.[currentLang] || post.title;
    const title = highlight(rawTitle, keyword = "");

    li.innerHTML = `
      <a href="?id=${post.id}">
        ${post.memberOnly ? "🔒 " : ""}${title}
      </a>
      <div class="meta">${post.date} / ${post.category}</div>
    `;

    list.appendChild(li);
  });
}

// ====================
// 記事詳細描画
// ====================
function renderPost(post) {
  return `
    <section>
        <div class="container">
            <!-- タイトル -->
            <h1 class="post-title">
                ${(post.title && post.title[currentLang]) || post.title}
            </h1>

            <!-- メタ情報 -->
            <div class="meta">
                ${post.date} / ${post.category}
            </div>
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

// ====================
// カテゴリ生成
// ====================
function setupCategory(posts) {
  const select = document.getElementById("categoryFilter");
  if (!select) return;

  // 重複なしカテゴリ
  const categories = [...new Set(posts.map((p) => p.category))];

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
}

// ====================
// 検索＆フィルタ
// ====================
function filterPosts() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const resultCount = document.getElementById("result-count");

  // 空検索 → 全件表示＋件数消す
  if (!keyword) {
    const visible = allPosts.filter((p) => !p.draft);
    renderList(visible);
    resultCount.textContent = "";
    return;
  }

  let filtered = allPosts
    .filter((p) => !p.draft)
    .filter((post) => {
      // タイトル＆本文検索
      const titleJa = post.title?.ja || "";
      const titleEn = post.title?.en || "";
      const content = post.content || "";
      const contentEn = post.contentEn || "";

      const matchKeyword =
        titleJa.toLowerCase().includes(keyword) ||
        titleEn.toLowerCase().includes(keyword) ||
        content.toLowerCase().includes(keyword) ||
        contentEn.toLowerCase().includes(keyword);

      const matchCategory = category === "all" || post.category === category;

      return matchKeyword && matchCategory;
    });

  // 件数表示
  resultCount.textContent =
    currentLang === "ja"
      ? `${filtered.length}件ヒットしました`
      : `${filtered.length} results found`;

  // 0件の場合はメッセージ表示
  if (filtered.length === 0) {
    const list = document.getElementById("post-list");
    list.innerHTML = `
        <p style="text-align:center; color:#777; padding:20px;">
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
document.getElementById("searchInput")?.addEventListener("input", filterPosts);

document
  .getElementById("categoryFilter")
  ?.addEventListener("change", filterPosts);

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
window.onload = () => {
  applyLang();
  renderCurrentPage();
};
