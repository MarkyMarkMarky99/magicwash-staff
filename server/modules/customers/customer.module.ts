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
    // its legacy cells are still integers, which GViz contains() handles poorly.
    clause.contains('keyword', ['CustomerIndex', 'CustomerName', 'Address']),
    clause.eq('customerType', 'CustomerType'),
    // Soft-deleted rows (DeletedAt set) are hidden unless explicitly included.
    (filter) => (filter.includeDeleted ? null : `${columns.DeletedAt} is null`),
  ],
})

// ── Phone normalization ──────────────────────────────────────────────────────
// Phone is contractually a string, but legacy cells are integers that dropped the
// leading 0 of Thai numbers (0812345678 -> 812345678). Restore it on the way out
// so the DTO carries the real number the UI dials/displays — the frontend must not
// reshape API data, so this normalization is the API's job. New rows are stored as
// text and pass through unchanged.
function toPhoneString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const digits = String(value).replace(/\D/g, '')
  if (digits === '') return null
  return digits.startsWith('0') ? digits : `0${digits}`
}

function withPhoneString<T extends { phone: string | null }>(dto: T): T {
  return { ...dto, phone: toPhoneString(dto.phone) }
}

// ── API behavior: the two contract bundles do the talking. ──
export const customerService = createSheetService({
  resourceName: 'Customer',
  repository: customerRepository,
  api: customerApiSchemas,
  db: customerDbSchemas,
  // Only an after-hook: normalize the legacy integer phone back to its real string
  // on every response. Customers has no other write-time business logic.
  hooks: {
    list: { after: (items) => items.map(withPhoneString) },
    get: { after: withPhoneString },
    create: { after: withPhoneString },
    update: { after: withPhoneString },
  },
})
