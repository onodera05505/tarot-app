// jsdom 環境のテスト用スタブ。node 環境のテストにも読み込まれるため
// window の有無でガードする。
import { MotionGlobalConfig } from 'framer-motion'

// jsdom では framer-motion のアニメーションが完了せず onAnimationComplete が一度も呼ばれない
// （2026-09-14 に実測: 5 秒待っても発火しない）。結果画面の「めくり完了 → 拡大ボタン有効」など
// 完了コールバックに依存する UI をテストできるよう、テストではアニメーションをスキップして
// 即時完了させる。演出の時間そのものは検証対象にしない（実機で見る）。
MotionGlobalConfig.skipAnimations = true

if (typeof window !== 'undefined') {
  // jsdom は matchMedia 未実装。framer-motion が reduced-motion 判定で参照する
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}
