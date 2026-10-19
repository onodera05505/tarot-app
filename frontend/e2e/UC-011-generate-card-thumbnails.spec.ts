import { test } from '@playwright/test'

// UC-011 カード画像の原本を差し替えてサムネイルを生成する（docs/goals/GOAL-14-content-generation/UC-011-generate-card-thumbnails/UC.md）
// 主シナリオの 5 手順（原本を差し替える → サムネイルの生成を実行 → 枚数と合計容量を示す → 検査を実行 → 揃っていることを示す）は
// すべて運営者の端末上の画像ファイルとスクリプトで起き、契約も operations を持たない（x-no-boundary）。
// ブラウザから起こせる手順も観測できる事後条件も無いので、本文には手順を書かない（捏造しない）。
// 生成・検査の実行コマンドと、実物から切り離す環境変数（GEN_SOURCE_DIR / GEN_OUT_DIR）はホストの CLAUDE.md の「生成」
// 「生成物の同期の検査」の行にある。
// この 1 本は、@scenario UC-011 の存在と参照の門（trace-check C15）のために置く。
test.describe('UC-011', { tag: ['@UC-011'] }, () => {
  // 保留の理由: ブラウザから起こす手順が無く、ホスト駆動（子プロセスでスクリプトを実行）の形に置き換える予定（OQ-35 の 5）。
  // 単体テスト frontend/tests/UC-011-*.test.ts がその層を担っている
  // @scenario UC-011
  test.fixme('UC-011: カード画像の原本を差し替えてサムネイルを生成する', async () => {
    // 手順 1〜5 はすべてホスト上のスクリプトの層。ブラウザから起こせる手順は無い。
  })
})
