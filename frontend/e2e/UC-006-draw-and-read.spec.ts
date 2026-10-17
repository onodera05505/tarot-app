import { test, expect, type Page } from '@playwright/test'

// UC-006 儀式を進めて 1 枚を引き、占い結果を読む — 主シナリオの通しテスト（1 UC 1 本、成功経路のみ）。
// 手順と事後条件の SSOT は docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/UC.md。
// ロケータは docs/01-glossary.md の語（スタート・ストップ・山・左右選択・正位置・逆位置）から導く。
// 占い履歴の形は UC-001 の契約（loadHistory: localStorage キー tarot:history、HistoryEntry）から導く。

/** 占い履歴の項目のうち、事後条件の確認に使う部分（UC-001 契約 HistoryEntry の射影） */
type HistoryEntry = {
  card: { nameJa: string; descriptionUpright: string; descriptionReversed: string }
  orientation: 'upright' | 'reversed'
  keywords: string[]
  categoryLabel?: string
}

/** 端末への記録（localStorage キー tarot:history）から占い履歴を新しい順に読む（UC-001 契約 loadHistory の形） */
async function loadHistory(page: Page): Promise<HistoryEntry[]> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('tarot:history') ?? '[]'))
}

/** 正逆（コード識別子）→ 画面の語（用語集: 正位置 / 逆位置） */
const orientationLabel = { upright: '正位置', reversed: '逆位置' } as const

test.describe('UC-006 儀式を進めて 1 枚を引き、占い結果を読む', () => {
  // 保留: 実装の配線（用語どおりの文言）と実ブラウザでの確認がまだ。配線が済んだら fixme を外す
  // @scenario UC-006
  test.fixme('UC-006: スタートから左右選択まで儀式を進めると、決まったカードの占い結果が読め、占い履歴に 1 件記録される', async ({ page }) => {
    // 事前条件: 占う人がトップにいる（占い状態は問わない）
    await page.goto('/')
    const historyBefore = await loadHistory(page)

    // 1. 占う人がスタートを選ぶ
    await page.getByRole('button', { name: 'スタート' }).click()

    // 2. システムが占うことを思い浮かべる段階とその案内を示す → 3. 占う人がシャッフルへ進む
    await page.getByRole('button', { name: /シャッフル/ }).click()

    // 4. システムがカードを混ぜ続け、ストップを待つ → 5. 占う人がストップを押す
    await page.getByRole('button', { name: 'ストップ' }).click()

    // 6. システムが結果の確定を行い、山を 1 つにまとめてから 3 つに分ける
    // 7. 占う人が 3 つの山すべてに積み上げる順を指定して決定する
    const piles3 = page.getByRole('button', { name: /山/ })
    await expect(piles3).toHaveCount(3)
    for (let i = 0; i < 3; i++) await piles3.nth(i).click()
    await page.getByRole('button', { name: '決定' }).click()

    // 8. システムが指定された順に山を積み重ね、2 つに分ける
    // 9. 占う人が 2 つの山の片方を選んで確定する
    const piles2 = page.getByRole('button', { name: /山/ })
    await expect(piles2).toHaveCount(2)
    await piles2.first().click()
    await page.getByRole('button', { name: '確定' }).click()

    // 10. システムが山を寝かせて左右選択を待つ → 11. 占う人が左右選択を行う
    await page.getByRole('button', { name: /左/ }).click()

    // 12. システムが占い結果へ移り、カードを表へめくって見せ、カード名・正逆・キーワード・解説文を示す
    // めくりの演出は、事後条件に現れる語（正位置 / 逆位置）の出現で待つ
    await expect(page.getByText(/正位置|逆位置/).first()).toBeVisible()

    // 事後条件（成功時）: 端末に記録できるかぎり、その占い結果が占い履歴に記録されている
    const historyAfter = await loadHistory(page)
    expect(historyAfter).toHaveLength(historyBefore.length + 1)
    const drawn = historyAfter[0]
    expect(drawn.categoryLabel).toBeUndefined() // 通常占い（カテゴリと回答を持ち込まない）

    // 事後条件（成功時）: ストップの時点で決まったカードのカード名・正逆・キーワード・正逆に応じた解説文を読んでいる
    await expect(page.getByText(drawn.card.nameJa).first()).toBeVisible()
    await expect(page.getByText(orientationLabel[drawn.orientation]).first()).toBeVisible()
    for (const keyword of drawn.keywords) await expect(page.getByText(keyword).first()).toBeVisible()
    const description =
      drawn.orientation === 'upright' ? drawn.card.descriptionUpright : drawn.card.descriptionReversed
    await expect(page.getByText(description).first()).toBeVisible()
  })
})
