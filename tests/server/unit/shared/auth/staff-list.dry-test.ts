import assert from 'node:assert/strict'
import { parseStaffList } from '../../../../../server/shared/auth/staff-list.js'

const members = parseStaffList([
  ['Role', 'Active', 'Name', 'Email', 'StaffId'],
  ['ADMIN', true, 'Alice', ' Alice@Example.com ', ' alice-id '],
  ['staff', 'TrUe', 'Bob', 'bob@example.com', 123],
  ['staff', false, 'Inactive', 'inactive@example.com'],
  ['staff', 'FALSE', 'Inactive Two', 'inactive2@example.com'],
  ['visitor', true, 'Unknown', 'unknown@example.com'],
])
assert.deepEqual(members.get('alice@example.com'), { staffId: 'alice-id', email: 'Alice@Example.com', name: 'Alice', role: 'admin' })
assert.deepEqual(members.get('bob@example.com'), { staffId: '123', email: 'bob@example.com', name: 'Bob', role: 'staff' })
assert.equal(members.has('inactive@example.com'), false)
assert.equal(members.has('inactive2@example.com'), false)
assert.equal(members.has('unknown@example.com'), false)
assert.throws(() => parseStaffList([['Email', 'Name']]), /missing required columns/)

assert.throws(() => parseStaffList([['Email', 'Name', 'Role', 'Active']]), /missing required columns/)
assert.equal(parseStaffList([['Email', 'Name', 'Role', 'Active', 'StaffId'], ['a@b.com', 'A', 'staff', true]]).get('a@b.com')?.staffId, '')

console.log('staff list dry test passed')
