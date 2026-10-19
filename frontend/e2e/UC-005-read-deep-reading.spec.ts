import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { ORIENTATION_LABEL, proceedRitual } from './helpers/ritual'
import { loadHistory } from './helpers/history'

// UC-005 詳しく占う — 主シナリオの通しテスト（1 UC 1 本、成功経路のみ）。
// 手順と事後条件の SSOT は docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/UC.md。
// 事前条件「機能フラグが有効」は配信の構成で決まる（用語集: 機能フラグ = DEEP_READING_ENABLED）。無料版では
// 詳しく占うの入口そのものが現れないので、この spec は playwright.config.ts の機能フラグ有効の project
// （chromium-deep-reading）でだけ走る。
// ロケータは docs/01-glossary.md の語（詳しく占うを始める: 「詳しく占う」button。カテゴリ: カテゴリ名の button。
// 選択肢: 文言そのままの button。正位置・逆位置）から導き、儀式の操作は helpers/ritual.ts に集約する。
// 質問の選択肢と、ベース解釈・回答別アドバイスの期待値は、カテゴリの文章の編集元 frontend/data/deep/work.md
// （内容の SSOT。生成物 src/data/deep/work.ts ではない）から取る。

/** このテストで選ぶカテゴリと回答。カテゴリ: 仕事（'work'）。各質問とも 1 つ目の選択肢（Q1a / Q2a / Q3a） */
const CATEGORY_LABEL = '仕事'
const ANSWERS = ['職場の人間関係', '頑張りすぎて疲れ気味', 'いまの場所でうまくやっていく'] as const
const ANSWER_KEYS = ['Q1a', 'Q2a', 'Q3a'] as const

/** 編集元から、引いたカードのベース解釈と、選んだ回答ごとの回答別アドバイスを取り出す */
function expectedDeepTexts(cardNameJa: string, orientation: 'upright' | 'reversed') {
  const source = readFileSync(fileURLToPath(new URL('../data/deep/work.md', import.meta.url)), 'utf8')
  const sections = source.split(/^### /m)
  const section = sections.find((s) => /^\d{2} - (.+)$/m.exec(s)?.[1] === cardNameJa)
  if (!section) throw new Error(`編集元にカード「${cardNameJa}」の節が無い`)
  const line = (key: string) => {
    const m = new RegExp(`^\\*\\*${key}\\*\\*: (.+)$`, 'm').exec(section)
    if (!m) throw new Error(`編集元のカード「${cardNameJa}」に ${key} が無い`)
    return m[1].trim()
  }
  return {
    base: line(ORIENTATION_LABEL[orientation]),
    advices: ANSWER_KEYS.map((key) => line(key)),
  }
}

test.describe('UC-005 詳しく占う', () => {
  // @scenario UC-005
  test('UC-005: カテゴリを選び 3 つの質問に答えて儀式を進めると、カテゴリと回答に沿った占い結果が読め、占い履歴にカテゴリ名つきで 1 件記録される', { tag: '@UC-005' }, async ({ page }) => {
    // 事前条件: 機能フラグが有効である（無料版では到達できない）
    await page.goto('/')
    const historyBefore = await loadHistory(page)

    // 1. 占う人がトップで詳しく占うを始める
    await page.getByRole('button', { name: '詳しく占う', exact: true }).click()

    // 2. システムがカテゴリを示す → 3. 占う人がカテゴリを選ぶ
    await expect(page.getByText('占いたいカテゴリを選んでください')).toBeVisible()
    await page.getByRole('button', { name: CATEGORY_LABEL, exact: true }).click()

    // 4. システムがそのカテゴリの質問を 1 つずつ示す → 5. 占う人が各質問で選択肢を選び、すべての質問に答える
    for (const answer of ANSWERS) await page.getByRole('button', { name: answer, exact: true }).click()

    // 6. システムがカテゴリとすべての質問の回答を持ち込んで、占うことを思い浮かべる段階から儀式を始める
    // 7. 占う人が儀式を進め、ストップで結果の確定が起きる（儀式の手順は UC-006 の 3〜11 と同じ）
    await proceedRitual(page)

    // 8. / 事後条件（成功時）: 端末に記録できるかぎり、占い履歴にカテゴリ名つきの占い結果が 1 件増えている
    const historyAfter = await loadHistory(page)
    expect(historyAfter).toHaveLength(historyBefore.length + 1)
    const drawn = historyAfter[0]
    expect(drawn.categoryLabel).toBe(CATEGORY_LABEL)

    // 9. / 事後条件（成功時）: カード・カード名・正逆・キーワードに加えて、カテゴリ、ベース解釈、回答ごとの回答別アドバイスを読めている
    await expect(page.getByText(drawn.card.nameJa).first()).toBeVisible()
    await expect(page.getByText(ORIENTATION_LABEL[drawn.orientation], { exact: true }).first()).toBeVisible()
    for (const keyword of drawn.keywords) await expect(page.getByText(keyword).first()).toBeVisible()
    await expect(page.getByText(CATEGORY_LABEL).first()).toBeVisible()
    const expected = expectedDeepTexts(drawn.card.nameJa, drawn.orientation)
    await expect(page.getByText(expected.base).first()).toBeVisible()
    for (const advice of expected.advices) await expect(page.getByText(advice).first()).toBeVisible()
  })
})
