// @vitest-environment jsdom
// 仕様 v3（v3.3）§5.1（`/cards/:id`、`?orientation=`）と §5.5「カード解説詳細」の文面と公開契約だけから設計（実装は参照していない）。
// 期待値は公開データ `tarotCards` から実行時に導出する。
//
// 仮定（契約に無いため置いたもの）
//   C1: `id` は数値で、`Number(card.id)` が整数。存在しない id は「実データの最大 id + 1」で作る
//   C2: （2026-09-14 回答で確定）「一覧へ戻る」は `/cards` へ遷移する
//   C3: 「読み込み中...」は fetchCard（setTimeout 0）の解決前、初回描画の直後に同期的に見える
//   C4: （2026-09-14 契約追記で解消）`?orientation=` は両節を描画したうえで、指定された側の節（h2）が DOM で先に来る。
//       `reversed` のときカード画像に `style="transform: rotate(180deg)"` が付く。未指定・不正値は正位置が先
//   C5: （2026-09-14 契約追記で解消）`meaningUpright` / `meaningReversed` はカンマ区切りの文字列で、画面には 1 語ずつ `<li>` に描かれる。
//       カンマ区切りの生文字列は画面に出ないので、`split(',')` して trim した語ごとに判定する
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardDetailPage } from '../../src/pages/CardDetailPage'
import { tarotCards } from '../../src/data/cards'

