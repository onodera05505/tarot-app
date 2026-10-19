import { test } from '@playwright/test'

// UC-010 編集元を直して内容を生成する（docs/goals/GOAL-14-content-generation/UC-010-generate-content-from-sources/UC.md）
// 主シナリオの 6 手順（編集元を直す → 生成を実行 → 書式を確かめる → 生成物と件数を示す → 検査を実行 → 揃っていることを示す）は
// すべて運営者の端末上のファイルとスクリプトで起き、契約も operations を持たない（x-no-boundary）。
// ブラウザから起こせる手順も観測できる事後条件も無いので、本文には手順を書かない（捏造しない）。
// 生成・検査の実行コマンドと、実物から切り離す環境変数（GEN_SOURCE_DIR / GEN_OUT_DIR）はホストの CLAUDE.md の「生成」
// 「生成物の同期の検査」の行にある。
// この 1 本は、@scenario UC-010 の存在と参照の門（trace-check C15）のために置く。
test.describe('UC-010', { tag: ['@UC-010'] }, () => {
  // 保留の理由: ブラウザから起こす手順が無く、ホスト駆動（子プロセスでスクリプトを実行）の形に置き換える予定（OQ-35 の 5）。
  // 単体テスト frontend/tests/UC-010-*.test.ts がその層を担っている
  // @scenario UC-010
  test.fixme('UC-010: 編集元を直して内容を生成する', async () => {
    // 手順 1〜6 はすべてホスト上のスクリプトの層。ブラウザから起こせる手順は無い。
  })
})
