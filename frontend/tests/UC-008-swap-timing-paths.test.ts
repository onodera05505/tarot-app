// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawCards } from '../src/lib/api'
import { tarotCards } from '../src/data/cards'
import type { DrawnCard } from '../src/lib/types'

// UC-008 の要件の文（REQ-128）、UC-008 の表の前書き（「占いの途中」の定義）、契約（contract.yaml の
// registerSW / onNeedRefresh / updateSW / isNativePlatform）、用語集（直接到達・占いの途中・儀式・
// スタート・シャッフルへ・トップへ戻る）、UC-006 の REQ-132（直接到達の直後は占うことを思い浮かべる
// 段階から儀式が始まる）だけから設計（実装は参照していない）。起動の仕方と儀式の進め方は
// UC-008-swap-timing.test.ts に倣う。
//
// このファイルが見るのは「占いの途中かどうかの判定が、その画面へ到達した経路やアドレスの表記に
// 依らない」こと。要件の文は「占いの途中」を占う人のいる場所と占い状態で定めており、
// どのアドレスから儀式へ入ったか、アドレスの末尾にスラッシュがあるかは条件に入っていない。
// - 「新しい版があると分かった」は契約の onNeedRefresh（inbound）をテストから呼ぶことで起こす
// - 「新しい版へ入れ替わる」は契約の updateSW（registerSW が返す関数）が呼ばれたことで観測する
// - 「儀式へ直接到達する」はアプリを儀式のアドレス（末尾にスラッシュのある表記）で開くことで起こす
// - 版は開発中・報告先なしにして、エラー監視サービスへの報告（UC-009）をこのテストの外に置く

const mocks = vi.hoisted(() => ({
  registerSW: vi.fn(),
  // ケースごとに新しい関数へ差し替える（beforeEach）。入口が作る React root はテストから unmount
  // できず、前のケースのアプリが window の popstate を聞いたまま残るため、関数を共有すると
  // 残骸のアプリが別のケースの入れ替え回数に混ざる
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

// 抽選だけを差し替える（ほかの公開関数は本物のまま）
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

/** 儀式のアドレス（末尾にスラッシュのある表記。ルーターはスラッシュ無しと同じ儀式の画面を出す） */
const RITUAL_ADDRESS_WITH_TRAILING_SLASH = '/shuffle/'
/** 占い結果のアドレス（末尾にスラッシュのある表記） */
const RESULT_ADDRESS_WITH_TRAILING_SLASH = '/result/'

const fixedDrawn: DrawnCard = {
  card: tarotCards[9],
  orientation: 'upright',
  keywords: ['テスト専用キーワード甲', 'テスト専用キーワード乙'],
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

/** アプリの入口を、index.html の土台の上で、指定のアドレスで起動する（アドレスの指定による直接到達） */
async function openAppAt(address: string) {
  const html = readFileSync(`${REPO_ROOT}frontend/index.html`, 'utf8')
  // innerHTML で入れた script は実行されない。入口の読み込みは下の import が担う
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ''
  window.history.replaceState({}, '', address)
  await act(async () => {
    await import('../src/main.tsx')
  })
  // 入口が読み込みの後へ回した処理（描画・登録）が一巡するのを待つ
  await advance(0)
}

/** 開いたまま、アドレスの表記だけを別の形へ移す（ブラウザの履歴の移動として画面に伝える） */
async function moveAddressTo(address: string) {
  await act(async () => {
    window.history.pushState({}, '', address)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  })
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

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  localStorage.clear()
  stubDevBuild()
  mocks.updateSW = vi.fn().mockResolvedValue(undefined)
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
describe('新しい版があると分かったときの入れ替えの時機は到達した経路やアドレスの表記に依らない（UC-008）', () => {
  describe('占いの途中に新しい版があると分かったとき', () => {
    // @covers REQ-128#defer-in-ritual
    it('アドレスの指定（末尾にスラッシュのある表記）で儀式へ直接到達した占うことを思い浮かべる段階でも入れ替わらず、儀式の画面がそのまま続く', async () => {
      await openAppAt(RITUAL_ADDRESS_WITH_TRAILING_SLASH)
      // 直接到達の直後は占うことを思い浮かべる段階から儀式が始まる（UC-006 の REQ-132）
      expect(button('シャッフルへ')).toBeTruthy()

      await newVersionArrives()

      expect(swapCount()).toBe(0)
      expect(button('シャッフルへ')).toBeTruthy()
    })

    // @covers REQ-128#defer-in-ritual
    it('アドレスの指定（末尾にスラッシュのある表記）で儀式へ直接到達してから山の指定へ進んだ段階でも入れ替わらず、指定の途中の山がそのまま続く', async () => {
      await openAppAt(RITUAL_ADDRESS_WITH_TRAILING_SLASH)
      expect(button('シャッフルへ')).toBeTruthy()
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

    // @covers REQ-128#defer-while-result-shown
    it('占い結果を示したままアドレスが末尾にスラッシュのある表記へ移っていても入れ替わらず、占い結果がそのまま示され続ける', async () => {
      await openAppAt('/')
      await showDrawnResult()
      await moveAddressTo(RESULT_ADDRESS_WITH_TRAILING_SLASH)
      expect(screen.getByText(fixedDrawn.card.nameJa)).toBeTruthy()

      await newVersionArrives()
      await advance(60_000)

      expect(swapCount()).toBe(0)
      expect(screen.getByText(fixedDrawn.card.nameJa)).toBeTruthy()
    })
  })
})
