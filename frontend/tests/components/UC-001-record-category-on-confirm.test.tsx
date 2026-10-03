// @vitest-environment jsdom
// UC-001 の要件の文（REQ-001・REQ-005）、UC-001 の表の前置き（持ち込んだカテゴリと回答の有無で列が分かれる）、
// 業務規則 BR-004、用語集（持ち込む・カテゴリ名）だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は UC-005-entry-and-ritual.test.tsx に倣う。期待値は公開データ（loadDeepCategory）から実行時に導出する。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepPage } from '../../src/pages/DeepPage'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadHistory } from '../../src/lib/history'
import { loadDeepCategory } from '../../src/data/deep/index'

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

/** 儀式でストップを押し、抽選の完了だけを流す */
async function stopInRitual() {
  fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
  fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50)
  })
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// UC-001
describe('占い履歴への記録: 詳しく占うから儀式へ移った占いの結果の確定（UC-001）', () => {
  // @covers REQ-005#category-label
  it('カテゴリとすべての回答を持ち込んだ儀式で結果の確定が起きると、そのカテゴリのカテゴリ名を添えた占い結果が占い履歴に加わる', async () => {
    const work = await loadDeepCategory('work')
    useReadingStore.getState().setDeepContext({
      categoryId: 'work',
      categoryLabel: work.label,
      answers: work.questions.map((q) => q.choices[0].id),
    })
    vi.useFakeTimers()
    render(
      <MemoryRouter initialEntries={['/shuffle']}>
        <ShufflePage />
      </MemoryRouter>,
    )

    await stopInRitual()

    const drawn = useReadingStore.getState().drawn
    expect(drawn).not.toBeNull()
    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(drawn!.card.id)
    expect(list[0].orientation).toBe(drawn!.orientation)
    expect(list[0].categoryLabel).toBe(work.label)
  })

  // @covers REQ-001#no-category-label
  it('質問の途中で儀式へ移り、持ち込んだカテゴリと回答が無いまま結果の確定が起きると、カテゴリ名を添えない占い結果が占い履歴に加わる', async () => {
    const love = await loadDeepCategory('love')
    const router = createMemoryRouter(
      [
        { path: '/deep', element: <DeepPage /> },
        { path: '/shuffle', element: <ShufflePage /> },
        { path: '*', element: <div>OTHER_STUB</div> },
      ],
      { initialEntries: ['/deep'] },
    )
    render(<RouterProvider router={router} />)

    // カテゴリを選び、最初の質問にだけ答える
    fireEvent.click(await screen.findByRole('button', { name: love.label }))
    await screen.findByText(love.questions[0].text)
    fireEvent.click(screen.getByRole('button', { name: love.questions[0].choices[0].label }))
    await screen.findByText(love.questions[1].text)

    // 残りに答えないまま儀式へ移る（直接到達）
    vi.useFakeTimers()
    await act(async () => {
      await router.navigate('/shuffle')
    })
    await stopInRitual()

    const drawn = useReadingStore.getState().drawn
    expect(drawn).not.toBeNull()
    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(drawn!.card.id)
    expect(list[0].categoryLabel).toBeUndefined()
  })
})
