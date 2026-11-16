import { EventBus, type AudioSfx } from '../events/EventBus'

export interface AudioSettings {
  bgmMuted: boolean
  sfxMuted: boolean
  bgmVolume: number
  sfxVolume: number
}

const STORAGE_KEY = 'tq_audio_settings'

// Một file nhạc nền dùng chung cho mọi khu vực.
// Đặt file tại: frontend/public/assets/audio/nhacnen.mp3
const BGM_URL = '/assets/audio/nhacnen.mp3'

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>
      return {
        bgmMuted: typeof parsed.bgmMuted === 'boolean' ? parsed.bgmMuted : false,
        sfxMuted: typeof parsed.sfxMuted === 'boolean' ? parsed.sfxMuted : false,
        bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : 0.55,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 0.75,
      }
    }
  } catch {
    // Fallback nếu localStorage bị chặn
  }
  return { bgmMuted: false, sfxMuted: false, bgmVolume: 0.55, sfxVolume: 0.75 }
}

function saveSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Bỏ qua lỗi
  }
}

class AudioManagerClass {
  private ctx: AudioContext | null = null
  private settings: AudioSettings = loadSettings()
  private currentArea = ''
  private bgmGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private duckGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private audioElement: HTMLAudioElement | null = null
  private synthLoopId: number | null = null
  private isDucked = false
  private audioFilesAvailable = new Map<string, boolean>()

