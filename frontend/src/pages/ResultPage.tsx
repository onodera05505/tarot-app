import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { CardReveal } from '../components/animations/CardReveal'
import { useReadingStore } from '../store/useReadingStore'

function calcWidths() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800
  const flip = Math.min(Math.max(Math.round(w * 0.52), 180), 280)
  const settled = w < 640 ? Math.round(flip * 0.62) : flip
  return { flip, settled }
}

export function ResultPage() {
  const navigate = useNavigate()
  const [cardSettled, setCardSettled] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const widths = useMemo(calcWidths, [])

  const { drawn, status, error, reset } = useReadingStore(
    useShallow((s) => ({
      drawn: s.drawn,
      status: s.status,
      error: s.error,
      reset: s.reset,
    })),
  )

  if (status === 'idle') return <Navigate to="/" replace />

  if (status === 'drawing') {
    return (
      <main className="page page-result">
        <p className="step-label">カードを引いています...</p>
      </main>
    )
  }

  if (status === 'error' || !drawn) {
    return (
      <main className="page page-result">
        <p className="error">エラー: {error ?? 'カードを取得できませんでした'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </main>
    )
  }

  const { card, orientation, keywords } = drawn
  const description =
    orientation === 'upright' ? card.descriptionUpright : card.descriptionReversed

  const handleHome = () => {
    reset()
    navigate('/')
  }

  return (
    <main className="page page-result">
      <button
        type="button"
        className="card-tap-button"
        onClick={() => cardSettled && setEnlarged(true)}
        disabled={!cardSettled}
        aria-label="カードを拡大表示"
      >
        <CardReveal
          imageUrl={card.imageUrl}
          alt={card.nameJa}
          reversed={orientation === 'reversed'}
          width={cardSettled ? widths.settled : widths.flip}
          onFlipComplete={() => setCardSettled(true)}
        />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={cardSettled ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="result-info"
      >
        <h2 className="result-name">{card.nameJa}</h2>
        <p className="result-orientation">
          {orientation === 'upright' ? '正位置' : '逆位置'}
        </p>
        <ul className="result-keywords">
          {keywords.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        {description && (
          <p className="result-description">{description}</p>
        )}
        <div className="result-actions">
          <button type="button" className="btn-primary" onClick={handleHome}>
            トップへ戻る
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {enlarged && (
          <motion.div
            key="card-zoom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="card-zoom-overlay"
            onClick={() => setEnlarged(false)}
            role="button"
            aria-label="閉じる"
          >
            <motion.div
              className="card-zoom-content"
              initial={{ scale: 0.55 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.55 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <img
                src={card.imageUrl}
                alt={card.nameJa}
                className="card-zoom-image"
                style={{ transform: orientation === 'reversed' ? 'rotate(180deg)' : undefined }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
