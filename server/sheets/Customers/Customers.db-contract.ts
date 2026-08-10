import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const customerTypeSchema = z.enum(['Member', 'Regular', 'Corporate'])
const customerSourceSchema = z.enum(['Facebook Ads', 'Google Ads'])
const preferredContactMethodSchema = z.enum(['Line', 'Messenger'])

/** KEY ORDER = physical Customers sheet column order. */
export const customersRowSchema = z.object({
  Timestamp: z.string(),
  CustomerID: z.string(),
  CustomerIndex: z.string(),
  CustomerName: z.string(),
  Phone: z.string().nullable(),
  Address: z.string().nullable(),
  Location: z.string().nullable(),
  RegisteredDate: z.string().nullable(),
  Facebook: z.string().nullable(),
  Line: z.string().nullable(),
  Whatsapp: z.string().nullable(),
  Email: z.string().nullable(),
  CustomerType: customerTypeSchema.nullable(),
  Source: customerSourceSchema.nullable(),
  ScheduledDays: z.string().nullable(),
  LastVisitDate: z.string().nullable(),
  PreferredContactMethod: preferredContactMethodSchema.nullable(),
  UpdatedAt: z.string().nullable(),
  UpdatedBy: z.string().nullable(),
  DeletedAt: z.string().nullable(),
})

export const customersDbContract = {
  row: customersRowSchema,
  // API field: customerId; the current code field map resolves it to CustomerID.
  primaryKey: 'CustomerID',
  sheetName: 'Customers',
  spreadsheetId: 'CUSTOMERS_SPREADSHEET_ID',
  // Mirrors `customerContract.db.request`, which declares create AND update as
  // supported — NOT what actually happens at runtime. This sheet has no
  // `target`, so a write gets past the capability gate and then throws at
  // `requireWriteTarget()` instead (M2 in the plan; the real customer write path
  // lives in `appscript/customer-sheet/API.js`, a different Apps Script project
  // with its own lock, CustomerIndex allocation and LINE notifications).
  //
  // This physical sheet is not open for writes yet. Enable it only after the
  // separate customer flow is implemented here, including CustomerIndex
  // allocation, duplicate-phone checks, locking, and LINE notifications.
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
