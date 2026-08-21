// data/deep/*.md から src/data/deep/<id>.ts と registry.ts を再生成する。
//
//   pnpm gen:deep
//
// パース仕様（詳細は data/deep/README を兼ねる各 md の冒頭コメント参照）:
//   - 冒頭に `**id**: work` / `**label**: 仕事` の 2 行
//   - `## 質問` セクション:
//       `### Q1 <質問文>` 見出しの下に選択肢を
//       `- <ラベル> :: <回答別補足>` 形式で 3 行
//   - `## カード` セクション:
//       `### NN - <名前>` 見出しの下に
//       `**正位置**: <本文>` / `**逆位置**: <本文>` の各 1 行（1 段落 1 行）
//   - 質問 id / 選択肢 id は出現順から自動採番（q1, q1a, q1b, ...）。
//     並べ替えると id が変わるため、既存カテゴリの並べ替えはしない

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MD_DIR = join(ROOT, 'data/deep')
const OUT_DIR = join(ROOT, 'src/data/deep')

const VALID_IDS = ['work', 'love', 'study', 'money', 'health']
// 表示順（仕様書 v3.1 §5.7 のカテゴリ順）
const DISPLAY_ORDER = ['work', 'love', 'study', 'money', 'health']

function fail(file, msg) {
  console.error(`gen-deep: ${file}: ${msg}`)
  process.exit(1)
}

function parseCategory(file, raw) {
  const idMatch = raw.match(/^\*\*id\*\*:\s*(.+)$/m)
  const labelMatch = raw.match(/^\*\*label\*\*:\s*(.+)$/m)
  if (!idMatch) fail(file, '**id**: 行がありません')
  if (!labelMatch) fail(file, '**label**: 行がありません')
  const id = idMatch[1].trim()
  const label = labelMatch[1].trim()
  if (!VALID_IDS.includes(id)) fail(file, `id "${id}" は未定義です (${VALID_IDS.join('/')})`)

  // ---- 質問 ----
  const qSection = raw.split(/^## 質問$/m)[1]?.split(/^## カード$/m)[0]
  if (!qSection) fail(file, '「## 質問」〜「## カード」の区切りが見つかりません')
  const qBlocks = qSection.split(/^### /m).slice(1)
  if (qBlocks.length !== 3) fail(file, `質問は 3 問必要です（現在 ${qBlocks.length} 問）`)

  const questions = qBlocks.map((block, qi) => {
    const [head, ...rest] = block.split('\n')
    const text = head.replace(/^Q\d+\s*/, '').trim()
    if (!text) fail(file, `Q${qi + 1} の質問文が空です`)
    const choices = rest
      .filter((l) => l.trim().startsWith('- '))
      .map((l, ci) => {
        const m = l.trim().replace(/^- /, '').split('::')
        if (m.length !== 2) fail(file, `Q${qi + 1} 選択肢 ${ci + 1}: 「ラベル :: 補足」形式ではありません`)
        return {
          id: `q${qi + 1}${'abc'[ci]}`,
          label: m[0].trim(),
          fragment: m[1].trim(),
        }
      })
    if (choices.length !== 3) fail(file, `Q${qi + 1} の選択肢は 3 択必要です（現在 ${choices.length}）`)
    return { id: `q${qi + 1}`, text, choices }
  })

  // ---- カード ----
  const cSection = raw.split(/^## カード$/m)[1]
  const cBlocks = cSection.split(/^### /m).slice(1)
  if (cBlocks.length !== 22) fail(file, `カードは 22 枚必要です（現在 ${cBlocks.length} 枚）`)

  const base = {}
  for (const block of cBlocks) {
    const numMatch = block.match(/^(\d\d)\s*-/)
    if (!numMatch) fail(file, `カード見出し「### NN - 名前」が不正です: ${block.slice(0, 30)}`)
    const num = Number(numMatch[1])
    const up = block.match(/^\*\*正位置\*\*:\s*(.+)$/m)
    const rev = block.match(/^\*\*逆位置\*\*:\s*(.+)$/m)
    if (!up) fail(file, `カード ${num}: **正位置**: 行がありません`)
    if (!rev) fail(file, `カード ${num}: **逆位置**: 行がありません`)
    if (base[num]) fail(file, `カード ${num} が重複しています`)
    base[num] = { upright: up[1].trim(), reversed: rev[1].trim() }
  }
  for (let n = 0; n <= 21; n++) {
    if (!base[n]) fail(file, `カード ${n} がありません`)
  }

  return { id, label, questions, base }
}

const files = readdirSync(MD_DIR).filter((f) => f.endsWith('.md'))
const categories = files.map((f) =>
  parseCategory(basename(f), readFileSync(join(MD_DIR, f), 'utf8')),
)
categories.sort((a, b) => DISPLAY_ORDER.indexOf(a.id) - DISPLAY_ORDER.indexOf(b.id))

const HEADER = '// このファイルは scripts/gen-deep.mjs による自動生成。直接編集しない。\n// 編集は data/deep/*.md を変更して `pnpm gen:deep` を実行する。\n'

for (const cat of categories) {
  const ts =
    `${HEADER}import type { DeepCategoryData } from './types'\n\n` +
    `export const deepCategory: DeepCategoryData = ${JSON.stringify(cat, null, 2)}\n`
  writeFileSync(join(OUT_DIR, `${cat.id}.ts`), ts)
}

const registry =
  `${HEADER}import type { DeepCategoryData, DeepCategoryId } from './types'\n\n` +
  `export const deepCategories: ReadonlyArray<{ id: DeepCategoryId; label: string }> = ${JSON.stringify(
    categories.map(({ id, label }) => ({ id, label })),
    null,
    2,
  )}\n\n` +
  `export const deepCategoryLoaders: Partial<Record<DeepCategoryId, () => Promise<{ deepCategory: DeepCategoryData }>>> = {\n` +
  categories.map(({ id }) => `  ${id}: () => import('./${id}'),`).join('\n') +
  `\n}\n`
writeFileSync(join(OUT_DIR, 'registry.ts'), registry)

console.log(
  `gen-deep: ${categories.length} カテゴリを生成 (${categories.map((c) => c.id).join(', ')})`,
)
