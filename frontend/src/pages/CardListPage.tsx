import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/animations/PageTransition'
import { fetchAllCards } from '../lib/api'
import type { TarotCard } from '../lib/types'

export function CardListPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState<TarotCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllCards()
      .then(setCards)
      .catch((e: unknown) => {
        if (e instanceof Error) setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageTransition className="page page-cards">
      <header className="cards-header">
        <h1 className="cards-title">大アルカナ 22枚</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </header>

      {loading && <p className="step-label">読み込み中...</p>}
      {error && <p className="error">取得エラー: {error}</p>}

      <ul className="card-list">
        {cards.map((card) => {
          const upKeywords = card.meaningUpright
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
          return (
            <li key={card.id}>
              <Link to={`/cards/${card.id}`} className="card-list-item">
                <img
                  src={card.imageUrl}
                  alt={card.nameJa}
                  loading="lazy"
                  className="card-list-image"
                />
                <div className="card-list-meta">
                  <span className="card-list-number">{String(card.number).padStart(2, '0')}</span>
                  <h2 className="card-list-name">{card.nameJa}</h2>
                  <p className="card-list-name-en">{card.nameEn}</p>
                  <ul className="card-list-keywords">
                    {upKeywords.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </PageTransition>
  )
}
