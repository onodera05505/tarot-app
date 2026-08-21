import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { FallbackUI } from './components/FallbackUI.tsx'

// PWA の自動更新（v3.1 §2）。autoUpdate モードでは新しい Service Worker が
// 有効化された瞬間にページが自動リロードされ、ユーザー操作なしで最新版になる。
// さらに「アプリを開いた瞬間 / フォアグラウンドに戻った瞬間 / 1 時間ごと」に
// 更新チェックを仕掛けることで、開きっぱなしの PWA でも取り残されないようにする
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => {
      registration.update().catch(() => {
        // オフライン時などの失敗は無視（次の機会に再チェック）
      })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 60 * 60 * 1000)
  },
})

// Sentry は本番環境のみで初期化する。dev のエラーは自分でコンソール確認するため。
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
    // 個人開発の MVP 段階では Performance / Replay は無効にして無料枠を温存
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<FallbackUI />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
