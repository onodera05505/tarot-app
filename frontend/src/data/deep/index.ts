// 詳しく占うデータの公開インターフェース（仕様書 v3.1 §4.4）。
// カテゴリ本体は初回ロードに含めず、選択後に動的 import する。

import { deepCategoryLoaders, deepCategories } from './registry'
import type { DeepCategoryData, DeepCategoryId } from './types'

export type {
  DeepCategoryData,
  DeepCategoryId,
  DeepChoice,
  DeepQuestion,
} from './types'

export { deepCategories }

export async function loadDeepCategory(
  id: DeepCategoryId,
): Promise<DeepCategoryData> {
  const loader = deepCategoryLoaders[id]
  if (!loader) {
    throw new Error(`Unknown deep category: ${id}`)
  }
  const mod = await loader()
  return mod.deepCategory
}
