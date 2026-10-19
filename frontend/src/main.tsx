import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { FallbackUI } from './components/FallbackUI.tsx'
import { SwapNewVersionOutsideReading } from './components/SwapNewVersionOutsideReading.tsx'
import { useNewVersionStore } from './store/useNewVersionStore'

// 新しい版の受け取りと入れ替え。保持の仕組みは vite.config.ts の registerType: 'prompt' で、
// 新しい版が届いたら onNeedRefresh を呼ぶだけで勝手には入れ替わらない。入れ替える時機は
// アプリの側（下の SwapNewVersionOutsideReading）が決め、占いの途中なら占いが終わるまで待つ。
// 「アプリを開いた瞬間 / 前面に戻った瞬間 / 1 時間ごと」に配信元へ問い合わせ、
// 開きっぱなしのアプリでも取り残されないようにする。
//
// ネイティブ（Capacitor）内では登録しない: アセットはアプリに同梱され更新はストア経由なので、
// 保持の仕組みの入れ替えが走ると二重更新の事故になる。
// ネイティブ判定はこの isNativePlatform() だけに置き、他所に散らさないこと。
// @implements UC-002, UC-008 / REQ-013, REQ-016, REQ-017, REQ-083, REQ-128 / BR-006
if (!Capacitor.isNativePlatform()) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useNewVersionStore.getState().arrive(() => updateSW())
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // @implements REQ-082, REQ-084
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
}

// Sentry は本番環境のみで初期化する。dev のエラーは自分でコンソール確認するため。
// @implements REQ-087, REQ-088
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // @implements REQ-129
    // 報告から稼働中の版を特定するため、ビルド識別子（vite.config.ts の define）を添える
    release: __APP_VERSION__,
    // @implements REQ-130
    // release を渡すと既定で有効になる訪問の記録（BrowserSession。UC-009 の契約の not const）だけを外す。
    // 既定の一覧を丸ごと置き換えない: 描画の外のエラーを捉える手（GlobalHandlers など）が消える（REQ-087）
    integrations: (defaults) => defaults.filter((integration) => integration.name !== 'BrowserSession'),
    // @implements REQ-123
    // ストアのプライバシーの申告で「利用者を特定する情報を集めない」と言える状態を保つため無効にする
    sendDefaultPii: false,
    // @implements REQ-122
    // 個人開発の MVP 段階では Performance / Replay は無効にして無料枠を温存
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* @implements UC-009 / REQ-086 */}
    <Sentry.ErrorBoundary fallback={<FallbackUI />}>
      <BrowserRouter>
        <SwapNewVersionOutsideReading />
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
