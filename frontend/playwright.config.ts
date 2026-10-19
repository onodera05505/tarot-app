import { defineConfig, devices } from '@playwright/test'

// 通し（シナリオ）テストの土台。ユースケースごとに 1 本、`e2e/` に置く（traceconfig.json の tests.system）。
// 単体テスト（vitest、tests/）とは置き場も実行も分ける: vitest の include は tests/ だけ、ここは e2e/ だけ。
// 実行: `pnpm build && pnpm build:deep && pnpm exec playwright test`（初回は `pnpm exec playwright install chromium` でブラウザを入れる）。
// プレビューサーバー（vite preview）はこの設定が起動する。`test.fixme` の付いたテストはブラウザを起動せずに保留として数えられる。
//
// project は 2 つで、配る版も 2 つ。
// - `chromium`: 機能フラグ（用語集: DEEP_READING_ENABLED）が無効な無料版の dist/（`pnpm build`）を 4173 で配り、UC-005 以外を走らせる。
// - `chromium-deep-reading`: 機能フラグ有効の版 dist-deep/（`pnpm build:deep`。環境変数 VITE_DEEP_READING_ENABLED=true を
//   src/lib/features.ts が読む）を 4174 で配り、有効な版でだけ意味を持つ UC-005（詳しく占う）を走らせる。
// どちらの dist も無いと preview が起動できず、webServer の待ちで落ちる。先に両方ビルドしておくこと。
const PREVIEW_URL = 'http://127.0.0.1:4173'
const DEEP_READING_URL = 'http://127.0.0.1:4174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: PREVIEW_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite preview --outDir dist-deep --host 127.0.0.1 --port 4174 --strictPort',
      url: DEEP_READING_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: /UC-005-/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'chromium-deep-reading',
      testMatch: /UC-005-/,
      use: { ...devices['Pixel 7'], baseURL: DEEP_READING_URL },
    },
  ],
})
