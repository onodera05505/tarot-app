// @vitest-environment jsdom
// UC-006 の要件の文（REQ-057・058・063・067・112・113）だけから設計した、現在の振る舞いの固定
// （実装は参照していない）。準備と問い合わせ方は ShufflePage.test.tsx / ResultPage.test.tsx に倣う。
// 抽選（用語集: `drawCards`）の成功・失敗・未完了をテストから決めるため、抽選だけを差し替える。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShufflePage } from '../../src/pages/ShufflePage'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadHistory } from '../../src/lib/history'
import { drawCards } from '../../src/lib/api'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// 抽選だけを差し替える（ほかの公開関数は本物のまま）。各テストが成功・失敗・未完了を決める
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, drawCards: vi.fn(actual.drawCards) }
})

const FAILURE_MESSAGE = 'テスト専用の抽選失敗'
/** 「カードを引いている途中」の表示とみなす文言（占い結果の drawing の表示と同じ語） */
const DRAWING_NOTICE = /引いて/

const fixedDrawn: DrawnCard = {
  card: tarotCards[5],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

function drawSucceeds() {
  vi.mocked(drawCards).mockImplementation(async () => [fixedDrawn])
}
function drawFails() {
  vi.mocked(drawCards).mockImplementation(async () => {
    throw new Error(FAILURE_MESSAGE)
  })
}
function drawNeverFinishes() {
  vi.mocked(drawCards).mockImplementation(() => new Promise<DrawnCard[]>(() => {}))
}

function mount(resultElement = <div>RESULT_STUB</div>) {
  return render(
    <MemoryRouter initialEntries={['/shuffle']}>
      <Routes>
        <Route path="/shuffle" element={<ShufflePage />} />
        <Route path="/result" element={resultElement} />
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
describe('儀式: ストップの時点の抽選の成否', () => {
  // @covers REQ-057#not-fixed-on-failure
  it('抽選に失敗したストップでは結果の確定にならず、カードも正逆も決まらないまま占い状態が error になる', async () => {
    drawFails()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)

    const state = useReadingStore.getState()
    expect(state.drawn).toBeNull()
    expect(state.status).toBe('error')
  })

  // @covers REQ-057#proceeds-on-failure
  it('抽選に失敗したストップのあとも、3 つの山が示されて積み上げる順の指定を待つ', async () => {
    drawFails()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(1500)

    expect(useReadingStore.getState().status).toBe('error')
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
    expect(pile(1)).toBeTruthy()
    expect(pile(2)).toBeTruthy()
    expect(pile(3)).toBeTruthy()
  })

  // @covers REQ-058#repeated-stop-single-fix
  it.each([2, 3])('ストップを %i 回重ねて押しても、抽選は一度だけで占い履歴に記録される占い結果は一件', async (times) => {
    drawSucceeds()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    const stop = screen.getByRole('button', { name: 'ストップ' })

    for (let i = 0; i < times; i++) {
      fireEvent.click(stop)
    }
    await advance(1500)

    expect(drawCards).toHaveBeenCalledTimes(1)
    expect(loadHistory()).toHaveLength(1)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
  })
})

// UC-006
describe('儀式: 抽選に失敗したあとの進み方', () => {
  // @covers REQ-113#same-steps-without-failure-notice
  it('抽選に失敗しても、儀式の中では失敗を示さず、左右選択を待つ段階まで成功したときと同じ手順で進む', async () => {
    drawFails()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'シャッフルへ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ストップ' }))
    await advance(50)
    expect(useReadingStore.getState().status).toBe('error')
    expect(document.body.textContent).not.toContain(FAILURE_MESSAGE)

    await advance(1450)
    expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
    expect(document.body.textContent).not.toContain(FAILURE_MESSAGE)
    fireEvent.click(pile(1))
    fireEvent.click(pile(2))
    fireEvent.click(pile(3))
    fireEvent.click(screen.getByRole('button', { name: '決定' }))

    await advance(2500)
    expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
    expect(document.body.textContent).not.toContain(FAILURE_MESSAGE)
    fireEvent.click(pile(1))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await advance(1300)
    await advance(900)
    expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
    expect(screen.getByRole('button', { name: '左' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '右' })).toBeTruthy()
    expect(document.body.textContent).not.toContain(FAILURE_MESSAGE)
    expect(document.body.textContent).not.toContain('エラー')
    expect(screen.queryByText('HOME_STUB')).toBeNull()
  })

  // @covers REQ-063#moves-on-failure
  it.each(['左', '右'])('抽選に失敗していても、左右選択で「%s」を選ぶと占い結果へ移る', async (side) => {
    drawFails()
    mount()
    await stopAndGoToOrienting()

    fireEvent.click(screen.getByRole('button', { name: side }))
    await advance(1000)

    expect(screen.getByText('RESULT_STUB')).toBeTruthy()
    expect(useReadingStore.getState().status).toBe('error')
    expect(useReadingStore.getState().drawn).toBeNull()
  })

  // @covers REQ-067#failure-shown
  it('儀式のストップで抽選に失敗して占い結果へ移ると、カードを引けなかったことが示され、トップへ戻る以外の操作は示されない', async () => {
    drawFails()
    mount(<ResultPage />)
    await stopAndGoToOrienting()
    fireEvent.click(screen.getByRole('button', { name: '左' }))
    await advance(1000)

    expect(document.body.textContent).toContain(FAILURE_MESSAGE)
    expect(screen.getByRole('button', { name: 'トップへ戻る' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'もう一度占う' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'この結果をシェア' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'カードを拡大表示' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})

// UC-006
describe('儀式: 左右選択を待つ段階の「引いている途中」の表示', () => {
  // @covers REQ-112#pending-shows-drawing
  it('抽選がまだ終わっておらず占い結果が無い間は、カードを引いている途中であることが示される', async () => {
    drawNeverFinishes()
    mount()
    await stopAndGoToOrienting()

    expect(useReadingStore.getState().drawn).toBeNull()
    expect(document.body.textContent).toMatch(DRAWING_NOTICE)
  })

  // @covers REQ-112#failed-shows-drawing
  it('抽選に失敗して占い結果が無い間も、カードを引いている途中であることが示される', async () => {
    drawFails()
    mount()
    await stopAndGoToOrienting()

    expect(useReadingStore.getState().drawn).toBeNull()
    expect(document.body.textContent).toMatch(DRAWING_NOTICE)
  })

  // @covers REQ-112#result-present-not-shown
  it('占い結果があるときは、カードを引いている途中であることは示されない', async () => {
    drawSucceeds()
    mount()
    await stopAndGoToOrienting()

    expect(useReadingStore.getState().drawn).not.toBeNull()
    expect(document.body.textContent).not.toMatch(DRAWING_NOTICE)
  })
})
