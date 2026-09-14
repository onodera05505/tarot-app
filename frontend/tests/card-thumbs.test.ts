import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_BACK_THUMB_URL, CARD_BACK_URL, thumbUrl } from '../src/lib/api'
import { tarotCards } from '../src/data/cards'

// サムネイル（public/cards/thumbs/）の固定。public/cards/README.md「サムネイル」節が根拠。
// 生成は scripts/gen-thumbs.py。原本を足したり差し替えたりしたら再生成しないとここで落ちる。

const PUBLIC = join(__dirname, '..', 'public')
const SMALL_RENDERERS = ['pages/CardListPage.tsx', 'pages/HistoryPage.tsx', 'components/TodaysCard.tsx', 'pages/ShufflePage.tsx']

describe('カード画像のサムネイル', () => {
  it('thumbUrl は major/ を thumbs/ に置き換える', () => {
    expect(thumbUrl('/cards/major/00_theFool.webp')).toBe('/cards/thumbs/00_theFool.webp')
    expect(CARD_BACK_THUMB_URL).toBe(thumbUrl(CARD_BACK_URL))
  })

  it('22 枚と裏面のサムネイルが実在する', () => {
    const missing = [...tarotCards.map((c) => c.imageUrl), CARD_BACK_URL]
      .map(thumbUrl)
      .filter((u) => !existsSync(join(PUBLIC, u)))
    expect(missing).toEqual([])
  })

  it('小さく描く画面は原本 URL を直接 src にしない', () => {
    const offenders = SMALL_RENDERERS.filter((f) => {
      const t = readFileSync(join(__dirname, '..', 'src', f), 'utf8')
      return /src=\{(?:card|entry\.card|drawn\.card)\.imageUrl\}/.test(t) || /src=\{CARD_BACK_URL\}/.test(t)
    })
    expect(offenders).toEqual([])
  })
})
