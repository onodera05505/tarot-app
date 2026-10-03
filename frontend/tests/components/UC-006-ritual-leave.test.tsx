// @vitest-environment jsdom
// UC-006 の要件の文（REQ-114・REQ-125）、UC-006 の表（儀式の途中で離れる列・「儀式の外・占い状態: drawing」の行）、
// 用語集（ストップ・結果の確定）だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は UC-006-ritual-steps.test.tsx / UC-006-ritual-draw-outcome.test.tsx に倣う。
// 儀式の途中で離れることは、儀式の画面を外すことで代表させる。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { addToHistory, loadHistory } from '../../src/lib/history'
import { drawCards } from '../../src/lib/api'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

// 抽選だけを差し替える（ほかの公開関数は本物のまま）。抽選が終わる時点をテストから決める
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, drawCards: vi.fn(actual.drawCards) }
})

const fixedDrawn: DrawnCard = {
  card: tarotCards[17],
  orientation: 'upright',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 前の回に記録済みの占い結果（今回の抽選で決まるカードとは別のカード） */
const earlierDrawn: DrawnCard = {
  card: tarotCards[4],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード丙'],
}

/** 抽選を、テストが完了させるまで終わらないものにする。返り値で抽選を成功として完了させる */
function drawPending(): () => void {
  let finish!: (cards: DrawnCard[]) => void
  vi.mocked(drawCards).mockImplementation(
    () =>
      new Promise<DrawnCard[]>((resolve) => {
        finish = resolve
      }),
  )
  return () => finish([fixedDrawn])
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
  vi.mocked(drawCards).mockImplementation(async () => [fixedDrawn])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// UC-006
describe('儀式: ストップの前に途中で離れる', () => {
  /** 離れる前の占い状態と占い履歴を写し取る */
  function snapshot() {
    const { status, drawn } = useReadingStore.getState()
    return { status, drawn, history: loadHistory() }
  }

  // @covers REQ-125#leave-at-intent
  it('占うことを思い浮かべる段階で離れても、占い状態も占い履歴も離れる前のまま', async () => {
    addToHistory(earlierDrawn)
    mount()
    expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()
    const before = snapshot()

    cleanup()
    await advance(5000)

    expect(snapshot()).toEqual(before)
    expect(before.status).toBe('idle')
    expect(before.history).toHaveLength(1)
  })

  // @covers REQ-125#leave-at-shuffling
  it('ストップを待つ段階で離れても、占い状態も占い履歴も離れる前のまま', async () => {
    addToHistory(earlierDrawn)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    expect(screen.getByRole('button', { name: 'ストップ' })).toBeTruthy()
    const before = snapshot()

    cleanup()
    await advance(5000)

    expect(snapshot()).toEqual(before)
    expect(before.status).toBe('idle')
    expect(before.history).toHaveLength(1)
  })
})

// UC-006
describe('儀式: ストップのあと、抽選が終わる前に途中で離れる', () => {
  // @covers REQ-114#draw-succeeds-after-leave-records
  it('ストップ直後の自動の段階で離れ、そのあとに抽選が成功すると、その占い結果が占い履歴に記録される', async () => {
    const finishDraw = drawPending()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)
    expect(loadHistory()).toHaveLength(0)

    cleanup()
    await advance(1000)
    expect(loadHistory()).toHaveLength(0)

    finishDraw()
    await advance(50)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(fixedDrawn.card.id)
    expect(list[0].orientation).toBe(fixedDrawn.orientation)
  })

  // @covers REQ-114#draw-succeeds-after-leave-records
  it('山の指定を待つ段階で離れ、そのあとに抽選が成功すると、その占い結果が占い履歴に記録される', async () => {
    const finishDraw = drawPending()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(1500)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
    expect(loadHistory()).toHaveLength(0)

    cleanup()
    await advance(1000)

    finishDraw()
    await advance(50)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(fixedDrawn.card.id)
    expect(list[0].orientation).toBe(fixedDrawn.orientation)
  })
})
