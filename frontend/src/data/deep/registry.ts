// このファイルは scripts/gen-deep.mjs による自動生成。直接編集しない。
// 編集は data/deep/*.md を変更して `pnpm gen:deep` を実行する。
import type { DeepCategoryData, DeepCategoryId } from './types'

export const deepCategories: ReadonlyArray<{ id: DeepCategoryId; label: string }> = [
  {
    "id": "work",
    "label": "仕事"
  }
]

export const deepCategoryLoaders: Partial<Record<DeepCategoryId, () => Promise<{ deepCategory: DeepCategoryData }>>> = {
  work: () => import('./work'),
}
