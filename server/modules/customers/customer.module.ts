import type { z } from 'zod'
import {
  customerCreateResponseSchema,
  customerCreateSchema,
  customerDetailResponseSchema,
  customerListQuerySchema,
  customerListResponseSchema,
  customerUpdateResponseSchema,
  customerUpdateSchema,
} from '../../../contracts/customers/customer-api.schema'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository'
import type { OmitReservedQueryFields } from '../../shared/dtos/read-query.dto'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository'
import { BaseCrudService } from '../../shared/services/base-crud.service'
import { requireEnv } from '../../shared/utils/env'
import { customerFieldMap, customerRowSchema } from './customer-db.schema'

// ── Types derived from the contract + DB schemas; the schema files export no
//    z.infer types, so the aliases live with their only consumer (this module). ──
type CustomerDbRow = z.infer<typeof customerRowSchema>
type CustomerListQuery = z.infer<typeof customerListQuerySchema>
type CustomerCreate = z.infer<typeof customerCreateSchema>
type CustomerUpdate = z.infer<typeof customerUpdateSchema>
type CustomerApiRow = ApiRowFromFieldMap<CustomerDbRow, typeof customerFieldMap>

// Read filter — DERIVED from the list query (reserved fields removed) so the
// service's ReadQueryDTO.fromQuery() and the repository agree by construction.
// Only DB-backed filter fields remain (customerType); keyword/sort/pagination
// travel on the ReadQueryDTO, not here.
type CustomerReadWhere = OmitReservedQueryFields<CustomerListQuery>

// ── Data access: the Google Sheets implementation behind the repository
//    contract. The irregular `Line -> lineId` mapping rides on customerFieldMap;
//    all transport detail (column letters, GViz strings, Apps Script writes)
//    stays inside GSheetRepository. ──
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
  rowSchema: customerRowSchema,
  primaryKey: 'customerId',
  fieldMap: customerFieldMap,
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
  listQuerySchema: customerListQuerySchema,
  createSchema: customerCreateSchema,
  updateSchema: customerUpdateSchema,
  listResponseSchema: customerListResponseSchema,
  detailResponseSchema: customerDetailResponseSchema,
  createResponseSchema: customerCreateResponseSchema,
  updateResponseSchema: customerUpdateResponseSchema,
  searchFields: ['customerIndex', 'customerName', 'address'],
})
