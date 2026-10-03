import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToHistory, loadHistory } from '../src/lib/history'
import { tarotCards } from '../src/data/cards'
import type { DrawnCard, Orientation } from '../src/lib/types'

// UC-001 の要件の文と契約（contract.yaml の addToHistory / loadHistory）だけから設計（実装は参照していない）。
// Node 環境なので localStorage を最小のスタブで差し替える（history.test.ts と同じやり方）。

/** 上限件数。値の正本は UC-001 の契約 `loadHistory` の `maxItems` */
const MAX_ITEMS = 100
const STORAGE_KEY = 'tarot:history'

function makeStorageStub() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

/** 何番目に記録したかをキーワードに刻み、項目を取り違えずに見分ける */
function drawnOf(index: number, orientation: Orientation = 'upright'): DrawnCard {
  const card = tarotCards[index % tarotCards.length]
  return { card, orientation, keywords: [`記録${index}`] }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorageStub())
})

afterEach(() => {
  vi.useRealTimers()
})

// UC-001
describe('占い履歴への記録: 項目の中身（UC-001）', () => {
  // @covers REQ-001#entry-content
  it('記録した項目に、カード・正逆・キーワードと、記録したときの日時がそろう', () => {
    const recordedAt = new Date('2031-12-25T14:37:00').getTime()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(recordedAt)
    const drawn: DrawnCard = {
      card: tarotCards[4],
      orientation: 'reversed',
      keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
    }

    addToHistory(drawn)

    const [entry] = loadHistory()
    expect(entry.card.id).toBe(tarotCards[4].id)
    expect(entry.card.nameJa).toBe(tarotCards[4].nameJa)
    expect(entry.orientation).toBe('reversed')
    expect(entry.keywords).toEqual(['テスト専用キーワード甲', 'テスト専用キーワード乙'])
    expect(entry.drawnAt).toBe(recordedAt)
  })

  // @covers REQ-001#no-category-label
  it('カテゴリ名を渡さずに記録した項目は、カテゴリ名を持たない（既にカテゴリ名つきの項目があっても移らない）', () => {
    addToHistory(drawnOf(0), 'テスト専用カテゴリ名')
    addToHistory(drawnOf(1))

    const list = loadHistory()
    expect(list).toHaveLength(2)
    expect(list[0].keywords).toEqual(['記録1'])
    expect(list[0].categoryLabel).toBeUndefined()
    expect('categoryLabel' in list[0]).toBe(false)
  })

  // @covers REQ-005#category-label
  it('カテゴリ名を添えて記録すると、その項目が先頭に入り、そのカテゴリ名を持つ', () => {
    addToHistory(drawnOf(0))
    addToHistory(drawnOf(1, 'reversed'), 'テスト専用カテゴリ名')

    const list = loadHistory()
    expect(list).toHaveLength(2)
    expect(list[0].keywords).toEqual(['記録1'])
    expect(list[0].card.id).toBe(tarotCards[1].id)
    expect(list[0].orientation).toBe('reversed')
    expect(list[0].categoryLabel).toBe('テスト専用カテゴリ名')
    // 前からある項目にカテゴリ名が移らない
    expect(list[1].categoryLabel).toBeUndefined()
  })
})

// UC-001
describe('占い履歴への記録: 上限件数の境界（UC-001）', () => {
  // @covers REQ-002#exactly-at-limit
  it('上限件数ちょうどの占い履歴に 1 件加えると、件数はそのままで、記録したのが最も前の 1 件だけが除かれる', () => {
    for (let i = 0; i < MAX_ITEMS; i++) {
      addToHistory(drawnOf(i))
    }
    const full = loadHistory()
    expect(full).toHaveLength(MAX_ITEMS)
    // 上限件数ちょうどまでは何も除かれない
    expect(full[MAX_ITEMS - 1].keywords).toEqual(['記録0'])

    addToHistory(drawnOf(MAX_ITEMS))

    const list = loadHistory()
    expect(list).toHaveLength(MAX_ITEMS)
    expect(list[0].keywords).toEqual([`記録${MAX_ITEMS}`])
    expect(list[MAX_ITEMS - 1].keywords).toEqual(['記録1'])
    expect(list.some((entry) => entry.keywords[0] === '記録0')).toBe(false)
    // 残りは記録した順のまま（後から記録したものほど先）
    expect(list.map((entry) => entry.keywords[0])).toEqual(
      Array.from({ length: MAX_ITEMS }, (_, i) => `記録${MAX_ITEMS - i}`),
    )
  })
})

// UC-001
describe('占い履歴への記録: 記録内容が読めないとき（UC-001）', () => {
  const unreadable: Array<[string, string]> = [
    ['JSON として壊れている', '{broken json'],
    ['JSON だが配列でない', '{"not":"an array"}'],
  ]

  for (const [label, raw] of unreadable) {
    // @covers REQ-003#unreadable-then-record
    it(`${label}記録内容の上に記録すると、読めない内容を捨てて、その 1 件だけの占い履歴になる`, () => {
      localStorage.setItem(STORAGE_KEY, raw)

      addToHistory(drawnOf(7, 'reversed'))

      const list = loadHistory()
      expect(list).toHaveLength(1)
      expect(list[0].card.id).toBe(tarotCards[7].id)
      expect(list[0].orientation).toBe('reversed')
      expect(list[0].keywords).toEqual(['記録7'])
      // 端末に残る内容そのものが、読める配列に置き換わっている
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(Array.isArray(stored)).toBe(true)
      expect(stored as unknown[]).toHaveLength(1)
    })
  }
})
