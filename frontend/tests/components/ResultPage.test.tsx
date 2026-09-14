// @vitest-environment jsdom
// 仕様 v3（v3.3）§5.4「結果表示画面（/result）」の文面と公開契約だけから設計（実装は参照していない）。
// 期待値は公開データ `tarotCards` から実行時に導出する。
// 無料版の既定（DEEP_READING_ENABLED = false、§3.3）のまま検証する。
//
// 仮定（契約に無いため置いたもの。外れていたら仕様かテストへ差し戻す）
//   A1: 正逆は画面上に文字列「正位置」「逆位置」として表示される（§5.4「正位置・逆位置」の文面をそのまま表示文言とみなす）
//   A2: キーワード一覧は `drawn.keywords` の各要素をそのまま表示する（カードの meaningUpright ではなく DrawnCard の keywords）
//   A3: 「占い状態をリセット」とは `status` が `'idle'`、`drawn` が `null` に戻ること（`reset()` 相当）
//   A4: シェアは `generateShareImage(drawn)` → その戻り Blob を第 1 引数にして `shareOrDownload(blob, filename, text)` の順で呼ぶ。
//       （2026-09-14 回答で確定）filename は `tarot-{card.id}.png`、text は `{nameJa}（正位置|逆位置）`
//   A5: （2026-09-14 回答で確定）status が `'error'` のとき「エラー: {store.error}」の形で画面に出る（`toContain(error)` で判定）
//   A6: 拡大モーダルを閉じると `aria-label="閉じる"` のボタンが DOM から消える（AnimatePresence は jsdom で即時）
//   A7: error 状態の「トップへ戻る」も §5.4 の同名ボタンと同じ挙動（状態を idle に戻して `/` へ）
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { tarotCards } from '../../src/data/cards'
import { generateShareImage, shareOrDownload } from '../../src/lib/shareImage'
import type { DrawnCard, Orientation, TarotCard } from '../../src/lib/types'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// jsdom に Canvas が無いためシェア画像の生成・共有はモック（呼ばれ方だけを検証する）
vi.mock('../../src/lib/shareImage', () => ({
  generateShareImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  shareOrDownload: vi.fn(async () => {}),
}))

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="/shuffle" element={<div>SHUFFLE_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 仮定 A2: 表示されるキーワードは DrawnCard.keywords。カード由来の語と衝突しないテスト専用の語にする */
function drawnOf(card: TarotCard, orientation: Orientation): DrawnCard {
  return {
    card,
    orientation,
    keywords: [`テスト専用キーワード甲_${orientation}`, `テスト専用キーワード乙_${orientation}`],
  }
}

function setDrawn(drawn: DrawnCard) {
  useReadingStore.setState({ status: 'drawn', drawn, error: null, deep: null })
}

/** 長文（解説文）は要素分割の可能性があるため body のテキストで判定する */
async function expectBodyToContain(text: string) {
  await waitFor(() => {
    expect(document.body.textContent).toContain(text)
  })
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.setState({ drawn: null, status: 'idle', error: null, deep: null })
  vi.mocked(generateShareImage).mockClear()
  vi.mocked(shareOrDownload).mockClear()
})

afterEach(() => {
  cleanup()
})

describe('結果表示: 占い結果がない状態（§5.4「idle では / へリダイレクト」）', () => {
  it('status が idle なら / へリダイレクトされ、結果画面の要素は出ない', async () => {
    mountResult()
    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'この結果をシェア' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'もう一度占う' })).toBeNull()
  })
})

describe('結果表示: カード情報の表示（§5.4「カード名／正位置・逆位置／キーワード一覧／正逆に応じた詳細解説文」）', () => {
  it('正位置: カード名（h2）・「正位置」・キーワード・descriptionUpright が出て、descriptionReversed は出ない', async () => {
    const card = tarotCards[0]
    const drawn = drawnOf(card, 'upright')
    setDrawn(drawn)
    mountResult()

    expect(await screen.findByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
    await expectBodyToContain('正位置') // 仮定 A1
    for (const keyword of drawn.keywords) {
      await expectBodyToContain(keyword) // 仮定 A2
    }
    await expectBodyToContain(card.descriptionUpright)
    expect(document.body.textContent).not.toContain(card.descriptionReversed)
  })

  it('逆位置: カード名（h2）・「逆位置」・キーワード・descriptionReversed が出て、descriptionUpright は出ない', async () => {
    // 正位置のケースと別のカードを使い、カード固有の文面で判定していることを担保する
    const card = tarotCards[tarotCards.length - 1]
    const drawn = drawnOf(card, 'reversed')
    setDrawn(drawn)
    mountResult()

    expect(await screen.findByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
    await expectBodyToContain('逆位置') // 仮定 A1
    for (const keyword of drawn.keywords) {
      await expectBodyToContain(keyword) // 仮定 A2
    }
    await expectBodyToContain(card.descriptionReversed)
    expect(document.body.textContent).not.toContain(card.descriptionUpright)
  })

  it('カード画像が alt=カード名で表示される', async () => {
    const card = tarotCards[1]
    setDrawn(drawnOf(card, 'upright'))
    mountResult()

    const images = await screen.findAllByAltText(card.nameJa)
    expect(images.length).toBeGreaterThanOrEqual(1)
  })
})

describe('結果表示: 画像タップで拡大モーダル（§5.4「カード画像（タップで拡大モーダル）」）', () => {
  it('「カードを拡大表示」でモーダルが開き（「閉じる」が現れ）、「閉じる」で閉じる', async () => {
    const card = tarotCards[2]
    setDrawn(drawnOf(card, 'upright'))
    mountResult()

    // 開く前は閉じるボタンが無い
    await screen.findByRole('heading', { level: 2, name: card.nameJa })
    expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull()

    // 拡大ボタンはめくり演出の完了まで disabled（契約追記）。有効になるのを待ってから押す
    const zoomButton = await screen.findByRole('button', { name: 'カードを拡大表示' })
    await waitFor(() => {
      expect((zoomButton as HTMLButtonElement).disabled).toBe(false)
    })
    fireEvent.click(zoomButton)
    const closeButton = await screen.findByRole('button', { name: '閉じる' })
    expect(closeButton).toBeTruthy()

    fireEvent.click(closeButton)
    // 仮定 A6
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull()
    })
    // 閉じても結果画面自体は残っている
    expect(screen.getByRole('heading', { level: 2, name: card.nameJa })).toBeTruthy()
  })
})

