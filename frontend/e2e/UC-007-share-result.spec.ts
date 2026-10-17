import { test, expect, type Page } from '@playwright/test'

// UC-007 占い結果をシェアする — 主シナリオの通しテスト（1 UC 1 本、成功経路のみ）。
// 手順と事後条件の SSOT は docs/goals/GOAL-01-ritual-reading/UC-007-share-result/UC.md。
// ロケータは docs/01-glossary.md の語（シェア・正位置・逆位置）から導く。
// 端末の共有機能（ACT-03、navigator.share / navigator.canShare）は外部のアクターなので、受け取ったものを記録する
// 差し替えを置いて観測する。受け取る形の SSOT は同 UC の契約 shareOrDownload（blob は image/png、
// filename は ^tarot-[0-9]+\.png$、text は ^.+（(正位置|逆位置)）$）。

/** 差し替えた端末の共有機能が受け取った 1 回分（ShareData のうち契約 shareOrDownload の request に対応する部分） */
type ShareCall = { files: { name: string; type: string }[]; text?: string; title?: string }

declare global {
  interface Window {
    __shareCalls?: ShareCall[]
  }
}

/** 端末への記録（localStorage キー tarot:history）から占い履歴を新しい順に読む（UC-001 契約 loadHistory の形） */
async function loadHistory(page: Page): Promise<unknown[]> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('tarot:history') ?? '[]'))
}

/**
 * 事前条件「占い状態が drawn の占い結果が表示されている」を作る。
 * UC-006 の主シナリオ（スタート → シャッフルへ進む → ストップ → 山の順を決定 → 山の選択を確定 → 左右選択）を
 * そのまま行うだけで、この UC の手順ではない。手順の SSOT は UC-006 の UC.md（文言の導出も同じ）。
 */
async function reachDrawnResult(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'スタート' }).click()
  await page.getByRole('button', { name: /シャッフル/ }).click()
  await page.getByRole('button', { name: 'ストップ' }).click()
  const piles3 = page.getByRole('button', { name: /山/ })
  await expect(piles3).toHaveCount(3)
  for (let i = 0; i < 3; i++) await piles3.nth(i).click()
  await page.getByRole('button', { name: '決定' }).click()
  const piles2 = page.getByRole('button', { name: /山/ })
  await expect(piles2).toHaveCount(2)
  await piles2.first().click()
  await page.getByRole('button', { name: '確定' }).click()
  await page.getByRole('button', { name: /左/ }).click()
  await expect(page.getByText(/正位置|逆位置/).first()).toBeVisible()
}

test.describe('UC-007 占い結果をシェアする', () => {
  test.beforeEach(async ({ page }) => {
    // 端末の共有機能（ACT-03）の差し替え: 受け取れる（canShare が真）とし、受け取ったものを記録して完了する
    await page.addInitScript(() => {
      window.__shareCalls = []
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { files?: File[]; text?: string; title?: string }) => {
          window.__shareCalls?.push({
            files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type })),
            text: data.text,
            title: data.title,
          })
        },
      })
    })
  })

  // 保留: 実装の配線（用語どおりの文言）と実ブラウザでの確認がまだ。配線が済んだら fixme を外す
  // @scenario UC-007
  test.fixme('UC-007: 占い結果でシェアを選ぶと、シェア画像がカード名と正逆を添えて端末の共有機能に渡り、再びシェアを選べる', async ({ page }) => {
    // 事前条件: 占い状態が drawn の占い結果が表示されている
    await reachDrawnResult(page)
    const historyBefore = await loadHistory(page)
    const share = page.getByRole('button', { name: 'シェア' })

    // 1. 占う人が占い結果のシェアを選ぶ
    await share.click()

    // 2. システムがシェア画像を作る → 3. カード名と正逆を添えて端末の共有機能へ渡す → 4. 端末の共有機能が受け取る
    await expect.poll(() => page.evaluate(() => window.__shareCalls?.length ?? 0)).toBe(1)
    const [received] = await page.evaluate(() => window.__shareCalls ?? [])
    expect(received.files).toHaveLength(1)
    expect(received.files[0].type).toBe('image/png')
    expect(received.files[0].name).toMatch(/^tarot-[0-9]+\.png$/)
    expect(received.text).toMatch(/^.+（(正位置|逆位置)）$/)

    // 5. システムが、再びシェアを選べる状態に戻る
    // 事後条件（成功時）: 占い結果は表示されたままで、再びシェアを選べる。占い状態と占い履歴は変わらない
    await expect(page.getByText(/正位置|逆位置/).first()).toBeVisible()
    await expect(share).toBeEnabled()
    expect(await loadHistory(page)).toEqual(historyBefore)
  })
})
