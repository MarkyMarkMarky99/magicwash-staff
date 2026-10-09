import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { transpileModule, ScriptTarget } from 'typescript'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import * as departmentWork from '@/features/job-tickets/department-work'

const source = readFileSync(new URL('../../../../../src/features/job-tickets/pages/DepartmentWorkPage.vue', import.meta.url), 'utf8')
const sfc = parse(source).descriptor
const script = sfc.scriptSetup!.content.replace(/^import .*$/gm, '')
const code = transpileModule(script, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText
const template = sfc.template!.content
const completeButton = template.split('\n').find(line => line.includes('v-if="showCompleteOrder"'))!
const startButton = template.split('\n').find(line => line.includes('v-if="showStartOrder"'))!
assert.match(completeButton, /@click\.stop="completeOrderId = order.orderId"/)
assert.match(completeButton, /:disabled="syncingOrderIds.has\(order.orderId\) \|\| submitting"/)
assert.equal(completeButton.match(/class="([^"]*)"/)![1], startButton.match(/class="([^"]*)"/)![1])
assert.match(startButton, /@click="startOrder\(order.orderId\)"/)
assert.match(template, /<ConfirmOverlay .*Complete all \$\{completeOrderJobs.length\} open jobs of order \$\{completeOrderId\} in \$\{department\?\.label\}\? This skips the workflow and gives no score\./)

const job = (id: string, status: JobTicketDto['status'] = 'Pending'): JobTicketDto => ({
  id, orderId: '123', laundryItemId: id, scope: 'ITEM', department: 'Packaging', taskCode: 'PCK-STANDARD',
  stepNo: 3, status, startedAt: null, completedAt: null, scannedBy: null, updatedBy: null,
  customerId: null, orderName: null, dueDate: null, specialInstructions: null, notes: null,
  photoEvidenceUrl: null, createdAt: null, createdBy: null, updatedAt: null, deletedAt: null,
  deletedBy: null, workMinutes: 5,
})
function harness() {
  const scope = effectScope()
  const route = reactive({ params: { department: 'packaging' }, query: { status: 'IN PROGRESS' }, name: 'department-work' })
  const auth = reactive({ isAdmin: true })
  const requests: unknown[] = []
  const navigation: unknown[] = []
  const tickets = ref([job('pending'), job('progress', 'In Progress'), { ...job('no-tag'), laundryItemId: null },
    { ...job('weight'), scope: 'ORDER' as const, taskCode: 'PCK-WEIGHT-KG' }, job('done', 'Completed')])
  let result: unknown = { kind: 'completed', completed: ['pending', 'progress', 'no-tag'].map(ticketId => ({ ticketId })) }
  const dependencies = {
    ...departmentWork, computed, ref, watch,
    useAuthStore: () => auth, useCustomerStore: () => ({ customers: [] }),
    useJobTicketStore: () => ({
      get tickets() { return tickets.value }, loadDepartment: async () => {}, releaseDepartment: () => {},
      completeOrder: async (payload: unknown) => { requests.push(payload); if (result instanceof Error) throw result; return await result },
    }),
    useRoute: () => route, useRouter: () => ({
      push: async (value: unknown) => { navigation.push(value) },
      replace: async () => {}, back: () => {},
    }),
    onActivated: () => {}, onDeactivated: () => {}, onBeforeUnmount: () => {},
    onBeforeRouteLeave: () => {}, onBeforeRouteUpdate: () => {},
    setTimeout: () => 1, clearTimeout: () => {},
    currentActor: () => 'staff-id', formatSheetDate: () => '', feedback: () => {}, primeFeedbackAudio: () => {},
    presentStartOrderResult: () => ({ tone: 'success', message: 'Started' }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  const page = scope.run(() => new Function(...Object.keys(dependencies),
    code + '; return { showStartOrder, showCompleteOrder, completeOrderId, completeOrderJobs, completeOrder, sendConfirmed, syncingOrderIds, selectedTicketIds, scanQueue, pageNotice, submitting };')(...Object.values(dependencies)))!
  return { page, route, auth, tickets, requests, navigation, scope, setResult(value: unknown) { result = value } }
}
const ui = harness()
for (const department of ['washing', 'drycleaning', 'ironing', 'packaging', 'logistics']) {
  ui.route.params.department = department
  for (const isAdmin of [false, true]) {
    ui.auth.isAdmin = isAdmin
    for (const status of ['ALL', 'PENDING', 'IN PROGRESS', 'COMPLETED']) {
      ui.route.query.status = status
      assert.equal(ui.page.showCompleteOrder.value, isAdmin && status === 'IN PROGRESS')
      assert.equal(ui.page.showStartOrder.value, department !== 'logistics' && ['ALL', 'PENDING'].includes(status))
    }
  }
}
ui.route.params.department = 'packaging'
ui.route.query.status = 'IN PROGRESS'
ui.auth.isAdmin = true
await nextTick()
ui.page.completeOrderId.value = '123'
assert.deepEqual(ui.page.completeOrderJobs.value.map((ticket: JobTicketDto) => ticket.id), ['pending', 'progress', 'no-tag'])
assert.equal(ui.requests.length, 0, 'opening confirmation never writes')
ui.auth.isAdmin = false
await ui.page.completeOrder()
assert.equal(ui.requests.length, 0, 'lost admin access cannot submit')
ui.auth.isAdmin = true
let finish!: (value: unknown) => void
ui.setResult(new Promise(resolve => { finish = resolve }))
ui.page.selectedTicketIds.value = new Set(['progress'])
const saving = ui.page.completeOrder()
await ui.page.sendConfirmed()
assert.deepEqual(ui.requests, [{ orderId: '123', department: 'Packaging' }])
assert.equal(ui.page.syncingOrderIds.value.has('123'), true)
assert.equal(ui.page.completeOrderId.value, null)
ui.page.completeOrderId.value = '123'
await ui.page.completeOrder()
assert.equal(ui.requests.length, 1, 'saving blocks duplicate submission')
finish({ kind: 'completed', completed: [{ ticketId: 'progress' }] })
await saving
assert.equal(ui.page.syncingOrderIds.value.size, 0)
assert.equal(ui.page.selectedTicketIds.value.size, 0)
assert.equal(ui.page.pageNotice.value.message, '1 completed · No score given')
assert.equal(ui.navigation.length, 0)
ui.route.params.department = 'logistics'
ui.tickets.value = [{ ...job('bag', 'In Progress'), department: 'Logistics', scope: 'ORDER', taskCode: 'LOG-BAG' }]
await nextTick()
ui.page.completeOrderId.value = '123'
ui.setResult({ kind: 'write_failed', certainty: 'unknown' })
await ui.page.completeOrder()
assert.deepEqual(ui.requests.at(-1), { orderId: '123', department: 'Logistics' })
assert.equal(ui.navigation.length, 0, 'Logistics Complete never opens bag page')
assert.match(ui.page.pageNotice.value.message, /Check the order/)
ui.scope.stop()

setActivePinia(createPinia())
const store = useJobTicketStore()
store.rows.set('pending', job('pending'))
const shared = store.rows.get('pending')!
const originalFetch = globalThis.fetch
let status = 200
let response: unknown = { kind: 'completed', scannedBy: 'server-admin', completed: [{
  ticketId: 'pending', status: 'Completed', startedAt: '2026-10-09 12:00:00', completedAt: '2026-10-09 12:00:00',
}] }
globalThis.fetch = (async (input, init) => {
  assert.equal(String(input), '/api/job-tickets/complete-order')
  assert.equal(init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(init?.body)), { orderId: '123', department: 'Packaging' })
  return Response.json(response, { status })
}) as typeof fetch
try {
  await store.completeOrder({ orderId: '123', department: 'Packaging' })
  assert.equal(store.rows.get('pending'), shared, 'patch preserves shared row identity')
  assert.equal(store.orderTickets('123')[0], shared)
  assert.equal(shared.status, 'Completed')
  assert.equal(shared.startedAt, '2026-10-09 12:00:00')
  assert.equal(shared.completedAt, '2026-10-09 12:00:00')
  assert.equal(shared.scannedBy, 'server-admin')
  assert.equal(shared.updatedBy, 'server-admin')
  for (const [certainty, httpStatus] of [['rejected', 502], ['unknown', 500]] as const) {
    shared.status = 'Pending'
    status = httpStatus
    response = { kind: 'write_failed', certainty }
    assert.deepEqual(await store.completeOrder({ orderId: '123', department: 'Packaging' }), response)
    assert.equal(shared.status, 'Pending', 'failed writes never patch rows')
  }
  status = 403
  response = { error: { code: 'FORBIDDEN', message: 'Forbidden' } }
  await assert.rejects(store.completeOrder({ orderId: '123', department: 'Packaging' }))
} finally {
  globalThis.fetch = originalFetch
  store.$dispose()
}
console.log('complete-order.dry-test: OK')
