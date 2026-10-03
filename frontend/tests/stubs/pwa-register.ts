// テスト専用の差し替え先。`virtual:pwa-register` は保持の仕組みのプラグインがビルド時にだけ作るモジュールで、
// テストの設定（vitest.config.ts）はそのプラグインを外しているため、別名でここへ解決させる。
// 形は UC-008 の契約（contract.yaml の `registerSW` / `onRegisteredSW`）だけを写す。振る舞いは持たない
// （登録しない・コールバックを呼ばない）。呼び出しを観測したいテストは、この上から `vi.mock('virtual:pwa-register')` で差し替える。
// ここへ実装の都合（保持の仕組みの中身の再現）を書き足さないこと。契約が変わったらここも同じ区切りで直す。

export interface RegisterSWOptions {
  immediate?: boolean
  onRegisteredSW?: (swScriptUrl: string, registration?: ServiceWorkerRegistration) => void
}

export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  void options
  return async () => {}
}
