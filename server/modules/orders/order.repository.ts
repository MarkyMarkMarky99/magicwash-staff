import { orderContract } from './order.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { requireEnv } from '../../shared/utils/env.js'
import { createOrdersTransformer } from './orders.transformer.js'

// ── Data access: standard GSheetRepository against the OrdersView sheet.
//    Read-only: the contract has no write slots; create/update are uncallable
//    at compile time and throw at runtime before any Apps Script write. Lazily
//    constructed and memoized behind a getter so importing this file never
//    triggers env reads or repository construction until a caller actually
//    asks for it. ──
let ordersRepository: GSheetRepository<typeof orderContract> | undefined

export function getOrdersRepository(): GSheetRepository<typeof orderContract> {
  return ordersRepository ??= new GSheetRepository({
    contract: orderContract,
    sheetName: 'OrdersView',
    spreadsheetId: requireEnv('ORDERS_SPREADSHEET_ID'),
    // Required by GSheetRepository constructor; unused for this list-only module
    // (writes are guarded before fetch). Same shared Apps Script URL as other modules.
    scriptUrl: requireEnv('APPSCRIPT_URL'),
    transformer: createOrdersTransformer(),
  })
}
