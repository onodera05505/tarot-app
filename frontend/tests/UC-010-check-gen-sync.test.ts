import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FRONTEND, REAL_OUT_DIR, REAL_SOURCE_DIR, copyDir, snapshot } from './helpers/gen-fixture'

// UC-010 の要件の文（REQ-133）、UC-010 の表（「生成物が編集元と食い違っている」行の検査の列）と失敗時の事後条件、
// 用語集（検査・編集元・生成物）、CLAUDE.md の「生成物の同期の検査」の行だけから設計（検査スクリプトは参照していない）。
//
// 検査（`frontend/scripts/check-gen.mjs`）を子プロセスで実際に実行し、終了コード・標準エラー出力・比べる先の生成物の
// 変化だけを観測する。実物から切り離す手段は環境変数 GEN_SOURCE_DIR（編集元）と GEN_OUT_DIR（比べる先の生成物）。
// 一致なら終了コード 0、違えば 0 以外で、標準エラー出力に違うファイルと箇所。比べる先の生成物は書き換えない。
// - 「編集元」「生成物」は実物（frontend/data、frontend/src/data）を一時ディレクトリへ丸ごと複製して作る。
//   手で書く生成物の形を決めないため（形は実物に従う）
// - 「違っている箇所」の示し方は要件が決めていないので、違う行の文言（新旧どちらか）か行番号のいずれかが
//   標準エラー出力に現れることを「箇所を示す」と読む
// - 食い違いの作り方: 編集元の 1 語を変える（直した後に生成していない）／生成物の 1 語を変える（手で直した）。
//   どちらも、編集元と生成物の両方に同じ語が現れる箇所を選び、置き換えの前にその語が実物の両方にあることを確かめる

const CHECK_GEN = join(FRONTEND, 'scripts', 'check-gen.mjs')

/** 編集元と生成物の両方に現れる語と、それを置き換えた目印（どの実物にも無い語） */
const CARD_WORD = '冒険'
const CARD_SOURCE_LINE = /^\*\*正位置キーワード\*\*: 自由,冒険,純粋$/m
const DEEP_WORD = '新入りの顔'
const MARKER = 'テスト専用語乙'

let sourceDir: string
let outDir: string

/** 詳しく占うの食い違いの作り方（編集元が先・生成物の手直し） */
const DEEP_MISMATCHES: [string, () => void][] = [
  ['編集元を直した後に生成していない', () => replaceOnce(join(sourceDir, 'deep', 'work.md'), DEEP_WORD, MARKER)],
  ['生成物を手で直した', () => replaceOnce(join(outDir, 'deep', 'work.ts'), DEEP_WORD, MARKER)],
]

function runCheckGen() {
  const before = snapshot(outDir)
  const result = spawnSync(process.execPath, [CHECK_GEN], {
    cwd: FRONTEND,
    env: { ...process.env, GEN_SOURCE_DIR: sourceDir, GEN_OUT_DIR: outDir },
    encoding: 'utf8',
    timeout: 120_000,
  })
  return { ...result, before, after: snapshot(outDir) }
}

/** ファイルの中の語を 1 箇所だけ置き換える。語が無ければ前提が崩れているので失敗させる */
function replaceOnce(path: string, from: string | RegExp, to: string) {
  const text = readFileSync(path, 'utf8')
  expect(text, `${path} に置き換える語が無い`).toMatch(from)
  writeFileSync(path, text.replace(from, to))
}

/** 生成物の中で語が最初に現れる行の番号（1 始まり） */
function lineOf(relPath: string, word: string): number {
  const lines = readFileSync(join(outDir, relPath), 'utf8').split('\n')
  const index = lines.findIndex((line) => line.includes(word))
  expect(index, `${relPath} に ${word} が無い`).toBeGreaterThanOrEqual(0)
  return index + 1
}

