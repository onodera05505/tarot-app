// @vitest-environment jsdom
// UC-005 の要件の文（REQ-108）と業務規則（BR-002）・用語集・UC-005 の表だけから設計した、
// 詳しく占うへの直接到達が占い状態を初期化することのテスト（実装は参照していない）。
// 準備と問い合わせ方は UC-005-entry-and-ritual.test.tsx に倣う。
// 初期化後の値の SSOT は `reset` が戻す初期値（BR-002）なので、期待値は reset 直後の値から取る。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { useReadingStore } from '../../src/store/useReadingStore'
import { deepCategories, loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'
import type { DrawnCard } from '../../src/lib/types'

// 機能フラグを有効化（無料版の既定は無効。vi.mock は import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

/** 前の回の占い結果 */
const previousDrawn: DrawnCard = {
  card: tarotCards[3],
  orientation: 'reversed',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 前の回に儀式へ持ち込んだカテゴリとすべての質問の回答 */
async function carriedDeep() {
  const work = await loadDeepCategory('work')
  return {
    categoryId: 'work' as const,
    categoryLabel: work.label,
    answers: work.questions.map((q) => q.choices[1].id),
  }
}

type Leftover = Pick<ReturnType<typeof useReadingStore.getState>, 'status' | 'drawn' | 'error' | 'deep'>

/** 占い状態のうち、初期化の対象になる値 */
function pick(): Leftover {
  const { status, drawn, error, deep } = useReadingStore.getState()
  return { status, drawn, error, deep }
}

/**
 * 直接到達の前に残っている前の回の名残。UC-005 の表で REQ-108 が当たる行のうち、
 * 名残を持ちうるもの（儀式中・儀式の外・占い結果）を占い状態 × 持ち込みの有無の組で代表させる
 */
const leftovers = [
  {
    name: '占い結果（drawn）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'drawn', drawn: previousDrawn, error: null, deep: await carriedDeep() }),
  },
  {
    name: '占い結果（drawn）・通常占い',
    state: async (): Promise<Leftover> => ({ status: 'drawn', drawn: previousDrawn, error: null, deep: null }),
  },
  {
    name: '占い結果（error）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'error', drawn: null, error: 'テスト専用の抽選失敗', deep: await carriedDeep() }),
  },
  {
    name: '抽選の途中（drawing）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'drawing', drawn: null, error: null, deep: await carriedDeep() }),
  },
  {
    name: '儀式中・儀式の外（idle）・持ち込んでいる',
    state: async (): Promise<Leftover> => ({ status: 'idle', drawn: null, error: null, deep: await carriedDeep() }),
  },
]

function mountApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** 入口・カテゴリは button / link のどちらの role でも拾う */
function queryControl(name: string): HTMLElement | null {
  return (
    screen.queryByRole('button', { name }) ??
    screen.queryByRole('link', { name })
  )
}

/** 初期化後の値（BR-002 の SSOT: reset が戻す初期値） */
let initial: Leftover

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
  initial = pick()
})

afterEach(() => {
  cleanup()
})

// UC-005
describe('詳しく占う: トップの入口を経ない直接到達は占い状態を初期化する', () => {
  // @covers REQ-108#discard-previous
  it.each(leftovers)('$name の名残があっても、直接到達した時点で占い状態が idle になり、前の占い結果も持ち込んだカテゴリと回答も引き継がない', async ({ state }) => {
    useReadingStore.setState(await state())
    mountApp('/deep')
    for (const category of deepCategories) {
      await waitFor(() => {
        expect(queryControl(category.label)).not.toBeNull()
      })
    }

    expect(pick()).toEqual(initial)
    expect(pick().status).toBe('idle')
    expect(pick().deep).toBeNull()
    expect(pick().drawn).toBeNull()
  })
})
