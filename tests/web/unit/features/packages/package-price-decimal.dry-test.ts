import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../src/features/packages/pages/PackageFormPage.vue', import.meta.url),
  'utf8',
)

assert.match(source, /id="package-price"[^>]*step="any"[^>]*inputmode="decimal"/)

console.log('package price decimal dry tests passed')
