function onFormSubmit(e, isScheduled = false) {

  // Googleフォームが送信されたときに最初に呼ばれる関数です。
  // e にはフォームに入力された値が入っています。
  // isScheduled は、予約投稿から呼ばれたかどうかを表します。

  // ====================
  // 入力取得
  // ====================
  const data = e.values;
  if (!data) return;

  // フォーム項目名を比較しやすくするため、
  // 空白や「:」を取り除いて小文字にします。
  function normalizeFormKey(value) {
    return String(value || "")
      .replace(/\s/g, "")
      .replace(/[：:]/g, "")
      .toLowerCase();
  }

  // フォームの「項目名」から値を探します。
  // 例: 「タイトル」「投稿タイトル」「Title」のどれでも同じ値として扱えます。
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

  // フォームの全入力欄から、最初に見つかったURLを探します。
  // 画像URLの項目名が多少違っても拾えるようにする保険です。
  function findFirstUrlValue() {
    for (let i = 1; i < data.length; i++) {
      const value = extractUrl(data[i]);
      if (value) return value;
    }

    return "";
  }

  // 文字列・配列・オブジェクトの中からURLだけを取り出します。
  // Googleフォームや別サービスの入力形式が変わっても対応しやすくしています。
  function extractUrl(value) {
    if (!value) return "";

    if (typeof value === "string") {
      const trimmed = value.trim();
      const match = trimmed.match(/https?:\/\/\S+/i);
      return match ? match[0] : "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const url = extractUrl(item);
        if (url) return url;
      }
      return "";
    }

    if (typeof value === "object") {
      return (
        extractUrl(value.url) ||
        extractUrl(value.src) ||
        extractUrl(value.href) ||
        extractUrl(value.link) ||
        extractUrl(value.imageUrl) ||
        extractUrl(value.image)
      );
    }

    return "";
  }

  // 入力された日付が使える日付かどうかを確認します。
  // 1970年などの不正な日付は無効扱いにします。
  function parseValidDate(value) {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() < 2000) return null;

    return date;
  }

  // 画像URL専用の欄から取れなかった場合に、
  // 予備としてフォーム内のURLを探します。
  function getFallbackImageUrl() {
    const columnValue = extractUrl(data[7]);
    if (columnValue) return columnValue;

    return findFirstUrlValue();
  }

  // フォームから投稿に必要な値を取り出します。
  // 項目名で取れなかった場合は、列番号 data[1] などを予備として使います。
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
      "imageUrl",
      "image",
      "thumbnailUrl",
      "thumbnail",
      "coverImage",
      "cover",
      "Eyecatch Image URL",
      "Eyecatch URL",
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
  // 日本語のタイトルや本文を英語に翻訳します。
  // Google Apps Script の LanguageApp を使っています。
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
  // posts.json に保存する1件分の投稿データを作ります。
  // image と imageUrl の両方に入れることで、表示側がどちらでも使えるようにしています。
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
    image: imageUrl,
    imageUrl: imageUrl,
    draft: isDraft
  };

  // ====================
  // GitHub設定
  // ====================
  // 投稿データはGitHub上の posts.json に保存します。
  const repo = "ykymji2026-3/blog-ykym";

  // GitHubに書き込むための秘密トークンをApps Scriptのプロパティから取得します。
  const token = PropertiesService
    .getScriptProperties()
    .getProperty("GITHUB_TOKEN");

  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;


  // ====================
  // ① 現在のJSON取得
  // ====================
  // まず現在の posts.json をGitHubから読み込みます。
  // 既存投稿を消さずに、新しい投稿を先頭へ追加するためです。
  const file = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const fileData = JSON.parse(file.getContentText());

  let posts = [];

  // GitHub APIから返るファイル内容はbase64形式なので、
  // 普通のJSON文字列に戻してから配列として読み込みます。
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
  // 新しい投稿を配列の先頭に追加します。
  // 先頭に入れることで、新しい投稿ほど一覧の上に表示されます。
  posts.unshift(newPost);

  console.log("投稿後の記事数:", posts.length);


  // ====================
  // ③ GitHub更新
  // ====================
  // 追加後の投稿一覧を、もう一度 posts.json としてGitHubへ保存します。
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
