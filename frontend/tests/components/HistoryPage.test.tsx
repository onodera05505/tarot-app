// @vitest-environment jsdom
// 仕様 v3（v3.3）§5.6「占い履歴（/history）」と §4.3（`tarot:history`）の文面と公開契約だけから設計（実装は参照していない）。
// 履歴は公開契約の `addToHistory` / `loadHistory` で作り、期待値は `tarotCards` から実行時に導出する。
// 「本日の一枚は履歴に含めない」（§5.6）は記録側の責務であり、この画面のテスト対象外。
//
// 仮定（契約に無いため置いたもの）
//   D1: （2026-09-14 回答で確定）全削除の前に `window.confirm('占いの履歴をすべて削除します。よろしいですか？')` を出す。
//       既定では true を返すスパイを仕込み、キャンセル（false）のケースを別に持つ
//   D2: 正逆は各行に文字列「正位置」「逆位置」で表示され、履歴画面の他の場所ではこの語を使わない
//       （全件 upright のとき「逆位置」が出ない、をこれで判定する）
//   D3: カテゴリ名は該当する行に 1 回だけ表示され、ページ内の他所（見出し等）には現れない → 出現回数で判定
//   D4: 日時は表示形式が仕様に無いため検証しない（仕様への質問）
//   D5: 一覧はマウント時に localStorage から読む（描画前に addToHistory しておけば反映される）
//   D6: 履歴画面の `<h2>` はカード名にだけ使われる（h2 の DOM 順 = 表示順、件数 = 履歴件数とみなす）
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from '../../src/pages/HistoryPage'
import { addToHistory, loadHistory } from '../../src/lib/history'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

function mountHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/shuffle" element={<div>SHUFFLE_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function drawnOf(card: TarotCard, orientation: Orientation): DrawnCard {
  return { card, orientation, keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'] }
}

/** h2 の DOM 順に並んだカード名（仮定 D6） */
function displayedNames(): string[] {
  return screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim() ?? '')
}

function countInBody(text: string): number {
  return (document.body.textContent ?? '').split(text).length - 1
}

beforeEach(() => {
  localStorage.clear()
  // 仮定 D1
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('占い履歴: 空のとき（§5.6）', () => {
  it('見出し h1「占い履歴」と「まだ占いの履歴はありません」が出て、カードの行は無い', async () => {
    mountHistory()

    expect(await screen.findByRole('heading', { level: 1, name: '占い履歴' })).toBeTruthy()
    expect(await screen.findByText('まだ占いの履歴はありません')).toBeTruthy()
    expect(displayedNames()).toEqual([])
  })

  it('「占いを始める」を押すと /shuffle へ遷移する', async () => {
    mountHistory()

    fireEvent.click(await screen.findByRole('button', { name: '占いを始める' }))
    expect(await screen.findByText('SHUFFLE_STUB')).toBeTruthy()
  })
})

describe('占い履歴: 一覧表示（§5.6「新しい順に一覧表示（日時・カード・正逆）」）', () => {
  it('3 件入れると新しい順（最後に追加したものが先頭）でカード名が並び、画像も出る', async () => {
    const [first, second, third] = [tarotCards[0], tarotCards[5], tarotCards[10]]
    addToHistory(drawnOf(first, 'upright'))
    addToHistory(drawnOf(second, 'reversed'))
    addToHistory(drawnOf(third, 'upright'))
    // 仮定 D5
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toEqual([third.nameJa, second.nameJa, first.nameJa])
    })
    for (const card of [first, second, third]) {
      expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    }
    // 空表示は出ない
    expect(screen.queryByText('まだ占いの履歴はありません')).toBeNull()
  })

  it('正位置の項目には「正位置」、逆位置の項目には「逆位置」が表示される（混在）', async () => {
    addToHistory(drawnOf(tarotCards[1], 'upright'))
    addToHistory(drawnOf(tarotCards[2], 'reversed'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })
    // 仮定 D2
    expect(document.body.textContent).toContain('正位置')
    expect(document.body.textContent).toContain('逆位置')
  })

  it('全件が正位置なら「逆位置」は出ない', async () => {
    addToHistory(drawnOf(tarotCards[3], 'upright'))
    addToHistory(drawnOf(tarotCards[4], 'upright'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })
    // 仮定 D2
    expect(countInBody('正位置')).toBe(2)
    expect(document.body.textContent).not.toContain('逆位置')
  })

  it('全件が逆位置なら「正位置」は出ない', async () => {
    addToHistory(drawnOf(tarotCards[6], 'reversed'))
    addToHistory(drawnOf(tarotCards[7], 'reversed'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(2)
    })
    // 仮定 D2
    expect(countInBody('逆位置')).toBe(2)
    expect(document.body.textContent).not.toContain('正位置')
  })
})

