import { useState } from 'react'
import './ParticleBackground.css'

type Props = {
  count?: number
}

type Particle = {
  id: number
  left: number
  top: number
  size: number
  delay: number
  duration: number
  opacity: number
}

// 乱数を含む生成はコンポーネント外に切り出してレンダリングの純粋性を保つ。
function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 3,
    delay: -Math.random() * 8,
    duration: 6 + Math.random() * 8,
    opacity: 0.3 + Math.random() * 0.6,
  }))
}

// 画面幅から実際に描画するパーティクル数を決定（スマホでは描画コストを抑える）
function resolveCount(requested: number): number {
  if (typeof window === 'undefined') return requested
  const w = window.innerWidth
  if (w < 480) return Math.min(requested, 24)
  if (w < 768) return Math.min(requested, 36)
  return requested
}

// トップ画面の動的背景。今は CSS / DOM だけで作っているが、
// 後から Lottie / Canvas / WebGL に差し替えても上位 API（このコンポーネント）は不変に保つ想定。
export function ParticleBackground({ count = 60 }: Props) {
  const [particles] = useState<Particle[]>(() => createParticles(resolveCount(count)))

  return (
    <div className="particles" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
