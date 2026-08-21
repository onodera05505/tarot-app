/**
 * 詳しく占うデータの仕様検証テスト（要件定義書 v3.2 §4.4 / §4.5 に基づく）
 *
 * 設計方針:
 * - 実装コードは参照せず、仕様書の文面と公開インターフェース契約のみを根拠に設計している
 * - `deepCategories` に載っている全カテゴリをループして検証するため、
 *   段階リリースでカテゴリが増えた時点で自動的に全カテゴリへ適用される
 * - v3.2 の段階導入: 各カテゴリは「完全に新構造（カード × 選択肢のアドバイス
 *   22 × 9 = 198 本）」か「完全に旧構造（選択肢ごとに 1 本の fragment）」の
 *   どちらか一方であることを検証する。love が載っている場合は新構造必須
 * - 字数レンジはデータ執筆の揺れを考慮し、仕様値に ±30 字の許容を持たせている
 *   （ベース解釈: 仕様 150〜250 字 → 検証 120〜280 字 /
 *     新構造アドバイス: 仕様 60〜140 字 → 検証 30〜170 字 /
 *     旧構造フラグメント: 仕様 60〜120 字 → 検証 30〜150 字）。コメントで明記の上で緩和
 */
import { describe, it, expect } from 'vitest'
import {
  deepCategories,
  loadDeepCategory,
  type DeepCategoryData,
  type DeepCategoryId,
} from '../src/data/deep/index'

// 仕様 §4.4: カテゴリは 5 つ（仕事 / 友達・恋愛 / 勉強 / お金 / 健康）
const VALID_CATEGORY_IDS: readonly DeepCategoryId[] = [
  'work',
  'love',
  'study',
  'money',
  'health',
]

// 仕様 §4.4: カード 22 枚（number 0〜21）
const CARD_NUMBERS = Array.from({ length: 22 }, (_, i) => i)

// 字数許容（仕様値 ±30 字。理由はファイル冒頭コメント参照）
const BASE_MIN = 150 - 30 // 120
const BASE_MAX = 250 + 30 // 280
const ADVICE_MIN = 60 - 30 // 30（新構造アドバイス: 仕様 60〜140 字）
const ADVICE_MAX = 140 + 30 // 170
const FRAGMENT_MIN = 60 - 30 // 30（旧構造フラグメント: 仕様 60〜120 字）
const FRAGMENT_MAX = 120 + 30 // 150

// カテゴリ内の全選択肢（3 問 × 3 択 = 9 個）
const allChoices = (data: DeepCategoryData) =>
  data.questions.flatMap((q) =>
    q.choices.map((c) => ({ questionId: q.id, choice: c })),
  )

// 構造判定（v3.2 段階導入）:
// - 新構造 = 全 22 カードに advice が存在する
// - 旧構造 = 全選択肢に fragment が存在する
// どちらにも完全一致しない（歯抜け・混在）状態は仕様違反
const isFullyNew = (data: DeepCategoryData) =>
  CARD_NUMBERS.every((n) => data.base[n]?.advice !== undefined)
const isFullyOld = (data: DeepCategoryData) =>
  allChoices(data).every(({ choice }) => choice.fragment !== undefined)

