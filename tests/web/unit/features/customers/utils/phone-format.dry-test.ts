import assert from 'node:assert/strict'
import { formatPhoneDisplay, nextPhoneDigits } from '@/features/customers/utils/phone-format'

for (const [digits, display] of [
  ['', ''],
  ['08', '08'],
  ['081', '081-'],
  ['0812', '081-2'],
  ['081234', '081-234-'],
  ['0812345678', '081-234-5678'],
]) {
  assert.equal(formatPhoneDisplay(digits), display)
}

assert.equal(nextPhoneDigits('081', '081'), '08')
assert.equal(nextPhoneDigits('081', '081-4'), '0814')
assert.equal(nextPhoneDigits('', '08a1b2345678'), '0812345678')
assert.equal(nextPhoneDigits('0812345678', '081-234-56789'), '0812345678')
assert.equal(nextPhoneDigits('', '081-234-5678'), '0812345678')

console.log('phone-format dry-test passed')
