import type { WorkTransactionDto } from '@/data/work-transactions/work-transaction.service'

export interface DepartmentShare {
  department: WorkTransactionDto['department']
  jobs: number
  minutes: number
}

export interface DaySummary {
  minutes: number
  jobs: number
  byDepartment: DepartmentShare[]
}

export interface StaffTotal {
  staffId: string
  minutes: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysEndingAt(lastDay: string, count: number): string[] {
  const end = Date.parse(`${lastDay}T00:00:00Z`)
  return Array.from({ length: count }, (_value, index) =>
    new Date(end - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10))
}

function dayOf(row: WorkTransactionDto): string {
  return row.createdAt.slice(0, 10)
}

export function summarizeDay(rows: readonly WorkTransactionDto[], staffId: string, day: string): DaySummary {
  const shares = new Map<string, DepartmentShare>()
  let minutes = 0
  let jobs = 0
  for (const row of rows) {
    if (row.staffId !== staffId || dayOf(row) !== day) continue
    const jobChange = row.type === 'EARN' ? 1 : row.type === 'VOID' ? -1 : 0
    minutes += row.minutes
    jobs += jobChange
    const key = row.department ?? ''
    const share = shares.get(key) ?? { department: row.department, jobs: 0, minutes: 0 }
    share.minutes += row.minutes
    share.jobs += jobChange
    shares.set(key, share)
  }
  return {
    minutes,
    jobs,
    byDepartment: [...shares.values()]
      .filter((share) => share.minutes !== 0 || share.jobs !== 0)
      .sort((a, b) => b.minutes - a.minutes),
  }
}

export function dailyMinutes(rows: readonly WorkTransactionDto[], staffId: string, days: readonly string[]): number[] {
  const byDay = new Map<string, number>(days.map((day) => [day, 0]))
  for (const row of rows) {
    const day = dayOf(row)
    if (row.staffId === staffId && byDay.has(day)) byDay.set(day, byDay.get(day)! + row.minutes)
  }
  return days.map((day) => byDay.get(day)!)
}

export function rankStaff(rows: readonly WorkTransactionDto[], days: readonly string[]): StaffTotal[] {
  const inPeriod = new Set(days)
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.staffId === '' || !inPeriod.has(dayOf(row))) continue
    totals.set(row.staffId, (totals.get(row.staffId) ?? 0) + row.minutes)
  }
  return [...totals.entries()]
    .map(([staffId, minutes]) => ({ staffId, minutes }))
    .filter((total) => total.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.staffId.localeCompare(b.staffId))
}

export function averageWorkedDay(minutesPerDay: readonly number[]): number {
  const worked = minutesPerDay.filter((minutes) => minutes > 0)
  return worked.length === 0 ? 0 : Math.round(worked.reduce((sum, minutes) => sum + minutes, 0) / worked.length)
}
