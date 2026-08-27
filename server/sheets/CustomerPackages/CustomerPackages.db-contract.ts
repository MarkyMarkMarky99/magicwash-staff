import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const customerPackageServiceDayDbSchema = z.enum(['SUN', 'MON', 'WED', 'THU', 'FRI', 'SAT'])
const customerPackageTimeSlotDbSchema = z.enum(['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'])

/** KEY ORDER = physical CustomerPackages sheet column order. */
export const customerPackagesRowSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  package_code: z.string(),
  start_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  service_day: customerPackageServiceDayDbSchema.nullable(),
  time_slot: customerPackageTimeSlotDbSchema.nullable(),
  invoice_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
}).strict()

export const customerPackagesDbContract = {
  row: customerPackagesRowSchema,
  primaryKey: 'id',
  sheetName: 'CustomerPackages',
  spreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
