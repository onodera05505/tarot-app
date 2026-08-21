import { create } from 'zustand'
import { drawCards } from '../lib/api'
import { addToHistory } from '../lib/history'
import type { DeepCategoryId } from '../data/deep/types'
import type { DrawnCard } from '../lib/types'

export type ReadingStatus = 'idle' | 'drawing' | 'drawn' | 'error'

/** 詳しく占う（v3.1 §5.7）の文脈。質問完了時のみセットされ、reset で消える */
export type DeepContext = {
  categoryId: DeepCategoryId
  categoryLabel: string
  /** 質問順の選択肢 id（3 件） */
  answers: string[]
}

// 占いセッション全体の状態。
// MVP は 1 枚引きのみ扱う。将来の認証/履歴対応では drawn を
// API/DB へ永続化するレイヤを別途切り出す想定（src/lib/history.ts など）。
type ReadingState = {
  drawn: DrawnCard | null
  status: ReadingStatus
  error: string | null
  deep: DeepContext | null
  // 正逆は drawOne 時のランダム値で確定。儀式中のユーザー操作で上書きしない
  // （旧 setOrientation はユーザー要望で撤回済み。経緯はコミット 24efef6 と仕様書 v3 §4.2）
  drawOne: () => Promise<void>
  setDeepContext: (deep: DeepContext) => void
  reset: () => void
}

const initial = {
  drawn: null,
  status: 'idle' as ReadingStatus,
  error: null,
  deep: null,
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  ...initial,
  drawOne: async () => {
    set({ status: 'drawing', error: null })
    try {
      const cards = await drawCards(1)
      const drawn = cards[0] ?? null
      if (drawn) {
        // 詳しく占うの場合はカテゴリ名を添えて記録する（v3.1 §5.6）
        addToHistory(drawn, get().deep?.categoryLabel)
      }
      set({ drawn, status: 'drawn' })
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'カードを引けませんでした',
      })
    }
  },
  setDeepContext: (deep) => set({ deep }),
  reset: () => set({ ...initial }),
}))
