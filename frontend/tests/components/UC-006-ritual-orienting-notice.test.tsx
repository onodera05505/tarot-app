// @vitest-environment jsdom
// UC-006 の要件の文（REQ-112）と用語集（占い状態: error・左右選択）だけから設計した、
// 抽選に失敗したあとの左右選択を待つ段階の表示のテスト（実装は参照していない）。
// 準備と問い合わせ方は UC-006-ritual-draw-outcome.test.tsx に倣い、抽選だけを差し替えて失敗させる。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { drawCards } from '../../src/lib/api'
import type { DrawnCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// 抽選だけを差し替える（ほかの公開関数は本物のまま）
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, drawCards: vi.fn(actual.drawCards) }
})

const FAILURE_MESSAGE = 'テスト専用の抽選失敗'
/** 「カードを引いている途中」の表示とみなす文言（UC-006-ritual-draw-outcome.test.tsx の DRAWING_NOTICE と同じ語） */
const DRAWING_NOTICE = /引いて/

function drawFails() {
  vi.mocked(drawCards).mockImplementation(async (): Promise<DrawnCard[]> => {
    throw new Error(FAILURE_MESSAGE)
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

function pile(n: number): HTMLElement {
  return screen.getByRole('button', { name: `山 ${n}` })
}

/** ストップから左右選択を待つ段階まで、抽選に成功したときと同じ操作で進める */
async function stopAndGoToOrienting() {
  fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
  fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
  await advance(1500)
  expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
  fireEvent.click(pile(1))
  fireEvent.click(pile(2))
  fireEvent.click(pile(3))
  fireEvent.click(screen.getByRole('button', { name: '決定' }))
  await advance(2500)
  expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
  fireEvent.click(pile(1))
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  await advance(1300)
  await advance(900)
  expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
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

// UC-006
describe('儀式: 抽選に失敗したあとの左右選択を待つ段階', () => {
  // @covers REQ-112#failed-not-shown
  it('占い状態が error（抽選に失敗した）のときは、カードを引いている途中であることを示さない', async () => {
    drawFails()
    mount()
    await stopAndGoToOrienting()

    expect(useReadingStore.getState().status).toBe('error')
    expect(useReadingStore.getState().drawn).toBeNull()
    expect(screen.getByRole('button', { name: '左' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '右' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(DRAWING_NOTICE)
  })
})
