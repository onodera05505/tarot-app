import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// UC-010 の要件の文（REQ-090・REQ-121）、UC-010 の表（カードの内容を生成する列）、用語集（編集元・生成・生成物）、
// 編集元 frontend/data/cards.md の冒頭の編集ルールだけから設計（生成スクリプトは参照していない）。
//
// 生成（用語集: `gen:cards`）を子プロセスで実際に実行し、終了コード・標準エラー出力・書き出し先の変化だけを観測する。
// 実物から切り離す手段は CLAUDE.md の「生成」の行: 環境変数 GEN_SOURCE_DIR（編集元の置き場。実物では
// frontend/data）と GEN_OUT_DIR（書き出し先。実物では frontend/src/data）。失敗は終了コード 0 以外と標準エラー出力の理由。
// 書き出し先の形（どのファイル名で書くか）はここでは決めず、「書き出し先の中のどのファイルも変わらない」を
// 一覧と中身の写しの一致で見る。

const FRONTEND = resolve(import.meta.dirname, '..')
const GEN_CARDS = join(FRONTEND, 'scripts', 'gen-cards.mjs')
const REAL_SOURCE = readFileSync(join(FRONTEND, 'data', 'cards.md'), 'utf8')

/** 編集元のカードの区切り（cards.md の編集ルール: カード間は `---` で区切る） */
const SEPARATOR = '\n---\n'
/** 編集元のカードの見出し（cards.md の編集ルール: `## NN - 日本語名 (English Name)`） */
const HEADING = /^## (\d{2}) - (.+?) \((.+?)\)$/m

/** 編集元を、前書きと 22 枚のカードの塊に分ける。実物の編集元で形を確かめてから使う */
function splitSource(text: string): { preamble: string; cards: string[] } {
  const [preamble, ...cards] = text.split(SEPARATOR)
  return { preamble, cards: cards.filter((block) => block.trim() !== '') }
}

function joinSource(preamble: string, cards: string[]): string {
  return [preamble, ...cards].join(SEPARATOR) + '\n'
}

/** 1 枚のカードの塊に手を入れた編集元を作る */
function withCard(index: number, edit: (block: string) => string): string {
  const { preamble, cards } = splitSource(REAL_SOURCE)
  const edited = [...cards]
  edited[index] = edit(cards[index])
  return joinSource(preamble, edited)
}

/** 書き出し先の中の全ファイルの写し（相対パス → 中身） */
function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {}
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else result[relative(dir, full)] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return result
}

let sourceDir: string
let outDir: string

/** 前の生成物の目印。失敗したときはこれがそのまま残っていなければならない */
const STALE_OUTPUT = '// 前の生成物（テスト用の目印）\nexport const stale = true\n'

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

/** 失敗の観測: 終了コード 0 以外、標準エラー出力に理由、書き出し先は一切変わらない */
function expectRejected(run: ReturnType<typeof runGenCards>) {
  expect(run.status, `終了コードが 0（生成が失敗していない）。stdout: ${run.stdout}`).not.toBe(0)
  expect(run.stderr.trim(), '標準エラー出力に理由が無い').not.toBe('')
  expect(run.after).toEqual(run.before)
}

/** 見出しの書式の崩し方（cards.md の編集ルールの形 `## NN - 日本語名 (English Name)` から外す） */
const BROKEN_HEADINGS: [string, (block: string) => string][] = [
  ['番号が無い', (block) => block.replace(HEADING, '## $2 ($3)')],
  ['番号と名前の区切りが無い', (block) => block.replace(HEADING, '## $1 $2 ($3)')],
]

/** 決められた番号（00〜21）の外の番号を持たせるカードの位置と番号 */
const NUMBERS_OUTSIDE_SET: [string, number, string][] = [
  ['最大の 1 つ上（22）', 21, '22'],
  ['二桁の外れた番号（99）', 0, '99'],
]

/** 枚数が揃わない編集元の作り方（22 枚から選び直す） */
const SHORT_DECKS: [string, (cards: string[]) => string[]][] = [
  ['21 枚', (cards) => cards.filter((_, i) => i !== 7)],
  ['0 枚（前書きだけ）', () => []],
]

