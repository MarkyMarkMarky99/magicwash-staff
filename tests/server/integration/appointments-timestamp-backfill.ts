/**
 * Apply a reviewed Appointments timestamp correction file.
 *
 * Dry-run is the default. The TSV is the authority for both the current and
 * corrected values; this script does not derive or second-guess them.
 *
 * Run with:
 * node --env-file=.env.local --import=tsx/esm tests/server/integration/appointments-timestamp-backfill.ts --input <path>
 * node --env-file=.env.local --import=tsx/esm tests/server/integration/appointments-timestamp-backfill.ts --input <path> --apply
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { getGoogleAccessToken } from '../../../server/shared/repositories/google-auth.js'
import { requireEnv } from '../../../server/shared/utils/env.js'
import { appointmentsDbContract } from '../../../server/sheets/Appointments/Appointments.db-contract.js'

const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const APPOINTMENTS_SHEET_NAME = appointmentsDbContract.sheetName
const TIMESTAMP_RANGE = 'K:L'
const TIMESTAMP_START_COLUMN_INDEX = 10
const TIMESTAMP_COLUMNS = ['K', 'L'] as const
const WRITE_BATCH_SIZE = 100
const INPUT_HEADER = 'sheet_row\tAppointmentID\tcolumn\tcurrent\tshould_be\tproblem\tevidence'

type TimestampColumn = 'CreatedAt' | 'UpdatedAt'
type TimestampProblem = 'text-not-parsed' | 'day-month-transposed'

interface CliOptions {
  inputPath: string
  apply: boolean
}

interface PlannedChange {
  sheetRow: number
  appointmentId: string
  column: TimestampColumn
  columnLetter: (typeof TIMESTAMP_COLUMNS)[number]
  current: string
  shouldBe: string
  problem: TimestampProblem
  cellReference: string
}

interface ExtendedValue {
  numberValue?: unknown
  stringValue?: unknown
  boolValue?: unknown
  formulaValue?: unknown
  errorValue?: unknown
}

interface TimestampRow {
  values: [ExtendedValue | undefined, ExtendedValue | undefined]
}

interface TimestampGrid {
  rows: Map<number, TimestampRow>
}

interface GvizLikeCellData {
  userEnteredValue?: ExtendedValue
}

interface PreconditionFailure {
  change: PlannedChange
  actual: string
}

interface ApplyResult {
  cellsWritten: number
  batchesIssued: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(object: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property)
}

function parseCliOptions(args: readonly string[]): CliOptions {
  let inputPath: string | undefined
  let apply = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--apply') {
      if (apply) {
        throw new Error('Usage: appointments-timestamp-backfill.ts --input <path> [--apply]')
      }
      apply = true
      continue
    }

    if (argument === '--input') {
      if (inputPath !== undefined || index + 1 >= args.length || args[index + 1] === '--apply') {
        throw new Error('Usage: appointments-timestamp-backfill.ts --input <path> [--apply]')
      }
      inputPath = args[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  if (inputPath === undefined || inputPath.length === 0) {
    throw new Error('Usage: appointments-timestamp-backfill.ts --input <path> [--apply]')
  }

  return { inputPath, apply }
}

function requirePositiveSafeInteger(value: string, fieldName: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`Input ${fieldName} must be a positive integer: ${JSON.stringify(value)}`)
  }

  const number = Number(value)
  if (!Number.isSafeInteger(number)) {
    throw new Error(`Input ${fieldName} is outside the safe integer range: ${JSON.stringify(value)}`)
  }

  return number
}

function parseInputRow(line: string, lineNumber: number): PlannedChange {
  const fields = line.split('\t')
  if (fields.length !== 7) {
    throw new Error(`Input line ${lineNumber} must contain exactly 7 tab-separated fields`)
  }

  const [sheetRowText, appointmentId, column, current, shouldBe, problem, _evidence] = fields
  const sheetRow = requirePositiveSafeInteger(sheetRowText, `sheet_row on line ${lineNumber}`)

  let timestampColumn: TimestampColumn
  let columnLetter: (typeof TIMESTAMP_COLUMNS)[number]
  if (column === 'CreatedAt') {
    timestampColumn = column
    columnLetter = 'K'
  } else if (column === 'UpdatedAt') {
    timestampColumn = column
    columnLetter = 'L'
  } else {
    throw new Error(`Input line ${lineNumber} has an unsupported column: ${JSON.stringify(column)}`)
  }

  if (appointmentId.length === 0 || current.length === 0 || shouldBe.length === 0) {
    throw new Error(`Input line ${lineNumber} has an empty required field`)
  }

  if (problem !== 'text-not-parsed' && problem !== 'day-month-transposed') {
    throw new Error(`Input line ${lineNumber} has an unsupported problem: ${JSON.stringify(problem)}`)
  }

  return {
    sheetRow,
    appointmentId,
    column: timestampColumn,
    columnLetter,
    current,
    shouldBe,
    problem,
    cellReference: `${columnLetter}${sheetRow}`,
  }
}

async function readInputFile(inputPath: string): Promise<PlannedChange[]> {
  let content: string
  try {
    content = await readFile(inputPath, 'utf8')
  } catch {
    throw new Error(`Could not read input file: ${inputPath}`)
  }

  if (content.startsWith('\uFEFF')) {
    content = content.slice(1)
  }

  const lines = content.split(/\r?\n/)
  if (lines.at(-1) === '') {
    lines.pop()
  }

  if (lines.length === 0 || lines[0] !== INPUT_HEADER) {
    throw new Error('Input file has an unexpected header')
  }

  const changes = lines.slice(1).map((line, index) => parseInputRow(line, index + 2))
  if (changes.length === 0) {
    throw new Error('Input file contains no data rows')
  }

  const seenCells = new Set<string>()
  for (const change of changes) {
    if (seenCells.has(change.cellReference)) {
      throw new Error(`Input file contains a duplicate target cell: ${change.cellReference}`)
    }
    seenCells.add(change.cellReference)
  }

  return changes
}

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Sheets API returned an invalid ${fieldName}`)
  }
  return value
}

function parseExtendedValue(value: unknown): ExtendedValue | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isRecord(value)) {
    throw new Error('Sheets API returned an invalid userEnteredValue')
  }

  const parsed: ExtendedValue = {}
  for (const property of ['numberValue', 'stringValue', 'boolValue', 'formulaValue', 'errorValue'] as const) {
    if (hasOwn(value, property)) {
      parsed[property] = value[property]
    }
  }
  return parsed
}

function parseCellData(value: unknown): ExtendedValue | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isRecord(value)) {
    throw new Error('Sheets API returned invalid cell data')
  }
  return parseExtendedValue(value.userEnteredValue)
}

function parseTimestampGrid(body: unknown): TimestampGrid {
  if (!isRecord(body) || !Array.isArray(body.sheets)) {
    throw new Error('Sheets API returned an unreadable spreadsheet response')
  }

  const sheet = body.sheets.find((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.properties)) {
      return false
    }
    return candidate.properties.title === APPOINTMENTS_SHEET_NAME
  })
  if (!isRecord(sheet) || !Array.isArray(sheet.data)) {
    throw new Error(`Sheets API response did not contain the ${APPOINTMENTS_SHEET_NAME} sheet data`)
  }

  const rows = new Map<number, TimestampRow>()
  for (const dataBlock of sheet.data) {
    if (!isRecord(dataBlock)) {
      throw new Error('Sheets API returned invalid grid data')
    }

    const startRow = dataBlock.startRow === undefined
      ? 0
      : requireNonNegativeInteger(dataBlock.startRow, 'grid start row')
    const startColumn = dataBlock.startColumn === undefined
      ? TIMESTAMP_START_COLUMN_INDEX
      : requireNonNegativeInteger(dataBlock.startColumn, 'grid start column')
    if (startColumn !== TIMESTAMP_START_COLUMN_INDEX) {
      throw new Error(`Sheets API returned grid data starting at column index ${startColumn}, expected ${TIMESTAMP_START_COLUMN_INDEX}`)
    }

    if (dataBlock.rowData !== undefined && !Array.isArray(dataBlock.rowData)) {
      throw new Error('Sheets API returned invalid row data')
    }

    const rowData = dataBlock.rowData ?? []
    rowData.forEach((rawRow, rowIndex) => {
      if (!isRecord(rawRow)) {
        throw new Error('Sheets API returned invalid row data')
      }
      if (rawRow.values !== undefined && !Array.isArray(rawRow.values)) {
        throw new Error('Sheets API returned invalid cell data')
      }

      const values = rawRow.values ?? []
      const sheetRow = startRow + rowIndex + 1
      if (rows.has(sheetRow)) {
        throw new Error(`Sheets API returned duplicate grid data for row ${sheetRow}`)
      }
      rows.set(sheetRow, {
        values: [parseCellData(values[0]), parseCellData(values[1])],
      })
    })
  }

  return { rows }
}

async function readTimestampGrid(spreadsheetId: string): Promise<TimestampGrid> {
  const url = new URL(`${SHEETS_API_BASE_URL}/${encodeURIComponent(spreadsheetId)}`)
  url.searchParams.set('includeGridData', 'true')
  url.searchParams.set('ranges', `${APPOINTMENTS_SHEET_NAME}!${TIMESTAMP_RANGE}`)
  url.searchParams.set('fields', 'sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))')

  const accessToken = await getGoogleAccessToken()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Appointments Sheets API read failed before receiving a response')
  }

  if (!response.ok) {
    throw new Error(`Appointments Sheets API read failed with HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = (await response.json()) as unknown
  } catch {
    throw new Error('Appointments Sheets API returned invalid JSON')
  }

  return parseTimestampGrid(body)
}

const GOOGLE_SHEETS_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)
const SECONDS_PER_DAY = 24 * 60 * 60

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function renderSerialDatetime(serial: number): string {
  if (!Number.isFinite(serial) || serial < 0) {
    throw new Error(`Invalid datetime serial: ${String(serial)}`)
  }

  const totalSeconds = Math.round(serial * SECONDS_PER_DAY)
  const date = new Date(GOOGLE_SHEETS_EPOCH_UTC_MS + totalSeconds * 1000)
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Datetime serial is outside the supported range: ${String(serial)}`)
  }

  const year = date.getUTCFullYear()
  if (year < 0 || year > 9999) {
    throw new Error(`Datetime serial rendered an unsupported year: ${year}`)
  }

  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)} ` +
    `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`
}

function getCellValue(grid: TimestampGrid, change: PlannedChange): ExtendedValue | undefined {
  const row = grid.rows.get(change.sheetRow)
  return row?.values[change.columnLetter === 'K' ? 0 : 1]
}

function isStringValue(value: ExtendedValue | undefined): value is ExtendedValue & { stringValue: string } {
  return value !== undefined &&
    Object.keys(value).length === 1 &&
    hasOwn(value, 'stringValue') &&
    typeof value.stringValue === 'string'
}

function isNumberValue(value: ExtendedValue | undefined): value is ExtendedValue & { numberValue: number } {
  return value !== undefined &&
    Object.keys(value).length === 1 &&
    hasOwn(value, 'numberValue') &&
    typeof value.numberValue === 'number' &&
    Number.isFinite(value.numberValue)
}

function describeCellValue(value: ExtendedValue | undefined): string {
  if (value === undefined || Object.keys(value).length === 0) {
    return 'empty'
  }
  if (isStringValue(value)) {
    return `string ${JSON.stringify(value.stringValue)}`
  }
  if (isNumberValue(value)) {
    let rendered: string
    try {
      rendered = renderSerialDatetime(value.numberValue)
    } catch {
      rendered = 'unrenderable datetime'
    }
    return `number ${String(value.numberValue)} (renders ${rendered})`
  }
  return `userEnteredValue ${JSON.stringify(value)}`
}

function checkPreconditions(
  grid: TimestampGrid,
  changes: readonly PlannedChange[],
): PreconditionFailure[] {
  const failures: PreconditionFailure[] = []

  for (const change of changes) {
    const actualValue = getCellValue(grid, change)
    let matches = false
    if (change.problem === 'text-not-parsed') {
      matches = isStringValue(actualValue) && actualValue.stringValue === change.current
    } else if (isNumberValue(actualValue)) {
      try {
        matches = renderSerialDatetime(actualValue.numberValue) === change.current
      } catch {
        matches = false
      }
    }

    if (!matches) {
      failures.push({ change, actual: describeCellValue(actualValue) })
    }
  }

  return failures
}

function countByProblem(changes: readonly PlannedChange[]): Map<TimestampProblem, number> {
  const counts = new Map<TimestampProblem, number>()
  for (const change of changes) {
    counts.set(change.problem, (counts.get(change.problem) ?? 0) + 1)
  }
  return counts
}

function printPlan(changes: readonly PlannedChange[]): void {
  console.log('Sample of planned changes (first 10):')
  for (const change of changes.slice(0, 10)) {
    console.log(
      `${change.cellReference} (${change.appointmentId}, ${change.problem}): ` +
      `${JSON.stringify(change.current)} -> ${JSON.stringify(change.shouldBe)}`,
    )
  }
}

function printPreconditionFailures(failures: readonly PreconditionFailure[]): void {
  console.error(`PRECONDITION FAILED: ${failures.length} targeted cell(s) no longer match the input file`)
  for (const failure of failures) {
    console.error(
      `${failure.change.cellReference} (${failure.change.appointmentId}): ` +
      `expected ${JSON.stringify(failure.change.current)}; actual ${failure.actual}`,
    )
  }
  console.error('ABORTED: no writes issued')
}

async function writeBatch(
  spreadsheetId: string,
  changes: readonly PlannedChange[],
): Promise<void> {
  const accessToken = await getGoogleAccessToken()
  const url = `${SHEETS_API_BASE_URL}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`
  const data = changes.map((change) => ({
    range: `${APPOINTMENTS_SHEET_NAME}!${change.cellReference}`,
    majorDimension: 'ROWS',
    values: [[change.shouldBe]],
  }))

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Appointments Sheets API write failed before receiving a response')
  }

  if (!response.ok) {
    throw new Error(`Appointments Sheets API write failed with HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = (await response.json()) as unknown
  } catch {
    throw new Error('Appointments Sheets API write returned invalid JSON after dispatch')
  }

  if (
    !isRecord(body) ||
    !Array.isArray(body.responses) ||
    body.responses.length !== changes.length ||
    body.totalUpdatedCells !== changes.length
  ) {
    throw new Error('Appointments Sheets API write returned an unexpected batch result after dispatch')
  }
}

async function applyChanges(
  spreadsheetId: string,
  changes: readonly PlannedChange[],
): Promise<ApplyResult> {
  let batchesIssued = 0
  let cellsWritten = 0

  for (let start = 0; start < changes.length; start += WRITE_BATCH_SIZE) {
    const batch = changes.slice(start, start + WRITE_BATCH_SIZE)
    batchesIssued += 1
    await writeBatch(spreadsheetId, batch)
    cellsWritten += batch.length
  }

  return { cellsWritten, batchesIssued }
}

function verifyReadback(
  grid: TimestampGrid,
  changes: readonly PlannedChange[],
): PreconditionFailure[] {
  const failures: PreconditionFailure[] = []
  for (const change of changes) {
    const actualValue = getCellValue(grid, change)
    const matches = isNumberValue(actualValue) && (() => {
      try {
        return renderSerialDatetime(actualValue.numberValue) === change.shouldBe
      } catch {
        return false
      }
    })()
    if (!matches) {
      failures.push({ change, actual: describeCellValue(actualValue) })
    }
  }
  return failures
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const changes = await readInputFile(options.inputPath)
  const counts = countByProblem(changes)
  const spreadsheetId = requireEnv(appointmentsDbContract.spreadsheetId!)

  console.log(`Appointments timestamp backfill — ${options.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Input rows: ${changes.length}`)
  console.log(`Cells to change — text-not-parsed: ${counts.get('text-not-parsed') ?? 0}`)
  console.log(`Cells to change — day-month-transposed: ${counts.get('day-month-transposed') ?? 0}`)

  const currentGrid = await readTimestampGrid(spreadsheetId)
  const preconditionFailures = checkPreconditions(currentGrid, changes)
  if (preconditionFailures.length > 0) {
    printPreconditionFailures(preconditionFailures)
    process.exitCode = 1
    return
  }

  console.log(`Precondition: PASSED — all ${changes.length} targeted cells match the TSV current values`)

  if (!options.apply) {
    printPlan(changes)
    console.log('Write calls issued: 0 (dry-run)')
    return
  }

  const applyResult = await applyChanges(spreadsheetId, changes)
  const readbackGrid = await readTimestampGrid(spreadsheetId)
  const readbackFailures = verifyReadback(readbackGrid, changes)

  console.log(`Cells written: ${applyResult.cellsWritten}`)
  console.log(`Batches issued: ${applyResult.batchesIssued}`)
  if (readbackFailures.length > 0) {
    console.error(`Read-back verification: FAILED — ${readbackFailures.length} cell(s)`)
    for (const failure of readbackFailures) {
      console.error(
        `${failure.change.cellReference}: expected real datetime ${JSON.stringify(failure.change.shouldBe)}; actual ${failure.actual}`,
      )
    }
    process.exitCode = 1
    return
  }

  console.log(`Read-back verification: PASSED — all ${changes.length} cells are real datetimes matching should_be`)
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    console.error(`appointments-timestamp-backfill: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
