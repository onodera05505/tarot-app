import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// UC-011 の要件の文（REQ-096・REQ-131）、UC-011 の表（サムネイルを生成する列）、用語集（原本・サムネイル・生成）、
// 原本の置き場の説明（frontend/public/cards/README.md のサムネイルの節）だけから設計（生成スクリプトは参照していない）。
//
// 生成（用語集: `gen:thumbs`）を子プロセスで実際に実行し、終了コード・標準エラー出力・書き出し先の変化だけを観測する。
// 実物から切り離す手段は CLAUDE.md の「生成」の行: 環境変数 GEN_SOURCE_DIR（原本の置き場。実物では
// frontend/public/cards/major）と GEN_OUT_DIR（書き出し先。実物では frontend/public/cards/thumbs）。
// 失敗は終了コード 0 以外と標準エラー出力の理由。
// 生成は Python の画像ライブラリ（Pillow）に頼るので、それが無い環境ではこのファイル全体を skip する
// （UC-011 の表の「画像処理の道具が無い環境」の行は `?` で、ここでは見ない）。

const FRONTEND = resolve(import.meta.dirname, '..')
const GEN_THUMBS = join(FRONTEND, 'scripts', 'gen-thumbs.py')
const REAL_ORIGINALS = join(FRONTEND, 'public', 'cards', 'major')
const REAL_THUMBS = join(FRONTEND, 'public', 'cards', 'thumbs')

const PYTHON = 'python3'
const hasPillow = spawnSync(PYTHON, ['-c', 'import PIL.Image'], { encoding: 'utf8' }).status === 0

/** 書き出し先の中の全項目の写し（相対パス → 中身のバイト列。ディレクトリは目印） */
function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {}
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        result[relative(dir, full)] = '<dir>'
        walk(full)
      } else {
        result[relative(dir, full)] = readFileSync(full).toString('base64')
      }
    }
  }
  walk(dir)
  return result
}

let sourceDir: string
let outDir: string

/** 原本を 2 つ（カードを指すものと裏面）実物から置く */
function placeReadableOriginals() {
  copyFileSync(join(REAL_ORIGINALS, '00_theFool.webp'), join(sourceDir, '00_theFool.webp'))
  copyFileSync(join(REAL_ORIGINALS, '000.webp'), join(sourceDir, '000.webp'))
}

function runGenThumbs() {
  const before = snapshot(outDir)
  const result = spawnSync(PYTHON, [GEN_THUMBS], {
    cwd: FRONTEND,
    env: { ...process.env, GEN_SOURCE_DIR: sourceDir, GEN_OUT_DIR: outDir },
    encoding: 'utf8',
    timeout: 120_000,
  })
  return { ...result, before, after: snapshot(outDir) }
}

/** 失敗の観測: 終了コード 0 以外、標準エラー出力に理由、書き出し先は一切変わらない */
function expectRejected(run: ReturnType<typeof runGenThumbs>) {
  expect(run.status, `終了コードが 0（生成が失敗していない）。stdout: ${run.stdout}`).not.toBe(0)
  expect(run.stderr.trim(), '標準エラー出力に理由が無い').not.toBe('')
  expect(run.after).toEqual(run.before)
}

beforeEach(() => {
  sourceDir = mkdtempSync(join(tmpdir(), 'tarot-gen-thumbs-src-'))
  outDir = mkdtempSync(join(tmpdir(), 'tarot-gen-thumbs-out-'))
})

afterEach(() => {
  rmSync(sourceDir, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
})

// UC-011
describe.skipIf(!hasPillow)('サムネイルの生成: 途中で失敗したときの書き出し先（UC-011）', () => {
  // @covers REQ-096#all-originals-thumbnailed
  it('読める原本だけなら、どのカードも指さない原本を含むすべての原本からサムネイルが書き出される', () => {
    placeReadableOriginals()
    copyFileSync(join(REAL_ORIGINALS, '21_theWorld.webp'), join(sourceDir, 'zz_unlisted.webp'))

    const run = runGenThumbs()

    expect(run.status, `stderr: ${run.stderr}`).toBe(0)
    expect(Object.keys(run.after).sort()).toEqual(['000.webp', '00_theFool.webp', 'zz_unlisted.webp'])
  })

  // @covers REQ-131#unreadable-original-fails
  it('画像として読めない原本があると、生成は失敗して理由を示し、前からあるサムネイルも含めてどのサムネイルも書き換えない', () => {
    placeReadableOriginals()
    writeFileSync(join(sourceDir, '05_theHierophant.webp'), 'これは画像ではない')
    // 前からあるサムネイル（名前が同じでも中身は古い）
    copyFileSync(join(REAL_THUMBS, '21_theWorld.webp'), join(outDir, '00_theFool.webp'))

    expectRejected(runGenThumbs())
  })

  // @covers REQ-131#unwritable-thumbnail-fails
  it('書き出し先の一部に書けない（同名のディレクトリがある）と、生成は失敗して理由を示し、ほかの原本のサムネイルも書き換えない', () => {
    placeReadableOriginals()
    mkdirSync(join(outDir, '000.webp'))
    copyFileSync(join(REAL_THUMBS, '21_theWorld.webp'), join(outDir, '00_theFool.webp'))

    expectRejected(runGenThumbs())
  })
})
