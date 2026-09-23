import { ref } from 'vue'

export type FeedbackOutcome = 'success' | 'failure'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const SOUND_KEY = 'magicwash.scan-feedback.sound'
const VIBRATION_KEY = 'magicwash.scan-feedback.vibration'
const PATTERNS: Record<FeedbackOutcome, { vibration: number | number[]; beepOffsets: number[] }> = {
  success: { vibration: 70, beepOffsets: [0] },
  failure: { vibration: [80, 60, 80], beepOffsets: [0, 0.15] },
}

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

export function feedbackPattern(outcome: FeedbackOutcome): { vibration: number | number[]; beepOffsets: number[] } {
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
    for (const offset of feedbackPattern(outcome).beepOffsets) {
      const start = context.currentTime + offset
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(outcome === 'success' ? 880 : 440, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
      oscillator.start(start)
      oscillator.stop(start + 0.11)
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
