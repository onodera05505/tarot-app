import type { DrawnCard, Orientation, TarotCard } from './types'

const STORAGE_KEY = 'tarot:history'
const MAX_ENTRIES = 100

export type HistoryEntry = {
  id: string
  drawnAt: number // epoch ms
  card: TarotCard
  orientation: Orientation
  keywords: string[]
  /** 詳しく占うの場合のカテゴリ名（通常占いでは undefined） */
  categoryLabel?: string
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// @implements REQ-003, REQ-009
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

// @implements REQ-001, REQ-002, REQ-005 / BR-004
export function addToHistory(
  drawn: DrawnCard,
  categoryLabel?: string,
): HistoryEntry {
  const entry: HistoryEntry = {
    id: makeId(),
    drawnAt: Date.now(),
    card: drawn.card,
    orientation: drawn.orientation,
    keywords: drawn.keywords,
    ...(categoryLabel ? { categoryLabel } : {}),
  }
  const list = loadHistory()
  const next = [entry, ...list].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // @implements REQ-004
    // QuotaExceededError 等は静かに失敗（履歴は補助機能なので致命的ではない）
  }
  return entry
}

// 端末から消せないときは失敗をそのまま外に出す（契約 clearHistory の STORAGE_WRITE_FAILED）。
// ここで握りつぶすと、呼び出し側が「消せた」と誤認して一覧を空にしてしまう。
// @implements REQ-011, REQ-126
export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
