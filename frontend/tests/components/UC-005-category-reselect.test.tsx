// @vitest-environment jsdom
// UC-005 の要件の文（REQ-039。「どのカテゴリの文章も読み込んでいる最中でないとき」）と、カテゴリを示し直す
// 要件の文（REQ-040・REQ-047）、用語集だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は DeepFlow.test.tsx / UC-005-category-loading.test.tsx に倣う。
// 期待値は公開データ（loadDeepCategory）から実行時に導出する。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepPage } from '../../src/pages/DeepPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadDeepCategory } from '../../src/data/deep/index'

type DeepModule = typeof import('../../src/data/deep/index')
type CategoryData = Awaited<ReturnType<DeepModule['loadDeepCategory']>>

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

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

async function expectFirstQuestionOf(category: CategoryData) {
  expect(await screen.findByText(category.questions[0].text)).toBeTruthy()
  for (const choice of category.questions[0].choices) {
    expect(screen.getByRole('button', { name: choice.label })).toBeTruthy()
  }
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
describe('詳しく占う: 前の読み込みが済んだあとにカテゴリを選ぶ', () => {
  // @covers REQ-039#select-after-earlier-load
  it('読み込めたカテゴリの最初の質問から戻り、別のカテゴリを選ぶと、そのカテゴリの最初の質問とその選択肢が示される', async () => {
    const work = await loadActual('work')
    const love = await loadActual('love')
    expect(love.questions[0].text).not.toBe(work.questions[0].text)
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: work.label }))
    await screen.findByText(work.questions[0].text)
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))

    fireEvent.click(await screen.findByRole('button', { name: love.label }))

    await expectFirstQuestionOf(love)
    expect(screen.queryByText(work.questions[0].text)).toBeNull()
  })

  // @covers REQ-039#select-after-earlier-load
  it('カテゴリの文章を読み込めなかったあとにカテゴリを選び直すと、読み込めたそのカテゴリの最初の質問とその選択肢が示される', async () => {
    const work = await loadActual('work')
    vi.mocked(loadDeepCategory).mockImplementationOnce(() =>
      Promise.reject(new Error('テスト専用の読み込み失敗')),
    )
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: work.label }))
    await waitFor(() => {
      expect(loadDeepCategory).toHaveBeenCalledTimes(1)
    })
    // 失敗の後始末が済み、カテゴリを選び直せる状態になるのを待ってから選ぶ
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: work.label }))
      expect(loadDeepCategory).toHaveBeenCalledTimes(2)
    })

    await expectFirstQuestionOf(work)
  })
})
