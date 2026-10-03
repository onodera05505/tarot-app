// @vitest-environment jsdom
// UC-003 の要件の文（REQ-023・REQ-104・REQ-124）、業務規則 BR-003、用語集、契約（loadCached / saveCached と
// TodaysCardRecord）だけから設計（実装は参照していない）。
// 準備と問い合わせのやり方は TodaysCard.test.tsx に倣う。
//
// 仮定（仕様に無いため置いたもの）
//   F1: 開封済みで示すカードの絵は alt = カード名の画像
//   F2: 上下逆さの絵は、その絵か祖先の要素のインラインの `transform: rotate(180deg)` で表される
//   F3: 別のタブでの開封は、同じ localStorage のキーへ契約の形（TodaysCardRecord）の記録が書かれることとして届く
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodaysCard } from '../../src/components/TodaysCard'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

const STORAGE_KEY = 'tarot:todaysCard'
const TODAY = '2026-08-21'
/** 別のタブが書いた記録を、このタブの抽選の結果と取り違えないための印 */
const OTHER_TAB_MARK = '別のタブの印'

function mount() {
  return render(
    <MemoryRouter>
      <TodaysCard />
    </MemoryRouter>,
  )
}

async function openTodaysCard() {
  fireEvent.click(screen.getByRole('button'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50)
  })
}

function keywordsOf(card: TarotCard, orientation: Orientation): string[] {
  const source = orientation === 'upright' ? card.meaningUpright : card.meaningReversed
  return source
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

/** 契約の TodaysCardRecord の形で、その日の開封を端末に置く */
function writeRecord(card: TarotCard, orientation: Orientation, keywords = keywordsOf(card, orientation)) {
  const drawn: DrawnCard = { card, orientation, keywords }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: TODAY, drawn }))
}

function readRecord(): { date: string; drawn: DrawnCard } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { date: string; drawn: DrawnCard }
}

/** 仮定 F2 */
function isUpsideDown(img: HTMLElement): boolean {
  for (let el: HTMLElement | null = img; el; el = el.parentElement) {
    if (el.style.transform.replace(/\s/g, '').includes('rotate(180deg)')) return true
  }
  return false
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// UC-003
describe('本日の一枚: 開封済みの絵の向き（UC-003 / BR-003）', () => {
  // @covers REQ-023#image-orientation
  it('逆位置で開封済みの本日の一枚を示し直すと、カードの絵が上下逆さに示される', () => {
    const card = tarotCards[11]
    writeRecord(card, 'reversed')

    mount()

    expect(screen.getByText(card.nameJa)).toBeTruthy()
    // 仮定 F1・F2
    const images = screen.getAllByAltText(card.nameJa)
    expect(images.length).toBeGreaterThanOrEqual(1)
    expect(images.every(isUpsideDown)).toBe(true)
  })

  // @covers REQ-023#image-orientation
  it('正位置で開封済みの本日の一枚を示し直すと、カードの絵が正しい向きで示される', () => {
    const card = tarotCards[11]
    writeRecord(card, 'upright')

    mount()

    expect(screen.getByText(card.nameJa)).toBeTruthy()
    const images = screen.getAllByAltText(card.nameJa)
    expect(images.length).toBeGreaterThanOrEqual(1)
    expect(images.some(isUpsideDown)).toBe(false)
  })
})

// UC-003
describe('本日の一枚: 別のタブで同じ日に開封される（UC-003）', () => {
  // @covers REQ-104#this-tab-records-later
  it('別のタブが先に開封した後に、未開封で示していたこのタブで開封すると、このタブの開封がその日の開封として残る', async () => {
    mount()
    expect(screen.getByText('タップして開く')).toBeTruthy()
    // 仮定 F3: このタブが未開封を示している間に、別のタブが開封する
    writeRecord(tarotCards[2], 'upright', [OTHER_TAB_MARK])

    await openTodaysCard()

    const record = readRecord()
    expect(record.date).toBe(TODAY)
    expect(record.drawn.keywords).not.toContain(OTHER_TAB_MARK)
    cleanup()

    // 示し直すと、後から記録されたこのタブの開封が示される
    mount()
    expect(screen.queryByText('タップして開く')).toBeNull()
    expect(screen.getByText(record.drawn.card.nameJa)).toBeTruthy()
    expect(screen.getByText(record.drawn.orientation === 'upright' ? '正位置' : '逆位置')).toBeTruthy()
    expect(readRecord()).toEqual(record)
  })

  // @covers REQ-104#other-tab-records-later
  it('このタブで開封した後に別のタブが開封すると、示し直したときに別のタブの開封がその日の開封として示される', async () => {
    mount()
    await openTodaysCard()
    const mine = readRecord()
    cleanup()

    // 仮定 F3: このタブの開封とは違うカード・違う正逆を、別のタブが後から記録する
    const other = tarotCards.find((c) => c.id !== mine.drawn.card.id)!
    const otherOrientation: Orientation = mine.drawn.orientation === 'upright' ? 'reversed' : 'upright'
    writeRecord(other, otherOrientation, [OTHER_TAB_MARK])
    const fromOtherTab = readRecord()

    mount()

    expect(screen.queryByText('タップして開く')).toBeNull()
    expect(screen.getByText(other.nameJa)).toBeTruthy()
    expect(screen.getByText(otherOrientation === 'upright' ? '正位置' : '逆位置')).toBeTruthy()
    expect(screen.queryByText(mine.drawn.card.nameJa)).toBeNull()
    // 示し直しただけでは、その日の開封は書き換わらない
    expect(readRecord()).toEqual(fromOtherTab)
  })
})

// UC-003
describe('本日の一枚: 抽選が終わるまでの間（UC-003）', () => {
  // @covers REQ-124#loading-while-drawing
  it('未開封の本日の一枚を選んでから抽選が終わるまでの間、読み込み中であることが示される', () => {
    mount()

    fireEvent.click(screen.getByRole('button'))

    // 抽選を進めていない（タイマーを流していない）時点
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(document.body.textContent).toContain('読み込み中')
  })
})