  constructor() {
    this.setupListeners()
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return

    // Tự mở AudioContext khi người dùng tương tác lần đầu (Autoplay policy)
    const unlock = () => {
      this.ensureContext()
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      // Nếu nhạc nền bị trình duyệt chặn autoplay trước đó, thử phát lại
      if (this.audioElement && this.audioElement.paused && !this.settings.bgmMuted && !document.hidden) {
        this.audioElement.play().catch(() => {})
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    // Tự dừng khi tab bị ẩn
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {})
        }
        if (this.audioElement) {
          this.audioElement.pause()
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended' && !this.settings.bgmMuted) {
          this.ctx.resume().catch(() => {})
        }
        if (this.audioElement && !this.settings.bgmMuted) {
          this.audioElement.play().catch(() => {})
        }
      }
    })

    // Lắng nghe sự kiện từ EventBus
    EventBus.on('audio:bgm', (areaId) => this.playBgm(areaId))
    EventBus.on('audio:playSfx', (sfx) => this.playSfx(sfx))
    EventBus.on('audio:duck', (duck) => this.setDuck(duck))
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      this.ctx = new AudioCtx()

      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)

      this.bgmGain = this.ctx.createGain()
      this.duckGain = this.ctx.createGain()
      this.duckGain.gain.setValueAtTime(1, this.ctx.currentTime)
      this.bgmGain.connect(this.duckGain)
      this.duckGain.connect(this.masterGain)

      this.sfxGain = this.ctx.createGain()
      this.sfxGain.connect(this.masterGain)

      this.applyGains()
      return this.ctx
    } catch {
      return null
    }
  }

  private applyGains(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const bgmEffective = this.settings.bgmMuted ? 0 : this.settings.bgmVolume
    const sfxEffective = this.settings.sfxMuted ? 0 : this.settings.sfxVolume

    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(now)
      this.bgmGain.gain.linearRampToValueAtTime(bgmEffective, now + 0.1)
    }
    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(now)
      this.sfxGain.gain.linearRampToValueAtTime(sfxEffective, now + 0.05)
    }
    if (this.audioElement) {
      this.audioElement.volume = bgmEffective * (this.isDucked ? 0.35 : 1)
      this.audioElement.muted = this.settings.bgmMuted
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings }
  }

  public setSettings(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch }
    saveSettings(this.settings)
    this.applyGains()
    if (patch.bgmMuted !== undefined && !patch.bgmMuted && this.currentArea) {
      this.playBgm(this.currentArea)
    }
  }

  public toggleBgmMute(): boolean {
    const next = !this.settings.bgmMuted
    this.setSettings({ bgmMuted: next })
    return next
  }

  public toggleSfxMute(): boolean {
    const next = !this.settings.sfxMuted
    this.setSettings({ sfxMuted: next })
    return next
  }

  public setDuck(duck: boolean): void {
    this.isDucked = duck
    if (!this.ctx || !this.duckGain) {
      if (this.audioElement) {
        const bgmEffective = this.settings.bgmMuted ? 0 : this.settings.bgmVolume
        this.audioElement.volume = bgmEffective * (duck ? 0.35 : 1)
      }
      return
    }
    const now = this.ctx.currentTime
    const target = duck ? 0.35 : 1
    this.duckGain.gain.cancelScheduledValues(now)
    this.duckGain.gain.linearRampToValueAtTime(target, now + 0.25)
    if (this.audioElement) {
      const bgmEffective = this.settings.bgmMuted ? 0 : this.settings.bgmVolume
      this.audioElement.volume = bgmEffective * target
    }
  }

  // ───────────────────────── BGM ─────────────────────────
  public async playBgm(areaId: string): Promise<void> {
    this.currentArea = areaId
    const ctx = this.ensureContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    // Kiểm tra xem file nhạc nền dùng chung có tồn tại không
    let hasFile = this.audioFilesAvailable.get(BGM_URL)

    if (hasFile === undefined) {
      try {
        const res = await fetch(BGM_URL, { method: 'HEAD' })
        hasFile = res.ok
        this.audioFilesAvailable.set(BGM_URL, hasFile)
      } catch {
        hasFile = false
        this.audioFilesAvailable.set(BGM_URL, false)
      }
    }

    // Dừng nhạc synth cũ (nếu có)
    if (this.synthLoopId !== null) {
      window.clearInterval(this.synthLoopId)
      this.synthLoopId = null
    }

    if (hasFile) {
      if (!this.audioElement) {
        this.audioElement = new Audio()
        this.audioElement.loop = true
      }

      // Chỉ gán src khi chưa phát file này, để đổi khu vực không bị phát lại từ đầu
      if (!this.audioElement.src.endsWith(BGM_URL)) {
        this.audioElement.src = BGM_URL
      }

      this.audioElement.volume = (this.settings.bgmMuted ? 0 : this.settings.bgmVolume) * (this.isDucked ? 0.35 : 1)
      this.audioElement.muted = this.settings.bgmMuted

      // Chỉ gọi play() nếu đang dừng, tránh ngắt quãng nhạc đang chạy
      if (this.audioElement.paused && !this.settings.bgmMuted) {
        this.audioElement.play().catch(() => {})
      }
      return
    }

    // Nếu không có file thật: dùng WebAudio procedural BGM synth!
    if (this.audioElement) {
      this.audioElement.pause()
    }
    this.startProceduralBgm(areaId)
  }

  private startProceduralBgm(areaId: string): void {
    if (!this.ctx || !this.bgmGain) return

    // Bộ nốt nhạc ngũ cung/thăng hoa vui tươi cho từng khu vực
    // Tần số Hz
    const NOTES: Record<string, number> = {
      C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
      B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
      A5: 880.00, C6: 1046.50, F4: 349.23, F5: 698.46,
    }

    interface Pattern {
      bpm: number
      scale: number[]
      bass: number[]
      instrument: 'ukulele' | 'rhodes' | 'synth' | 'guitar' | 'piano' | 'orchestral'
    }

    const PATTERNS: Record<string, Pattern> = {
      plaza: {
        bpm: 120, // Cheerful ukulele & glockenspiel
        scale: [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.A5, NOTES.G5, NOTES.E5, NOTES.D5, NOTES.C5],
        bass: [NOTES.C4, NOTES.G4, NOTES.A4, NOTES.F4],
        instrument: 'ukulele',
      },
      library: {
        bpm: 80, // Soft tranquil acoustic bells & Rhodes
        scale: [NOTES.E5, NOTES.G5, NOTES.B4, NOTES.D5, NOTES.C5, NOTES.E5, NOTES.A4, NOTES.C5],
        bass: [NOTES.A4, NOTES.F4, NOTES.C4, NOTES.G4],
        instrument: 'rhodes',
      },
      lab: {
        bpm: 128, // Fast electronic techno blips
        scale: [NOTES.C5, NOTES.G5, NOTES.D5, NOTES.A5, NOTES.C6, NOTES.G5, NOTES.E5, NOTES.D5],
        bass: [NOTES.C4, NOTES.D4, NOTES.F4, NOTES.G4],
        instrument: 'synth',
      },
      garden: {
        bpm: 96, // Serene acoustic guitar & bird chimes
        scale: [NOTES.G4, NOTES.C5, NOTES.D5, NOTES.E5, NOTES.G5, NOTES.A5, NOTES.G5, NOTES.D5],
        bass: [NOTES.G4, NOTES.C4, NOTES.E4, NOTES.D4],
        instrument: 'guitar',
      },
      courtyard: {
        bpm: 84, // Nostalgic lyrical piano
        scale: [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5, NOTES.G5, NOTES.E5, NOTES.D5, NOTES.C5],
        bass: [NOTES.A4, NOTES.F4, NOTES.D4, NOTES.E4],
        instrument: 'piano',
      },
      hall: {
        bpm: 92, // Warm grand ceremonial celesta
        scale: [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.B4, NOTES.G5, NOTES.A5, NOTES.E5],
        bass: [NOTES.C4, NOTES.A4, NOTES.F4, NOTES.G4],
        instrument: 'orchestral',
      },
    }

    const pat = PATTERNS[areaId] ?? PATTERNS.plaza
    const stepTime = (60 / pat.bpm) * 0.5 // 16th note step
    let step = 0

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || this.settings.bgmMuted) return
      const now = this.ctx.currentTime

      // Nốt chính
      const noteFreq = pat.scale[step % pat.scale.length]
      if (noteFreq && step % 2 === 0) {
        this.synthPluck(noteFreq, now, pat.instrument, 0.22)
      }

      // Nốt bass đệm
      if (step % 8 === 0) {
        const bassFreq = pat.bass[Math.floor(step / 8) % pat.bass.length]
        if (bassFreq) {
          this.synthBass(bassFreq / 2, now, pat.instrument === 'synth' ? 'sawtooth' : 'triangle', 0.28)
        }
      }

      // Glockenspiel lấp lánh ở phách lẻ
      if (step % 4 === 2 && (pat.instrument === 'ukulele' || pat.instrument === 'orchestral')) {
        this.synthPluck(noteFreq * 2, now, 'ukulele', 0.12)
      }

      step = (step + 1) % 64
    }

    // Chạy loop bằng setInterval
    this.synthLoopId = window.setInterval(playStep, stepTime * 1000)
  }

  private synthPluck(freq: number, startTime: number, type: string, volume: number): void {
    if (!this.ctx || !this.bgmGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type === 'synth' ? 'sawtooth' : type === 'rhodes' ? 'sine' : type === 'ukulele' ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35)

    osc.connect(gain)
    gain.connect(this.bgmGain)

    osc.start(startTime)
    osc.stop(startTime + 0.38)
  }

  private synthBass(freq: number, startTime: number, oscType: OscillatorType, volume: number): void {
    if (!this.ctx || !this.bgmGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = oscType
    osc.frequency.setValueAtTime(freq, startTime)

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume * 0.35, startTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8)

    osc.connect(gain)
    gain.connect(this.bgmGain)

    osc.start(startTime)
    osc.stop(startTime + 0.85)
  }

  // ───────────────────────── SFX ─────────────────────────
  public async playSfx(name: AudioSfx): Promise<void> {
    if (this.settings.sfxMuted) return
    const ctx = this.ensureContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    // Thử nạp file SFX nếu có
    const fileUrl = `/assets/audio/sfx_${name.toLowerCase()}.mp3`
    let hasFile = this.audioFilesAvailable.get(fileUrl)
    if (hasFile === undefined) {
      try {
        const res = await fetch(fileUrl, { method: 'HEAD' })
        hasFile = res.ok
        this.audioFilesAvailable.set(fileUrl, hasFile)
      } catch {
        hasFile = false
        this.audioFilesAvailable.set(fileUrl, false)
      }
    }

    if (hasFile) {
      const a = new Audio(fileUrl)
      a.volume = this.settings.sfxVolume
      a.play().catch(() => {})
      return
    }

    // Tổng hợp âm thanh SFX bằng WebAudio
    this.synthesizeSfx(name)
  }

  private synthesizeSfx(name: AudioSfx): void {
    if (!this.ctx || !this.sfxGain) return
    const now = this.ctx.currentTime

    switch (name) {
      case 'xp': {
        // Chuỗi nốt lấp lánh vui mừng
        const notes = [523.25, 659.25, 783.99, 1046.50]
        notes.forEach((freq, idx) => {
          this.quickBeep(freq, now + idx * 0.05, 0.15, 'sine', 0.3)
        })
        break
      }
      case 'levelUp': {
        // Hợp âm rạng rỡ thăng hoa
        const notes = [440, 554.37, 659.25, 880, 1108.73]
        notes.forEach((freq, idx) => {
          this.quickBeep(freq, now + idx * 0.08, 0.35, 'triangle', 0.4)
        })
        break
      }
      case 'item': {
        // Pop-tingle nhặt đồ
        this.quickBeep(784, now, 0.08, 'sine', 0.3)
        this.quickBeep(1174.66, now + 0.06, 0.14, 'triangle', 0.35)
        break
      }
      case 'achievement': {
        // Hợp âm vinh quang
        const chords = [523.25, 659.25, 783.99, 1046.50]
        chords.forEach((freq) => {
          this.quickBeep(freq, now, 0.6, 'triangle', 0.3)
          this.quickBeep(freq * 1.5, now + 0.18, 0.8, 'sine', 0.35)
        })
        break
      }
      case 'npc': {
        // Giọng nói NPC thân thiện
        this.quickBeep(330, now, 0.06, 'sine', 0.25)
        this.quickBeep(440, now + 0.05, 0.09, 'sine', 0.3)
        break
      }
      case 'dialogOpen': {
        this.quickBeep(350, now, 0.05, 'triangle', 0.2)
        this.quickBeep(520, now + 0.04, 0.08, 'sine', 0.25)
        break
      }
      case 'dialogClose': {
        this.quickBeep(420, now, 0.04, 'sine', 0.2)
        this.quickBeep(280, now + 0.03, 0.06, 'sine', 0.18)
        break
      }
      case 'portal': {
        // Vòng xoáy ma thuật
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.35)
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
        osc.connect(gain)
        gain.connect(this.sfxGain)
        osc.start(now)
        osc.stop(now + 0.42)
        break
      }
      case 'footstep': {
        // Tiếng bước chân nhẹ
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(110 + Math.random() * 20, now)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
        osc.connect(gain)
        gain.connect(this.sfxGain)
        osc.start(now)
        osc.stop(now + 0.06)
        break
      }
      case 'button': {
        // Click nút UI
        this.quickBeep(600, now, 0.03, 'square', 0.12)
        break
      }
      case 'minigameCorrect': {
        // Đôi chuông thánh thót
        this.quickBeep(659.25, now, 0.12, 'triangle', 0.35)
        this.quickBeep(987.77, now + 0.1, 0.25, 'sine', 0.4)
        break
      }
      case 'minigameWrong': {
        // Âm nhẹ báo sai
        this.quickBeep(260, now, 0.12, 'sawtooth', 0.2)
        this.quickBeep(220, now + 0.1, 0.18, 'sawtooth', 0.2)
        break
      }
      case 'questComplete': {
        // Hoàn thành nhiệm vụ
        const fan = [440, 554, 659, 880]
        fan.forEach((f, i) => this.quickBeep(f, now + i * 0.08, 0.3, 'triangle', 0.35))
        this.quickBeep(1108.73, now + 0.32, 0.6, 'sine', 0.45)
        break
      }
    }
  }

  private quickBeep(freq: number, time: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.ctx || !this.sfxGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, time)

    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(volume * 0.35, time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)

    osc.connect(gain)
    gain.connect(this.sfxGain)

    osc.start(time)
    osc.stop(time + duration + 0.02)
  }
}

export const AudioManager = new AudioManagerClass()