// data/cards.md から src/data/cards.ts を再生成する。
//
//   pnpm gen:cards
//
// パース仕様:
//   - カードのブロックは `---` で区切る
//   - 各ブロックの先頭ヘッダ: `## NN - 日本語名 (English Name)`
//   - `**正位置キーワード**: ...` / `**逆位置キーワード**: ...` の 1 行
//   - `### 正位置` セクションの本文 → descriptionUpright
//   - `### 逆位置` セクションの本文 → descriptionReversed
//   - 静的フィールド (id, arcanaType, imageUrl) は下記の STATIC テーブルを参照

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MD_PATH = join(ROOT, 'data/cards.md')
const TS_PATH = join(ROOT, 'src/data/cards.ts')

// number -> 静的フィールド（テキスト編集対象外）
const STATIC = {
  0:  { id: 1,  nameEn: 'The Fool',          imageUrl: '/cards/major/00_theFool.webp' },
  1:  { id: 2,  nameEn: 'The Magician',      imageUrl: '/cards/major/01_the_Magician.webp' },
  2:  { id: 3,  nameEn: 'The High Priestess',imageUrl: '/cards/major/02_theHighPriestess.webp' },
  3:  { id: 4,  nameEn: 'The Empress',       imageUrl: '/cards/major/03_theEmpress.webp' },
  4:  { id: 5,  nameEn: 'The Emperor',       imageUrl: '/cards/major/04_theEmperor.webp' },
  5:  { id: 6,  nameEn: 'The Hierophant',    imageUrl: '/cards/major/05_theHierophant.webp' },
  6:  { id: 7,  nameEn: 'The Lovers',        imageUrl: '/cards/major/06_theLovers.webp' },
  7:  { id: 8,  nameEn: 'The Chariot',       imageUrl: '/cards/major/07_theChariot.webp' },
  8:  { id: 9,  nameEn: 'Strength',          imageUrl: '/cards/major/08_strength.webp' },
  9:  { id: 10, nameEn: 'The Hermit',        imageUrl: '/cards/major/09_theHermit.webp' },
  10: { id: 11, nameEn: 'Wheel of Fortune',  imageUrl: '/cards/major/10_wheelOfFortune.webp' },
  11: { id: 12, nameEn: 'Justice',           imageUrl: '/cards/major/11_Justice.webp' },
  12: { id: 13, nameEn: 'The Hanged Man',    imageUrl: '/cards/major/12_theHangedMan.webp' },
  13: { id: 14, nameEn: 'Death',             imageUrl: '/cards/major/13_death.webp' },
  14: { id: 15, nameEn: 'Temperance',        imageUrl: '/cards/major/14_temperance.webp' },
  15: { id: 16, nameEn: 'The Devil',         imageUrl: '/cards/major/15_theDevil.webp' },
  16: { id: 17, nameEn: 'The Tower',         imageUrl: '/cards/major/16_theTower.webp' },
  17: { id: 18, nameEn: 'The Star',          imageUrl: '/cards/major/17_theStar.webp' },
  18: { id: 19, nameEn: 'The Moon',          imageUrl: '/cards/major/18_theMoon.webp' },
  19: { id: 20, nameEn: 'The Sun',           imageUrl: '/cards/major/19_theSun.webp' },
  20: { id: 21, nameEn: 'Judgement',         imageUrl: '/cards/major/20_judgement.webp' },
  21: { id: 22, nameEn: 'The World',         imageUrl: '/cards/major/21_theWorld.webp' },
}

function normalizeKeywords(raw) {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .join(',')
}

function parseCardBlock(block) {
  const lines = block.split('\n')

  // ヘッダ: "## 00 - 愚者 (The Fool)"
  const headerLine = lines.find((l) => /^##\s+\d+/.test(l))
  if (!headerLine) {
    throw new Error(`Header (## NN - ...) not found in block:\n${block.slice(0, 100)}`)
  }
  const headerMatch = headerLine.match(/^##\s+(\d+)\s*-\s*(.+?)\s*\((.+?)\)\s*$/)
  if (!headerMatch) {
    throw new Error(`Bad header format: "${headerLine}"`)
  }
  const number = parseInt(headerMatch[1], 10)
  const nameJa = headerMatch[2].trim()

  // インライン項目: **正位置キーワード**: ... / **逆位置キーワード**: ...
  let meaningUpright = ''
  let meaningReversed = ''
  for (const line of lines) {
    const upM = line.match(/^\*\*正位置キーワード\*\*\s*[:：]\s*(.+)$/)
    if (upM) meaningUpright = normalizeKeywords(upM[1])
    const dnM = line.match(/^\*\*逆位置キーワード\*\*\s*[:：]\s*(.+)$/)
    if (dnM) meaningReversed = normalizeKeywords(dnM[1])
  }

  // セクション: ### 正位置 / ### 逆位置
  const sections = {}
  let current = null
  let buffer = []
  for (const line of lines) {
    const sectionM = line.match(/^###\s+(.+?)\s*$/)
    if (sectionM) {
      if (current) sections[current] = buffer.join('\n').trim()
      current = sectionM[1].trim()
      buffer = []
    } else if (current !== null) {
      buffer.push(line)
    }
  }
  if (current) sections[current] = buffer.join('\n').trim()

  const descriptionUpright = sections['正位置'] ?? ''
  const descriptionReversed = sections['逆位置'] ?? ''

  return {
    number,
    nameJa,
    meaningUpright,
    meaningReversed,
    descriptionUpright,
    descriptionReversed,
  }
}

function build() {
  const md = readFileSync(MD_PATH, 'utf-8')

  // `^---` 区切りで分割し、`## NN` ヘッダを持つブロックだけ採用
  const blocks = md
    .split(/^---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => /^##\s+\d+/m.test(b))

  if (blocks.length !== 22) {
    console.warn(`⚠ Expected 22 cards, got ${blocks.length}`)
  }

  const parsed = blocks.map(parseCardBlock)

  const cards = parsed
    .map((p) => {
      const stat = STATIC[p.number]
      if (!stat) {
        throw new Error(`No STATIC entry for number ${p.number}`)
      }
      return {
        id: stat.id,
        nameEn: stat.nameEn,
        nameJa: p.nameJa,
        number: p.number,
        arcanaType: 'Major',
        meaningUpright: p.meaningUpright,
        meaningReversed: p.meaningReversed,
        descriptionUpright: p.descriptionUpright,
        descriptionReversed: p.descriptionReversed,
        imageUrl: stat.imageUrl,
      }
    })
    .sort((a, b) => a.number - b.number)

  // バリデーション: 全フィールドが埋まっているか
  for (const c of cards) {
    const requiredText = ['nameJa', 'meaningUpright', 'meaningReversed', 'descriptionUpright', 'descriptionReversed']
    for (const k of requiredText) {
      if (!c[k]) {
        console.warn(`⚠ Card ${c.number} (${c.nameEn}): "${k}" is empty`)
      }
    }
  }

  const out = [
    '// 大アルカナ 22 枚のデータ。',
    '// このファイルは自動生成です。直接編集しないでください。',
    "// 編集元: data/cards.md  /  再生成: pnpm gen:cards",
    '',
    "import type { TarotCard } from '../lib/types'",
    '',
    `export const tarotCards: TarotCard[] = ${JSON.stringify(cards, null, 2)}`,
    '',
  ].join('\n')

  writeFileSync(TS_PATH, out)
  console.log(`✓ Parsed ${cards.length} cards from data/cards.md`)
  console.log(`✓ Wrote src/data/cards.ts`)
}

build()
