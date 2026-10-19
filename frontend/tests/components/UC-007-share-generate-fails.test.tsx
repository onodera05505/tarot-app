// @vitest-environment jsdom
// UC-007 の要件の文（REQ-075）と契約 `shareOrDownload`・用語集（シェア・端末の共有機能・端末への保存）だけから設計した、
// シェア画像を作れなかったときのテスト（実装は参照していない）。準備と問い合わせ方は UC-007-share-handoff.test.tsx に倣う。
// シェア画像を作るところだけを差し替えて失敗させ、端末の共有機能と端末への保存の側は本物の経路で「何も届かない」ことを見る。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import { generateShareImage } from '../../src/lib/shareImage'
import type { DrawnCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// シェア画像を作るところだけモック（端末へ渡すところは本物）。各テストが失敗させる
vi.mock('../../src/lib/shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/shareImage')>()
  return { ...actual, generateShareImage: vi.fn(actual.generateShareImage) }
})

const GENERATE_FAILURE = 'テスト専用の画像の作成失敗'
/** シェアの途中であることを示す文言（REQ-073 の持ち分。作れなかったことの表示とは数えない） */
const IN_PROGRESS_LABEL = '画像を作成中...'

function generateFails() {
  vi.mocked(generateShareImage).mockImplementation(async () => {
    throw new Error(GENERATE_FAILURE)
  })
}

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="/shuffle" element={<div>SHUFFLE_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const drawn: DrawnCard = {
  card: tarotCards[6],
  orientation: 'upright',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 端末への保存（ファイルとして保存させること）で渡されたファイル名。保存が起きるたびに 1 つ増える */
let savedFilenames: string[]
/** 端末の共有機能（受け取れる端末） */
let share: ReturnType<typeof vi.fn<(data: ShareData) => Promise<void>>>
/** ブラウザの通知（示し方として使われた場合に捕まえる） */
let alertSpy: ReturnType<typeof vi.spyOn>

function stubDeviceShare(device: { share?: unknown; canShare?: unknown }) {
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: device.share })
  Object.defineProperty(navigator, 'canShare', { configurable: true, writable: true, value: device.canShare })
}

/** 画面に出ている文字列の集まり（要素ごと） */
function textNodes(): string[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const out: string[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim()
    if (text) out.push(text)
  }
  return out
}

/** シェアを選び、シェア画像を作れずに終わるまで待つ */
async function chooseShareAndFail() {
  fireEvent.click(await screen.findByRole('button', { name: 'この結果をシェア' }))
  await waitFor(() => {
    expect(generateShareImage).toHaveBeenCalledTimes(1)
  })
  await expect(vi.mocked(generateShareImage).mock.results[0].value).rejects.toThrow(GENERATE_FAILURE)
}

/** 占い結果を表示したまま、再びシェアを選べる状態に戻っていること */
async function expectShareableAgain() {
  await waitFor(() => {
    const button = screen.getByRole('button', { name: 'この結果をシェア' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })
  expect(screen.getByRole('heading', { level: 2, name: drawn.card.nameJa })).toBeTruthy()
  expect(screen.queryByText('HOME_STUB')).toBeNull()
  expect(useReadingStore.getState().status).toBe('drawn')
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.setState({ status: 'drawn', drawn, error: null, deep: null })
  vi.mocked(generateShareImage).mockReset()
  generateFails()

  savedFilenames = []
  share = vi.fn<(data: ShareData) => Promise<void>>(async () => {})
  stubDeviceShare({ share, canShare: () => true })
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
  // jsdom に無い URL.createObjectURL / revokeObjectURL を補う
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:test') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() })
  // ファイルとして保存させる操作（download 付きのリンクを押す）を記録する
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (this.hasAttribute('download')) savedFilenames.push(this.getAttribute('download') ?? '')
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  stubDeviceShare({ share: undefined, canShare: undefined })
})

// UC-007
describe('シェア: シェア画像を作れなかったとき', () => {
  // @covers REQ-075#generate-fails
  it('端末の共有機能にも端末への保存にも何も渡さず、占い結果を表示したまま再びシェアを選べる', async () => {
    mountResult()
    await chooseShareAndFail()

    await expectShareableAgain()
    expect(share).not.toHaveBeenCalled()
    expect(savedFilenames).toEqual([])

    // 再びシェアを選べる: もう一度選ぶと、改めてシェア画像を作ろうとする
    fireEvent.click(screen.getByRole('button', { name: 'この結果をシェア' }))
    await waitFor(() => {
      expect(generateShareImage).toHaveBeenCalledTimes(2)
    })
    await expectShareableAgain()
    expect(share).not.toHaveBeenCalled()
    expect(savedFilenames).toEqual([])
  })

  // @covers REQ-075#generate-fails
  it('シェア画像を作れなかったことが占う人に示される（シェアを選ぶ前に無かった表示が現れる）', async () => {
    mountResult()
    await screen.findByRole('button', { name: 'この結果をシェア' })
    const before = textNodes()

    await chooseShareAndFail()
    await expectShareableAgain()

    await waitFor(() => {
      const added = textNodes().filter((text) => !before.includes(text) && text !== IN_PROGRESS_LABEL)
      const notified = added.length > 0 || alertSpy.mock.calls.length > 0
      expect(notified).toBe(true)
    })
  })
})
