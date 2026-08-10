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

export type SheetWriteTransport = 'sheetlib' | 'sheets-api'

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
  /** SheetLib / Apps Script write target. The Sheets API path does not use it. */
  target?: string
  /**
   * Selects the write transport for the sheet. Omitted means SheetLib so a
   * sheet must opt in explicitly before any write path changes.
   */
  writeTransport?: SheetWriteTransport
  /**
   * Per-column Sheets API valueInputOption override. Absent column = 'RAW'.
   * 'RAW' is the safe default (no cell-content coercion — phone numbers with
   * a leading 0, or values starting with =/+/- do not turn into formulas).
   * Only declare 'USER_ENTERED' for a column the sheet stores as a genuine
   * Sheets date/number type that must be recognized as such.
   */
  valueInput?: Partial<Record<string, 'RAW' | 'USER_ENTERED'>>
  writes: {
    append: boolean
    update: boolean
    delete: boolean
  }
}
