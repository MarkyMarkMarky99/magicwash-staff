import assert from 'node:assert/strict'

import {
  WriteRowIdentityMismatchError,
  verifyRowIdentity,
} from '../../../../../server/shared/repositories/sheet-row-identity.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('accepts a row whose primary key matches the expected key', async () => {
  verifyRowIdentity({ OrderID: 'order-1', Status: 'Ready' }, 'OrderID', 'order-1')
})

test('accepts a numeric primary key returned by an unformatted read-back', async () => {
  verifyRowIdentity({ OrderID: 12345678, Status: 'Ready' }, 'OrderID', '12345678')
})

test('rejects a row whose primary key changed between lookup and write', async () => {
  assert.throws(
    () => verifyRowIdentity({ OrderID: 'order-2' }, 'OrderID', 'order-1'),
    (error: unknown) => {
      assert.ok(error instanceof WriteRowIdentityMismatchError)
      assert.equal(error.certainty, 'unknown')
      assert.match(error.message, /row moved/i)
      assert.match(error.message, /do not retry/i)
      return true
    },
  )
})

test('rejects a row missing the primary-key column', async () => {
  assert.throws(
    () => verifyRowIdentity({ Status: 'Ready' }, 'OrderID', 'order-1'),
    (error: unknown) => {
      assert.ok(error instanceof WriteRowIdentityMismatchError)
      assert.equal(error.certainty, 'unknown')
      assert.match(error.message, /row moved/i)
      assert.match(error.message, /do not retry/i)
      return true
    },
  )
})

const orderedTests = process.env.REVERSE_TESTS === '1' ? [...tests].reverse() : tests
let failures = 0

for (const currentTest of orderedTests) {
  try {
    await currentTest.run()
    console.log(`ok - ${currentTest.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`not ok - ${currentTest.name}`)
    console.error(error)
  }
}

if (failures !== 0) {
  throw new Error(`${failures} dry-test(s) failed.`)
}

console.log(`passed - ${orderedTests.length} row-identity dry-tests`)
