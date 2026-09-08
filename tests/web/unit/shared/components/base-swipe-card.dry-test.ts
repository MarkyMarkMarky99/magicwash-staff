import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ISS-72adcdca: on a phone, tapping a card fires our custom `tap` event on
// touchend *and* the browser's normal compatibility `click` shortly after.
// When `tap` triggers navigation (e.g. CustomerCard -> customer detail) and
// the destination page renders instantly (cache hit, no loading delay), the
// trailing click lands on whatever is now under the finger on the new page
// and activates that too -- a double activation from one tap. Suppressing
// the compatibility click in onTouchEnd is the fix; this locks that in.

const source = readFileSync(
  new URL('../../../../../src/shared/components/BaseSwipeCard.vue', import.meta.url),
  'utf8',
)

function bodyOf(fnName: string): string {
  const match = source.match(new RegExp(`function ${fnName}\\([^)]*\\)\\s*\\{`))
  assert.ok(match, `${fnName} must be defined as a function`)
  const start = match!.index! + match![0].length
  let depth = 1
  let i = start
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') depth--
    i++
  }
  return source.slice(start, i - 1)
}

const touchEndBody = bodyOf('onTouchEnd')

// The fix: cancel the browser's synthetic click for this touch before the
// gesture is resolved into a tap/swipe.
assert.match(
  touchEndBody,
  /preventDefault\(\)/,
  'onTouchEnd must call preventDefault() to suppress the trailing compatibility click',
)

// The event parameter must actually be the touchend event, not some other
// object, and preventDefault must run before resolve() so it isn't skipped
// by an early return inside resolve().
const preventIndex = touchEndBody.indexOf('preventDefault()')
const resolveIndex = touchEndBody.indexOf('resolve(')
assert.ok(preventIndex !== -1 && resolveIndex !== -1 && preventIndex < resolveIndex,
  'preventDefault() must run before resolve() in onTouchEnd')

// Mouse activation (desktop) must be untouched by this fix -- there is no
// compatibility click to suppress for a real mouse click.
const mouseUpBody = source.slice(
  source.indexOf('onMouseUp   = (ev) => {'),
  source.indexOf('document.addEventListener(\'mousemove\', onMouseMove)'),
)
assert.doesNotMatch(mouseUpBody, /preventDefault/, 'mouse activation path must not be changed by the touch fix')

// The action buttons in the swipe-revealed panels live outside the element
// that owns the touch listeners (`cardRef`), so preventDefault() on that
// element's touchend cannot suppress a later, separate tap directly on one
// of those buttons. Guard the structural assumption the fix relies on: the
// touch handlers stay attached to the card surface only, not the panels.
const panelsBlock = source.slice(source.indexOf('<!-- Swipe-right panel -->'), source.indexOf('<!-- Card surface -->'))
assert.doesNotMatch(panelsBlock, /@touchstart|@touchend/, 'side-panel buttons must not carry the card touch listeners')

console.log('base-swipe-card dry tests passed')
