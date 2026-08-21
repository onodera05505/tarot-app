import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ビルド識別子: コミット短縮ハッシュ + ビルド日。トップ画面の隅に表示され、
// 「端末でどの版が動いているか」をリモートで確定できるようにする
function buildVersion(): string {
  let sha = 'dev'
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // git が無い環境（CI 以外の特殊ケース）では dev のまま
  }
  const d = new Date()
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `${date}.${sha}`
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'cards/**/*.webp',
      ],
      manifest: {
        name: 'タロットカード',
        short_name: 'タロットカード',
        description: '手軽に本格占い',
        lang: 'ja',
        theme_color: '#0b0820',
        background_color: '#0b0820',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // カード画像はサイズが大きめなので CacheFirst で長期キャッシュ
        runtimeCaching: [
          {
            urlPattern: /\/cards\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90日
              },
            },
          },
        ],
      },
    }),
  ],
})
