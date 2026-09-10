import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../src/shared/components/FormInput.vue', import.meta.url),
  'utf8',
)

assert.match(source, /step:\s*\{ type: String/)
assert.match(source, /inputmode:\s*\{ type: String/)
assert.match(source, /ariaDescribedby:\s*\{ type: String/)
assert.match(source, /ariaInvalid:\s*\{ type: \[Boolean, String\]/)
assert.match(source, /:step="step"/)
assert.match(source, /:inputmode="inputmode"/)
assert.match(source, /:aria-describedby="ariaDescribedby"/)
assert.match(source, /:aria-invalid="ariaInvalid"/)
assert.match(source, /@invalid="\$emit\('invalid', \$event\)"/)

console.log('FormInput number attribute dry tests passed')
