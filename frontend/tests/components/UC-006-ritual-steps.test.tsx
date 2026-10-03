// @vitest-environment jsdom
// UC-006「儀式を進めて 1 枚を引き、占い結果を読む」の要件の文（REQ-057・063・109・110・111・114・118）だけから
// 設計した、現在の振る舞いの固定（実装は参照していない）。準備と問い合わせ方は ShufflePage.test.tsx に倣う。
// 抽選は本物のまま通す（抽選の成否・未完了を作るテストは UC-006-ritual-draw-outcome.test.tsx）。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadHistory } from '../../src/lib/history'
import { CARD_BACK_THUMB_URL, CARD_BACK_URL } from '../../src/lib/api'

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

// 自動の段階（setTimeout）を進める
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function pile(n: number): HTMLElement {
  return screen.getByRole('button', { name: `山 ${n}` })
}

/** 山に示されている印（何番目か・選ばれているか）。示されていなければ空文字 */
function markOf(n: number): string {
  return (pile(n).textContent ?? '').trim()
}

async function toShuffling() {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
}

async function toSplit3() {
  await toShuffling()
  fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
  await advance(1500)
  expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
}

async function toSplit2() {
  await toSplit3()
  fireEvent.click(pile(1))
  fireEvent.click(pile(2))
  fireEvent.click(pile(3))
  fireEvent.click(screen.getByRole('button', { name: '決定' }))
  await advance(2500)
  expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
}

async function toOrienting() {
  await toSplit2()
  fireEvent.click(pile(1))
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  // 自動の段階は 1 つずつ進める（次の段階のタイマーは描画のあとに登録される）
  await advance(1300)
  await advance(900)
  expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
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

// UC-006
describe('儀式: ストップと結果の確定', () => {
  // @covers REQ-057#fix-at-stop
  it('ストップを押した時点で、以後の儀式の操作を待たずにカードと正逆が決まり占い状態が drawn になる', async () => {
    await toShuffling()
    expect(useReadingStore.getState().status).toBe('idle')
    expect(useReadingStore.getState().drawn).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    // 抽選の完了だけを流す（山の指定を待つ段階にはまだ着いていない）
    await advance(50)

    expect(screen.queryByText('積み上げる順番を指定してください')).toBeNull()
    const state = useReadingStore.getState()
    expect(state.status).toBe('drawn')
    expect(state.drawn).not.toBeNull()
    expect(['upright', 'reversed']).toContain(state.drawn!.orientation)
  })

  // @covers REQ-057#proceed-to-split3
  it('抽選に成功したストップのあと、3 つの山が示されて積み上げる順の指定を待つ', async () => {
    await toShuffling()
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(1500)

    expect(useReadingStore.getState().status).toBe('drawn')
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
    expect(pile(1)).toBeTruthy()
    expect(pile(2)).toBeTruthy()
    expect(pile(3)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '山 4' })).toBeNull()
    expect(screen.getByRole('button', { name: '決定' })).toBeTruthy()
  })
})

// UC-006
describe('儀式: 左右選択', () => {
  // @covers REQ-063#right-keeps-result
  it('右を選ぶと、ストップの時点で決まったカードと正逆のまま占い結果へ移る', async () => {
    await toOrienting()
    const before = useReadingStore.getState().drawn!

    fireEvent.click(screen.getByRole('button', { name: '右' }))
    await advance(1000)

    expect(screen.getByText('RESULT_STUB')).toBeTruthy()
    const after = useReadingStore.getState().drawn!
    expect(after.card.id).toBe(before.card.id)
    expect(after.orientation).toBe(before.orientation)
  })
})

// UC-006
describe('儀式: 山の指定の取り消し', () => {
  // 取り消す山が、指定済みの並びの先頭・途中・末尾のそれぞれの場合
  const cases = [
    { 名前: '先頭', 取り消す山: 2, 残りの印: { 1: '2', 2: '', 3: '1' } },
    { 名前: '途中', 取り消す山: 3, 残りの印: { 1: '2', 2: '1', 3: '' } },
    { 名前: '末尾', 取り消す山: 1, 残りの印: { 1: '', 2: '1', 3: '2' } },
  ] as const

  // @covers REQ-109#split3-cancel-closes-up
  it.each(cases)('3 つの山: 指定済みの並びの$名前の山をもう一度選ぶと指定が取り消され、残りの順が前に詰まる', async (c) => {
    await toSplit3()
    // 山 2 → 山 3 → 山 1 の順に指定する
    fireEvent.click(pile(2))
    fireEvent.click(pile(3))
    fireEvent.click(pile(1))
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['3', '1', '2'])

    fireEvent.click(pile(c.取り消す山))

    expect([markOf(1), markOf(2), markOf(3)]).toEqual([c.残りの印[1], c.残りの印[2], c.残りの印[3]])
  })

  // @covers REQ-109#split3-cancel-closes-up
  it('3 つの山: 取り消したあとは 3 つすべてを指定し直すまで決定しても先へ進まず、指定し直せば進む', async () => {
    await toSplit3()
    fireEvent.click(pile(1))
    fireEvent.click(pile(2))
    fireEvent.click(pile(3))
    fireEvent.click(pile(2))

    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(2500)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()

    fireEvent.click(pile(2))
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['1', '3', '2'])
    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(2500)
    expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
  })

  // @covers REQ-109#split2-cancel
  it('2 つの山: 選んである山をもう一度選ぶと指定が取り消され、確定しても先へ進まない', async () => {
    await toSplit2()
    fireEvent.click(pile(1))
    expect(markOf(1)).not.toBe('')

    fireEvent.click(pile(1))

    expect(markOf(1)).toBe('')
    expect(markOf(2)).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await advance(1300)
    await advance(900)
    expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
    expect(screen.queryByText('どちらを上にするか選択してください')).toBeNull()
  })
})

