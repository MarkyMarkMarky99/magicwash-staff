import { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { staffRoleSchema } from '@contracts/staff/staff-api.schema'
import type { z } from 'zod'
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'
import type { StaffDto } from '@/data/staff/staff.service'

export type StaffRole = z.infer<typeof staffRoleSchema>
export type StaffDepartment = z.infer<typeof jobTicketDepartmentSchema>
export type StaffStanding = 'pending' | 'active' | 'inactive'

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'ผู้ดูแล',
  staff: 'พนักงาน',
  device: 'อุปกรณ์ร้าน',
}

export const STAFF_ROLE_OPTIONS = staffRoleSchema.options.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export const STAFF_DEPARTMENT_LABELS: Record<StaffDepartment, string> = {
  Tagging: 'Tagging',
  Washing: 'Washing',
  DryCleaning: 'Dry cleaning',
  Ironing: 'Ironing',
  Packaging: 'Packing',
  Logistics: 'Delivery',
}

export const STAFF_DEPARTMENT_OPTIONS = jobTicketDepartmentSchema.options.map((department) => ({
  value: department,
  label: STAFF_DEPARTMENT_LABELS[department],
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
