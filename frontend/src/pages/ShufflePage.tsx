import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { PageTransition } from '../components/animations/PageTransition'
import { useReadingStore } from '../store/useReadingStore'

const CARD_BACK = '/cards/major/000.webp'
const N = 12

type Phase =
  | 'shuffling'
  | 'merging'
  | 'split3'
  | 'stacking3'
  | 'split2'
  | 'stacking2'
  | 'rotating'
  | 'orienting'
  | 'transitioning'

type Pos = { x: number; y: number; rotate: number }

// 3山分割時の位置（カード i がどの山のどの位置か）
function pos3(i: number): Pos {
  const pileIdx = Math.floor(i / 4) // 0, 1, 2
  const inPile = i % 4
  const pileX = (pileIdx - 1) * 130
  return {
    x: pileX + (inPile - 1.5) * 1.2,
    y: -inPile * 2,
    rotate: 0,
  }
}

// 2山分割時の位置
function pos2(i: number): Pos {
  const pileIdx = i < 6 ? 0 : 1
  const inPile = i % 6
  const pileX = pileIdx === 0 ? -85 : 85
  return {
    x: pileX + (inPile - 2.5) * 1.2,
    y: -inPile * 2,
    rotate: 0,
  }
}

// 中央集約時の位置（一つの山）
function posCenter(i: number): Pos {
  return {
    x: (i - 5.5) * 0.6,
    y: -i * 1.5,
    rotate: 0,
  }
}

// シャッフル中のカード散らかり位置（時刻 t に応じて変化）。
// 円軌道 + 微回転で「混ぜている」感じを出す。
function posShuffle(i: number, t: number): Pos {
  const angle = (i / N) * Math.PI * 2 + t * 0.7
  const radius = 56 + Math.sin(t * 1.2 + i) * 14
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.45,
    rotate: Math.sin(t * 1.6 + i * 0.7) * 22,
  }
}

function targetFor(i: number, phase: Phase): Pos {
  switch (phase) {
    case 'merging':
    case 'stacking3':
    case 'stacking2':
    case 'rotating':
    case 'orienting':
    case 'transitioning':
      return posCenter(i)
    case 'split3':
      return pos3(i)
    case 'split2':
      return pos2(i)
    case 'shuffling':
      return posCenter(i) // 初期 fallback（実際は posShuffle が使われる）
  }
}

// 3山積み上げ用、カードの遅延（3番目→0、2番目→0.45s、1番目→0.9s）
// pile3Order: pileIdx -> rank (1=1st picked, 2=2nd, 3=3rd)
function stackDelay3(i: number, pile3Order: Record<number, number>): number {
  const pile = Math.floor(i / 4)
  const rank = pile3Order[pile] ?? 0
  if (rank === 0) return 0
  return (3 - rank) * 0.45
}

// 2山積み上げ用、選ばれた山が後（上）になるよう遅延
function stackDelay2(i: number, chosen: 0 | 1 | null): number {
  if (chosen === null) return 0
  const pile = i < 6 ? 0 : 1
  return pile === chosen ? 0.5 : 0
}

const PROMPTS: Record<Phase, string> = {
  shuffling: '占ってもらう事柄を思い浮かべてください。',
  merging: '',
  split3: '積み上げる順番を指定してください',
  stacking3: '',
  split2: 'どちらかの山を選択してください',
  stacking2: '',
  rotating: '',
  orienting: 'どちらを上にするか選択してください',
  transitioning: '',
}

