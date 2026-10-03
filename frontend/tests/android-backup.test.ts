import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ADR-0010（Android では OS のバックアップと端末間の引き継ぎにアプリの記録を載せない）の担保。
// 設定の正本は Android の設定ファイルで、このテストはそれを読むだけ（値をここへ写して比べない）。
// 落ちたら設定ファイルの側を直す。Android 11 以前は allowBackup、12 以降は dataExtractionRules が効くので両方を見る。

const ROOT = join(__dirname, '..', '..')
const MAIN = join(ROOT, 'frontend', 'android', 'app', 'src', 'main')
const MANIFEST = join(MAIN, 'AndroidManifest.xml')
const XML_DIR = join(MAIN, 'res', 'xml')

// Android の公式のバックアップ規則が持つ区分の全て。1 つでも除外から漏れると、その区分の記録が端末の外へ出る。
const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
]

// コメントの中に書かれたタグを設定として数えない。
function stripComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '')
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2]
}

function applicationTag(manifest: string): string {
  const tags = stripComments(manifest).match(/<application\b[^>]*>/g) ?? []
  expect(tags, '<application> はちょうど 1 つ').toHaveLength(1)
  return tags[0] ?? ''
}

// マニフェストが指す規則のファイルの絶対パス。指していない、または @xml/ の形でなければ undefined。
function rulesFile(manifest: string): string | undefined {
  const ref = attr(applicationTag(manifest), 'android:dataExtractionRules')
  const name = ref?.match(/^@xml\/(\w+)$/)?.[1]
  return name === undefined ? undefined : join(XML_DIR, `${name}.xml`)
}

// 規則のファイルの 1 つの節（cloud-backup / device-transfer）について、
// 区分をまるごと（path="."）除外しているものと、<include> の数を返す。
function readSection(rules: string, section: string): { excluded: string[]; includes: number } {
  const bodies = [
    ...stripComments(rules).matchAll(new RegExp(`<${section}\\b[^>]*>([\\s\\S]*?)</${section}>`, 'g')),
  ].map((m) => m[1])
  expect(bodies, `<${section}> はちょうど 1 つ（中身を持つ形）`).toHaveLength(1)
  const body = bodies[0] ?? ''
  const excluded = (body.match(/<exclude\b[^>]*>/g) ?? [])
    .filter((tag) => attr(tag, 'path') === '.')
    .map((tag) => attr(tag, 'domain'))
    .filter((d): d is string => d !== undefined)
  return { excluded, includes: (body.match(/<include\b/g) ?? []).length }
}

function expectNothingLeaves(section: string): void {
  const file = rulesFile(readFileSync(MANIFEST, 'utf8'))
  expect(file, 'マニフェストが規則のファイルを指している').toBeDefined()
  const { excluded, includes } = readSection(readFileSync(file as string, 'utf8'), section)
  expect(DOMAINS.filter((d) => !excluded.includes(d))).toEqual([])
  expect(includes).toBe(0)
}

describe('Android の OS のバックアップと端末間の引き継ぎ（ADR-0010）', () => {
  // 仕様外: ADR-0010 の担保（Android の設定ファイルの門）で、要件の分割クラスではない
  it('マニフェストの application が OS のバックアップを許していない', () => {
    const tag = applicationTag(readFileSync(MANIFEST, 'utf8'))
    expect(attr(tag, 'android:allowBackup')).toBe('false')
  })

  // 仕様外: ADR-0010 の担保（Android の設定ファイルの門）で、要件の分割クラスではない
  it('マニフェストの application が指すバックアップの規則のファイルが実在する', () => {
    const file = rulesFile(readFileSync(MANIFEST, 'utf8'))
    expect(file, 'android:dataExtractionRules が @xml/<名前> の形で指している').toBeDefined()
    expect(existsSync(file as string), `${file} が実在する`).toBe(true)
  })

  // 仕様外: ADR-0010 の担保（Android の設定ファイルの門）で、要件の分割クラスではない
  it('クラウドへのバックアップは全ての区分を除外し、含める指定を持たない', () => {
    expectNothingLeaves('cloud-backup')
  })

  // 仕様外: ADR-0010 の担保（Android の設定ファイルの門）で、要件の分割クラスではない
  it('端末間の引き継ぎは全ての区分を除外し、含める指定を持たない', () => {
    expectNothingLeaves('device-transfer')
  })
})
