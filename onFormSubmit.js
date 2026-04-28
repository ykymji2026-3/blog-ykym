function onFormSubmit(e, isScheduled = false) {

  // ====================
  // 入力取得
  // ====================
  const data = e.values;
  if (!data) return;

  const title = data[1];
  const content = data[2];
  const formattedContent = content.replace(/\n/g, "<br>");
  const category = data[3] || "未分類";
  const publishAt = data[4] ? new Date(data[4]) : null;
  const status = data[5];

  const isDraft = status === "下書き";
  const isMemberOnly = data[6] === "はい";

  const now = new Date();

  // ====================
  // 英訳
  // ====================
  function translateToEnglish(text) {
    if (!text) return "";
    return LanguageApp.translate(text, "ja", "en");
  }

  // 予約投稿（まだ時間前ならシートに保存）
  if (!isScheduled && publishAt && publishAt > now && !isDraft) {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("予約投稿");

    sheet.appendRow([
      publishAt,
      title,
      content,
      category,
      status
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
      publishAt || now,
      Session.getScriptTimeZone(),
      "yyyy/MM/dd HH:mm"
    ),
    category: category,
    memberOnly: isMemberOnly,
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