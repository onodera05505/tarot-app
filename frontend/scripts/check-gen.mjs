// 生成物が編集元から生成し直した結果と一致しているかを検査する。
//
//   pnpm check:gen
//
// 仕様:
//   - 編集元（GEN_SOURCE_DIR。未指定なら data/）から gen-cards.mjs と gen-deep.mjs を一時ディレクトリへ
//     書き出し、比べる先の生成物（GEN_OUT_DIR。未指定なら src/data/）と 1 ファイルずつ比べる
//   - 比べるのは生成し直して出てきたファイルだけ。生成しないファイル（deep/index.ts・deep/types.ts など）は
//     比べる対象に入れない
//   - 1 つでも違えば、違うファイルごとに「最初に違う行番号と両方の行」を標準エラー出力に示し、終了コード 1
//   - 生成し直し自体が失敗したら（編集元の書式が崩れているなど）、その理由を標準エラー出力に示して終了コード 1
//     （生成できない編集元からは配れないため、検査も通さない）
//   - 比べる先の生成物は一切書き換えない（書き出しは一時ディレクトリにだけ行い、終了時に消す）

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = process.env.GEN_SOURCE_DIR || join(ROOT, 'data')
const OUT_DIR = process.env.GEN_OUT_DIR || join(ROOT, 'src/data')

/** 生成し直しに使う生成スクリプト。どちらも GEN_SOURCE_DIR / GEN_OUT_DIR で入出力を差し替えられる */
const GENERATORS = ['gen-cards.mjs', 'gen-deep.mjs']

/** 一時ディレクトリの中の全ファイル（一時ディレクトリからの相対パス）。ここに出てきたものだけが比べる対象 */
function listFiles(dir) {
  const result = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else result.push(relative(dir, full))
    }
  }
  walk(dir)
  return result.sort()
}

/**
 * 2 つの中身を行で比べ、最初に違う行の番号（1 始まり）と両方の行を返す。同じなら null。
 * 片方だけ行が余るときは、無い側の行を「（行が無い）」と示す。
 */
function firstDifference(expected, actual) {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const length = Math.max(expectedLines.length, actualLines.length)
  for (let i = 0; i < length; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      return {
        line: i + 1,
        expected: expectedLines[i] ?? '（行が無い）',
        actual: actualLines[i] ?? '（行が無い）',
      }
    }
  }
  return null
}

/**
 * 編集元から一時ディレクトリへ生成し直し、比べる先の生成物と 1 ファイルずつ比べる。
 * 違いがあれば標準エラー出力に示して終了コード 1。比べる先には書き込まない。
 * @implements REQ-133
 */
function check() {
  const tempDir = mkdtempSync(join(tmpdir(), 'tarot-check-gen-'))
  try {
    for (const script of GENERATORS) {
      const result = spawnSync(process.execPath, [join(__dirname, script)], {
        cwd: ROOT,
        env: { ...process.env, GEN_SOURCE_DIR: SOURCE_DIR, GEN_OUT_DIR: tempDir },
        encoding: 'utf8',
      })
      if (result.status !== 0) {
        if (result.stderr) process.stderr.write(result.stderr)
        console.error(`check-gen: ${script} による生成し直しが失敗したため、検査を通しません（終了コード ${result.status ?? result.signal}）`)
        return 1
      }
    }

    const mismatches = []
    for (const relPath of listFiles(tempDir)) {
      const regenerated = readFileSync(join(tempDir, relPath), 'utf8')
      const target = join(OUT_DIR, relPath)
      if (!existsSync(target)) {
        mismatches.push(`check-gen: ${relPath}: 生成物がありません（生成し直すと作られるファイル）`)
        continue
      }
      const diff = firstDifference(regenerated, readFileSync(target, 'utf8'))
      if (diff) {
        mismatches.push(
          `check-gen: ${relPath}: ${diff.line} 行目が編集元から生成し直した結果と違います\n` +
            `  生成し直した結果: ${diff.expected}\n` +
            `  現在の生成物:     ${diff.actual}`,
        )
      }
    }

    if (mismatches.length > 0) {
      for (const m of mismatches) console.error(m)
      console.error(
        `check-gen: ${mismatches.length} 件の生成物が編集元と一致しません。編集元を直したなら pnpm gen:cards / pnpm gen:deep で生成し直し、生成物は手で直さないでください`,
      )
      return 1
    }

    console.log(`check-gen: 生成物は編集元から生成し直した結果と一致しています（${relative(ROOT, OUT_DIR) || OUT_DIR}）`)
    return 0
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

process.exit(check())
