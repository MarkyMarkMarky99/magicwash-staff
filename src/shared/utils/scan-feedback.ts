import { ref } from 'vue'

export type FeedbackOutcome = 'success' | 'failure'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const SOUND_KEY = 'magicwash.scan-feedback.sound'
const VIBRATION_KEY = 'magicwash.scan-feedback.vibration'
type FeedbackPattern = { vibration: number | number[]; beepOffsets: number[]; frequency: number; duration: number }

const PATTERNS: Record<FeedbackOutcome, FeedbackPattern> = {
  success: { vibration: 70, beepOffsets: [0], frequency: 400, duration: 0.25 },
  failure: { vibration: [80, 60, 80], beepOffsets: [0, 0.35], frequency: 400, duration: 0.25 },
}
const BEEP_GAIN = 0.3

function browserStorage(): PreferenceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readFeedbackPreference(storage: PreferenceStorage | null, key: string): boolean {
  try {
    return storage?.getItem(key) !== 'false'
  } catch {
    return true
  }
}

export function writeFeedbackPreference(storage: PreferenceStorage | null, key: string, enabled: boolean): void {
  try {
    storage?.setItem(key, String(enabled))
  } catch {
    return
  }
}

export const soundEnabled = ref(readFeedbackPreference(browserStorage(), SOUND_KEY))
export const vibrationEnabled = ref(readFeedbackPreference(browserStorage(), VIBRATION_KEY))

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled.value = enabled
  writeFeedbackPreference(browserStorage(), SOUND_KEY, enabled)
  if (enabled) void primeFeedbackAudio()
}

export function setVibrationEnabled(enabled: boolean): void {
  vibrationEnabled.value = enabled
  writeFeedbackPreference(browserStorage(), VIBRATION_KEY, enabled)
}

export function canVibrate(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  } catch {
    return false
  }
}

export function feedbackPattern(outcome: FeedbackOutcome): FeedbackPattern {
  return PATTERNS[outcome]
}

let audioContext: AudioContext | null = null

async function readyAudioContext(): Promise<AudioContext | null> {
  try {
    if (typeof window === 'undefined') return null
    const audioWindow = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext
    if (!AudioContextConstructor) return null
    const context = audioContext ?? new AudioContextConstructor()
    audioContext = context
    if (context.state === 'suspended') await context.resume()
    return context.state === 'running' ? context : null
  } catch {
    return null
  }
}

export async function primeFeedbackAudio(): Promise<void> {
  if (soundEnabled.value) await readyAudioContext()
}

async function playBeeps(outcome: FeedbackOutcome): Promise<void> {
  const context = await readyAudioContext()
  if (!context || !soundEnabled.value) return
  try {
    const { beepOffsets, frequency, duration } = feedbackPattern(outcome)
    for (const offset of beepOffsets) {
      const start = context.currentTime + offset
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(BEEP_GAIN, start + 0.01)
      gain.gain.setValueAtTime(BEEP_GAIN, start + duration - 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
      oscillator.start(start)
      oscillator.stop(start + duration + 0.01)
    }
  } catch {
    return
  }
}

export function feedback(outcome: FeedbackOutcome): void {
  if (vibrationEnabled.value && canVibrate()) {
    try {
      navigator.vibrate(feedbackPattern(outcome).vibration)
    } catch {}
  }
  if (soundEnabled.value) void playBeeps(outcome)
}
