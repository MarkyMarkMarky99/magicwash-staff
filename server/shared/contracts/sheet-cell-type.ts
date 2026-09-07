import { z } from 'zod'

/**
 * Marks a DB row schema field as a native Google Sheets date/datetime cell.
 *
 * This lives ON the row schema (via `.describe()`), not as a parallel map on
 * `SheetContract`. The row shape already derives column letters (see
 * `deriveGVizColumns`), so one column keeps exactly one declaration and no
 * second map can drift from it. `valueInput` is documented write intent, not
 * the stored cell type (see `sheet-contract.ts`), so it must not be reused
 * for this purpose.
 *
 * The values stay `z.string()`: row validation and the DB row type are
 * unchanged by this marker. It exists only to tell the GViz query builder
 * how to render an equality-filter literal for the column.
 */
export const SHEET_CELL_TYPE = {
  date: 'gviz:date',
  datetime: 'gviz:datetime',
} as const

export type SheetCellType = (typeof SHEET_CELL_TYPE)[keyof typeof SHEET_CELL_TYPE]

/** A string field backed by a native Sheets date cell. */
export function sheetDate(): z.ZodString {
  return z.string().describe(SHEET_CELL_TYPE.date)
}

/** A string field backed by a native Sheets datetime cell. */
export function sheetDateTime(): z.ZodString {
  return z.string().describe(SHEET_CELL_TYPE.datetime)
}

/**
 * Reads the cell-type marker back off a field schema's `.describe()` value.
 * Returns `undefined` for an unmarked field (the common case: a string
 * column that happens to hold an ISO-looking value stays plain string
 * quoting — type is never sniffed from the value).
 */
export function cellTypeOf(fieldSchema: unknown): 'date' | 'datetime' | undefined {
  const description = (fieldSchema as { description?: unknown } | undefined)?.description
  if (description === SHEET_CELL_TYPE.date) {
    return 'date'
  }
  if (description === SHEET_CELL_TYPE.datetime) {
    return 'datetime'
  }
  return undefined
}
