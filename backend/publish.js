const ADMIN_UIDS = ["xw7jxiwGEWX22oIHw9DXt4wTaJB2"];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const idToken = body.idToken;

  if (!verifyIdToken(idToken)) {
    return jsonOutput({ error: "unauthorized" });
  }

  if (body.action === "delete") {
    return deletePostById(body.id);
  }
  if (body.action === "publish") {
    return publishPostById(body.id);
  }

  return jsonOutput({ error: "unknown action" });
}

function jsonOutput(data, callback) {
  const json = JSON.stringify(data);

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${json});`).setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }

  return ContentService.createTextOutput(json).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function verifyIdToken(idToken) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("FIREBASE_API_KEY");
  const res = UrlFetchApp.fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true,
    },
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
  const callback = e.parameter.callback;

  if (!verifyIdToken(idToken)) {
    return jsonOutput({ error: "unauthorized" }, callback);
  }

  const action = e.parameter.action;
  if (action === "listScheduled") {
    return getScheduledPosts(callback);
  }

  return jsonOutput({ error: "unknown action" }, callback);
}

function deletePostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";
  const token =
    PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  // 1. posts.json を取得
  const fileRes = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    contentType: "application/json",
    muteHttpExceptions: true,
  });

  if (fileRes.getResponseCode() !== 200) {
    return jsonOutput({ error: "failed to fetch file" });
  }

  const fileData = JSON.parse(fileRes.getContentText());
  const posts = JSON.parse(
    Utilities.newBlob(
      Utilities.base64Decode(fileData.content),
    ).getDataAsString(),
  );

  // 2. 該当記事を削除
  const filtered = posts.filter((p) => p.id !== postId);

  if (filtered.length === posts.length) {
    return jsonOutput({ success: false, error: "post not found" });
  }

  // 3. GitHub に更新
  const updateRes = UrlFetchApp.fetch(url, {
    method: "put",
    headers: { Authorization: "Bearer " + token },
    contentType: "application/json",
    payload: JSON.stringify({
      message: `Delete post ${postId}`,
      content: Utilities.base64Encode(JSON.stringify(filtered, null, 2)),
      sha: fileData.sha,
    }),
    muteHttpExceptions: true,
  });

  if (![200, 201].includes(updateRes.getResponseCode())) {
    return jsonOutput({
      success: false,
      error: `github update failed: ${updateRes.getResponseCode()}`,
      detail: updateRes.getContentText(),
    });
  }

  return jsonOutput({ success: true, deletedId: postId });
}

function getScheduledPosts(callback) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("予約投稿");

  const data = sheet.getDataRange().getValues();

  const posts = data.slice(1).map((row) => ({
    publishAt: row[0],
    title: row[1],
    category: row[3],
    status: row[4],
    memberOnly: row[5],
    imageUrl: row[6],
  }));

  return jsonOutput(posts, callback);
}

function publishPostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";
  const token =
    PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  // 1. posts.json を取得
  const fileRes = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });

  if (fileRes.getResponseCode() !== 200) {
    return jsonOutput({ error: "failed to fetch file" });
  }

  const fileData = JSON.parse(fileRes.getContentText());
  const posts = JSON.parse(
    Utilities.newBlob(
      Utilities.base64Decode(fileData.content),
    ).getDataAsString(),
  );

  // 2. 該当記事を公開（draft フラグ削除）
  let found = false;
  const updated = posts.map((p) => {
    if (p.id === postId) {
      found = true;
      p.draft = false;
      p.publishedAt = new Date().toISOString();
    }
    return p;
  });

  if (!found) {
    return jsonOutput({ success: false, error: "post not found" });
  }

  // 3. GitHub に更新
  const updateRes = UrlFetchApp.fetch(url, {
    method: "put",
    headers: { Authorization: "Bearer " + token },
    contentType: "application/json",
    payload: JSON.stringify({
      message: `Publish post ${postId}`,
      content: Utilities.base64Encode(JSON.stringify(updated, null, 2)),
      sha: fileData.sha,
    }),
    muteHttpExceptions: true,
  });

  if (![200, 201].includes(updateRes.getResponseCode())) {
    return jsonOutput({
      success: false,
      error: `github update failed: ${updateRes.getResponseCode()}`,
      detail: updateRes.getContentText(),
    });
  }

  return jsonOutput({ success: true, publishedId: postId });
}
