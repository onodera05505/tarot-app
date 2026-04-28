import type { DrawnCard } from './types'

// シェア画像の寸法（Instagram ストーリー相当 9:16）
const W = 1080
const H = 1920

// アプリ世界観に合わせた色
const COLOR_BG_INNER = '#2a1a55'
const COLOR_BG_OUTER = '#0b0820'
const COLOR_ACCENT = '#f5d76e'
const COLOR_TEXT = '#e6e1ff'
const COLOR_TEXT_DIM = '#b6acd9'

const FONT_JA = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif"
const FONT_EN = "'Hiragino Mincho ProN', 'Yu Mincho', serif"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  reversed: boolean,
) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.clip()

  if (reversed) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate(Math.PI)
    ctx.translate(-(x + w / 2), -(y + h / 2))
  }
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()

  // 縁取り
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(245, 215, 110, 0.55)'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.restore()
}

export async function generateShareImage(drawn: DrawnCard): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  // 背景: ラジアルグラデーション + 周辺を暗く
  const grad = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, H)
  grad.addColorStop(0, COLOR_BG_INNER)
  grad.addColorStop(1, COLOR_BG_OUTER)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ヘッダー: アプリ名
  ctx.fillStyle = COLOR_ACCENT
  ctx.textAlign = 'center'
  ctx.font = `300 64px ${FONT_EN}`
  ctx.letterSpacing = '0.32em' // 一部ブラウザのみ
  ctx.fillText('Tarot', W / 2, 180)

  ctx.fillStyle = COLOR_TEXT_DIM
  ctx.font = `36px ${FONT_JA}`
  ctx.fillText('今日の一枚', W / 2, 250)

  // カード画像
  const cardW = 600
  const cardH = Math.round(cardW * 1.5)
  const cardX = (W - cardW) / 2
  const cardY = 340

  try {
    const img = await loadImage(drawn.card.imageUrl)
    drawRoundedImage(
      ctx,
      img,
      cardX,
      cardY,
      cardW,
      cardH,
      24,
      drawn.orientation === 'reversed',
    )
  } catch {
    // 画像読み込み失敗 → プレースホルダ
    ctx.fillStyle = 'rgba(245, 215, 110, 0.1)'
    ctx.fillRect(cardX, cardY, cardW, cardH)
  }

  // カード名
  ctx.fillStyle = COLOR_TEXT
  ctx.font = `400 80px ${FONT_JA}`
  ctx.fillText(drawn.card.nameJa, W / 2, cardY + cardH + 130)

  // 正位置 / 逆位置
  ctx.fillStyle = COLOR_ACCENT
  ctx.font = `400 44px ${FONT_JA}`
  ctx.fillText(
    drawn.orientation === 'upright' ? '正位置' : '逆位置',
    W / 2,
    cardY + cardH + 200,
  )

  // キーワード（横幅オーバー対策で最大4つ）
  ctx.fillStyle = COLOR_TEXT_DIM
  ctx.font = `300 36px ${FONT_JA}`
  const keywordsText = drawn.keywords.slice(0, 4).join('   ・   ')
  ctx.fillText(keywordsText, W / 2, cardY + cardH + 280)

  // フッター: ドメイン
  ctx.fillStyle = 'rgba(182, 172, 217, 0.5)'
  ctx.font = `300 26px ${FONT_EN}`
  ctx.fillText('tarot-oracle-3qs.pages.dev', W / 2, H - 80)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode image'))
    }, 'image/png')
  })
}

// 画像 Blob を共有 or ダウンロードする
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })

  // Web Share API (file 対応) が使えるなら共有シートへ
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: 'Tarot - 今日の一枚',
        text,
      })
      return
    } catch (e) {
      // ユーザーがキャンセル → 何もしない（落とさない）
      if (e instanceof Error && e.name === 'AbortError') return
      // 失敗 → ダウンロードへフォールバック
    }
  }

  // フォールバック: ダウンロード
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
