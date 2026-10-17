import { test, expect } from '@playwright/test'

// UC-003 本日の一枚を開く（docs/goals/GOAL-03-todays-card/UC-003-open-todays-card/UC.md）の通しテスト。
// 主シナリオの番号順の手順と「成功時」の事後条件だけを写す。
//
// 抽選は完全ランダム（BR-001）なので、開封で決まったカードと正逆は、契約 saveCached が書く端末の記録
// （localStorage キー tarot:todaysCard、形は契約の TodaysCardRecord { date, drawn }）から読み、画面がそれを示すことを確かめる。
// 事前条件「その日の本日の一枚が未開封」は、端末の記録が無い状態（契約 loadCached の examples.notOpened）で満たす。

const TODAYS_CARD_KEY = 'tarot:todaysCard'

// 正逆（Orientation）→ 画面の文言（用語集: 正位置 / 逆位置）
const ORIENTATION_LABEL = { upright: '正位置', reversed: '逆位置' } as const

type TodaysCardRecord = {
  date: string
  drawn: { card: { nameJa: string; nameEn: string }; orientation: 'upright' | 'reversed'; keywords: string[] }
}

test.describe('UC-003 本日の一枚を開く', () => {
  test.beforeEach(async ({ page }) => {
    // 事前条件: その日の本日の一枚が未開封（端末の記録が無い）
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key)
    }, TODAYS_CARD_KEY)
  })

  // 保留: 本日の一枚を選ぶ操作の配線（押せる要素の名前）と実ブラウザでのめくりの確認が済むまで保留。配線した者がこの印を外す
  // @scenario UC-003
  test.fixme('UC-003: 未開封の本日の一枚を開封し、開封済みの本日の一枚からそのカードのカード解説を本日の一枚の正逆で読む', { tag: '@UC-003' }, async ({ page }) => {
    await page.goto('/')

    // 手順 1: 占う人が未開封の本日の一枚を選ぶ（用語集: 本日の一枚）
    await page.getByRole('button', { name: /本日の一枚/ }).click()

    // 手順 2–3: システムが抽選し、その日の開封として記録し、本日の一枚をカード・カード名・正逆とともに開封済みで示す
    // （めくりの演出の待ちは、事後条件に現れる文言「正位置」「逆位置」の出現で待つ）
    await expect(page.getByText(/正位置|逆位置/).first()).toBeVisible()

    const record = await page.evaluate((key): TodaysCardRecord | null => {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as TodaysCardRecord) : null
    }, TODAYS_CARD_KEY)
    expect(record).not.toBeNull()
    const today = await page.evaluate(() => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })
    expect(record!.date).toBe(today)
    const nameJa = record!.drawn.card.nameJa
    const orientationLabel = ORIENTATION_LABEL[record!.drawn.orientation]
    const otherLabel = orientationLabel === '正位置' ? '逆位置' : '正位置'
    await expect(page.getByText(nameJa).first()).toBeVisible()
    await expect(page.getByText(orientationLabel).first()).toBeVisible()

    // 手順 4: 占う人が開封済みの本日の一枚を選ぶ
    await page
      .getByRole('button', { name: /本日の一枚/ })
      .or(page.getByRole('link', { name: /本日の一枚/ }))
      .first()
      .click()

    // 手順 5: システムがそのカードのカード解説を、本日の一枚の正逆を初期表示の正逆として示す
    await expect(page.getByRole('heading', { name: new RegExp(nameJa) })).toBeVisible()
    await expect(page.getByText(orientationLabel).first()).toBeVisible()
    const detailText = await page.locator('body').innerText()
    expect(detailText.indexOf(orientationLabel)).toBeGreaterThanOrEqual(0)
    expect(detailText.indexOf(orientationLabel)).toBeLessThan(detailText.indexOf(otherLabel))

    // 事後条件（成功時）: その日の本日の一枚が開封済みで、同じ日に再び示してもその日の開封として記録されているカードと正逆である
    await page.goto('/')
    await expect(page.getByText(nameJa).first()).toBeVisible()
    await expect(page.getByText(orientationLabel).first()).toBeVisible()
    const recordAfter = await page.evaluate((key) => window.localStorage.getItem(key), TODAYS_CARD_KEY)
    expect(recordAfter).not.toBeNull()
    expect(JSON.parse(recordAfter!)).toEqual(record)
  })
})
