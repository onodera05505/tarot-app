import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'

// UC-005 詳しく占う — 主シナリオの通しテスト（1 UC 1 本、成功経路のみ）。
// 手順と事後条件の SSOT は docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/UC.md。
// 事前条件「機能フラグが有効」は配信の構成で決まる（用語集: DEEP_READING_ENABLED）。無料版の配信では
// 詳しく占うの入口そのものが現れないので、このテストは機能フラグ有効の版に対してだけ意味を持つ。
// ロケータは docs/01-glossary.md の語（詳しく占う・カテゴリ: 仕事・ストップ・山・左右選択・正位置・逆位置）から導く。
// 質問の選択肢と、ベース解釈・回答別アドバイスの期待値は、カテゴリの文章の編集元 frontend/data/deep/work.md
// （内容の SSOT。生成物 src/data/deep/work.ts ではない）から取る。

/** 占い履歴の項目のうち、事後条件の確認に使う部分（UC-001 契約 HistoryEntry の射影） */
type HistoryEntry = {
  card: { nameJa: string }
  orientation: 'upright' | 'reversed'
  keywords: string[]
  categoryLabel?: string
}

/** 端末への記録（localStorage キー tarot:history）から占い履歴を新しい順に読む（UC-001 契約 loadHistory の形） */
async function loadHistory(page: Page): Promise<HistoryEntry[]> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('tarot:history') ?? '[]'))
}

/** 正逆（コード識別子）→ 画面の語（用語集: 正位置 / 逆位置）と、編集元の見出し語 */
const orientationLabel = { upright: '正位置', reversed: '逆位置' } as const

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
    base: line(orientationLabel[orientation]),
    advices: ANSWER_KEYS.map((key) => line(key)),
  }
}

test.describe('UC-005 詳しく占う', () => {
  // 保留: 実装の配線（用語どおりの文言）と実ブラウザでの確認がまだ。機能フラグが有効な版で動かし、配線が済んだら fixme を外す
  // @scenario UC-005
  test.fixme('UC-005: カテゴリを選び 3 つの質問に答えて儀式を進めると、カテゴリと回答に沿った占い結果が読め、占い履歴にカテゴリ名つきで 1 件記録される', async ({ page }) => {
    // 事前条件: 機能フラグが有効である（無料版では到達できない）
    await page.goto('/')
    const historyBefore = await loadHistory(page)

    // 1. 占う人がトップで詳しく占うを始める
    await page
      .getByRole('button', { name: '詳しく占う' })
      .or(page.getByRole('link', { name: '詳しく占う' }))
      .click()

    // 2. システムがカテゴリを示す → 3. 占う人がカテゴリを選ぶ
    await page.getByRole('button', { name: CATEGORY_LABEL }).click()

    // 4. システムがそのカテゴリの質問を 1 つずつ示す → 5. 占う人が各質問で選択肢を選び、すべての質問に答える
    for (const answer of ANSWERS) await page.getByRole('button', { name: answer }).click()

    // 6. システムがカテゴリとすべての質問の回答を持ち込んで儀式を始める
    // 7. 占う人が儀式を進め、ストップで結果の確定が起きる（儀式の手順は UC-006 の 3〜11 と同じ）
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

    // 9. システムが占い結果として、カード・カード名・正逆・キーワードに加えて、カテゴリ、ベース解釈、回答別アドバイスを示す
    // めくりの演出は、事後条件に現れる語（正位置 / 逆位置）の出現で待つ
    await expect(page.getByText(/正位置|逆位置/).first()).toBeVisible()

    // 8. / 事後条件（成功時）: 端末に記録できるかぎり、占い履歴にカテゴリ名つきの占い結果が 1 件増えている
    const historyAfter = await loadHistory(page)
    expect(historyAfter).toHaveLength(historyBefore.length + 1)
    const drawn = historyAfter[0]
    expect(drawn.categoryLabel).toBe(CATEGORY_LABEL)

    // 事後条件（成功時）: 選んだカテゴリと、引いたカード・正逆に応じたベース解釈と、回答ごとの回答別アドバイスを読めている
    await expect(page.getByText(drawn.card.nameJa).first()).toBeVisible()
    await expect(page.getByText(orientationLabel[drawn.orientation]).first()).toBeVisible()
    for (const keyword of drawn.keywords) await expect(page.getByText(keyword).first()).toBeVisible()
    await expect(page.getByText(CATEGORY_LABEL).first()).toBeVisible()
    const expected = expectedDeepTexts(drawn.card.nameJa, drawn.orientation)
    await expect(page.getByText(expected.base).first()).toBeVisible()
    for (const advice of expected.advices) await expect(page.getByText(advice).first()).toBeVisible()
  })
})
