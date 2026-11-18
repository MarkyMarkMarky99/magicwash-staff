import type { ReportBar, ReportBreakdownRow, ReportRing, ReportStat } from '@/shared/components/reports/report-types'
import { percentOf, weekdayLabel } from '@/shared/utils/report-format'
import type { DaySummary } from './staff-performance'

export type StaffProfileView = 'day' | 'week'

/** The day's minutes against the 7-day average of worked days; the arc stops at a full circle. */
export function dayRing(minutes: number, average: number): ReportRing {
  return {
    percentage: average === 0 ? 0 : percentOf(minutes, average),
    completed: minutes,
    total: average,
    label: String(minutes),
    caption: 'Work score',
    countText: average > 0 ? `${minutes} of ${average} min` : `${minutes} min`,
  }
}

export function versusAverageNote(minutes: number, average: number): string {
  if (minutes === 0) return 'No work recorded'
  if (average === 0) return 'First day with work this week'
  return `${Math.round(minutes / average * 100)}% of 7-day average (${average} min)`
}

/** `rank` is 1-based; 0 means the member has no minutes that day. */
export function dayStats(jobs: number, rank: number, ranked: number, average: number): ReportStat[] {
  return [
    { key: 'jobs', label: 'Jobs completed', icon: 'task_alt', value: jobs, share: jobs > 0 ? 100 : 0, tone: 'info' },
    {
      key: 'rank',
      label: `Rank of ${ranked} that day`,
      icon: 'emoji_events',
      value: rank > 0 ? `#${rank}` : '–',
      share: rank > 0 ? percentOf(ranked - rank + 1, ranked) : 0,
      tone: 'lime',
    },
    { key: 'average', label: '7-day average', icon: 'avg_pace', value: average, share: average > 0 ? 100 : 0, tone: 'warning' },
  ]
}

export function departmentBreakdown(
  day: Pick<DaySummary, 'minutes' | 'byDepartment'>,
  labels: Readonly<Record<string, string>>,
): ReportBreakdownRow[] {
  return day.byDepartment.map((share) => ({
    key: share.department ?? 'other',
    label: share.department ? labels[share.department] ?? share.department : 'Other',
    detail: `${share.jobs} jobs`,
    value: share.minutes,
    width: day.minutes > 0 ? percentOf(share.minutes, day.minutes) : 0,
  }))
}

export function weekBars(days: readonly string[], minutes: readonly number[], today: string): ReportBar[] {
  return days.map((date, index) => ({
    key: date,
    label: weekdayLabel(date),
    value: minutes[index] ?? 0,
    highlight: date === today,
  }))
}

export interface AssignmentAccess {
  visible: boolean
  /** The staffId to send to the gateway; `null` asks for the viewer's own assignments. */
  staffId: string | null
}

/**
 * Admins see any profile's open assignments and name the member; staff see only their own and must not
 * name anyone (the gateway rejects another id); devices and everyone else see none.
 */
export function assignmentAccess(role: string | null, viewerId: string | null, profileId: string): AssignmentAccess {
  if (role === 'admin') return { visible: true, staffId: profileId }
  if (role === 'staff' && viewerId !== null && viewerId === profileId) return { visible: true, staffId: null }
  return { visible: false, staffId: null }
}
