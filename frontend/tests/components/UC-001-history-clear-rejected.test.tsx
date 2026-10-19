// @vitest-environment jsdom
// UC-001 の要件の文（REQ-126）、用語集（全削除・全削除の確認・履歴なし・占い履歴）、契約（addToHistory / loadHistory /
// clearHistory の errors STORAGE_WRITE_FAILED）だけから設計（実装は参照していない）。
// 準備と問い合わせのやり方は HistoryPage.test.tsx に倣う（h2 の DOM 順 = 一覧の表示順、alt = カード名）。
//
// 仮定（仕様に無いため置いたもの）
//   G1: 「端末から消せない」は、占い履歴のキーの消去・上書き・全消去のどれもを端末が拒む状態
//       （消し方は契約が決めていないので、どの消し方でも同じ失敗に当たるようにする）
//   G2: 「消せなかったことを示す」の文言は用語集に無い。全削除の語（用語集「履歴をすべて削除」）に含まれる
//       「削除」を含む新しい表示が、画面の中かブラウザの通知（window.alert。全削除の確認と同じ経路）に出ることを見る
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from '../../src/pages/HistoryPage'
import { addToHistory, loadHistory } from '../../src/lib/history'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

const STORAGE_KEY = 'tarot:history'
const CLEAR_BUTTON = '履歴をすべて削除'
const EMPTY_MESSAGE = 'まだ占いの履歴はありません'

function mountHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function drawnOf(card: TarotCard, orientation: Orientation): DrawnCard {
  return { card, orientation, keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'] }
}

/** h2 の DOM 順に並んだカード名 */
function displayedNames(): string[] {
  return screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim() ?? '')
}

function removeRejectedError(): Error {
  return new DOMException('端末が消去を受け付けない（テスト用）', 'QuotaExceededError')
}

/** 仮定 G1: ここから先、端末は占い履歴の消去を拒む（読むことはできる） */
function rejectRemovalFromNowOn() {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
    if (key === STORAGE_KEY) throw removeRejectedError()
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string) {
    if (key === STORAGE_KEY) throw removeRejectedError()
  })
  vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
    throw removeRejectedError()
  })
}

/** 承諾の前の画面と端末の状態を覚えておく */
function snapshot() {
  return {
    names: displayedNames(),
    raw: localStorage.getItem(STORAGE_KEY),
    list: loadHistory(),
    bodyText: document.body.textContent ?? '',
  }
}

/** 承諾の後に初めて現れた文字列（画面の中）と、ブラウザの通知に渡された文字列（仮定 G2） */
function newlyShown(before: string): string {
  const after = document.body.textContent ?? ''
  const inPage = after.startsWith(before) ? after.slice(before.length) : after.replace(before, '')
  const alerted = vi
    .mocked(window.alert)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
  return `${inPage}\n${alerted}`.trim()
}

async function mountWithThreeEntries(): Promise<TarotCard[]> {
  const cards = [tarotCards[7], tarotCards[13], tarotCards[20]]
  addToHistory(drawnOf(cards[0], 'upright'))
  addToHistory(drawnOf(cards[1], 'reversed'))
  addToHistory(drawnOf(cards[2], 'upright'))
  mountHistory()
  await waitFor(() => {
    expect(displayedNames()).toHaveLength(3)
  })
  return cards
}

beforeEach(() => {
  localStorage.clear()
  // 全削除の確認（用語集: window.confirm）には承諾する
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// UC-001
describe('占い履歴: 全削除を承諾しても端末から消せない（UC-001）', () => {
  // @covers REQ-126#shows-failure
  it('承諾の後に端末から消せなかったとき、消せなかったことが示され、履歴なしの表示にはならない', async () => {
    await mountWithThreeEntries()
    const before = snapshot()
    rejectRemovalFromNowOn()

    fireEvent.click(screen.getByRole('button', { name: CLEAR_BUTTON }))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    // 仮定 G2: 消せなかったことが、承諾の前には無かった表示として出る
    await waitFor(() => {
      expect(newlyShown(before.bodyText)).toContain('削除')
    })
    // 履歴なし（用語集: 「まだ占いの履歴はありません」「占いを始める」）にはならない
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull()
    expect(screen.queryByRole('button', { name: '占いを始める' })).toBeNull()
  })

  // @covers REQ-126#keeps-device-and-view
  it('承諾の後に端末から消せなかったとき、端末の占い履歴も示している一覧も承諾の前のまま', async () => {
    const cards = await mountWithThreeEntries()
    const before = snapshot()
    expect(before.names).toEqual([cards[2].nameJa, cards[1].nameJa, cards[0].nameJa])
    rejectRemovalFromNowOn()

    fireEvent.click(screen.getByRole('button', { name: CLEAR_BUTTON }))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    // 示している一覧は変わらない（同期的に消えていないことに加え、少し待っても消えない）
    await waitFor(() => {
      expect(displayedNames()).toEqual(before.names)
    })
    for (const card of cards) {
      expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    }
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull()
    // 端末の占い履歴は承諾の前のまま
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before.raw)
    expect(loadHistory()).toEqual(before.list)
    // 記録は残っているので、全削除の操作も残る（用語集: 1 件以上あるときだけ置く）
    expect(screen.getByRole('button', { name: CLEAR_BUTTON })).toBeTruthy()
  })

  // @covers REQ-126#keeps-device-and-view
  it('端末から消せなかった後に端末が再び受け付けるようになれば、もう一度承諾して消せる（失敗が画面に残らない）', async () => {
    await mountWithThreeEntries()
    rejectRemovalFromNowOn()
    fireEvent.click(screen.getByRole('button', { name: CLEAR_BUTTON }))
    await waitFor(() => {
      expect(loadHistory()).toHaveLength(3)
    })
    vi.mocked(Storage.prototype.removeItem).mockRestore()
    vi.mocked(Storage.prototype.setItem).mockRestore()
    vi.mocked(Storage.prototype.clear).mockRestore()

    fireEvent.click(screen.getByRole('button', { name: CLEAR_BUTTON }))

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeTruthy()
    expect(loadHistory()).toEqual([])
  })
})
