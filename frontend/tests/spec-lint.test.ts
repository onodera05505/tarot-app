import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 仕様書 v3 と実装の突き合わせ（docs/検査と門.md #11。共通ルール 2「仕様書が先、実装が後」の機械の門）。
// 仕様書の表に書かれた「機械で照合できる事実」だけを見る。文章の意味は見ない。
// - §5.1 ルーティング表の path が App.tsx の <Route path> に全て存在し、逆に App.tsx の path が表に全て載っている
// - §4.3 localStorage キーが src のどこかで文字列として使われている
// - §6 が「既知の差分なし」でなければ、差分の各行に日付（YYYY-MM-DD）がある（放置を防ぐ）
// 仕様書を改訂したらこのテストも同じコミットで通す（表の形を変えたら正規表現を直す）。

const ROOT = join(__dirname, '..', '..')
const SPEC = readFileSync(join(ROOT, 'docs', 'タロットアプリ_要件定義書_v3.md'), 'utf8')
const APP = readFileSync(join(ROOT, 'frontend', 'src', 'App.tsx'), 'utf8')

function section(heading: RegExp): string {
  const m = SPEC.match(new RegExp(`^${heading.source}[\\s\\S]*?(?=^#{2,3} )`, 'm'))
  if (!m) throw new Error(`仕様書に節が見つからない: ${heading}`)
  return m[0]
}

describe('仕様書 v3 と実装の突き合わせ', () => {
  it('§5.1 ルーティング表と App.tsx の Route が一致する', () => {
    const table = section(/### 5\.1 /)
    const specPaths = [...table.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]).sort()
    const appPaths = [...APP.matchAll(/<Route\s[^>]*path="([^"]+)"/g)].map((m) => m[1]).sort()
    expect(appPaths).toEqual(specPaths)
  })

  it('§4.3 の localStorage キーが実装に存在する', () => {
    const table = section(/### 4\.3 /)
    const keys = [...table.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(0)
    const src = ['lib/history.ts', 'components/TodaysCard.tsx']
      .map((f) => readFileSync(join(ROOT, 'frontend', 'src', f), 'utf8'))
      .join('\n')
    const missing = keys.filter((k) => !src.includes(`'${k}'`) && !src.includes(`"${k}"`))
    expect(missing).toEqual([])
  })

  it('§6 の差分は「既知の差分なし」か、各行に日付がある', () => {
    const sec = section(/## 6\. /)
    if (/現在、既知の差分なし/.test(sec)) return
    const items = sec.split('\n').filter((l) => /^\s*(?:-|\d+\.)\s/.test(l))
    expect(items.length).toBeGreaterThan(0)
    const undated = items.filter((l) => !/\d{4}-\d{2}-\d{2}/.test(l))
    expect(undated).toEqual([])
  })
})
