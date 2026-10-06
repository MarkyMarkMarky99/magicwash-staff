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

/** Status badges only: an approved, active row has none. */
export function staffBadges(row: Pick<StaffDto, 'role' | 'active'>): { label: string; tone: BadgeTone }[] {
  if (row.role === null) return [{ label: 'Pending', tone: 'warning' }]
  return row.active ? [] : [{ label: 'Disabled', tone: 'danger' }]
}
