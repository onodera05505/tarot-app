// @vitest-environment jsdom
// UC-003 の要件の文（REQ-127。REQ-023・REQ-024 と矛盾しない側を含む）、用語集（本日の一枚: 未開封 / 開封済み、
// 本日の一枚を選ぶ）、契約（loadCached / saveCached と TodaysCardRecord）だけから設計（実装は参照していない）。
// 準備と問い合わせのやり方は TodaysCard.test.tsx に倣う。
//
// 仮定（仕様に無いため置いたもの）
//   H1: 「アプリを前面に戻す」は、文書が隠れた後に見えるようになること（document.visibilityState が hidden → visible に
//       変わり、そのたびに visibilitychange が発火する）として届く
//   H2: 未開封は「タップして開く」（用語集）の表示で、開封済みはカード名と正逆（「正位置」「逆位置」）の表示で見分ける
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodaysCard } from '../../src/components/TodaysCard'
import type { DrawnCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

const STORAGE_KEY = 'tarot:todaysCard'
const OPENED_DAY = '2026-08-21'
const UNOPENED_LABEL = 'タップして開く'

type TodaysCardRecord = { date: string; drawn: DrawnCard }

/** 開封した日より後の日に前面に戻す時刻（境界の翌日 0 時台と、数日後） */
const LATER_DAYS: [string, Date][] = [
  ['翌日の 0 時台（境界）', new Date('2026-08-22T00:00:01')],
  ['数日後', new Date('2026-08-25T09:30:00')],
]
/** 開封した日と同じ日のうちに前面に戻す時刻（直後と、同じ日の終わり） */
const SAME_DAY_MOMENTS: [string, Date][] = [
  ['直後', new Date(`${OPENED_DAY}T10:00:05`)],
  ['同じ日の終わり（23 時台）', new Date(`${OPENED_DAY}T23:59:59`)],
]

function mount() {
  return render(
    <MemoryRouter>
      <TodaysCard />
    </MemoryRouter>,
  )
}

async function openTodaysCard(): Promise<TodaysCardRecord> {
  fireEvent.click(screen.getByRole('button'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50)
  })
  return readRecord()!
}

function readRecord(): TodaysCardRecord | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as TodaysCardRecord)
}

function orientationLabel(record: TodaysCardRecord): string {
  return record.drawn.orientation === 'upright' ? '正位置' : '逆位置'
}

/** 仮定 H1: 端末の文書の見え方を切り替える */
function setDocumentVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}

/** アプリを背面へやり、端末の時計を進めてから、前面に戻す */
async function bringToForegroundAt(when: Date) {
  await act(async () => {
    setDocumentVisibility('hidden')
  })
  vi.setSystemTime(when)
  await act(async () => {
    setDocumentVisibility('visible')
    await vi.advanceTimersByTimeAsync(50)
  })
}

function expectOpenedShown(record: TodaysCardRecord) {
  expect(screen.queryByText(UNOPENED_LABEL)).toBeNull()
  expect(screen.getByText(record.drawn.card.nameJa)).toBeTruthy()
  expect(screen.getByText(orientationLabel(record))).toBeTruthy()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${OPENED_DAY}T10:00:00`))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete (document as { visibilityState?: unknown }).visibilityState
  delete (document as { hidden?: unknown }).hidden
})

// UC-003
describe('本日の一枚: 示したまま日付が変わりアプリを前面に戻す（UC-003）', () => {
  // @covers REQ-127#foreground-after-day-change
  it.each(LATER_DAYS)('開封済みを示したまま日付が %s に変わって前面に戻すと、前の日の開封を引き継がず未開封として示す', async (_label, when) => {
    mount()
    const opened = await openTodaysCard()
    expectOpenedShown(opened)

    await bringToForegroundAt(when)

    // 仮定 H2: 未開封として示される
    expect(screen.getByText(UNOPENED_LABEL)).toBeTruthy()
    expect(screen.queryByText(opened.drawn.card.nameJa)).toBeNull()
    expect(screen.queryByText(orientationLabel(opened))).toBeNull()
    // 前面に戻しただけでは、新しい日の開封は記録されない（抽選をやり直していない）
    const record = readRecord()
    expect(record === null || record.date === OPENED_DAY).toBe(true)
  })

  // @covers REQ-127#foreground-after-day-change
  it('日付が変わって前面に戻した後に本日の一枚を選ぶと、その新しい日の開封として記録される', async () => {
    mount()
    const opened = await openTodaysCard()
    const nextDay = '2026-08-22'

    await bringToForegroundAt(new Date(`${nextDay}T07:00:00`))
    expect(screen.getByText(UNOPENED_LABEL)).toBeTruthy()
    const reopened = await openTodaysCard()

    expect(reopened.date).toBe(nextDay)
    expect(reopened.date).not.toBe(opened.date)
    expectOpenedShown(reopened)
  })

  // @covers REQ-127#same-day-foreground-keeps-opened
  it.each(SAME_DAY_MOMENTS)('同じ日の %s に前面に戻しても、開封済みのカード・カード名・正逆がそのまま示され、記録も変わらない', async (_label, when) => {
    mount()
    const opened = await openTodaysCard()

    await bringToForegroundAt(when)

    expectOpenedShown(opened)
    expect(readRecord()).toEqual(opened)
  })
})
