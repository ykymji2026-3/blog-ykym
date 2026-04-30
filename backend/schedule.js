function processScheduledPosts() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("予約投稿");

  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return; // ヘッダーのみ

  const now = new Date();

  // 上から処理（削除するので逆順が安全）
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    const publishAt = new Date(row[0]);

    // 時間来てる？
    if (publishAt <= now) {

      // フォーム形式に変換
      const fakeEvent = {
        values: [
          "",
          row[1], // title
          row[2], // content
          row[3], // category
          row[0], // publishAt
          row[4], // status
          row[5], // memberOnly
          row[6]  // imageUrl
        ]
      };

      // 投稿実行（ここがキモ）
      onFormSubmit(fakeEvent, true);

      // フラグ付け
      sheet.getRange(i + 1, 6).setValue("done");

      // 行削除
      sheet.deleteRow(i);
    }
  }
}
