import { create } from 'zustand'
import { drawCards } from '../lib/api'
import { addToHistory } from '../lib/history'
import type { DrawnCard, Orientation } from '../lib/types'

export type ReadingStatus = 'idle' | 'drawing' | 'drawn' | 'error'

// 占いセッション全体の状態。
// MVP は 1 枚引きのみ扱う。将来の認証/履歴対応では drawn を
// API/DB へ永続化するレイヤを別途切り出す想定（src/lib/history.ts など）。
type ReadingState = {
  drawn: DrawnCard | null
  status: ReadingStatus
  error: string | null
  drawOne: () => Promise<void>
  /** ユーザー操作（カード選択画面で「上にする側」を選ぶ等）で向きを上書きする */
  setOrientation: (orientation: Orientation) => void
  reset: () => void
}

const initial = {
  drawn: null,
  status: 'idle' as ReadingStatus,
  error: null,
}

export const useReadingStore = create<ReadingState>((set) => ({
  ...initial,
  drawOne: async () => {
    set({ status: 'drawing', error: null })
    try {
      const cards = await drawCards(1)
      const drawn = cards[0] ?? null
      if (drawn) {
        addToHistory(drawn)
      }
      set({ drawn, status: 'drawn' })
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'カードを引けませんでした',
      })
    }
  },
  setOrientation: (orientation) =>
    set((state) => {
      if (!state.drawn) return state
      // 向きが変わるとキーワードも入れ替わる
      const meaning =
        orientation === 'upright'
          ? state.drawn.card.meaningUpright
          : state.drawn.card.meaningReversed
      const keywords = meaning
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
      const next: DrawnCard = { ...state.drawn, orientation, keywords }
      // 履歴は既に追加済みのため、ここでの上書きは drawn のみに留める
      return { drawn: next }
    }),
  reset: () => set({ ...initial }),
}))
