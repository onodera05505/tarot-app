import { defineConfig, devices } from '@playwright/test'

// 通し（シナリオ）テストの土台（2026-10-17）。ユースケースごとに 1 本、`e2e/` に置く（traceconfig.json の tests.system）。
// 単体テスト（vitest、tests/）とは置き場も実行も分ける: vitest の include は tests/ だけ、ここは e2e/ だけ。
// 実行: `pnpm exec playwright test`（初回は `pnpm exec playwright install chromium` でブラウザを入れる）。
// ブラウザを入れていない環境でも、`test.fixme` の付いたテストはブラウザを起動せずに保留として数えられる。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
})
