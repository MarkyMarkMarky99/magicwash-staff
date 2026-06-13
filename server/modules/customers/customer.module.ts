import { z } from 'zod'
import { createGoogleSheetRepository, createSheetService } from '../../shared/sheet-crud'
import {
  customerApiSchemas,
  customerListQuerySchema,
} from '../../../contracts/customers/customer-api.schema'
import { customerDbSchemas, customerRowSchema } from './customer-db.schema'

// ── Types derived from the schemas — the schemas stay the single source of
//    truth; the aliases live with their only consumer (this module). ──
type CustomerRow = z.infer<typeof customerRowSchema>
type CustomerFilter = z.infer<typeof customerListQuerySchema>

// ── Data access: the Google Sheets implementation behind the repository
//    contract. The irregular `Line -> lineId` mapping is carried by
//    `customerDbSchemas.fieldMap`; everything here is pure wiring plus the
//    filter clauses, which still speak DB columns directly. ──
const customerRepository = createGoogleSheetRepository<CustomerRow, CustomerFilter>({
  sheet: {
    sheetName: 'Customers',
    sheetNameEnv: 'CUSTOMERS_SHEET_NAME',
    spreadsheetIdEnv: 'CUSTOMERS_SPREADSHEET_ID',
    scriptUrlEnv: 'APPSCRIPT_CUSTOMER_URL',
  },
  db: customerDbSchemas,
  clauses: (clause, columns) => [
    // keyword spans customerIndex (most-used lookup), customerName, and address
    // (address replaces the dropped dedicated location filter). Phone is excluded:
    // it is a number column, and GViz contains() can't run on a numeric column.
    clause.contains('keyword', ['CustomerIndex', 'CustomerName', 'Address']),
    clause.eq('customerType', 'CustomerType'),
    // Soft-deleted rows (DeletedAt set) are hidden unless explicitly included.
    (filter) => (filter.includeDeleted ? null : `${columns.DeletedAt} is null`),
  ],
})

// ── API behavior: the two contract bundles do the talking. ──
export const customerService = createSheetService({
  resourceName: 'Customer',
  repository: customerRepository,
  api: customerApiSchemas,
  db: customerDbSchemas,
  // No hooks: customers has no write-time business logic yet.
})
