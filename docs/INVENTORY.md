---
id: INVENTORY
status: living
---

# ドキュメント棚卸し（Phase 0 成果物、2026-10-03）

分類: `SSOT候補` / `派生物` / `重複` / `不明・死蔵`
処遇: `維持` / `参照化` / `生成対象化` / `attic` / `要判断(→OPEN-QUESTIONS)`

初回判定: `spec-lint validate` は「docs/goals が無いため検証をスキップ」＝ **harness の文書を持たない既存プロジェクト**。抽出の手順（Phase 2〜6）を適用する。

## ドキュメント

| パス | 内容の要約 (1 行) | 分類 | 重複相手 / 導出元 | 処遇と理由 |
| --- | --- | --- | --- | --- |
| `docs/タロットアプリ_要件定義書_v3.md` | 現行の一次資料（概要・構成・スコープ・データ仕様・画面仕様・既知差分・将来フェーズ。306 行） | SSOT候補 | — | **本体**。Phase 2〜5 で vision / 用語集 / GOAL / UC / REQ / BR / 契約 / ADR へ抽出し、行き先が全て決まった時点で attic。What と How が混在（§2・§4・§5 の文言とフェーズ表）→ 要判断 (OQ-08) |
| `backend/docs/タロットアプリ_要件定義書_v2.md` | 2026-04 時点の旧仕様（backend API 前提） | 重複 | v3 が本体 | attic: v3 が全面改訂で置き換えた。ADR の Context の材料として残す |
| `backend/docs/要件定義書20260427.pdf` | v2 と同時期の PDF 版 | 重複 | v2 | attic（同上） |
| `docs/検査と門.md` | 不変条件→門、検査の層→門の表（19 行 + 8 層） | 派生物 | テスト・スクリプトの現物 | 維持（Phase 6 まで）。Phase 6〜7 で `docs/verification/GLOBAL.md` と返済計画に吸収するか要判断 (OQ-09) |
| `docs/AppStore公開手順書.md` | ストア公開の全工程（役割分担・費用・現在地） | SSOT候補（運用手順） | — | 維持: 仕様ではなく運用手順。ストア申請は本人判断で保留中 |
| `docs/引き継ぎ_ストア登録作業.md` | ストア登録作業の引き継ぎメモ | 派生物 | 公開手順書 | 維持（運用手順） |
| `CLAUDE.md` | 作業規約（共通ルール 6 節 + PJ 固有。130 行） | 重複 | harness の `/develop`（仕様先行・独立テスト設計・赤の三分岐） | Phase 7 で経路表に絞る（2026-10-03 本人決定）。「なぜ」と経緯は別文書へ |
| `README.md` / `frontend/README.md` / `backend/README.md` | 概要・構成・コマンド | 派生物 | package.json・構成 | 維持。Phase 7 で旧パスの参照を張り替える |
| `history/*.md`（7 本）・`history/README.md` | 日付ごとの作業記録（意図・判断・未解決） | SSOT候補（記録） | — | 維持: harness の対象外。設計判断は Phase 5 の ADR の材料に使う |
| `brain/**` | ブレイン（報告書 6・アプローチ 1・前提・索引） | SSOT候補（記録） | — | 維持: harness の対象外 |
| `frontend/data/cards.md` | カード 22 枚の編集元（正逆キーワード・解説文） | SSOT候補（データ） | — | 維持: データの正本。値は仕様に写さない (R-102) |
| `frontend/data/deep/*.md`（5 本） | 詳しく占うの編集元（質問・ベース解釈・アドバイス） | SSOT候補（データ） | — | 維持（同上） |
| `frontend/src/data/cards.ts`・`src/data/deep/*.ts` | 上の編集元から生成した TypeScript | 派生物 | `pnpm gen:cards` / `gen:deep` | 生成対象（手で編集しない。現状どおり） |
| `frontend/public/cards/README.md` | 画像の配置規約・出所・サムネイルの規約 | SSOT候補（素材の権利） | — | 維持。サムネイルの判断は ADR の材料 |
| `.github/workflows/deploy.yml` | CI（test → build → deploy） | SSOT候補（運用） | — | 維持。Phase 1 で spec-lint + trace-check を足す |

