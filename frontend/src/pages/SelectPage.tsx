import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CardSelector } from '../components/animations/CardSelector'
import { PageTransition } from '../components/animations/PageTransition'
import { useReadingStore } from '../store/useReadingStore'

export function SelectPage() {
  const navigate = useNavigate()
  const drawOne = useReadingStore((s) => s.drawOne)
  const [confirmed, setConfirmed] = useState(false)

  const handleSelect = async () => {
    await drawOne()
    navigate('/result')
  }

  return (
    <PageTransition className="page page-select">
      <motion.p
        className="prompt"
        animate={{ opacity: confirmed ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        ピンと来たカードを1枚お選びください。
      </motion.p>
      <CardSelector
        count={11}
        onSelect={handleSelect}
        onSelectStart={() => setConfirmed(true)}
      />
    </PageTransition>
  )
}
