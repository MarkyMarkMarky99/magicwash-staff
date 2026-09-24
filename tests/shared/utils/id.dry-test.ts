import assert from 'node:assert/strict'
import { generateId, generateShortId } from '../../../shared/utils/id.js'

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void): void {
  tests.push({ name, run })
}

test('generateShortId returns 8 lowercase hexadecimal characters', () => {
  assert.match(generateShortId(), /^[0-9a-f]{8}$/)
})

test('generateShortId prepends a prefix without changing the hex suffix', () => {
  assert.match(generateShortId('APPT-'), /^APPT-[0-9a-f]{8}$/)
})

test('generateShortId keeps its format and excludes numeric-looking ids', () => {
  for (let index = 0; index < 200000; index++) {
    const id = generateShortId()
    assert.match(id, /^[0-9a-f]{8}$/)
    assert.doesNotMatch(id, /^[0-9]+(e[0-9]+)?$/)
  }
})

test('generateShortId draws again when the first id looks numeric', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  let calls = 0
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues(values: Uint32Array) {
        calls++
        values.set(calls % 2 === 1 ? [1, 3, 0, 6, 3, 3, 14, 3] : [10, 0, 0, 0, 0, 0, 0, 0])
        return values
      },
    },
  })
  try {
    assert.equal(generateShortId(), 'a0000000')
    assert.equal(calls, 2)
    assert.equal(generateShortId('1'), '1a0000000')
    assert.equal(calls, 4)
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto)
    else Reflect.deleteProperty(globalThis, 'crypto')
  }
})

test('generateId uses the requested alphabet and length', () => {
  assert.match(generateId({ length: 12, alphabet: 'AB' }), /^[AB]{12}$/)
})

test('generateId prepends the requested prefix', () => {
  assert.match(
    generateId({ length: 6, alphabet: '0123456789', prefix: 'TAG-' }),
    /^TAG-[0-9]{6}$/,
  )
})

test('two consecutive generated ids differ', () => {
  assert.notEqual(generateShortId(), generateShortId())
})

test('generateId draws again after rejecting an incomplete-block value', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  let calls = 0
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues(values: Uint32Array) {
        calls++
        if (calls === 1) values.set([0xffffffff, 0, 1])
        else values[0] = 2
        return values
      },
    },
  })
  try {
    assert.equal(generateId({ length: 3, alphabet: 'ABC' }), 'ABC')
    assert.equal(calls, 2)
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto)
    else Reflect.deleteProperty(globalThis, 'crypto')
  }
})

test('generateId distributes a large sample across a three-character alphabet', () => {
  const sample = generateId({ length: 90000, alphabet: 'ABC' })
  const counts = ['A', 'B', 'C'].map((character) => sample.split(character).length - 1)
  for (const count of counts) {
    assert.ok(count > 27000 && count < 33000)
  }
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} id dry tests passed`)
