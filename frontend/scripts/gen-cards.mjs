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
//   - 環境変数: GEN_SOURCE_DIR（編集元の置き場。直下の cards.md を読む。未指定なら data/）・
//     GEN_OUT_DIR（書き出し先。直下に cards.ts を書く。未指定なら src/data/）
//   - 失敗: 見出しの書式の崩れ・決められた番号（00〜21）の外・枚数が 22 に揃わない・必須の文章
//     （正逆のキーワード・正逆の解説文）が空、のいずれかなら終了コード 1 と標準エラー出力の理由で止め、
//     生成物は書き換えない（すべて確かめてから書き出す）

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = process.env.GEN_SOURCE_DIR || join(ROOT, 'data')
const OUT_DIR = process.env.GEN_OUT_DIR || join(ROOT, 'src/data')
const MD_PATH = join(SOURCE_DIR, 'cards.md')
const TS_PATH = join(OUT_DIR, 'cards.ts')

/** 決められた枚数（大アルカナ）。番号は 00〜21 */
const CARD_COUNT = 22

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

/**
 * 1 ブロックを読み、崩れている点を reasons に積む。崩れが 1 つでもあれば null を返す。
 * 見出しはブロックの先頭行でなければならない（編集ルール「各ブロックの先頭ヘッダ」）。
 * @implements REQ-121
 */
function parseCardBlock(block, reasons) {
  const lines = block.split('\n')
  const headerLine = lines[0]
  const where = `「${headerLine.slice(0, 40)}」`

  // ヘッダ: "## 00 - 愚者 (The Fool)"。番号は 2 桁
  const headerMatch = headerLine.match(/^##\s+(\d{2})\s*-\s*(.+?)\s*\((.+?)\)\s*$/)
  if (!headerMatch) {
    reasons.push(`カードの見出しの書式が崩れています（\`## NN - 日本語名 (English Name)\` の形にする）: ${where}`)
    return null
  }
  const number = parseInt(headerMatch[1], 10)
  const nameJa = headerMatch[2].trim()
  if (!STATIC[number]) {
    reasons.push(`決められた番号（00〜21）の外のカードがあります: ${where}`)
    return null
  }

  // インライン項目: **正位置キーワード**: ... / **逆位置キーワード**: ...（値が空の行も「空」として扱う）
  let meaningUpright = null
  let meaningReversed = null
  for (const line of lines) {
    const upM = line.match(/^\*\*正位置キーワード\*\*\s*[:：]\s*(.*)$/)
    if (upM) meaningUpright = normalizeKeywords(upM[1])
    const dnM = line.match(/^\*\*逆位置キーワード\*\*\s*[:：]\s*(.*)$/)
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

  const card = {
    number,
    nameJa,
    meaningUpright: meaningUpright ?? '',
    meaningReversed: meaningReversed ?? '',
    descriptionUpright: sections['正位置'] ?? '',
    descriptionReversed: sections['逆位置'] ?? '',
  }

  // 必須の文章: 行や区切りが無い場合も「空」に含める
  const REQUIRED_TEXT = [
    ['meaningUpright', '正位置キーワード'],
    ['meaningReversed', '逆位置キーワード'],
    ['descriptionUpright', '正位置の解説文'],
    ['descriptionReversed', '逆位置の解説文'],
  ]
  const empty = REQUIRED_TEXT.filter(([key]) => !card[key]).map(([, label]) => label)
  if (empty.length > 0) {
    reasons.push(`カード ${headerMatch[1]}（${nameJa}）: 必須の文章が空です（${empty.join('・')}）`)
    return null
  }
  return card
}

/**
 * 編集元の全体を読み、書式どおりならカードの配列を、崩れていれば理由の配列を返す。
 * 枚数と番号の重複は全ブロックを読んだあとで確かめる。
 * @implements REQ-121
 */
function parseSource(md) {
  const reasons = []
  // `^---` 区切りで分割。先頭は前書き、残りは空でなければすべてカードのブロック
  const [, ...blocks] = md.split(/^---\s*$/m).map((b) => b.trim())
  const cardBlocks = blocks.filter((b) => b !== '')

  const parsed = cardBlocks.map((b) => parseCardBlock(b, reasons)).filter(Boolean)

  if (cardBlocks.length !== CARD_COUNT) {
    reasons.push(`カードの枚数が揃いません（${CARD_COUNT} 枚必要、現在 ${cardBlocks.length} 枚）`)
  }
  const seen = new Set()
  for (const p of parsed) {
    if (seen.has(p.number)) reasons.push(`カード ${String(p.number).padStart(2, '0')} が重複しています`)
    seen.add(p.number)
  }
  return { cards: parsed, reasons }
}

// @implements UC-010, REQ-090
function build() {
  const md = readFileSync(MD_PATH, 'utf-8')
  const { cards: parsed, reasons } = parseSource(md)

  // @implements REQ-121
  if (reasons.length > 0) {
    for (const r of reasons) console.error(`gen-cards: cards.md: ${r}`)
    console.error(`gen-cards: 編集元が書式どおりでないため生成を中止しました（生成物は書き換えていません）`)
    process.exit(1)
  }

  const cards = parsed
    .map((p) => {
      const stat = STATIC[p.number]
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
  console.log(`gen-cards: ${cards.length} 枚のカードを生成しました → ${relative(ROOT, TS_PATH)}`)
}

build()
