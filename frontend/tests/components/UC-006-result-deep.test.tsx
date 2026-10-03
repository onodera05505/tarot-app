// @vitest-environment jsdom
// UC-006 の要件の文（REQ-065）と業務規則 BR-003、UC-005 の表（占い結果・占い状態: drawn（持ち込んでいる）× 占い結果を開く）
// だけから設計した、現在の振る舞いの固定（実装は参照していない）。準備と問い合わせ方は DeepFlow.test.tsx、
// 絵の向きの判定は UC-006-result-reveal.test.tsx（逆位置の画像は 180° 回して示す）に倣う。
// 期待値は公開データ（loadDeepCategory / tarotCards）から実行時に導出する。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'
import type { Orientation } from '../../src/lib/types'

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

const TEST_KEYWORDS = ['テスト専用キーワード甲', 'テスト専用キーワード乙']

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** カテゴリとすべての回答を持ち込んだ占い結果を作り、カテゴリの文章（ベース解釈）が示されるまで待つ */
async function showDeepResult(orientation: Orientation) {
  const love = await loadDeepCategory('love')
  const card = tarotCards[9]
  useReadingStore.setState({
    status: 'drawn',
    error: null,
    drawn: { card, orientation, keywords: TEST_KEYWORDS },
    deep: {
      categoryId: 'love',
      categoryLabel: love.label,
      answers: love.questions.map((q) => q.choices[0].id),
    },
  })
  mountResult()
  await waitFor(() => {
    expect(document.body.textContent).toContain(love.base[card.number][orientation])
  })
  return { card }
}

/** カードの表の画像のうち、上下逆さ（180° 回転）で示されているものの数 */
function invertedFaceCount(nameJa: string): number {
  return screen
    .getAllByAltText(nameJa)
    .filter((img) => (img as HTMLElement).style.transform.replace(/\s/g, '').includes('rotate(180deg)')).length
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.setState({ drawn: null, status: 'idle', error: null, deep: null })
})

afterEach(() => {
  cleanup()
})

// UC-006
describe('占い結果: 詳しく占うの占い結果でもカードの表・カード名・正逆・キーワードを示す', () => {
  const cases = [
    { orientation: 'upright', word: '正位置' },
    { orientation: 'reversed', word: '逆位置' },
  ] as const

  // @covers REQ-065#deep-card-name-orientation-keywords
  it.each(cases)('カテゴリの文章を示している$wordの占い結果で、カードの表・カード名・「$word」・キーワードが示される', async ({ orientation, word }) => {
    const { card } = await showDeepResult(orientation)

    expect(screen.getByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
    expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    expect(document.body.textContent).toContain(word)
    for (const keyword of TEST_KEYWORDS) {
      expect(document.body.textContent).toContain(keyword)
    }
  })
})

// UC-006
describe('占い結果: 詳しく占うの占い結果のカードの表の絵の向き（BR-003）', () => {
  // @covers REQ-065#deep-reversed-image-inverted
  it('逆位置の詳しく占うの占い結果では、カードの表を上下逆さに示す', async () => {
    const { card } = await showDeepResult('reversed')

    const faces = screen.getAllByAltText(card.nameJa)
    expect(faces.length).toBeGreaterThanOrEqual(1)
    expect(invertedFaceCount(card.nameJa)).toBe(faces.length)
  })

  // @covers REQ-065#deep-reversed-image-inverted
  it('正位置の詳しく占うの占い結果では、カードの表を正しい向きで示す', async () => {
    const { card } = await showDeepResult('upright')

    expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    expect(invertedFaceCount(card.nameJa)).toBe(0)
  })
})
