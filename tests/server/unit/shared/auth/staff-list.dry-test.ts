import assert from 'node:assert/strict'
import { parseStaffList } from '../../../../../server/shared/auth/staff-list.js'

const members = parseStaffList([
  ['Role', 'Active', 'Name', 'Email'],
  ['ADMIN', true, 'Alice', ' Alice@Example.com '],
  ['staff', 'TrUe', 'Bob', 'bob@example.com'],
  ['staff', false, 'Inactive', 'inactive@example.com'],
  ['staff', 'FALSE', 'Inactive Two', 'inactive2@example.com'],
  ['visitor', true, 'Unknown', 'unknown@example.com'],
])
assert.deepEqual(members.get('alice@example.com'), { email: 'Alice@Example.com', name: 'Alice', role: 'admin' })
assert.deepEqual(members.get('bob@example.com'), { email: 'bob@example.com', name: 'Bob', role: 'staff' })
assert.equal(members.has('inactive@example.com'), false)
assert.equal(members.has('inactive2@example.com'), false)
assert.equal(members.has('unknown@example.com'), false)
assert.throws(() => parseStaffList([['Email', 'Name']]), /missing required columns/)

console.log('staff list dry test passed')
