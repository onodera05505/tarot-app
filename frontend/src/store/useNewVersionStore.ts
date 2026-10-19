import { matchPath } from 'react-router-dom'
import { create } from 'zustand'
import type { ReadingStatus } from './useReadingStore'

/**
 * 画面の経路が App.tsx の Route と同じ一致の仕方で当たるか。
 * 文字列の完全一致にしないこと: ルーターは末尾のスラッシュ（/shuffle/）や大文字小文字の違いでも
 * 同じ画面を出すので、ここだけ完全一致だと儀式の画面を出しているのに「途中でない」と判定し、
 * 新しい版がその場で入れ替わって途中の占いが消える。
 */
function isAtRoute(routePath: string, pathname: string): boolean {
  return matchPath(routePath, pathname) !== null
}

/**
 * 占う人が「占いの途中」かどうか。定義は UC-008 の状態表の前書き:
 * 儀式の中（/shuffle）・占い状態が drawing・占い状態が drawn の占い結果（/result）を示している間。
 * 詳しく占うのカテゴリと質問（/deep）と本日の一枚の開封中は含めない（ADR-0011）。
 * 新しい版への入れ替えの可否はこの関数だけで判定し、他所に条件を散らさないこと。
 * @implements REQ-083, REQ-128
 */
export function isReadingInProgress(pathname: string, status: ReadingStatus): boolean {
  if (isAtRoute('/shuffle', pathname)) return true
  if (status === 'drawing') return true
  return status === 'drawn' && isAtRoute('/result', pathname)
}

type NewVersionState = {
  /** 端末に届いている新しい版へ入れ替える手（契約の updateSW）。届いていない間は null */
  swap: (() => Promise<void>) | null
  /** 新しい版が届き、入れ替えられる状態になった（契約の onNeedRefresh） */
  arrive: (swap: () => Promise<void>) => void
  /** 届いている新しい版へ入れ替える。呼ぶのは 1 回きりで、同じ版を二度入れ替えない */
  swapNow: () => void
}

/**
 * 届いている新しい版と、それへ入れ替える手を持つ。
 * 届いた時点で入れ替えるかは占いの途中かどうかで決まるので、届いたことと入れ替えを分けて持つ。
 */
export const useNewVersionStore = create<NewVersionState>((set, get) => ({
  swap: null,
  arrive: (swap) => set({ swap }),
  swapNow: () => {
    const { swap } = get()
    if (!swap) return
    set({ swap: null })
    void swap()
  },
}))
