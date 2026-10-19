// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDefaultIntegrations } from '@sentry/react'
import type { BrowserOptions } from '@sentry/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// UC-009 の要件の文（REQ-087・REQ-129・REQ-130）と契約（UC-009 の contract.yaml の init の release / integrations、
// UC-008 の contract.yaml の registerSW / isNativePlatform）、用語集（ビルド識別子・稼働中の版 = `__APP_VERSION__`）
// だけから設計（実装は参照していない）。起動の仕方は UC-009-error-report-init.test.ts に倣う。
//
// アプリの入口（用語集が名指しする main.tsx）を index.html と同じ土台の上で実際に読み込み、
// 契約の init に渡した設定だけを観測する。
// - integrations は、契約の説明どおり「既定の一覧に関数で手を入れる形」なら既定の一覧に適用した結果で見る
// - 既定の一覧は SDK 自身（契約が名指しする getDefaultIntegrations）から取り、名前を直書きしない

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  registerSW: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@sentry/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/react')>()
  return {
    ...actual,
    init: mocks.init,
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

/** 報告先の例。契約の init の examples.ok の dsn と同じ値 */
const REPORTER = 'https://examplePublicKey@o0.ingest.sentry.io/0'

/** 訪問の記録を送る、エラー監視サービスの既定の一覧の項目の名前（契約の init の integrations の not const） */
const SESSION_INTEGRATION = 'BrowserSession'

/** 本番の版・報告先ありを、配信するビルドが持つ形（PROD と DEV は必ず逆）で差し替える */
function stubProductionWithReporter() {
  vi.stubEnv('PROD', true)
  vi.stubEnv('DEV', false)
  vi.stubEnv('MODE', 'production')
  vi.stubEnv('VITE_SENTRY_DSN', REPORTER)
}

/** アプリの入口を、index.html の土台の上で起動する（アプリを開く） */
async function openApp() {
  const html = readFileSync(`${REPO_ROOT}frontend/index.html`, 'utf8')
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ''
  await import('../src/main.tsx')
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** 報告を始めるときに渡した設定（契約の init の request） */
function initOptions(): BrowserOptions {
  expect(mocks.init).toHaveBeenCalledTimes(1)
  return mocks.init.mock.calls[0][0] as BrowserOptions
}

/** 渡した integrations を、契約の説明どおり既定の一覧に適用した結果の名前の一覧にする */
function appliedIntegrationNames(options: BrowserOptions): string[] {
  const given = options.integrations
  expect(given, '契約の init で必須の integrations が渡されていない').toBeDefined()
  const applied = typeof given === 'function' ? given(getDefaultIntegrations(options)) : given!
  return applied.map((integration) => integration.name)
}

beforeEach(() => {
  vi.resetModules()
  mocks.init.mockReset()
  mocks.registerSW.mockReset()
  // UC-008 の契約の例 web（ネイティブのアプリではない）
  mocks.isNativePlatform.mockReset().mockReturnValue(false)
  stubProductionWithReporter()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// UC-009
describe('本番の版・報告先ありでアプリを開いたときに報告へ添えるもの・送らないもの（UC-009）', () => {
  // @covers REQ-129#release-is-build-id
  it('報告を始めるとき、稼働中の版のビルド識別子を release として渡す', async () => {
    await openApp()

    const options = initOptions()
    expect(options.release).toBeTypeOf('string')
    expect(options.release).not.toBe('')
    expect(options.release).toBe(__APP_VERSION__)
  })

  // @covers REQ-130#no-browser-session
  it('既定の一覧に適用した結果の integrations に、訪問の記録を送る項目が無い', async () => {
    await openApp()

    const options = initOptions()
    // 前提の確認: 既定の一覧には訪問の記録を送る項目が入っている（入っていなければこの要件は意味を持たない）
    expect(getDefaultIntegrations(options).map((integration) => integration.name)).toContain(SESSION_INTEGRATION)

    expect(appliedIntegrationNames(options)).not.toContain(SESSION_INTEGRATION)
  })

  // @covers REQ-087#keeps-default-handlers
  it('訪問の記録を外しても、既定の一覧のほかの項目（描画の外のエラーを捉える手を含む）はすべて残る', async () => {
    await openApp()

    const options = initOptions()
    const expected = getDefaultIntegrations(options)
      .map((integration) => integration.name)
      .filter((name) => name !== SESSION_INTEGRATION)

    expect([...appliedIntegrationNames(options)].sort()).toEqual([...expected].sort())
  })
})
