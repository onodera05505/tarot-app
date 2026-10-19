import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  CARD_HEADING,
  FRONTEND,
  REAL_SOURCE_DIR,
  joinCardsSource,
  snapshot,
  splitCardsSource,
} from './helpers/gen-fixture'

// UC-010 の要件の文（REQ-121 の「同じカードが重複している」）、UC-010 の表（同じカードが重複している行）、
// 用語集（編集元・生成・生成物・アルカナ番号）、編集元 frontend/data/cards.md の冒頭の編集ルールだけから設計
// （生成スクリプトは参照していない）。
//
// 「同じカード」は用語集のアルカナ番号（カードの番号）が同じカードと読む。見出しの番号が同じ塊が 2 つあれば、
// 中身が同じでも違っていても重複に当たる。
// 観測は UC-010-gen-cards-source-check.test.ts と同じ: 生成（`gen:cards`）を子プロセスで実行し、
// 終了コード・標準エラー出力・書き出し先の変化だけを見る（CLAUDE.md の「生成」の行）。

const GEN_CARDS = join(FRONTEND, 'scripts', 'gen-cards.mjs')
const REAL_SOURCE = readFileSync(join(REAL_SOURCE_DIR, 'cards.md'), 'utf8')

/** 前の生成物の目印。失敗したときはこれがそのまま残っていなければならない */
const STALE_OUTPUT = '// 前の生成物（テスト用の目印）\nexport const stale = true\n'

let sourceDir: string
let outDir: string

function runGenCards(source: string) {
  writeFileSync(join(sourceDir, 'cards.md'), source)
  const before = snapshot(outDir)
  const result = spawnSync(process.execPath, [GEN_CARDS], {
    cwd: FRONTEND,
    env: { ...process.env, GEN_SOURCE_DIR: sourceDir, GEN_OUT_DIR: outDir },
    encoding: 'utf8',
    timeout: 60_000,
  })
  return { ...result, before, after: snapshot(outDir) }
}

/** 同じカードが重複している編集元の作り方（22 枚の実物から作る） */
const DUPLICATED_DECKS: [string, (cards: string[]) => string[]][] = [
  // 23 枚になる。枚数の超過ではなく重複として落ちること（番号の外のカードは無い）
  ['同じ塊を末尾にもう一度置く（23 枚）', (cards) => [...cards, cards[3]]],
  // 22 枚のまま。番号 05 が 2 回あり、06 が無い
  ['別のカードを既存のカードの写しに置き換える（22 枚、同じ番号が 2 回）', (cards) => cards.map((block, i) => (i === 6 ? cards[5] : block))],
  // 同じ番号だが中身（名前・キーワード）が違う塊。番号が同じなら同じカード
  [
    '同じ番号で中身の違う塊を足す（23 枚）',
    (cards) => [
      ...cards,
      cards[10]
        .replace(CARD_HEADING, '## $1 - テスト専用名 ($3 Twin)')
        .replace(/^\*\*正位置キーワード\*\*: .*$/m, '**正位置キーワード**: テスト専用語,写し,二重'),
    ],
  ],
]

beforeAll(() => {
  // 実物の編集元が、このテストが前提にする形（前書き + `---` 区切りの 22 枚、各塊の先頭が見出し）であることを確かめる
  const { cards } = splitCardsSource(REAL_SOURCE)
  expect(cards).toHaveLength(22)
  for (const block of cards) expect(block.trimStart()).toMatch(CARD_HEADING)
})

beforeEach(() => {
  sourceDir = mkdtempSync(join(tmpdir(), 'tarot-gen-cards-dup-src-'))
  outDir = mkdtempSync(join(tmpdir(), 'tarot-gen-cards-dup-out-'))
  writeFileSync(join(outDir, 'cards.ts'), STALE_OUTPUT)
  mkdirSync(join(outDir, 'deep'))
  writeFileSync(join(outDir, 'deep', 'work.ts'), STALE_OUTPUT)
})

afterEach(() => {
  rmSync(sourceDir, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
})

// UC-010
describe('カードの内容の生成: 同じカードの重複（UC-010）', () => {
  // @covers REQ-121#card-number-duplicated
  it.each(DUPLICATED_DECKS)('同じカードが重複している（%s）と、生成は失敗して理由を示し、どの生成物も書き換えない', (_label, duplicate) => {
    const { preamble, cards } = splitCardsSource(REAL_SOURCE)
    const run = runGenCards(joinCardsSource(preamble, duplicate(cards)))

    expect(run.status, `終了コードが 0（生成が失敗していない）。stdout: ${run.stdout}`).not.toBe(0)
    expect(run.stderr.trim(), '標準エラー出力に理由が無い').not.toBe('')
    expect(run.after).toEqual(run.before)
  })
})
