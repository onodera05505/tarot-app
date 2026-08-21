// jsdom 環境のテスト用スタブ。node 環境のテストにも読み込まれるため
// window の有無でガードする。
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
