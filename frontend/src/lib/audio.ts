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

type ToneOpts = {
  type?: OscillatorType
  startTime?: number
  attack?: number
  release?: number
  gain?: number
}

function tone(freq: number, duration: number, opts: ToneOpts = {}): void {
  const c = getCtx()
  const start = opts.startTime ?? c.currentTime
  const attack = opts.attack ?? 0.005
  const peak = opts.gain ?? 0.2

  const osc = c.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.value = freq

  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(peak, start + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(env).connect(masterGain ?? c.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

// プレビュー（1回目タップ）: 短く軽いベル音
export function playPreview(): void {
  unlock()
  const c = getCtx()
  const now = c.currentTime
  tone(1320, 0.24, { startTime: now, gain: 0.45, attack: 0.003, release: 0.2 }) // E6
  tone(1980, 0.2, { startTime: now, gain: 0.18, attack: 0.003 }) // B6 (倍音で煌めき)
}

// 確定（2回目タップ）: クリスタルチャイム風、2音連なり
export function playSelect(): void {
  unlock()
  const c = getCtx()
  const now = c.currentTime
  // 1音目: E5 と倍音
  tone(659.25, 1.4, { startTime: now, gain: 0.4, attack: 0.005 })
  tone(1318.5, 1.0, { startTime: now, gain: 0.16, attack: 0.005 })
  tone(1977.75, 0.7, { startTime: now, gain: 0.07, attack: 0.005 })
  // 2音目（少し遅れて B5 = 完全5度上）
  tone(987.77, 1.2, { startTime: now + 0.18, gain: 0.32, attack: 0.005 })
  tone(1975.54, 0.9, { startTime: now + 0.18, gain: 0.12, attack: 0.005 })
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
