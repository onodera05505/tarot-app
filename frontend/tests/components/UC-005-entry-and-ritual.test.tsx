// @vitest-environment jsdom
// UC-005（詳しく占う）の、始め方・直接到達・質問の途中で儀式へ移った占い・回答に左右されない抽選のテスト。
// 要件の文（REQ-038・042・048・108）と用語集・業務規則（BR-001・BR-002）だけを根拠に設計している
// （実装コードは参照していない）。期待値は公開データ（loadDeepCategory / tarotCards）から実行時に導出する。
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { DeepPage } from '../../src/pages/DeepPage'
import { ResultPage } from '../../src/pages/ResultPage'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { deepCategories, loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

function mountApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** 入口・カテゴリは button / link のどちらの role でも拾う */
function queryControl(name: string): HTMLElement | null {
  return (
    screen.queryByRole('button', { name }) ??
    screen.queryByRole('link', { name })
  )
}

/** 前の回の占い結果と、前に儀式へ持ち込んだカテゴリと回答が残っている状態を作る */
async function leavePreviousReading() {
  const work = await loadDeepCategory('work')
  const previous = {
    drawn: {
      card: tarotCards[3],
      orientation: 'reversed' as const,
      keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
    },
    deep: {
      categoryId: 'work' as const,
      categoryLabel: work.label,
      answers: work.questions.map((q) => q.choices[1].id),
    },
  }
  useReadingStore.setState({ status: 'drawn', error: null, ...previous })
  return previous
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// UC-005
describe('詳しく占う: トップの入口から始める', () => {
  // @covers REQ-038#start-from-entry
  it('トップで詳しく占うを始めると、カテゴリがすべて示される', async () => {
    mountApp('/')
    await waitFor(() => {
      expect(queryControl('詳しく占う')).not.toBeNull()
    })
    fireEvent.click(queryControl('詳しく占う')!)

    for (const category of deepCategories) {
      await waitFor(() => {
        expect(queryControl(category.label)).not.toBeNull()
      })
    }
  })

  // @covers REQ-038#discard-previous
  it('前の占い結果と前に持ち込んだカテゴリと回答が残っていても、始めた時点で占い状態が idle になり、どれも引き継がない', async () => {
    await leavePreviousReading()
    mountApp('/')
    await waitFor(() => {
      expect(queryControl('詳しく占う')).not.toBeNull()
    })
    fireEvent.click(queryControl('詳しく占う')!)
    await waitFor(() => {
      expect(queryControl(deepCategories[0].label)).not.toBeNull()
    })

    const state = useReadingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.drawn).toBeNull()
    expect(state.deep).toBeNull()
  })
})

// UC-005
describe('詳しく占う: トップの入口を経ない直接到達', () => {
  // @covers REQ-108#keeps-previous-state
  it('直接到達では、その時点の占い状態・前の占い結果・前に持ち込んだカテゴリと回答が変わらない', async () => {
    const previous = await leavePreviousReading()
    mountApp('/deep')
    await waitFor(() => {
      expect(queryControl(deepCategories[0].label)).not.toBeNull()
    })

    const state = useReadingStore.getState()
    expect(state.status).toBe('drawn')
    expect(state.drawn).toEqual(previous.drawn)
    expect(state.deep).toEqual(previous.deep)
  })
})

// UC-005
describe('詳しく占う: すべての質問に答える前に儀式へ移った占い', () => {
  // @covers REQ-042#normal-result-without-carried-answers
  it('1 問だけ答えて儀式へ移り結果の確定が起きると、占い結果は解説文を示し、カテゴリ名・ベース解釈・回答別アドバイスを示さない', async () => {
    const love = await loadDeepCategory('love')
    const answered = love.questions[0].choices[0]

    const router = createMemoryRouter(
      [
        { path: '/deep', element: <DeepPage /> },
        { path: '/shuffle', element: <ShufflePage /> },
        { path: '/result', element: <ResultPage /> },
        { path: '*', element: <div>OTHER_STUB</div> },
      ],
      { initialEntries: ['/deep'] },
    )
    render(<RouterProvider router={router} />)

    // カテゴリを選び、最初の質問にだけ答える
    fireEvent.click(await screen.findByRole('button', { name: love.label }))
    await screen.findByText(love.questions[0].text)
    fireEvent.click(screen.getByRole('button', { name: answered.label }))
    await screen.findByText(love.questions[1].text)

    // 残りに答えないまま儀式へ移る（直接到達）。儀式の自動の進行はタイマーで進める
    vi.useFakeTimers()
    await act(async () => {
      await router.navigate('/shuffle')
    })
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    vi.useRealTimers()

    const drawn = useReadingStore.getState().drawn
    expect(drawn).not.toBeNull()
    const { card, orientation, keywords } = drawn!

    await act(async () => {
      await router.navigate('/result')
    })

    const description =
      orientation === 'upright' ? card.descriptionUpright : card.descriptionReversed
    await waitFor(() => {
      expect(document.body.textContent).toContain(description)
    })

    const body = document.body.textContent ?? ''
    // カテゴリ名は、解説文とキーワードの中の同じ語を除いたうえで見る
    const rest = [description, ...keywords].reduce((text, part) => text.split(part).join(''), body)
    expect(rest).not.toContain(love.label)
    const base = love.base[card.number]
    expect(body).not.toContain(base.upright)
    expect(body).not.toContain(base.reversed)
    const advice = base.advice?.[answered.id]
    if (advice !== undefined) {
      expect(body).not.toContain(advice)
    }
  })
})

// UC-005
describe('詳しく占う: 抽選は回答に左右されない（BR-001）', () => {
  /** 儀式でストップを押して結果の確定を起こし、決まったカードと正逆を返す */
  async function drawThroughRitual(
    deep: { categoryId: 'work' | 'love'; categoryLabel: string; answers: string[] } | null,
  ) {
    useReadingStore.getState().reset()
    if (deep) useReadingStore.getState().setDeepContext(deep)
    render(
      <MemoryRouter initialEntries={['/shuffle']}>
        <ShufflePage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    const drawn = useReadingStore.getState().drawn
    cleanup()
    if (!drawn) throw new Error('結果の確定が起きなかった')
    return { cardId: drawn.card.id, orientation: drawn.orientation }
  }

  // 乱数の出方を固定すると、同じ出方からは同じカードと正逆が決まる（1 件目の前提の確認）。
  // そのうえで、回答・カテゴリを変えても決まるカードと正逆が変わらないことを見る
  // @covers REQ-048#draw-independent-of-answers
  it.each([0.03, 0.31, 0.5, 0.77, 0.97])('乱数の出方が同じ（%f）なら、回答やカテゴリが違っても同じカードと正逆が決まる', async (value) => {
    const work = await loadDeepCategory('work')
    const love = await loadDeepCategory('love')
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(value)

    const first = work.questions.map((q) => q.choices[0].id)
    const last = work.questions.map((q) => q.choices[q.choices.length - 1].id)

    const baseline = await drawThroughRitual({
      categoryId: 'work',
      categoryLabel: work.label,
      answers: first,
    })
    // 前提: 乱数の出方を固定すれば、同じ回答からは同じ結果が決まる
    const repeated = await drawThroughRitual({
      categoryId: 'work',
      categoryLabel: work.label,
      answers: first,
    })
    expect(repeated).toEqual(baseline)

    const otherAnswers = await drawThroughRitual({
      categoryId: 'work',
      categoryLabel: work.label,
      answers: last,
    })
    expect(otherAnswers).toEqual(baseline)

    const otherCategory = await drawThroughRitual({
      categoryId: 'love',
      categoryLabel: love.label,
      answers: love.questions.map((q) => q.choices[1].id),
    })
    expect(otherCategory).toEqual(baseline)
  })
})