/** 不一致の観測: 終了コード 0 以外、標準エラー出力に一致しない生成物の名前と箇所、比べる先の生成物は一切変わらない */
function expectMismatchReported(run: ReturnType<typeof runCheckGen>, relPath: string, word: string, line: number) {
  expect(run.status, `終了コードが 0（検査が通っている）。stdout: ${run.stdout}`).not.toBe(0)
  expect(run.stderr, '標準エラー出力に一致しない生成物の名前が無い').toContain(basename(relPath))
  const spot = new RegExp(`${MARKER}|${word}|\\b${line}\\b`)
  expect(run.stderr, '標準エラー出力に違っている箇所（行の文言か行番号）が無い').toMatch(spot)
  expect(run.after).toEqual(run.before)
}

beforeAll(() => {
  expect(existsSync(CHECK_GEN), `検査のスクリプト ${CHECK_GEN} が無い（CLAUDE.md の「生成物の同期の検査」の行）`).toBe(true)
  // 食い違いを作る語が、実物の編集元と生成物の両方にあることを確かめる（無ければ食い違いを作れない）
  expect(readFileSync(join(REAL_SOURCE_DIR, 'cards.md'), 'utf8')).toMatch(CARD_SOURCE_LINE)
  expect(readFileSync(join(REAL_OUT_DIR, 'cards.ts'), 'utf8')).toContain(CARD_WORD)
  expect(readFileSync(join(REAL_SOURCE_DIR, 'deep', 'work.md'), 'utf8')).toContain(DEEP_WORD)
  expect(readFileSync(join(REAL_OUT_DIR, 'deep', 'work.ts'), 'utf8')).toContain(DEEP_WORD)
  // 目印はどの実物にも無い
  for (const path of ['cards.md', 'deep/work.md']) expect(readFileSync(join(REAL_SOURCE_DIR, path), 'utf8')).not.toContain(MARKER)
  for (const path of ['cards.ts', 'deep/work.ts']) expect(readFileSync(join(REAL_OUT_DIR, path), 'utf8')).not.toContain(MARKER)
})

beforeEach(() => {
  sourceDir = mkdtempSync(join(tmpdir(), 'tarot-check-gen-src-'))
  outDir = mkdtempSync(join(tmpdir(), 'tarot-check-gen-out-'))
  copyDir(REAL_SOURCE_DIR, sourceDir)
  copyDir(REAL_OUT_DIR, outDir)
})

afterEach(() => {
  rmSync(sourceDir, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
})

// UC-010
describe('検査: 生成物が編集元から生成し直した結果と一致すること（UC-010）', () => {
  // @covers REQ-133#in-sync-passes
  it('編集元から生成し直した結果が生成物と一致していれば、検査は通り（終了コード 0）、生成物を書き換えない', () => {
    const run = runCheckGen()

    expect(run.status, `stderr: ${run.stderr}`).toBe(0)
    expect(run.after).toEqual(run.before)
  })

  // @covers REQ-133#cards-source-newer
  it('カードの編集元を直した後に生成していないと、検査は通らず、カードの生成物と違っている箇所を示し、生成物を書き換えない', () => {
    const line = lineOf('cards.ts', CARD_WORD)
    replaceOnce(join(sourceDir, 'cards.md'), CARD_SOURCE_LINE, `**正位置キーワード**: 自由,${MARKER},純粋`)

    expectMismatchReported(runCheckGen(), 'cards.ts', CARD_WORD, line)
  })

  // @covers REQ-133#cards-output-edited
  it('カードの生成物を手で直すと、検査は通らず、カードの生成物と違っている箇所を示し、生成物を書き換えない', () => {
    const line = lineOf('cards.ts', CARD_WORD)
    replaceOnce(join(outDir, 'cards.ts'), CARD_WORD, MARKER)

    expectMismatchReported(runCheckGen(), 'cards.ts', CARD_WORD, line)
  })

  // @covers REQ-133#deep-output-mismatch
  it.each(DEEP_MISMATCHES)('詳しく占うの生成物が編集元から生成し直した結果と一致しない（%s）と、検査は通らず、そのカテゴリの生成物と違っている箇所を示し、生成物を書き換えない', (_label, breakSync) => {
    const line = lineOf('deep/work.ts', DEEP_WORD)
    breakSync()

    expectMismatchReported(runCheckGen(), 'deep/work.ts', DEEP_WORD, line)
  })
})
