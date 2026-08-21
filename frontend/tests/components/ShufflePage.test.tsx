// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'

function mount() {
  return render(
    <MemoryRouter initialEntries={['/shuffle']}>
      <Routes>
        <Route path="/shuffle" element={<ShufflePage />} />
        <Route path="/result" element={<div>RESULT_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// フェーズ自動遷移（setTimeout）と framer-motion の rAF を進める
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('儀式フロー（仕様書 v3 §5.3 のフェーズ遷移順）', () => {
  it('intent → shuffling → split3 → split2 → orienting → /result の順に進む', async () => {
    mount()

    // 1. intent
    expect(screen.getByText(/占うことを/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))

    // 2. shuffling
    expect(screen.getByText('シャッフルを止めてください')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))

    // ストップの瞬間に結果が内部確定する（§4.2）
    await advance(50)
    const drawn = useReadingStore.getState().drawn
    expect(drawn).not.toBeNull()
    expect(['upright', 'reversed']).toContain(drawn!.orientation)

    // 3. merging（自動）→ 4. split3
    await advance(1500)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()

    // 3 山を 1→2→3 の順にタップして決定
    fireEvent.click(screen.getByRole('button', { name: '山 1' }))
    fireEvent.click(screen.getByRole('button', { name: '山 2' }))
    fireEvent.click(screen.getByRole('button', { name: '山 3' }))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))

    // 5. stacking3（自動）→ 6. split2
    await advance(2500)
    expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '山 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    // 7. stacking2 → 8. rotating（自動）→ 9. orienting
    // タイマーは各フェーズ描画後に次が登録されるため、1 遷移ずつ進める
    await advance(1300) // stacking2 (1200ms) → rotating
    await advance(900) // rotating (850ms) → orienting
    expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()

    const before = useReadingStore.getState().drawn!.orientation
    fireEvent.click(screen.getByRole('button', { name: '左' }))

    // 10. transitioning → /result へ遷移
    await advance(1000)
    expect(screen.getByText('RESULT_STUB')).toBeTruthy()

    // 左右選択は演出のみで、確定済みの正逆を書き換えない（§4.2 の設計判断）
    expect(useReadingStore.getState().drawn!.orientation).toBe(before)
  })

  it('決定は 3 山すべての順番を指定するまで押せない', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(1500)

    // 1 山だけ選んで決定を押してもフェーズは進まない
    fireEvent.click(screen.getByRole('button', { name: '山 1' }))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(100)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
  })
})
