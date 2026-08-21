import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/animations/PageTransition'
import { deepCategories, loadDeepCategory } from '../data/deep'
import type { DeepCategoryData, DeepCategoryId } from '../data/deep'
import { useReadingStore } from '../store/useReadingStore'

// 詳しく占う（仕様書 v3.1 §5.7）: カテゴリ選択 → 質問 3 問 → /shuffle へ。
// 回答はカードの抽選に影響しない（表示する解釈テキストの選択にのみ使う）。

export function DeepPage() {
  const navigate = useNavigate()
  const setDeepContext = useReadingStore((s) => s.setDeepContext)

  const [data, setData] = useState<DeepCategoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 0 = カテゴリ選択、1〜3 = 質問
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])

  const pickCategory = async (id: DeepCategoryId) => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const loaded = await loadDeepCategory(id)
      setData(loaded)
      setAnswers([])
      setStep(1)
    } catch {
      setError('データを読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }

  const pickChoice = (choiceId: string) => {
    if (!data) return
    const next = [...answers]
    next[step - 1] = choiceId
    setAnswers(next)
    if (step < 3) {
      setStep(step + 1)
      return
    }
    setDeepContext({
      categoryId: data.id,
      categoryLabel: data.label,
      answers: next,
    })
    navigate('/shuffle')
  }

  const goBack = () => {
    if (step === 0) {
      navigate('/')
      return
    }
    if (step === 1) {
      // カテゴリ選択に戻る。カテゴリを選び直す可能性があるため回答は破棄する
      setData(null)
      setAnswers([])
      setStep(0)
      return
    }
    setStep(step - 1)
  }

  const question = data && step >= 1 ? data.questions[step - 1] : null

  return (
    <PageTransition className="page page-deep">
      {step === 0 ? (
        <motion.div
          className="deep-section"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="deep-title">詳しく占う</h1>
          <p className="step-label">占いたいテーマを選んでください</p>
          <div className="deep-options">
            {deepCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="deep-option"
                onClick={() => pickCategory(cat.id)}
                disabled={loading}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {loading && <p className="step-label">読み込み中...</p>}
          {error && <p className="error">{error}</p>}
        </motion.div>
      ) : (
        question && (
          <motion.div
            key={question.id}
            className="deep-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="deep-progress">{step} / 3</span>
            <p className="deep-question">{question.text}</p>
            <div className="deep-options">
              {question.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`deep-option ${
                    answers[step - 1] === choice.id ? 'deep-option--active' : ''
                  }`}
                  onClick={() => pickChoice(choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </motion.div>
        )
      )}

      <button type="button" className="btn-ghost" onClick={goBack}>
        戻る
      </button>
    </PageTransition>
  )
}
