import { tarotCards } from '../data/cards'
import type { DrawnCard, Orientation, TarotCard } from './types'

// バックエンドを廃して、22 枚のデータをアプリ内に同梱したローカル実装。
// Promise を返すのは旧 API 版と呼び出し側の形を揃えるため（AbortSignal は廃止済み）。

// カード裏面画像の唯一の定義。裏面を表示する箇所は必ずここを import すること
// （以前は 3 画面に同じ文字列が直書きされていた。tests/card-back.test.ts が
// 直書きの再発を検知する）。実体は public/cards/major/000.webp。
export const CARD_BACK_URL = '/cards/major/000.webp'

// 小さく描く場所（一覧・履歴・本日の一枚・儀式の山札。CSS で 60〜88px 幅）用のサムネイル。
// 原本 1024×1536 を 320px 幅にしたものを public/cards/thumbs/ に置く（scripts/gen-thumbs.py で生成、
// 生成物はコミット）。URL の対応はこの関数だけが知る。結果画面・詳細・シェア画像は原本を使う。
export function thumbUrl(imageUrl: string): string {
  return imageUrl.replace('/cards/major/', '/cards/thumbs/')
}
export const CARD_BACK_THUMB_URL = thumbUrl(CARD_BACK_URL)

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
