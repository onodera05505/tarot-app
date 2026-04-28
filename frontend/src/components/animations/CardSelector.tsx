import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './CardSelector.css'

const CARD_BACK = '/cards/major/000.webp'

type Props = {
  count?: number
  onSelect: (index: number) => void
  onSelectStart?: () => void
}

type FanCard = {
  index: number
  angle: number
  initialX: number
  initialY: number
  initialRotate: number
}

function buildCards(count: number): FanCard[] {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024
  const isNarrow = w < 480
  const angleSpan = Math.min(isNarrow ? 84 : 92, count * (isNarrow ? 8 : 9))
  const scatterX = isNarrow ? 320 : 480
  const anglePer = count > 1 ? angleSpan / (count - 1) : 0
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    angle: -angleSpan / 2 + anglePer * i,
    initialX: (Math.random() - 0.5) * scatterX,
    initialY: -120 - Math.random() * 160,
    initialRotate: (Math.random() - 0.5) * 80,
  }))
}

export function CardSelector({ count = 9, onSelect, onSelectStart }: Props) {
  const [cards] = useState<FanCard[]>(() => buildCards(count))
  const cardFanRef = useRef<HTMLDivElement>(null)
  const [selectedTarget, setSelectedTarget] = useState({ y: -260, scale: 1.6 })
  const [previewed, setPreviewed] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  // /result 画面のカード初期位置（safe-area + padding 24px の頂上）に整合させて
  // y/scale を計算する。ref で実寸取得することで safe-area やビューポート差を吸収。
  useEffect(() => {
    const compute = () => {
      if (!cardFanRef.current) return
      const rect = cardFanRef.current.getBoundingClientRect()
      const root = document.getElementById('root')
      const safeTop = root ? parseFloat(getComputedStyle(root).paddingTop) || 0 : 0
      const w = window.innerWidth
      const isNarrow = w < 480
      const baseW = isNarrow ? 126 : 96
      const baseH = isNarrow ? 189 : 144
      // /result 側の flip 幅: clamp(180, 0.52w, 280)
      const resultFlipW = Math.min(Math.max(Math.round(w * 0.52), 180), 280)
      const scale = isNarrow ? resultFlipW / baseW : 1.7
      const scaledH = baseH * scale
      const targetTop = safeTop + 24
      setSelectedTarget({
        y: Math.round(targetTop + scaledH - rect.bottom),
        scale,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const handleClick = (index: number) => {
    if (selected !== null) return
    if (previewed === index) {
      setSelected(index)
      onSelectStart?.()
      window.setTimeout(() => onSelect(index), 1400)
    } else {
      setPreviewed(index)
    }
  }

  const isInteracting = previewed !== null || selected !== null

  return (
    <div className="card-fan" aria-label="カード選択" ref={cardFanRef}>
      {cards.map((c) => {
        const isSelected = selected === c.index
        const isPreviewed = previewed === c.index && selected === null
        const isOther = selected !== null && !isSelected

        return (
          <motion.button
            key={c.index}
            type="button"
            className="fan-card"
            onClick={() => handleClick(c.index)}
            disabled={selected !== null}
            initial={{
              x: c.initialX,
              y: c.initialY,
              rotate: c.initialRotate,
              opacity: 0,
              scale: 0.9,
            }}
            animate={
              isSelected
                ? { x: 0, y: selectedTarget.y, rotate: 0, scale: selectedTarget.scale, opacity: 1,
                    filter: 'drop-shadow(0 0 28px rgba(245,215,110,0.95))' }
                : isPreviewed
                ? { x: 0, y: -30, rotate: c.angle, scale: 1.05, opacity: 1,
                    filter: 'drop-shadow(0 0 20px rgba(245,215,110,0.85))' }
                : isOther
                ? { opacity: 0, scale: 0.85, transition: { duration: 0.4 } }
                : { x: 0, y: 0, rotate: c.angle, opacity: 1, scale: 1,
                    filter: 'drop-shadow(0 0 0px rgba(245,215,110,0))' }
            }
            transition={{
              type: 'spring',
              stiffness: isInteracting ? 230 : 80,
              damping: isInteracting ? 22 : 18,
              delay: isInteracting ? 0 : 0.25 + c.index * 0.04,
            }}
            whileHover={!isPreviewed && selected === null ? { y: -20, transition: { duration: 0.18 } } : undefined}
            whileTap={!isPreviewed && selected === null ? { y: -24, scale: 1.1, transition: { duration: 0.13 } } : undefined}
            style={{
              transformOrigin: '50% 100%',
              // プレビュー時は z-index を変更しない: 上にあるカードの陰に隠れ、
              // はみ出している部分だけ見える「上から数枚目をつまんで引き出した」状態を再現。
              // 確定時のみ最前面に（次画面遷移用の演出として）。
              zIndex: isSelected ? 20 : c.index,
            }}
          >
            <img src={CARD_BACK} alt="" draggable={false} />
          </motion.button>
        )
      })}
    </div>
  )
}
