import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const promptSource = readFileSync(
  new URL('../../../../../../src/features/orders/components/OrderImageWeightPrompt.vue', import.meta.url),
  'utf8',
)
const overlayRouteSource = readFileSync(
  new URL('../../../../../../src/features/orders/composables/use-order-overlay-route.ts', import.meta.url),
  'utf8',
)

test('weight prompt owns only transient input and resets when reopened', () => {
  assert.match(promptSource, /defineProps<\{ open: boolean \}>/)
  assert.match(promptSource, /const rawWeight = ref\(''\)/)
  assert.match(promptSource, /const weightError = ref<string \| null>\(null\)/)
  assert.match(promptSource, /watch\(\(\) => props\.open, \(isOpen\) =>/)
  assert.match(promptSource, /rawWeight\.value = ''/)
  assert.match(promptSource, /weightError\.value = null/)
  assert.doesNotMatch(promptSource, /\bonMounted\b|\bonActivated\b|\bonDeactivated\b/)
})

test('prompt delegates validation and emits only valid weights', () => {
  assert.match(promptSource, /import \{ MAX_ORDER_IMAGE_WEIGHT_KG, parseOrderImageWeight \}/)
  assert.match(promptSource, /const weight = parseOrderImageWeight\(rawWeight\.value\)/)
  assert.match(promptSource, /if \(weight === null\)/)
  assert.match(promptSource, /weightError\.value = `[^`]*\$\{MAX_ORDER_IMAGE_WEIGHT_KG\}/)
  assert.match(promptSource, /weightError\.value = null[\s\S]*emit\('submit', weight\)/)
  assert.match(overlayRouteSource, /if \(trimmed === ''\) return null/)
  assert.match(overlayRouteSource, /if \(!Number\.isFinite\(parsed\)\) return null/)
  assert.match(overlayRouteSource, /if \(parsed <= 0\) return null/)
  assert.match(overlayRouteSource, /if \(parsed > MAX_ORDER_IMAGE_WEIGHT_KG\) return null/)
  assert.match(overlayRouteSource, /Math\.round\(parsed \* 100\) \/ 100/)
})

test('prompt uses only the real BaseOverlay and FormInput contracts', () => {
  assert.match(promptSource, /import BaseOverlay from ['"]@\/shared\/layouts\/BaseOverlay\.vue['"]/)
  assert.match(promptSource, /import FormInput from ['"]@\/shared\/components\/FormInput\.vue['"]/)
  assert.match(promptSource, /<BaseOverlay :open="open" aria-label="ระบุน้ำหนัก" @close="emit\('close'\)">/)
  assert.match(promptSource, /<FormInput[^>]*min="0"[^>]*max="200"/)
  assert.doesNotMatch(promptSource, /<FormInput[^>]*(?:inputmode|step)=/)
})

test('weight prompt has no API or upload dependency', () => {
  assert.doesNotMatch(promptSource, /(?:firebase|uploadBytes|fetch\s*\(|axios|\/api\/order-images)/i)
})

console.log('order-image-weight-prompt dry tests passed')
