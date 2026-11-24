import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useStaffStore } from '@/data/staff/staff.store'
import type { StaffDto } from '@/data/staff/staff.service'
import { rankDay } from '@/features/staff/utils/staff-performance'

const employee: StaffDto = { staffId: 'owner', name: 'Employee', email: 'employee@example.test',
  role: 'staff', active: true, departments: ['Washing'], phone: '', address: '', position: '', startDate: '' }
const assistant = { staffId: 'AI-owner', name: 'Former Secretary', role: 'assistant', active: false, departments: [] }
const previousFetch = globalThis.fetch
const requests: string[] = []
globalThis.fetch = async (input) => {
  const url = String(input)
  requests.push(url)
  if (url === '/api/staff') return Response.json({ success: true, data: [employee] })
  if (url === '/api/staff/directory') return Response.json({ success: true, data: [assistant] })
  assert.fail(`Unexpected request ${url}`)
}

try {
  setActivePinia(createPinia())
  const store = useStaffStore()
  await store.load()
  assert.deepEqual(requests.sort(), ['/api/staff', '/api/staff/directory'])
  assert.deepEqual(store.items, [employee])
  assert.equal(store.nameOf(assistant.staffId), assistant.name)
  assert.equal(store.nameOf(employee.staffId), employee.name)
  assert.equal(store.isAssistant(assistant.staffId), true)
  assert.equal(store.isAssistant(employee.staffId), false)

  const day = '2026-11-24'
  const board = rankDay(store.items, [
    { id: 'e1', jobTicketId: 'T1', type: 'EARN', department: 'Washing', minutes: 10,
      staffId: employee.staffId, createdAt: day, createdBy: employee.staffId },
    { id: 'v1', jobTicketId: 'T1', type: 'VOID', department: 'Washing', minutes: -5,
      staffId: employee.staffId, createdAt: day, createdBy: assistant.staffId },
    { id: 'e2', jobTicketId: 'T2', type: 'EARN', department: 'Washing', minutes: 20,
      staffId: assistant.staffId, createdAt: day, createdBy: assistant.staffId },
  ], day)
  assert.deepEqual(board.map((entry) => [entry.member.staffId, entry.points]), [['owner', 5]])

  store.reset()
  assert.equal(store.nameOf(assistant.staffId), assistant.staffId)
  assert.equal(store.isAssistant(assistant.staffId), false)
  store.$dispose()
} finally {
  globalThis.fetch = previousFetch
}
console.log('staff roster and history names dry test passed')
