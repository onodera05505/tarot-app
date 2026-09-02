import { tarotCards } from '../data/cards'
import type { DrawnCard, Orientation, TarotCard } from './types'

// バックエンドを廃して、22 枚のデータをアプリ内に同梱したローカル実装。
// Promise を返すのは旧 API 版と呼び出し側の形を揃えるため（AbortSignal は廃止済み）。

// カード裏面画像の唯一の定義。裏面を表示する箇所は必ずここを import すること
// （以前は 3 画面に同じ文字列が直書きされていた。tests/card-back.test.ts が
// 直書きの再発を検知する）。実体は public/cards/major/000.webp。
export const CARD_BACK_URL = '/cards/major/000.webp'

function delay<T>(value: T, ms = 0): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function fetchAllCards(): Promise<TarotCard[]> {
  // ソートは旧バックエンドと同じ「カード番号昇順」を保つ
  const sorted = [...tarotCards].sort((a, b) => a.number - b.number)
  return delay(sorted)
}

export function fetchCard(id: number): Promise<TarotCard> {
  const card = tarotCards.find((c) => c.id === id)
  if (!card) {
    return Promise.reject(new Error('Card not found'))
  }
  return delay(card)
}

function fisherYatesPick(count: number): TarotCard[] {
  const arr = [...tarotCards]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

export async function drawCards(count = 1): Promise<DrawnCard[]> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer')
  }
  if (count > tarotCards.length) {
    throw new Error(`count exceeds available cards (${tarotCards.length})`)
  }

  const picked = fisherYatesPick(count)
  const drawn: DrawnCard[] = picked.map((card) => {
    const orientation: Orientation = Math.random() < 0.5 ? 'upright' : 'reversed'
    const meaning = orientation === 'upright' ? card.meaningUpright : card.meaningReversed
    const keywords = meaning
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    return { card, orientation, keywords }
  })

  return delay(drawn)
}