## コード内の仕様的記述（コメント・README・wiki）

| 場所 | 内容 | 分類 | 処遇 |
| --- | --- | --- | --- |
| `frontend/scripts/gen-deep.mjs` 冒頭 16 行 | 詳しく占うの md 書式・字数・第一文チェックの規則 | 重複（仕様 §4.4） | BR 候補。Phase 4 で規則は BR に、値はスクリプトの定数を SSOT と宣言 (R-102) |
| `frontend/scripts/gen-cards.mjs` 冒頭 11 行 | カードの md 書式と生成規則 | 重複（仕様 §4.1） | 同上 |
| `frontend/src/main.tsx` 8 行 | SW 登録・ネイティブ判定・自動更新の理由 | SSOT候補（決定の記録） | ADR の材料（Phase 5） |
| `frontend/src/lib/features.ts` | 機能フラグの唯一の置き場と理由（§3.3） | 重複（仕様 §3.3） | REQ / BR 候補（Phase 4） |
| `frontend/src/lib/api.ts` | 裏面 URL・サムネイル URL の集約と理由 | SSOT候補（決定の記録） | ADR の材料 |
| `frontend/src/pages/ResultPage.tsx`・`CardDetailPage.tsx` | idle 判定をマウント時にする理由・両面表示の理由 | 重複（仕様 §5.4・§5.5 + brain/reports/06） | REQ の根拠（Phase 4） |
| `frontend/tests/**` の冒頭コメント | どの節を根拠にしたか・仮定の一覧 | 派生物 | Phase 6 の `@covers` の材料 |

## 中核リソースと状態値（用語集の材料）

| エンティティ | 状態値 (コード上の表記そのまま) | 表記揺れの観測 |
| --- | --- | --- |
| `TarotCard` | 状態なし。`id`, `nameEn`, `nameJa`, `number`, `arcanaType`, `meaningUpright`, `meaningReversed`, `descriptionUpright`, `descriptionReversed`, `imageUrl` | 仕様は「カード」「大アルカナ」。`meaning*` は画面では「キーワード」、`description*` は「解説文」 |
| `Orientation` | `'upright'` \| `'reversed'` | 画面と仕様は「正位置」「逆位置」。クエリ `orientation` |
| `DrawnCard` | `card`, `orientation`, `keywords` | 仕様は「占い結果」「結果」 |
| `ReadingStatus` | `'idle'` \| `'drawing'` \| `'drawn'` \| `'error'` | 仕様は「占い状態」「占い結果がない状態（idle）」 |
| 儀式の `Phase` | `'intent'` \| `'shuffling'` \| `'merging'` \| `'split3'` \| `'stacking3'` \| `'split2'` \| `'stacking2'` \| `'rotating'` \| `'orienting'` \| `'transitioning'` | 仕様は「儀式」「儀式フロー」「シャッフル」。コードに「山札」が 1 箇所 |
| `DeepCategoryId` | `'work'` \| `'love'` \| `'study'` \| `'money'` \| `'health'` | 表示は 仕事／友達・恋愛／勉強／お金／健康 |
| `DeepContext` | `categoryId`, `categoryLabel`, `answers`（3 件） | 仕様は「詳しく占うの文脈」 |
| 詳しく占うの文章 | `base`（正逆）, `advice`（選択肢別）, 旧 `fragment` | 仕様は「ベース解釈」「回答別アドバイス」「回答別補足」（v3.1 と v3.2 で語が違う） |
| `HistoryEntry` | `id`, `drawnAt`, `card`, `orientation`, `keywords`, `categoryLabel?`。保存キー `tarot:history` | 仕様は「占い履歴」「履歴」 |
| 本日の一枚 | 保存キー `tarot:todaysCard`（`{ date, drawn }`） | **シェア画像と共有タイトルに「今日の一枚」**（通常の占い結果に対して。OQ-06） |
| 機能フラグ | `DEEP_READING_ENABLED`（boolean） | 仕様は「機能フラグ」「無料版」 |
| 占いの呼び名 | — | 仕様は「占い」20 回・「リーディング」3 回が混在。コードは「占い」のみ |