describe('占い履歴: カテゴリ名（§5.6「詳しく占うの結果はカテゴリ名を添えて記録・表示する（通常占いは従来通り）」）', () => {
  it('カテゴリ名つきの項目にだけカテゴリ名が表示され、無い項目には出ない', async () => {
    const categoryLabel = 'テスト専用カテゴリ名'
    addToHistory(drawnOf(tarotCards[8], 'upright')) // 通常占い（カテゴリ無し）
    addToHistory(drawnOf(tarotCards[9], 'reversed'), categoryLabel) // 詳しく占う
    addToHistory(drawnOf(tarotCards[11], 'upright')) // 通常占い（カテゴリ無し）
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(3)
    })
    // 仮定 D3: 3 行のうち 1 行にだけ付く → ページ全体で 1 回だけ現れる
    expect(countInBody(categoryLabel)).toBe(1)
  })

  it('カテゴリ名つきの項目が複数あれば、それぞれのカテゴリ名が表示される', async () => {
    const labelA = 'テスト専用カテゴリ甲'
    const labelB = 'テスト専用カテゴリ乙'
    addToHistory(drawnOf(tarotCards[12], 'upright'), labelA)
    addToHistory(drawnOf(tarotCards[13], 'upright'))
    addToHistory(drawnOf(tarotCards[14], 'reversed'), labelB)
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(3)
    })
    expect(countInBody(labelA)).toBe(1)
    expect(countInBody(labelB)).toBe(1)
  })

  it('カテゴリ無しの項目だけなら、記録側で付けていない語が画面に湧かない（従来通り）', async () => {
    addToHistory(drawnOf(tarotCards[15], 'upright'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toEqual([tarotCards[15].nameJa])
    })
    // 直前のテストで使った専用ラベルはもちろん、保存されていない categoryLabel が表示されることはない
    expect(loadHistory()[0].categoryLabel).toBeUndefined()
    expect(document.body.textContent).not.toContain('テスト専用カテゴリ')
  })
})

describe('占い履歴: 全削除（§5.6「全削除操作を提供」）', () => {
  it('「履歴をすべて削除」で 0 件になり、空表示（「まだ占いの履歴はありません」「占いを始める」）に戻る', async () => {
    addToHistory(drawnOf(tarotCards[16], 'upright'))
    addToHistory(drawnOf(tarotCards[17], 'reversed'))
    addToHistory(drawnOf(tarotCards[18], 'upright'))
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(3)
    })

    fireEvent.click(screen.getByRole('button', { name: '履歴をすべて削除' }))

    // 画面が空表示に戻る
    expect(await screen.findByText('まだ占いの履歴はありません')).toBeTruthy()
    expect(screen.getByRole('button', { name: '占いを始める' })).toBeTruthy()
    await waitFor(() => {
      expect(displayedNames()).toEqual([])
    })
    for (const card of [tarotCards[16], tarotCards[17], tarotCards[18]]) {
      expect(screen.queryByAltText(card.nameJa)).toBeNull()
    }
    // 保存先（tarot:history）も空になっている（§4.3）
    expect(loadHistory()).toEqual([])
    // 削除前に確認ダイアログが出ている（仮定 D1）
    expect(window.confirm).toHaveBeenCalledWith('占いの履歴をすべて削除します。よろしいですか？')
  })

  it('確認ダイアログでキャンセルすると削除されず、表示も保存先も変わらない', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const cards = [tarotCards[19], tarotCards[20], tarotCards[21]]
    for (const card of cards) addToHistory(drawnOf(card, 'upright'))
    const before = loadHistory()
    mountHistory()

    await waitFor(() => {
      expect(displayedNames()).toHaveLength(3)
    })

    fireEvent.click(screen.getByRole('button', { name: '履歴をすべて削除' }))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    // 画面は 3 件のまま（同期的に消えていないことに加え、少し待っても消えない）
    await waitFor(() => {
      expect(displayedNames()).toEqual([cards[2].nameJa, cards[1].nameJa, cards[0].nameJa])
    })
    expect(screen.queryByText('まだ占いの履歴はありません')).toBeNull()
    // 保存先も変わらない
    expect(loadHistory()).toEqual(before)
  })
})
