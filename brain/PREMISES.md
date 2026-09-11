# 前提・制約・未決（tarot-app）— 何かに着手する前に毎回読む

決まったら「未決」から「決定」へ移し、日付を付ける。本人の指示（触ってよい範囲など）もここに置く。

## 決定・制約（日付）
- 個人プロジェクト。main への push は確認なしでよい（2026-09-02 本人指示）
- 一次資料は `docs/タロットアプリ_要件定義書_v3.md`。挙動を変える作業は §6 の差分を消す方向で。`backend/docs/` の v2・PDF は過去版で更新しない（2026-08-21）
- `backend/` は参照用残骸。CI は一切触らない（2026-09-02）。旧 Worker / Pages 3 件は削除済み（`brain/reports/05`）
- 結果は完全ランダム。儀式の左右選択は演出のみで正逆に影響しない（コミット 24efef6、2026-05-02。覆すなら根拠とセット）
- 初回リリースは**無料・広告なし・詳しく占うを完全非表示**（v3.3 §3.3、2026-09-02）。切替は `frontend/src/lib/features.ts` の `DEEP_READING_ENABLED` 1 箇所のみ。Web 本番も同じ構成
- ストア申請は iOS / Android とも**保留**。先に Capacitor で Android 版を本人の端末で実機確認してから次を決める（2026-09-03）
- Capacitor の appId は `com.onodera.tarot`（ストア登録後は変更不可。変えるなら登録前）
- ネイティブ内では Service Worker を登録しない（`main.tsx` の 1 箇所で判定）
- カード画像 22 枚 + 裏面は本人が Gemini Pro で生成（参照作品なし）。出所は `frontend/public/cards/README.md`。ストア公開前に生成 AI 規約の版を追記する（2026-09-02）
- 詳しく占うの執筆値（1 カテゴリ = 44 ベース + 198 アドバイス、見本は愚者、3 分担）は `brain/approaches/詳しく占うのカテゴリを追加する.md`

## 環境の癖（日付）
- Node 24 必須（jsdom 30 が Node 20 に無い API を使う。CI も 24。中央 `reports/74`）。Capacitor は Node ≥ 22
- テストは `frontend/tests/` に分離し `tsconfig.test.json`（`src/` は vite/client 型のため Node API を使うテストと同居できない）。App を描画するテストがあるので `vite/client` 型と `src/app-env.d.ts` を include に含める。外すと `pnpm build` の `tsc -b` が落ちる（2026-09-02）
- フェーズ遷移のテストは擬似タイマーを 1 遷移ずつ進める（中央 `reports/97`）
- Claude Code の自動モードでは Cloudflare の削除コマンドが遮断される。コマンドを提示して本人が実行（2026-09-02）
- Homebrew 無し。Android Studio（JDK + SDK 同梱）は本人がインストールする
- `.claude/` は gitignore 済み。`settings.local.json` は 2026-09-02 に 25 件へ整理（キーチェーン・ssh・pkill の一時許可は削除済み。再び足したら作業後に消す）

## 未決（日付・誰が決めるか）
- Android Studio 導入 → APK ビルド → 実機確認（本人。2026-09-03〜）。実機で見る項目: BrowserRouter の直接パス、Web Audio、セーフエリア・ステータスバー色
- 実機確認後にストア申請の順序を決める（本人）。Apple Developer は iPhone 未所持のため保留
- 「予告表示」の文言定義が仕様に無い（テストは 準備中/近日/coming soon/開放予定/有料 を予告とみなす）。トップにこれらの語を置くなら先に仕様で定義する（2026-09-02）
- 裏面画像が表示サイズの約 4.7 倍の解像度（582KB）。引っかかりの原因ではないと計測済みだが、初回ロードと端末メモリの観点で縮小の余地あり（2026-09-02、触るなら実機で A/B）
- deploy.yml の新経路（frontend から wrangler 実行）は 2026-09-02 の push 以降の CI で緑を確認すること（未確認なら次の push で見る）
