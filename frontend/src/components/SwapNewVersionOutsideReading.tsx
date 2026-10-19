import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useReadingStore } from '../store/useReadingStore'
import { isReadingInProgress, useNewVersionStore } from '../store/useNewVersionStore'

/**
 * 届いている新しい版（useNewVersionStore）へ、占いの途中でないときに入れ替える。描画はしない。
 * 場所（儀式の中か・占い結果か）と占い状態の両方を見るので、ルーターの中（main.tsx）に置く。
 * @implements REQ-083, REQ-128
 */
export function SwapNewVersionOutsideReading() {
  const { pathname } = useLocation()
  const status = useReadingStore((s) => s.status)
  const swap = useNewVersionStore((s) => s.swap)

  useEffect(() => {
    if (!swap || isReadingInProgress(pathname, status)) return
    // 1 つの操作の中で占い状態と場所が続けて変わる（「もう一度占う」は reset で idle にしてから /shuffle へ
    // 移る）ため、その場で入れ替えると途中の占いを消す。操作が収まるまで遅らせ、途中で儀式に入ったら取り消す
    const id = window.setTimeout(() => useNewVersionStore.getState().swapNow(), 0)
    return () => window.clearTimeout(id)
  }, [swap, pathname, status])

  return null
}
