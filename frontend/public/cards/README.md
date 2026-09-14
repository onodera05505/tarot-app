# Tarot Card Assets

大アルカナの画像(WebP)はこのディレクトリ配下に配置します。

## 出所と権利（2026-09-02 記録）

- 大アルカナ 22 枚 + 裏面は、**開発者本人（小野寺）が Google Gemini Pro の
  画像生成で、独自のプロンプトから生成した**もの。特定の既存デッキや作家の
  作品を参照・入力していない（構図はタロットの伝統的な図像に基づく）
- 第三者のライセンス素材・ストック画像・スキャン画像は含まない
- 初回コミット（2026-04-28, `ca4bda4`）で一括追加
- ストア公開前の再確認事項: 生成時点の Google の生成 AI 利用規約で、
  生成物の商用利用と権利の帰属がどう定められているかを確認し、必要なら
  その規約の版・日付をここに追記する（ストア審査や問い合わせで
  「使用権を説明できる状態」を保つため）

## 推奨配置

- `public/cards/major/00_theFool.webp`
- `public/cards/major/01_theMagician.webp`
- `...`
- `public/cards/major/21_theWorld.webp`
- 裏面: `public/cards/major/000.webp`

## 命名ルール

- 2桁の番号 + `_` + 英語スラッグ + `.webp`（例: `08_strength.webp`）。
  既存ファイルは表記ゆれあり（`01_the_Magician`・`11_Justice`）。揃えるなら
  `cards.md` → `pnpm gen:cards` と同時に行う
- 実ファイル名は `src/data/cards.ts`（`pnpm gen:cards` で生成）の `image` と
  一致させること。テスト `tests/cards-data.test.ts` が実体の存在を検証する

## 参照方法

`public` 配下のファイルは、フロントから `/cards/...` で参照します。

例:
- `/cards/major/00_theFool.webp`

## サムネイル（`thumbs/`、2026-09-14）

一覧・履歴・本日の一枚・儀式の山札は CSS で 60〜88px 幅にしか描かないため、原本（1024×1536）を
320px 幅に縮小した `thumbs/<同名>.webp` を配信する（23 枚で 9.3MB → 約 1.1MB）。
生成は `pnpm gen:thumbs`（Pillow が要る。生成物はコミットする）。原本を差し替えたら再生成する。
URL の対応は `src/lib/api.ts` の `thumbUrl()` だけが知り、`tests/card-thumbs.test.ts` が実在と使用箇所を見る。
結果画面・カード詳細・シェア画像は原本を使う。

