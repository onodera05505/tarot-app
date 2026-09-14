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

  // ?orientation=upright|reversed は「初期表示の正逆」の指定（v3 §5.5）。両面とも表示し、
  // 指定された側を先に並べ、画像もその向きにする（以前は片面のみ表示だったが、仕様は
  // 「正逆それぞれのキーワードと解説文」なので両面に直した。2026-09-14 独立テスト設計の差し戻し）。
  const orientationParam = searchParams.get('orientation')
  const onlyOrientation: Orientation | null = isOrientation(orientationParam)
    ? orientationParam
    : null

  const [card, setCard] = useState<TarotCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isInvalidId) return
    fetchCard(numericId)
      .then(setCard)
      .catch((e: unknown) => {
        // 利用者に英語のエラー文（'Card not found'）を見せない。詳細はコンソールへ
        if (e instanceof Error) console.warn('fetchCard failed:', e.message)
        setError('カードが見つかりませんでした')
      })
      .finally(() => setLoading(false))
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

  const reversedFirst = onlyOrientation === 'reversed'

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

      {(reversedFirst ? ['reversed', 'upright'] : ['upright', 'reversed']).map((o) =>
        o === 'upright' ? (
          <section key="upright" className="detail-section">
            <h2 className="detail-section-title detail-section-title-upright">正位置</h2>
            <ul className="result-keywords">
              {upKeywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
            <p className="detail-description">{card.descriptionUpright || '（解説準備中）'}</p>
          </section>
        ) : (
          <section key="reversed" className="detail-section">
            <h2 className="detail-section-title detail-section-title-reversed">逆位置</h2>
            <ul className="result-keywords">
              {revKeywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
            <p className="detail-description">{card.descriptionReversed || '（解説準備中）'}</p>
          </section>
        ),
      )}

      <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
        トップへ戻る
      </button>
    </PageTransition>
  )
}
