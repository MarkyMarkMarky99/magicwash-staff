import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../src/features/orders/components/OrderItemForm.vue', import.meta.url),
  'utf8',
)

assert.match(source, /Number\.isInteger\(quantity\) && quantity > 0/)
assert.match(source, /step="1"/)
assert.match(source, /inputmode="numeric"/)
assert.match(source, /Quantity must be a whole number greater than 0/)
assert.doesNotMatch(source, /selectedItem\?\.unit|selectedUnit|isValidItemQuantity|isWeightUnit|itemQuantityStep/)
assert.match(source, /:aria-describedby="quantityError \? 'order-item-quantity-error' : undefined"/)
assert.match(source, /:aria-invalid="Boolean\(quantityError\)"/)

console.log('order item quantity rule dry tests passed')
