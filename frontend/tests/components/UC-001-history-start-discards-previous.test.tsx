// @vitest-environment jsdom
// UC-001 の要件の文（REQ-007）、業務規則 BR-002（占い履歴から占いを始めるときは占い状態を初期化する）、
// 用語集（履歴なし・占い状態: idle・通常占い・フェーズ: intent・シャッフルへ）だけから設計している（実装は参照していない）。
// 履歴なしの表示の「占いを始める」から本物の儀式へ移ることを見るため、画面は App ごと組み立てる
// （準備と問い合わせ方は UC-005-entry-and-ritual.test.tsx の `#discard-previous` に倣う）。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

function mountApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** 「占いを始める」は button / link のどちらの role でも拾う */
function queryStart(): HTMLElement | null {
  return (
    screen.queryByRole('button', { name: '占いを始める' }) ??
    screen.queryByRole('link', { name: '占いを始める' })
  )
}

/** 前の回の占い結果と、前に儀式へ持ち込んだカテゴリと回答が残っている状態を作る */
function leavePreviousReading() {
  const previous = {
    drawn: {
      card: tarotCards[3],
      orientation: 'reversed' as const,
      keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
    },
    deep: {
      categoryId: 'work' as const,
      categoryLabel: 'テスト専用カテゴリ名',
      answers: ['a', 'b', 'c'],
    },
  }
  useReadingStore.setState({ status: 'drawn', error: null, ...previous })
  return previous
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// UC-001
describe('占い履歴: 履歴なしの表示から占いを始める（BR-002）', () => {
  // @covers REQ-007#start-discards-previous
  it('前の占い結果と前に持ち込んだカテゴリと回答が残っていても、占いを始めた時点で占い状態が idle になり、通常占いとして占うことを思い浮かべる段階から儀式が始まる', async () => {
    leavePreviousReading()
    mountApp('/history')
    await waitFor(() => {
      expect(screen.getByText('まだ占いの履歴はありません')).toBeTruthy()
      expect(queryStart()).not.toBeNull()
    })

    fireEvent.click(queryStart()!)

    // 儀式は占うことを思い浮かべる段階（intent）から始まる＝「シャッフルへ」が示されている
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()
    })

    // 占い状態は idle で、前の占い結果も持ち込んだカテゴリと回答も引き継がない（通常占い = deep が無い）
    const state = useReadingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.drawn).toBeNull()
    expect(state.deep).toBeNull()
  })

  // @covers REQ-007#start-discards-previous
  it('前の占い結果だけが残っている（持ち込みが無い）ときも、占いを始めた時点で占い状態が idle になり前の占い結果を引き継がない', async () => {
    useReadingStore.setState({
      status: 'drawn',
      error: null,
      drawn: {
        card: tarotCards[7],
        orientation: 'upright',
        keywords: ['テスト専用キーワード丙'],
      },
      deep: null,
    })
    mountApp('/history')
    await waitFor(() => {
      expect(queryStart()).not.toBeNull()
    })

    fireEvent.click(queryStart()!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'シャッフルへ' })).toBeTruthy()
    })

    const state = useReadingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.drawn).toBeNull()
    expect(state.deep).toBeNull()
  })
})
