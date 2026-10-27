import { attendanceDbContract, attendanceRowSchema, type AttendanceRow } from './Attendance.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { SheetsApiClient, type SheetsApiValue } from '../../shared/repositories/sheets-api.client.js'
import { requireEnv } from '../../shared/utils/env.js'

const columns = Object.keys(attendanceRowSchema.shape) as (keyof AttendanceRow)[]
const dateColumns = new Set(['work_date', 'created_at', 'updated_at', 'deleted_at'])

function normalizeRow(row: Record<string, SheetsApiValue | undefined>): AttendanceRow {
  return attendanceRowSchema.parse(Object.fromEntries(columns.map((column) => {
    let value = row[column]
    // UNFORMATTED_VALUE returns native date cells as serials in the sheet's wall clock.
    if (typeof value === 'number' && dateColumns.has(column)) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400) * 1000)
      value = date.toISOString().replace('T', ' ').slice(0, column === 'work_date' ? 10 : 19)
    }
    const nullable = attendanceRowSchema.shape[column].isNullable()
    return [column, value == null || value === '' ? (nullable ? null : '') : String(value)]
  })))
}

/** Restricted workbook: every read, including write readback, uses authenticated Sheets API. */
export class AttendanceRepository {
  private readonly writer: SheetRepository<AttendanceRow>

  constructor(private readonly client: SheetsApiClient, now?: () => Date) {
    this.writer = new SheetRepository({ contract: attendanceDbContract, sheetsApiClient: client, now })
  }

  async read(): Promise<AttendanceRow[]> {
    const [header, ...rows] = await this.client.readRange('A:K', {
      valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER',
    })
    if (!header || header.length !== columns.length || columns.some((column, index) => header[index] !== column)) {
      throw new Error('Attendance header must match the eleven contract columns A:K')
    }
    return rows.filter((cells) => cells[0] != null && cells[0] !== '')
      .map((cells) => normalizeRow(Object.fromEntries(columns.map((column, index) => [column, cells[index]]))))
  }

  async append(row: Partial<AttendanceRow>): Promise<AttendanceRow> {
    // Single-row batch append keeps repository audit stamping without its GViz recovery path.
    const [saved] = await this.writer.batchAppend([row])
    return normalizeRow(saved!)
  }

  async update(id: string, patch: Partial<AttendanceRow>): Promise<AttendanceRow> {
    await this.writer.update(id, patch)
    // Generic update readback uses sheet-formatted dates; read serials to avoid locale-dependent DTOs.
    const saved = (await this.read()).find((row) => row.id === id)
    if (!saved) throw new Error('Updated Attendance record could not be read back')
    return saved
  }
}

let repository: AttendanceRepository | undefined
export function getAttendanceRepository(): AttendanceRepository {
  return repository ??= new AttendanceRepository(new SheetsApiClient({
    spreadsheetId: requireEnv('STAFF_SPREADSHEET_ID'), sheetName: 'Attendance',
  }))
}
