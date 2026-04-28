import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageTransition } from '../components/animations/PageTransition'
import { fetchCard } from '../lib/api'
import type { Orientation, TarotCard } from '../lib/types'

const isOrientation = (v: string | null): v is Orientation =>
  v === 'upright' || v === 'reversed'

export function CardDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const numericId = Number(id)
  const isInvalidId = !Number.isFinite(numericId)

  // ?orientation=upright|reversed が付いている場合は片面のみ表示。
  // 付いていなければ両面（一覧から開いた通常表示）。
  const orientationParam = searchParams.get('orientation')
  const onlyOrientation: Orientation | null = isOrientation(orientationParam)
    ? orientationParam
    : null

  const [card, setCard] = useState<TarotCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isInvalidId) return
    const controller = new AbortController()
    fetchCard(numericId, controller.signal)
      .then(setCard)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [numericId, isInvalidId])

  if (isInvalidId) {
    return (
      <PageTransition className="page page-card-detail">
        <p className="error">カードIDが不正です</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/cards')}>
          一覧へ戻る
        </button>
      </PageTransition>
    )
  }

  if (loading) {
    return (
      <PageTransition className="page page-card-detail">
        <p className="step-label">読み込み中...</p>
      </PageTransition>
    )
  }

  if (error || !card) {
    return (
      <PageTransition className="page page-card-detail">
        <p className="error">{error ?? 'カードが見つかりませんでした'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/cards')}>
          一覧へ戻る
        </button>
      </PageTransition>
    )
  }

  const upKeywords = card.meaningUpright
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  const revKeywords = card.meaningReversed
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  const showUpright = onlyOrientation === null || onlyOrientation === 'upright'
  const showReversed = onlyOrientation === null || onlyOrientation === 'reversed'

  return (
    <PageTransition className="page page-card-detail">
      <header className="detail-header">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
          ← 戻る
        </button>
        <div className="detail-title">
          <span className="detail-number">{String(card.number).padStart(2, '0')}</span>
          <h1>{card.nameJa}</h1>
          <p className="name-en">{card.nameEn}</p>
        </div>
      </header>

      <img
        src={card.imageUrl}
        alt={card.nameJa}
        className="detail-image"
        style={
          onlyOrientation === 'reversed'
            ? { transform: 'rotate(180deg)' }
            : undefined
        }
      />

      {showUpright && (
        <section className="detail-section">
          <h2 className="detail-section-title detail-section-title-upright">正位置</h2>
          <ul className="result-keywords">
            {upKeywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="detail-description">{card.descriptionUpright || '（解説準備中）'}</p>
        </section>
      )}

      {showReversed && (
        <section className="detail-section">
          <h2 className="detail-section-title detail-section-title-reversed">逆位置</h2>
          <ul className="result-keywords">
            {revKeywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="detail-description">{card.descriptionReversed || '（解説準備中）'}</p>
        </section>
      )}

      <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
        トップへ戻る
      </button>
    </PageTransition>
  )
}
