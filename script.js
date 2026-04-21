let currentLang = localStorage.getItem("lang") || "ja";

function renderCurrentPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (id) {
    showPostIfNeeded();
  } else {
    loadPosts();
  }
}

// 言語切替（今のやつ改良）
function toggleLang() {
  currentLang = currentLang === "ja" ? "en" : "ja";
  localStorage.setItem("lang", currentLang);

  applyLang();
  setupCategory(allPosts); // ←追加
  renderCurrentPage();
}

function applyLang() {
  document.querySelectorAll("[data-ja]").forEach((el) => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });

  const btn = document.getElementById("langBtn");
  btn.textContent =
    currentLang === "ja" ? "Switch to English" : "日本語に切り替える";

  document.getElementById("searchInput").placeholder =
    currentLang === "ja" ? "検索..." : "Search...";
}

let cachedPosts = null;

async function getPosts() {
  if (cachedPosts) return cachedPosts;

  const res = await fetch("posts.json");
  cachedPosts = await res.json();
  return cachedPosts;
}

let allPosts = [];

// -------------------
// JSON読み込み
// -------------------
async function loadPosts() {
  allPosts = await getPosts();

  const list = document.getElementById("post-list");
  list.innerHTML = "";
  renderList(allPosts);
  setupCategory(allPosts);
}

function renderList(posts) {
  const list = document.getElementById("post-list");
  list.innerHTML = "";

  posts.forEach((post) => {
    const li = document.createElement("li");
    li.className = "card";

    const title = (post.title && post.title[currentLang]) || post.title;

    li.innerHTML = `
  <a href="?id=${post.id}">
    ${post.memberOnly ? "🔒 " : ""}${title}
  </a>
  <div class="meta">${post.date} / ${post.category}</div>

<button class="back-btn danger" onclick="deletePost('${post.id}')"
        class="back-btn">
  ${currentLang === "ja" ? "削除" : "Delete"}
</button>
`;

    list.appendChild(li);
  });
}

function renderPost(post) {
  return `
    <section>
        <div class="container">
            <h1 class="post-title">
                ${(post.title && post.title[currentLang]) || post.title}
            </h1>

            <div class="meta">
                ${post.date} / ${post.category}
            </div>

            <div class="post-content">
                ${post.content}
            </div>

            <a href="./"
   class="back-btn"
   data-ja="← 戻る"
   data-en="← Back">
   ← 戻る
</a>

<button class="back-btn danger" onclick="deletePost('${post.id}')"
        class="back-btn">
  ${currentLang === "ja" ? "削除" : "Delete"}
</button>
        </div>
    </section>
    `;
}

async function deletePost(id) {
  if (!confirm(currentLang === "ja" ? "削除しますか？" : "Delete this post?"))
    return;

  await fetch("GASのURL", {
    method: "POST",
    body: JSON.stringify({ id: id }),
  });

  alert(currentLang === "ja" ? "削除しました" : "Deleted");

  location.reload();
}

function setupCategory(posts) {
  const select = document.getElementById("categoryFilter");

  const categories = [...new Set(posts.map((p) => p.category))];

  select.innerHTML = `
    <option value="all">${currentLang === "ja" ? "すべて" : "All"}</option>
  `;

  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

function filterPosts() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;

  let filtered = allPosts.filter((post) => {
    const titleJa = post.title?.ja || "";
    const titleEn = post.title?.en || "";
    const content = post.content || "";

    const matchKeyword =
      titleJa.toLowerCase().includes(keyword) ||
      titleEn.toLowerCase().includes(keyword) ||
      content.toLowerCase().includes(keyword);

    const matchCategory = category === "all" || post.category === category;

    return matchKeyword && matchCategory;
  });

  if (filtered.length === 0) {
    const list = document.getElementById("post-list");
    list.innerHTML = `
      <p style="text-align:center; color:#777; padding:20px;">
        ${currentLang === "ja" ? "該当する記事がありません" : "No posts found"}
      </p>
    `;
    return;
  }

  renderList(filtered);
}

document.getElementById("searchInput").addEventListener("input", filterPosts);
document
  .getElementById("categoryFilter")
  .addEventListener("change", filterPosts);

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

window.onload = () => {
  applyLang();
  renderCurrentPage();
};
