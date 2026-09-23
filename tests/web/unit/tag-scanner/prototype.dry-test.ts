import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../../../../src/features/tag-scanner/pages/TagScannerPrototypePage.vue', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../../../../src/features/tag-scanner/routes.ts', import.meta.url), 'utf8')

test('prototype uses the shared scanner and preserves camera controls', () => {
  assert.match(source, /startBarcodeScanner\(video, acceptResult/)
  assert.match(source, /width: \{ ideal: 1280 \}/)
  assert.match(source, /height: \{ ideal: 720 \}/)
  assert.match(source, /track\.applyConstraints\(/)
  assert.match(source, /format === 'qr_code' \? 'QR Code' : 'Code 128'/)
  assert.match(source, /seenValues\.has\(value\)/)
  assert.match(source, /navigator\.vibrate\?\.\(70\)/)
  assert.match(source, /audioContext\.createOscillator\(\)/)
  assert.match(routes, /TagScannerPrototypePage\.vue/)
})
