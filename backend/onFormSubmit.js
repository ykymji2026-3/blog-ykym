function onFormSubmit(e, isScheduled = false) {

  // ====================
  // 入力取得
  // ====================
  const data = e.values;
  if (!data) return;

  function normalizeFormKey(value) {
    return String(value || "")
      .replace(/\s/g, "")
      .replace(/[：:]/g, "")
      .toLowerCase();
  }

  function getNamedFormValue(names) {
    if (!e.namedValues) return "";

    const normalizedNames = names.map(normalizeFormKey);
    for (const name of names) {
      const value = e.namedValues[name];
      if (value && value[0]) return value[0];
    }

    for (const key in e.namedValues) {
      const normalizedKey = normalizeFormKey(key);
      const matched = normalizedNames.some((name) => {
        return normalizedKey === name || normalizedKey.includes(name) || name.includes(normalizedKey);
      });
      if (!matched) continue;

      const value = e.namedValues[key];
      if (value && value[0]) return value[0];
    }

    return "";
  }

  function findFirstUrlValue() {
    for (let i = 1; i < data.length; i++) {
      const value = String(data[i] || "").trim();
      if (/^https?:\/\//i.test(value)) return value;
    }

    return "";
  }

  function parseValidDate(value) {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() < 2000) return null;

    return date;
  }

  function getFallbackImageUrl() {
    const columnValue = String(data[7] || "").trim();
    if (/^https?:\/\//i.test(columnValue)) return columnValue;

    return findFirstUrlValue();
  }

  const title = getNamedFormValue(["タイトル", "題名", "投稿タイトル", "Title"]) || data[1];
  const content = getNamedFormValue(["本文", "内容", "投稿本文", "Content"]) || data[2] || "";
  const formattedContent = content.replace(/\n/g, "<br>");
  const category =
    getNamedFormValue(["カテゴリ", "カテゴリー", "分類", "Category"]) ||
    data[3] ||
    "未分類";
  const publishAtValue =
    getNamedFormValue([
      "公開日時",
      "公開日",
      "投稿日時",
      "投稿日",
      "予約日時",
      "予約投稿日時",
      "Publish At",
      "Publish date"
    ]) ||
    data[4];
  const validPublishAt = parseValidDate(publishAtValue);
  const status =
    getNamedFormValue(["ステータス", "状態", "公開状態", "投稿状態", "Status"]) ||
    data[5] ||
    "";
  const memberOnlyValue =
    getNamedFormValue(["会員限定", "メンバー限定", "限定公開", "memberOnly", "Member only"]) ||
    data[6];
  const imageUrl =
    getNamedFormValue([
      "アイキャッチ画像URL",
      "アイキャッチ画像 URL",
      "アイキャッチURL",
      "アイキャッチ URL",
      "アイキャッチ",
      "画像URL",
      "画像 URL",
      "画像",
      "Eyecatch Image URL",
      "Image URL"
    ]) ||
    getFallbackImageUrl() ||
    "";

  const isDraft = status === "下書き";
  const isMemberOnly = memberOnlyValue === "はい" || memberOnlyValue === true || memberOnlyValue === "true";

  const now = new Date();

  // ====================
  // 英訳
  // ====================
  function translateToEnglish(text) {
    if (!text) return "";
    return LanguageApp.translate(text, "ja", "en");
  }

  // 予約投稿（まだ時間前ならシートに保存）
  if (!isScheduled && validPublishAt && validPublishAt > now && !isDraft) {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("予約投稿");

    sheet.appendRow([
      validPublishAt,
      title,
      content,
      category,
      status,
      isMemberOnly ? "はい" : "いいえ",
      imageUrl
    ]);

    return;
  }

  // 「予約」ステータスは通常投稿では処理しない
  if (status === "予約" && !isScheduled) return;

  
  const translatedTitle = isDraft ? "" : translateToEnglish(title);
  const translatedContent = translateToEnglish(content).replace(/\n/g, "<br>");

  // ====================
  // 投稿データ生成
  // ====================
  const newPost = {
    id: Date.now().toString(),
    title: {
      ja: title,
      en: translatedTitle
    },
    content: formattedContent,
    contentEn: translatedContent,
    date: Utilities.formatDate(
      validPublishAt || now,
      Session.getScriptTimeZone(),
      "yyyy/MM/dd HH:mm"
    ),
    category: category,
    memberOnly: isMemberOnly,
    imageUrl: imageUrl,
    draft: isDraft
  };

  // ====================
  // GitHub設定
  // ====================
  const repo = "ykymji2026-3/blog-ykym";

  const token = PropertiesService
    .getScriptProperties()
    .getProperty("GITHUB_TOKEN");

  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;


  // ====================
  // ① 現在のJSON取得
  // ====================
  const file = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const fileData = JSON.parse(file.getContentText());

  let posts = [];

  try {
    const decoded = Utilities.newBlob(
      Utilities.base64Decode(fileData.content)
    ).getDataAsString("UTF-8");

    posts = JSON.parse(decoded);

    if (!Array.isArray(posts)) posts = [];

  } catch (e) {
    console.log("JSON壊れてるので初期化");
    posts = [];
  }

  // ====================
  // ② 投稿追加
  // ====================
  posts.unshift(newPost);

  console.log("投稿後の記事数:", posts.length);


  // ====================
  // ③ GitHub更新
  // ====================
  UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({
      message: "add post",
      content: Utilities.base64Encode(
        Utilities.newBlob(
          JSON.stringify(posts, null, 2),
          "application/json"
        ).getBytes()
      ),
      sha: fileData.sha
    })
  });
}
