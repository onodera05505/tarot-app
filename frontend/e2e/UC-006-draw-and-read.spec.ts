import { test, expect } from '@playwright/test'
import { ORIENTATION_LABEL, proceedRitual } from './helpers/ritual'
import { loadHistory } from './helpers/history'

// UC-006 儀式を進めて 1 枚を引き、占い結果を読む — 主シナリオの通しテスト（1 UC 1 本、成功経路のみ）。
// 手順と事後条件の SSOT は docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/UC.md。
// 儀式の操作（手順 3〜11）は helpers/ritual.ts に集約し、ロケータは docs/01-glossary.md の語から導く。
// 占い履歴の形は UC-001 の契約（loadHistory）から導く（helpers/history.ts）。

test.describe('UC-006 儀式を進めて 1 枚を引き、占い結果を読む', () => {
  // @scenario UC-006
  test('UC-006: スタートから左右選択まで儀式を進めると、決まったカードの占い結果が読め、占い履歴に 1 件記録される', { tag: '@UC-006' }, async ({ page }) => {
    // 事前条件: 占う人がトップにいる（占い状態は問わない）
    await page.goto('/')
    const historyBefore = await loadHistory(page)

    // 1. 占う人がスタートを選ぶ（用語集: スタート）
    await page.getByRole('button', { name: 'スタート', exact: true }).click()

    // 2〜12. 占うことを思い浮かべる段階から左右選択まで進み、占い結果でカードがめくられて正逆が示される
    await proceedRitual(page)

    // 事後条件（成功時）: 端末に記録できるかぎり、その占い結果が占い履歴に記録されている
    const historyAfter = await loadHistory(page)
    expect(historyAfter).toHaveLength(historyBefore.length + 1)
    const drawn = historyAfter[0]
    expect(drawn.categoryLabel).toBeUndefined() // 通常占い（カテゴリと回答を持ち込まない）

    // 事後条件（成功時）: ストップの時点で決まったカードのカード名・正逆・キーワード・正逆に応じた解説文を読んでいる
    await expect(page.getByText(drawn.card.nameJa).first()).toBeVisible()
    await expect(page.getByText(ORIENTATION_LABEL[drawn.orientation], { exact: true }).first()).toBeVisible()
    for (const keyword of drawn.keywords) await expect(page.getByText(keyword).first()).toBeVisible()
    const description =
      drawn.orientation === 'upright' ? drawn.card.descriptionUpright : drawn.card.descriptionReversed
    await expect(page.getByText(description).first()).toBeVisible()
  })
})
