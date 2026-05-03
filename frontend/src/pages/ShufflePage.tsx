import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { PageTransition } from '../components/animations/PageTransition'
import { useReadingStore } from '../store/useReadingStore'

const CARD_BACK = '/cards/major/000.webp'
const N = 12

type Phase =
  | 'intent'
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

// === シャッフル中の sub-phase（カードが本当に混ざる動き） ===
type ShuffleSub = 'sub-center' | 'sub-split3' | 'sub-split4' | 'sub-merge1' | 'sub-merge2' | 'sub-merge3'

const SHUFFLE_SEQ: { sub: ShuffleSub; ms: number }[] = [
  { sub: 'sub-center', ms: 700 },
  { sub: 'sub-split3', ms: 1500 },
  { sub: 'sub-center', ms: 800 },
  { sub: 'sub-split4', ms: 1300 },
  { sub: 'sub-merge1', ms: 420 },
  { sub: 'sub-merge2', ms: 420 },
  { sub: 'sub-merge3', ms: 420 },
]

// 3山の中心座標（小型端末でもはみ出さないよう±100）
const PX3 = [-100, 0, 100]
// 2山の中心座標
const PX2 = [-80, 80]
const P4 = [
  { x: -90, y: -50 },
  { x: 90, y: -50 },
  { x: -90, y: 50 },
  { x: 90, y: 50 },
]

function posShuffleSub(i: number, sub: ShuffleSub): Pos {
  const p3 = Math.floor(i / 4)
  const r3 = i % 4
  const p4 = Math.floor(i / 3)
  const r4 = i % 3

  switch (sub) {
    case 'sub-center':
      return { x: ((i % 4) - 1.5) * 2, y: Math.floor(i / 4) * 1.4, rotate: (i - 5.5) * 1.6 }
    case 'sub-split3':
      return { x: PX3[p3] + (r3 - 1.5) * 3, y: r3 * 2.5, rotate: (r3 - 1.5) * 8 }
    case 'sub-split4':
      return { x: P4[p4].x + (r4 - 1) * 3, y: P4[p4].y + r4 * 2.5, rotate: (r4 - 1) * 8 }
    case 'sub-merge1':
      return p4 === 0 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
    case 'sub-merge2':
      return p4 <= 1 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
    case 'sub-merge3':
      return p4 <= 2 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
  }
}

// === 各 phase のカード位置（rank ベース） ===

// rank: 0 = 一番下、N-1 = 一番上
// tightness: スタックの上下方向の見せ方。回転状態では小さくする（180°回転しても自然に見える）
function posCenter(rank: number, tightness = 1.4): Pos {
  return { x: 0, y: -rank * tightness, rotate: 0 }
}

// 3山分割: カードの初期所属（i 基準）に従う。rank はまだ確定していない。
function pos3Initial(i: number): Pos {
  const pile = Math.floor(i / 4)
  const inPile = i % 4
  return {
    x: PX3[pile] + (inPile - 1.5) * 0.8,
    y: -inPile * 1.6,
    rotate: 0,
  }
}

// 2山分割: rank に従って上半分(rank>=6)を左、下半分を右に
function pos2ByRank(rank: number): Pos {
  const isTopHalf = rank >= N / 2
  const inPile = rank % (N / 2)
  const pileX = isTopHalf ? PX2[0] : PX2[1]
  return {
    x: pileX + (inPile - 2.5) * 0.8,
    y: -inPile * 1.6,
    rotate: 0,
  }
}

// 回転状態などタイトに見せたい場合のオフセット係数
function getStackTightness(phase: Phase): number {
  if (phase === 'rotating' || phase === 'orienting' || phase === 'transitioning') {
    return 0.5
  }
  return 1.4
}

// === rank の更新ロジック ===

function ranksAfterStack3(pile3Order: Record<number, number>): number[] {
  // pile3Order: pileIdx -> 1|2|3（ユーザーが選んだ順位）
  // rank=1 のカードが上に来るよう (3-rank)*4 + inPile で位置を割り当て
  const out = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    const pile = Math.floor(i / 4)
    const inPile = i % 4
    const order = pile3Order[pile] // 1, 2, or 3
    out[i] = (3 - order) * 4 + inPile // rank3→0..3、rank2→4..7、rank1→8..11
  }
  return out
}

function ranksAfterStack2(currentRanks: number[], chosenPile2: 0 | 1): number[] {
  // chosenPile2 0 = 左（現在の上半分）、1 = 右（現在の下半分）
  // 選ばれた側の rank が 6-11、選ばれなかった側が 0-5 になるよう振り直し
  const out = [...currentRanks]
  for (let i = 0; i < N; i++) {
    const isTopHalf = currentRanks[i] >= N / 2
    const inSelected = (chosenPile2 === 0 && isTopHalf) || (chosenPile2 === 1 && !isTopHalf)
    if (inSelected) {
      out[i] = isTopHalf ? currentRanks[i] : currentRanks[i] + N / 2
    } else {
      out[i] = isTopHalf ? currentRanks[i] - N / 2 : currentRanks[i]
    }
  }
  return out
}

