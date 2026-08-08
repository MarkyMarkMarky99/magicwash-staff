import { orderFormContract } from './order.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'

/**
 * OrderForm — a different physical sheet (tab "OrderForm", PK `id`) sharing
 * the same `ORDERS_SPREADSHEET_ID` workbook as `OrdersView`. Moved here
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
