import { test, expect } from '@playwright/test'

// UC-001 占い履歴を振り返る（docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/UC.md）の通しテスト。
// 主シナリオの番号順の手順と「成功時」の事後条件だけを写す。分岐・失敗・境界は各 REQ の分割クラス（単体テスト）が持つ。
//
// 手順 1–2（結果の確定と端末への記録）は UC-006 の儀式で起きる。儀式の操作の文言はこの UC の入力に無いので、
// ここでは「記録された状態」を契約 addToHistory の examples（ok / withCategory）そのままの形で端末の記録
// （localStorage キー tarot:history。契約 loadHistory の summary が名指す）に置いて、手順 3 から駆動する。
// 契約 loadHistory の応答は「新しい順の配列」なので、後から記録した withCategory（drawnAt が大きい）を先頭に置く。

const CARD_FOOL = {
  id: 1,
  nameEn: 'The Fool',
  nameJa: '愚者',
  number: 0,
  arcanaType: 'Major',
  meaningUpright: '自由,冒険,純粋',
  meaningReversed: '無謀,軽率,優柔不断',
  descriptionUpright:
    '愚者は、新しい旅立ちと無垢な好奇心を宿すカードです。何かを始めるか迷っているなら、完璧な準備よりも軽やかな一歩こそが運命を動かすサインかもしれません。一番ハードルの低いことから手をつけてみましょう。動き始めること自体が、すでに前進です。',
  descriptionReversed:
    '逆位置の愚者は、無計画さや軽率さによる迷走を映し出します。思いつきで動き始めて空回りしている心当たりがあるなら、いったん全体像を見直す合図です。動き出す前に立ち止まって整理する時間を持ってみてください。優先順位を見直すだけで、空回りはぐっと減らせます。',
  imageUrl: '/cards/major/00_theFool.webp',
}

// 契約 addToHistory の examples.ok.response（通常占い。カテゴリ名なし）
const ENTRY_PLAIN = {
  id: '1790000000000-k3j9x2a',
  drawnAt: 1790000000000,
  card: CARD_FOOL,
  orientation: 'upright',
  keywords: ['自由', '冒険', '純粋'],
}

// 契約 addToHistory の examples.withCategory.response（カテゴリとすべての回答がそろった詳しく占う。カテゴリ名「仕事」）
const ENTRY_WITH_CATEGORY = {
  id: '1790000000001-m4p8q1z',
  drawnAt: 1790000000001,
  card: CARD_FOOL,
  orientation: 'reversed',
  keywords: ['無謀', '軽率', '優柔不断'],
  categoryLabel: '仕事',
}

const HISTORY_KEY = 'tarot:history'

test.describe('UC-001 占い履歴を振り返る', () => {
  test.beforeEach(async ({ page }) => {
    // 手順 1–2 の結果（端末に記録済みの占い履歴）を、契約の例の形のまま端末の記録に置く
    await page.addInitScript(
      ([key, entries]) => {
        window.localStorage.setItem(key, JSON.stringify(entries))
      },
      [HISTORY_KEY, [ENTRY_WITH_CATEGORY, ENTRY_PLAIN]] as const,
    )
  })

  // 保留: 画面の配線（占い履歴の入口・全削除の確認の形）と実ブラウザでの確認が済むまで保留。配線した者がこの印を外す
  // @scenario UC-001
  test.fixme('UC-001: 占い履歴を新しい順に見返し、一件のカード解説を記録した正逆で開き、全削除で履歴がない状態に戻す', { tag: '@UC-001' }, async ({ page }) => {
    // 手順 3: 占う人が占い履歴を開く（トップの入口「占い履歴」。用語集: トップ / 占い履歴）
    await page.goto('/')
    await page
      .getByRole('link', { name: '占い履歴' })
      .or(page.getByRole('button', { name: '占い履歴' }))
      .first()
      .click()

    // 手順 4: システムが占い履歴を後から記録したものを先にして一覧で示す（日時・カード・正逆・キーワード、カテゴリ名つきはカテゴリ名）
    await expect(page.getByText('愚者').first()).toBeVisible()
    await expect(page.getByText('逆位置').first()).toBeVisible()
    await expect(page.getByText('正位置').first()).toBeVisible()
    await expect(page.getByText('無謀').first()).toBeVisible()
    await expect(page.getByText('自由').first()).toBeVisible()
    await expect(page.getByText('仕事').first()).toBeVisible()
    // 後から記録した withCategory（キーワード「無謀」）が、先に記録した ok（キーワード「自由」）より先に出る
    const listText = await page.locator('body').innerText()
    expect(listText.indexOf('無謀')).toBeGreaterThanOrEqual(0)
    expect(listText.indexOf('無謀')).toBeLessThan(listText.indexOf('自由'))

    // 手順 5: 占う人が一件を選ぶ（カテゴリ名「仕事」を添えた、逆位置で記録した一件）
    await page.getByText('仕事').first().click()

    // 手順 6: システムがそのカードのカード解説を、記録した正逆（逆位置）で開く
    await expect(page.getByRole('heading', { name: /愚者/ })).toBeVisible()
    await expect(page.getByText(CARD_FOOL.descriptionReversed)).toBeVisible()
    await expect(page.getByText(CARD_FOOL.descriptionUpright)).toBeVisible()
    const detailText = await page.locator('body').innerText()
    expect(detailText.indexOf(CARD_FOOL.descriptionReversed)).toBeLessThan(
      detailText.indexOf(CARD_FOOL.descriptionUpright),
    )

    // 手順 7: 占う人が占い履歴へ戻り（用語集: 戻る）、全削除を選んで確認に承諾する
    await page
      .getByRole('button', { name: '戻る' })
      .or(page.getByRole('link', { name: '戻る' }))
      .first()
      .click()
    await expect(page.getByText('仕事').first()).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '全削除' }).click()

    // 手順 8: システムが占い履歴をすべて消し、履歴がないことを示して占いを始められるようにする
    await expect(page.getByText('仕事')).toHaveCount(0)
    await expect(page.getByText('無謀')).toHaveCount(0)
    await expect(page.getByText(/履歴.*(ない|ありません)/)).toBeVisible()
    // 空のときは全削除の操作を出さない（UC.md 状態 × イベント表の「空」行）
    await expect(page.getByRole('button', { name: '全削除' })).toHaveCount(0)
    // 端末の記録も消えている（契約 clearHistory: 端末から占い履歴をすべて消す）
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), HISTORY_KEY)
    expect(stored === null || JSON.parse(stored).length === 0).toBe(true)

    // 事後条件（成功時）: 占う人が占い履歴を開くと、履歴がないことが示される
    await page.reload()
    await expect(page.getByText(/履歴.*(ない|ありません)/)).toBeVisible()
    await expect(page.getByText('愚者')).toHaveCount(0)
  })
})
