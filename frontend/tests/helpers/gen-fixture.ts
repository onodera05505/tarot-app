import { cpSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// UC-010 の生成・検査のテストが共有する、編集元と生成物の置き場の扱い。
// 置き場と切り離し方は CLAUDE.md の「生成」「生成物の同期の検査」の行と用語集（編集元・生成物）だけから取る
// （生成スクリプト・検査スクリプトは参照していない）。
// - 編集元: frontend/data（直下に cards.md、deep/*.md）
// - 生成物: frontend/src/data（直下に cards.ts、deep/*.ts）
// - 環境変数 GEN_SOURCE_DIR / GEN_OUT_DIR で実物から切り離す

export const FRONTEND = resolve(import.meta.dirname, '..', '..')
/** 実物の編集元の置き場（用語集: 編集元） */
export const REAL_SOURCE_DIR = join(FRONTEND, 'data')
/** 実物の生成物の置き場（用語集: 生成物） */
export const REAL_OUT_DIR = join(FRONTEND, 'src', 'data')

/** 編集元のカードの区切り（cards.md の編集ルール: カード間は `---` で区切る） */
export const CARD_SEPARATOR = '\n---\n'
/** 編集元のカードの見出し（cards.md の編集ルール: `## NN - 日本語名 (English Name)`） */
export const CARD_HEADING = /^## (\d{2}) - (.+?) \((.+?)\)$/m

/** カードの編集元を、前書きと各カードの塊に分ける。実物の編集元で形を確かめてから使う */
export function splitCardsSource(text: string): { preamble: string; cards: string[] } {
  const [preamble, ...cards] = text.split(CARD_SEPARATOR)
  return { preamble, cards: cards.filter((block) => block.trim() !== '') }
}

export function joinCardsSource(preamble: string, cards: string[]): string {
  return [preamble, ...cards].join(CARD_SEPARATOR) + '\n'
}

/** ディレクトリの中の全ファイルの写し（相対パス → 中身）。「どのファイルも変わらない」を一覧と中身の一致で見る */
export function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {}
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else result[relative(dir, full)] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return result
}

/** ディレクトリを丸ごと複製する（実物の編集元・生成物を一時ディレクトリへ写すため） */
export function copyDir(from: string, to: string): void {
  cpSync(from, to, { recursive: true })
}
