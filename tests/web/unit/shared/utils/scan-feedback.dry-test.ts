import assert from 'node:assert/strict'
import { feedbackPattern, readFeedbackPreference, setSoundEnabled, setVibrationEnabled, soundEnabled, vibrationEnabled, writeFeedbackPreference } from '@/shared/utils/scan-feedback'

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
}

assert.equal(readFeedbackPreference(storage, 'sound'), true)
assert.equal(readFeedbackPreference(storage, 'vibration'), true)
writeFeedbackPreference(storage, 'sound', false)
assert.equal(readFeedbackPreference(storage, 'sound'), false)
assert.equal(readFeedbackPreference(storage, 'vibration'), true)
writeFeedbackPreference(storage, 'vibration', false)
assert.equal(readFeedbackPreference(storage, 'vibration'), false)
writeFeedbackPreference(storage, 'sound', true)
assert.equal(readFeedbackPreference(storage, 'sound'), true)
assert.equal(readFeedbackPreference(null, 'sound'), true)
writeFeedbackPreference(null, 'sound', false)

const blockedStorage = {
  getItem: (_key: string): string | null => { throw new Error('blocked') },
  setItem: (_key: string, _value: string): void => { throw new Error('blocked') },
}
assert.equal(readFeedbackPreference(blockedStorage, 'sound'), true)
assert.doesNotThrow(() => writeFeedbackPreference(blockedStorage, 'sound', false))

assert.deepEqual(feedbackPattern('success'), { vibration: 70, beepOffsets: [0] })
assert.deepEqual(feedbackPattern('failure'), { vibration: [80, 60, 80], beepOffsets: [0, 0.15] })

const previousSound = soundEnabled.value
const previousVibration = vibrationEnabled.value
setSoundEnabled(false)
setVibrationEnabled(false)
assert.equal(soundEnabled.value, false)
assert.equal(vibrationEnabled.value, false)
setSoundEnabled(previousSound)
setVibrationEnabled(previousVibration)

console.log('scan-feedback.dry-test: OK')
