import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { cors } from 'hono/cors'

type RateLimiter = {
  limit(opts: { key: string }): Promise<{ success: boolean }>
}

type Bindings = {
  DATABASE_URL: string
  RATE_LIMITER: RateLimiter
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

// レート制限: IP 単位、1分あたり 60 リクエストまで（wrangler.jsonc で設定）。
async function rateLimitMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  const { success } = await c.env.RATE_LIMITER.limit({ key: ip })
  if (!success) {
    return c.json(
      { success: false, message: 'Too many requests. Please try again in a minute.' },
      429,
    )
  }
  await next()
}

app.use('/api/*', rateLimitMiddleware)

// PrismaClient の初期化
// ※ Cloudflare Workers環境では、各リクエストごとにインスタンス化するのが一般的です
const getPrisma = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

app.get('/', (c) => {
  return c.text('Tarot App Backend API is running!')
})

// 🃏 全てのカード情報を取得する
app.get('/api/cards', async (c) => {
  const prisma = getPrisma(c.env.DATABASE_URL)
  try {
    const cards = await prisma.tarotCard.findMany({
      orderBy: { number: 'asc' } // 番号順に並べる
    })
    return c.json({
      success: true,
      data: cards
    })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'Failed to fetch cards' }, 500)
  } finally {
    await prisma.$disconnect()
  }
})

// 🃏 特定のカード1枚をIDで取得する
app.get('/api/cards/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const prisma = getPrisma(c.env.DATABASE_URL)
  try {
    const card = await prisma.tarotCard.findUnique({
      where: { id }
    })
    if (!card) {
      return c.json({ success: false, message: 'Card not found' }, 404)
    }
    return c.json({ success: true, data: card })
  } catch (error) {
    return c.json({ success: false, message: 'Database error' }, 500)
  } finally {
    await prisma.$disconnect()
  }
})

// 🔮 ワンオラクル（将来の N 枚スプレッドに拡張できるよう count クエリで枚数指定可）
// GET /api/draw            → 1枚
// GET /api/draw?count=3    → 3枚（重複なし、各カードに正逆ランダム）
app.get('/api/draw', async (c) => {
  const rawCount = c.req.query('count')
  const parsed = rawCount === undefined ? 1 : Number(rawCount)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return c.json({ success: false, message: 'count must be a positive integer' }, 400)
  }

  const prisma = getPrisma(c.env.DATABASE_URL)
  try {
    const cards = await prisma.tarotCard.findMany()
    if (cards.length === 0) {
      return c.json({ success: false, message: 'No cards available' }, 500)
    }
    if (parsed > cards.length) {
      return c.json(
        { success: false, message: `count exceeds available cards (${cards.length})` },
        400,
      )
    }

    // Fisher-Yates で先頭 count 枚を抽出（重複なし）
    const shuffled = [...cards]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const picked = shuffled.slice(0, parsed)

    const drawn = picked.map((card) => {
      const orientation: 'upright' | 'reversed' =
        Math.random() < 0.5 ? 'upright' : 'reversed'
      const meaning = orientation === 'upright' ? card.meaningUpright : card.meaningReversed
      const keywords = meaning
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
      return { card, orientation, keywords }
    })

    return c.json({ success: true, data: { count: drawn.length, cards: drawn } })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'Failed to draw cards' }, 500)
  } finally {
    await prisma.$disconnect()
  }
})

export default app
