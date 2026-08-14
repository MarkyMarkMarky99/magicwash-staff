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
  /**
   * Declares the intended Sheets API input handling for specific columns. This is
   * an intent declaration and a guard, NOT the value sent on the wire: the write
   * path sends a single request-wide valueInputOption of 'USER_ENTERED' and uses
   * this map only to reject a column that declares anything else, so a contract and
   * the transport can never disagree silently. An absent column is NOT sent as RAW.
   * Do not build per-column request splitting from this field.
   */
  valueInput?: Partial<Record<string, 'RAW' | 'USER_ENTERED'>>
  audit?: {
    /** Physical DB column names stamped with the current timestamp on append. */
    onAppend?: readonly string[]
    /** Physical DB column names stamped with the current timestamp on update. */
    onUpdate?: readonly string[]
  }
  writes: {
    append: boolean
    update: boolean
    delete: boolean
  }
}
