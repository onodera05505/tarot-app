// 詳しく占う（仕様書 v3.1 §4.4）のデータ型。
// データ本体は data/deep/*.md から scripts/gen-deep.mjs で自動生成される。

export type DeepCategoryId = 'work' | 'love' | 'study' | 'money' | 'health'

export type DeepChoice = {
  id: string
  label: string
  /** 結果画面で合成表示する回答別補足（60〜120 字目安） */
  fragment: string
}

export type DeepQuestion = {
  id: string
  text: string
  /** 3 択 */
  choices: DeepChoice[]
}

export type DeepCategoryData = {
  id: DeepCategoryId
  label: string
  /** 3 問 */
  questions: DeepQuestion[]
  /** カード number (0..21) → 正逆別ベース解釈（150〜250 字目安） */
  base: Record<number, { upright: string; reversed: string }>
}
