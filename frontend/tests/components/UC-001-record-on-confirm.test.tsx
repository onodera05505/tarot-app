// @vitest-environment jsdom
// UC-001 の要件の文（REQ-001）、業務規則 BR-004、用語集（ストップ・結果の確定・占い履歴）だけから設計した、
// 現在の振る舞いの固定（実装は参照していない）。準備と問い合わせ方は UC-006-ritual-draw-outcome.test.tsx に倣う。
// 無料版の既定（機能フラグ無効）のまま、通常占いの儀式を通す。抽選の成否をテストから決めるため、抽選だけを差し替える。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { addToHistory, loadHistory } from '../../src/lib/history'
import { drawCards } from '../../src/lib/api'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

// 抽選だけを差し替える（ほかの公開関数は本物のまま）。各テストが成功・失敗を決める
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, drawCards: vi.fn(actual.drawCards) }
})

const fixedDrawn: DrawnCard = {
  card: tarotCards[14],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 前の回に記録済みの占い結果（今回の抽選で決まるカードとは別のカード） */
const earlierDrawn: DrawnCard = {
  card: tarotCards[2],
  orientation: 'upright',
  keywords: ['テスト専用キーワード丙'],
}

function drawSucceeds() {
  vi.mocked(drawCards).mockImplementation(async () => [fixedDrawn])
}
function drawFails() {
  vi.mocked(drawCards).mockImplementation(async () => {
    throw new Error('テスト専用の抽選失敗')
  })
}

function mount() {
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

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useReadingStore.getState().reset()
  vi.mocked(drawCards).mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// UC-001
describe('占い履歴への記録: 通常占いの結果の確定（UC-001）', () => {
  // @covers REQ-001#recorded-on-confirm
  it('ストップで抽選に成功すると、以後の儀式の操作を待たずに、その占い結果が占い履歴に 1 件加わる', async () => {
    drawSucceeds()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    expect(loadHistory()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    // 抽選の完了だけを流す（山の指定を待つ段階にはまだ着いていない）
    await advance(50)

    expect(screen.queryByText('積み上げる順番を指定してください')).toBeNull()
    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(fixedDrawn.card.id)
    expect(list[0].orientation).toBe(fixedDrawn.orientation)
  })

  // @covers REQ-001#no-category-label
  it('通常占いの結果の確定で加わった項目は、カテゴリ名を持たない', async () => {
    drawSucceeds()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].categoryLabel).toBeUndefined()
  })

  // @covers REQ-001#not-recorded-on-failure
  it('ストップで抽選に失敗すると結果の確定にならず、儀式を最後まで進めても占い履歴には何も加わらない', async () => {
    addToHistory(earlierDrawn)
    const before = loadHistory()
    expect(before).toHaveLength(1)
    drawFails()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))

    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)
    expect(loadHistory()).toEqual(before)

    // 儀式は抽選の成否によらず進む。左右選択で占い結果へ移るまで進めても変わらない
    await advance(1450)
    fireEvent.click(screen.getByRole('button', { name: '山 1' }))
    fireEvent.click(screen.getByRole('button', { name: '山 2' }))
    fireEvent.click(screen.getByRole('button', { name: '山 3' }))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(2500)
    fireEvent.click(screen.getByRole('button', { name: '山 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await advance(1300)
    await advance(900)
    fireEvent.click(screen.getByRole('button', { name: '左' }))
    await advance(1000)

    expect(screen.getByText('RESULT_STUB')).toBeTruthy()
    expect(loadHistory()).toEqual(before)
  })
})
