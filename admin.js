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

async function loadAdminPosts() {
  const res = await fetch("posts.json?" + Date.now());
  const posts = await res.json();

  const draftList = document.getElementById("draft-list");
  const postList = document.getElementById("admin-post-list");

  draftList.innerHTML = "";
  postList.innerHTML = "";

  posts.forEach((post) => {
    const title = post.title?.ja || post.title;

    // 下書き
    if (post.draft) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="card">
          <strong>${title}</strong>
          <button class="danger" onclick="publishPost('${post.id}')">公開</button>
        </div>
      `;
      draftList.appendChild(li);
    }

    // 全投稿
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="card-row">

        <!-- クリックエリア -->
        <div class="card-content" onclick="togglePost('${post.id}')">
          <strong>${title}</strong>
        </div>

        <!-- 削除ボタン -->
        <div class="card-actions">
          <button class="danger" onclick="event.stopPropagation(); deletePost('${post.id}')">
            削除
          </button>
        </div>
      </div>

      <!-- 展開部分 -->
      <div id="content-${post.id}" class="detail">
        ${post.content}
      </div>
    `;
    postList.appendChild(li);
  });
}

async function deletePost(id) {
  if (!confirm("本当に削除されますか？")) return;

  const token = await auth.currentUser.getIdToken();
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id, idToken: token })
  });

  if (res.ok) {
    await loadAdminPosts();
  } else {
    alert("削除できませんでした。");
  }
}

async function loadScheduledPosts() {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${GAS_URL}?action=listScheduled&idToken=${encodeURIComponent(token)}`);
    
  if (!res.ok) {
    console.error("スケジュール取得失敗");
    return;
  }
  const posts = await res.json();

  const list = document.getElementById("scheduled-list");
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
}

function initAdminPage() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById("admin-content").style.display = "block";
      loadAdminPosts();
      loadScheduledPosts();
    } else {
      location.href = "login/";
    }
  });
}

document.addEventListener("DOMContentLoaded", initAdminPage);


async function publishPost(id) {
  const token = await auth.currentUser.getIdToken();

  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", id, idToken: token })
  });

  if (res.ok) {
    alert("公開しました");
    await loadAdminPosts();
  } else {
    alert("公開失敗");
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
