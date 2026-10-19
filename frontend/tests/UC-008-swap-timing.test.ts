// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawCards } from '../src/lib/api'
import { tarotCards } from '../src/data/cards'
import type { DrawnCard } from '../src/lib/types'

// UC-008 の要件の文（REQ-083・REQ-128）、UC-008 の表の前書き（「占いの途中」の定義）、契約
// （contract.yaml の registerSW / onNeedRefresh / updateSW / isNativePlatform）、用語集（スタート・
// シャッフルへ・ストップ・山の指定・決定・山の確定・左右選択・トップへ戻る・もう一度占う）だけから設計
// （実装は参照していない）。起動の仕方は UC-009-error-report-init.test.ts、儀式の進め方は
// components/UC-006-ritual-draw-outcome.test.tsx に倣う。
//
// アプリの入口（用語集が名指しする main.tsx）を index.html と同じ土台の上で実際に読み込み、
// 契約の SDK の境界を越える呼び出しだけを観測する。
// - 「新しい版があると分かった」は契約の onNeedRefresh（inbound）をテストから呼ぶことで起こす
// - 「新しい版へ入れ替わる」は契約の updateSW（registerSW が返す関数）が呼ばれたことで観測する
// - 「占いの途中」は画面の操作（スタート〜左右選択）と抽選の差し替え（終わる時点をテストが決める）で作る
// - 版は開発中・報告先なしにして、エラー監視サービスへの報告（UC-009）をこのテストの外に置く

const mocks = vi.hoisted(() => ({
  registerSW: vi.fn(),
  updateSW: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: mocks.isNativePlatform },
  }
})

vi.mock('virtual:pwa-register', () => ({ registerSW: mocks.registerSW }))

// 抽選だけを差し替える（ほかの公開関数は本物のまま）。抽選が終わる時点をテストから決める
vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>()
  return { ...actual, drawCards: vi.fn(actual.drawCards) }
})

// jsdom に Web Audio が無いため効果音は鳴らさない
vi.mock('../src/lib/audio', () => ({
  unlockAudio: vi.fn(),
  playFlip: vi.fn(),
}))

// jsdom 環境では URL が jsdom のものに替わるので、URL を経ずに場所を決める
const REPO_ROOT = `${resolve(import.meta.dirname, '../..')}/`
const UC008_CONTRACT = readFileSync(
  `${REPO_ROOT}docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/contract.yaml`,
  'utf8',
)

/** 契約の registerSW の request にある、ある設定の const。値の正本は UC-008 の contract.yaml */
function registerSWConst(property: string): unknown {
  const block = UC008_CONTRACT.split(/^ {2}registerSW:\n/m)[1]?.split(/^ {2}\S/m)[0] ?? ''
  const found = new RegExp(`^ {8}${property}:\\n(?: {10}.*\\n)*? {10}const: (.+)$`, 'm').exec(block)
  if (!found) throw new Error(`契約の registerSW に ${property} の const が見つからない（契約の形が変わった）`)
  return JSON.parse(found[1])
}

const fixedDrawn: DrawnCard = {
  card: tarotCards[9],
  orientation: 'upright',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
}