// === 積み上げ時の遅延 ===

// 中央（pile=1）を据え置き、両側の山が「中央に乗る or 下に潜る」順序を case 分けで決める。
// ユーザー仕様:
//   - 中央=2: まず 1 を上に → 次に 3 を下に
//   - 中央=1: まず 2 を下に → 次に 3 をさらに下に
//   - 中央=3: まず 2 を上に → 次に 1 をさらに上に
function stackDelay3(i: number, pile3Order: Record<number, number>): number {
  const pile = Math.floor(i / 4)
  // 中央の山は据え置き（即座にアニメ完了 = 動かない）
  if (pile === 1) return 0

  const centerRank = pile3Order[1]
  const myRank = pile3Order[pile]

  // どの rank が「最初に動く側」か
  let firstRank: number
  if (centerRank === 1) firstRank = 2
  else if (centerRank === 3) firstRank = 2
  else firstRank = 1 // centerRank === 2

  return myRank === firstRank ? 0.4 : 0.95
}

// stacking2: 選ばれた山（上に乗せる側）に遅延を付ける
function stackDelay2(currentRanks: number[], i: number, chosenPile2: 0 | 1 | null): number {
  if (chosenPile2 === null) return 0
  const isTopHalf = currentRanks[i] >= N / 2
  const inSelected = (chosenPile2 === 0 && isTopHalf) || (chosenPile2 === 1 && !isTopHalf)
  return inSelected ? 0.55 : 0
}

