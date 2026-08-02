import { orderContract, orderFormContract } from './order.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
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
    spreadsheetId: 'ORDERS_SPREADSHEET_ID',
    transformer: createOrdersTransformer(),
  })
}

/**
 * OrderForm — a different physical sheet (tab "OrderForm", PK `id`) sharing
 * the same `ORDERS_SPREADSHEET_ID` workbook as `OrdersView` above. Moved here
 * from the Invoices module per `docs/invoice-module-refactor-plan.md`; only
 * `.update()` is supported (see `orderFormContract` in `order.contract.ts`).
 * `InvoiceService` imports this getter directly — never `order.module.ts` —
 * per this repo's rule against importing another module's `.module.ts` just
 * to reuse a repository.
 */
let orderFormRepository: GSheetRepository<typeof orderFormContract> | undefined

export function getOrderFormRepository(): GSheetRepository<typeof orderFormContract> {
  return orderFormRepository ??= new GSheetRepository({
    contract: orderFormContract,
    sheetName: 'OrderForm',
    target: 'OrderForm',
    spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  })
}
