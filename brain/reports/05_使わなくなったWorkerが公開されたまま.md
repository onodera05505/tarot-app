# 05. 使っていないはずのバックエンド URL が 200 を返す

- **日付/場所**: 2026-08-21（セキュリティ監査で発覚）/ Cloudflare Workers・Pages
- **症状**: local-only 化（2026-05-07、コミット `6bdce81`）で不要になったはずの
  `backend.onodera-development.workers.dev` が **200 応答**。`/api/cards` は DB 接続が
  死んでいて `"Failed to fetch cards"` を返す状態（データ流出は無し）。
  社用アカウント側にも旧 backend Worker と旧 tarot-oracle Pages が残っていた。
- **原因**: フロント完結へ移行した際、CI からデプロイを外した（`backend/` は参照用残置）だけで、
  **すでにデプロイ済みの Worker / Pages を停止・削除していなかった**。
- **対処**: **未完了**。削除には Cloudflare の認証が要るためユーザーと一緒に行う扱いで保留中
  （個人: backend / 社用: 旧 backend + 旧 tarot-oracle Pages）。
  なお `tarot-oracle.pages.dev` は 404 で、8/22 の「古い版が出る」調査では原因から棄却済み。
- **再発防止**: 無し。**バックエンドを畳むときは「CI から外す」で終わりにせず、
  公開中のデプロイを消すところまでを1つの作業にする**。
- **詳細**: [`history/2026-08-21.md`](../../history/2026-08-21.md) の 8.
- **検索語**: 旧Worker, workers.dev, local-only, 残骸, セキュリティ監査, Pages 削除
