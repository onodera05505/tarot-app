# 作業ルール（経路表）

**このプロジェクトは個人。** 仕様書（`docs/`）が絶対の正解で、実装は常にそれに従う。
作り方の正本は原本 harness（`apm.yml` の `tsay-dev/harness`。`.claude/rules/docs.md`・`.claude/skills/develop/`）。
このファイルは「どの場面で何を読むか」だけを持つ。2026-10-03 までの作業ルールは `docs/attic/CLAUDE_作業ルール_2026-10-03まで.md`。

## 経路（場面 → 読む／使う）

| 場面 | 読む・使う | 読まない |
| --- | --- | --- |
| 着手（毎回） | `brain/PREMISES.md` → `history/` の最新日 → `node .harness/tools/trace-check/trace-check.mjs --index` | `docs/goals/**` の丸読み |
| 挙動を変える（機能追加・仕様変更・不具合修正） | `/develop`（仕様 → 独立したテスト設計 → 実装。親は実装もテストも書かない） | 実装から先に直すこと |
| 要件 1 件の実装・テスト | その `REQ-nnn.md`、隣の `UC.md`、`br:` が指す `docs/rules/BR-nnn.md`、関係する ADR | ほかの要件・全 BR |
| 語に迷う | `docs/01-glossary.md`（禁止同義語つき） | — |
| 何から返すか | `docs/verification/REPAYMENT.md`（順番）と `DEFERRED.md`（機械で見えない指摘） | — |
| 本人に聞くこと | `OPEN-QUESTIONS.md` | — |
| 門の全体像 | `docs/検査と門.md` | — |
| トラブル | `brain/INDEX.md` → `~/.claude/brain/INDEX.md` を症状の語で grep。解決したら報告書を 1 枚還す | 索引の丸読み |
| 作業の型 | `brain/APPROACHES.md`（値つき）と `~/.claude/brain/APPROACHES.md`（型）を作業の語で grep。値と判断は本人に示してから | — |
| 旧仕様の経緯 | `docs/attic/`（更新しない） | — |

## 定常の決まり（原本の規約 ID）

- **上流が先（R-801）**: 実装が仕様の誤りや穴を見つけたら、コードだけ直して終えない。仕様を直し（本人の承認）、契約 → テスト → 実装の順に導き直す。
- **マージの条件（R-803）**: テストが緑 **かつ** trace-check の新規違反が 0。CI（`.github/workflows/deploy.yml`）は 仕様の書式 → 対応 → テスト → 本番ビルド の順に通ってから配る。
- **台帳は縮むだけ（R-804）**: `.trace-baseline.json` は 2026-10-03 の 156 件が上限。増やさない。返したら `--update-baseline` で減らす。
- **人の門は 3 つだけ**: `docs/` の仕様（status を active / frozen / living にするのは本人の承認）、見た目、データの形。担当は自分で承認しない。
- **作る主体と判定する主体を分ける**: テスト設計は実装を読まない。点検（reviewer）は別コンテキストで最大 2 回。緑にするためにテストを曲げない。
- **番号は道具で取る（R-204）**: `trace-check.mjs --next <req|br|uc|goal|adr>`。ID は不変、引退は `status: withdrawn`。
- **移行で採った読み**: 境界の読み方は `docs/adr/ADR-0008-…`、層の向きは `ADR-0009-…`。他のユースケースの要件は `REQ-nnn（UC-xxx の要件）` と書く。

## 記録（指示されなくても回す）

- 作業の区切りごとに `history/YYYY-MM-DD.md` に追記し、コードと同じコミットに入れる（書式は `history/README.md`）。
- **締めの報告と `history/` の各日ファイルの末尾に、還元行を 1 行で入れる**:
  `ブレイン: 参照した型 <名前 か 当たり無し（grep: 引いた語）> / 適用前に確認した値 Y / 追加 Z / 更新 W`
  （無記載は不可。素の「無し」は落ちる。history 側は `frontend/tests/history-return-line.test.ts` が見る）。
- 落とし穴はそのコードのコメントに書く（このファイルには書かない。既存のそうしたコメントは消さない）。
- 性能や原因の断定は実測の数字を出してから。

## コマンド（必ずリポジトリのルートから。`.harness` の中へ cd しない）

| 目的 | コマンド |
| --- | --- |
| 仕様の書式 | `node .harness/tools/spec-lint/spec-lint.mjs validate` |
| 仕様⇔コード⇔テストの対応 | `node .harness/tools/trace-check/trace-check.mjs`（全体の地図は `--index`） |
| 型・Lint・テスト | `pnpm --dir frontend exec tsc -b` / `pnpm --dir frontend lint` / `pnpm --dir frontend test` |
| 本番ビルド | `pnpm --dir frontend build` |
| 生成 | `pnpm --dir frontend gen:cards` / `gen:deep`（編集元は `frontend/data/`。生成物は手で直さない） |
| harness の入れ直し | `apm install`（`.claude/` の担当・規約・skill と `.harness/` は生成物でコミットしない） |

## このプロジェクトの形

- `frontend/`（React 19 + Vite + PWA、zustand、framer-motion、Sentry、Capacitor の Android プロジェクト）。端末だけで完結し、サーバーとの通信は無い（ADR-0001）。`backend/` は参照用の残骸で、対象外。
- テストは `frontend/tests/`（vitest + jsdom）。各テストは直前の行に `// @covers REQ-nnn#class` か `// 仕様外: 理由` を持つ。実装は `@implements` で要件を指す。
- ネイティブは `pnpm build` → `pnpm exec cap sync android` → `pnpm exec cap open android`。ストア申請と Android の実機確認は本人の判断で保留中。
- push は main へ確認なしでよい（2026-09-02）。挙動を変える作業は作業ブランチで行い、検査が通ってから main に入れる。
