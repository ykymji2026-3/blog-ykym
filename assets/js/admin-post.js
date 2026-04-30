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
const isLocalOrigin = ["localhost", "127.0.0.1"].includes(location.hostname);
const GAS_ENDPOINT = isLocalOrigin ? "http://localhost:8001/api/gas" : GAS_URL;
let adminPostPageReady = false;

function t(ja, en) {
  return window.getCurrentLang?.() === "en" ? en : ja;
}

function applyAdminHeader() {
  const headerDescription = document.querySelector("header p");
  if (!headerDescription) return;

  headerDescription.setAttribute("data-ja", "管理画面");
  headerDescription.setAttribute("data-en", "Admin");
  headerDescription.textContent = t("管理画面", "Admin");
}

function getCurrentUser() {
  if (!auth.currentUser) {
    throw new Error("ログイン状態を確認できません。もう一度ログインしてください。");
  }
  return auth.currentUser;
}

async function sendGasAction(payload) {
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  const result = await res.json();

  if (!res.ok || !result.success) {
    throw new Error(result.error || "処理できませんでした。");
  }

  return result;
}

async function deletePost(id) {
  if (!confirm(t("本当に削除されますか？", "Are you sure you want to delete this post?"))) return;

  try {
    const token = await getCurrentUser().getIdToken();
    await sendGasAction({ action: "delete", id, idToken: token });
    window.showToast?.(t("削除しました", "Deleted"));
    location.href = "./";
  } catch (error) {
    console.error("削除失敗", error);
    window.showToast?.(t("削除できませんでした: ", "Could not delete: ") + error.message);
  }
}

function editPost() {
  window.showToast?.(t("編集機能は準備中です。", "Edit is not ready yet."));
}

async function renderAdminPostDetail() {
  const main = document.getElementById("admin-post-main");
  const id = window.BlogPosts.getPostIdFromQuery();

  if (!id) {
    main.innerHTML = `<div class="container"><p class="no-result">${t("投稿IDがありません。", "Post ID is missing.")}</p></div>`;
    return;
  }

  try {
    const posts = await window.BlogPosts.fetchPosts("../posts.json");
    const post = posts.find((item) => item.id === id);

    if (!post) {
      main.innerHTML = `<div class="container"><p class="no-result">${t("投稿が見つかりません。", "Post not found.")}</p></div>`;
      return;
    }

    const actions = `
      <div class="form-actions admin-detail-actions">
        <button class="btn" type="button" onclick="editPost('${post.id}')">
          ${t("編集", "Edit")}
        </button>
        <button class="btn danger" type="button" onclick="deletePost('${post.id}')">
          ${t("削除", "Delete")}
        </button>
      </div>
    `;

    main.innerHTML = window.BlogPosts.renderPostDetail(post, {
      backHref: "./",
      imageClass: "admin-eyecatch",
      actions
    });
    window.applyLang?.();
  } catch (error) {
    console.error(error);
    main.innerHTML = `<div class="container"><p class="no-result">${t("投稿を読み込めませんでした。", "Could not load this post.")}</p></div>`;
  }
}

function initAdminPostPage() {
  if (adminPostPageReady) return;
  adminPostPageReady = true;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.href = "../auth/login.html";
      return;
    }

    document.getElementById("admin-post-content").hidden = false;
    applyAdminHeader();
    renderAdminPostDetail();
  });
}

function logout() {
  signOut(auth)
    .then(() => {
      location.href = "../auth/login.html";
    })
    .catch((error) => {
      console.error("ログアウト失敗", error);
    });
}

window.deletePost = deletePost;
window.editPost = editPost;
window.logout = logout;

document.addEventListener("components:ready", initAdminPostPage);
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initAdminPostPage, 0);
});
document.addEventListener("language:changed", applyAdminHeader);
