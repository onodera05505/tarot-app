---
id: VERIFICATION_DEFERRED
status: living
---

# 保留台帳（機械判定できない指摘）

reviewer の指摘のうち、機械検査（spec-lint / trace-check / contract-run / テスト / 型 / lint / hook）に落とせないものだけを 1 行 1 件で持つ。
解消したら行を消す。機械検査へ昇格したら行を消す（縮む方向にしか動かない）。書くのは orchestrator だけ。
機械判定できる指摘はここに書かない — テストか lint に変換して機械側で赤にする。

移行中（docs-migrate）は挙動を変えないので、「テストに落とせるが、落とすと現在の実装が赤になる」指摘もここに置き、昇格先に `test` と書く。
直す順番は返済計画（`docs/verification/REPAYMENT.md`）が持つ。

## 保留中の指摘

| ID | 起票日 | 出所 | 対象 | 指摘 | 機械判定できない理由（反例） | 昇格先 |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/contract.yaml | `loadHistory` の `maxItems: 100` が偽になりうる。端末に残る配列の名前付きスキーマも無い | 端末に 101 件の配列が残っていると、読むときは切らないので 101 件が返る。契約アダプタが未宣言で contract-run が実行されない | contract-run |
| DEF-002 | 2026-10-03 | reviewer | docs/rules/BR-005.md | 無料版でカテゴリ名つきの記録を一覧に示すことが BR-005 に当たるか決まっていない | 有効だった版が書いたカテゴリ名つきの記録が端末にある状態で無料版の占い履歴を開く。期待値を決める文が無い | 未定 |
| DEF-003 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/REQ-008.md | 端末の時計がずれて未来の日時になった記録の扱いが文に無い | 未来の日時の項目を含む一覧。並びは記録順なので位置は変わらないが、日時の表示の期待値が文に無い | 未定 |
| DEF-004 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/contract.yaml | どの要件も観測しないフィールドがある（項目の識別子、カードの英名・種別・解説文・アルカナ番号、本日の一枚の記録のキーワード） | 過去の版が書いた記録との互換のために残す形で、値を変えても観測できる振る舞いが変わらない | 未定 |
| DEF-005 | 2026-10-03 | spec-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/REQ-119.md | 動かして移す・徐々に現す（REQ-119・REQ-120）を機械で確かめる手段が無い | テストの環境は演出を飛ばす設定で、一瞬で置き換える実装でも緑になる。実ブラウザの通しテストが無い（GLOBAL.md） | test |
| DEF-008 | 2026-10-03 | spec-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/REQ-120.md | 全画面に共通の振る舞い（画面の切り替えの演出）を 1 つのユースケースが持っている | 置き場の粒度の問題で、どこに置いても検査は通る | 未定 |
| DEF-009 | 2026-10-03 | spec-author | docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/REQ-093.md | 1 文に 6 条件を列挙していて、長さの警告の閾値の直下にある | 条件を足すと警告になるが、分けるかどうかは粒度の判断 | spec-lint |
| DEF-010 | 2026-10-03 | reviewer | docs/goals/GOAL-01-ritual-reading/UC-007-share-result/contract.yaml | `shareOrDownload` の例が `ok` の 1 件だけで、保存に切り替わる・完了・取り消し・失敗して保存の違いを表せない。`filename` の形とシェア時のタイトルを観測する要件も無い | 共有機能が受け取れない端末の case を置く決まり（ADR-0008）が端末への記録に限られていて、契約アダプタも未宣言 | contract-run |
| DEF-011 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/contract.yaml | `addToHistory` の例の response にある識別子と日時は、時計と乱数で決まる値で、フィクスチャでは固定できない | アダプタができて例を実行すると、実行のたびに値が変わり一致しない | contract-run |
| DEF-012 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/contract.yaml | `registrationUpdate` に response が無く、「同じ版」と「新しい版がある」を境界の形で分けられない | `ok` の例 1 つが UC-008 の表の 2 行（同じ版・新しい版）の両方に当たる。判定は SDK の中 | contract-run |
| DEF-013 | 2026-10-03 | reviewer | docs/adr/ADR-0008-how-to-read-boundaries-for-contracts.md | 契約アダプタと、時間・端末の状態のフィクスチャが無く、契約の例が 1 件も実行されていない | `commands.contract_adapter` が未宣言で、contract-run は「実行されていない」を返す（合格ではない） | contract-run |
| DEF-014 | 2026-10-03 | reviewer | docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/UC.md | 表には行を足した（2026-10-19）が、その経路を実ブラウザで起こせるかは未検証 | 全回答を持ち込んで儀式 → ストップ → 抽選が終わる前にトップを開く → 抽選が完了。抽選が画面の移動より後に終わることを起こせるかは実ブラウザでしか分からない | 未定 |
| DEF-015 | 2026-10-03 | reviewer | docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/REQ-037.md | 無料版で持ち込んだカテゴリと回答が残る前提のクラスがあるが、表は「持ち込めない」とする | 占う人の操作ではその状態を作れず、状態を直接置いた防御の確認になっている | 未定 |
| DEF-017 | 2026-10-03 | reviewer | docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/REQ-090.md | 文が表の `?` のセルより広い要件が残る（REQ-014・086・087・090・091・096） | カテゴリが 1 つも無い編集元、読めない原本が 1 枚ある状態での生成など。文が偽になるかは実行しないと分からず、`?` は未決の穴として残してある | 未定 |
| DEF-018 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/UC.md | 表の行が排他でない（「エラーの表示中」は報告先のあり・なしと直交する） | 報告先なしの版で、エラーの表示中に、通信なしで描画の外のエラーが起きる。1 行は「報告しない」、別の行は未決 | 未定 |
| DEF-020 | 2026-10-03 | test-author | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/REQ-082.md | REQ-013・082 の 6 クラスが未被覆（入口を起動する仕組みは 2026-10-03 に足し、REQ-083・088・122・123・128・129・130 は被覆した） | 保持の仕組みの登録と問い合わせは、差し替えた境界の呼び出しまでしか見えず、文の読みを決めてからテストにする | test |
| DEF-021 | 2026-10-03 | implementer | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/REQ-082.md | REQ-082・084 の条件「入れ替わっている最中でないとき」を判定するコードが無い（文は表の未決のセルを覆わないための絞り込み） | 入れ替わっている最中に前面へ戻すと、最中かどうかを見ずに問い合わせる。そのときの振る舞いは実ブラウザでしか分からない | 未定 |
| DEF-023 | 2026-10-03 | reviewer | docs/01-glossary.md | 「利用者の情報」の定義の「有効にしたときに限り集める」が、SDK が添える分だけを指すのか、サービスが集める情報全般を指すのかで読みが割れる | サービス側が受け取る内容はアプリの外でしか確かめられない | 未定 |
| DEF-024 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/REQ-088.md | 「報告先が設定されていない」を空文字だけで代表し、変数そのものが無い場合を通していない。保持の仕組みのスタブの形が本物の型と結ばれていない | 現行の実装はどちらも正しく動くので赤にならない。クラスを分けるかはテスト設計の判断 | test |
| DEF-025 | 2026-10-19 | reviewer | frontend/scripts/gen-thumbs.py | サムネイルの最後の置き換え（ファイルごとの rename の連鎖）の途中で失敗すると部分適用が残りうる | 既存のサムネイルに不変フラグを立てた状態など、実行でしか作れない。テストが名指すクラス（読めない原本・同名のディレクトリ）では起きない | test |
| DEF-026 | 2026-10-19 | reviewer | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/REQ-083.md | 抽選に失敗した占い結果（占い状態 error）を示している間や、drawn のまま占い結果以外の画面にいる間に新しい版が届くと、「占いの途中」の定義の外なので即入れ替わる（エラーの表示と戻る手段が消える） | 文の上では違反でなく、意図が未確認。含めるなら用語集「占いの途中」の定義を広げる | test |
| DEF-027 | 2026-10-19 | reviewer | frontend/tests/UC-011-gen-thumbs-failure.test.ts | Pillow が無い環境（CI を含む）では skip され、被覆の数え上げだけが残る | 静的な対応の検査は skip を見分けない。CI に Pillow を入れた（2026-10-19）ので、次の CI の実行で走ったことを確かめてから消す | test |
