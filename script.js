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
  renderCurrentPage();
}

function applyLang() {
  document.querySelectorAll("[data-ja]").forEach((el) => {
    el.textContent = el.getAttribute("data-" + currentLang);
  });

  const btn = document.getElementById("langBtn");
  btn.textContent =
    currentLang === "ja" ? "Switch to English" : "日本語に切り替える";
}

let cachedPosts = null;

async function getPosts() {
  if (cachedPosts) return cachedPosts;

  const res = await fetch("posts.json");
  cachedPosts = await res.json();
  return cachedPosts;
}

// -------------------
// JSON読み込み
// -------------------
async function loadPosts() {
  const posts = await getPosts();

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
        </div>
    </section>
    `;
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
}

window.onload = () => {
  applyLang();
  renderCurrentPage();
};
