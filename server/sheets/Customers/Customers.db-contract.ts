import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const customerTypeSchema = z.enum(['Member', 'Regular', 'Corporate'])
const customerSourceSchema = z.enum(['Facebook Ads', 'Google Ads'])
const preferredContactMethodSchema = z.enum(['Line', 'Messenger'])

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
  primaryKey: 'CustomerID',
  sheetName: 'Customers',
  spreadsheetId: 'CUSTOMERS_SPREADSHEET_ID',
  audit: {
    onAppend: [],
    onUpdate: ['UpdatedAt'],
  },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
