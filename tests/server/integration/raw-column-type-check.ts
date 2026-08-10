/**
 * Read-only GViz inspector for risky physical column types. It reports the type
 * that GViz returns for a small set of columns without writing to Google Sheets.
 *
 * Example: node --env-file=.env.local --import=tsx/esm tests/server/integration/raw-column-type-check.ts
 */

import { requireEnv } from '../../../server/shared/utils/env.js'
import { appointmentsDbContract } from '../../../server/sheets/Appointments/Appointments.db-contract.js'
import { invoicesDbContract } from '../../../server/sheets/Invoices/Invoices.db-contract.js'
import { orderFormDbContract } from '../../../server/sheets/OrderForm/OrderForm.db-contract.js'

const GVIZ_BASE_URL = 'https://docs.google.com/spreadsheets/d'

interface GvizCell {
  v?: unknown
  f?: string
}

interface GvizColumn {
  type?: string
}

interface GvizTable {
  cols: GvizColumn[]
  rows?: { c: (GvizCell | null)[] }[]
}

interface GvizResponse {
  status: 'ok' | 'warning' | 'error'
  table?: GvizTable
  errors?: { message?: string; detailed_message?: string }[]
}

interface ColumnCheck {
  sheetName: string
  spreadsheetIdEnv: string
  rowShape: Record<string, unknown>
  columnName: string
}

const columnChecks: readonly ColumnCheck[] = [
  {
    sheetName: orderFormDbContract.sheetName,
    spreadsheetIdEnv: orderFormDbContract.spreadsheetId!,
    rowShape: orderFormDbContract.row.shape,
    columnName: 'updated_at',
  },
  ...(['created_at', 'updated_at', 'deleted_at'] as const).map((columnName) => ({
    sheetName: invoicesDbContract.sheetName,
    spreadsheetIdEnv: invoicesDbContract.spreadsheetId!,
    rowShape: invoicesDbContract.row.shape,
    columnName,
  })),
  ...(['CreatedAt', 'UpdatedAt', 'DeletedAt', 'AppointmentDate'] as const).map((columnName) => ({
    sheetName: appointmentsDbContract.sheetName,
    spreadsheetIdEnv: appointmentsDbContract.spreadsheetId!,
    rowShape: appointmentsDbContract.row.shape,
    columnName,
  })),
]

function columnLetterForIndex(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid zero-based column index: ${index}`)
  }

  let remaining = index + 1
  let letters = ''
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    remaining = Math.floor((remaining - 1) / 26)
  }
  return letters
}

function parseGVizResponse(body: string): GvizTable {
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('GViz response is not parseable JSON')
  }

  let parsed: GvizResponse
  try {
    parsed = JSON.parse(body.slice(start, end + 1)) as GvizResponse
  } catch {
    throw new Error('GViz response is not parseable JSON')
  }

  if (parsed.status === 'error') {
    const reason = parsed.errors?.[0]?.detailed_message ?? parsed.errors?.[0]?.message ?? 'unknown error'
    throw new Error(`GViz query error: ${reason}`)
  }

  return parsed.table ?? { cols: [], rows: [] }
}

function cellValue(cell: GvizCell | null | undefined): unknown {
  return cell?.v ?? null
}

function isNonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function sampleText(value: unknown): string {
  const text = typeof value === 'string' ? value : String(value)
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

async function readColumn(check: ColumnCheck): Promise<void> {
  const columnIndex = Object.keys(check.rowShape).indexOf(check.columnName)
  if (columnIndex === -1) {
    throw new Error(`column is not present in the imported db-contract row shape`)
  }

  const spreadsheetId = requireEnv(check.spreadsheetIdEnv)
  const columnLetter = columnLetterForIndex(columnIndex)
  const query = `select ${columnLetter} limit 20`
  const url =
    `${GVIZ_BASE_URL}/${spreadsheetId}/gviz/tq` +
    `?tqx=out:json&headers=1&sheet=${encodeURIComponent(check.sheetName)}` +
    `&tq=${encodeURIComponent(query)}`

  const response = await fetch(url, { method: 'GET' })
  if (!response.ok) {
    throw new Error(`GViz read failed: ${response.status} ${response.statusText}`)
  }

  const table = parseGVizResponse(await response.text())
  const rows = table.rows ?? []
  const values = rows.map((row) => cellValue(row.c[0])).filter(isNonEmpty)

  if (values.length === 0) {
    console.log(
      `${check.sheetName}.${check.columnName}: GViz type=undetermined; non-empty rows=0; no data rows — GViz type cannot be determined from an empty column`,
    )
    return
  }

  const gvizType = table.cols[0]?.type ?? 'unknown'
  const examples = values.slice(0, 2).map(sampleText)
  console.log(
    `${check.sheetName}.${check.columnName}: GViz type=${gvizType}; non-empty rows=${values.length}; examples=${JSON.stringify(examples)}`,
  )
}

async function main(): Promise<void> {
  let failed = false

  for (const check of columnChecks) {
    try {
      await readColumn(check)
    } catch (error) {
      failed = true
      const reason = error instanceof Error ? error.message : String(error)
      console.error(`${check.sheetName}.${check.columnName}: unable to read — ${reason}`)
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`raw-column-type-check: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
