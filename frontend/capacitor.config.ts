import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor（ネイティブ化）の設定。要件定義書 v3.3 §2。
// appId はストア登録後に変更できないので固定（2026-09-03 決定: com.onodera.tarot）。
// webDir は Web 版と同じ `pnpm build` の出力を使う（ネイティブ専用ビルドは持たない）。
// 手順: pnpm build → pnpm exec cap sync android → Android Studio で開くか cap run android
const config: CapacitorConfig = {
  appId: 'com.onodera.tarot',
  appName: 'タロットカード',
  webDir: 'dist',
  // 起動直後の WebView の地色をアプリのテーマ色に揃える（白フラッシュ防止）
  backgroundColor: '#0b0820',
}

export default config
