import { z } from 'zod'
import {
  attendanceApiContract, attendanceDayOffSchema, attendanceResponseSchema,
} from '../../../contracts/attendance/attendance-api.schema.js'
import { bangkokToday } from '../../../shared/utils/bangkok-datetime.js'
import type { StaffMember } from '../../shared/auth/staff-list.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { generateShortId } from '../../shared/utils/id.js'
import type { AttendanceRow } from '../../sheets/Attendance/Attendance.db-contract.js'
import { getAttendanceRepository } from '../../sheets/Attendance/Attendance.repository.js'

type Repository = Pick<ReturnType<typeof getAttendanceRepository>, 'read' | 'append' | 'update'>
type Create = z.infer<typeof attendanceApiContract.request.create>

// Attendance's public contract specifies 400 rather than the generic validation status 422.
function parseInput<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  try { return parseOrThrow(schema, input) } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      throw ApiError.badRequest(error.message, error.details)
    }
    throw error
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function monday(date: string): string {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7))
}

function toApi(row: AttendanceRow) {
  return attendanceResponseSchema.parse({
    id: row.id, staffId: row.staff_id, workDate: row.work_date, status: row.status,
    notes: row.notes, createdAt: row.created_at, createdBy: row.created_by,
    updatedAt: row.updated_at, updatedBy: row.updated_by,
  })
}

export class AttendanceService {
  constructor(
    private readonly getRepository: () => Repository = getAttendanceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(query: unknown) {
    const { week } = parseInput(attendanceApiContract.query.list, query)
    const start = monday(week)
    const end = addDays(start, 6)
    return (await this.activeRows()).filter((row) => row.work_date >= start && row.work_date <= end).map(toApi)
  }

  async bookDayOff(payload: unknown, actor: StaffMember) {
    if (actor.role !== 'staff' && actor.role !== 'admin') throw ApiError.forbidden()
    const { workDate } = parseInput(attendanceDayOffSchema, payload)
    const today = bangkokToday(this.now())
    if (workDate <= today || workDate > addDays(today, 14)) {
      throw ApiError.badRequest('Day off must be tomorrow through 14 days ahead (Asia/Bangkok)')
    }
    return this.createRow({ staffId: actor.staffId, workDate, status: 'DAY_OFF' }, actor.staffId)
  }

  async create(payload: unknown, actor: StaffMember) {
    this.requireAdmin(actor)
    return this.createRow(parseInput(attendanceApiContract.request.create, payload), actor.staffId)
  }

  async update(id: unknown, payload: unknown, actor: StaffMember) {
    this.requireAdmin(actor)
    const key = parseInput(z.string().trim().min(1), id)
    const body = parseInput(attendanceApiContract.request.update, payload)
    const rows = await this.activeRows()
    const row = this.findRow(rows, key)
    const candidate = {
      staffId: row.staff_id, workDate: body.workDate ?? row.work_date,
      status: body.status ?? row.status,
    }
    this.checkRules(candidate, rows.filter((other) => other.id !== key))
    const patch: Partial<AttendanceRow> = { updated_by: actor.staffId }
    if (body.workDate !== undefined) patch.work_date = body.workDate
    if (body.status !== undefined) patch.status = body.status
    if (body.notes !== undefined) patch.notes = body.notes
    return toApi(await this.getRepository().update(key, patch))
  }

  async cancel(id: unknown, actor: StaffMember): Promise<{ id: string }> {
    this.requireAdmin(actor)
    const key = parseInput(z.string().trim().min(1), id)
    this.findRow(await this.activeRows(), key)
    await this.getRepository().update(key, {
      deleted_at: formatBangkokTimestamp(this.now()), deleted_by: actor.staffId, updated_by: actor.staffId,
    })
    return { id: key }
  }

  private requireAdmin(actor: StaffMember): void {
    if (actor.role !== 'admin') throw ApiError.forbidden('Attendance administration requires an admin')
  }

  private async activeRows() {
    return (await this.getRepository().read()).filter((row) => !row.deleted_at)
  }

  private findRow(rows: AttendanceRow[], id: string): AttendanceRow {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) throw ApiError.notFound('Attendance record not found')
    return row
  }

  private async createRow(body: Create, actorId: string) {
    this.checkRules(body, await this.activeRows())
    return toApi(await this.getRepository().append({
      id: generateShortId(), staff_id: body.staffId, work_date: body.workDate, status: body.status,
      notes: body.notes ?? null, created_by: actorId,
      updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
    }))
  }

  private checkRules(body: Pick<Create, 'staffId' | 'workDate' | 'status'>, rows: AttendanceRow[]): void {
    if (rows.some((row) => row.staff_id === body.staffId && row.work_date === body.workDate)) {
      throw ApiError.conflict(`Staff ${body.staffId} already has an attendance record on ${body.workDate}`)
    }
    if (body.status !== 'DAY_OFF') return
    const occupied = rows.find((row) => row.status === 'DAY_OFF' && row.work_date === body.workDate)
    if (occupied) throw ApiError.conflict(`Staff ${occupied.staff_id} already has the day off on ${body.workDate}`)
    if (rows.some((row) => row.status === 'DAY_OFF' && row.staff_id === body.staffId && monday(row.work_date) === monday(body.workDate))) {
      throw ApiError.conflict(`Staff ${body.staffId} already has a day off in the week of ${monday(body.workDate)}`)
    }
  }
}
