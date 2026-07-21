import { customerContract } from './customer.contract'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository'
import { BaseCrudService } from '../../shared/services/base-crud.service'
import { requireEnv } from '../../shared/utils/env'

// ── Data access: the Google Sheets implementation behind the repository contract.
//    The complete `customerContract` drives every inferred type — DB row, mapped
//    API row, read filter, create/update inputs — so this file declares no
//    repository-derived aliases. The irregular `Line -> lineId` mapping rides on
//    the field map; all transport detail (column letters, GViz strings, Apps
//    Script writes) stays inside GSheetRepository. ──
const customerRepository = new GSheetRepository({
  contract: customerContract,
  sheetName: 'Customers',
  spreadsheetId: requireEnv('CUSTOMERS_SPREADSHEET_ID'),
  scriptUrl: requireEnv('APPSCRIPT_URL'),
})

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. No hooks: phone is already
//    stored as text with its leading 0, so customers needs no read-time
//    normalization or other write-time business logic.
//
//    customerType defaults to null (no filter); fromQuery preserves it and the
//    GViz builder drops null/''/undefined where values, so no clause is built. ──
export const customerService = new BaseCrudService({
  repository: customerRepository,
  api: customerContract.api,
  searchFields: ['customerIndex', 'customerName', 'address'],
})
