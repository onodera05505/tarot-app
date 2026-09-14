#!/usr/bin/env python3
"""カード画像のサムネイルを生成する（public/cards/major/*.webp → public/cards/thumbs/*.webp）。

    pnpm gen:thumbs        # = python3 scripts/gen-thumbs.py

原本は 1024×1536（1 枚 440〜680KB、裏面 582KB）。一覧・履歴・本日の一枚・儀式の山札は
CSS で 60〜88px 幅（DPR 3 で最大 264px）にしか描かないのに原本を配信していた（2026-09-02 計測、
2026-09-14 対処）。ここでは幅 320px（DPR 3 の 88px = 264px に余裕）で書き出す。
結果画面・詳細・シェア画像は原本のまま（大きく描くため）。

生成物はコミットする（CI に Pillow は無い）。原本を差し替えたら再生成する。
URL の対応は src/lib/api.ts の thumbUrl() が唯一の置き場（tests/card-thumbs.test.ts が実在を見る）。
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'cards'
SRC, DST = ROOT / 'major', ROOT / 'thumbs'
WIDTH, QUALITY = 320, 82

def main() -> None:
    DST.mkdir(exist_ok=True)
    before = after = 0
    for f in sorted(SRC.glob('*.webp')):
        im = Image.open(f)
        h = round(im.height * WIDTH / im.width)
        out = DST / f.name
        im.convert('RGB').resize((WIDTH, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
        before += f.stat().st_size; after += out.stat().st_size
    print(f'{len(list(DST.glob("*.webp")))} 枚: {before/1024/1024:.1f}MB → {after/1024:.0f}KB')

if __name__ == '__main__':
    main()
