import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// 仕様 v3.3 §3.3「機能フラグの置き場は lib/features.ts の 1 箇所」の固定（docs/検査と門.md #7）。
// 課金導入時にこの定数を購入状態へ置き換えるので、判定が散らばっていると取りこぼす。
// 共通ルール 3-1（同じものを 2 箇所に書かない）。裏面パスの card-back.test.ts と同じ形。

const SRC = join(__dirname, '..', 'src')
const FEATURES = join('lib', 'features.ts')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('機能フラグの集約（lib/features.ts）', () => {
  const files = walk(SRC).map((p) => [relative(SRC, p), readFileSync(p, 'utf8')] as const)

  it('*_ENABLED を宣言しているのは lib/features.ts だけ', () => {
    const offenders = files
      .filter(([rel, text]) => rel !== FEATURES && /\b(?:const|let|var)\s+[A-Z_]+_ENABLED\b/.test(text))
      .map(([rel]) => rel)
    expect(offenders).toEqual([])
  })

  it('DEEP_READING_ENABLED を使う側は必ず lib/features から import している', () => {
    const offenders = files
      .filter(([rel, text]) => rel !== FEATURES && text.includes('DEEP_READING_ENABLED'))
      .filter(([, text]) => !/import\s*\{[^}]*DEEP_READING_ENABLED[^}]*\}\s*from\s*['"][./]*lib\/features['"]/.test(text))
      .map(([rel]) => rel)
    expect(offenders).toEqual([])
  })

  it('features.ts が DEEP_READING_ENABLED を export している', () => {
    expect(readFileSync(join(SRC, FEATURES), 'utf8')).toMatch(/export const DEEP_READING_ENABLED\s*=/)
  })
})
