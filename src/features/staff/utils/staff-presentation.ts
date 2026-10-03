import { staffRoleSchema } from '@contracts/staff/staff-api.schema'
import type { z } from 'zod'
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'
import type { StaffDto } from '@/data/staff/staff.service'

export type StaffRole = z.infer<typeof staffRoleSchema>
export type StaffStanding = 'pending' | 'active' | 'inactive'

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'ผู้ดูแล',
  staff: 'พนักงาน',
}

export const STAFF_ROLE_OPTIONS = staffRoleSchema.options.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

/** No role means the registration has not been approved yet, whatever `active` says. */
export function staffStanding(row: Pick<StaffDto, 'role' | 'active'>): StaffStanding {
  if (row.role === null) return 'pending'
  return row.active ? 'active' : 'inactive'
}

export function staffBadges(row: Pick<StaffDto, 'role' | 'active'>): { label: string; tone: BadgeTone }[] {
  if (row.role === null) return [{ label: 'รออนุมัติ', tone: 'warning' }]

  const badges: { label: string; tone: BadgeTone }[] = [
    { label: ROLE_LABELS[row.role], tone: row.role === 'admin' ? 'brand' : 'info' },
  ]
  if (!row.active) badges.push({ label: 'ปิดใช้งาน', tone: 'danger' })
  return badges
}

export const STAFF_FILTER_KEYS = ['all', 'pending', 'active', 'inactive'] as const
export type StaffFilterKey = (typeof STAFF_FILTER_KEYS)[number]

export const STAFF_FILTER_LABELS: Record<StaffFilterKey, string> = {
  all: 'ทั้งหมด',
  pending: 'รออนุมัติ',
  active: 'ใช้งานอยู่',
  inactive: 'ปิดใช้งาน',
}
