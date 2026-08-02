import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { invoiceContract, invoiceItemContract, paymentContract, invoiceViewContract } from './invoice.contract.js'

/**
 * The ONLY repository file the Invoices module owns. One physical sheet, one
 * lazy memoized `GSheetRepository` getter, per this module's non-negotiable
 * rule (`docs/invoice-module-refactor-plan.md`):
 *
 *   Invoice      → getInvoiceRepository()      (target "Invoice", writes only)
 *   InvoiceItem  → getInvoiceItemRepository()   (target "InvoiceItem", writes only)
 *   Payment      → getPaymentRepository()       (no target — unsupported writes)
 *   InvoicesView → getInvoiceViewRepository()   (read-only, different workbook)
 *
 * Invoice/InvoiceItem/Payment share the `INVOICES_SPREADSHEET_ID` workbook,
 * which is NOT publicly readable — writes (APPEND/UPDATE) succeed against it
 * but GViz reads do not. Nothing in this module ever calls `.read()` on any
 * of those three; `InvoiceService` only calls `.create()`/`.batchAppend()` on
 * Invoice/InvoiceItem, and never writes to Payment at all in this rollout.
 * `InvoicesView` is a separate, publicly-readable materialized view (a
 * different spreadsheet env var, `ORDERS_SPREADSHEET_ID` — it shares that
 * workbook with `OrdersView`, confirmed against InvoiceView.json's declared
 * spreadsheetId) and serves every GET.
 *
 * Every writer uses `APPSCRIPT_URL` (via `GSheetRepository`'s default
 * `scriptUrl`) with an explicit SheetLib `target` — never
 * `APPSCRIPT_GATEWAY_URL`, and never a raw `fetch` in this module or in
 * `InvoiceService`.
 *
 * Lazily constructed and memoized behind getters so importing this file never
 * triggers env reads or repository construction until a caller actually asks
 * for one — matching every sibling `<m>.repository.ts` in this codebase.
 */

let invoiceRepository: GSheetRepository<typeof invoiceContract> | undefined

export function getInvoiceRepository(): GSheetRepository<typeof invoiceContract> {
  return invoiceRepository ??= new GSheetRepository({
    contract: invoiceContract,
    sheetName: 'Invoices',
    target: 'Invoice',
    spreadsheetId: 'INVOICES_SPREADSHEET_ID',
  })
}

let invoiceItemRepository: GSheetRepository<typeof invoiceItemContract> | undefined

export function getInvoiceItemRepository(): GSheetRepository<typeof invoiceItemContract> {
  return invoiceItemRepository ??= new GSheetRepository({
    contract: invoiceItemContract,
    sheetName: 'InvoiceItems',
    target: 'InvoiceItem',
    spreadsheetId: 'INVOICES_SPREADSHEET_ID',
  })
}

let paymentRepository: GSheetRepository<typeof paymentContract> | undefined

export function getPaymentRepository(): GSheetRepository<typeof paymentContract> {
  return paymentRepository ??= new GSheetRepository({
    contract: paymentContract,
    sheetName: 'Payments',
    spreadsheetId: 'INVOICES_SPREADSHEET_ID',
    // No `target`: writes are unsupported for Payment in this rollout (see
    // invoice.contract.ts's Payment section) — `create()`/`update()` reject
    // before ever needing a write target, and this module never reads this
    // sheet either (the workbook is not publicly readable).
  })
}

let invoiceViewRepository: GSheetRepository<typeof invoiceViewContract> | undefined

export function getInvoiceViewRepository(): GSheetRepository<typeof invoiceViewContract> {
  return invoiceViewRepository ??= new GSheetRepository({
    contract: invoiceViewContract,
    sheetName: 'InvoicesView',
    // InvoicesView and OrdersView share the same portal workbook — id
    // confirmed against InvoiceView.json's declared spreadsheetId. The env
    // var is just named after whichever view was built first.
    spreadsheetId: 'ORDERS_SPREADSHEET_ID',
    decodeJsonCells: true,
  })
}
