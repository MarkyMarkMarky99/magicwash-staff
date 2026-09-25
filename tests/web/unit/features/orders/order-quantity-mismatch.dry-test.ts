import assert from 'node:assert/strict'
import { orderQuantityMismatch } from '@/features/orders/order-quantity-mismatch'

assert.equal(orderQuantityMismatch(null, [{ quantity: 1 }]), true)
assert.equal(orderQuantityMismatch(0, []), true)
assert.equal(orderQuantityMismatch(3, [{ quantity: 1 }, { quantity: 2 }]), false)
assert.equal(orderQuantityMismatch(2, [{ quantity: 1 }, { quantity: 2 }]), true)

console.log('order quantity mismatch dry test passed')
