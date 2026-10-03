// @vitest-environment jsdom
// UC-006 の要件の文（REQ-065・115）と BR-003 だけから設計した、現在の振る舞いの固定
// （実装は参照していない）。準備と問い合わせ方は ResultPage.test.tsx、絵の向きの判定は
// CardDetailPage.test.tsx（逆位置の画像は 180° 回して示す）に倣う。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import { playFlip } from '../../src/lib/audio'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック（鳴らしたことだけを観測する）
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="/" element={<div>HOME_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function drawnOf(card: TarotCard, orientation: Orientation): DrawnCard {
  return { card, orientation, keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'] }
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
  vi.mocked(playFlip).mockClear()
})

afterEach(() => {
  cleanup()
})

// UC-006
describe('占い結果: カードの表の絵の向き（BR-003）', () => {
  // @covers REQ-065#reversed-image-inverted
  it('逆位置の占い結果では、カードの表を上下逆さに示す', async () => {
    const card = tarotCards[9]
    useReadingStore.setState({ status: 'drawn', drawn: drawnOf(card, 'reversed'), error: null, deep: null })
    mountResult()

    await screen.findByRole('heading', { level: 2, name: card.nameJa })
    const faces = screen.getAllByAltText(card.nameJa)
    expect(invertedFaceCount(card.nameJa)).toBe(faces.length)
  })

  // @covers REQ-065#reversed-image-inverted
  it('正位置の占い結果では、カードの表を正しい向きで示す', async () => {
    const card = tarotCards[9]
    useReadingStore.setState({ status: 'drawn', drawn: drawnOf(card, 'upright'), error: null, deep: null })
    mountResult()

    await screen.findByRole('heading', { level: 2, name: card.nameJa })
    expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    expect(invertedFaceCount(card.nameJa)).toBe(0)
  })
})

// UC-006
describe('占い結果: カードをめくるときの効果音', () => {
  // @covers REQ-115#flip-sound-on-drawn
  it('占い状態が drawn の占い結果を示すと、効果音を 1 回鳴らす', async () => {
    const card = tarotCards[11]
    useReadingStore.setState({ status: 'drawn', drawn: drawnOf(card, 'upright'), error: null, deep: null })
    mountResult()

    await screen.findByRole('heading', { level: 2, name: card.nameJa })
    // めくり始めは表示の少しあとに来ることがあるので、鳴るまで待つ
    await waitFor(
      () => {
        expect(playFlip).toHaveBeenCalled()
      },
      { timeout: 4000 },
    )
    // めくり終えるまで待っても、鳴らすのは 1 回だけ
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(playFlip).toHaveBeenCalledTimes(1)
  })
})
