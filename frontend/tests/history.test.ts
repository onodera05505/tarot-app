import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addToHistory, clearHistory, loadHistory } from '../src/lib/history'
import { tarotCards } from '../src/data/cards'
import type { DrawnCard } from '../src/lib/types'

// 仕様書 v3 §4.3「localStorage キー / tarot:history」の検証。
// Node 環境なので localStorage を最小実装のスタブで差し替える。

function makeStorageStub() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

function drawnOf(cardIndex: number): DrawnCard {
  const card = tarotCards[cardIndex % tarotCards.length]
  return { card, orientation: 'upright', keywords: ['a', 'b'] }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorageStub())
})

describe('占い履歴（仕様書 v3 §4.3）', () => {
  it('未保存なら空配列を返す', () => {
    expect(loadHistory()).toEqual([])
  })

  it('追加すると新しい順（先頭が最新）で保存される', () => {
    addToHistory(drawnOf(0))
    addToHistory(drawnOf(1))
    const list = loadHistory()
    expect(list).toHaveLength(2)
    expect(list[0].card.id).toBe(tarotCards[1].id)
    expect(list[1].card.id).toBe(tarotCards[0].id)
  })

  it('最大 100 件を超えると古い方から破棄される', () => {
    for (let i = 0; i < 105; i++) {
      addToHistory(drawnOf(i))
    }
    const list = loadHistory()
    expect(list).toHaveLength(100)
    // 最新（105 件目 = index 104）は残り、最古の 5 件は消えている
    expect(list[0].card.id).toBe(tarotCards[104 % tarotCards.length].id)
  })

  it('壊れた JSON や配列以外が入っていても空配列にフォールバックする', () => {
    localStorage.setItem('tarot:history', '{broken json')
    expect(loadHistory()).toEqual([])
    localStorage.setItem('tarot:history', '{"not":"an array"}')
    expect(loadHistory()).toEqual([])
  })

  it('clearHistory で全削除される', () => {
    addToHistory(drawnOf(0))
    clearHistory()
    expect(loadHistory()).toEqual([])
  })
})
