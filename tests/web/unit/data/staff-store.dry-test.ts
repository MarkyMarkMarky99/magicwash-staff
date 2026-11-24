import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useStaffStore } from '@/data/staff/staff.store'
import type { StaffDto } from '@/data/staff/staff.service'
import { rankDay } from '@/features/staff/utils/staff-performance'

const employee: StaffDto = { staffId: 'owner', name: 'Employee', email: 'employee@example.test',
  role: 'staff', active: true, departments: ['Washing'], phone: '', address: '', position: '', startDate: '' }
const assistant = { staffId: 'AI-owner', name: 'Former Secretary', role: 'assistant', active: false, departments: [] }
let pendingSecretary: ((response: Response) => void) | undefined
let delaySecretary = false
let failDirectory = false
let duplicate = false
let exists = true
const previousFetch = globalThis.fetch
const requests: string[] = []
globalThis.fetch = async (input, init) => {
  const url = String(input)
  requests.push(url)
  if (url === '/api/staff') return Response.json({ success: true, data: [employee] })
  if (url === '/api/staff/directory') {
    if (failDirectory) return Response.json({ success: false, error: { message: 'Unavailable' } }, { status: 500 })
    return Response.json({ success: true, data: duplicate ? [assistant, assistant] : [assistant] })
  }
  if (url === '/api/staff/secretary/owner') {
    if (delaySecretary && init?.method !== 'PATCH') return new Promise<Response>(resolve => { pendingSecretary = resolve })
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      assert.deepEqual(Object.keys(body), ['active'])
      assistant.active = body.active
      exists ||= body.active
    }
    return Response.json({ success: true, data: { staffId: 'owner', assistantId: 'AI-owner', exists, active: assistant.active } })
  }
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

  assert.equal(store.hasActiveSecretary('owner'), false)
  assert.equal(store.hasActiveSecretary('other'), false)
  assert.equal(store.hasActiveSecretary(null), false)
  await store.enableSecretary('owner')
  assert.equal(store.hasActiveSecretary('owner'), true)
  assert.equal(store.items.length, 1)
  assert.equal((await store.readSecretary('owner')).active, true)
  await store.disableSecretary('owner')
  assert.equal(store.hasActiveSecretary('owner'), false)
  assert.equal(store.nameOf(assistant.staffId), assistant.name)
  delaySecretary = true
  const oldRead = store.readSecretary('owner')
  await new Promise(resolve => setImmediate(resolve))
  await store.disableSecretary('owner')
  pendingSecretary!(Response.json({ success: true, data: { staffId: 'owner', assistantId: 'AI-owner', exists: true, active: true } }))
  await oldRead
  assert.equal(store.hasActiveSecretary('owner'), false, 'Late reads cannot undo a disable')
  const readBeforeReset = store.readSecretary('owner')
  await new Promise(resolve => setImmediate(resolve))
  store.reset()
  pendingSecretary!(Response.json({ success: true, data: { staffId: 'owner', assistantId: 'AI-owner', exists: true, active: true } }))
  await readBeforeReset
  assert.equal(store.hasActiveSecretary('owner'), false, 'Late reads cannot repopulate a reset store')
  delaySecretary = false
  assistant.active = true
  duplicate = true
  await store.load()
  assert.equal(store.hasActiveSecretary('owner'), false, 'Ambiguous directory IDs fail closed')
  duplicate = false
  await store.load()
  assert.equal(store.hasActiveSecretary('owner'), true)
  failDirectory = true
  await store.load()
  assert.equal(store.hasActiveSecretary('owner'), false, 'A failed directory reload clears stale eligibility')
  assert.equal(store.nameOf(assistant.staffId), assistant.name, 'Failed reloads retain audit display names')
  failDirectory = false
  store.reset()
  assert.equal(store.nameOf(assistant.staffId), assistant.staffId)
  assert.equal(store.isAssistant(assistant.staffId), false)
  store.$dispose()
} finally {
  globalThis.fetch = previousFetch
}
console.log('staff roster and history names dry test passed')
