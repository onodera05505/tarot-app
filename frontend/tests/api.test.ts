import { describe, expect, it } from 'vitest'
import { drawCards, fetchAllCards, fetchCard } from '../src/lib/api'
import { tarotCards } from '../src/data/cards'

// 仕様書 v3 §4.2「抽選ロジック」と §2（local-only の API ラッパー）の検証。

describe('fetchAllCards', () => {
  it('22 枚をカード番号昇順で返す', async () => {
    const cards = await fetchAllCards()
    expect(cards).toHaveLength(22)
    expect(cards.map((c) => c.number)).toEqual(
      Array.from({ length: 22 }, (_, i) => i),
    )
  })
})

describe('fetchCard', () => {
  it('存在する id はそのカードを返す', async () => {
    const card = await fetchCard(1)
    expect(card.id).toBe(1)
  })

  it('存在しない id は reject する', async () => {
    await expect(fetchCard(999)).rejects.toThrow('Card not found')
  })
})

describe('drawCards（仕様書 v3 §4.2）', () => {
  it('既定で 1 枚引く', async () => {
    const drawn = await drawCards()
    expect(drawn).toHaveLength(1)
  })

  it('引いたカードの orientation は upright か reversed', async () => {
    const [d] = await drawCards(1)
    expect(['upright', 'reversed']).toContain(d.orientation)
  })

  it('keywords は orientation に対応する meaning をカンマ分割したもの', async () => {
    const [d] = await drawCards(1)
    const source =
      d.orientation === 'upright'
        ? d.card.meaningUpright
        : d.card.meaningReversed
    expect(d.keywords).toEqual(
      source
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    )
  })

  it('複数枚引きでカードは重複しない（22 枚全引きで検証）', async () => {
    const drawn = await drawCards(22)
    const ids = new Set(drawn.map((d) => d.card.id))
    expect(ids.size).toBe(22)
  })

  it('正位置・逆位置の両方が出現する（ランダム性の粗い検証）', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300 && seen.size < 2; i++) {
      const [d] = await drawCards(1)
      seen.add(d.orientation)
    }
    expect(seen).toEqual(new Set(['upright', 'reversed']))
  })

  it('count が 1 未満・非整数・在庫超過なら throw する', async () => {
    await expect(drawCards(0)).rejects.toThrow()
    await expect(drawCards(1.5)).rejects.toThrow()
    await expect(drawCards(tarotCards.length + 1)).rejects.toThrow()
  })
})
