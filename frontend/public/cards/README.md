# Tarot Card Assets

大アルカナの画像(WebP)はこのディレクトリ配下に配置します。

## 推奨配置

- `public/cards/major/00_fool.webp`
- `public/cards/major/01_magician.webp`
- `...`
- `public/cards/major/21_world.webp`

## 命名ルール

- 2桁の番号 + `_` + 英語スラッグ + `.webp`
- 例: `08_strength.webp`

## 参照方法

`public` 配下のファイルは、フロントから `/cards/...` で参照します。

例:
- `/cards/major/00_fool.webp`
