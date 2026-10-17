import { test } from '@playwright/test'

// UC-010 編集元を直して内容を生成する（docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/UC.md）
// 主シナリオの 6 手順（編集元を直す → 生成を実行 → 書式を確かめる → 生成物と件数を示す → 検査を実行 → 揃っていることを示す）は
// すべて運営者の端末上のファイルとスクリプトで起き、契約も operations を持たない（x-no-boundary）。
// ブラウザから起こせる手順も観測できる事後条件も無いので、本文には手順を書かない（捏造しない）。
// 生成・検査の実行コマンドは UC にもホストの CLAUDE.md にも名が無く、このテストから導けない（報告の (d)）。
// この 1 本は、@scenario UC-010 の存在と参照の門（trace-check C15）のために置く。
test.describe('UC-010', { tag: ['@UC-010'] }, () => {
  // 保留の理由: 主シナリオにブラウザから起こせる手順が無く、スクリプトを駆動する形の通しテストは実行コマンドが SSOT に無いので書けない
  // @scenario UC-010
  test.fixme('UC-010: 編集元を直して内容を生成する', async () => {
    // 手順 1〜6 はすべてホスト上のスクリプトの層。ブラウザから起こせる手順は無い。
  })
})