describe('結果表示: ボタン（§5.4）', () => {
  it('「もう一度占う」で占い状態がリセットされ /shuffle へ遷移する', async () => {
    setDrawn(drawnOf(tarotCards[3], 'upright'))
    mountResult()

    fireEvent.click(await screen.findByRole('button', { name: 'もう一度占う' }))

    expect(await screen.findByText('SHUFFLE_STUB')).toBeTruthy()
    // 仮定 A3
    const state = useReadingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.drawn).toBeNull()
    // リセット先は / ではなく /shuffle（idle リダイレクトに横取りされない）
    expect(screen.queryByText('HOME_STUB')).toBeNull()
  })

  it('「トップへ戻る」で占い状態がリセットされ / へ遷移する', async () => {
    setDrawn(drawnOf(tarotCards[4], 'reversed'))
    mountResult()

    fireEvent.click(await screen.findByRole('button', { name: 'トップへ戻る' }))

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    // 仮定 A3
    const state = useReadingStore.getState()
    expect(state.status).toBe('idle')
    expect(state.drawn).toBeNull()
  })

  it('「この結果をシェア」で generateShareImage(drawn) → shareOrDownload(blob, …) の順に呼ばれる', async () => {
    const drawn = drawnOf(tarotCards[5], 'upright')
    setDrawn(drawn)
    mountResult()

    fireEvent.click(await screen.findByRole('button', { name: 'この結果をシェア' }))

    // 仮定 A4
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

    await waitFor(() => {
      expect(shareOrDownload).toHaveBeenCalledTimes(1)
    })
    const generatedBlob = await vi.mocked(generateShareImage).mock.results[0].value
    const [sharedBlob, filename, text] = vi.mocked(shareOrDownload).mock.calls[0]
    expect(sharedBlob).toBe(generatedBlob)
    expect(filename).toBe(`tarot-${drawn.card.id}.png`)
    expect(text).toBe(`${drawn.card.nameJa}（正位置）`)
  })

  it('逆位置のシェアでは共有テキストが「{カード名}（逆位置）」になる', async () => {
    const drawn = drawnOf(tarotCards[7], 'reversed')
    setDrawn(drawn)
    mountResult()

    fireEvent.click(await screen.findByRole('button', { name: 'この結果をシェア' }))

    await waitFor(() => {
      expect(shareOrDownload).toHaveBeenCalledTimes(1)
    })
    const [, filename, text] = vi.mocked(shareOrDownload).mock.calls[0]
    expect(filename).toBe(`tarot-${drawn.card.id}.png`)
    expect(text).toBe(`${drawn.card.nameJa}（逆位置）`)
  })

  it('画像の生成中はボタン文言が「画像を作成中...」になる', async () => {
    // 解決しない Promise で「生成中」を固定する
    vi.mocked(generateShareImage).mockImplementationOnce(() => new Promise<Blob>(() => {}))
    setDrawn(drawnOf(tarotCards[6], 'upright'))
    mountResult()

    fireEvent.click(await screen.findByRole('button', { name: 'この結果をシェア' }))

    expect(await screen.findByText('画像を作成中...')).toBeTruthy()
    expect(shareOrDownload).not.toHaveBeenCalled()
  })
})

describe('結果表示: status が drawing / error のとき', () => {
  it('drawing のとき「カードを引いています...」が出て、結果の要素は出ない', async () => {
    useReadingStore.setState({ status: 'drawing', drawn: null, error: null, deep: null })
    mountResult()

    await expectBodyToContain('カードを引いています...')
    expect(screen.queryByRole('button', { name: 'この結果をシェア' })).toBeNull()
    expect(screen.queryByText('HOME_STUB')).toBeNull()
  })

  it('error のときエラー文と「トップへ戻る」が出て、押すと状態が idle に戻り / へ遷移する', async () => {
    const message = 'テスト専用のエラー文'
    useReadingStore.setState({ status: 'error', drawn: null, error: message, deep: null })
    mountResult()

    await expectBodyToContain(message) // 仮定 A5
    const back = await screen.findByRole('button', { name: 'トップへ戻る' })
    expect(screen.queryByRole('button', { name: 'この結果をシェア' })).toBeNull()

    fireEvent.click(back)
    // 仮定 A7
    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
    expect(useReadingStore.getState().status).toBe('idle')
  })
})
