// @vitest-environment jsdom
// 機能フラグ DEEP_READING_ENABLED を有効にしたときの挙動（要件定義書 v3.3 §3.3
// 「フラグが有効なときの挙動は §5.7 のとおり」/ §5.2）のコンポーネントテスト。
// 仕様文面と公開契約のみを根拠に設計している（実装コードは参照していない）。
// vi.mock はファイル単位で効くため、無料版（フラグ false）のテストとは別ファイルにしている。
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { TopPage } from '../../src/pages/TopPage'
import { useReadingStore } from '../../src/store/useReadingStore'

// 機能フラグを有効化（import より前に巻き上げられる）
vi.mock('../../src/lib/features', () => ({ DEEP_READING_ENABLED: true }))

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

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

describe('フラグ有効時のトップ画面（§5.2）', () => {
  it('「詳しく占う」ボタンが出る（他 3 ボタンと合わせて 4 つ）', async () => {
    mountTop()
    await waitFor(() => {
      expect(queryControl('詳しく占う')).not.toBeNull()
    })
    expect(queryControl('スタート')).not.toBeNull()
    expect(queryControl('カード解説を見る')).not.toBeNull()
    expect(queryControl('占い履歴を見る')).not.toBeNull()
  })
})

describe('フラグ有効時のルーティング（§5.1 / §5.7）', () => {
  it('/deep に直接到達するとリダイレクトされず、カテゴリ選択（§5.7 初期表示）が出る', async () => {
    mountApp('/deep')
    await waitFor(() => {
      expect(queryControl('仕事')).not.toBeNull()
    })
    expect(queryControl('友達・恋愛')).not.toBeNull()
    // トップ画面へは戻されていない
    expect(queryControl('スタート')).toBeNull()
  })
})
