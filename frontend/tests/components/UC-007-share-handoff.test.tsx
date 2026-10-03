// @vitest-environment jsdom
// UC-007「占い結果をシェアする」の要件の文（REQ-072・074・079）と契約 `shareOrDownload` だけから設計した、
// 現在の振る舞いの固定（実装は参照していない）。準備と問い合わせ方は ResultPage.test.tsx に倣う。
// ResultPage.test.tsx は契約の入口（shareOrDownload）を差し替えて「何を渡すか」を見ている。
// このファイルは入口を本物のまま通し、端末の共有機能（navigator.share / navigator.canShare）の側を
// 差し替えて「端末の共有機能と端末への保存のどちらへ届くか」を見る。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import { generateShareImage } from '../../src/lib/shareImage'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// jsdom に Canvas が無いためシェア画像を作るところだけモック（端末へ渡すところは本物）
vi.mock('../../src/lib/shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/shareImage')>()
  return {
    ...actual,
    generateShareImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  }
})

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

function drawnOf(card: TarotCard, orientation: Orientation): DrawnCard {
  return { card, orientation, keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'] }
}

/** 端末への保存（ファイルとして保存させること）で渡されたファイル名。保存が起きるたびに 1 つ増える */
let savedFilenames: string[]

/** 端末の共有機能を差し替える。undefined を渡すとその機能が無い端末になる */
function stubDeviceShare(device: { share?: unknown; canShare?: unknown }) {
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: device.share })
  Object.defineProperty(navigator, 'canShare', { configurable: true, writable: true, value: device.canShare })
}

async function chooseShare(drawn: DrawnCard) {
  useReadingStore.setState({ status: 'drawn', drawn, error: null, deep: null })
  mountResult()
  fireEvent.click(await screen.findByRole('button', { name: 'この結果をシェア' }))
}

/** 占い結果を表示したまま、再びシェアを選べる状態に戻っていること */
async function expectShareableAgain(drawn: DrawnCard) {
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
  useReadingStore.setState({ drawn: null, status: 'idle', error: null, deep: null })
  vi.mocked(generateShareImage).mockClear()

  savedFilenames = []
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
describe('シェア: 端末の共有機能が受け取れるとき', () => {
  // @covers REQ-072#device-share-receives
  it.each([
    { orientation: 'upright', label: '正位置' },
    { orientation: 'reversed', label: '逆位置' },
  ] as const)('$label: シェア画像が、カード名と「$label」を添えて端末の共有機能へ渡り、端末への保存は行われない', async ({ orientation, label }) => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {})
    stubDeviceShare({ share, canShare: () => true })
    const drawn = drawnOf(tarotCards[8], orientation)

    await chooseShare(drawn)

    await waitFor(() => {
      expect(share).toHaveBeenCalledTimes(1)
    })
    const data = share.mock.calls[0][0]
    expect(data.files).toHaveLength(1)
    expect(data.files![0].type).toBe('image/png')
    expect(data.files![0].name).toBe(`tarot-${drawn.card.id}.png`)
    expect(data.text).toBe(`${drawn.card.nameJa}（${label}）`)
    await expectShareableAgain(drawn)
    expect(savedFilenames).toEqual([])
  })
})

// UC-007
describe('シェア: 端末の共有機能が受け取れないとき', () => {
  const devices = [
    { 名前: '端末に共有機能が無い', device: () => ({ share: undefined, canShare: undefined }) },
    {
      名前: '共有機能はあるがシェア画像を受け取れない',
      device: () => ({ share: vi.fn(async () => {}), canShare: () => false }),
    },
  ]

  // @covers REQ-072#image-made-without-share-capability
  it.each(devices)('$名前: それでも、その占い結果からシェア画像を作る', async ({ device }) => {
    stubDeviceShare(device())
    const drawn = drawnOf(tarotCards[10], 'upright')

    await chooseShare(drawn)

    await waitFor(() => {
      expect(generateShareImage).toHaveBeenCalledTimes(1)
    })
    const [generatedWith] = vi.mocked(generateShareImage).mock.calls[0]
    expect(generatedWith).toEqual(
      expect.objectContaining({
        card: expect.objectContaining({ id: drawn.card.id }),
        orientation: drawn.orientation,
        keywords: drawn.keywords,
      }),
    )
  })

  // @covers REQ-074#fallback-to-save
  it.each(devices)('$名前: シェア画像を端末への保存で渡し、占い結果を表示したまま再びシェアを選べる', async ({ device }) => {
    const stubbed = device()
    stubDeviceShare(stubbed)
    const drawn = drawnOf(tarotCards[13], 'reversed')

    await chooseShare(drawn)

    await waitFor(() => {
      expect(savedFilenames).toEqual([`tarot-${drawn.card.id}.png`])
    })
    if (stubbed.share) expect(stubbed.share).not.toHaveBeenCalled()
    await expectShareableAgain(drawn)
    expect(savedFilenames).toHaveLength(1)
  })
})

// UC-007
describe('シェア: 端末の共有機能が取り消し以外の理由で失敗したとき', () => {
  // @covers REQ-079#share-fails
  it('シェア画像を端末への保存で渡し、占い結果を表示したまま再びシェアを選べる', async () => {
    const share = vi.fn(async () => {
      throw new Error('テスト専用の共有失敗')
    })
    stubDeviceShare({ share, canShare: () => true })
    const drawn = drawnOf(tarotCards[14], 'upright')

    await chooseShare(drawn)

    await waitFor(() => {
      expect(share).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(savedFilenames).toEqual([`tarot-${drawn.card.id}.png`])
    })
    await expectShareableAgain(drawn)
    expect(savedFilenames).toHaveLength(1)
  })
})
