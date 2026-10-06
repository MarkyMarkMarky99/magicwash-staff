import assert from 'node:assert/strict'
import { registerStaffBodySchema, updateStaffBodySchema } from '../../../../../../contracts/staff/staff-api.schema'
import {
  createStaffPayload,
  emptyStaffForm,
  staffFormFromRow,
  updateStaffPayload,
} from '../../../../../../src/features/staff/utils/staff-form-payload'
import { staffBadges, staffStanding } from '../../../../../../src/features/staff/utils/staff-presentation'

const row = {
  staffId: 'STF-001',
  email: 'a@example.com',
  name: 'สมชาย',
  phone: '0812345678',
  address: 'กรุงเทพ',
  role: null,
  position: '',
  startDate: '',
  active: false,
}

const created = createStaffPayload({ ...emptyStaffForm(), name: ' สมชาย ', phone: '0812345678', address: ' กรุงเทพ ' })
assert.deepEqual(created, { name: 'สมชาย', phone: '0812345678', address: 'กรุงเทพ' }, 'create payload is trimmed and keeps the leading zero')
assert.equal(registerStaffBodySchema.safeParse(created).success, true)
assert.equal(registerStaffBodySchema.safeParse(createStaffPayload(emptyStaffForm())).success, false, 'empty create form is invalid')

const original = staffFormFromRow(row)
assert.deepEqual(updateStaffPayload({ ...original }, original), {}, 'unchanged form sends nothing')
assert.deepEqual(
  updateStaffPayload({ ...original, name: 'สมศักดิ์', role: 'staff', active: true, startDate: '2026-10-01' }, original),
  { name: 'สมศักดิ์', role: 'staff', active: true, startDate: '2026-10-01' },
  'only changed fields are sent',
)
assert.deepEqual(updateStaffPayload({ ...original, name: ' สมชาย ' }, original), {}, 'whitespace-only edits are not changes')
assert.deepEqual(updateStaffPayload({ ...original, role: '' }, original), {}, 'an unset role is never sent')
assert.equal(updateStaffBodySchema.safeParse(updateStaffPayload({ ...original, name: '' }, original)).success, false, 'blank name is rejected by the contract')

assert.equal(staffStanding({ role: null, active: true }), 'pending')
assert.equal(staffStanding({ role: 'staff', active: false }), 'inactive')
assert.equal(staffStanding({ role: 'admin', active: true }), 'active')
assert.deepEqual(staffBadges({ role: null, active: false }).map((badge) => badge.label), ['Pending'])
assert.deepEqual(staffBadges({ role: 'staff', active: false }).map((badge) => badge.label), ['Disabled'])
assert.deepEqual(staffBadges({ role: 'admin', active: true }), [])

console.log('staff-form-payload.dry-test: OK')
