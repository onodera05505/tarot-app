// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodaysCard } from '../../src/components/TodaysCard'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

const STORAGE_KEY = 'tarot:todaysCard'

function mount() {
  return render(
    <MemoryRouter>
      <TodaysCard />
    </MemoryRouter>,
  )
}

async function openTodaysCard() {
  fireEvent.click(screen.getByRole('button'))
  // drawCards の delay(0) を流す
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T10:00:00'))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('本日の一枚（仕様書 v3 §5.2 / §4.3 日付境界）', () => {
  it('未開封時は裏向き表示と「タップして開く」を出す', () => {
    mount()
    expect(screen.getByText('本日の一枚')).toBeTruthy()
    expect(screen.getByText('タップして開く')).toBeTruthy()
  })

  it('タップで 1 枚確定し、当日の日付キーでキャッシュされる', async () => {
    mount()
    await openTodaysCard()
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const cached = JSON.parse(raw!) as {
      date: string
      drawn: { card: { nameJa: string }; orientation: string }
    }
    expect(cached.date).toBe('2026-08-21')
    expect(cached.drawn.card.nameJa).toBeTruthy()
    expect(['upright', 'reversed']).toContain(cached.drawn.orientation)
  })

  it('同日の再マウントではキャッシュ済みカードを開封済みで表示する（引き直さない）', async () => {
    mount()
    await openTodaysCard()
    const first = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    cleanup()

    mount()
    // 開封済み表示: 「タップして開く」は出ず、カード名と正逆が出る
    expect(screen.queryByText('タップして開く')).toBeNull()
    expect(screen.getByText(first.drawn.card.nameJa)).toBeTruthy()
    expect(
      screen.getByText(first.drawn.orientation === 'upright' ? '正位置' : '逆位置'),
    ).toBeTruthy()
    // キャッシュは引き直されていない
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(first)
  })

  it('日付が変わると未開封に戻る（前日キャッシュは無効）', async () => {
    mount()
    await openTodaysCard()
    cleanup()

    vi.setSystemTime(new Date('2026-08-22T00:00:01'))
    mount()
    expect(screen.getByText('タップして開く')).toBeTruthy()
  })
})
