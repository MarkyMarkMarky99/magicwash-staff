import { invoiceViewContract } from './invoice-view.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { createInvoiceViewTransformer } from './invoice-view.transformer.js'

let invoiceViewRepository: GSheetRepository<typeof invoiceViewContract> | undefined

export function getInvoiceViewRepository(): GSheetRepository<typeof invoiceViewContract> {
  return invoiceViewRepository ??= new GSheetRepository({
    contract: invoiceViewContract,
    sheetName: 'InvoicesView',
    // InvoicesView and OrdersView share the same portal workbook — id
    // confirmed against InvoiceView.json's declared spreadsheetId. The env
    // var is just named after whichever view was built first.
    spreadsheetId: 'ORDERS_SPREADSHEET_ID',
    transformer: createInvoiceViewTransformer(),
  })
}
