import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

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

function FallbackUI() {
  return (
    <main className="page" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h2>予期しないエラーが発生しました</h2>
      <p style={{ color: 'var(--text-dim)', marginTop: '1rem' }}>
        申し訳ありません。ページを再読み込みしてください。
      </p>
      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: '1.5rem' }}
        onClick={() => window.location.assign('/')}
      >
        トップへ戻る
      </button>
    </main>
  )
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
