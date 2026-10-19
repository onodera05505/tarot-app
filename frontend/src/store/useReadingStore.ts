import { create } from 'zustand'
import { drawCards } from '../lib/api'
import { addToHistory } from '../lib/history'
import type { DeepCategoryId } from '../data/deep/types'
import type { DrawnCard } from '../lib/types'

export type ReadingStatus = 'idle' | 'drawing' | 'drawn' | 'error'

/** 詳しく占うで持ち込むカテゴリと回答。最後の質問に答えた時点でのみセットされ、reset で消える */
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
  /**
   * スタートまたは持ち込む操作から儀式へ進む途中であることの印（BR-002）。
   * `start` と `setDeepContext` が立て、儀式が到達時に `enterRitual` で消す。
   * 印の無い到達（アドレスの指定・ブラウザの戻る/進む）は直接到達として扱う
   */
  ritualEntry: boolean
  // 正逆は drawOne 時のランダム値で確定し、儀式中の占う人の操作で上書きしない（BR-001）。
  // 正逆を書き換える操作をこのストアに足さないこと
  drawOne: () => Promise<void>
  setDeepContext: (deep: DeepContext) => void
  /** 占い状態を初期化し、儀式へ進む印を立てる（スタート・もう一度占う） */
  start: () => void
  /** 儀式への到達。印があれば消して引き継ぎ、無ければ直接到達として初期化する */
  enterRitual: () => void
  reset: () => void
}

// @implements BR-002
const initial = {
  drawn: null,
  status: 'idle' as ReadingStatus,
  error: null,
  deep: null,
  ritualEntry: false,
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  ...initial,
  // @implements REQ-057, REQ-001, REQ-005, REQ-048 / BR-004
  drawOne: async () => {
    set({ status: 'drawing', error: null })
    try {
      const cards = await drawCards(1)
      const drawn = cards[0] ?? null
      if (drawn) {
        // @implements REQ-114
        // 詳しく占うの場合はカテゴリ名を添えて記録する
        addToHistory(drawn, get().deep?.categoryLabel)
      }
      set({ drawn, status: 'drawn' })
    } catch (e) {
      // @implements REQ-067
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'カードを引けませんでした',
      })
    }
  },
  // @implements REQ-045 / BR-002
  setDeepContext: (deep) => set({ deep, ritualEntry: true }),
  // @implements REQ-054, REQ-070 / BR-002
  start: () => set({ ...initial, ritualEntry: true }),
  // @implements REQ-132 / BR-002
  enterRitual: () => {
    if (get().ritualEntry) {
      set({ ritualEntry: false })
      return
    }
    set({ ...initial })
  },
  // @implements BR-002
  reset: () => set({ ...initial }),
}))
