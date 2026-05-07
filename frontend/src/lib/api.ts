import { tarotCards } from '../data/cards'
import type { DrawnCard, Orientation, TarotCard } from './types'

// バックエンドを廃して、22 枚のデータをアプリ内に同梱したローカル実装。
// 関数のシグネチャは旧 API 版と同じなので、呼び出し側のコードは変更不要。

function delay<T>(value: T, ms = 0): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function fetchAllCards(_signal?: AbortSignal): Promise<TarotCard[]> {
  // ソートは旧バックエンドと同じ「カード番号昇順」を保つ
  const sorted = [...tarotCards].sort((a, b) => a.number - b.number)
  return delay(sorted)
}

export function fetchCard(id: number, _signal?: AbortSignal): Promise<TarotCard> {
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

export async function drawCards(count = 1, _signal?: AbortSignal): Promise<DrawnCard[]> {
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
