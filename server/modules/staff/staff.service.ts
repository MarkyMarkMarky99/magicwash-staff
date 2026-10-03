import { z } from 'zod'
import { registerStaffBodySchema, staffSchema, updateStaffBodySchema } from '../../../contracts/staff/staff-api.schema.js'
import { invalidateStaffListCache } from '../../shared/auth/staff-list.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { buildSheetHeaderMap, columnLetterForIndex } from '../../shared/repositories/sheet-header-map.js'
import { SheetsApiClient, type SheetsApiValue } from '../../shared/repositories/sheets-api.client.js'
import { generateShortId } from '../../shared/utils/id.js'

type Staff = z.infer<typeof staffSchema>

const staffColumns = {
  email: 'Email', name: 'Name', role: 'Role', active: 'Active', staffId: 'StaffId',
  phone: 'Phone', address: 'Address', position: 'Position', startDate: 'StartDate',
} satisfies Record<keyof Staff, string>

function normalizeStartDate(value: SheetsApiValue | undefined): string {
  let date: Date
  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000)
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = new Date(`${value}T00:00:00.000Z`)
  } else {
    return ''
  }
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) return ''
  const normalized = date.toISOString().slice(0, 10)
  return typeof value === 'string' && normalized !== value ? '' : normalized
}

export class StaffService {
  constructor(private readonly client: Pick<SheetsApiClient, 'readRange' | 'appendRows' | 'updateCells'>) {}

  async list(): Promise<Staff[]> {
    return (await this.load()).rows.map(({ staff }) => staff)
  }

  async me(email: string): Promise<Staff> {
    const row = (await this.load()).rows.find(({ staff }) => staff.email.trim().toLowerCase() === email)
    if (!row) throw ApiError.notFound('Staff not found')
    return row.staff
  }

  async getById(staffId: string): Promise<Staff> {
    const id = parseOrThrow(z.string().min(1), staffId)
    const row = (await this.load()).rows.find(({ staff }) => staff.staffId === id)
    if (!row) throw ApiError.notFound('Staff not found')
    return row.staff
  }

  async register(email: string, payload: unknown): Promise<Staff> {
    const body = parseOrThrow(registerStaffBodySchema, payload)
    const { header, rows } = await this.load()
    if (rows.some(({ staff }) => staff.email.trim().toLowerCase() === email)) {
      throw ApiError.conflict('This email is already registered')
    }
    const staff: Staff = {
      ...body, email, staffId: generateShortId(), role: null, active: false, position: '', startDate: '',
    }
    const values: SheetsApiValue[] = Array(header.width).fill('')
    for (const [field, column] of Object.entries(staffColumns)) {
      values[header.indexByName[column]] = staff[field as keyof Staff] ?? ''
    }
    await this.client.appendRows([values], 'RAW', header.width)
    invalidateStaffListCache()
    return staff
  }

  async update(staffId: string, email: string, payload: unknown): Promise<Staff> {
    const id = parseOrThrow(z.string().min(1), staffId)
    const body = parseOrThrow(updateStaffBodySchema, payload)
    const { header, rows } = await this.load()
    const row = rows.find(({ staff }) => staff.staffId === id)
    if (!row) throw ApiError.notFound('Staff not found')
    if (row.staff.email.trim().toLowerCase() === email && (body.role !== undefined || body.active !== undefined)) {
      throw ApiError.conflict('You cannot change your own role or active status')
    }
    const updates = Object.entries(body).filter(([, value]) => value !== undefined).map(([field, value]) => {
      const column = header.letterByName[staffColumns[field as keyof typeof body]]
      return { range: `Staff!${column}${row.rowNumber}`, values: [[value!]] }
    })
    await this.client.updateCells(updates, 'RAW')
    invalidateStaffListCache()
    return { ...row.staff, ...body }
  }

  private async load() {
    const headers = await this.client.readRange('1:1', { valueRenderOption: 'UNFORMATTED_VALUE' })
    const header = buildSheetHeaderMap(headers[0] ?? [], Object.values(staffColumns), 'Email')
    const data = await this.client.readRange(`A2:${columnLetterForIndex(header.width - 1)}`, {
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const rows: { staff: Staff; rowNumber: number }[] = []
    for (const [index, cells] of data.entries()) {
      const values = Object.fromEntries(Object.entries(staffColumns).map(([field, column]) => [
        field, String(cells[header.indexByName[column]] ?? ''),
      ]))
      if (!values.email!.trim()) continue
      const role = values.role!.trim().toLowerCase()
      const active = cells[header.indexByName.Active]
      const staff: Staff = {
        staffId: values.staffId!,
        email: values.email!,
        name: values.name!,
        phone: values.phone!,
        address: values.address!,
        position: values.position!,
        startDate: normalizeStartDate(cells[header.indexByName.StartDate]),
        role: role === 'admin' || role === 'staff' ? role : null,
        active: active === true || (typeof active === 'string' && active.trim().toLowerCase() === 'true'),
      }
      rows.push({ staff, rowNumber: index + 2 })
    }
    return { header, rows }
  }
}

export function createStaffService(): StaffService {
  const spreadsheetId = process.env.STAFF_SPREADSHEET_ID
  if (!spreadsheetId?.trim()) throw new Error('STAFF_SPREADSHEET_ID is not set')
  return new StaffService(new SheetsApiClient({ spreadsheetId, sheetName: 'Staff' }))
}
