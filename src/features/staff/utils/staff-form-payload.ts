import type { RegisterStaffInput, StaffDto, UpdateStaffInput } from '@/data/staff/staff.service'
import type { StaffDepartment, StaffRole } from './staff-presentation'

export interface StaffFormState {
  name: string
  phone: string
  address: string
  /** Empty while the row has no role yet (pending approval). */
  role: StaffRole | ''
  position: string
  startDate: string
  departments: StaffDepartment[]
  active: boolean
}

export function emptyStaffForm(): StaffFormState {
  return { name: '', phone: '', address: '', role: '', position: '', startDate: '', departments: [], active: false }
}

export function staffFormFromRow(row: StaffDto): StaffFormState {
  return {
    name: row.name,
    phone: row.phone,
    address: row.address,
    role: row.role ?? '',
    position: row.position,
    startDate: row.startDate,
    departments: [...row.departments],
    active: row.active,
  }
}

export function createStaffPayload(form: StaffFormState): RegisterStaffInput {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
  }
}

/** Only the fields the admin actually changed; an empty object means nothing to save. */
export function updateStaffPayload(form: StaffFormState, original: StaffFormState): UpdateStaffInput {
  const payload: UpdateStaffInput = {}
  if (form.name.trim() !== original.name.trim()) payload.name = form.name.trim()
  if (form.phone.trim() !== original.phone.trim()) payload.phone = form.phone.trim()
  if (form.address.trim() !== original.address.trim()) payload.address = form.address.trim()
  if (form.role !== '' && form.role !== original.role) payload.role = form.role
  if (form.position.trim() !== original.position.trim()) payload.position = form.position.trim()
  if (form.startDate !== original.startDate) payload.startDate = form.startDate
  if (form.departments.length !== original.departments.length
    || form.departments.some((department) => !original.departments.includes(department))) {
    payload.departments = [...form.departments]
  }
  if (form.active !== original.active) payload.active = form.active
  return payload
}
