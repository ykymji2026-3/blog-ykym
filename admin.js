const GAS_URL = "https://script.google.com/macros/s/AKfycbzx6uh9fJPU4GysqK6DetNMf2W6Bf0oXI6P9p3GxipOCgglgg5IpbUfKdaPY6kng5iZ/exec";

async function loadAdminPosts() {
  const res = await fetch("posts.json");
  const posts = await res.json();
  
  const draftList = document.getElementById("draft-list");
  const postList = document.getElementById("admin-post-list");

  draftList.innerHTML = "";
  postList.innerHTML = "";

  posts.forEach(post => {

    const title = post.title?.ja || post.title;

    // 下書き
    if (post.draft) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="card">
          <strong>${title}</strong>
          <button onclick="publishPost('${post.id}')">公開</button>
        </div>
      `;
      draftList.appendChild(li);
    }

    // 全投稿
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="card">
        <strong>${title}</strong>
        <button onclick="deletePost('${post.id}')">削除</button>
      </div>
    `;
    postList.appendChild(li);

  });
}

async function deletePost(id) {
  const password = localStorage.getItem("adminPass");

  if (!confirm("削除する？")) return;

  await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      id: id,
      password: password
    })
  });

  alert("削除しました");
  loadAdminPosts();
}

async function loadScheduledPosts() {
  const res = await fetch(GAS_URL + "?action=listScheduled")
  const posts = await res.json();

  const list = document.getElementById("scheduled-list");
  list.innerHTML = "";

  posts.forEach(post => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="card">
        ${post.title} / ${post.publishAt}
      </div>
    `;
    list.appendChild(li);
  });
}

window.onload = () => {
  const saved = localStorage.getItem("adminPass");

  if (saved) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-content").style.display = "block";

    loadAdminPosts();
    loadScheduledPosts();
  }
};

async function login() {
  const password = document.getElementById("passwordInput").value;

  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      password: password
    })
  });

  const data = await res.json();

  if (data.success) {

    // ✅ ここに追加
    localStorage.setItem("adminPass", password);

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-content").style.display = "block";

    loadAdminPosts();
    loadScheduledPosts();

  } else {
    alert("パスワードが違います");
  }
}

async function publishPost(id) {
  const password = localStorage.getItem("adminPass");

  await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "publish",
      id: id,
      password: password
    })
  });

  alert("公開しました");
  loadAdminPosts();
}