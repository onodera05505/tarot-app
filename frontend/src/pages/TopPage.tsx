import { useNavigate } from 'react-router-dom'
import { ParticleBackground } from '../components/animations/ParticleBackground'
import { PageTransition } from '../components/animations/PageTransition'
import { TodaysCard } from '../components/TodaysCard'
import { useReadingStore } from '../store/useReadingStore'

export function TopPage() {
  const navigate = useNavigate()
  const reset = useReadingStore((s) => s.reset)

  const handleStart = () => {
    reset()
    navigate('/shuffle')
  }

  return (
    <PageTransition className="page page-top">
      <ParticleBackground />
      <h1 className="title">Tarot</h1>
      <p className="subtitle">あなたの「いま」を1枚に映す。</p>
      <TodaysCard />
      <div className="top-actions">
        <button type="button" className="btn-primary" onClick={handleStart}>
          スタート
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            reset()
            navigate('/deep')
          }}
        >
          詳しく占う
        </button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/cards')}>
          カード解説を見る
        </button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/history')}>
          占い履歴を見る
        </button>
      </div>
      <p className="app-version">v{__APP_VERSION__}</p>
    </PageTransition>
  )
}
