// 機能フラグの唯一の置き場（要件定義書 v3.3 §3.3）。
//
// DEEP_READING_ENABLED: 「詳しく占う」を出すかどうか。無料版（初回のストア申請、
// Web も同一）では false。トップのボタン表示・/deep ルート・結果画面の deep 表示の 3 箇所がこの値を見る。
// 課金導入時（§7.2）はこの定数を「購入済みかどうか」の判定に置き換える。
// 他の場所に同じ判定を直書きしないこと（散らばると課金導入時に取りこぼす）。
// 切り替えはビルド時の環境変数 VITE_DEEP_READING_ENABLED=true だけ（`pnpm build:deep` が渡す。通しテストの
// chromium-deep-reading project がその成果物 dist-deep/ を向く）。未指定の通常の `pnpm build` では false のまま。
// 環境変数の型もここに置く（src/app-env.d.ts に書くと、features-flag.test.ts の「名前を使う側は lib/features から import」の門に掛かる）。
declare global {
  interface ImportMetaEnv {
    readonly VITE_DEEP_READING_ENABLED?: string
  }
}

// @implements BR-005
export const DEEP_READING_ENABLED = import.meta.env.VITE_DEEP_READING_ENABLED === 'true'
