import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/検査と門.md（不変条件→門、検査の層→門の表）が名指しするファイルの実在を見る。
// 消したり改名したりすると表が嘘になる（中央 approaches/不変条件を門に落とす.md 手順 3）。
// 表に書くパスはリポジトリ直下からの相対パスをバッククォートで囲む。

const ROOT = join(__dirname, '..', '..')
const DOC = join(ROOT, 'docs', '検査と門.md')
const PATH_RE = /`((?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|mjs|yml|md))`/g

describe('docs/検査と門.md', () => {
  it('表が名指しするファイルが全て実在する', () => {
    const text = readFileSync(DOC, 'utf8')
    const paths = [...new Set([...text.matchAll(PATH_RE)].map((m) => m[1]))]
      .filter((p) => !p.includes('*') && !p.startsWith('~'))
    expect(paths.length).toBeGreaterThan(5)
    const missing = paths.filter((p) => !existsSync(join(ROOT, p)))
    expect(missing).toEqual([])
  })
})