function mountDetail(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/cards" element={<div>LIST_STUB</div>} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 仮定 C5: カンマ区切りの文字列を 1 語ずつに分ける（配列で来ても吸収する） */
function asList(value: string | readonly string[]): string[] {
  const raw = Array.isArray(value) ? [...value] : [value as string]
  return raw
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

/** 「正位置」「逆位置」の h2 を DOM 順に返す */
function orientationHeadings(): string[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent?.trim() ?? '')
    .filter((t) => t === '正位置' || t === '逆位置')
}

/** alt=カード名 の画像のうち、180° 回転が付いているものの数 */
function rotatedImageCount(nameJa: string): number {
  return screen
    .getAllByAltText(nameJa)
    .filter((img) => (img as HTMLElement).style.transform.replace(/\s/g, '') === 'rotate(180deg)').length
}

/** 仮定 C1 */
const missingId = Math.max(...tarotCards.map((c) => Number(c.id))) + 1

/** 長文（解説文）は要素分割の可能性があるため body のテキストで判定する */
async function expectBodyToContain(text: string) {
  await waitFor(() => {
    expect(document.body.textContent).toContain(text)
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('カード解説詳細: 実在する id の表示（§5.5「カード画像・名前・正逆それぞれのキーワードと解説文」）', () => {
  // 先頭と末尾の 2 枚で、カードごとに内容が切り替わることを確かめる
  const samples = [tarotCards[0], tarotCards[tarotCards.length - 1]]

  for (const card of samples) {
    it(`${card.nameJa}（id=${card.id}）: 名前(h1)・画像・「正位置」「逆位置」の節・両方のキーワードと解説文が出る`, async () => {
      mountDetail(`/cards/${card.id}`)

      expect(await screen.findByRole('heading', { level: 1, name: card.nameJa })).toBeTruthy()
      expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)

      expect(screen.getByRole('heading', { level: 2, name: '正位置' })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 2, name: '逆位置' })).toBeTruthy()

      // 仮定 C5: キーワードは 1 語ずつ <li> に出る
      const listItems = () => screen.getAllByRole('listitem').map((li) => li.textContent?.trim())
      for (const keyword of asList(card.meaningUpright)) {
        await waitFor(() => expect(listItems()).toContain(keyword))
      }
      for (const keyword of asList(card.meaningReversed)) {
        await waitFor(() => expect(listItems()).toContain(keyword))
      }
      await expectBodyToContain(card.descriptionUpright)
      await expectBodyToContain(card.descriptionReversed)
    })
  }

  it('別のカードの解説文は表示されない（id に対応するカードだけを出す）', async () => {
    const card = tarotCards[3]
    const other = tarotCards[4]
    mountDetail(`/cards/${card.id}`)

    await screen.findByRole('heading', { level: 1, name: card.nameJa })
    await expectBodyToContain(card.descriptionUpright)

    expect(document.body.textContent).not.toContain(other.descriptionUpright)
    expect(document.body.textContent).not.toContain(other.descriptionReversed)
    expect(screen.queryByRole('heading', { level: 1, name: other.nameJa })).toBeNull()
  })

  it('読み込み完了前は「読み込み中...」が出て、完了後は消える', async () => {
    const card = tarotCards[5]
    mountDetail(`/cards/${card.id}`)

    // 仮定 C3
    expect(screen.getByText('読み込み中...')).toBeTruthy()

    await screen.findByRole('heading', { level: 1, name: card.nameJa })
    expect(screen.queryByText('読み込み中...')).toBeNull()
  })
})

describe('カード解説詳細: クエリ orientation（§5.1 / §5.5「クエリ orientation で初期表示の正逆を指定できる」）', () => {
  it('?orientation=reversed: 両節が出たうえで「逆位置」の節が先に来て、カード画像が 180° 回転している', async () => {
    const card = tarotCards[6]
    mountDetail(`/cards/${card.id}?orientation=reversed`)

    expect(await screen.findByRole('heading', { level: 1, name: card.nameJa })).toBeTruthy()
    // 仮定 C4（契約追記）: 指定された側の節が DOM で先
    expect(orientationHeadings()).toEqual(['逆位置', '正位置'])
    expect(rotatedImageCount(card.nameJa)).toBeGreaterThanOrEqual(1)
    // 両方の解説文は引き続き出る（§5.5「正逆それぞれ」）
    await expectBodyToContain(card.descriptionReversed)
    await expectBodyToContain(card.descriptionUpright)
  })

  it('?orientation=upright: 「正位置」の節が先で、カード画像は回転しない', async () => {
    const card = tarotCards[7]
    mountDetail(`/cards/${card.id}?orientation=upright`)

    expect(await screen.findByRole('heading', { level: 1, name: card.nameJa })).toBeTruthy()
    expect(orientationHeadings()).toEqual(['正位置', '逆位置'])
    expect(rotatedImageCount(card.nameJa)).toBe(0)
    await expectBodyToContain(card.descriptionUpright)
    await expectBodyToContain(card.descriptionReversed)
  })

  it('orientation 未指定: 既定は正位置が先で、画像は回転しない', async () => {
    const card = tarotCards[8]
    mountDetail(`/cards/${card.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: card.nameJa })).toBeTruthy()
    expect(orientationHeadings()).toEqual(['正位置', '逆位置'])
    expect(rotatedImageCount(card.nameJa)).toBe(0)
  })

  it('orientation が不正値（?orientation=foo）: 正位置が先で、画像は回転しない', async () => {
    const card = tarotCards[9]
    mountDetail(`/cards/${card.id}?orientation=foo`)

    expect(await screen.findByRole('heading', { level: 1, name: card.nameJa })).toBeTruthy()
    expect(orientationHeadings()).toEqual(['正位置', '逆位置'])
    expect(rotatedImageCount(card.nameJa)).toBe(0)
    await expectBodyToContain(card.descriptionUpright)
    await expectBodyToContain(card.descriptionReversed)
  })
})

describe('カード解説詳細: 不正な id・存在しない id', () => {
  it('数値でない id では「カードIDが不正です」と「一覧へ戻る」が出て、カード名は出ない', async () => {
    mountDetail('/cards/abc')

    await expectBodyToContain('カードIDが不正です')
    expect(screen.getByRole('button', { name: '一覧へ戻る' })).toBeTruthy()
    for (const card of tarotCards) {
      expect(screen.queryByRole('heading', { level: 1, name: card.nameJa })).toBeNull()
    }
  })

  it('存在しない id では「カードが見つかりませんでした」と「一覧へ戻る」が出て、カード名は出ない', async () => {
    mountDetail(`/cards/${missingId}`)

    await expectBodyToContain('カードが見つかりませんでした')
    expect(screen.getByRole('button', { name: '一覧へ戻る' })).toBeTruthy()
    for (const card of tarotCards) {
      expect(screen.queryByRole('heading', { level: 1, name: card.nameJa })).toBeNull()
    }
  })

  it('「一覧へ戻る」を押すと /cards へ遷移する（仮定 C2）', async () => {
    mountDetail('/cards/abc')

    fireEvent.click(await screen.findByRole('button', { name: '一覧へ戻る' }))
    expect(await screen.findByText('LIST_STUB')).toBeTruthy()
  })
})
