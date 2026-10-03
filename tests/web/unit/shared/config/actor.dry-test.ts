import assert from 'node:assert/strict'
import { currentActor, setSignedInStaffId } from '@/shared/config/actor'

assert.equal(currentActor(), 'unknown')
for (const override of [undefined, null, '', '   ', 'appsheet', '  Jane Doe  ', ['a', 'b'], 42]) {
  assert.equal(currentActor(override), 'unknown')
}

setSignedInStaffId('  staff-id  ')
assert.equal(currentActor(), 'staff-id')
assert.equal(currentActor('appsheet'), 'staff-id')
assert.equal(currentActor(['a', 'b']), 'staff-id')
setSignedInStaffId(null)
assert.equal(currentActor(), 'unknown')
for (const blank of ['', '   ', '\t\n ']) {
  setSignedInStaffId('staff-id')
  setSignedInStaffId(blank)
  assert.equal(currentActor(), 'unknown')
}

console.log('actor.dry-test: OK (fallback, ignored overrides, signed-in id, clearing)')