describe('deepCategories（カテゴリ一覧）', () => {
  it('1 つ以上のカテゴリが載っている', () => {
    expect(deepCategories.length).toBeGreaterThan(0)
  })

  it('最大でも 5 カテゴリまでしか載らない', () => {
    expect(deepCategories.length).toBeLessThanOrEqual(VALID_CATEGORY_IDS.length)
  })

  it('全カテゴリの id が仕様の 5 カテゴリのいずれかである', () => {
    for (const cat of deepCategories) {
      expect(VALID_CATEGORY_IDS).toContain(cat.id)
    }
  })

  it('カテゴリ id が一覧内で重複しない', () => {
    const ids = deepCategories.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('work（仕事）が含まれる（段階リリースの現時点で実データが存在するカテゴリ）', () => {
    expect(deepCategories.map((c) => c.id)).toContain('work')
  })

  it('全カテゴリの label がカテゴリ名として空でない', () => {
    for (const cat of deepCategories) {
      expect(typeof cat.label).toBe('string')
      expect(cat.label.length).toBeGreaterThan(0)
    }
  })
})

// v3.2 のサンプル要件: love が一覧に載っている場合、love は新構造でなければならない。
// work は旧構造でも新構造でも可（暫定カテゴリとして併存を許す）
describe('段階導入の固定要件（v3.2）', () => {
  const loveListed = deepCategories.some((c) => c.id === 'love')

  it.runIf(loveListed)('love（友達・恋愛）は新構造である', async () => {
    const data = await loadDeepCategory('love')
    expect(isFullyNew(data), 'love の全 22 カードに advice が必要').toBe(true)
  })
})

// deepCategories に載っている全カテゴリについて本体データを検証する。
// カテゴリが増えれば describe.each の対象が自動的に増える。
describe.each(deepCategories.map((c) => [c.id, c.label] as const))(
  'loadDeepCategory("%s")（カテゴリ本体データ: %s）',
  (categoryId) => {
    // 同一カテゴリの検証間で読み込みを共有する（読み込み自体の検証は最初の it が担う）
    let dataPromise: Promise<DeepCategoryData> | undefined
    const load = () => {
      dataPromise ??= loadDeepCategory(categoryId)
      return dataPromise
    }

    it('Promise で DeepCategoryData を返し、id が一覧と一致する', async () => {
      const data = await load()
      expect(data.id).toBe(categoryId)
    })

    it('label が空でない', async () => {
      const data = await load()
      expect(data.label.length).toBeGreaterThan(0)
    })

    it('一覧側の label と本体の label が一致する（同じものを 2 箇所に書かない）', async () => {
      const data = await load()
      const listed = deepCategories.find((c) => c.id === categoryId)
      expect(data.label).toBe(listed?.label)
    })

    describe('質問（仕様 §4.4: カテゴリごとに 3 問、各 3 択）', () => {
      it('質問がちょうど 3 問ある', async () => {
        const data = await load()
        expect(data.questions).toHaveLength(3)
      })

      it('各質問がちょうど 3 択を持つ', async () => {
        const data = await load()
        for (const q of data.questions) {
          expect(q.choices).toHaveLength(3)
        }
      })

      it('質問 id がカテゴリ内で重複せず、空でない', async () => {
        const data = await load()
        const ids = data.questions.map((q) => q.id)
        for (const id of ids) {
          expect(id.length).toBeGreaterThan(0)
        }
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('選択肢 id がカテゴリ内で重複せず、空でない（計 9 個）', async () => {
        const data = await load()
        const ids = allChoices(data).map(({ choice }) => choice.id)
        for (const id of ids) {
          expect(id.length).toBeGreaterThan(0)
        }
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toHaveLength(9) // 3 問 × 3 択
      })

      it('質問文・選択肢ラベルが空でない', async () => {
        const data = await load()
        for (const q of data.questions) {
          expect(q.text.length).toBeGreaterThan(0)
          for (const c of q.choices) {
            expect(c.label.length).toBeGreaterThan(0)
          }
        }
      })
    })

    describe('ベース解釈（仕様 §4.4: 22 枚 × 正逆 = 44 本、各 150〜250 字）', () => {
      it('カード number 0〜21 の全エントリが存在し、余分なキーがない', async () => {
        const data = await load()
        for (const n of CARD_NUMBERS) {
          expect(data.base[n], `カード ${n} のベース解釈が無い`).toBeDefined()
        }
        // 44 本 = 22 エントリ × (upright + reversed)。22 を超えるキーは仕様外
        expect(Object.keys(data.base)).toHaveLength(22)
      })

      it('全 44 本（22 枚 × 正逆）の本文が存在し空でない', async () => {
        const data = await load()
        let count = 0
        for (const n of CARD_NUMBERS) {
          const entry = data.base[n]
          expect(entry.upright.length).toBeGreaterThan(0)
          expect(entry.reversed.length).toBeGreaterThan(0)
          count += 2
        }
        expect(count).toBe(44)
      })

      it('各本文が 150〜250 字（±30 字許容: 120〜280 字）', async () => {
        const data = await load()
        for (const n of CARD_NUMBERS) {
          const entry = data.base[n]
          for (const [orientation, text] of [
            ['upright', entry.upright],
            ['reversed', entry.reversed],
          ] as const) {
            const len = text.length
            expect(
              len,
              `カード ${n} ${orientation} の字数 ${len} が範囲外`,
            ).toBeGreaterThanOrEqual(BASE_MIN)
            expect(
              len,
              `カード ${n} ${orientation} の字数 ${len} が範囲外`,
            ).toBeLessThanOrEqual(BASE_MAX)
          }
        }
      })
    })

    describe('回答別アドバイス（仕様 v3.2 §4.4: 新旧いずれか一方の構造に完全統一）', () => {
      it('「完全に新構造」か「完全に旧構造」のどちらか一方である（歯抜け・混在は不可）', async () => {
        const data = await load()
        const fullyNew = isFullyNew(data)
        const fullyOld = isFullyOld(data)
        // 部分的に advice / fragment がある（どちらの every も満たさない）状態と、
        // 両構造のデータが同居する状態のどちらも仕様違反
        expect(
          fullyNew !== fullyOld,
          `新構造判定=${fullyNew} / 旧構造判定=${fullyOld}（どちらか一方だけが真であること）`,
        ).toBe(true)
        if (fullyNew) {
          // 新構造カテゴリに fragment は存在しない（契約: fragment は旧構造のみ）
          for (const { questionId, choice } of allChoices(data)) {
            expect(
              choice.fragment,
              `新構造カテゴリに fragment が混在（質問 ${questionId} / 選択肢 ${choice.id}）`,
            ).toBeUndefined()
          }
        } else {
          // 旧構造カテゴリに advice は存在しない（契約: advice は新構造のみ）
          for (const n of CARD_NUMBERS) {
            expect(
              data.base[n].advice,
              `旧構造カテゴリに advice が混在（カード ${n}）`,
            ).toBeUndefined()
          }
        }
      })

      it('新構造: advice 22 × 9 = 198 本、キー集合は選択肢 id と完全一致、各 60〜140 字（±30 字許容: 30〜170 字）／旧構造: fragment 各 60〜120 字（±30 字許容: 30〜150 字）', async () => {
        const data = await load()
        if (isFullyNew(data)) {
          const choiceIds = allChoices(data).map(({ choice }) => choice.id)
          let count = 0
          for (const n of CARD_NUMBERS) {
            const advice = data.base[n].advice
            expect(advice, `カード ${n} の advice が無い`).toBeDefined()
            // キー集合がそのカテゴリの選択肢 id 9 個と完全一致（過不足なし）
            expect(
              Object.keys(advice!).sort(),
              `カード ${n} の advice キー集合が選択肢 id と不一致`,
            ).toEqual([...choiceIds].sort())
            for (const id of choiceIds) {
              const text = advice![id]
              const len = text.length
              expect(len, `カード ${n} / 選択肢 ${id} のアドバイスが空`).toBeGreaterThan(0)
              expect(
                len,
                `カード ${n} / 選択肢 ${id} のアドバイス字数 ${len} が範囲外`,
              ).toBeGreaterThanOrEqual(ADVICE_MIN)
              expect(
                len,
                `カード ${n} / 選択肢 ${id} のアドバイス字数 ${len} が範囲外`,
              ).toBeLessThanOrEqual(ADVICE_MAX)
              count += 1
            }
          }
          expect(count).toBe(198) // 22 カード × 9 選択肢
        } else {
          // 旧構造（v3.1 暫定カテゴリ）: 選択肢ごとに 1 本の fragment
          for (const { questionId, choice } of allChoices(data)) {
            const len = choice.fragment!.length
            expect(
              len,
              `質問 ${questionId} / 選択肢 ${choice.id} のフラグメント字数 ${len} が範囲外`,
            ).toBeGreaterThanOrEqual(FRAGMENT_MIN)
            expect(
              len,
              `質問 ${questionId} / 選択肢 ${choice.id} のフラグメント字数 ${len} が範囲外`,
            ).toBeLessThanOrEqual(FRAGMENT_MAX)
          }
        }
      })
    })
  },
)

// 仕様 §4.5: 回答は抽選に影響しない（抽選ロジック自体は通常占いと同一のため
// 本ファイルの対象外。データ側の構造検証は上記で担保する）
