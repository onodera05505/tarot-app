// @vitest-environment jsdom
// UC-005（詳しく占う）の、カテゴリの文章の読み込みに関わる振る舞いのテスト。
// 要件の文（REQ-043・050・051）と用語集だけを根拠に設計している（実装コードは参照していない）。
// カテゴリの文章の読み込み（loadDeepCategory）だけを差し替え、読み込み中・失敗・
// 回答別アドバイスを持たない文章を作る。それ以外の期待値は公開データから実行時に導出する。
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepPage } from '../../src/pages/DeepPage'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'

type DeepModule = typeof import('../../src/data/deep/index')
type CategoryData = Awaited<ReturnType<DeepModule['loadDeepCategory']>>

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// カテゴリの文章の読み込みだけを差し替えられるようにする（既定は本物のまま）
vi.mock('../../src/data/deep/index', async (importOriginal) => {
  const actual = await importOriginal<DeepModule>()
  return { ...actual, loadDeepCategory: vi.fn(actual.loadDeepCategory) }
})

async function loadActual(id: Parameters<DeepModule['loadDeepCategory']>[0]): Promise<CategoryData> {
  const actual = await vi.importActual<DeepModule>('../../src/data/deep/index')
  return actual.loadDeepCategory(id)
}

function mountDeep() {
  return render(
    <MemoryRouter initialEntries={['/deep']}>
      <Routes>
        <Route path="/deep" element={<DeepPage />} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 読み込みの完了・失敗の後始末が画面へ反映されるのを待つ */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

/** 読み込み中はカテゴリが選べない形（非表示・無効）でもよいので、あれば押す */
function clickCategoryIfPresent(label: string) {
  const button = screen.queryByRole('button', { name: label })
  if (button) fireEvent.click(button)
}

const TEST_KEYWORDS = ['テスト専用キーワード甲', 'テスト専用キーワード乙']

/** カテゴリ名が解説文・カード名に偶然含まれないカードを選ぶ（カテゴリ名の有無を画面の文字で判定するため） */
function cardWithout(label: string) {
  const card = tarotCards.find(
    (c) =>
      !c.descriptionUpright.includes(label) &&
      !c.descriptionReversed.includes(label) &&
      !c.nameJa.includes(label),
  )
  if (!card) throw new Error('カテゴリ名を含まないカードが見つからない')
  return card
}

beforeEach(async () => {
  localStorage.clear()
  useReadingStore.getState().reset()
  const actual = await vi.importActual<DeepModule>('../../src/data/deep/index')
  vi.mocked(loadDeepCategory).mockReset()
  vi.mocked(loadDeepCategory).mockImplementation(actual.loadDeepCategory)
})

afterEach(() => {
  cleanup()
})

// UC-005
describe('詳しく占う: カテゴリの文章を読み込んでいる間の選択', () => {
  // @covers REQ-043#reject-other-while-loading
  it('読み込んでいる間に別のカテゴリを選んでも受け付けず、先に選んだカテゴリの質問が示される', async () => {
    const work = await loadActual('work')
    const love = await loadActual('love')
    expect(love.questions[0].text).not.toBe(work.questions[0].text)

    let finishLoading!: (data: CategoryData) => void
    vi.mocked(loadDeepCategory).mockImplementationOnce(
      () =>
        new Promise<CategoryData>((resolve) => {
          finishLoading = resolve
        }),
    )
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: work.label }))
    await waitFor(() => {
      expect(loadDeepCategory).toHaveBeenCalledTimes(1)
    })

    clickCategoryIfPresent(love.label)
    await settle()
    expect(loadDeepCategory).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishLoading(work)
    })
    expect(await screen.findByText(work.questions[0].text)).toBeTruthy()
    await settle()
    expect(screen.queryByText(love.questions[0].text)).toBeNull()
  })

  // @covers REQ-043#reject-same-while-loading
  it('読み込んでいる間に同じカテゴリをもう一度選んでも受け付けない（読み込みは 1 回だけ）', async () => {
    const work = await loadActual('work')

    let finishLoading!: (data: CategoryData) => void
    vi.mocked(loadDeepCategory).mockImplementationOnce(
      () =>
        new Promise<CategoryData>((resolve) => {
          finishLoading = resolve
        }),
    )
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: work.label }))
    await waitFor(() => {
      expect(loadDeepCategory).toHaveBeenCalledTimes(1)
    })

    clickCategoryIfPresent(work.label)
    await settle()
    expect(loadDeepCategory).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishLoading(work)
    })
    expect(await screen.findByText(work.questions[0].text)).toBeTruthy()
    await settle()
    expect(loadDeepCategory).toHaveBeenCalledTimes(1)
  })
})

