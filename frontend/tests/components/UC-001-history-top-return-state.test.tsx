// @vitest-environment jsdom
// UC-001 の要件の文（REQ-103）、業務規則 BR-002（占い結果の外でトップへ戻ることでは初期化しない）、
// 用語集（トップへ戻る・占い状態）だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は UC-001-history-view.test.tsx に倣う（「トップへ戻る」はその名前のボタンかリンク）。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryPage } from '../../src/pages/HistoryPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { addToHistory } from '../../src/lib/history'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

function mountHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function topControl(): HTMLElement {
  return screen.queryByRole('button', { name: 'トップへ戻る' }) ?? screen.getByRole('link', { name: 'トップへ戻る' })
}

const previousDrawn: DrawnCard = {
  card: tarotCards[6],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 占い履歴を開いた時点で残っている占い状態（前の占い結果と、儀式へ持ち込んだカテゴリと回答を含む） */
const cases = [
  {
    名前: 'drawn（前の占い結果と持ち込んだカテゴリと回答が残っている）',
    state: {
      status: 'drawn' as const,
      drawn: previousDrawn,
      error: null,
      deep: { categoryId: 'work' as const, categoryLabel: 'テスト専用カテゴリ名', answers: ['a', 'b', 'c'] },
    },
  },
  {
    名前: 'error（カードを引けなかった）',
    state: { status: 'error' as const, drawn: null, error: 'テスト専用のエラー文', deep: null },
  },
  {
    名前: 'idle（占い結果がない）',
    state: { status: 'idle' as const, drawn: null, error: null, deep: null },
  },
]

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

// UC-001
describe('占い履歴: トップへ戻っても占い状態は変わらない（UC-001）', () => {
  // @covers REQ-103#keeps-reading-state
  it.each(cases)('占い状態が $名前 のまま占い履歴でトップへ戻ることを選ぶと、占い状態は変わらずにトップが示される', async ({ state }) => {
    addToHistory(previousDrawn)
    useReadingStore.setState(state)
    mountHistory()
    await screen.findByRole('heading', { level: 1 })

    fireEvent.click(topControl())

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    const after = useReadingStore.getState()
    expect(after.status).toBe(state.status)
    expect(after.drawn).toEqual(state.drawn)
    expect(after.error).toBe(state.error)
    expect(after.deep).toEqual(state.deep)
  })
})
