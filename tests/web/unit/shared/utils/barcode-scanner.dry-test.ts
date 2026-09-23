import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeFormats, type DetectorConstructor } from '@/shared/utils/barcode-scanner-selection'
import { startScanLoop } from '@/shared/utils/barcode-scanner-loop'

function fakeDetector(formats: string[]): DetectorConstructor {
  return class {
    static async getSupportedFormats(): Promise<string[]> { return formats }
    async detect(): Promise<[]> { return [] }
  } as DetectorConstructor
}

test('uses the ponyfill when native BarcodeDetector is absent', async () => {
  assert.equal(await nativeFormats({}), null)
})

test('uses the ponyfill when native BarcodeDetector cannot decode QR codes', async () => {
  assert.equal(await nativeFormats({ BarcodeDetector: fakeDetector(['code_128']) }), null)
})

test('limits the native detector to the supported requested formats', async () => {
  assert.deepEqual(await nativeFormats({ BarcodeDetector: fakeDetector(['qr_code', 'ean_13']) }), ['qr_code'])
  assert.deepEqual(await nativeFormats({ BarcodeDetector: fakeDetector(['code_128', 'qr_code', 'ean_13']) }), ['qr_code', 'code_128'])
})

test('waits for each full-frame decode and ignores results after stop', async () => {
  const callbacks = new Map<number, () => void>()
  let nextId = 0
  let decodeCount = 0
  let resolveDecode: ((results: { rawValue: string; format: string }[]) => void) | undefined
  const values: [string, string][] = []
  const video = {
    readyState: 2,
    requestVideoFrameCallback(callback: () => void) {
      callbacks.set(++nextId, callback)
      return nextId
    },
    cancelVideoFrameCallback(id: number) { callbacks.delete(id) },
  } as unknown as HTMLVideoElement
  const detector = {
    detect(source: HTMLVideoElement) {
      assert.equal(source, video)
      decodeCount += 1
      return new Promise<{ rawValue: string; format: string }[]>(resolve => { resolveDecode = resolve })
    },
  }
  const stop = startScanLoop(video, detector, (value, format) => values.push([value, format]), error => { throw error }, () => true)

  const first = callbacks.get(1)
  assert.ok(first)
  callbacks.delete(1)
  first()
  assert.equal(decodeCount, 1)
  assert.equal(callbacks.size, 0)
  resolveDecode?.([{ rawValue: 'first', format: 'qr_code' }])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(values, [['first', 'qr_code']])
  assert.equal(callbacks.size, 1)

  const second = callbacks.get(2)
  assert.ok(second)
  callbacks.delete(2)
  second()
  assert.equal(decodeCount, 2)
  stop()
  resolveDecode?.([{ rawValue: 'late', format: 'code_128' }])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(values, [['first', 'qr_code']])
  assert.equal(callbacks.size, 0)
})
