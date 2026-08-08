import type { ZodSchema } from 'zod'

/**
 * A DB row schema is a Zod OBJECT: column letters are derived from `row.shape`,
 * so the schema must expose it.
 *
 * Deliberately redeclared here rather than imported from `module-db-contract.ts`
 * — that file is deleted in §1.8 once every module stops using `ModuleContract`,
 * and the database layer must not hold a dependency that blocks its removal. The
 * duplication lasts only until then.
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
  /** SheetLib / Apps Script write target. Removed in Phase 2 for Sheets API writes. */
  target?: string
  writes: {
    append: boolean
    update: boolean
    delete: boolean
  }
}
