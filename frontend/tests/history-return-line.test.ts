import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 中央ブレインへの還元の門（2026-09-11 配線）。
// history/YYYY-MM-DD.md の末尾に「ブレイン: 参照した型 / 確認した値 / 追加 / 更新 / 無し（理由）」の
// 行を必ず置く（history/README.md）。規則だけでは還らないので機械で見る。
// 判定は中央の `~/.claude/brain/check_return_line.py` と同じ（行頭「ブレイン:」、前後の - ** 全角コロンを許す。
// 2026-09-11 以降のファイルだけ）。中央の門は CI から届かないので、ここに同じ判定を持つ。
// 直すときは両方を揃えること。

const SINCE = '2026-09-11'
const LINE = /^\s*(?:[-*]\s*)?(?:\*\*)?ブレイン(?:\*\*)?\s*[:：]/m
const HISTORY_DIR = join(__dirname, '..', '..', 'history')

function datedFiles(): string[] {
  return readdirSync(HISTORY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f) && f.slice(0, 10) >= SINCE)
    .sort()
}

describe('history/ の還元行（ブレイン: …）', () => {
  it(`${SINCE} 以降の各日のファイルに還元行がある`, () => {
    const missing = datedFiles().filter((f) => !LINE.test(readFileSync(join(HISTORY_DIR, f), 'utf8')))
    expect(missing, '還元行「ブレイン: 参照した型 / 確認した値 / 追加 / 更新 / 無し（理由）」を末尾に置く').toEqual([])
  })
})
