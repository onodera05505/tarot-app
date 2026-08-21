// Web Audio API でタロット世界観に合った効果音を合成する。
// ファイル不要・ライセンス不要・バンドルサイズもほぼゼロ。

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    const w = window as WindowWithWebkit
    const Ctor = window.AudioContext ?? w.webkitAudioContext
    ctx = new Ctor()
    masterGain = ctx.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(ctx.destination)
  }
  return ctx
}

// ブラウザの autoplay policy 対策。
// 初回ユーザー操作時に呼ぶことで AudioContext を起動状態にする。
// 同期的に resume() を呼ぶ + 無音バッファを再生して iOS Safari 対策も入れる。
export function unlockAudio(): void {
  const c = getCtx()
  if (c.state === 'suspended') void c.resume()
  // iOS Safari は無音バッファを1回再生しないと永遠に suspended 扱いになる場合がある
  const buf = c.createBuffer(1, 1, 22050)
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(c.destination)
  src.start(0)
}

function unlock(): AudioContext {
  unlockAudio()
  return getCtx()
}

// めくれ: 短いノイズに band-pass フィルター掃引で「フワッ」とした空気感
export function playFlip(): void {
  const c = unlock()
  const now = c.currentTime
  const dur = 0.55

  // ホワイトノイズ生成
  const bufLen = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, bufLen, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) {
    // 末尾フェードアウトのため i/bufLen で減衰
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen)
  }
  const src = c.createBufferSource()
  src.buffer = buf

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 3
  filter.frequency.setValueAtTime(2400, now)
  filter.frequency.exponentialRampToValueAtTime(700, now + dur)

  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(0.32, now + 0.04)
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(filter).connect(env).connect(masterGain ?? c.destination)
  src.start(now)
  src.stop(now + dur + 0.05)
}
