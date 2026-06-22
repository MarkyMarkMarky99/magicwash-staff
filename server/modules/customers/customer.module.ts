import type { z } from 'zod'
import { customerApiSchemas } from '../../../contracts/customers/customer-api.schema'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository'
import type { ModuleContract } from '../../shared/contracts/module-db-contract'
import type { OmitReservedQueryFields } from '../../shared/dtos/read-query.dto'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository'
import { BaseCrudService } from '../../shared/services/base-crud.service'
import { requireEnv } from '../../shared/utils/env'
import { customerDbContract } from './customer-db.schema'

// ── Module-level contract: composes the API bundle (contracts/, camelCase) with
//    the DB bundle (server/, sheet columns). `satisfies ModuleContract` keeps both
//    sides on the shared standard shape; the wiring below reads everything it
//    needs off this one symbol. ──
const customerContract = {
  api: customerApiSchemas,
  db: customerDbContract,
} satisfies ModuleContract

// ── Types derived from the contract; the schema files export no z.infer types, so
//    the aliases live with their only consumer (this module). ──
type CustomerDbRow = z.infer<typeof customerContract.db.row>
type CustomerListQuery = z.infer<typeof customerContract.api.query.list>
type CustomerCreate = z.infer<typeof customerContract.api.request.create>
type CustomerUpdate = z.infer<typeof customerContract.api.request.update>
type CustomerApiRow = ApiRowFromFieldMap<CustomerDbRow, typeof customerContract.db.fieldMap>

// Read filter — DERIVED from the list query (reserved fields removed) so the
// service's ReadQueryDTO.fromQuery() and the repository agree by construction.
// Only DB-backed filter fields remain (customerType); keyword/sort/pagination
// travel on the ReadQueryDTO, not here.
type CustomerReadWhere = OmitReservedQueryFields<CustomerListQuery>

// ── Data access: the Google Sheets implementation behind the repository
//    contract. The irregular `Line -> lineId` mapping rides on the field map; all
//    transport detail (column letters, GViz strings, Apps Script writes) stays
//    inside GSheetRepository. ──
const customerRepository = new GSheetRepository<
  CustomerApiRow,
  CustomerDbRow,
  CustomerReadWhere,
  CustomerCreate,
  CustomerUpdate
>({
  sheetName: 'Customers',
  spreadsheetId: requireEnv('CUSTOMERS_SPREADSHEET_ID'),
  scriptUrl: requireEnv('APPSCRIPT_URL'),
  rowSchema: customerContract.db.row,
  primaryKey: customerContract.db.primaryKey,
  fieldMap: customerContract.db.fieldMap,
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
