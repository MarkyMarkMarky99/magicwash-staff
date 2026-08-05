import { customerPackageViewContract } from './customer-package-view.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'

// Lazy + memoized so importing this file triggers no env reads.
let customerPackageViewRepository:
  | GSheetRepository<typeof customerPackageViewContract>
  | undefined

export function getCustomerPackageViewRepository(): GSheetRepository<
  typeof customerPackageViewContract
> {
  return customerPackageViewRepository ??= new GSheetRepository({
    contract: customerPackageViewContract,
    sheetName: 'CustomerPackageView',
    // Same portal workbook as OrdersView/InvoicesView; the env var is just named
    // after whichever view was built first.
    spreadsheetId: 'ORDERS_SPREADSHEET_ID',
    // Decodes the `transactionsJson` cell into the `transactions` array.
    decodeJsonCells: true,
  })
}
