// @vitest-environment jsdom
// 無料版リリース構成（要件定義書 v3.3 §3.3 / §5.1 / §5.2）のコンポーネントテスト。
// 仕様文面と公開契約のみを根拠に設計している（実装コードは参照していない）。
// このファイルは機能フラグ DEEP_READING_ENABLED が「既定値（false）」のときの挙動を検証する。
// フラグ有効時の挙動は FreeRelease.enabled.test.tsx（vi.mock はファイル単位のため分離）。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { TopPage } from '../../src/pages/TopPage'
import { DEEP_READING_ENABLED } from '../../src/lib/features'
import { useReadingStore } from '../../src/store/useReadingStore'
import { loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

/** §3.3「準備中」等の予告表示をしない — 予告とみなす文言 */
const TEASER_PATTERNS = [/準備中/, /近日/, /coming soon/i, /開放予定/, /有料/]

function mountTop() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <TopPage />
    </MemoryRouter>,
  )
}

function mountApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** §5.2 のボタン。button / link のどちらの role で実装されていても拾う */
function queryControl(name: string): HTMLElement | null {
  return (
    screen.queryByRole('button', { name }) ??
    screen.queryByRole('link', { name })
  )
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

// UC-005
describe('機能フラグ（§3.3「切り替えは 1 箇所の機能フラグで行う」）', () => {
  // 仕様外: 出荷時の構成値（無料版で出す）の固定。無料版の振る舞いは REQ-035〜037 のテストが観測する
  it('DEEP_READING_ENABLED の既定値は false（無料版）', () => {
    expect(DEEP_READING_ENABLED).toBe(false)
  })
})

// UC-005
describe('無料版のトップ画面（§3.3 / §5.2）', () => {
  // @covers REQ-098#three-entries
  it('「スタート」「カード解説を見る」「占い履歴を見る」の 3 ボタンがある', async () => {
    mountTop()
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    expect(queryControl('カード解説を見る')).not.toBeNull()
    expect(queryControl('占い履歴を見る')).not.toBeNull()
  })

  // @covers REQ-035#no-entry-on-top
  it('「詳しく占う」ボタンを出さない（文言自体も画面に出さない＝完全に非表示）', async () => {
    mountTop()
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    expect(queryControl('詳しく占う')).toBeNull()
    expect(screen.queryByText(/詳しく占う/)).toBeNull()
    expect(document.body.textContent).not.toContain('詳しく占う')
  })

  // @covers REQ-035#no-teaser-on-top
  it('「準備中」等の予告表示をしない', async () => {
    mountTop()
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    const text = document.body.textContent ?? ''
    for (const pattern of TEASER_PATTERNS) {
      expect(text).not.toMatch(pattern)
    }
  })
})

// UC-005
describe('無料版のルーティング（§3.3 / §5.1）', () => {
  // @covers REQ-036#redirect-to-top
  it('/deep に直接到達すると / へリダイレクトされ、トップ画面の内容が出る', async () => {
    mountApp('/deep')
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    // トップ画面の他ボタンも揃っている
    expect(queryControl('カード解説を見る')).not.toBeNull()
    expect(queryControl('占い履歴を見る')).not.toBeNull()
    // 「詳しく占う」のカテゴリ選択（§5.7 の初期表示）は出ない
    expect(queryControl('仕事')).toBeNull()
    expect(queryControl('友達・恋愛')).toBeNull()
    expect(document.body.textContent).not.toContain('詳しく占う')
  })

  // @covers REQ-035#no-teaser-on-top
  it('/deep へのリダイレクト先でも「準備中」等の予告表示をしない', async () => {
    mountApp('/deep')
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    const text = document.body.textContent ?? ''
    for (const pattern of TEASER_PATTERNS) {
      expect(text).not.toMatch(pattern)
    }
  })

  // @covers REQ-099#unknown-path
  it('未知のパス（*）は / へリダイレクトされる', async () => {
    mountApp('/no-such-route')
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
  })

  // @covers REQ-035#no-entry-on-top
  it('/ ではトップ画面が出て「詳しく占う」ボタンが無い（App 経由でも同じ）', async () => {
    mountApp('/')
    await waitFor(() => {
      expect(queryControl('スタート')).not.toBeNull()
    })
    expect(queryControl('詳しく占う')).toBeNull()
  })
})

// UC-005
describe('無料版の結果画面（§3.3「結果画面は常に通常占いの表示になる」）', () => {
  // @covers REQ-037#normal-result-despite-deep-context
  it('store に deep の文脈が残っていても、通常の解説文を表示しカテゴリ特化の表示はしない', async () => {
    const work = await loadDeepCategory('work')
    const card = tarotCards.find((c) => work.base[c.number] !== undefined) ?? tarotCards[0]

    useReadingStore.setState({
      // §5.4: status が idle のままだと ResultPage は / へリダイレクトする
      status: 'drawn',
      drawn: {
        card,
        orientation: 'upright',
        keywords: ['キーワードA', 'キーワードB'],
      },
      deep: {
        categoryId: 'work',
        categoryLabel: work.label,
        answers: work.questions.map((q) => q.choices[0].id),
      },
    })
    mountApp('/result')

    // 通常占いの解説文が出る
    await waitFor(() => {
      expect(document.body.textContent).toContain(card.descriptionUpright)
    })
    // カテゴリ特化のベース解釈は出ない
    const base = work.base[card.number]
    if (base) {
      expect(document.body.textContent).not.toContain(base.upright)
    }
  })
})
