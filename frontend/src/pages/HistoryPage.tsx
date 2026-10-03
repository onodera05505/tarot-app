import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/animations/PageTransition'
import { thumbUrl } from '../lib/api'
import { clearHistory, loadHistory } from '../lib/history'
import type { HistoryEntry } from '../lib/history'

// @implements REQ-008
function formatDate(epochMs: number): string {
  const d = new Date(epochMs)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}/${m}/${day} ${hh}:${mm}`
}

// @implements UC-001
export function HistoryPage() {
  const navigate = useNavigate()
  // 遅延初期化でマウント時に一度だけ読む（effect 内 setState だと余計な再レンダーが走る）
  // @implements REQ-008, REQ-009
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory())

  // @implements REQ-011, REQ-012
  const handleClear = () => {
    if (!window.confirm('占いの履歴をすべて削除します。よろしいですか？')) return
    clearHistory()
    setEntries([])
  }

  return (
    <PageTransition className="page page-history">
      <header className="cards-header">
        <h1 className="cards-title">占い履歴</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </header>

      {/* @implements REQ-007, REQ-009, REQ-011 / REQ-008 */}
      {entries.length === 0 ? (
        <div className="history-empty">
          <p className="step-label">まだ占いの履歴はありません</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/shuffle')}
          >
            占いを始める
          </button>
        </div>
      ) : (
        <>
          <ul className="card-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                {/* @implements REQ-010 / BR-003 */}
                <Link
                  to={`/cards/${entry.card.id}?orientation=${entry.orientation}`}
                  className="card-list-item"
                >
                  <img
                    src={thumbUrl(entry.card.imageUrl)}
                    alt={entry.card.nameJa}
                    loading="lazy"
                    className="card-list-image"
                    style={
                      entry.orientation === 'reversed'
                        ? { transform: 'rotate(180deg)' }
                        : undefined
                    }
                  />
                  <div className="card-list-meta">
                    <span className="card-list-number">
                      {formatDate(entry.drawnAt)}
                      {entry.categoryLabel && (
                        <span className="history-category">{entry.categoryLabel}</span>
                      )}
                    </span>
                    <h2 className="card-list-name">{entry.card.nameJa}</h2>
                    <p className="card-list-name-en">
                      {entry.orientation === 'upright' ? '正位置' : '逆位置'}
                    </p>
                    <ul className="card-list-keywords">
                      {entry.keywords.map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                    </ul>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost history-clear-button"
            onClick={handleClear}
          >
            履歴をすべて削除
          </button>
        </>
      )}
    </PageTransition>
  )
}
