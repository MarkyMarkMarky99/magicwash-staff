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
import type {
  ApiRowFromFieldMap,
  RepositoryReadQuery,
} from '../../shared/repositories/base.repository'
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

// Read filter the service maps from the list query — DB-backed API/domain fields
// only. keyword/sort/pagination travel on RepositoryReadQuery, not here.
type CustomerReadWhere = {
  customerType?: CustomerListQuery['customerType']
}

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

// Translate the validated list query into the storage-agnostic read query. Only
// API/domain field names appear here; the repository maps them to DB columns.
// customerType defaults to null (no filter) — pass undefined so the query builder
// drops the clause rather than matching the literal string 'null'.
function toCustomerReadQuery(query: CustomerListQuery): RepositoryReadQuery<CustomerReadWhere> {
  return {
    where: { customerType: query.customerType ?? undefined },
    search: {
      keyword: query.keyword,
      fields: ['customerIndex', 'customerName', 'address'],
    },
    sort: { field: query.sortBy, order: query.sortOrder },
    pagination: { page: query.page, perPage: query.perPage },
  }
}

// ── API behavior: BaseCrudService validates the request, maps the read query,
//    calls the repository, and projects each response by its schema shape. No
//    hooks: phone is already stored as text with its leading 0, so customers
//    needs no read-time normalization or other write-time business logic. ──
export const customerService = new BaseCrudService({
  repository: customerRepository,
  listQuerySchema: customerListQuerySchema,
  createSchema: customerCreateSchema,
  updateSchema: customerUpdateSchema,
  listResponseSchema: customerListResponseSchema,
  detailResponseSchema: customerDetailResponseSchema,
  createResponseSchema: customerCreateResponseSchema,
  updateResponseSchema: customerUpdateResponseSchema,
  toReadQuery: toCustomerReadQuery,
})
