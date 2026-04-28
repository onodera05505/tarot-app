import { useNavigate } from 'react-router-dom'
import { ShuffleAnimation } from '../components/animations/ShuffleAnimation'

export function ShufflePage() {
  const navigate = useNavigate()
  return (
    <main className="page page-shuffle">
      <p className="prompt">占ってもらう事柄を決めてください。</p>
      <div className="shuffle-stage">
        <ShuffleAnimation />
      </div>
      <button type="button" className="btn-primary" onClick={() => navigate('/select')}>
        決まりました
      </button>
    </main>
  )
}