// UC-006
describe('儀式: 案内と山の指定の表示', () => {
  // @covers REQ-110#guidance-at-each-waiting-phase
  it('占う人の操作を待つ 5 つの段階のそれぞれで、その段階ですることの案内が示される', async () => {
    mount()
    // 占うことを思い浮かべる段階
    expect(screen.getByText(/占うことを/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    // ストップを待つ段階（前の段階の案内は残らない）
    expect(screen.getByText('シャッフルを止めてください')).toBeTruthy()
    expect(screen.queryByText(/占うことを/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(1500)
    // 積み上げる順の指定を待つ段階
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
    expect(screen.queryByText('シャッフルを止めてください')).toBeNull()

    fireEvent.click(pile(1))
    fireEvent.click(pile(2))
    fireEvent.click(pile(3))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(2500)
    // 片方の山の選択を待つ段階
    expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
    expect(screen.queryByText('積み上げる順番を指定してください')).toBeNull()

    fireEvent.click(pile(2))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await advance(1300)
    await advance(900)
    // 左右選択を待つ段階
    expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
    expect(screen.queryByText('どちらかの山を選択してください')).toBeNull()
  })

  // @covers REQ-111#split3-order-shown
  it('3 つの山: 順を指定済みの山それぞれに何番目かが示され、未指定の山には示されない', async () => {
    await toSplit3()
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['', '', ''])

    fireEvent.click(pile(3))
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['', '', '1'])

    fireEvent.click(pile(1))
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['2', '', '1'])

    fireEvent.click(pile(2))
    expect([markOf(1), markOf(2), markOf(3)]).toEqual(['2', '3', '1'])
  })

  // @covers REQ-111#split2-selection-shown
  it.each([1, 2])('2 つの山: 山 %i を選ぶと、その山だけに選ばれている印が示される', async (selected) => {
    const other = selected === 1 ? 2 : 1
    await toSplit2()
    expect([markOf(1), markOf(2)]).toEqual(['', ''])

    fireEvent.click(pile(selected))

    expect(markOf(selected)).not.toBe('')
    expect(markOf(other)).toBe('')
  })
})

// UC-006
describe('儀式: 結果の確定のあとに途中で離れる', () => {
  // @covers REQ-114#leave-after-fix-keeps-record
  it('山の指定を待つ段階で離れても、その占い結果は占い履歴に記録されたまま残る', async () => {
    await toSplit3()
    const drawn = useReadingStore.getState().drawn!

    cleanup()
    await advance(5000)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(drawn.card.id)
    expect(list[0].orientation).toBe(drawn.orientation)
  })

  // @covers REQ-114#leave-after-fix-keeps-record
  it('左右選択を待つ段階で離れても、その占い結果は占い履歴に記録されたまま残る', async () => {
    await toOrienting()
    const drawn = useReadingStore.getState().drawn!

    cleanup()
    await advance(5000)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(drawn.card.id)
    expect(list[0].orientation).toBe(drawn.orientation)
  })

  // @covers REQ-114#leave-after-fix-keeps-record
  it('ストップ直後の自動の段階で離れても、その占い結果は占い履歴に記録されたまま残る', async () => {
    await toShuffling()
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)
    const drawn = useReadingStore.getState().drawn!
    expect(screen.queryByText('積み上げる順番を指定してください')).toBeNull()

    cleanup()
    await advance(5000)

    const list = loadHistory()
    expect(list).toHaveLength(1)
    expect(list[0].card.id).toBe(drawn.card.id)
    expect(list[0].orientation).toBe(drawn.orientation)
  })
})

// UC-006
describe('儀式: カードの山は裏面で示す', () => {
  /** 示されているカードがすべて裏面で、決まったカードの名前も表も出ていないこと */
  function expectAllBacks() {
    const images = Array.from(document.querySelectorAll('img'))
    expect(images.length).toBeGreaterThan(0)
    for (const img of images) {
      expect([CARD_BACK_URL, CARD_BACK_THUMB_URL]).toContain(img.getAttribute('src'))
    }
    const drawn = useReadingStore.getState().drawn
    if (drawn) {
      expect(document.body.textContent).not.toContain(drawn.card.nameJa)
      expect(screen.queryByAltText(drawn.card.nameJa)).toBeNull()
    }
  }

  // @covers REQ-118#all-backs-through-ritual
  it('シャッフル中から左右選択を待つ段階まで、山を示しているどの段階でもすべてのカードが裏面で示される', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    expectAllBacks() // シャッフル中

    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)
    expect(useReadingStore.getState().drawn).not.toBeNull()
    expectAllBacks() // 山を 1 つにまとめる段階（結果は確定済み）

    await advance(1500)
    expectAllBacks() // 3 つの山

    fireEvent.click(pile(1))
    fireEvent.click(pile(2))
    fireEvent.click(pile(3))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))
    await advance(100)
    expectAllBacks() // 積み重ねる段階
    await advance(2400)
    expectAllBacks() // 2 つの山

    fireEvent.click(pile(1))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await advance(1300)
    expectAllBacks() // 山を寝かせる段階
    await advance(900)
    expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
    expectAllBacks() // 左右選択を待つ段階
  })
})
