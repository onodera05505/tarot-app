import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardReveal } from './animations/CardReveal'
import { drawCards } from '../lib/api'
import type { DrawnCard } from '../lib/types'

const CARD_BACK = '/cards/major/000.webp'
const STORAGE_KEY = 'tarot:todaysCard'
const CARD_WIDTH = 80

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Cached = { date: string; drawn: DrawnCard }

function loadCached(): DrawnCard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached
    if (parsed.date === getTodayKey() && parsed.drawn?.card) return parsed.drawn
  } catch {
    // 無視（パース失敗時）
  }
  return null
}

function saveCached(drawn: DrawnCard) {
  const payload: Cached = { date: getTodayKey(), drawn }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function TodaysCard() {
  const navigate = useNavigate()
  const [drawn, setDrawn] = useState<DrawnCard | null>(loadCached)
  const [flipping, setFlipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async () => {
    if (drawn || flipping) return
    setError(null)
    setFlipping(true)
    try {
      const cards = await drawCards(1)
      const result = cards[0]
      saveCached(result)
      setDrawn(result)
      // flipping は CardReveal の onFlipComplete で false に
    } catch (e) {
      setFlipping(false)
      setError(e instanceof Error ? e.message : '取得失敗')
    }
  }

  // 未開封
  if (!drawn) {
    return (
      <button
        type="button"
        className="todays-card todays-card--closed"
        onClick={handleOpen}
        disabled={flipping}
      >
        <img src={CARD_BACK} alt="" className="todays-card-back" aria-hidden />
        <div className="todays-card-meta">
          <span className="todays-card-label">本日の一枚</span>
          <span className="todays-card-hint">
            {flipping ? '読み込み中…' : 'タップして開く'}
          </span>
          {error && <span className="todays-card-error">エラー: {error}</span>}
        </div>
      </button>
    )
  }

  // めくり中
  if (flipping) {
    return (
      <div className="todays-card todays-card--flipping">
        <CardReveal
          imageUrl={drawn.card.imageUrl}
          alt={drawn.card.nameJa}
          reversed={drawn.orientation === 'reversed'}
          width={CARD_WIDTH}
          delayMs={200}
          onFlipComplete={() => setFlipping(false)}
        />
        <div className="todays-card-meta">
          <span className="todays-card-label">本日の一枚</span>
        </div>
      </div>
    )
  }

  // 開封済み（タップで詳細へ）
  return (
    <button
      type="button"
      className="todays-card todays-card--revealed"
      onClick={() =>
        navigate(`/cards/${drawn.card.id}?orientation=${drawn.orientation}`)
      }
    >
      <img
        src={drawn.card.imageUrl}
        alt={drawn.card.nameJa}
        className="todays-card-image"
        style={
          drawn.orientation === 'reversed'
            ? { transform: 'rotate(180deg)' }
            : undefined
        }
      />
      <div className="todays-card-meta">
        <span className="todays-card-label">本日の一枚</span>
        <span className="todays-card-name">{drawn.card.nameJa}</span>
        <span className="todays-card-orientation">
          {drawn.orientation === 'upright' ? '正位置' : '逆位置'}
        </span>
      </div>
    </button>
  )
}
