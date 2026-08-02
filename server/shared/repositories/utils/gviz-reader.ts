import type { GSheetColumnMap } from './gviz-query.builder.js'

export const GVIZ_BASE_URL = 'https://docs.google.com/spreadsheets/d'

export interface GVizFetchInput {
  spreadsheetId: string
  sheetName: string
  query: string
  columns: GSheetColumnMap
  /** Parse JSON object/array text cells for materialized portal views. */
  decodeJsonCells?: boolean
}

interface GVizCell {
  v: unknown
  f?: string
}

interface GVizColumn {
  id: string
  label?: string
  type?: string
}

interface GVizTable {
  cols: GVizColumn[]
  rows: { c: (GVizCell | null)[] }[]
}

interface GVizResponse {
  status: 'ok' | 'warning' | 'error'
  table?: GVizTable
  errors?: { message?: string; detailed_message?: string }[]
}

/** Fetch a GViz table and map its column letters back to DB row fields. */
export async function fetchGVizRows<TRow extends Record<string, unknown> = Record<string, unknown>>(
  input: GVizFetchInput,
): Promise<TRow[]> {
  const url =
    `${GVIZ_BASE_URL}/${input.spreadsheetId}/gviz/tq` +
    `?tqx=out:json&headers=1&sheet=${encodeURIComponent(input.sheetName)}` +
    `&tq=${encodeURIComponent(input.query)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GViz read failed: ${response.status} ${response.statusText}`)
  }

  const table = parseGVizResponse(await response.text())
  return tableToRows<TRow>(table, invertColumns(input.columns), input.decodeJsonCells ?? false)
}

function parseGVizResponse(body: string): GVizTable {
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('GViz response is not parseable JSON')
  }

  const parsed = JSON.parse(body.slice(start, end + 1)) as GVizResponse
  if (parsed.status === 'error') {
    const reason = parsed.errors?.[0]?.detailed_message ?? parsed.errors?.[0]?.message ?? 'unknown error'
    throw new Error(`GViz query error: ${reason}`)
  }

  return parsed.table ?? { cols: [], rows: [] }
}

/** Maps GViz cells to DB fields without validating dirty cell values. */
function tableToRows<TRow extends Record<string, unknown>>(
  table: GVizTable,
  letterToField: Record<string, string>,
  decodeJsonCells: boolean,
): TRow[] {
  return table.rows.map((row) => {
    const result: Record<string, unknown> = {}
    table.cols.forEach((column, index) => {
      const field = letterToField[column.id]
      if (!field) {
        throw new Error(`No DB field resolves for GViz column '${column.id}'`)
      }
      const cell = row.c[index]
      const value = cell == null ? null : (cell.v ?? null)
      result[field] = decodeJsonCells ? decodeJsonObjectOrArray(value) : value
    })
    return result as TRow
  })
}

/**
 * Portal sheets store nested fields as JSON text because a Google Sheets cell
 * cannot hold objects or arrays. Decode only that wire representation; do not
 * coerce scalar values, repair malformed JSON, or apply per-field defaults.
 */
function decodeJsonObjectOrArray(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const text = value.trim()
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return value
  }

  return JSON.parse(text)
}

function invertColumns(columns: GSheetColumnMap): Record<string, string> {
  const inverted: Record<string, string> = {}
  for (const [field, letter] of Object.entries(columns)) {
    inverted[letter] = field
  }
  return inverted
}
