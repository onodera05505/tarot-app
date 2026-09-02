# frontend — タロットカード（手軽に本格占い）

React 19 + Vite + PWA。カードデータと鑑定テキストをアプリ内に同梱した
ローカル完結構成（バックエンド通信なし）。一次資料は
`../docs/タロットアプリ_要件定義書_v3.md`、作業ルールは `../CLAUDE.md`。

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm build` | `tsc -b` + 本番ビルド（`dist/`） |
| `pnpm test` / `pnpm test:watch` | vitest（`tests/`。専用 `tsconfig.test.json`） |
| `pnpm lint` | eslint |
| `pnpm gen:cards` | `data/cards.md` → `src/data/cards.ts`（解説テキストの編集元は md） |
| `pnpm gen:deep` | `data/deep/*.md` → `src/data/deep/*.ts`（詳しく占うのテキスト） |
| `pnpm generate-pwa-assets` | `public/icon.svg` から PWA アイコン一式を生成 |

生成物（`src/data/cards.ts`・`src/data/deep/*.ts`）は手で編集しない。

## デプロイ

`main` への push で GitHub Actions がテスト → ビルド → Cloudflare Pages
（`tarot-oracle`）へデプロイする（`../.github/workflows/deploy.yml`）。
wrangler はこのパッケージの devDependencies に入っている。

## 素材の出所

カード画像は `public/cards/README.md` を参照。