## 発見した矛盾（→ OPEN-QUESTIONS へ転記済みであること）

| # | 矛盾の内容 | 関係箇所 |
| --- | --- | --- |
| 1 | 仕様 §5.4 に「もう一度占う ※現状未実装 → §6」と残るが、実装済みで §6 は「差分なし」 | 仕様 L232・§6、`ResultPage.tsx`（OQ-03） |
| 2 | 仕様 §6 の「テスト 120 件」は古い（現在 174 件） | 仕様 L276（OQ-04） |
| 3 | 通常の占い結果のシェア画像に「今日の一枚」と出る。仕様の「本日の一枚」は別機能（1 日 1 回・履歴に含めない） | `shareImage.ts` L101・L173、仕様 §5.2（OQ-06） |
| 4 | 仕様 §5.5「クエリで初期表示の正逆を指定」の判別方法（指定側を先・画像の回転）が仕様に無く、テストの契約にだけある | 仕様 §5.5、`CardDetailPage.test.tsx`（OQ-05） |
| 5 | `brain/PREMISES.md` の未決欄に、2026-09-14 に解決済みの「予告表示の定義が無い」が残っていた | Phase 0 と同じコミットで削除（ブレイン側の記録で、移行対象の文書ではない） |

## 移行の結果（Phase 7、2026-10-03）

上の表の各行が、最終的にどこへ落ち着いたか。

| パス | 結果 |
| --- | --- |
| `docs/タロットアプリ_要件定義書_v3.md` | attic（`docs/attic/`）。元の場所に墓標 1 行。中身は vision・用語集・GOAL 8・UC 11・REQ 125（うち取り下げ 3）・BR 6・契約 11・ADR 9 へ抽出済み。構成・型・保存キー・文言と秒数は仕様から外し、ADR・契約・コードの定数が正本（OQ-08） |
| `backend/docs/` の v2 と PDF | attic（`docs/attic/backend-docs/`）。元の場所に墓標 1 行 |
| `docs/検査と門.md` | 参照（維持）。要件に現れないリポジトリの門と検査の層の表として残し、根拠を要件・規則の ID に張り替えた。自前の仕様 lint（`frontend/tests/spec-lint.test.ts`）は v3 の退避と同時に退役（OQ-09） |
| `docs/AppStore公開手順書.md`・`docs/引き継ぎ_ストア登録作業.md` | 参照（維持）。運用手順。ストア申請は保留中 |
| `CLAUDE.md` | SSOT（経路表）に書き直し。旧版は attic（`docs/attic/CLAUDE_作業ルール_2026-10-03まで.md`） |
| `README.md`・`frontend/README.md`・`backend/README.md` | 参照（維持）。旧パスの参照を張り替えた |
| `history/`・`brain/` | SSOT（記録）。harness の対象外 |
| `frontend/data/cards.md`・`frontend/data/deep/*.md` | SSOT（データ）。生成の要件は UC-010 |
| `frontend/src/data/**` | 生成物 |
| `frontend/public/cards/README.md` | SSOT（素材の権利）。サムネイルの判断は ADR-0007 |
| `.github/workflows/deploy.yml` | SSOT（運用）。配る前の検査は 4 段（REQ-080・081）。`spec-gate.yml` を追加 |
| コード内の仕様的記述 | 要件・規則・ADR に抽出し、コード側は `@implements` で指す。値はコードの定数が正本 |
