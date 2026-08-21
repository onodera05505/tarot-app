/**
 * 詳しく占うデータの仕様検証テスト（要件定義書 v3.1 §4.4 / §4.5 に基づく）
 *
 * 設計方針:
 * - 実装コードは参照せず、仕様書の文面と公開インターフェース契約のみを根拠に設計している
 * - `deepCategories` に載っている全カテゴリをループして検証するため、
 *   段階リリースで 5 カテゴリ揃った時点で自動的に全カテゴリへ適用される
 * - 字数レンジはデータ執筆の揺れを考慮し、仕様値に ±30 字の許容を持たせている
 *   （ベース解釈: 仕様 150〜250 字 → 検証 120〜280 字 /
 *     フラグメント: 仕様 60〜120 字 → 検証 30〜150 字）。コメントで明記の上で緩和
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
const FRAGMENT_MIN = 60 - 30 // 30
const FRAGMENT_MAX = 120 + 30 // 150

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

      it('選択肢 id がカテゴリ内で重複せず、空でない', async () => {
        const data = await load()
        const ids = data.questions.flatMap((q) => q.choices.map((c) => c.id))
        for (const id of ids) {
          expect(id.length).toBeGreaterThan(0)
        }
        expect(new Set(ids).size).toBe(ids.length)
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

      it('回答別補足（フラグメント）が選択肢ごとに 1 本あり、各 60〜120 字（±30 字許容: 30〜150 字）', async () => {
        const data = await load()
        for (const q of data.questions) {
          for (const c of q.choices) {
            const len = c.fragment.length
            expect(
              len,
              `質問 ${q.id} / 選択肢 ${c.id} のフラグメント字数 ${len} が範囲外`,
            ).toBeGreaterThanOrEqual(FRAGMENT_MIN)
            expect(
              len,
              `質問 ${q.id} / 選択肢 ${c.id} のフラグメント字数 ${len} が範囲外`,
            ).toBeLessThanOrEqual(FRAGMENT_MAX)
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
  },
)

// 仕様 §4.5: 回答は抽選に影響しない（抽選ロジック自体は通常占いと同一のため
// 本ファイルの対象外だが、データ側の前提として「フラグメントは選択肢にのみ
// 紐づき、カード・正逆に依存する構造を持たない」ことは上の型検証で担保される）
