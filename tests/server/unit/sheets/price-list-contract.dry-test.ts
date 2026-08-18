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
