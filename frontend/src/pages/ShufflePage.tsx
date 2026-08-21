import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { PageTransition } from '../components/animations/PageTransition'
import { useReadingStore } from '../store/useReadingStore'

const CARD_BACK = '/cards/major/000.webp'
// 大アルカナ 22 枚
const N = 22

// 3 山分割の山サイズ（中央が 8、左右 7）
const PILE3_SIZES = [7, 8, 7]
function getPile3(i: number): number {
  if (i < 7) return 0
  if (i < 15) return 1
  return 2
}
function getInPile3(i: number): number {
  if (i < 7) return i
  if (i < 15) return i - 7
  return i - 15
}

// 4 山分割（シャッフルアニメ用）: 5/6/6/5
const PILE4_SIZES = [5, 6, 6, 5]
function getPile4(i: number): number {
  if (i < 5) return 0
  if (i < 11) return 1
  if (i < 17) return 2
  return 3
}
function getInPile4(i: number): number {
  if (i < 5) return i
  if (i < 11) return i - 5
  if (i < 17) return i - 11
  return i - 17
}

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

type Pos = { x: number; y: number; z: number; rotate: number }

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

// 3山中心の x 座標（ユーザー操作の split3 / 山選択用）
const PX3 = [-100, 0, 100]
// 2山中心の x 座標
const PX2 = [-78, 78]

// シャッフル中のみ使う山中心。22 枚分の厚みと回転を吸収するため、
// ユーザー操作 split3 より広めに取る。
const SHUFFLE_PX3 = [-118, 0, 118]
const SHUFFLE_P4 = [
  { x: -108, y: -68 },
  { x: 108, y: -68 },
  { x: -108, y: 68 },
  { x: 108, y: 68 },
]

// 1 枚あたりの厚み（z 軸オフセット）
const CARD_DEPTH = 0.9
// インパイル方向の y 微オフセット（22 枚で潰れすぎないように小さめ）
const PILE_INNER_Y = 0.5

function posShuffleSub(i: number, sub: ShuffleSub): Pos {
  const p3 = getPile3(i)
  const r3 = getInPile3(i)
  const p4 = getPile4(i)
  const r4 = getInPile4(i)

  switch (sub) {
    case 'sub-center': {
      const col = i % 5
      const row = Math.floor(i / 5)
      return {
        x: (col - 2) * 1.4,
        y: row * 0.8,
        z: i * CARD_DEPTH,
        rotate: (i - (N - 1) / 2) * 0.8,
      }
    }
    case 'sub-split3': {
      const center = (PILE3_SIZES[p3] - 1) / 2
      // 各カードの横ずれ・回転を控えめにし、山同士が触れないようにする
      return {
        x: SHUFFLE_PX3[p3] + (r3 - center) * 0.5,
        y: r3 * 0.7,
        z: r3 * CARD_DEPTH,
        rotate: (r3 - center) * 2,
      }
    }
    case 'sub-split4': {
      const center = (PILE4_SIZES[p4] - 1) / 2
      return {
        x: SHUFFLE_P4[p4].x + (r4 - center) * 0.5,
        y: SHUFFLE_P4[p4].y + r4 * 0.7,
        z: r4 * CARD_DEPTH,
        rotate: (r4 - center) * 2.5,
      }
    }
    case 'sub-merge1':
      return p4 === 0 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
    case 'sub-merge2':
      return p4 <= 1 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
    case 'sub-merge3':
      return p4 <= 2 ? posShuffleSub(i, 'sub-center') : posShuffleSub(i, 'sub-split4')
  }
}

// === 各 phase のカード位置（rank ベース） ===

function posCenter(rank: number, tightness: number, depth: number): Pos {
  return {
    x: 0,
    y: -rank * tightness,
    z: rank * depth,
    rotate: 0,
  }
}

// 3 山分割: カードの初期所属（i 基準）。rank はまだ確定していない。
function pos3Initial(i: number): Pos {
  const pile = getPile3(i)
  const inPile = getInPile3(i)
  return {
    x: PX3[pile],
    y: -inPile * PILE_INNER_Y,
    z: inPile * CARD_DEPTH,
    rotate: 0,
  }
}

// 2 山分割: rank に従って上半分(rank>=N/2)を左、下半分を右
function pos2ByRank(rank: number): Pos {
  const half = N / 2
  const isTopHalf = rank >= half
  const inPile = isTopHalf ? rank - half : rank
  return {
    x: isTopHalf ? PX2[0] : PX2[1],
    y: -inPile * PILE_INNER_Y,
    z: inPile * CARD_DEPTH,
    rotate: 0,
  }
}

// 回転以降はスタックを薄く詰める（180°反転しても上下のずれが目立たないように）
function getStackTightness(phase: Phase): number {
  if (phase === 'rotating' || phase === 'orienting' || phase === 'transitioning') {
    return 0.18
  }
  return 0.55
}

function getStackDepth(phase: Phase): number {
  if (phase === 'rotating' || phase === 'orienting' || phase === 'transitioning') {
    return 0.35
  }
  return CARD_DEPTH
}

// === rank の更新ロジック ===

function ranksAfterStack3(pile3Order: Record<number, number>): number[] {
  const out = new Array<number>(N)
  // 各 rank の山の sizes を確定
  const sizesByOrder: Record<number, number> = {}
  for (const p of [0, 1, 2]) {
    sizesByOrder[pile3Order[p]] = PILE3_SIZES[p]
  }
  // 山が始まる rank（下から順に積む: rank 3 が一番下）
  const startByOrder: Record<number, number> = {
    3: 0,
    2: sizesByOrder[3],
    1: sizesByOrder[3] + sizesByOrder[2],
  }
  for (let i = 0; i < N; i++) {
    const pile = getPile3(i)
    const inPile = getInPile3(i)
    const order = pile3Order[pile]
    out[i] = startByOrder[order] + inPile
  }
  return out
}

