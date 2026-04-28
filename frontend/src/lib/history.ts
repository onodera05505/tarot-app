import type { DrawnCard, Orientation, TarotCard } from './types'

const STORAGE_KEY = 'tarot:history'
const MAX_ENTRIES = 100

export type HistoryEntry = {
  id: string
  drawnAt: number // epoch ms
  card: TarotCard
  orientation: Orientation
  keywords: string[]
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function addToHistory(drawn: DrawnCard): HistoryEntry {
  const entry: HistoryEntry = {
    id: makeId(),
    drawnAt: Date.now(),
    card: drawn.card,
    orientation: drawn.orientation,
    keywords: drawn.keywords,
  }
  const list = loadHistory()
  const next = [entry, ...list].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // QuotaExceededError 等は静かに失敗（履歴は補助機能なので致命的ではない）
  }
  return entry
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 無視
  }
}
