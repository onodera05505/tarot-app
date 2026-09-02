import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARD_BACK_URL } from '../src/lib/api'

// 共通ルール 3-1「同じものを 2 箇所に書かない」の固定。
// 裏面画像のパスは lib/api.ts の CARD_BACK_URL だけが持ち、他の src は import する。

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe('カード裏面画像の集約', () => {
  it('CARD_BACK_URL の実体が public に存在する', () => {
    expect(existsSync(join(__dirname, '..', 'public', CARD_BACK_URL))).toBe(true)
  })

  it('裏面パスの直書きは lib/api.ts の 1 箇所だけ', () => {
    const src = join(__dirname, '..', 'src')
    const offenders = walk(src).filter(
      (f) => !f.endsWith(join('lib', 'api.ts')) && readFileSync(f, 'utf8').includes('000.webp'),
    )
    expect(offenders).toEqual([])
  })
})
