import { customerContract } from './customer.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'

// ── Data access: the Google Sheets implementation behind the repository contract.
//    The complete `customerContract` drives every inferred type — DB row, mapped
//    API row, read filter, create/update inputs — so this file declares no
//    repository-derived aliases. The irregular `Line -> lineId` mapping rides on
//    the field map; all transport detail (column letters, GViz strings, Apps
//    Script writes) stays inside GSheetRepository. Lazily constructed and
//    memoized behind a getter so importing this file — e.g. from a future
//    composing service — never triggers env reads or repository construction
//    until a caller actually asks for it. ──
let customerRepository: GSheetRepository<typeof customerContract> | undefined

export function getCustomerRepository(): GSheetRepository<typeof customerContract> {
  return customerRepository ??= new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    spreadsheetId: 'CUSTOMERS_SPREADSHEET_ID',
  })
}
