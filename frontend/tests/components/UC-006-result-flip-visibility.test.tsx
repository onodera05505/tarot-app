// @vitest-environment jsdom
// UC-006 の要件の文（REQ-117）だけから設計した、現在の振る舞いの固定（実装は参照していない）。
// 準備と問い合わせ方は ResultPage.test.tsx に倣う。
// 「見える」は、その文字を含む要素とその祖先のどれも、透明（opacity 0）・非表示（visibility / display / hidden）で
// ないこととして判定する。テストの設定は演出を即時に終わらせるので、めくり終えたあとの側だけを観測する。
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'

// jsdom に Web Audio が無いため効果音はモック
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

/** その文字を含む要素のうち、最も内側のもの（無ければ null） */
function innermostContaining(text: string): HTMLElement | null {
  let found: HTMLElement | null = null
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (el.textContent?.includes(text)) found = el
  }
  return found
}

/** その文字が画面にあり、透明でも非表示でもないか */
function isVisibleText(text: string): boolean {
  const target = innermostContaining(text)
  if (!target) return false
  for (let el: HTMLElement | null = target; el; el = el.parentElement) {
    if (el.hidden) return false
    if (el.style.opacity !== '' && Number(el.style.opacity) === 0) return false
    if (el.style.visibility === 'hidden' || el.style.display === 'none') return false
  }
  return true
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.setState({ drawn: null, status: 'idle', error: null, deep: null })
})

afterEach(() => {
  cleanup()
})

// UC-006
describe('占い結果: めくり終えたあとに見えるもの', () => {
  const cases = [
    { orientation: 'upright', word: '正位置' },
    { orientation: 'reversed', word: '逆位置' },
  ] as const

  // @covers REQ-117#visible-after-flip
  it.each(cases)('$word の占い結果で、めくり終えたあとはカード名・正逆・キーワード・解説文がどれも見える', async ({ orientation, word }) => {
    const card = tarotCards[12]
    const keywords = ['テスト専用キーワード甲', 'テスト専用キーワード乙']
    useReadingStore.setState({ status: 'drawn', drawn: { card, orientation, keywords }, error: null, deep: null })
    mountResult()

    const description = orientation === 'upright' ? card.descriptionUpright : card.descriptionReversed
    await waitFor(
      () => {
        expect(isVisibleText(card.nameJa)).toBe(true)
        expect(isVisibleText(word)).toBe(true)
        for (const keyword of keywords) {
          expect(isVisibleText(keyword)).toBe(true)
        }
        expect(isVisibleText(description)).toBe(true)
      },
      { timeout: 4000 },
    )
  })
})
