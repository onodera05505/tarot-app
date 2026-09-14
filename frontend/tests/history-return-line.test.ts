import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 中央ブレインへの還元の門（2026-09-11 配線、09-14 に「参照した型」の証拠を追加）。
// history/YYYY-MM-DD.md の末尾に
//   ブレイン: 参照した型 <名前 か 当たり無し（grep: 引いた語）> / 適用前に確認した値 Y / 追加 Z / 更新 W
// の行を必ず置く（history/README.md）。規則だけでは還らず、読む側にも門が無いと索引は引かれない
// （3 日運用して名指し参照は 10 本中 2 本だった）ので機械で見る。
// 判定は中央 `~/.claude/brain/check_return_line.py` と同じ文法。中央の門は CI から届かないので、
// ここに同じ判定を持つ。直すときは両方を揃えること。

const SINCE = '2026-09-11' // 還元行そのものを要求
const STRICT_SINCE = '2026-09-14' // 「参照した型」に索引を引いた証拠を要求
const LINE = /^\s*(?:[-*]\s*)?(?:\*\*)?ブレイン(?:\*\*)?\s*[:：](.*)$/gm
const REF_SEG = /参照した型\s*[:：]?\s*(.*?)(?=\s\/\s|$)/
const NAMED = /\.md|`[^`]+`|「[^」]+」|reports\/\d+|報告(?:書)?\s*\d+|approaches\//
const NO_HIT = /当たり無し\s*[（(]\s*grep\s*(?:語)?\s*[:：]\s*([^）)]+?)\s*[）)]/
const HISTORY_DIR = join(__dirname, '..', '..', 'history')

function datedFiles(): string[] {
  return readdirSync(HISTORY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f) && f.slice(0, 10) >= SINCE)
    .sort()
}

/** 問題があれば理由、無ければ null（中央スクリプトの judge() と同じ） */
export function judge(text: string, strict: boolean): string | null {
  const lines = [...text.matchAll(LINE)].map((m) => m[1])
  if (lines.length === 0) return '還元行「ブレイン: …」が無い'
  if (!strict) return null
  const body = lines[lines.length - 1]
  const m = REF_SEG.exec(body)
  if (!m) return '「参照した型」欄が無い（索引を grep した結果: 名前か 当たり無し（grep: 語））'
  const seg = m[1].trim()
  if (NAMED.test(seg)) return null
  const nh = NO_HIT.exec(seg)
  if (nh && nh[1].replace(/[ ,、]/g, '') !== '') return null
  return `「参照した型 ${seg || '（空）'}」では索引を引いた証拠にならない`
}

describe('history/ の還元行（ブレイン: …）', () => {
  it(`${SINCE} 以降の各日のファイルに還元行があり、${STRICT_SINCE} 以降は参照した型の証拠がある`, () => {
    const problems = datedFiles()
      .map((f) => [f, judge(readFileSync(join(HISTORY_DIR, f), 'utf8'), f.slice(0, 10) >= STRICT_SINCE)] as const)
      .filter(([, why]) => why !== null)
      .map(([f, why]) => `${f}: ${why}`)
    expect(problems).toEqual([])
  })

  it('文法: 名前か 当たり無し（grep: 語）だけを索引を引いた証拠と認める', () => {
    expect(judge('ブレイン: 参照した型 `検査の層と門.md` / 追加 無し', true)).toBeNull()
    expect(judge('ブレイン: 参照した型 当たり無し（grep: 再開, ストア） / 追加 無し', true)).toBeNull()
    expect(judge('ブレイン: 参照した型 無し / 追加 無し', true)).not.toBeNull()
    expect(judge('ブレイン: 参照した型 当たり無し（grep: ） / 追加 無し', true)).not.toBeNull()
    expect(judge('ブレイン: 追加 無し（評価のみ）', true)).not.toBeNull()
    expect(judge('ブレイン: 参照した型 無し', false)).toBeNull()
  })
})
