import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isValidItemQuantity,
  isWeightUnit,
  itemQuantityStep,
} from '@shared/utils/item-quantity'

test('recognizes the canonical kilogram unit', () => {
  assert.equal(isWeightUnit('kg'), true)
  assert.equal(isWeightUnit(' KG '), true)
  assert.equal(isWeightUnit('piece'), false)
  assert.equal(isWeightUnit(null), false)
})

test('allows one decimal place for kilogram quantities', () => {
  for (const quantity of ['1', '0.1', '1.5', '20.5']) {
    assert.equal(isValidItemQuantity(quantity, 'kg'), true, quantity)
  }
  for (const quantity of ['', '0', '1e-11', '0.10000000005', '-1', '1.25', 'abc', 'Infinity']) {
    assert.equal(isValidItemQuantity(quantity, 'kg'), false, quantity)
  }
  assert.equal(isValidItemQuantity(0.10000000005, 'kg'), false)
  assert.equal(itemQuantityStep('kg'), '0.1')
})

test('allows only positive whole numbers for non-weight quantities', () => {
  for (const quantity of ['1', '2', '20']) {
    assert.equal(isValidItemQuantity(quantity, 'piece'), true, quantity)
  }
  for (const quantity of ['', '0', '-1', '1.5', 'abc', 'Infinity']) {
    assert.equal(isValidItemQuantity(quantity, 'piece'), false, quantity)
  }
  assert.equal(itemQuantityStep('piece'), '1')
})
