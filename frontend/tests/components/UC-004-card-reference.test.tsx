// @vitest-environment jsdom
// UC-004 の要件の文（REQ-026・REQ-030・REQ-031・REQ-032・REQ-105・REQ-106）と UC.md の表、用語集だけから設計
// （実装は参照していない）。
// 準備と問い合わせのやり方は CardListPage.test.tsx / CardDetailPage.test.tsx に倣う。
// 期待値は公開データ `tarotCards` から実行時に導出する。
//
// 仮定（仕様に無いため置いたもの）
//   G1: 「トップへ戻る」「戻る」（用語集の語）は、その名前のボタンかリンクとして出る
//   G2: カードの識別番号は 1 以上の整数（0 と負の数はどのカードにも当たらない。当たるカードがあれば先に失敗させる）
//   G3: キーワードはカンマ区切りの文字列で持たれ、画面には 1 語ずつ出る（CardDetailPage.test.tsx の仮定 C5 と同じ）
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardDetailPage } from '../../src/pages/CardDetailPage'
import { CardListPage } from '../../src/pages/CardListPage'
import { tarotCards } from '../../src/data/cards'

function mountAt(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/cards" element={<CardListPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/history" element={<div>HISTORY_STUB</div>} />
        <Route path="/" element={<div>HOME_STUB</div>} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * 仮定 G1。名前の前後に付く飾り（矢印などの記号）は無視して、用語集の語そのものと一致するものを選ぶ
 * （「戻る」で「トップへ戻る」を拾わないよう、部分一致にはしない）。
 */
function control(term: string): HTMLElement {
  const name = (accessibleName: string) =>
    accessibleName.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') === term
  return screen.queryByRole('button', { name }) ?? screen.getByRole('link', { name })
}

/** 仮定 G3 */
function asList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

async function waitForAllCards() {
  await waitFor(() => {
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(tarotCards.length)
  })
}

async function expectBodyToContain(text: string) {
  await waitFor(() => {
    expect(document.body.textContent).toContain(text)
  })
}

function expectNoCardShown() {
  for (const card of tarotCards) {
    expect(screen.queryByRole('heading', { level: 1, name: card.nameJa })).toBeNull()
    expect(document.body.textContent).not.toContain(card.descriptionUpright)
    expect(document.body.textContent).not.toContain(card.descriptionReversed)
  }
}

const missingId = Math.max(...tarotCards.map((c) => Number(c.id))) + 1

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

// UC-004
describe('カード解説の一覧: 正位置のキーワード（UC-004）', () => {
  // @covers REQ-026#upright-keywords
  it('各カードに、そのカードの正位置のキーワードが添えられる', async () => {
    mountAt(['/cards'])
    await waitForAllCards()

    for (const card of tarotCards) {
      const link = document.querySelector<HTMLAnchorElement>(`a[href="/cards/${card.id}"]`)
      expect(link, `/cards/${card.id} へのリンクが無い`).not.toBeNull()
      for (const keyword of asList(card.meaningUpright)) {
        expect(link!.textContent, `${card.nameJa} に「${keyword}」が無い`).toContain(keyword)
      }
    }
  })
})

// UC-004
describe('カード解説: どのカードにも当たらない指定（UC-004）', () => {
  // 仮定 G2
  const numericButMissing = ['0', '-1']

  for (const id of numericButMissing) {
    // @covers REQ-030#nonexistent-id
    it(`数には読めるがどのカードにも当たらない指定（${id}）では、カードが見つからないことが示され、どのカードも示されない`, async () => {
      expect(tarotCards.some((c) => String(c.id) === id)).toBe(false)
      mountAt([`/cards/${id}`])

      await expectBodyToContain('カードが見つかりませんでした')
      expect(document.body.textContent).not.toContain('カードIDが不正です')
      expectNoCardShown()
    })
  }

  for (const orientation of ['upright', 'reversed', 'foo']) {
    // @covers REQ-030#nonexistent-with-orientation
    it(`どのカードにも当たらない指定は、正逆の指定（${orientation}）があっても、カードが見つからないことが示され、どのカードも示されない`, async () => {
      mountAt([`/cards/${missingId}?orientation=${orientation}`])

      await expectBodyToContain('カードが見つかりませんでした')
      expectNoCardShown()
    })
  }

  for (const orientation of ['upright', 'reversed', 'foo']) {
    // @covers REQ-031#malformed-with-orientation
    it(`数に読めない指定は、正逆の指定（${orientation}）があっても、カードの指定が不正であることが示され、どのカードも示されない`, async () => {
      mountAt([`/cards/abc?orientation=${orientation}`])

      await expectBodyToContain('カードIDが不正です')
      expect(document.body.textContent).not.toContain('カードが見つかりませんでした')
      expectNoCardShown()
    })
  }

  // @covers REQ-032#from-not-found
  it('カードが見つからないことを示しているときに一覧へ戻ることを選ぶと、カード解説の一覧が示される', async () => {
    mountAt([`/cards/${missingId}`])
    await expectBodyToContain('カードが見つかりませんでした')

    fireEvent.click(screen.getByRole('button', { name: '一覧へ戻る' }))

    await waitForAllCards()
    expect(document.body.textContent).not.toContain('カードが見つかりませんでした')
  })
})

// UC-004
describe('カード解説: トップへ戻る・戻る（UC-004）', () => {
  // @covers REQ-105#from-list
  it('カード解説の一覧でトップへ戻ることを選ぶと、トップが示される', async () => {
    mountAt(['/cards'])
    await waitForAllCards()

    fireEvent.click(control('トップへ戻る'))

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
  })

  // @covers REQ-105#from-detail
  it('実在するカードのカード解説でトップへ戻ることを選ぶと、トップが示される', async () => {
    const card = tarotCards[10]
    // 直前に一覧を示していても、戻る先は直前の画面ではなくトップ
    mountAt(['/cards', `/cards/${card.id}`])
    await screen.findByRole('heading', { level: 1, name: card.nameJa })

    fireEvent.click(control('トップへ戻る'))

    expect(await screen.findByText('HOME_STUB')).toBeTruthy()
  })

  // @covers REQ-106#back-to-previous
  it('占い履歴から開いたカード解説で戻ることを選ぶと、直前に示していた占い履歴が示される', async () => {
    const card = tarotCards[13]
    mountAt(['/', '/history', `/cards/${card.id}?orientation=reversed`])
    await screen.findByRole('heading', { level: 1, name: card.nameJa })

    fireEvent.click(control('戻る'))

    expect(await screen.findByText('HISTORY_STUB')).toBeTruthy()
  })

  // @covers REQ-106#back-to-previous
  it('一覧から開いたカード解説で戻ることを選ぶと、直前に示していた一覧が示される', async () => {
    const card = tarotCards[13]
    mountAt(['/', '/cards', `/cards/${card.id}`])
    await screen.findByRole('heading', { level: 1, name: card.nameJa })

    fireEvent.click(control('戻る'))

    await waitForAllCards()
    expect(screen.queryByRole('heading', { level: 1, name: card.nameJa })).toBeNull()
  })
})
