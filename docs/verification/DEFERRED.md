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
| DEF-006 | 2026-10-03 | spec-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/UC.md | 儀式の行が占い状態の軸を持たず、初期化を経ずに儀式へ入り直す経路を表が表していない | 占い結果 → ブラウザの戻るで儀式 → ストップで抽選に失敗。前の占い結果が残ったまま error になる | 未定 |
| DEF-007 | 2026-10-03 | spec-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/REQ-112.md | 抽選に失敗した後も、左右選択を待つ段階で「引いている途中」と示し続ける（現行を文にした。占う人には誤解を招く） | 文は現行と一致するのでテストは緑になる。直すかどうかは仕様の判断 | 未定 |
| DEF-008 | 2026-10-03 | spec-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/REQ-120.md | 全画面に共通の振る舞い（画面の切り替えの演出）を 1 つのユースケースが持っている | 置き場の粒度の問題で、どこに置いても検査は通る | 未定 |
| DEF-009 | 2026-10-03 | spec-author | docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/REQ-093.md | 1 文に 6 条件を列挙していて、長さの警告の閾値の直下にある | 条件を足すと警告になるが、分けるかどうかは粒度の判断 | spec-lint |
| DEF-010 | 2026-10-03 | reviewer | docs/goals/GOAL-01-ritual-reading/UC-007-share-result/contract.yaml | `shareOrDownload` の例が `ok` の 1 件だけで、保存に切り替わる・完了・取り消し・失敗して保存の違いを表せない。`filename` の形とシェア時のタイトルを観測する要件も無い | 共有機能が受け取れない端末の case を置く決まり（ADR-0008）が端末への記録に限られていて、契約アダプタも未宣言 | contract-run |
| DEF-011 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/contract.yaml | `addToHistory` の例の response にある識別子と日時は、時計と乱数で決まる値で、フィクスチャでは固定できない | アダプタができて例を実行すると、実行のたびに値が変わり一致しない | contract-run |
| DEF-012 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/contract.yaml | `registrationUpdate` に response が無く、「同じ版」と「新しい版がある」を境界の形で分けられない | `ok` の例 1 つが UC-008 の表の 2 行（同じ版・新しい版）の両方に当たる。判定は SDK の中 | contract-run |
| DEF-013 | 2026-10-03 | reviewer | docs/adr/ADR-0008-how-to-read-boundaries-for-contracts.md | 契約アダプタと、時間・端末の状態のフィクスチャが無く、契約の例が 1 件も実行されていない | `commands.contract_adapter` が未宣言で、contract-run は「実行されていない」を返す（合格ではない） | contract-run |
| DEF-014 | 2026-10-03 | reviewer | docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/UC.md | 表が「儀式の外で、持ち込んだまま結果の確定が起きる」を表せない | 全回答を持ち込んで儀式 → ストップ → 抽選が終わる前にトップを開く → 抽選が完了。抽選が画面の移動より後に終わることを起こせるかは実ブラウザでしか分からない | 未定 |
| DEF-015 | 2026-10-03 | reviewer | docs/goals/GOAL-02-deep-reading/UC-005-read-deep-reading/REQ-037.md | 無料版で持ち込んだカテゴリと回答が残る前提のクラスがあるが、表は「持ち込めない」とする | 占う人の操作ではその状態を作れず、状態を直接置いた防御の確認になっている | 未定 |
| DEF-016 | 2026-10-03 | reviewer | docs/goals/GOAL-05-reading-history/UC-001-review-reading-history/REQ-007.md | 占い履歴からの「占いを始める」が、トップへ移るだけか儀式を直接始めるか、占い状態を初期化するかが文から決まらない | 占い結果 → 占い履歴へ直接到達 → 全削除を承諾 → 空の画面から占いを始める、の行き先と占い状態の期待値を決める文が無い | test |
| DEF-017 | 2026-10-03 | reviewer | docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/REQ-090.md | 文が表の `?` のセルより広い要件が残る（REQ-014・086・087・090・091・096） | カテゴリが 1 つも無い編集元、読めない原本が 1 枚ある状態での生成など。文が偽になるかは実行しないと分からず、`?` は未決の穴として残してある | 未定 |
| DEF-018 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/UC.md | 表の行が排他でない（「エラーの表示中」は報告先のあり・なしと直交する） | 報告先なしの版で、エラーの表示中に、通信なしで描画の外のエラーが起きる。1 行は「報告しない」、別の行は未決 | 未定 |
| DEF-019 | 2026-10-03 | test-author | docs/goals/GOAL-01-ritual-reading/UC-006-draw-and-read/REQ-116.md | 効果音を鳴らせない端末で、占い結果は示されるが捕まえていない例外が出る。クラス `#no-sound-still-shows-result` が未被覆 | 仕様から書いたテストは赤になる。移行中は挙動を変えないので、テストを置けない | test |
| DEF-020 | 2026-10-03 | test-author | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/REQ-082.md | REQ-013・082・083 の 6 クラスが未被覆（入口を起動する仕組みは 2026-10-03 に足し、REQ-088・122・123 は被覆した） | 保持の仕組みの登録と問い合わせは、差し替えた境界の呼び出しまでしか見えず、文の読みを決めてからテストにする | test |
| DEF-021 | 2026-10-03 | implementer | docs/goals/GOAL-07-release-awareness/UC-008-release-new-version/REQ-082.md | REQ-082・084 の条件「入れ替わっている最中でないとき」を判定するコードが無い（文は表の未決のセルを覆わないための絞り込み） | 入れ替わっている最中に前面へ戻すと、最中かどうかを見ずに問い合わせる。そのときの振る舞いは実ブラウザでしか分からない | 未定 |
| DEF-022 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/UC.md | エラー監視の SDK の既定に訪問の記録が入っているが、どの要件も言っていない。ビルド識別子を渡すと画面の移動ごとに送られ始める | 今は識別子が無く送る直前に捨てられるので、テストは緑のまま。「送らない」を要件にするかは仕様の判断 | test |
| DEF-023 | 2026-10-03 | reviewer | docs/01-glossary.md | 「利用者の情報」の定義の「有効にしたときに限り集める」が、SDK が添える分だけを指すのか、サービスが集める情報全般を指すのかで読みが割れる | サービス側が受け取る内容はアプリの外でしか確かめられない | 未定 |
| DEF-024 | 2026-10-03 | reviewer | docs/goals/GOAL-07-release-awareness/UC-009-notice-device-errors/REQ-088.md | 「報告先が設定されていない」を空文字だけで代表し、変数そのものが無い場合を通していない。保持の仕組みのスタブの形が本物の型と結ばれていない | 現行の実装はどちらも正しく動くので赤にならない。クラスを分けるかはテスト設計の判断 | test |
