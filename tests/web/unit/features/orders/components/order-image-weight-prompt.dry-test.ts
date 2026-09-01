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

function importedModules(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]),
  )
}

test('weight prompt is a component with route-owned state and cached-page reset behavior', () => {
  assert.match(promptSource, /defineProps/)
  assert.match(promptSource, /watch\s*\(/)
  assert.match(promptSource, /\bopen\b/)
  assert.doesNotMatch(promptSource, /\bonMounted\b|\bonActivated\b/)
  assert.doesNotMatch(promptSource, /ref\s*\(/, 'weight must not be held in a local ref')
  assert.match(promptSource, /router\.replace/)
})

test('prompt enforces the defined weight boundary and does not misuse FormInput props', () => {
  assert.match(promptSource, />\s*0|greaterThan|positive/i)
  assert.match(promptSource, /200/)
  assert.match(promptSource, /finite|isFinite/)
  assert.match(promptSource, /trim/)
  assert.match(promptSource, /toFixed\(2\)|round|Math\.round/)
  assert.doesNotMatch(promptSource, /<FormInput[^>]*(?:inputmode|step)=/)
})

test('prompt and route reader import one shared weight validator', () => {
  const sharedWeightImports = [...importedModules(promptSource)].filter(
    (modulePath) => importedModules(overlayRouteSource).has(modulePath) && /weight|validator/i.test(modulePath),
  )
  assert.ok(sharedWeightImports.length > 0, 'prompt and route reader must share the weight validator module')
})

test('weight prompt has no API or upload dependency', () => {
  assert.doesNotMatch(promptSource, /(?:firebase|uploadBytes|fetch\s*\(|axios|\/api\/order-images)/i)
})

console.log('order-image-weight-prompt dry tests passed')
