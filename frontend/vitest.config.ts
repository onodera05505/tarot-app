import { defineConfig } from 'vitest/config'

// vite.config.ts は読まない（PWA プラグイン等はテストに不要なので独立させる）
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // 既定は node。コンポーネントテストはファイル先頭の
    // `// @vitest-environment jsdom` で個別に jsdom を指定する
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
