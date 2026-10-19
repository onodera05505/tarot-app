import type { Page } from '@playwright/test'

// 端末への記録（占い履歴）を通しテストから読むための唯一の置き場。
// 形の SSOT は UC-001 の契約 loadHistory（localStorage キー tarot:history、HistoryEntry の新しい順の配列）。

export const HISTORY_KEY = 'tarot:history'

/** 占い履歴の項目のうち、事後条件の確認に使う部分（UC-001 契約 HistoryEntry の射影） */
export type HistoryEntry = {
  card: { nameJa: string; descriptionUpright: string; descriptionReversed: string }
  orientation: 'upright' | 'reversed'
  keywords: string[]
  categoryLabel?: string
}

/** 端末への記録から占い履歴を新しい順に読む */
export async function loadHistory(page: Page): Promise<HistoryEntry[]> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? '[]'), HISTORY_KEY)
}
