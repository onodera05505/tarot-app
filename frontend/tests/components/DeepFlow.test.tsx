// @vitest-environment jsdom
// 詳しく占うフロー（要件定義書 v3.2 §5.7）のコンポーネントテスト。
// 仕様文面と公開契約のみを根拠に設計している（実装コードは参照していない）。
// 期待値は公開データ API（loadDeepCategory('work') / tarotCards）から実行時に導出する。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepPage } from '../../src/pages/DeepPage'
import { ResultPage } from '../../src/pages/ResultPage'
import { useReadingStore } from '../../src/store/useReadingStore'
import { deepCategories, loadDeepCategory } from '../../src/data/deep/index'
import { tarotCards } from '../../src/data/cards'

// jsdom に Web Audio が無いため効果音はモック
vi.mock('../../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

function mountDeep() {
  return render(
    <MemoryRouter initialEntries={['/deep']}>
      <Routes>
        <Route path="/deep" element={<DeepPage />} />
        <Route path="/shuffle" element={<div>SHUFFLE_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function mountResult() {
  return render(
    <MemoryRouter initialEntries={['/result']}>
      <Routes>
        <Route path="/result" element={<ResultPage />} />
        <Route path="*" element={<div>OTHER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 質問文の表示を待ってから、指定 label の選択肢をタップする */
async function answerQuestion(questionText: string, choiceLabel: string) {
  await screen.findByText(questionText)
  fireEvent.click(screen.getByRole('button', { name: choiceLabel }))
}

/** 長文（解釈・補足）は要素分割の可能性があるため body のテキストで判定する */
async function expectBodyToContain(text: string) {
  await waitFor(() => {
    expect(document.body.textContent).toContain(text)
  })
}

beforeEach(() => {
  localStorage.clear()
  useReadingStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

describe('詳しく占う: カテゴリ選択と質問フロー（§5.7 1-2）', () => {
  it('初期表示でカテゴリ一覧が出る（「仕事」「友達・恋愛」がボタン表示される）', async () => {
    mountDeep()
    expect(await screen.findByRole('button', { name: '仕事' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: '友達・恋愛' })).toBeTruthy()
    // deepCategories に載るカテゴリはすべてボタンとして表示される（v3.2 で 2 件）
    for (const category of deepCategories) {
      expect(await screen.findByRole('button', { name: category.label })).toBeTruthy()
    }
  })

  it('カテゴリ選択で 1 問目の質問文（work の実データ）が表示される', async () => {
    const work = await loadDeepCategory('work')
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: '仕事' }))

    // 動的読み込み後に 1 問目が出る
    expect(await screen.findByText(work.questions[0].text)).toBeTruthy()
    // 1 問目の選択肢がすべてボタンで表示される
    for (const choice of work.questions[0].choices) {
      expect(screen.getByRole('button', { name: choice.label })).toBeTruthy()
    }
  })

  it('3 問に順に答えると /shuffle へ遷移し、store.deep に categoryId と回答 3 件が入る', async () => {
    const work = await loadDeepCategory('work')
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: '仕事' }))

    // 各問で異なる添字の選択肢を選び、答えの対応（順序・id）を検証できるようにする
    const picked = [
      work.questions[0].choices[0],
      work.questions[1].choices[1],
      work.questions[2].choices[2],
    ]
    await answerQuestion(work.questions[0].text, picked[0].label)
    await answerQuestion(work.questions[1].text, picked[1].label)
    await answerQuestion(work.questions[2].text, picked[2].label)

    // 3 問目の回答で儀式（/shuffle）へ
    expect(await screen.findByText('SHUFFLE_STUB')).toBeTruthy()

    const deep = useReadingStore.getState().deep
    expect(deep).not.toBeNull()
    expect(deep!.categoryId).toBe('work')
    expect(deep!.categoryLabel).toBe(work.label)
    expect(deep!.answers).toEqual(picked.map((c) => c.id))
  })

  it('「戻る」で前の問に戻り、選び直した回答で上書きされる（回答は 3 件のまま）', async () => {
    const work = await loadDeepCategory('work')
    mountDeep()

    fireEvent.click(await screen.findByRole('button', { name: '仕事' }))

    // q1・q2 に回答して q3 まで進む
    await answerQuestion(work.questions[0].text, work.questions[0].choices[0].label)
    await answerQuestion(work.questions[1].text, work.questions[1].choices[0].label)
    await screen.findByText(work.questions[2].text)

    // 戻る → q2 が再表示される（回答保持のまま戻れる）
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    await screen.findByText(work.questions[1].text)

    // さらに戻る → q1 が再表示される
    fireEvent.click(screen.getByRole('button', { name: '戻る' }))
    await screen.findByText(work.questions[0].text)

    // q1 を選び直して最後まで進む
    const repicked = [
      work.questions[0].choices[1], // 選び直し
      work.questions[1].choices[2], // 選び直し
      work.questions[2].choices[0],
    ]
    await answerQuestion(work.questions[0].text, repicked[0].label)
    await answerQuestion(work.questions[1].text, repicked[1].label)
    await answerQuestion(work.questions[2].text, repicked[2].label)

    expect(await screen.findByText('SHUFFLE_STUB')).toBeTruthy()

    // 回答は選び直した内容で上書きされ、件数は 3 件のまま（追記されない）
    const deep = useReadingStore.getState().deep
    expect(deep).not.toBeNull()
    expect(deep!.answers).toHaveLength(3)
    expect(deep!.answers).toEqual(repicked.map((c) => c.id))
  })
})

describe('詳しく占う: 結果画面（§5.7 4）', () => {
  it('旧構造カテゴリ（work）: カテゴリ名・ベース解釈・choice.fragment による補足 3 本を表示し、通常の解説文は出さない', async () => {
    const work = await loadDeepCategory('work')
    const card = tarotCards.find((c) => work.base[c.number] !== undefined)
    if (!card) throw new Error('work の base に対応するカードが見つからない（データ不整合）')

    const picked = [
      work.questions[0].choices[0],
      work.questions[1].choices[1],
      work.questions[2].choices[2],
    ]
    // v3.2 で fragment は optional になった。work は旧構造カテゴリなので
    // 全選択肢が fragment を持つこと自体を検証してから期待値に使う
    const fragments = picked
      .map((c) => c.fragment)
      .filter((f): f is string => typeof f === 'string')
    expect(fragments).toHaveLength(3)

    useReadingStore.setState({
      // §5.4: status が idle のままだと ResultPage は / へリダイレクトする
      status: 'drawn',
      drawn: {
        card,
        orientation: 'reversed',
        keywords: ['キーワードA', 'キーワードB'],
      },
      deep: {
        categoryId: 'work',
        categoryLabel: work.label,
        answers: picked.map((c) => c.id),
      },
    })
    mountResult()

    // カテゴリ名
    await expectBodyToContain(work.label)
    // ベース解釈: 引いたカード × 正逆（ここでは逆位置）× カテゴリ
    await expectBodyToContain(work.base[card.number].reversed)
    // 回答別補足 3 本（advice が無い旧構造では choice.fragment にフォールバック）
    for (const fragment of fragments) {
      await expectBodyToContain(fragment)
    }
    // 通常の解説文の「代わり」なので、従来の解説文は表示しない
    expect(document.body.textContent).not.toContain(card.descriptionReversed)
    expect(document.body.textContent).not.toContain(card.descriptionUpright)
  })

  it('新構造カテゴリ（love）: 回答別アドバイスは base[card.number].advice[選択肢id] の 3 本が表示される', async () => {
    const love = await loadDeepCategory('love')
    // advice を持つ base エントリに対応するカードを選ぶ（カード別に文章が変わる新構造）
    const card = tarotCards.find((c) => love.base[c.number]?.advice !== undefined)
    if (!card) throw new Error('love の base に advice 付きエントリが見つからない（データ不整合）')

    const picked = [
      love.questions[0].choices[0],
      love.questions[1].choices[1],
      love.questions[2].choices[2],
    ]
    // advice は 9 エントリ（3 問 × 3 択）で、選んだ 3 選択肢の id をすべて含むこと
    const advice = love.base[card.number].advice
    expect(advice).toBeTruthy()
    expect(Object.keys(advice ?? {})).toHaveLength(9)
    const adviceTexts = picked
      .map((c) => advice?.[c.id])
      .filter((t): t is string => typeof t === 'string')
    expect(adviceTexts).toHaveLength(3)

    useReadingStore.setState({
      // §5.4: status が idle のままだと ResultPage は / へリダイレクトする
      status: 'drawn',
      drawn: {
        card,
        orientation: 'upright',
        keywords: ['キーワードA', 'キーワードB'],
      },
      deep: {
        categoryId: 'love',
        categoryLabel: love.label,
        answers: picked.map((c) => c.id),
      },
    })
    mountResult()

    // カテゴリ名（「友達・恋愛」）
    await expectBodyToContain(love.label)
    // ベース解釈: 引いたカード × 正位置 × カテゴリ
    await expectBodyToContain(love.base[card.number].upright)
    // 回答別アドバイス: fragment ではなく、このカードの advice[選択肢id] が優先表示される
    for (const text of adviceTexts) {
      await expectBodyToContain(text)
    }
    // 通常の解説文は表示しない
    expect(document.body.textContent).not.toContain(card.descriptionUpright)
    expect(document.body.textContent).not.toContain(card.descriptionReversed)
  })

  it('deep が null なら従来通りの解説文（descriptionUpright）を表示する', async () => {
    const card = tarotCards[0]

    useReadingStore.setState({
      // §5.4: status が idle のままだと ResultPage は / へリダイレクトする
      status: 'drawn',
      drawn: {
        card,
        orientation: 'upright',
        keywords: ['キーワードA', 'キーワードB'],
      },
      deep: null,
    })
    mountResult()

    await expectBodyToContain(card.descriptionUpright)
  })
})

describe('詳しく占う: 状態の初期化（§5.7「質問と回答は占いのたびに初期化」）', () => {
  it('reset() で deep が null に戻る（前回の回答を引き継がない）', async () => {
    const work = await loadDeepCategory('work')

    useReadingStore.setState({
      deep: {
        categoryId: 'work',
        categoryLabel: work.label,
        answers: work.questions.map((q) => q.choices[0].id),
      },
    })
    expect(useReadingStore.getState().deep).not.toBeNull()

    useReadingStore.getState().reset()
    expect(useReadingStore.getState().deep).toBeNull()
  })
})
