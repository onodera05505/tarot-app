import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// vite.config.ts は読まない（PWA プラグイン等はテストに不要なので独立させる）
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  resolve: {
    alias: {
      // 保持の仕組みのプラグインを外しているので、それがビルド時にだけ作る `virtual:pwa-register` は
      // テストでは解決できない。アプリの入口（main.tsx）を起動するテストのために、契約
      // （UC-008 の contract.yaml の registerSW）の形だけを持つスタブへ向ける。
      // この別名を外すと tests/UC-009-error-report-init.test.ts が入口の読み込みで止まる
      'virtual:pwa-register': fileURLToPath(new URL('./tests/stubs/pwa-register.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // 既定は node。コンポーネントテストはファイル先頭の
    // `// @vitest-environment jsdom` で個別に jsdom を指定する
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
