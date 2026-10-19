// @vitest-environment jsdom
// UC-006 の要件の文（REQ-132）と業務規則（BR-002）・用語集・UC-006 の表（儀式へ直接到達する列）だけから設計した、
// スタートも持ち込む操作も経ない儀式への直接到達が占い状態を初期化することのテスト（実装は参照していない）。
// 準備と問い合わせ方は UC-006-ritual-steps.test.tsx に倣う。直接到達はアドレスの指定（儀式を最初の履歴として開く）と、
// 占い結果からのブラウザの戻る（メモリ上の履歴を 1 つ戻る）で代表させる。
// 初期化後の値の SSOT は `reset` が戻す初期値（BR-002）なので、期待値は reset 直後の値から取る。
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

/** 前の回の占い結果 */
const previousDrawn: DrawnCard = {
  card: tarotCards[7],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 前の回に儀式へ持ち込んだカテゴリとすべての質問の回答 */
async function carriedDeep() {
  const love = await loadDeepCategory('love')
  return {
    categoryId: 'love' as const,
    categoryLabel: love.label,
    answers: love.questions.map((q) => q.choices[0].id),
  }
}

type Leftover = Pick<ReturnType<typeof useReadingStore.getState>, 'status' | 'drawn' | 'error' | 'deep'>

/** 占い状態のうち、初期化の対象になる値 */
function pick(): Leftover {
  const { status, drawn, error, deep } = useReadingStore.getState()
  return { status, drawn, error, deep }
}

/**
 * 直接到達の前に残っている前の回の名残。UC-006 の表で REQ-132 が当たる行（儀式の外の各占い状態・占い結果の各占い状態）と、
 * UC-005 の表の持ち込んでいる行を、占い状態 × 持ち込みの有無の組で代表させる
 */
const leftovers = [
  {
    name: '占い結果・儀式の外（drawn）・通常占い',
    state: async (): Promise<Leftover> => ({ status: 'drawn', drawn: previousDrawn, error: null, deep: null }),
  },
  {
    name: '占い結果・儀式の外（drawn）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'drawn', drawn: previousDrawn, error: null, deep: await carriedDeep() }),
  },
  {
    name: '占い結果・儀式の外（error）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'error', drawn: null, error: 'テスト専用の抽選失敗', deep: await carriedDeep() }),
  },
  {
    name: '儀式の外（drawing）・通常占い',
    state: async (): Promise<Leftover> => ({ status: 'drawing', drawn: null, error: null, deep: null }),
  },
  {
    name: '儀式の外（idle）・持ち込んでいる（持ち込んだあとストップの前に離れた）',
    state: async (): Promise<Leftover> => ({ status: 'idle', drawn: null, error: null, deep: await carriedDeep() }),
  },
]

/** アドレスの指定で儀式を開く（スタートも持ち込む操作も経ていない） */
function reachByAddress() {
  return render(
    <MemoryRouter initialEntries={['/shuffle']}>
      <Routes>
        <Route path="/shuffle" element={<ShufflePage />} />
        <Route path="/result" element={<div>RESULT_STUB</div>} />
        <Route path="/" element={<div>HOME_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 占い結果を開いている状態から、ブラウザの戻るで儀式へ着く */
async function reachByBackFromResult() {
  const router = createMemoryRouter(
    [
      { path: '/shuffle', element: <ShufflePage /> },
      { path: '/result', element: <div>RESULT_STUB</div> },
      { path: '/', element: <div>HOME_STUB</div> },
    ],
    { initialEntries: ['/shuffle', '/result'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  expect(screen.getByText('RESULT_STUB')).toBeTruthy()
  await act(async () => {
    await router.navigate(-1)
  })
}

/** 占うことを思い浮かべる段階にいること（案内と「シャッフルへ」があり、先の段階の操作が無い） */
function expectIntentPhase() {
  expect(screen.getByText(/占うことを/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'ストップ' })).toBeNull()
  expect(screen.queryByRole('button', { name: '山 1' })).toBeNull()
  expect(screen.queryByRole('button', { name: '左' })).toBeNull()
}

/** 初期化後の値（BR-002 の SSOT: reset が戻す初期値） */
let initial: Leftover

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useReadingStore.getState().reset()
  initial = pick()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// UC-006
describe('儀式: スタートも持ち込む操作も経ない直接到達', () => {
  // @covers REQ-132#discard-previous
  it.each(leftovers)('$name の名残があっても、アドレスの指定で儀式へ直接到達した時点で占い状態が idle になり、前の占い結果も持ち込んだカテゴリと回答も引き継がない', async ({ state }) => {
    useReadingStore.setState(await state())
    reachByAddress()
    expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()

    expect(pick()).toEqual(initial)
    expect(pick().status).toBe('idle')
    expect(pick().drawn).toBeNull()
    expect(pick().deep).toBeNull()
  })

  // @covers REQ-132#discard-previous
  it('詳しく占うの占い結果からブラウザの戻るで儀式へ着いても、占い状態が idle になり、前の占い結果も持ち込んだカテゴリと回答も引き継がない', async () => {
    useReadingStore.setState({ status: 'drawn', drawn: previousDrawn, error: null, deep: await carriedDeep() })
    await reachByBackFromResult()
    expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()

    expect(pick()).toEqual(initial)
    expect(pick().status).toBe('idle')
    expect(pick().drawn).toBeNull()
    expect(pick().deep).toBeNull()
  })

  // @covers REQ-132#starts-at-intent
  it('直接到達の直後は、通常占いとして占うことを思い浮かべる段階とその案内が示される', async () => {
    useReadingStore.setState({ status: 'drawn', drawn: previousDrawn, error: null, deep: await carriedDeep() })
    reachByAddress()

    expectIntentPhase()
    // 通常占い（用語集: deep === null）として始まっている
    expect(pick().deep).toBeNull()
  })

  // @covers REQ-132#starts-at-intent
  it('占い結果からブラウザの戻るで着いた直後も、占うことを思い浮かべる段階とその案内が示される', async () => {
    useReadingStore.setState({ status: 'drawn', drawn: previousDrawn, error: null, deep: null })
    await reachByBackFromResult()

    expectIntentPhase()
    expect(pick().deep).toBeNull()
  })
})