/** 必須の文章を空にする手（値を空にする・行ごと消す・解説文を消す） */
const BLANK_REQUIRED_TEXTS: [string, (block: string) => string][] = [
  ['正位置キーワードが空', (block) => block.replace(/^\*\*正位置キーワード\*\*: .*$/m, '**正位置キーワード**:')],
  ['逆位置キーワードの行が無い', (block) => block.replace(/^\*\*逆位置キーワード\*\*: .*\n/m, '')],
  ['正位置の解説文が空', (block) => block.replace(/(### 正位置\n)[\s\S]*?(\n### 逆位置)/, '$1$2')],
  ['逆位置の解説文が無い', (block) => block.replace(/(### 逆位置\n)[\s\S]*$/, '$1')],
]

beforeAll(() => {
  // 実物の編集元が、このテストが前提にする形（前書き + `---` 区切りの 22 枚、各塊の先頭が見出し）であることを確かめる
  const { cards } = splitSource(REAL_SOURCE)
  expect(cards).toHaveLength(22)
  for (const block of cards) expect(block.trimStart()).toMatch(HEADING)
})

beforeEach(() => {
  sourceDir = mkdtempSync(join(tmpdir(), 'tarot-gen-cards-src-'))
  outDir = mkdtempSync(join(tmpdir(), 'tarot-gen-cards-out-'))
  writeFileSync(join(outDir, 'cards.ts'), STALE_OUTPUT)
  mkdirSync(join(outDir, 'deep'))
  writeFileSync(join(outDir, 'deep', 'work.ts'), STALE_OUTPUT)
})

afterEach(() => {
  rmSync(sourceDir, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
})

// UC-010
describe('カードの内容の生成: 編集元の書式の確かめ（UC-010）', () => {
  describe('書式どおりの編集元', () => {
    // @covers REQ-090#regenerate-from-source
    it('前の生成物が食い違っていても、編集元の内容で生成物が書き出し直される', () => {
      const marker = 'テスト専用語甲'
      const run = runGenCards(withCard(0, (block) => block.replace(/^\*\*正位置キーワード\*\*: .*$/m, `**正位置キーワード**: ${marker},自由`)))

      expect(run.status, `stderr: ${run.stderr}`).toBe(0)
      const generated = Object.entries(run.after).filter(([, content]) => content.includes(marker))
      expect(generated, '書き出し先のどのファイルにも編集元の内容が無い').not.toHaveLength(0)
      // 詳しく占うの生成物（deep/）はカードの生成の対象外なので目印のまま残る
      expect(run.after['deep/work.ts']).toBe(STALE_OUTPUT)
    })

    // @covers REQ-090#report-count
    it('生成したカードの件数（22）を示す', () => {
      const run = runGenCards(REAL_SOURCE)

      expect(run.status, `stderr: ${run.stderr}`).toBe(0)
      expect(run.stdout).toMatch(/\b22\b/)
    })
  })

  describe('書式が崩れた編集元', () => {
    // @covers REQ-121#card-heading-broken
    it.each(BROKEN_HEADINGS)('カードの見出しの書式が崩れている（%s）と、生成は失敗して理由を示し、どの生成物も書き換えない', (_label, breakHeading) => {
      expectRejected(runGenCards(withCard(5, breakHeading)))
    })

    // @covers REQ-121#card-number-outside-set
    it.each(NUMBERS_OUTSIDE_SET)('決められた番号の外のカード（%s）があると、生成は失敗して理由を示し、どの生成物も書き換えない', (_label, index, number) => {
      expectRejected(runGenCards(withCard(index, (block) => block.replace(HEADING, `## ${number} - $2 ($3)`))))
    })

    // @covers REQ-121#card-count-short
    it.each(SHORT_DECKS)('カードの枚数が揃わない（%s）と、生成は失敗して理由を示し、どの生成物も書き換えない', (_label, pick) => {
      const { preamble, cards } = splitSource(REAL_SOURCE)
      expectRejected(runGenCards(joinSource(preamble, pick(cards))))
    })

    // @covers REQ-121#card-required-text-empty
    it.each(BLANK_REQUIRED_TEXTS)('必須の文章が空（%s）だと、生成は失敗して理由を示し、どの生成物も書き換えない', (_label, blank) => {
      expectRejected(runGenCards(withCard(12, blank)))
    })
  })
})
