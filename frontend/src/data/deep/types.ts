// 詳しく占う（仕様書 v3.1 §4.4）のデータ型。
// データ本体は data/deep/*.md から scripts/gen-deep.mjs で自動生成される。

export type DeepCategoryId = 'work' | 'love' | 'study' | 'money' | 'health'

export type DeepChoice = {
  id: string
  label: string
  /** 旧構造（v3.1）のみ: カード非連動の回答別補足（60〜120 字目安） */
  fragment?: string
}

export type DeepQuestion = {
  id: string
  text: string
  /** 3 択 */
  choices: DeepChoice[]
}

export type DeepCardEntry = {
  /** 正逆別ベース解釈（150〜250 字目安） */
  upright: string
  reversed: string
  /**
   * 新構造（v3.2）のみ: 選択肢 id → カード連動の回答別アドバイス（60〜140 字目安）。
   * カテゴリ内の全 9 選択肢分を持つ
   */
  advice?: Record<string, string>
}

export type DeepCategoryData = {
  id: DeepCategoryId
  label: string
  /** 3 問 */
  questions: DeepQuestion[]
  /** カード number (0..21) → カードごとのテキスト */
  base: Record<number, DeepCardEntry>
}
