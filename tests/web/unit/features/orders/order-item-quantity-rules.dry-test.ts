import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../src/features/orders/components/OrderItemForm.vue', import.meta.url),
  'utf8',
)

assert.match(source, /isValidItemQuantity\(form\.quantity, selectedUnit\.value\)/)
assert.match(source, /:step="itemQuantityStep\(selectedUnit\)"/)
assert.match(source, /isWeightUnit\(selectedUnit\)/)
assert.match(source, /:aria-describedby="quantityError \? 'order-item-quantity-error' : undefined"/)
assert.match(source, /:aria-invalid="Boolean\(quantityError\)"/)

console.log('order item quantity rule dry tests passed')
