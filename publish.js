const ADMIN_UIDS = ["uid1", "uid2"];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const idToken = body.idToken;

  if (!verifyIdToken(idToken)) {
    return ContentService.createTextOutput(JSON.stringify({ error: "unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === "delete") {
    return deletePostById(body.id);
  }
  if (body.action === "publish") {
    return publishPostById(body.id);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyIdToken(idToken) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_API_KEY");
  const res = UrlFetchApp.fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 200) return false;

  const data = JSON.parse(res.getContentText());
  if (!Array.isArray(data.users) || data.users.length === 0) return false;

  const user = data.users[0];
  const claims = JSON.parse(user.customAttributes || "{}");
  return claims.admin === true || ADMIN_UIDS.includes(user.localId);
}

function doGet(e) {
  const idToken = e.parameter.idToken;
  
  if (!verifyIdToken(idToken)) {
    return ContentService.createTextOutput(JSON.stringify({ error: "unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = e.parameter.action;
  if (action === "listScheduled") {
    return getScheduledPosts();  // proper response
  }
}

function deletePostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";
  Logger.log("DELETE実行: " + postId);

  const token = PropertiesService
    .getScriptProperties()
    .getProperty("GITHUB_TOKEN");

  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  const file = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const fileData = JSON.parse(file.getContentText());

  const decoded = Utilities.newBlob(
    Utilities.base64Decode(fileData.content)
  ).getDataAsString("UTF-8");

  let posts = JSON.parse(decoded);

  // 削除
  posts = posts.filter(post => post.id !== postId);

  // 更新
  UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({
      message: "delete post",
      content: Utilities.base64Encode(
        Utilities.newBlob(JSON.stringify(posts, null, 2)).getBytes()
      ),
      sha: fileData.sha
    })
  });

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getScheduledPosts() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("予約投稿");

  const data = sheet.getDataRange().getValues();

  const posts = data.slice(1).map(row => ({
    publishAt: row[0],
    title: row[1]
  }));

  return ContentService
    .createTextOutput(JSON.stringify(posts))
    .setMimeType(ContentService.MimeType.JSON);
}

function publishPostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";

  const token = PropertiesService
    .getScriptProperties()
    .getProperty("GITHUB_TOKEN");

  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  // ====================
  // ① 取得
  // ====================
  const file = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const fileData = JSON.parse(file.getContentText());

  const decoded = Utilities.newBlob(
    Utilities.base64Decode(fileData.content)
  ).getDataAsString("UTF-8");

  let posts = [];

  try {
    posts = JSON.parse(decoded);
    if (!Array.isArray(posts)) posts = [];
  } catch (e) {
    posts = [];
  }

  // ====================
  // ② draft → false
  // ====================
  posts = posts.map(post => {
    if (post.id === postId) {
      post.draft = false;
    }
    return post;
  });

  // ====================
  // ③ 更新
  // ====================
  UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify({
      message: "publish post",
      content: Utilities.base64Encode(
        Utilities.newBlob(
          JSON.stringify(posts, null, 2),
          "application/json"
        ).getBytes()
      ),
      sha: fileData.sha
    })
  });

  // ====================
  // ④ レスポンス
  // ====================
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}