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

export interface BoardEntry<T> {
  member: T
  points: number
  jobs: number
  /** Competition rank (1, 1, 3) among members with points; null for no points. */
  rank: number | null
}

/** One day's ranking of every member, most points first; members without points keep list order at the end. */
export function rankDay<T extends { staffId: string }>(
  members: readonly T[],
  rows: readonly WorkTransactionDto[],
  day: string,
): BoardEntry<T>[] {
  const entries = members.map((member, index) => {
    const summary = member.staffId === '' ? { minutes: 0, jobs: 0 } : summarizeDay(rows, member.staffId, day)
    return { member, points: summary.minutes, jobs: summary.jobs, rank: null as number | null, index }
  })
  entries.sort((a, b) => b.points - a.points || a.index - b.index)
  entries.forEach((entry, position) => {
    if (entry.points <= 0) return
    const previous = entries[position - 1]
    entry.rank = previous && previous.points === entry.points ? previous.rank : position + 1
  })
  return entries.map(({ index: _index, ...entry }) => entry)
}
