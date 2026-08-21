// Sentry.ErrorBoundary の fallback。main.tsx から分離しているのは
// react-refresh がコンポーネント混在ファイルを許さないため。
export function FallbackUI() {
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
