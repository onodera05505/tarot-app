# タロットカード — ワンオラクル占いアプリ

大アルカナ 22 枚から 1 枚を引いて占う Web アプリ。シャッフルからカットまでの「儀式」を
手で進める演出、正位置・逆位置の解釈、悩み別の「詳しく占う」を備え、
PWA としてブラウザでも、Capacitor 経由で Android アプリとしても動く。

**デモ:** https://tarot-oracle-3qs.pages.dev

## 特徴

- **儀式フロー** — シャッフル → 多段カット → 1 枚引きを、アニメーション付きで自分の手で進める
- **正逆解釈** — 22 枚 × 正位置・逆位置のキーワードと解説文。カード解説一覧・詳細ページあり
- **詳しく占う** — 友達・恋愛 / 仕事 / お金 / 勉強 / 健康の 5 カテゴリ。3 問の質疑応答を経て、
  カードの解釈と回答の組み合わせから結果文を合成する（全組み合わせを書かずに済む設計）
- **本日の一枚・履歴・シェア画像** — localStorage のみで完結し、サーバーもアカウントも不要
- **PWA + Android** — 同じ `dist/` を Web と Capacitor で共有。ネイティブでは Service Worker を
  使わず、更新はストア経由に統一

## 技術構成

| 層 | 技術 |
| --- | --- |
| UI | React 19 / TypeScript / Vite / React Router |
| 状態 | zustand（永続化は localStorage） |
| 演出 | framer-motion |
| ネイティブ | Capacitor（Android。appId `com.onodera.tarot`） |
| テスト | Vitest + Testing Library + jsdom |
| 監視 | Sentry（本番かつ DSN 設定時のみ初期化） |
| 配信 | Cloudflare Pages（GitHub Actions で main への push ごとにテスト → ビルド → デプロイ） |

バックエンド（`backend/`、Cloudflare Workers + Prisma）は初期構成の名残で、
現在はフロント完結に移行したため CI でもビルドしていない。

## コンテンツの作り方

解釈文は Markdown を編集元にして TypeScript を生成する。生成先は手で触らない。

| 編集元 | 生成コマンド | 生成先 |
| --- | --- | --- |
| `frontend/data/cards.md` | `pnpm gen:cards` | `src/data/cards.ts` |
| `frontend/data/deep/*.md` | `pnpm gen:deep` | `src/data/deep/*.ts` |

生成スクリプトは書式（字数・第一文にジャンル語が入っているか等）を検査し、
崩れていれば失敗させる。テストも画像の実在やデータの整合を検証する。

カード画像 22 枚と裏面は、開発者本人が画像生成 AI で独自のプロンプトから作成したもの
（詳細は `frontend/public/cards/README.md`）。

## 開発

```bash
cd frontend
pnpm install
pnpm dev        # 開発サーバー
pnpm test       # テスト
pnpm build      # dist/ を生成
```

Android:

```bash
pnpm build && npx cap sync android && npx cap open android
```

## ディレクトリ

```
frontend/
  src/pages/        トップ・儀式・結果・カード一覧/詳細・履歴・詳しく占う
  src/components/   本日の一枚、アニメーション、フォールバック UI
  src/data/         生成済みのカード・占いデータ
  src/store/        zustand ストア
  data/             Markdown の編集元
  tests/            Vitest
  android/          Capacitor が生成した Android プロジェクト
docs/               要件定義書 v3、ストア公開手順
history/            作業記録
brain/              不具合の報告書と索引
```