// UC-005
describe('詳しく占う: 占い結果でカテゴリの文章を示せないとき', () => {
  async function setDeepResult() {
    const love = await loadActual('love')
    const card = cardWithout(love.label)
    const picked = love.questions.map((q) => q.choices[0])
    useReadingStore.setState({
      status: 'drawn',
      error: null,
      drawn: { card, orientation: 'upright', keywords: TEST_KEYWORDS },
      deep: {
        categoryId: 'love',
        categoryLabel: love.label,
        answers: picked.map((c) => c.id),
      },
    })
    return { love, card, picked }
  }

  function expectNoCategoryText(
    love: CategoryData,
    card: (typeof tarotCards)[number],
    picked: { id: string }[],
  ) {
    const body = document.body.textContent ?? ''
    expect(body).not.toContain(love.label)
    expect(body).not.toContain(love.base[card.number].upright)
    for (const choice of picked) {
      const advice = love.base[card.number].advice?.[choice.id]
      if (advice !== undefined) expect(body).not.toContain(advice)
    }
  }

  // @covers REQ-050#while-loading-falls-back
  it('読み込み終えるまでの間は、カテゴリ名・ベース解釈・回答別アドバイスを示さず、解説文を示す', async () => {
    const { love, card, picked } = await setDeepResult()
    vi.mocked(loadDeepCategory).mockImplementation(() => new Promise<CategoryData>(() => {}))
    mountResult()

    await waitFor(() => {
      expect(document.body.textContent).toContain(card.descriptionUpright)
    })
    await settle()
    expect(document.body.textContent).toContain(card.descriptionUpright)
    expectNoCategoryText(love, card, picked)
  })

  // @covers REQ-050#load-failure-falls-back
  it('読み込めなかった場合は、カテゴリ名・ベース解釈・回答別アドバイスを示さず、解説文を示す', async () => {
    const { love, card, picked } = await setDeepResult()
    vi.mocked(loadDeepCategory).mockImplementation(() =>
      Promise.reject(new Error('テスト専用の読み込み失敗')),
    )
    mountResult()

    await waitFor(() => {
      expect(loadDeepCategory).toHaveBeenCalled()
    })
    await settle()
    expect(document.body.textContent).toContain(card.descriptionUpright)
    expectNoCategoryText(love, card, picked)
  })
})

// UC-005
describe('詳しく占う: 回答別アドバイスが無い回答には回答別補足を示す', () => {
  /** 本物の文章を写し、すべての選択肢にテスト専用の回答別補足を持たせる */
  async function categoryWithSupplements() {
    const data = structuredClone(await loadActual('love'))
    for (const question of data.questions) {
      for (const choice of question.choices) {
        choice.fragment = `テスト専用の回答別補足_${choice.id}`
      }
    }
    return data
  }

  function setResult(data: CategoryData, card: (typeof tarotCards)[number], answers: string[]) {
    useReadingStore.setState({
      status: 'drawn',
      error: null,
      drawn: { card, orientation: 'upright', keywords: TEST_KEYWORDS },
      deep: { categoryId: 'love', categoryLabel: data.label, answers },
    })
  }

  // @covers REQ-051#supplement-when-no-advice
  it('引いたカードにどの回答の回答別アドバイスも無いと、回答ごとにその選択肢の回答別補足が示される', async () => {
    const data = await categoryWithSupplements()
    const card = tarotCards[0]
    delete data.base[card.number].advice
    const picked = [
      data.questions[0].choices[0],
      data.questions[1].choices[1],
      data.questions[2].choices[2],
    ]
    vi.mocked(loadDeepCategory).mockResolvedValue(data)
    setResult(data, card, picked.map((c) => c.id))
    mountResult()

    for (const choice of picked) {
      await waitFor(() => {
        expect(document.body.textContent).toContain(choice.fragment)
      })
    }
    // 選んでいない選択肢の回答別補足は示さない
    const pickedIds = new Set(picked.map((c) => c.id))
    for (const question of data.questions) {
      for (const choice of question.choices) {
        if (!pickedIds.has(choice.id)) {
          expect(document.body.textContent).not.toContain(choice.fragment)
        }
      }
    }
  })

  // @covers REQ-051#supplement-only-for-answers-without-advice
  it('回答別アドバイスがある回答と無い回答が混ざると、ある回答には回答別アドバイス、無い回答には回答別補足が示される', async () => {
    const data = await categoryWithSupplements()
    const card = tarotCards[0]
    const picked = [
      data.questions[0].choices[0],
      data.questions[1].choices[1],
      data.questions[2].choices[2],
    ]
    const adviceText = `テスト専用の回答別アドバイス_${picked[0].id}`
    data.base[card.number].advice = { [picked[0].id]: adviceText }
    vi.mocked(loadDeepCategory).mockResolvedValue(data)
    setResult(data, card, picked.map((c) => c.id))
    mountResult()

    await waitFor(() => {
      expect(document.body.textContent).toContain(adviceText)
    })
    for (const choice of [picked[1], picked[2]]) {
      await waitFor(() => {
        expect(document.body.textContent).toContain(choice.fragment)
      })
    }
  })
})
