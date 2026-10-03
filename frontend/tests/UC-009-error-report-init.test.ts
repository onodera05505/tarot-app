// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// UC-009 の要件の文（REQ-088・122・123）と契約（UC-009 の contract.yaml の init / errorBoundary、
// UC-008 の contract.yaml の registerSW / isNativePlatform）だけから設計（実装は参照していない）。
//
// アプリの入口（用語集が名指しする main.tsx）を、index.html と同じ土台の上で実際に読み込み、
// 契約の SDK の境界を越える呼び出しだけを観測する。入口の中の記号には触れない。
// - 本番の版・報告先は用語集の識別子（import.meta.env.PROD / VITE_SENTRY_DSN）で差し替える
// - 期待値は契約の const から読む（下の initConst）。実装の値を写さない
// - `virtual:pwa-register` は vitest.config.ts の別名で tests/stubs/pwa-register.ts に解決され、
//   ここではさらに vi.mock で差し替える（別名が無いと入口の読み込みで止まる）

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  registerSW: vi.fn(),
  isNativePlatform: vi.fn(),
}))

// 契約の境界だけを差し替える。SDK のほかの出口は本物のまま残す（入口が何を使うかをテストが決めないため）
vi.mock('@sentry/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/react')>()
  return {
    ...actual,
    init: mocks.init,
    // errorBoundary: 描画中のエラーが無いあいだは中身をそのまま描く
    ErrorBoundary: ({ children }: { children?: unknown }) => children ?? null,
  }
})

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: mocks.isNativePlatform },
  }
})

vi.mock('virtual:pwa-register', () => ({ registerSW: mocks.registerSW }))

// jsdom 環境では URL が jsdom のものに替わるので、URL を経ずに場所を決める
const REPO_ROOT = `${resolve(import.meta.dirname, '../..')}/`
const UC009_CONTRACT = readFileSync(
  `${REPO_ROOT}docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/contract.yaml`,
  'utf8',
)

/** 契約の init の、ある設定の const。値の正本は UC-009 の contract.yaml（ここへ値を直書きしない） */
function initConst(property: string): unknown {
  const initBlock = UC009_CONTRACT.split(/^ {2}init:\n/m)[1]?.split(/^ {2}\S/m)[0] ?? ''
  const found = new RegExp(`^ {8}${property}:\\n(?: {10}.*\\n)*? {10}const: (.+)$`, 'm').exec(initBlock)
  if (!found) throw new Error(`契約の init に ${property} の const が見つからない（契約の形が変わった）`)
  return JSON.parse(found[1])
}

/** 報告先の例。契約の init の examples.ok の dsn と同じ値 */
const REPORTER = 'https://examplePublicKey@o0.ingest.sentry.io/0'

/** 版と報告先を、配信するビルドが持つ形（PROD と DEV は必ず逆）で差し替える */
function stubBuild({ production, reporter }: { production: boolean; reporter: string }) {
  vi.stubEnv('PROD', production)
  vi.stubEnv('DEV', !production)
  vi.stubEnv('MODE', production ? 'production' : 'development')
  vi.stubEnv('VITE_SENTRY_DSN', reporter)
}

/** アプリの入口を、index.html の土台の上で起動する（アプリを開く） */
async function openApp() {
  const html = readFileSync(`${REPO_ROOT}frontend/index.html`, 'utf8')
  // innerHTML で入れた script は実行されない。入口の読み込みは下の import が担う
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ''
  await import('../src/main.tsx')
  // 入口が読み込みの後へ回した処理（描画・登録）が一巡するのを待つ
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** 報告を始めるときに渡した設定（契約の init の request） */
function initOptions(): Record<string, unknown> {
  expect(mocks.init).toHaveBeenCalledTimes(1)
  return mocks.init.mock.calls[0][0] as Record<string, unknown>
}

beforeEach(() => {
  vi.resetModules()
  mocks.init.mockReset()
  mocks.registerSW.mockReset()
  // UC-008 の契約の例 web（ネイティブのアプリではない）
  mocks.isNativePlatform.mockReset().mockReturnValue(false)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// UC-009
describe('アプリを開いたときのエラー監視サービスへの報告の始め方（UC-009）', () => {
  describe('本番の版・報告先あり', () => {
    beforeEach(() => {
      stubBuild({ production: true, reporter: REPORTER })
    })

    // @covers REQ-123#default-user-info-disabled
    it('利用者の情報を既定で送る設定を無効にして、報告先を渡して報告を始める', async () => {
      await openApp()

      const options = initOptions()
      expect(options.dsn).toBe(REPORTER)
      expect(options.sendDefaultPii).toBe(initConst('sendDefaultPii'))
      // 契約の const が「無効」であること自体も固定する（契約が有効へ戻ったらここで落ちる）
      expect(options.sendDefaultPii).toBe(false)
    })

    // @covers REQ-122#no-performance-measurement
    it('性能の計測を送らない設定で報告を始める', async () => {
      await openApp()

      const options = initOptions()
      expect(options.tracesSampleRate).toBe(initConst('tracesSampleRate'))
      expect(options.tracesSampleRate).toBe(0)
    })

    // @covers REQ-122#no-operation-recording
    it('操作の記録を、常時もエラーが起きたときも送らない設定で報告を始める', async () => {
      await openApp()

      const options = initOptions()
      expect(options.replaysSessionSampleRate).toBe(initConst('replaysSessionSampleRate'))
      expect(options.replaysOnErrorSampleRate).toBe(initConst('replaysOnErrorSampleRate'))
      expect(options.replaysSessionSampleRate).toBe(0)
      expect(options.replaysOnErrorSampleRate).toBe(0)
    })
  })

  describe('報告先なし', () => {
    // @covers REQ-088#dev-build-no-report
    it.each([
      ['報告先が設定されている', REPORTER],
      ['報告先が設定されていない', ''],
    ])('開発中の版では、%s ときも報告を始めない', async (_label, reporter) => {
      stubBuild({ production: false, reporter })

      await openApp()

      expect(mocks.init).not.toHaveBeenCalled()
    })

    // @covers REQ-088#prod-without-reporter-no-report
    it('本番の版でも、報告先が設定されていなければ報告を始めない', async () => {
      stubBuild({ production: true, reporter: '' })

      await openApp()

      expect(mocks.init).not.toHaveBeenCalled()
    })
  })
})
