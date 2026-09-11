# 05. 使っていないはずのバックエンド URL が 200 を返す

- **日付/場所**: 2026-08-21（セキュリティ監査で発覚）/ Cloudflare Workers・Pages
- **症状**: local-only 化（2026-05-07、コミット `6bdce81`）で不要になったはずの
  `backend.onodera-development.workers.dev` が **200 応答**。`/api/cards` は DB 接続が
  死んでいて `"Failed to fetch cards"` を返す状態（データ流出は無し）。
  社用アカウント側にも旧 backend Worker と旧 tarot-oracle Pages が残っていた。
- **原因**: フロント完結へ移行した際、CI からデプロイを外した（`backend/` は参照用残置）だけで、
  **すでにデプロイ済みの Worker / Pages を停止・削除していなかった**。
- **対処**: **完了（2026-09-02）**。ユーザーが wrangler で 3 件を削除し、curl で消滅を確認:
  社用 `tarot-oracle` Pages（-835）→ 名前解決不能 / 社用 Worker `backend` → 404 /
  個人 Worker `backend`（onodera-development）→ 404。本番 `tarot-oracle-3qs` は 200 のまま。
  手順: `CLOUDFLARE_ACCOUNT_ID=<id> wrangler pages project delete <name>` と
  `wrangler delete --name <worker>`。アカウントは `wrangler logout` → `login` で切替。
  **Claude Code の自動モードでは削除コマンドが遮断される**ため、コマンドを渡してユーザーが実行した。
  なお `tarot-oracle.pages.dev` は 404 で、8/22 の「古い版が出る」調査では原因から棄却済み。
- **再発防止**: **バックエンドを畳むときは「CI から外す」で終わりにせず、
  公開中のデプロイを消すところまでを1つの作業にする**。
- **詳細**: [`history/2026-08-21.md`](../../history/2026-08-21.md) の 8.
- **検索語**: 旧Worker, workers.dev, local-only, 残骸, セキュリティ監査, Pages 削除
- **アプローチへの反映**: 型を中央 `reports/121` と `approaches/止まっていたプロジェクトの再開.md`（棚卸し項目）に還した（2026-09-11）
