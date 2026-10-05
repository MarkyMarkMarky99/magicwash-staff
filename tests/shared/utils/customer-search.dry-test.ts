import assert from 'node:assert/strict'
import { containsKeyword, matchesCustomerKeyword } from '../../../shared/utils/customer-search.js'

const customer = { customerIndex: 'ABC', customerName: 'Somchai Laundry', phone: '0811111111', address: 'Thonglor 55' }

assert.equal(matchesCustomerKeyword(customer, ''), true)
assert.equal(matchesCustomerKeyword(customer, '   '), true)
assert.equal(matchesCustomerKeyword(customer, 'abc'), true)
assert.equal(matchesCustomerKeyword(customer, ' SOMCHAI '), true)
assert.equal(matchesCustomerKeyword(customer, '0811'), true)
assert.equal(matchesCustomerKeyword(customer, 'thonglor 5'), true)
assert.equal(matchesCustomerKeyword(customer, 'xyz'), false)

// GViz can type a phone column as number, and empty cells arrive as null
assert.equal(matchesCustomerKeyword({ customerIndex: null, customerName: null, phone: 811111111, address: undefined }, '8111'), true)
assert.equal(matchesCustomerKeyword({ customerIndex: null, customerName: null, phone: null, address: null }, 'null'), false)

assert.equal(containsKeyword('INV20261005-ab', 'inv2026'), true)
assert.equal(containsKeyword(null, 'a'), false)

console.log('customer search dry test passed')
