// 予約投稿シートを定期的に確認し、
// 公開日時を過ぎた投稿を posts.json に追加するための関数です。
function processScheduledPosts() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("予約投稿");

  // シート内の全行を取得します。
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return; // ヘッダーのみ

  const now = new Date();

  // 上から処理（削除するので逆順が安全）
  // 行を削除しながら処理するため、下の行から上へ向かって確認します。
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    // 予約公開日時をDate型に変換します。
    const publishAt = new Date(row[0]);

    // 時間来てる？
    // 現在時刻を過ぎていたら、投稿として公開します。
    if (publishAt <= now) {

      // フォーム形式に変換
      // onFormSubmit はフォーム送信時の形を期待しているため、
      // 予約投稿の行データをフォーム送信データのような形に作り直します。
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
      // 通常のフォーム投稿と同じ処理を使って、posts.json へ追加します。
      onFormSubmit(fakeEvent, true);

      // フラグ付け
      // 処理済みであることが分かるようにシートへ印を付けます。
      sheet.getRange(i + 1, 6).setValue("done");

      // 行削除
      // 公開済みの予約投稿はシートから削除します。
      sheet.deleteRow(i);
    }
  }
}
