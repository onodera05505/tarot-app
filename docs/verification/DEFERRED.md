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
