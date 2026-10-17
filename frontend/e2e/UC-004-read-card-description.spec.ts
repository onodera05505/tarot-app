import { test, expect } from '@playwright/test'

// UC-004 カード解説を読む（docs/goals/GOAL-04-card-reference/UC-004-read-card-description/UC.md）の通しテスト。
// 主シナリオの番号順の手順と「成功時」の事後条件だけを写す。
//
// この UC の契約は操作を持たない（x-no-boundary）。選ぶカードとその内容は、同じカード（愚者、カードの識別番号 1、
// アルカナ番号 0）を載せる UC-003 の契約 loadCached の examples.ok から写す（docs/_shared/components.yaml の TarotCard）。
// 一覧の端の語「愚者」「世界」は用語集「アルカナ番号」（愚者から世界まで）による。

const CARD_FOOL = {
  nameEn: 'The Fool',
  nameJa: '愚者',
  number: 0,
  keywordsUpright: ['自由', '冒険', '純粋'],
  keywordsReversed: ['無謀', '軽率', '優柔不断'],
  descriptionUpright:
    '愚者は、新しい旅立ちと無垢な好奇心を宿すカードです。何かを始めるか迷っているなら、完璧な準備よりも軽やかな一歩こそが運命を動かすサインかもしれません。一番ハードルの低いことから手をつけてみましょう。動き始めること自体が、すでに前進です。',
  descriptionReversed:
    '逆位置の愚者は、無計画さや軽率さによる迷走を映し出します。思いつきで動き始めて空回りしている心当たりがあるなら、いったん全体像を見直す合図です。動き出す前に立ち止まって整理する時間を持ってみてください。優先順位を見直すだけで、空回りはぐっと減らせます。',
}

test.describe('UC-004 カード解説を読む', () => {
  // 保留: 一覧の各カードを選ぶ要素の名前の配線と実ブラウザでの確認が済むまで保留。配線した者がこの印を外す
  // @scenario UC-004
  test.fixme('UC-004: カード解説の一覧から愚者を選び、正位置と逆位置それぞれのキーワードと解説文を正位置を先にして読む', { tag: '@UC-004' }, async ({ page }) => {
    // 手順 1: 占う人がカード解説を開く（トップの入口「カード解説」。用語集: トップ / カード解説）
    await page.goto('/')
    await page
      .getByRole('link', { name: 'カード解説' })
      .or(page.getByRole('button', { name: 'カード解説' }))
      .first()
      .click()

    // 手順 2: システムが大アルカナ 22 枚を、アルカナ番号順に、カードの表・カード名・アルカナ番号・正位置のキーワードを添えて示す
    await expect(page.getByText(CARD_FOOL.nameJa).first()).toBeVisible()
    await expect(page.getByText('世界').first()).toBeVisible()
    for (const keyword of CARD_FOOL.keywordsUpright) {
      await expect(page.getByText(keyword).first()).toBeVisible()
    }
    // アルカナ番号順: 愚者（0）が世界より先に出る
    const listText = await page.locator('body').innerText()
    expect(listText.indexOf(CARD_FOOL.nameJa)).toBeGreaterThanOrEqual(0)
    expect(listText.indexOf(CARD_FOOL.nameJa)).toBeLessThan(listText.indexOf('世界'))

    // 手順 3: 占う人が 1 枚のカード（愚者）を選ぶ
    await page.getByText(CARD_FOOL.nameJa).first().click()

    // 手順 4: システムがそのカードのカード名とカード、正位置と逆位置それぞれのキーワードと解説文を、正位置を先にして示す
    // （カード名は和名で示し、カード解説では英名も併せて示す。用語集: カード名）
    await expect(page.getByRole('heading', { name: new RegExp(CARD_FOOL.nameJa) })).toBeVisible()
    await expect(page.getByText(CARD_FOOL.nameEn).first()).toBeVisible()
    await expect(page.getByText('正位置').first()).toBeVisible()
    await expect(page.getByText('逆位置').first()).toBeVisible()
    for (const keyword of [...CARD_FOOL.keywordsUpright, ...CARD_FOOL.keywordsReversed]) {
      await expect(page.getByText(keyword).first()).toBeVisible()
    }

    // 事後条件（成功時）: 選んだカードの正位置と逆位置それぞれのキーワードと解説文を読める（正位置が先）
    await expect(page.getByText(CARD_FOOL.descriptionUpright)).toBeVisible()
    await expect(page.getByText(CARD_FOOL.descriptionReversed)).toBeVisible()
    const detailText = await page.locator('body').innerText()
    expect(detailText.indexOf(CARD_FOOL.descriptionUpright)).toBeGreaterThanOrEqual(0)
    expect(detailText.indexOf(CARD_FOOL.descriptionUpright)).toBeLessThan(
      detailText.indexOf(CARD_FOOL.descriptionReversed),
    )
  })
})