const PROMPTS: Record<Phase, string> = {
  intent: '',
  shuffling: 'シャッフルを止めてください',
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
  const { drawn, drawOne, reset } = useReadingStore(
    useShallow((s) => ({
      drawn: s.drawn,
      drawOne: s.drawOne,
      reset: s.reset,
    })),
  )

  const [phase, setPhase] = useState<Phase>('intent')

  // シャッフル sub-phase 進行
  const [subIdx, setSubIdx] = useState(0)
  useEffect(() => {
    if (phase !== 'shuffling') return
    const cur = SHUFFLE_SEQ[subIdx % SHUFFLE_SEQ.length]
    const t = window.setTimeout(() => setSubIdx((n) => n + 1), cur.ms)
    return () => window.clearTimeout(t)
  }, [phase, subIdx])

  // カードのスタック内 rank（0=底, N-1=最上段）
  const [cardRanks, setCardRanks] = useState<number[]>(() =>
    Array.from({ length: N }, (_, i) => i),
  )

  // 3山選択（pileIdx -> rank 1|2|3）
  const [pile3Order, setPile3Order] = useState<Record<number, number>>({})
  const pile3Complete = Object.keys(pile3Order).length === 3

  // 2山選択
  const [chosenPile2, setChosenPile2] = useState<0 | 1 | null>(null)

  // 「上の側」（演出のみ、向きはバックエンドのランダム値を使う）
  const [chosenSide, setChosenSide] = useState<'left' | 'right' | null>(null)

  // 自動進行する phase のタイマー
  useEffect(() => {
    let timer: number | undefined
    if (phase === 'merging') {
      timer = window.setTimeout(() => setPhase('split3'), 900)
    } else if (phase === 'stacking3') {
      // 最大遅延 0.95s + spring 余韻 ≈ 2.0s
      timer = window.setTimeout(() => setPhase('split2'), 2000)
    } else if (phase === 'stacking2') {
      timer = window.setTimeout(() => setPhase('rotating'), 1200)
    } else if (phase === 'rotating') {
      timer = window.setTimeout(() => setPhase('orienting'), 850)
    } else if (phase === 'transitioning') {
      timer = window.setTimeout(() => navigate('/result'), 650)
    }
    return () => window.clearTimeout(timer)
  }, [phase, navigate])

  const handleStop = () => {
    if (phase !== 'shuffling') return
    reset()
    drawOne()
    setPhase('merging')
  }

  const togglePile3 = (pileIdx: number) => {
    if (phase !== 'split3') return
    setPile3Order((current) => {
      const next = { ...current }
      if (next[pileIdx]) {
        const removed = next[pileIdx]
        delete next[pileIdx]
        for (const k of Object.keys(next)) {
          const idx = Number(k)
          if (next[idx] > removed) next[idx] -= 1
        }
      } else {
        const used = new Set(Object.values(next))
        let r = 1
        while (used.has(r)) r += 1
        if (r <= 3) next[pileIdx] = r
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
    // ranks を更新してからアニメーション開始
    setCardRanks(ranksAfterStack3(pile3Order))
    setPhase('stacking3')
  }

  const handleStack2 = () => {
    if (chosenPile2 === null) return
    setCardRanks((curr) => ranksAfterStack2(curr, chosenPile2))
    setPhase('stacking2')
  }

  const handleOrient = (side: 'left' | 'right') => {
    if (phase !== 'orienting') return
    setChosenSide(side)
    // 向きはバックエンドのランダム値をそのまま使う（左右選択は儀式の演出のみ）
    setPhase('transitioning')
  }

  // コンテナの rotate / scale
  const containerAnim = useMemo(() => {
    switch (phase) {
      case 'rotating':
      case 'orienting':
        return { rotate: -90, scale: 1.15 }
      case 'transitioning':
        // 左 → CW 90° → 0° / 右 → CCW 90° → -180°
        return {
          rotate: chosenSide === 'left' ? 0 : -180,
          scale: 1.15,
        }
      default:
        return { rotate: 0, scale: 1 }
    }
  }, [phase, chosenSide])

  // 各カードのターゲット位置を計算
  const getTarget = (i: number): Pos => {
    if (phase === 'shuffling') {
      const sub = SHUFFLE_SEQ[subIdx % SHUFFLE_SEQ.length].sub
      return posShuffleSub(i, sub)
    }
    if (phase === 'split3') return pos3Initial(i)
    if (phase === 'split2') return pos2ByRank(cardRanks[i])
    return posCenter(cardRanks[i], getStackTightness(phase))
  }

  const getDelay = (i: number): number => {
    if (phase === 'stacking3') return stackDelay3(i, pile3Order)
    if (phase === 'stacking2') {
      // stacking2 開始時には ranks は既に更新済み。delay 判定用に元の所属を計算する
      // → ranks 更新前のロジックに沿うため、現在 ranks の上半分/下半分判定で OK
      // （update 後も chosenPile2 が指す側のカードは新 rank が 6-11 になっており、判定は同じ）
      return stackDelay2(cardRanks, i, chosenPile2)
    }
    return 0
  }

  // 占うことを思い浮かべる画面
  if (phase === 'intent') {
    return (
      <PageTransition className="page page-shuffle">
        <div className="intent-screen">
          <div className="intent-glow" aria-hidden />
          <motion.div
            className="intent-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <span className="intent-divider" aria-hidden>✦</span>
            <p className="intent-text">
              占うことを<br />思い浮かべてください
            </p>
            <span className="intent-divider" aria-hidden>✦</span>
          </motion.div>
          <motion.button
            type="button"
            className="btn-primary"
            onClick={() => setPhase('shuffling')}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            シャッフルへ
          </motion.button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="page page-shuffle">
      <p className="prompt">{PROMPTS[phase] || ' '}</p>

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
            const target = getTarget(i)
            const delay = getDelay(i)
            return (
              <motion.img
                key={i}
                src={CARD_BACK}
                alt=""
                className="shuffle-pile-card"
                animate={{ x: target.x, y: target.y, rotate: target.rotate }}
                transition={{
                  type: 'spring',
                  stiffness: 160,
                  damping: 20,
                  delay,
                }}
                style={{ zIndex: cardRanks[i] }}
              />
            )
          })}
        </motion.div>

        {phase === 'split3' && (
          <div className="pile-selectors">
            {[0, 1, 2].map((idx) => {
              const rank = pile3Order[idx]
              return (
                <button
                  key={idx}
                  type="button"
                  className={`pile-selector ${rank ? 'pile-selector--active' : ''}`}
                  onClick={() => togglePile3(idx)}
                  style={{ left: `calc(50% + ${(idx - 1) * PX3[2]}px)` }}
                  aria-label={`山 ${idx + 1}`}
                >
                  {rank && <span className="pile-badge">{rank}</span>}
                </button>
              )
            })}
          </div>
        )}

        {phase === 'split2' && (
          <div className="pile-selectors">
            {[0, 1].map((idx) => {
              const active = chosenPile2 === idx
              return (
                <button
                  key={idx}
                  type="button"
                  className={`pile-selector ${active ? 'pile-selector--active' : ''}`}
                  onClick={() => togglePile2(idx as 0 | 1)}
                  style={{ left: `calc(50% + ${PX2[idx]}px)` }}
                  aria-label={`山 ${idx + 1}`}
                >
                  {active && <span className="pile-badge">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

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

      {/* drawn を取り敢えず参照しておかないと TS の unused 警告が出るので、
          API エラー時に保険メッセージを出す */}
      {drawn === null && phase === 'orienting' && (
        <p className="step-label" style={{ opacity: 0.5 }}>
          カードを引いています…
        </p>
      )}
    </PageTransition>
  )
}
