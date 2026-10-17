import { test, expect } from '@playwright/test'

// UC-002 ホーム画面から開いて通信なしで占う（docs/goals/GOAL-06-home-and-offline/UC-002-use-offline-from-home-screen/UC.md）の通しテスト。
// 主シナリオの番号順の手順と「成功時」の事後条件だけを写す。
//
// ブラウザから起こせる手順だけを書く:
//   手順 1–2: 通信ありで開き、保持の仕組みが登録されること（navigator.serviceWorker.ready。用語集「保持の仕組み」= registerSW）
//   手順 5–6 のうち「通信のない状態で開く」: context.setOffline(true) のうえで開き直し、アプリ（トップ）が示されること
// 起こせない手順（報告の (d) に記す）:
//   手順 3–4（ホーム画面に追加、アプリ名とアイコンで置かれる）と手順 6 の「ブラウザの操作枠なし」は端末（OS）側の出来事で、
//   Playwright の Chromium から起こせない。manifest の宣言（vite.config.ts）は機械可読な正本として別の層で見る。
//   手順 7–8（占いを行い、カードの画像を含む占い結果を示す）は UC-006 の儀式の操作で、その文言はこの UC の入力に無い。

test.describe('UC-002 ホーム画面から開いて通信なしで占う', () => {
  // 保留: 保持の仕組みの登録は本番ビルド（vite preview）でのみ起き、実ブラウザでの確認が済んでいない。手順 3–4・6・7–8 は起こせない（上記）
  // @scenario UC-002
  test.fixme('UC-002: 通信ありで一度開いて端末に保持し、通信のない状態で開き直してもアプリが開く', { tag: '@UC-002' }, async ({ page, context }) => {
    // 手順 1: 占う人が通信のある状態でブラウザからアプリを開く
    await page.goto('/')

    // 手順 2: システムがアプリを表示し、以後通信なしでも開けるように全体を端末に保持する
    // （トップは本日の一枚と各入口を置く。用語集: トップ / 本日の一枚）
    await expect(page.getByText('本日の一枚').first()).toBeVisible()
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const registration = await navigator.serviceWorker.ready
      return registration.active !== null
    })
    expect(registered).toBe(true)

    // 手順 5（ブラウザから起こせる部分）: 通信のない状態でアプリを開く
    await context.setOffline(true)
    await page.goto('/')

    // 手順 6（ブラウザから観測できる部分）: システムがアプリを開く
    await expect(page.getByText('本日の一枚').first()).toBeVisible()

    // 手順 7–8 と事後条件（通信のない状態で、カードの画像を含む占い結果を見ている）は、
    // 儀式の操作の文言（UC-006）がこの UC の入力に無いため、ここでは駆動しない（報告の (d)）。

    await context.setOffline(false)
  })
})
