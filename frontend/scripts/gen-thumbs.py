#!/usr/bin/env python3
"""カード画像のサムネイルを生成する（public/cards/major/*.webp → public/cards/thumbs/*.webp）。

    pnpm gen:thumbs        # = python3 scripts/gen-thumbs.py

原本は 1024×1536（1 枚 440〜680KB、裏面 582KB）。一覧・履歴・本日の一枚・儀式の山札は
CSS で 60〜88px 幅（DPR 3 で最大 264px）にしか描かないので、原本ではなく幅 320px
（DPR 3 の 88px = 264px に余裕）に縮小したサムネイルを配信する。
結果画面・詳細・シェア画像は原本のまま（大きく描くため）。

環境変数: GEN_SOURCE_DIR（原本の置き場。直下の *.webp を読む。未指定なら public/cards/major）・
GEN_OUT_DIR（書き出し先。直下に同名で書く。未指定なら public/cards/thumbs）。
失敗: 原本を画像として読めない・書き出し先に書けない、のいずれかなら終了コード 1 と標準エラー出力の
理由で止め、どのサムネイルも書き換えない（すべて縮小し終えてから一斉に置き換える）。

生成物はコミットする（CI に Pillow は無い）。原本を差し替えたら再生成する。
URL の対応は src/lib/api.ts の thumbUrl() が唯一の置き場（tests/card-thumbs.test.ts が実在を見る）。
"""
import os
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'cards'
SRC = Path(os.environ.get('GEN_SOURCE_DIR') or ROOT / 'major')
DST = Path(os.environ.get('GEN_OUT_DIR') or ROOT / 'thumbs')
WIDTH, QUALITY = 320, 82


def fail(reason: str) -> None:
    print(f'gen-thumbs: {reason}', file=sys.stderr)
    sys.exit(1)


# @implements REQ-131
def shrink_all(originals: list[Path]) -> list[tuple[Path, bytes]]:
    """すべての原本をメモリ上で縮小する。1 枚でも読めなければ何も書かずに失敗させる。"""
    shrunk: list[tuple[Path, bytes]] = []
    for f in originals:
        try:
            with Image.open(f) as im:
                h = round(im.height * WIDTH / im.width)
                buf = BytesIO()
                im.convert('RGB').resize((WIDTH, h), Image.LANCZOS).save(buf, 'WEBP', quality=QUALITY, method=6)
        except Exception as e:  # Pillow は読めない原本で複数種の例外を投げるので種類で絞らない
            fail(f'原本を画像として読めません: {f.name}（{e}）')
        shrunk.append((f, buf.getvalue()))
    return shrunk


# @implements REQ-131
def write_all(shrunk: list[tuple[Path, bytes]]) -> None:
    """一時ファイルに全部書けてから同名のサムネイルへ置き換える。途中で書けなければ一時ファイルを消して失敗させる。"""
    try:
        DST.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        fail(f'書き出し先を作れません: {DST}（{e}）')
    for f, _ in shrunk:
        out = DST / f.name
        if out.exists() and not out.is_file():
            fail(f'書き出し先に書けません: {out} はファイルではありません')
    temps: list[Path] = []
    try:
        for f, data in shrunk:
            tmp = DST / f'.{f.name}.tmp'
            tmp.write_bytes(data)
            temps.append(tmp)
    except OSError as e:
        for t in temps:
            t.unlink(missing_ok=True)
        fail(f'書き出し先に書けません: {DST}（{e}）')
    for (f, _), tmp in zip(shrunk, temps):
        os.replace(tmp, DST / f.name)


# @implements UC-011, REQ-096
def main() -> None:
    if not SRC.is_dir():
        fail(f'原本の置き場がありません: {SRC}')
    originals = sorted(SRC.glob('*.webp'))
    shrunk = shrink_all(originals)
    write_all(shrunk)
    before = sum(f.stat().st_size for f, _ in shrunk)
    after = sum(len(data) for _, data in shrunk)
    print(f'{len(list(DST.glob("*.webp")))} 枚: {before/1024/1024:.1f}MB → {after/1024:.0f}KB')


if __name__ == '__main__':
    main()
