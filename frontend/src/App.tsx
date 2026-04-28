import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { TopPage } from './pages/TopPage'
import { ShufflePage } from './pages/ShufflePage'
import { SelectPage } from './pages/SelectPage'
import { ResultPage } from './pages/ResultPage'
import { CardListPage } from './pages/CardListPage'
import { CardDetailPage } from './pages/CardDetailPage'
import { unlockAudio } from './lib/audio'
import './App.css'

function App() {
  const location = useLocation()

  // 初回ユーザー操作で AudioContext を起動状態にする（autoplay policy 対策）。
  // pointerdown は touch / click / mouse 全てカバー。
  useEffect(() => {
    const handler = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
    window.addEventListener('pointerdown', handler)
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<TopPage />} />
        <Route path="/shuffle" element={<ShufflePage />} />
        <Route path="/select" element={<SelectPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/cards" element={<CardListPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
