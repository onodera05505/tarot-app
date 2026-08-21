import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tarotCards } from '../src/data/cards'

// 仕様書 v3 §4.1「データ仕様 / TarotCard」に基づくカードデータの検証。
// cards.ts は cards.md から自動生成されるため、生成パイプラインの退行検知を兼ねる。

describe('カードデータ（仕様書 v3 §4.1）', () => {
  it('大アルカナ 22 枚が揃っている', () => {
    expect(tarotCards).toHaveLength(22)
  })

  it('number は 0〜21 の連番（重複なし）', () => {
    const numbers = [...tarotCards.map((c) => c.number)].sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: 22 }, (_, i) => i))
  })

  it('id は 1〜22 で一意', () => {
    const ids = [...tarotCards.map((c) => c.id)].sort((a, b) => a - b)
    expect(ids).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
  })

  it('全フィールドが空でない（プレースホルダー「未設定」も残っていない）', () => {
    for (const card of tarotCards) {
      for (const [key, value] of Object.entries(card)) {
        if (typeof value !== 'string') continue
        expect(value.trim(), `${card.nameJa} の ${key}`).not.toBe('')
        expect(value, `${card.nameJa} の ${key}`).not.toContain('未設定')
      }
    }
  })

  it('正逆キーワードはカンマ区切りで 2〜3 語', () => {
    for (const card of tarotCards) {
      for (const field of ['meaningUpright', 'meaningReversed'] as const) {
        const words = card[field]
          .split(',')
          .map((w) => w.trim())
          .filter((w) => w.length > 0)
        expect(
          words.length,
          `${card.nameJa} の ${field}: "${card[field]}"`,
        ).toBeGreaterThanOrEqual(2)
        expect(words.length, `${card.nameJa} の ${field}`).toBeLessThanOrEqual(3)
      }
    }
  })

  it('imageUrl の画像実体が public/ 配下に存在する（裏面 000.webp も）', () => {
    const publicDir = join(import.meta.dirname, '..', 'public')
    for (const card of tarotCards) {
      expect(card.imageUrl).toMatch(/^\/cards\/major\/.+\.webp$/)
      expect(
        existsSync(join(publicDir, card.imageUrl)),
        `${card.nameJa}: ${card.imageUrl}`,
      ).toBe(true)
    }
    expect(existsSync(join(publicDir, 'cards/major/000.webp'))).toBe(true)
  })
})