export function ShufflePage() {
  const navigate = useNavigate()
  const { drawn, drawOne, setOrientation, reset } = useReadingStore(
    useShallow((s) => ({
      drawn: s.drawn,
      drawOne: s.drawOne,
      setOrientation: s.setOrientation,
      reset: s.reset,
    })),
  )

  const [phase, setPhase] = useState<Phase>('shuffling')

  // 3山選択（pileIdx -> rank 1|2|3）
  const [pile3Order, setPile3Order] = useState<Record<number, number>>({})
  const pile3Complete = Object.keys(pile3Order).length === 3

  // 2山選択
  const [chosenPile2, setChosenPile2] = useState<0 | 1 | null>(null)

  // 選ぶ「上の側」
  const [chosenSide, setChosenSide] = useState<'left' | 'right' | null>(null)

  // シャッフル中の動的位置のために 60fps で時刻更新
  const [t, setT] = useState(0)
  useEffect(() => {
    if (phase !== 'shuffling') return
    let raf = 0
    let start = performance.now()
    const loop = (now: number) => {
      setT((now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // 自動進行する phase のタイマー
  useEffect(() => {
    let timer: number | undefined
    if (phase === 'merging') {
      timer = window.setTimeout(() => setPhase('split3'), 900)
    } else if (phase === 'stacking3') {
      // 0.45s × 2 + 余韻 → 約 1.4s
      timer = window.setTimeout(() => setPhase('split2'), 1500)
    } else if (phase === 'stacking2') {
      timer = window.setTimeout(() => setPhase('rotating'), 1100)
    } else if (phase === 'rotating') {
      timer = window.setTimeout(() => setPhase('orienting'), 850)
    } else if (phase === 'transitioning') {
      timer = window.setTimeout(() => navigate('/result'), 650)
    }
    return () => window.clearTimeout(timer)
  }, [phase, navigate])

  // STOP 押下: シャッフル停止 + バックエンド draw を先行発射
  const handleStop = () => {
    if (phase !== 'shuffling') return
    reset() // 過去の drawn をクリア
    drawOne() // 非同期。完了は orienting までに間に合わせる
    setPhase('merging')
  }

  // 3山選択トグル
  const togglePile3 = (pileIdx: number) => {
    if (phase !== 'split3') return
    setPile3Order((current) => {
      const next = { ...current }
      if (next[pileIdx]) {
        // 解除: その rank を消す + より大きい rank を詰める
        const removed = next[pileIdx]
        delete next[pileIdx]
        for (const k of Object.keys(next)) {
          const idx = Number(k)
          if (next[idx] > removed) next[idx] -= 1
        }
      } else {
        // 新規: 次の rank を割り当て
        const used = new Set(Object.values(next))
        let rank = 1
        while (used.has(rank)) rank += 1
        if (rank <= 3) next[pileIdx] = rank
      }
      return next
    })
  }

  const togglePile2 = (pileIdx: 0 | 1) => {
    if (phase !== 'split2') return
    setChosenPile2((cur) => (cur === pileIdx ? null : pileIdx))
  }

  const handleStack3 = () => {
    if (!pile3Complete) return
    setPhase('stacking3')
  }

  const handleStack2 = () => {
    if (chosenPile2 === null) return
    setPhase('stacking2')
  }

  const handleOrient = (side: 'left' | 'right') => {
    if (phase !== 'orienting') return
    setChosenSide(side)
    // 反時計回り 90° で寝かせた状態だと:
    //   横向きの「左」端 = カード本来の頭 → 「左」を上にすれば 正位置
    //   横向きの「右」端 = カード本来の足 → 「右」を上にすれば 逆位置
    const orientation = side === 'left' ? 'upright' : 'reversed'
    if (drawn) {
      setOrientation(orientation)
    }
    setPhase('transitioning')
  }

  // drawn がまだの場合: orienting 後に到着したら orientation を反映
  useEffect(() => {
    if (chosenSide && drawn) {
      const orientation = chosenSide === 'left' ? 'upright' : 'reversed'
      setOrientation(orientation)
    }
  }, [chosenSide, drawn, setOrientation])

  // コンテナの rotate / scale
  const containerAnim = useMemo(() => {
    switch (phase) {
      case 'rotating':
      case 'orienting':
        return { rotate: -90, scale: 1.15 }
      case 'transitioning':
        // -90° から
        //   左ボタン: 0° (CW 90°、左端が上に来る → 正位置)
        //   右ボタン: -180° (CCW 90°、右端が上に来る → 逆位置)
        return {
          rotate: chosenSide === 'left' ? 0 : -180,
          scale: 1.15,
        }
      default:
        return { rotate: 0, scale: 1 }
    }
  }, [phase, chosenSide])

  return (
    <PageTransition className="page page-shuffle">
      <p className="prompt">{PROMPTS[phase] || ' '}</p>

      <div className="shuffle-stage shuffle-stage--new">
        <motion.div
          className="shuffle-pile"
          animate={containerAnim}
          transition={{
            duration: phase === 'transitioning' ? 0.6 : 0.7,
            ease: 'easeInOut',
          }}
        >
          {Array.from({ length: N }, (_, i) => {
            const target =
              phase === 'shuffling' ? posShuffle(i, t) : targetFor(i, phase)
            const delay =
              phase === 'stacking3'
                ? stackDelay3(i, pile3Order)
                : phase === 'stacking2'
                  ? stackDelay2(i, chosenPile2)
                  : 0
            return (
              <motion.img
                key={i}
                src={CARD_BACK}
                alt=""
                className="shuffle-pile-card"
                animate={{
                  x: target.x,
                  y: target.y,
                  rotate: target.rotate,
                }}
                transition={
                  phase === 'shuffling'
                    ? { type: 'tween', duration: 0.05, ease: 'linear' }
                    : { type: 'spring', stiffness: 160, damping: 20, delay }
                }
              />
            )
          })}
        </motion.div>

        {/* 3山選択ボタン */}
        {phase === 'split3' && (
          <div className="pile-selectors pile-selectors--3">
            {[0, 1, 2].map((idx) => {
              const rank = pile3Order[idx]
              return (
                <button
                  key={idx}
                  type="button"
                  className={`pile-selector ${rank ? 'pile-selector--active' : ''}`}
                  onClick={() => togglePile3(idx)}
                  style={{ left: `calc(50% + ${(idx - 1) * 130}px)` }}
                  aria-label={`山 ${idx + 1}`}
                >
                  {rank && <span className="pile-badge">{rank}</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* 2山選択ボタン */}
        {phase === 'split2' && (
          <div className="pile-selectors pile-selectors--2">
            {[0, 1].map((idx) => {
              const active = chosenPile2 === idx
              return (
                <button
                  key={idx}
                  type="button"
                  className={`pile-selector ${active ? 'pile-selector--active' : ''}`}
                  onClick={() => togglePile2(idx as 0 | 1)}
                  style={{ left: `calc(50% + ${(idx === 0 ? -85 : 85)}px)` }}
                  aria-label={`山 ${idx + 1}`}
                >
                  {active && <span className="pile-badge">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* phase ごとのアクション */}
      {phase === 'shuffling' && (
        <button type="button" className="btn-primary" onClick={handleStop}>
          ストップ
        </button>
      )}
      {phase === 'split3' && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleStack3}
          disabled={!pile3Complete}
        >
          決定
        </button>
      )}
      {phase === 'split2' && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleStack2}
          disabled={chosenPile2 === null}
        >
          OK
        </button>
      )}
      {phase === 'orienting' && (
        <div className="orient-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleOrient('left')}
          >
            左
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleOrient('right')}
          >
            右
          </button>
        </div>
      )}
    </PageTransition>
  )
}
