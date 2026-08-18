import assert from 'node:assert/strict'

import {
  priceListDbContract,
  priceListRowSchema,
} from '../../../../server/sheets/PriceList/PriceList.db-contract.js'

assert.equal(priceListDbContract.primaryKey, 'id')
assert.equal(priceListDbContract.sheetName, 'PriceList')
assert.equal(priceListDbContract.spreadsheetId, 'PRICE_LIST_SPREADSHEET_ID')
assert.deepEqual(priceListDbContract.writes, {
  append: false,
  update: false,
  delete: false,
})

const physicalColumns = Object.keys(priceListRowSchema.shape)
assert.equal(physicalColumns.length, 14)
assert.equal(physicalColumns[0], 'id')
assert.equal(physicalColumns[4], 'itemtype')

const validPriceListRow = {
  id: 'a1b2c3d4',
  item_code: 'ITM-0001',
  category: 'tops',
  subcategory: 'shirt',
  itemtype: 'shirt',
  variant: 'standard',
  display_name_th: 'เสื้อเชิ้ต',
  wash_dry_iron_price: 0,
  iron_only_price: 50,
  dry_clean_price: 120,
  credit_eligible: false,
  effective_from: 'Date(2026,0,1)',
  effective_to: null,
  active: false,
}

assert.deepEqual(priceListRowSchema.parse(validPriceListRow), validPriceListRow)
assert.deepEqual(
  priceListRowSchema.parse({
    ...validPriceListRow,
    variant: null,
    wash_dry_iron_price: null,
    iron_only_price: null,
    dry_clean_price: null,
    effective_to: null,
  }),
  {
    ...validPriceListRow,
    variant: null,
    wash_dry_iron_price: null,
    iron_only_price: null,
    dry_clean_price: null,
    effective_to: null,
  },
)
assert.deepEqual(
  priceListRowSchema.parse({
    ...validPriceListRow,
    effective_to: 'Date(2026,11,31)',
  }),
  {
    ...validPriceListRow,
    effective_to: 'Date(2026,11,31)',
  },
)

function assertInvalidRow(label: string, changes: Record<string, unknown>): void {
  assert.throws(() => priceListRowSchema.parse({ ...validPriceListRow, ...changes }), label)
}

assertInvalidRow('id must use the lowercase eight-character pattern', { id: 'ABC12345' })
assertInvalidRow('id must contain exactly eight lowercase letters or digits', { id: 'a1b2c3d' })
assertInvalidRow('item_code must use the ITM- digit pattern', { item_code: 'ITEM-0001' })
assertInvalidRow('item_code must contain at least four digits', { item_code: 'ITM-123' })

for (const field of ['category', 'subcategory', 'itemtype', 'display_name_th']) {
  assertInvalidRow(`${field} must be non-empty`, { [field]: '' })
}
assertInvalidRow('variant must be non-empty when present', { variant: '' })

for (const field of ['wash_dry_iron_price', 'iron_only_price', 'dry_clean_price']) {
  assertInvalidRow(`${field} must be numeric when non-null`, { [field]: '0' })
}
assertInvalidRow('credit_eligible must be boolean', { credit_eligible: 'false' })
assertInvalidRow('active must be boolean', { active: 'false' })

const previousSpreadsheetId = process.env.PRICE_LIST_SPREADSHEET_ID
delete process.env.PRICE_LIST_SPREADSHEET_ID

try {
  const repositoryModule = await import(
    '../../../../server/sheets/PriceList/PriceList.repository.js'
  )

  assert.equal(typeof repositoryModule.getPriceListRepository, 'function')

  process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-test-spreadsheet'
  const firstRepository = repositoryModule.getPriceListRepository()
  const secondRepository = repositoryModule.getPriceListRepository()
  assert.strictEqual(secondRepository, firstRepository)
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.PRICE_LIST_SPREADSHEET_ID
  } else {
    process.env.PRICE_LIST_SPREADSHEET_ID = previousSpreadsheetId
  }
}

console.log('price-list sheet contract dry test passed')