/** 抽選を、テストが完了させるまで終わらないものにする。返り値で抽選を成功として完了させる */
function drawPending(): () => Promise<void> {
  let finish!: (cards: DrawnCard[]) => void
  vi.mocked(drawCards).mockImplementation(
    () =>
      new Promise<DrawnCard[]>((resolve) => {
        finish = resolve
      }),
  )
  return async () => {
    finish([fixedDrawn])
    await advance(0)
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** 開発中の版・報告先なし（UC-009 の報告をこのテストの外に置く） */
function stubDevBuild() {
  vi.stubEnv('PROD', false)
  vi.stubEnv('DEV', true)
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('VITE_SENTRY_DSN', '')
}

/** アプリの入口を、index.html の土台の上で起動する（ホーム画面またはブラウザでアプリを開く） */
async function openApp() {
  const html = readFileSync(`${REPO_ROOT}frontend/index.html`, 'utf8')
  // innerHTML で入れた script は実行されない。入口の読み込みは下の import が担う
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ''
  window.history.replaceState({}, '', '/')
  await act(async () => {
    await import('../src/main.tsx')
  })
  // 入口が読み込みの後へ回した処理（描画・登録）が一巡するのを待つ
  await advance(0)
}

/** 保持の仕組みの登録に渡した設定（契約の registerSW の request と inbound の口） */
function registration(): { immediate?: boolean; onNeedRefresh?: () => void } {
  expect(mocks.registerSW, '保持の仕組みが登録されていない').toHaveBeenCalledTimes(1)
  return (mocks.registerSW.mock.calls[0][0] ?? {}) as { immediate?: boolean; onNeedRefresh?: () => void }
}

/** 問い合わせで Web 配信元に新しい版があると分かり、入れ替えられる状態になる（契約の onNeedRefresh） */
async function newVersionArrives() {
  const { onNeedRefresh } = registration()
  expect(onNeedRefresh, '契約の onNeedRefresh を受け取る口が登録に無い').toBeTypeOf('function')
  await act(async () => {
    onNeedRefresh!()
  })
  await advance(0)
}

/** 新しい版へ入れ替わった回数（契約の updateSW が呼ばれた回数） */
function swapCount(): number {
  return mocks.updateSW.mock.calls.length
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

function pile(n: number): HTMLElement {
  return button(`山 ${n}`)
}

/** トップからスタートで儀式へ入る（占うことを思い浮かべる段階） */
async function startRitual() {
  fireEvent.click(button('スタート'))
  await advance(0)
  expect(button('シャッフルへ')).toBeTruthy()
}

/** 儀式の中を、シャッフルへからストップ・山の指定・決定・山の確定を経て左右選択を待つ段階まで進める */
async function proceedToOrienting() {
  fireEvent.click(button('シャッフルへ'))
  fireEvent.click(button('ストップ'))
  await advance(1500)
  expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
  fireEvent.click(pile(1))
  fireEvent.click(pile(2))
  fireEvent.click(pile(3))
  fireEvent.click(button('決定'))
  await advance(2500)
  expect(screen.getByText('どちらかの山を選択してください')).toBeTruthy()
  fireEvent.click(pile(1))
  fireEvent.click(button('OK'))
  await advance(1300)
  await advance(900)
  expect(screen.getByText('どちらを上にするか選択してください')).toBeTruthy()
}

/** 左右選択で左を選び、占い結果へ移る */
async function chooseLeft() {
  fireEvent.click(button('左'))
  await advance(1000)
}

/** 占い結果（占い状態 drawn）を示している状態まで、トップから進める */
async function showDrawnResult() {
  await startRitual()
  await proceedToOrienting()
  await chooseLeft()
  expect(screen.getByText(fixedDrawn.card.nameJa)).toBeTruthy()
  expect(button('トップへ戻る')).toBeTruthy()
}

/** いま画面にある button の名前の一覧（確認を求める表示が増えていないかを見る） */
function buttonNames(): string[] {
  return screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  localStorage.clear()
  stubDevBuild()
  mocks.updateSW.mockReset().mockResolvedValue(undefined)
  mocks.registerSW.mockReset().mockReturnValue(mocks.updateSW)
  // UC-008 の契約の例 web（ネイティブのアプリではない）
  mocks.isNativePlatform.mockReset().mockReturnValue(false)
  vi.mocked(drawCards).mockReset()
  vi.mocked(drawCards).mockImplementation(async () => [fixedDrawn])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

// UC-008
describe('新しい版があると分かったときの入れ替えの時機（UC-008）', () => {
  describe('占いの途中でないとき', () => {
    // @covers REQ-083#registers-immediate
    it('保持の仕組みを、契約の immediate の指定で登録する', async () => {
      await openApp()

      expect(registration().immediate).toBe(registerSWConst('immediate'))
    })

    // @covers REQ-083#swap-outside-reading
    it('トップを示している（占い状態 idle）ときに新しい版があると分かると、確認を求めずその場で入れ替わる', async () => {
      await openApp()
      expect(button('スタート')).toBeTruthy()
      const buttonsBefore = buttonNames()

      await newVersionArrives()

      expect(swapCount()).toBe(1)
      expect(buttonNames()).toEqual(buttonsBefore)
    })
  })

  describe('占いの途中に新しい版があると分かったとき', () => {
    // @covers REQ-128#defer-in-ritual
    it('儀式の中（占うことを思い浮かべる段階）では入れ替わらず、儀式の画面がそのまま続く', async () => {
      await openApp()
      await startRitual()

      await newVersionArrives()

      expect(swapCount()).toBe(0)
      expect(button('シャッフルへ')).toBeTruthy()
    })

    // @covers REQ-128#defer-in-ritual
    it('儀式の中（山の指定を待つ段階）では入れ替わらず、指定の途中の山がそのまま続く', async () => {
      await openApp()
      await startRitual()
      fireEvent.click(button('シャッフルへ'))
      fireEvent.click(button('ストップ'))
      await advance(1500)
      expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
      fireEvent.click(pile(1))

      await newVersionArrives()

      expect(swapCount()).toBe(0)
      expect(screen.getByText('積み上げる順番を指定してください')).toBeTruthy()
      fireEvent.click(pile(2))
      fireEvent.click(pile(3))
      expect(button('決定')).toBeTruthy()
    })

    // @covers REQ-128#defer-in-ritual
    it('占い結果からもう一度占うで儀式へ戻ると、まだ占いの途中なので入れ替わらない', async () => {
      await openApp()
      await showDrawnResult()
      await newVersionArrives()
      expect(swapCount()).toBe(0)

      fireEvent.click(button('もう一度占う'))
      await advance(0)

      expect(swapCount()).toBe(0)
      expect(button('シャッフルへ')).toBeTruthy()
    })

    // @covers REQ-128#defer-while-drawing
    it('占い状態が drawing（抽選がまだ終わらない）の間は入れ替わらず、抽選が終わると占い結果がそのまま示される', async () => {
      const finishDraw = drawPending()
      await openApp()
      await startRitual()
      await proceedToOrienting()
      await chooseLeft()
      expect(screen.queryByText(fixedDrawn.card.nameJa)).toBeNull()

      await newVersionArrives()
      expect(swapCount()).toBe(0)

      await finishDraw()
      expect(swapCount()).toBe(0)
      expect(screen.getByText(fixedDrawn.card.nameJa)).toBeTruthy()
    })

    // @covers REQ-128#defer-while-result-shown
    it('占い状態が drawn の占い結果を示している間は入れ替わらず、占い結果がそのまま示され続ける', async () => {
      await openApp()
      await showDrawnResult()
      const buttonsBefore = buttonNames()

      await newVersionArrives()
      await advance(60_000)

      expect(swapCount()).toBe(0)
      expect(screen.getByText(fixedDrawn.card.nameJa)).toBeTruthy()
      expect(buttonNames()).toEqual(buttonsBefore)
    })

    // @covers REQ-128#swap-after-reading-ends
    it('占い結果でトップへ戻ると、占いの途中でなくなったので操作なしに新しい版へ入れ替わる', async () => {
      await openApp()
      await showDrawnResult()
      await newVersionArrives()
      expect(swapCount()).toBe(0)

      fireEvent.click(button('トップへ戻る'))
      await advance(0)

      expect(swapCount()).toBe(1)
    })

    // @covers REQ-128#swap-after-reading-ends
    it('抽選が終わらないまま新しい版が届き、終わってから占い結果でトップへ戻ると、そこで初めて入れ替わる', async () => {
      const finishDraw = drawPending()
      await openApp()
      await startRitual()
      await proceedToOrienting()
      await chooseLeft()
      await newVersionArrives()
      await finishDraw()
      expect(swapCount()).toBe(0)

      fireEvent.click(button('トップへ戻る'))
      await advance(0)

      expect(swapCount()).toBe(1)
    })
  })
})
