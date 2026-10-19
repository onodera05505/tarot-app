import { expect, type Page } from '@playwright/test'

// 儀式の操作の唯一の置き場。UC-005・006・007 の通しテストはここを通す（手順を各 spec に直書きしない）。
// 手順の SSOT は UC-006 の主シナリオ 3〜11（docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/UC.md）。
// 文言はすべて docs/01-glossary.md の「画面の文言」「画面の形」から導く:
//   シャッフルへ（button）/ ストップ（button）/ 山の指定（button「山 1」「山 2」「山 3」、2 つのときは「山 1」「山 2」）/
//   決定（button。順が 3 つそろうまで無効）/ 山の確定（button「OK」。山を選ぶまで無効）/ 左右選択（button「左」「右」）。
// 儀式の操作は結果に影響しない（用語集「儀式」）ので、山の順と左右は固定の値でよい。

/** 正逆（コード識別子）→ 画面の語（用語集: 正位置 / 逆位置） */
export const ORIENTATION_LABEL = { upright: '正位置', reversed: '逆位置' } as const

/**
 * 占うことを思い浮かべる段階（フェーズ: intent）から左右選択までを進め、占い結果の正逆の語が見えるまで待つ。
 * スタート（通常占い）または最後の質問への回答（詳しく占う）の直後に呼ぶ。
 */
export async function proceedRitual(page: Page): Promise<void> {
  // UC-006 手順 3: シャッフルへ進む
  await page.getByRole('button', { name: 'シャッフルへ', exact: true }).click()

  // UC-006 手順 5: ストップを押す（結果の確定）
  await page.getByRole('button', { name: 'ストップ', exact: true }).click()

  // UC-006 手順 7: 3 つの山すべてに積み上げる順を指定して決定する
  for (const name of ['山 1', '山 2', '山 3']) {
    await page.getByRole('button', { name, exact: true }).click()
  }
  await page.getByRole('button', { name: '決定', exact: true }).click()

  // UC-006 手順 9: 2 つの山の片方を指定して山の確定を行う
  await page.getByRole('button', { name: '山 1', exact: true }).click()
  await expect(page.getByRole('button', { name: '山 3', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'OK', exact: true }).click()

  // UC-006 手順 11: 左右選択を行う
  await page.getByRole('button', { name: '左', exact: true }).click()

  // UC-006 手順 12: 占い結果へ移り、めくりの演出のあと正逆を示す（演出の待ちは正逆の語の出現で行う）
  await expect(page.getByText(/^(正位置|逆位置)$/).first()).toBeVisible()
}

/**
 * トップからスタートを選び、儀式を通して占い結果（占い状態 drawn）に到達する（通常占い）。
 * UC-006 の主シナリオ 1〜12 そのもの。他の UC が事前条件「占い結果が表示されている」を作るときに使う。
 */
export async function drawOnceFromTop(page: Page): Promise<void> {
  await page.goto('/')
  // UC-006 手順 1: スタートを選ぶ（用語集: スタート）
  await page.getByRole('button', { name: 'スタート', exact: true }).click()
  await proceedRitual(page)
}
