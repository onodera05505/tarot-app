import { defineConfig } from 'vitest/config'

// vite.config.ts は読まない（PWA プラグイン等はテストに不要なので独立させる）
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
