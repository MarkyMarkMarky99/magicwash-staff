import type { ZodSchema } from 'zod'

/**
 * A DB row schema is a Zod OBJECT: column letters are derived from `row.shape`,
 * so the schema must expose it.
 *
 * This structural type belongs to the sheet repository layer and is intentionally
 * independent of API contracts. Each physical sheet declares one contract beside
 * its row schema under `server/sheets/<Sheet>/`.
 */
export type DbRowSchema = ZodSchema & { shape: Record<string, unknown> }

/**
 * Structural guard for a database contract owned by one physical sheet.
 * `row.shape` key order is load-bearing because GViz derives column letters
 * from it by index.
 *
 * Knows nothing about API shape: no field map, no API field names. DB↔API
 * mapping is the owning module's job.
 */
export type SheetContract = {
  row: DbRowSchema
  /** Physical database column name, not an API/domain field name. */
  primaryKey: string
  /** Physical Google Sheets tab name. */
  sheetName: string
  /** Environment variable key containing the spreadsheet id, not the id value. */
  spreadsheetId?: string
  /** SheetLib / Apps Script write target. The Sheets API swap is Phase 2, not current behavior. */
  target?: string
  writes: {
    append: boolean
    update: boolean
    delete: boolean
  }
}
