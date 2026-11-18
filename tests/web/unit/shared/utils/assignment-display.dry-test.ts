import assert from 'node:assert/strict'
import { assignmentCreatorText, assignmentDue, assignmentDueText, assignmentOrderText, assignmentOverdue } from '@/shared/utils/assignment-display'
import { agentDisplayName } from '@/shared/utils/agent-display-names'

assert.equal(agentDisplayName('washing'), 'น้องซักผ้า')
assert.equal(agentDisplayName('toString'), undefined)
assert.equal(agentDisplayName('nope'), undefined)

assert.equal(assignmentDue({ dueAt: null }), null)
assert.equal(assignmentDue({ dueAt: undefined }), null)
const due = assignmentDue({ dueAt: '2020-03-07 09:30:00' })
assert.deepEqual(due, { day: '7', month: 'Mar', year: '2020', time: '09:30', today: false })
assert.equal(assignmentDueText({ dueAt: '2020-03-07 09:30:00' }), 'due 7 Mar 09:30')
assert.equal(assignmentDueText({ dueAt: null }), 'No due time')

assert.equal(assignmentOrderText({ orderId: 'ORD-1' }), 'Order ORD-1')
assert.equal(assignmentOrderText({ orderId: null }), '')

const now = Date.parse('2020-03-07T10:00:00+07:00')
assert.equal(assignmentOverdue({ dueAt: '2020-03-07 09:30:00', status: 'open' }, now), true)
assert.equal(assignmentOverdue({ dueAt: '2020-03-07 10:30:00', status: 'open' }, now), false)
assert.equal(assignmentOverdue({ dueAt: '2020-03-07 09:30:00', status: 'done' }, now), false)
assert.equal(assignmentOverdue({ dueAt: null, status: 'open' }, now), false)

assert.equal(assignmentCreatorText({ createdBy: null }), '')
assert.equal(assignmentCreatorText({ createdBy: { kind: 'agent', agentId: 'ironing' } }), 'น้องรีดผ้า')
assert.equal(assignmentCreatorText({ createdBy: { kind: 'agent', agentId: 'mystery' } }), 'mystery')
assert.equal(assignmentCreatorText({ createdBy: { kind: 'admin', staffId: 'S1', name: 'Ann' } }), 'Ann')
assert.equal(assignmentCreatorText({ createdBy: { kind: 'admin', staffId: 'S1' } }), 'S1')

console.log('assignment-display dry test passed')
