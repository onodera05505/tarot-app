// @vitest-environment jsdom
// UC-001 の要件の文（REQ-008・REQ-102・REQ-103）、業務規則 BR-003、用語集、契約（addToHistory / loadHistory）だけから設計
// （実装は参照していない）。
// 準備と問い合わせのやり方は HistoryPage.test.tsx に倣う（h2 の DOM 順 = 一覧の表示順、alt = カード名）。
//
// 仮定（仕様に無いため置いたもの）
//   E1: 「トップへ戻る」（用語集の語）は、その名前のボタンかリンクとして出る
//   E2: 上下逆さの絵は、その絵か祖先の要素のインラインの `transform: rotate(180deg)` で表される
//       （CardDetailPage.test.tsx の仮定 C4 と同じ見方）
//   E3: 別のタブでの記録は、同じ localStorage への書き込みと `storage` イベントとして届く
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from '../../src/pages/HistoryPage'
import { addToHistory, loadHistory } from '../../src/lib/history'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

const STORAGE_KEY = 'tarot:history'

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

function drawnOf(card: TarotCard, orientation: Orientation, keywords?: string[]): DrawnCard {
  return { card, orientation, keywords: keywords ?? ['テスト専用キーワード甲', 'テスト専用キーワード乙'] }
}

/** h2 の DOM 順に並んだカード名 */
function displayedNames(): string[] {
  return screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim() ?? '')
}

/** 仮定 E1 */
function topControl(): HTMLElement {
  return screen.queryByRole('button', { name: 'トップへ戻る' }) ?? screen.getByRole('link', { name: 'トップへ戻る' })
}

/** 仮定 E2: 絵そのものか祖先が上下逆さにされているか */
function isUpsideDown(img: HTMLElement): boolean {
  for (let el: HTMLElement | null = img; el; el = el.parentElement) {
    if (el.style.transform.replace(/\s/g, '').includes('rotate(180deg)')) return true
  }
  return false
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// UC-001
describe('占い履歴: 一覧の並びと各項目の中身（UC-001）', () => {
  // @covers REQ-008#order-ignores-datetime
  it('後から記録した項目の日時のほうが前でも、後から記録した項目が先に並ぶ', async () => {
    const [earlierRecorded, laterRecorded] = [tarotCards[2], tarotCards[9]]
    // タイマーは本物のまま、時計だけを差し替える（waitFor を止めないため）
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-12-25T14:37:00'))
    addToHistory(drawnOf(earlierRecorded, 'upright'))
    // 端末の時計が戻された後に、次の結果の確定が起きる
    vi.setSystemTime(new Date('2031-12-20T09:05:00'))
    addToHistory(drawnOf(laterRecorded, 'upright'))
    const [first, second] = loadHistory()
    expect(first.drawnAt).toBeLessThan(second.drawnAt)

    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toEqual([laterRecorded.nameJa, earlierRecorded.nameJa])
    })
  })

  // @covers REQ-008#keywords-shown
  it('各項目に、その項目に記録されたキーワードが示される', async () => {
    addToHistory(drawnOf(tarotCards[3], 'upright', ['専用語い', '専用語ろ']))
    addToHistory(drawnOf(tarotCards[12], 'reversed', ['専用語は', '専用語に']))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })
    for (const keyword of ['専用語い', '専用語ろ', '専用語は', '専用語に']) {
      expect(document.body.textContent).toContain(keyword)
    }
  })

  // @covers REQ-008#image-orientation
  it('逆位置で記録された項目の絵は上下逆さに、正位置で記録された項目の絵は正しい向きで示される', async () => {
    const [upright, reversed] = [tarotCards[5], tarotCards[14]]
    addToHistory(drawnOf(upright, 'upright'))
    addToHistory(drawnOf(reversed, 'reversed'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })
    const reversedImages = screen.getAllByAltText(reversed.nameJa)
    const uprightImages = screen.getAllByAltText(upright.nameJa)
    expect(reversedImages.length).toBeGreaterThanOrEqual(1)
    expect(uprightImages.length).toBeGreaterThanOrEqual(1)
    // 仮定 E2
    expect(reversedImages.every(isUpsideDown)).toBe(true)
    expect(uprightImages.some(isUpsideDown)).toBe(false)
  })
})

// UC-001
describe('占い履歴: 一覧を開いたまま別のタブで結果が確定する（UC-001）', () => {
  // @covers REQ-102#other-tab-confirm-keeps-view
  it('別のタブの記録が端末に加わっても、示している一覧は開いたときのまま変わらない', async () => {
    const [first, second, fromOtherTab] = [tarotCards[1], tarotCards[6], tarotCards[17]]
    addToHistory(drawnOf(first, 'upright'))
    addToHistory(drawnOf(second, 'reversed'))
    mountHistory()
    await waitFor(() => {
      expect(displayedNames()).toEqual([second.nameJa, first.nameJa])
    })

    // 仮定 E3
    const oldValue = localStorage.getItem(STORAGE_KEY)
    addToHistory(drawnOf(fromOtherTab, 'upright'))
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY, oldValue, newValue: localStorage.getItem(STORAGE_KEY) }),
      )
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // 端末には 3 件あるが、示している一覧は 2 件のまま
    expect(loadHistory()).toHaveLength(3)
    expect(displayedNames()).toEqual([second.nameJa, first.nameJa])
    expect(screen.queryByAltText(fromOtherTab.nameJa)).toBeNull()
  })
})

// UC-001
describe('占い履歴: トップへ戻る（UC-001）', () => {
  // @covers REQ-103#from-list
  it('記録がある一覧でトップへ戻ることを選ぶと、占い履歴は変わらずにトップが示される', async () => {
    addToHistory(drawnOf(tarotCards[8], 'upright'))
    addToHistory(drawnOf(tarotCards[19], 'reversed'), 'テスト専用カテゴリ名')
    const before = loadHistory()
    mountHistory()
    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })

    fireEvent.click(topControl())

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expect(loadHistory()).toEqual(before)
  })

  // @covers REQ-103#from-empty
  it('占い履歴が空のときにトップへ戻ることを選ぶと、占い履歴は空のままトップが示される', async () => {
    mountHistory()
    await screen.findByRole('heading', { level: 1 })

    fireEvent.click(topControl())

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expect(loadHistory()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // @covers REQ-103#from-unreadable
  it('記録内容が読めないときにトップへ戻ることを選ぶと、端末に残る記録内容は変わらずにトップが示される', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken json')
    mountHistory()
    await screen.findByRole('heading', { level: 1 })

    fireEvent.click(topControl())

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken json')
  })
})
