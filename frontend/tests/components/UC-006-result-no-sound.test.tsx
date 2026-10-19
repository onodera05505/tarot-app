// @vitest-environment jsdom
// UC-006 の要件の文（REQ-116）と BR-003・用語集だけから設計した、効果音を鳴らせない端末での占い結果の表示のテスト
// （実装は参照していない）。準備と問い合わせ方は UC-006-result-reveal.test.tsx / ResultPage.test.tsx に倣う。
// ほかのテストと違い、効果音の仕組みを差し替えない: 実行環境（jsdom）に音の仕組み（Web Audio）が無いことを
// 「端末が効果音を鳴らせない」として使い、鳴らそうとして壊れない（捕まえていない例外や拒否が出ない）ことを見る。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

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

/** 捕まえられずに外へ出た例外と拒否（画面の error イベント、プロセスの unhandledRejection / uncaughtException） */
let uncaught: unknown[]

function onWindowError(event: ErrorEvent) {
  uncaught.push(event.error ?? event.message)
}
function onProcessError(reason: unknown) {
  uncaught.push(reason)
}

type AudioWindow = Window & { AudioContext?: unknown; webkitAudioContext?: unknown }
const audioWindow = window as AudioWindow
const savedAudio = {
  AudioContext: Object.getOwnPropertyDescriptor(audioWindow, 'AudioContext'),
  webkitAudioContext: Object.getOwnPropertyDescriptor(audioWindow, 'webkitAudioContext'),
}

/** 端末が効果音を鳴らせない状態にする（音の仕組みを無くす） */
function removeAudioCapability() {
  Object.defineProperty(audioWindow, 'AudioContext', { configurable: true, writable: true, value: undefined })
  Object.defineProperty(audioWindow, 'webkitAudioContext', { configurable: true, writable: true, value: undefined })
}

function restoreAudioCapability() {
  for (const key of ['AudioContext', 'webkitAudioContext'] as const) {
    const descriptor = savedAudio[key]
    if (descriptor) Object.defineProperty(audioWindow, key, descriptor)
    else delete audioWindow[key]
  }
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.setState({ drawn: null, status: 'idle', error: null, deep: null })
  uncaught = []
  removeAudioCapability()
  window.addEventListener('error', onWindowError)
  process.on('unhandledRejection', onProcessError)
  process.on('uncaughtException', onProcessError)
})

afterEach(() => {
  cleanup()
  window.removeEventListener('error', onWindowError)
  process.off('unhandledRejection', onProcessError)
  process.off('uncaughtException', onProcessError)
  restoreAudioCapability()
})

// UC-006
describe('占い結果: 端末が効果音を鳴らせないとき', () => {
  const cases = [
    { orientation: 'upright', label: '正位置', card: tarotCards[12] },
    { orientation: 'reversed', label: '逆位置', card: tarotCards[19] },
  ] as const

  // @covers REQ-116#no-sound-still-shows-result
  it.each(cases)('$label: 音の仕組みが無くても、捕まえていない例外を出さずに、カードの表・カード名・正逆・キーワード・解説文が示される', async ({ orientation, label, card }) => {
    expect(audioWindow.AudioContext).toBeUndefined()
    const drawn = drawnOf(card, orientation)
    useReadingStore.setState({ status: 'drawn', drawn, error: null, deep: null })
    mountResult()

    expect(await screen.findByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
    const description = orientation === 'upright' ? card.descriptionUpright : card.descriptionReversed
    await waitFor(() => {
      expect(document.body.textContent).toContain(description)
    })
    expect(document.body.textContent).toContain(label)
    for (const keyword of drawn.keywords) {
      expect(document.body.textContent).toContain(keyword)
    }
    expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)

    // めくり始め（効果音を鳴らそうとする時点）は表示の少しあとに来ることがあるので、めくり終えるまで待ってから見る
    await new Promise((resolve) => setTimeout(resolve, 2500))
    expect(uncaught.map((e) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)))).toEqual([])
    // 壊れずに占い結果を示したまま（トップへ移されていない）
    expect(screen.queryByText('HOME_STUB')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
    expect(useReadingStore.getState().status).toBe('drawn')
  }, 10000)
})
