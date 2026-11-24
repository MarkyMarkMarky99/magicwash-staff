import { z } from 'zod'
import { jobTicketDepartmentSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { registerStaffBodySchema, staffDirectoryEntrySchema, staffReadRoleSchema, staffSchema, updateStaffBodySchema } from '../../../contracts/staff/staff-api.schema.js'
import { invalidateStaffListCache, type SecretaryOwner, type StaffMember } from '../../shared/auth/staff-list.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { buildSheetHeaderMap, columnLetterForIndex } from '../../shared/repositories/sheet-header-map.js'
import { SheetsApiClient, type SheetsApiValue } from '../../shared/repositories/sheets-api.client.js'
import { generateShortId } from '../../shared/utils/id.js'

type Staff = z.infer<typeof staffSchema>
type StaffDirectoryEntry = z.infer<typeof staffDirectoryEntrySchema>

const departmentsColumn = 'Departments'
const staffColumns = {
  email: 'Email', name: 'Name', role: 'Role', active: 'Active', staffId: 'StaffId',
  phone: 'Phone', address: 'Address', position: 'Position', startDate: 'StartDate',
} satisfies Record<Exclude<keyof Staff, 'departments'>, string>

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
    return (await this.load()).rows.flatMap(({ staff }) => staff.role === 'assistant' ? [] : [staff])
  }

  async listDirectory(): Promise<StaffDirectoryEntry[]> {
    return (await this.load()).rows.map(({ staff }) => staffDirectoryEntrySchema.parse(staff))
  }

  async listAssistantIds(): Promise<Set<string>> {
    return new Set((await this.load()).rows.flatMap(({ staff }) => staff.role === 'assistant' ? [staff.staffId] : []))
  }

  async resolveSecretary(ownerId: string): Promise<(StaffMember & { onBehalfOf: SecretaryOwner }) | undefined> {
    const { rows } = await this.load()
    const assistants = rows.filter(({ staff }) => staff.staffId === `AI-${ownerId}`)
    const owners = rows.filter(({ staff }) => staff.staffId === ownerId)
    if (assistants.length !== 1 || owners.length !== 1) return undefined
    const assistant = assistants[0]!.staff
    const owner = owners[0]!.staff
    if (!assistant.active || assistant.role !== 'assistant' || !owner.active || owner.staffId.toUpperCase() === 'AI'
      || (owner.role !== 'admin' && owner.role !== 'staff')) return undefined
    return {
      staffId: assistant.staffId, email: assistant.email, name: assistant.name, role: assistant.role,
      onBehalfOf: { staffId: owner.staffId, role: owner.role, departments: owner.departments },
    }
  }

  async me(email: string): Promise<Staff> {
    const row = (await this.load()).rows.find(({ staff }) => staff.role !== 'assistant' && staff.email.trim().toLowerCase() === email)
    if (!row) throw ApiError.notFound('Staff not found')
    return row.staff
  }

  async getById(staffId: string): Promise<Staff> {
    const id = parseOrThrow(z.string().min(1), staffId)
    const row = (await this.load()).rows.find(({ staff }) => staff.role !== 'assistant' && staff.staffId === id)
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
      ...body, email, staffId: generateShortId(), role: null, active: false, position: '', startDate: '', departments: [],
    }
    const values: SheetsApiValue[] = Array(header.width).fill('')
    for (const [field, column] of Object.entries(staffColumns)) {
      values[header.indexByName[column]] = staff[field as keyof typeof staffColumns] ?? ''
    }
    await this.client.appendRows([values], 'RAW', header.width)
    invalidateStaffListCache()
    return staff
  }

  async update(staffId: string, email: string, payload: unknown): Promise<Staff> {
    const id = parseOrThrow(z.string().min(1), staffId)
    const { departments, ...body } = parseOrThrow(updateStaffBodySchema, payload)
    const { header, rows } = await this.load()
    const row = rows.find(({ staff }) => staff.role !== 'assistant' && staff.staffId === id)
    if (!row) throw ApiError.notFound('Staff not found')
    if (row.staff.email.trim().toLowerCase() === email && (body.role !== undefined || body.active !== undefined)) {
      throw ApiError.conflict('You cannot change your own role or active status')
    }
    const updates = Object.entries(body).filter(([, value]) => value !== undefined).map(([field, value]) => {
      const column = header.letterByName[staffColumns[field as keyof typeof body]]
      return { range: `Staff!${column}${row.rowNumber}`, values: [[value!]] }
    })
    if (departments !== undefined) {
      const column = header.letterByName[departmentsColumn]
      if (!column) throw ApiError.conflict('The Staff sheet is missing the Departments column')
      updates.push({ range: `Staff!${column}${row.rowNumber}`, values: [[departments.join(', ')]] })
    }
    await this.client.updateCells(updates, 'RAW')
    invalidateStaffListCache()
    return { ...row.staff, ...body, departments: departments ?? row.staff.departments }
  }

  private async load() {
    const headers = await this.client.readRange('1:1', { valueRenderOption: 'UNFORMATTED_VALUE' })
    const header = buildSheetHeaderMap(headers[0] ?? [], Object.values(staffColumns), 'Email')
    const data = await this.client.readRange(`A2:${columnLetterForIndex(header.width - 1)}`, {
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const rows: { staff: Staff; rowNumber: number }[] = []
    const departmentsIndex = header.indexByName[departmentsColumn]
    for (const [index, cells] of data.entries()) {
      const values = Object.fromEntries(Object.entries(staffColumns).map(([field, column]) => [
        field, String(cells[header.indexByName[column]] ?? ''),
      ]))
      if (!values.email!.trim()) continue
      const role = staffReadRoleSchema.safeParse(values.role!.trim().toLowerCase())
      const active = cells[header.indexByName.Active]
      const departmentsCell = departmentsIndex === undefined ? '' : String(cells[departmentsIndex] ?? '')
      const departments = departmentsCell.split(',').map((value) => value.trim())
      const staff: Staff = {
        staffId: values.staffId!,
        email: values.email!,
        name: values.name!,
        phone: values.phone!,
        address: values.address!,
        position: values.position!,
        startDate: normalizeStartDate(cells[header.indexByName.StartDate]),
        departments: jobTicketDepartmentSchema.options.filter((department) =>
          departments.includes(department),
        ),
        role: role.success ? role.data : null,
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
