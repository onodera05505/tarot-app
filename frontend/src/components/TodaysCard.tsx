import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardReveal } from './animations/CardReveal'
import { CARD_BACK_THUMB_URL, drawCards, thumbUrl } from '../lib/api'
import type { DrawnCard } from '../lib/types'

const STORAGE_KEY = 'tarot:todaysCard'
const CARD_WIDTH = 80

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Cached = { date: string; drawn: DrawnCard }

// @implements REQ-022, REQ-023, REQ-024, REQ-025
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

// @implements REQ-018
// @implements REQ-104
function saveCached(drawn: DrawnCard) {
  const payload: Cached = { date: getTodayKey(), drawn }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

// @implements UC-003
export function TodaysCard() {
  const navigate = useNavigate()
  const [drawn, setDrawn] = useState<DrawnCard | null>(loadCached)
  const [flipping, setFlipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // @implements REQ-018, REQ-006 / BR-004
  const handleOpen = async () => {
    // @implements REQ-019
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
      // @implements REQ-021
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
        <img src={CARD_BACK_THUMB_URL} alt="" className="todays-card-back" aria-hidden />
        <div className="todays-card-meta">
          <span className="todays-card-label">本日の一枚</span>
          {/* @implements REQ-124 */}
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
          imageUrl={thumbUrl(drawn.card.imageUrl)}
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
      // @implements REQ-020
      onClick={() =>
        navigate(`/cards/${drawn.card.id}?orientation=${drawn.orientation}`)
      }
    >
      <img
        src={thumbUrl(drawn.card.imageUrl)}
        alt={drawn.card.nameJa}
        className="todays-card-image"
        // @implements BR-003
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
