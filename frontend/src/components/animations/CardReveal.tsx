import { useRef } from 'react'
import { motion } from 'framer-motion'

const CARD_BACK = '/cards/major/000.webp'

type Props = {
  imageUrl: string
  alt: string
  reversed?: boolean
  delayMs?: number
  /** 現在の幅(px)。親が phase に応じて切り替える */
  width: number
  onFlipComplete?: () => void
}

export function CardReveal({
  imageUrl,
  alt,
  reversed = false,
  delayMs = 600,
  width,
  onFlipComplete,
}: Props) {
  const doneRef = useRef(false)
  const flipDuration = 0.9
  const height = Math.round(width * 1.5)

  const handleFlipDone = () => {
    if (doneRef.current) return
    doneRef.current = true
    onFlipComplete?.()
  }

  return (
    <motion.div
      className="card-frame"
      initial={{ width, height }}
      animate={{ width, height }}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
      style={{ perspective: '1200px', flexShrink: 0 }}
    >
      <motion.div
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 180 }}
        transition={{ duration: flipDuration, delay: delayMs / 1000, ease: 'easeInOut' }}
        onAnimationComplete={handleFlipDone}
      >
        <img
          src={CARD_BACK}
          alt=""
          aria-hidden
          className="card-img"
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />
        <img
          src={imageUrl}
          alt={alt}
          className="card-img"
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: `rotateY(180deg) rotate(${reversed ? 180 : 0}deg)`,
          }}
        />
      </motion.div>
    </motion.div>
  )
}
