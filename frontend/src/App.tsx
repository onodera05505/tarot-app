import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { TopPage } from './pages/TopPage'
import { ShufflePage } from './pages/ShufflePage'
import { SelectPage } from './pages/SelectPage'
import { ResultPage } from './pages/ResultPage'
import { CardListPage } from './pages/CardListPage'
import { CardDetailPage } from './pages/CardDetailPage'
import './App.css'

function App() {
  const location = useLocation()
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
