import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import './ShuffleAnimation.css'

const CARD_BACK = '/cards/major/000.webp'
const N = 12

type Phase = 'center' | 'split3' | 'split4' | 'merge1' | 'merge2' | 'merge3'

const PX3 = [-130, 0, 130]
const P4 = [
  { x: -105, y: -62 },
  { x: 105, y: -62 },
  { x: -105, y: 62 },
  { x: 105, y: 62 },
]

function cardPos(i: number, phase: Phase): { x: number; y: number; rotate: number } {
  const p3 = Math.floor(i / 4)
  const r3 = i % 4
  const p4 = Math.floor(i / 3)
  const r4 = i % 3

  switch (phase) {
    case 'center':
      return { x: (i % 4 - 1.5) * 2, y: Math.floor(i / 4) * 1.5, rotate: (i - 5.5) * 1.8 }
    case 'split3':
      return { x: PX3[p3] + (r3 - 1.5) * 3, y: r3 * 2.5, rotate: (r3 - 1.5) * 8 }
    case 'split4':
      return { x: P4[p4].x + (r4 - 1) * 3, y: P4[p4].y + r4 * 2.5, rotate: (r4 - 1) * 8 }
    case 'merge1':
      return p4 === 0 ? cardPos(i, 'center') : cardPos(i, 'split4')
    case 'merge2':
      return p4 <= 1 ? cardPos(i, 'center') : cardPos(i, 'split4')
    case 'merge3':
      return p4 <= 2 ? cardPos(i, 'center') : cardPos(i, 'split4')
  }
}

const SEQ: { phase: Phase; ms: number }[] = [
  { phase: 'center', ms: 700 },   // 0: initial gather (first load only)
  { phase: 'split3', ms: 2000 },  // 1: 3-pile hold
  { phase: 'center', ms: 1000 },  // 2: merge
  { phase: 'split4', ms: 1600 },  // 3: 2×2 hold
  { phase: 'merge1', ms: 500 },   // 4: top-left → center
  { phase: 'merge2', ms: 430 },   // 5: top-right → center
  { phase: 'merge3', ms: 430 },   // 6: bottom-left → center
  { phase: 'center', ms: 700 },   // 7: bottom-right → center, pause
]

export function ShuffleAnimation() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(
      () => setIdx((i) => (i >= SEQ.length - 1 ? 1 : i + 1)),
      SEQ[idx].ms,
    )
    return () => clearTimeout(t)
  }, [idx])

  const phase = SEQ[idx].phase

  return (
    <div className="shuffle-cards" aria-hidden>
      {Array.from({ length: N }, (_, i) => {
        const { x, y, rotate } = cardPos(i, phase)
        return (
          <motion.img
            key={i}
            src={CARD_BACK}
            alt=""
            className="shuffle-card"
            animate={{ x, y, rotate }}
            transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.7 }}
          />
        )
      })}
    </div>
  )
}
