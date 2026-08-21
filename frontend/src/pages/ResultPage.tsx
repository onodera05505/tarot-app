import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { CardReveal } from '../components/animations/CardReveal'
import { PageTransition } from '../components/animations/PageTransition'
import { loadDeepCategory } from '../data/deep'
import type { DeepCategoryData } from '../data/deep'
import { generateShareImage, shareOrDownload } from '../lib/shareImage'
import { useReadingStore } from '../store/useReadingStore'

function calcWidths() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800
  const flip = Math.min(Math.max(Math.round(w * 0.52), 180), 280)
  const settled = w < 640 ? Math.round(flip * 0.62) : flip
  return { flip, settled }
}

export function ResultPage() {
  const navigate = useNavigate()
  const [cardSettled, setCardSettled] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [sharing, setSharing] = useState(false)
  const widths = useMemo(calcWidths, [])

  const { drawn, status, error, deep, reset } = useReadingStore(
    useShallow((s) => ({
      drawn: s.drawn,
      status: s.status,
      error: s.error,
      deep: s.deep,
      reset: s.reset,
    })),
  )

  // 詳しく占うの場合、カテゴリデータを再取得する（動的 import はモジュール
  // キャッシュが効くため、/deep で読み込み済みなら即座に解決する）
  const [deepData, setDeepData] = useState<DeepCategoryData | null>(null)
  useEffect(() => {
    if (!deep) {
      setDeepData(null)
      return
    }
    let cancelled = false
    loadDeepCategory(deep.categoryId)
      .then((d) => {
        if (!cancelled) setDeepData(d)
      })
      .catch(() => {
        // 読み込み失敗時は通常の解説文にフォールバックする
        if (!cancelled) setDeepData(null)
      })
    return () => {
      cancelled = true
    }
  }, [deep])

  if (status === 'idle') return <Navigate to="/" replace />

  if (status === 'drawing') {
    return (
      <PageTransition className="page page-result">
        <p className="step-label">カードを引いています...</p>
      </PageTransition>
    )
  }

  if (status === 'error' || !drawn) {
    return (
      <PageTransition className="page page-result">
        <p className="error">エラー: {error ?? 'カードを取得できませんでした'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </PageTransition>
    )
  }

  const { card, orientation, keywords } = drawn
  const description =
    orientation === 'upright' ? card.descriptionUpright : card.descriptionReversed

  // 詳しく占うの合成（v3.1 §4.5）: ベース解釈 + 回答別補足 3 本
  const deepBase =
    deep && deepData ? (deepData.base[card.number]?.[orientation] ?? null) : null
  const deepFragments =
    deep && deepData
      ? deep.answers
          .map(
            (answerId, i) =>
              deepData.questions[i]?.choices.find((c) => c.id === answerId)
                ?.fragment,
          )
          .filter((f): f is string => Boolean(f))
      : []

  const handleHome = () => {
    reset()
    navigate('/')
  }

  // TopPage の「スタート」と同じ手順（reset → /shuffle）で揃える
  const handleRetry = () => {
    reset()
    navigate('/shuffle')
  }

  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const blob = await generateShareImage(drawn)
      const text = `${card.nameJa}（${orientation === 'upright' ? '正位置' : '逆位置'}）`
      await shareOrDownload(blob, `tarot-${card.id}.png`, text)
    } catch (e) {
      console.error('Share failed:', e)
    } finally {
      setSharing(false)
    }
  }

  return (
    <PageTransition className="page page-result">
      <button
        type="button"
        className="card-tap-button"
        onClick={() => cardSettled && setEnlarged(true)}
        disabled={!cardSettled}
        aria-label="カードを拡大表示"
      >
        <CardReveal
          imageUrl={card.imageUrl}
          alt={card.nameJa}
          reversed={orientation === 'reversed'}
          width={cardSettled ? widths.settled : widths.flip}
          onFlipComplete={() => setCardSettled(true)}
        />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={cardSettled ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="result-info"
      >
        <h2 className="result-name">{card.nameJa}</h2>
        <p className="result-orientation">
          {orientation === 'upright' ? '正位置' : '逆位置'}
        </p>
        <ul className="result-keywords">
          {keywords.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        {deep && deepBase ? (
          <div className="result-deep">
            <span className="result-category">{deep.categoryLabel}</span>
            <p className="result-description">{deepBase}</p>
            {deepFragments.length > 0 && (
              <ul className="result-deep-advice">
                {deepFragments.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          description && <p className="result-description">{description}</p>
        )}
        <div className="result-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? '画像を作成中...' : 'この結果をシェア'}
          </button>
          <button type="button" className="btn-ghost" onClick={handleRetry}>
            もう一度占う
          </button>
          <button type="button" className="btn-ghost" onClick={handleHome}>
            トップへ戻る
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {enlarged && (
          <motion.div
            key="card-zoom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="card-zoom-overlay"
            onClick={() => setEnlarged(false)}
            role="button"
            aria-label="閉じる"
          >
            <motion.div
              className="card-zoom-content"
              initial={{ scale: 0.55 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.55 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <img
                src={card.imageUrl}
                alt={card.nameJa}
                className="card-zoom-image"
                style={{ transform: orientation === 'reversed' ? 'rotate(180deg)' : undefined }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
