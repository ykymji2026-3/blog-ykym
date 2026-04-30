function getCurrentPostLang() {
  return window.getCurrentLang?.() || localStorage.getItem("lang") || "ja";
}

async function fetchPosts(path = "../posts.json") {
  const cacheBust = Date.now();
  const localUrl = `${path}?${cacheBust}`;
  const isLocalOrigin = ["localhost", "127.0.0.1"].includes(location.hostname);
  const githubUrl = `https://raw.githubusercontent.com/ykymji2026-3/blog-ykym/main/posts.json?${cacheBust}`;

  if (isLocalOrigin) {
    try {
      const githubRes = await fetch(githubUrl);
      if (githubRes.ok) {
        return githubRes.json();
      }
    } catch (error) {
      console.warn("GitHubの投稿一覧を取得できませんでした。ローカルのposts.jsonを読み込みます。", error);
    }
  }

  const localRes = await fetch(localUrl);
  if (!localRes.ok) {
    throw new Error("投稿一覧を取得できませんでした。");
  }
  return localRes.json();
}

function getPostIdFromQuery() {
  return new URLSearchParams(location.search).get("id");
}

function getPostTitle(post) {
  const lang = getCurrentPostLang();
  return post.title?.[lang] || post.title?.ja || post.title || "";
}

function getPostContent(post) {
  return getCurrentPostLang() === "en"
    ? post.contentEn || post.content || ""
    : post.content || "";
}

function getGoogleDriveFileId(url) {
  if (url.hostname !== "drive.google.com") return "";

  const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (filePathMatch) return filePathMatch[1];

  return url.searchParams.get("id") || "";
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

function getPostImageUrl(post) {
  const candidates = [
    post.imageUrl,
    post.eyecatchImageUrl,
    post.thumbnailUrl,
    post.imageURL,
    post.image,
    post.images,
    post.thumbnail,
    post.cover,
    post.coverImage,
    post["アイキャッチ画像URL"],
    post["画像URL"],
  ];

  for (const candidate of candidates) {
    const url = normalizeImageCandidate(candidate);
    if (url) return url;
  }

  return "";
}

function normalizeImageCandidate(candidate) {
  if (!candidate) return "";

  if (typeof candidate === "string") {
    return candidate;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const url = normalizeImageCandidate(item);
      if (url) return url;
    }
    return "";
  }

  if (typeof candidate === "object") {
    return (
      candidate.url ||
      candidate.src ||
      candidate.href ||
      candidate.link ||
      candidate.imageUrl ||
      candidate.image ||
      ""
    );
  }

  return "";
}

function parsePostDate(dateText) {
  if (!dateText) return null;
  const [datePart, timePart = "00:00"] = dateText.split(" ");
  const [year, month, day] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour || 0, minute || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPostDate(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("/") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getPostDisplayDate(post) {
  const parsed = parsePostDate(post.date);
  if (parsed && parsed.getFullYear() >= 2000) return post.date;

  const dateFromId = new Date(Number(post.id));
  if (Number.isNaN(dateFromId.getTime())) return post.date || "";

  return formatPostDate(dateFromId);
}

function renderPostImage(post, className) {
  const safeUrl = getSafeImageUrl(getPostImageUrl(post));
  if (!safeUrl) return "";

  return `<img class="${className}" src="${safeUrl}" alt="" loading="lazy">`;
}

function renderPostDetail(post, options = {}) {
  const imageClass = options.imageClass || "post-eyecatch";
  const backHref = options.backHref || "./";
  const actions = options.actions || "";

  return `
    <section>
      <div class="container">
        <h1 class="post-title">${getPostTitle(post)}</h1>
        <div class="meta">${getPostDisplayDate(post)} / ${post.category || ""}</div>
        ${renderPostImage(post, imageClass)}
        <div class="post-content">${getPostContent(post)}</div>
        ${actions}
        <a href="${backHref}" class="back-btn" data-ja="← 戻る" data-en="← Back">← 戻る</a>
      </div>
    </section>
  `;
}

window.BlogPosts = {
  fetchPosts,
  getPostIdFromQuery,
  getPostTitle,
  getPostContent,
  getPostImageUrl,
  getPostDisplayDate,
  renderPostImage,
  renderPostDetail,
};
