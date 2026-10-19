import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToHistory, clearHistory, loadHistory } from '../src/lib/history'
import { tarotCards } from '../src/data/cards'
import type { DrawnCard } from '../src/lib/types'

// UC-001 の要件の文（REQ-126）と契約（contract.yaml の clearHistory: errors の STORAGE_WRITE_FAILED、例 removeRejected）
// だけから設計（実装は参照していない）。
// Node 環境なので localStorage を最小のスタブで差し替える（UC-001-history-record.test.ts と同じやり方）。
// 「端末から消せない」は、占い履歴のキーへの消去・上書き・全消去のどれもが端末に拒まれる状態として起こす
// （消し方は契約が決めていないので、どの消し方でも同じ失敗に当たるようにする）。

const STORAGE_KEY = 'tarot:history'

/** 端末が消去を拒むときに投げる例外。ブラウザが記憶領域の失敗で投げる形に合わせる */
function removeRejectedError(): Error {
  return new DOMException('端末が消去を受け付けない（テスト用）', 'QuotaExceededError')
}

/** 読むことはできるが、占い履歴のキーの消去・上書き・全消去を拒む端末 */
function makeRemoveRejectingStorage(seed: Map<string, string>) {
  return {
    getItem: (key: string) => seed.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === STORAGE_KEY) throw removeRejectedError()
      seed.set(key, value)
    },
    removeItem: (key: string) => {
      if (key === STORAGE_KEY) throw removeRejectedError()
      seed.delete(key)
    },
    clear: () => {
      throw removeRejectedError()
    },
  }
}

function makeWritableStorage(seed: Map<string, string>) {
  return {
    getItem: (key: string) => seed.get(key) ?? null,
    setItem: (key: string, value: string) => void seed.set(key, value),
    removeItem: (key: string) => void seed.delete(key),
    clear: () => seed.clear(),
  }
}

function drawnOf(index: number): DrawnCard {
  return { card: tarotCards[index % tarotCards.length], orientation: 'upright', keywords: [`記録${index}`] }
}

let store: Map<string, string>

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', makeWritableStorage(store))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// UC-001
describe('占い履歴の全削除: 端末から消せないとき（UC-001）', () => {
  // @covers REQ-126#operation-raises-on-remove-failure
  it('端末が消去を拒むと clearHistory は失敗を外に出し、端末の占い履歴はそのまま残る', () => {
    addToHistory(drawnOf(0))
    addToHistory(drawnOf(1))
    const rawBefore = localStorage.getItem(STORAGE_KEY)
    const listBefore = loadHistory()
    expect(listBefore).toHaveLength(2)
    vi.stubGlobal('localStorage', makeRemoveRejectingStorage(store))

    // 契約 clearHistory の例 removeRejected: 失敗を外に出す（黙って成功したことにしない）
    expect(() => clearHistory()).toThrow()

    // 端末の占い履歴は承諾の前のまま
    expect(localStorage.getItem(STORAGE_KEY)).toBe(rawBefore)
    expect(loadHistory()).toEqual(listBefore)
  })

  // @covers REQ-126#operation-raises-on-remove-failure
  it('端末が消去を拒んだ後、端末が再び受け付けるようになれば同じ操作で消える（失敗が操作の側に残らない）', () => {
    addToHistory(drawnOf(2))
    vi.stubGlobal('localStorage', makeRemoveRejectingStorage(store))
    expect(() => clearHistory()).toThrow()
    expect(loadHistory()).toHaveLength(1)

    vi.stubGlobal('localStorage', makeWritableStorage(store))
    clearHistory()

    expect(loadHistory()).toEqual([])
  })
})
