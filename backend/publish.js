const ADMIN_UIDS = ["xw7jxiwGEWX22oIHw9DXt4wTaJB2"];

// 管理画面からPOSTリクエストが送られたときに呼ばれます。
// 投稿の削除や下書きの公開など、管理者操作を受け付けます。
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const idToken = body.idToken;

  // Firebaseのログイン情報を確認し、管理者だけが操作できるようにします。
  if (!verifyIdToken(idToken)) {
    return jsonOutput({ error: "unauthorized" });
  }

  // action の値によって、削除するか公開するかを分けています。
  if (body.action === "delete") {
    return deletePostById(body.id);
  }
  if (body.action === "publish") {
    return publishPostById(body.id);
  }

  return jsonOutput({ error: "unknown action" });
}

// Apps ScriptからJSON形式のレスポンスを返すための共通関数です。
// callback がある場合はJSONP形式でも返せるようにしています。
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

// FirebaseのIDトークンを確認し、ログイン中のユーザーが管理者かどうか判定します。
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

// 管理画面からGETリクエストが送られたときに呼ばれます。
// 現在は予約投稿一覧の取得に使っています。
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

// posts.json から指定されたIDの投稿を削除します。
function deletePostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";
  const token =
    PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  // 1. posts.json を取得
  // GitHub上の現在の投稿一覧を読み込みます。
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
  // 指定されたID以外の投稿だけを残します。
  const filtered = posts.filter((p) => p.id !== postId);

  if (filtered.length === posts.length) {
    return jsonOutput({ success: false, error: "post not found" });
  }

  // 3. GitHub に更新
  // 削除後の投稿一覧をGitHubへ保存し直します。
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

// スプレッドシートの「予約投稿」シートから、予約中の投稿を一覧にして返します。
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

// 下書き状態の投稿を公開状態に変更します。
function publishPostById(postId) {
  const repo = "ykymji2026-3/blog-ykym";
  const token =
    PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${repo}/contents/posts.json`;

  // 1. posts.json を取得
  // 公開したい投稿を探すため、現在の posts.json を読み込みます。
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
  // 対象投稿の draft を false にして、公開済みにします。
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
  // 公開状態に変更した投稿一覧をGitHubへ保存します。
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
