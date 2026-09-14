// @vitest-environment jsdom
// 仕様 v3（v3.3）§5.5「カード解説一覧（/cards）」の文面と公開契約だけから設計（実装は参照していない）。
// 期待値は公開データ `tarotCards` から実行時に導出する（番号昇順に並べ直したものが正解）。
//
// 仮定（契約に無いため置いたもの）
//   B1: `tarotCards` は 22 枚で、`number` は一意（並び順の期待値をこれで作る。重複があれば期待値が定まらないので先に失敗させる）
//   B2: 各カードのリンクは `href="/cards/{id}"` の `<a>` として DOM に現れる（MemoryRouter 配下でも Link は href を出力する）
//   B3: 「読み込み中...」は fetchAllCards（setTimeout 0）の解決前、初回描画の直後に同期的に見える
//   B4: 一覧内の `<h2>` はカード名にだけ使われる（h2 の DOM 順 = カードの表示順とみなす）
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardListPage } from '../../src/pages/CardListPage'
import { tarotCards } from '../../src/data/cards'

/** §5.5「22 枚をアルカナ番号順に表示」の正解 */
const sortedByNumber = [...tarotCards].sort((a, b) => a.number - b.number)

function mountList() {
  return render(
    <MemoryRouter initialEntries={['/cards']}>
      <Routes>
        <Route path="/cards" element={<CardListPage />} />
        <Route path="/cards/:id" element={<div>DETAIL_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 一覧の描画完了（22 枚の h2）を待つ */
async function waitForAllCards() {
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(sortedByNumber.length)
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('カード解説一覧: 前提データ（仮定 B1）', () => {
  it('tarotCards は 22 枚で number が一意', () => {
    expect(tarotCards).toHaveLength(22)
    expect(new Set(tarotCards.map((c) => c.number)).size).toBe(22)
    expect(new Set(tarotCards.map((c) => c.id)).size).toBe(22)
  })
})

describe('カード解説一覧: 見出しと読み込み中（§5.5）', () => {
  it('見出し h1「大アルカナ 22枚」が表示される', async () => {
    mountList()
    expect(await screen.findByRole('heading', { level: 1, name: '大アルカナ 22枚' })).toBeTruthy()
    await waitForAllCards()
  })

  it('読み込み完了前は「読み込み中...」が出て、完了後は消える', async () => {
    mountList()
    // 仮定 B3
    expect(screen.getByText('読み込み中...')).toBeTruthy()

    await waitForAllCards()
    expect(screen.queryByText('読み込み中...')).toBeNull()
  })
})

describe('カード解説一覧: 22 枚を番号順に表示（§5.5）', () => {
  it('h2 のカード名が DOM 順で tarotCards の number 昇順と一致する（22 件）', async () => {
    mountList()
    await waitForAllCards()

    // 仮定 B4
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())
    expect(names).toEqual(sortedByNumber.map((c) => c.nameJa))
  })

  it('各カードに alt=カード名の画像がある', async () => {
    mountList()
    await waitForAllCards()

    for (const card of sortedByNumber) {
      expect(screen.getAllByAltText(card.nameJa).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('各カードは /cards/{id} へのリンクで、リンクの並びも番号順', async () => {
    mountList()
    await waitForAllCards()

    // 仮定 B2
    const hrefs = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/cards/"]')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toEqual(sortedByNumber.map((c) => `/cards/${c.id}`))
  })

  it('各リンクの中にそのカードの画像・カード名・2 桁ゼロ埋めの番号が入っている', async () => {
    mountList()
    await waitForAllCards()

    for (const card of sortedByNumber) {
      const link = document.querySelector<HTMLAnchorElement>(`a[href="/cards/${card.id}"]`)
      expect(link, `/cards/${card.id} へのリンクが無い`).not.toBeNull()
      expect(link!.querySelector(`img[alt="${card.nameJa}"]`)).not.toBeNull()
      expect(link!.textContent).toContain(card.nameJa)
      expect(link!.textContent).toContain(String(card.number).padStart(2, '0'))
    }
  })
})

describe('カード解説一覧: タップで詳細へ（§5.5）', () => {
  it('カードのリンクを押すと /cards/{id} へ遷移する', async () => {
    mountList()
    await waitForAllCards()

    // 先頭でも末尾でもない 1 枚を選び、位置に依存しないことを確かめる
    const target = sortedByNumber[7]
    const link = document.querySelector<HTMLAnchorElement>(`a[href="/cards/${target.id}"]`)
    expect(link).not.toBeNull()

    fireEvent.click(link!)
    expect(await screen.findByText('DETAIL_STUB')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: '大アルカナ 22枚' })).toBeNull()
  })
})
