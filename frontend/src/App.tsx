import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { TopPage } from './pages/TopPage'
import { DeepPage } from './pages/DeepPage'
import { ShufflePage } from './pages/ShufflePage'
import { ResultPage } from './pages/ResultPage'
import { CardListPage } from './pages/CardListPage'
import { CardDetailPage } from './pages/CardDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { unlockAudio } from './lib/audio'
import { DEEP_READING_ENABLED } from './lib/features'
import './App.css'

// named export はテストからの参照用。main.tsx は default を使う
export function App() {
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
        {/* 無料版では /deep をトップへ戻す（v3.3 §3.3）。DeepPage 自体は温存 */}
        <Route
          path="/deep"
          element={DEEP_READING_ENABLED ? <DeepPage /> : <Navigate to="/" replace />}
        />
        <Route path="/shuffle" element={<ShufflePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/cards" element={<CardListPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