function ranksAfterStack2(currentRanks: number[], chosenPile2: 0 | 1): number[] {
  const out = [...currentRanks]
  const half = N / 2 // 11
  for (let i = 0; i < N; i++) {
    const isTopHalf = currentRanks[i] >= half
    const inSelected = (chosenPile2 === 0 && isTopHalf) || (chosenPile2 === 1 && !isTopHalf)
    if (inSelected) {
      out[i] = isTopHalf ? currentRanks[i] : currentRanks[i] + half
    } else {
      out[i] = isTopHalf ? currentRanks[i] - half : currentRanks[i]
    }
  }
  return out
}

// === 積み上げ時の遅延 ===

// 中央（pile=1）を据え置き、両側を case 分けで動かす。
//   - 中央=2: 1 を上に → 3 を下に
//   - 中央=1: 2 を下に → 3 をさらに下に
//   - 中央=3: 2 を上に → 1 をさらに上に
function stackDelay3(i: number, pile3Order: Record<number, number>): number {
  const pile = getPile3(i)
  if (pile === 1) return 0

  const centerRank = pile3Order[1]
  const myRank = pile3Order[pile]

  let firstRank: number
  if (centerRank === 1) firstRank = 2
  else if (centerRank === 3) firstRank = 2
  else firstRank = 1

  return myRank === firstRank ? 0.4 : 0.95
}

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
  const { drawn, drawOne } = useReadingStore(
    useShallow((s) => ({
      drawn: s.drawn,
      drawOne: s.drawOne,
    })),
  )

  const [phase, setPhase] = useState<Phase>('intent')

  const [subIdx, setSubIdx] = useState(0)
  useEffect(() => {
    if (phase !== 'shuffling') return
    const cur = SHUFFLE_SEQ[subIdx % SHUFFLE_SEQ.length]
    const t = window.setTimeout(() => setSubIdx((n) => n + 1), cur.ms)
    return () => window.clearTimeout(t)
  }, [phase, subIdx])

  const [cardRanks, setCardRanks] = useState<number[]>(() =>
    Array.from({ length: N }, (_, i) => i),
  )

  const [pile3Order, setPile3Order] = useState<Record<number, number>>({})
  const pile3Complete = Object.keys(pile3Order).length === 3

  const [chosenPile2, setChosenPile2] = useState<0 | 1 | null>(null)
  const [chosenSide, setChosenSide] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    let timer: number | undefined
    if (phase === 'merging') {
      timer = window.setTimeout(() => setPhase('split3'), 900)
    } else if (phase === 'stacking3') {
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
    // ここで reset() を呼んではいけない: 詳しく占うの文脈（deep）が消え、
    // 結果画面が通常表示に落ちる（2026-08-21 の不具合）。前回の drawn/status は
    // drawOne() が上書きするので個別のクリアも不要
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
    setPhase('transitioning')
  }

  // コンテナの 3D 変換: rotateX (傾き) + rotateZ (回転フェーズ) + scale
  const containerAnim = useMemo(() => {
    switch (phase) {
      case 'rotating':
      case 'orienting':
        // 横倒し時はやや傾きを浅く（ゲーム的すぎないように）
        return { rotateX: 14, rotateZ: -90, scale: 1.1 }
      case 'transitioning':
        // 結果画面の正対視点へなめらかに繋ぐためフラットに
        return {
          rotateX: 0,
          rotateZ: chosenSide === 'left' ? 0 : -180,
          scale: 1.05,
        }
      default:
        // 通常はテーブル上のカードを少し前のめりで覗く視点
        return { rotateX: 22, rotateZ: 0, scale: 1 }
    }
  }, [phase, chosenSide])

  const getTarget = (i: number): Pos => {
    if (phase === 'shuffling') {
      const sub = SHUFFLE_SEQ[subIdx % SHUFFLE_SEQ.length].sub
      return posShuffleSub(i, sub)
    }
    if (phase === 'split3') return pos3Initial(i)
    if (phase === 'split2') return pos2ByRank(cardRanks[i])
    return posCenter(cardRanks[i], getStackTightness(phase), getStackDepth(phase))
  }

  const getDelay = (i: number): number => {
    if (phase === 'stacking3') return stackDelay3(i, pile3Order)
    if (phase === 'stacking2') return stackDelay2(cardRanks, i, chosenPile2)
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

      <div className="shuffle-stage shuffle-stage--3d">
        <motion.div
          className="shuffle-pile shuffle-pile--3d"
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
              <motion.div
                key={i}
                className="shuffle-pile-card"
                animate={{
                  x: target.x,
                  y: target.y,
                  z: target.z,
                  rotate: target.rotate,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 160,
                  damping: 20,
                  delay,
                }}
                style={{ zIndex: cardRanks[i] }}
              >
                <img
                  className="shuffle-pile-card-face"
                  src={CARD_BACK}
                  alt=""
                  draggable={false}
                />
                {/* カードの紙の側面（厚み）。preserve-3d により親の傾きで自然に見える */}
                <span className="shuffle-pile-card-edge" aria-hidden />
              </motion.div>
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

      {drawn === null && phase === 'orienting' && (
        <p className="step-label" style={{ opacity: 0.5 }}>
          カードを引いています…
        </p>
      )}
    </PageTransition>
  )
}
