// @vitest-environment jsdom
// UC-004 の要件の文（REQ-105）、業務規則 BR-002（占い結果の外でトップへ戻ることでは初期化しない）、
// 用語集（トップへ戻る・占い状態）だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は UC-004-card-reference.test.tsx に倣う（「トップへ戻る」はその名前のボタンかリンク）。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardDetailPage } from '../../src/pages/CardDetailPage'
import { CardListPage } from '../../src/pages/CardListPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

function mountAt(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/cards" element={<CardListPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 名前の前後に付く飾り（矢印などの記号）は無視して、用語集の語そのものと一致するものを選ぶ */
function control(term: string): HTMLElement {
  const name = (accessibleName: string) =>
    accessibleName.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') === term
  return screen.queryByRole('button', { name }) ?? screen.getByRole('link', { name })
}

const previousDrawn: DrawnCard = {
  card: tarotCards[6],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** カード解説を開いた時点で残っている占い状態（前の占い結果と、儀式へ持ち込んだカテゴリと回答を含む） */
const previousState = {
  status: 'drawn' as const,
  drawn: previousDrawn,
  error: null,
  deep: { categoryId: 'work' as const, categoryLabel: 'テスト専用カテゴリ名', answers: ['a', 'b', 'c'] },
}

function expectStateUnchanged() {
  const after = useReadingStore.getState()
  expect(after.status).toBe(previousState.status)
  expect(after.drawn).toEqual(previousState.drawn)
  expect(after.error).toBe(previousState.error)
  expect(after.deep).toEqual(previousState.deep)
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

// UC-004
describe('カード解説: トップへ戻っても占い状態は変わらない（UC-004）', () => {
  // @covers REQ-105#keeps-reading-state
  it('占い状態が drawn のままカード解説の一覧でトップへ戻ることを選ぶと、占い状態は変わらずにトップが示される', async () => {
    useReadingStore.setState(previousState)
    mountAt(['/cards'])
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(tarotCards.length)
    })

    fireEvent.click(control('トップへ戻る'))

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expectStateUnchanged()
  })

  // @covers REQ-105#keeps-reading-state
  it('占い状態が drawn のまま実在するカードのカード解説でトップへ戻ることを選ぶと、占い状態は変わらずにトップが示される', async () => {
    const card = tarotCards[10]
    useReadingStore.setState(previousState)
    mountAt(['/cards', `/cards/${card.id}`])
    await screen.findByRole('heading', { level: 1, name: card.nameJa })

    fireEvent.click(control('トップへ戻る'))

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expectStateUnchanged()
  })
})
