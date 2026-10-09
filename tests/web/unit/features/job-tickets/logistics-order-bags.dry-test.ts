import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { transpileModule, ScriptTarget } from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { createRouter, createMemoryHistory } from 'vue-router'
import { normalizeSheetTimestamp } from '@shared/utils/bangkok-datetime'

const source = readFileSync(new URL('../../../../../src/features/job-tickets/composables/useLogisticsBags.ts', import.meta.url), 'utf8')
const viewSource = readFileSync(new URL('../../../../../src/features/job-tickets/components/OrderBagsView.vue', import.meta.url), 'utf8')
const script = source.replace(/^import .*$/gm, '').replace(/^export function /m, 'function ')
const code = transpileModule(script, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText
const { filterTickets } = await import('@/features/job-tickets/department-work')

async function harness(options: { cached?: boolean; wait?: Promise<void> } = {}) {
  const scope = effectScope()
  const route = reactive({ name: 'logistics-order-bags', params: { orderId: 'order-1' }, query: { scan: '1', keep: 'yes' } as Record<string, string> })
  const job = (id: string, status = 'Pending') => ({ id: `LOG-order-1-${id}-LOG-BAG`, orderId: 'order-1', scope: 'ORDER', department: 'Logistics', taskCode: 'LOG-BAG', deletedAt: null, status, photoEvidenceUrl: `https://tickets/${id}`, startedAt: null })
  let serverTickets = [job('bag-a'), job('bag-b'), job('bag-done', 'In Progress'),
    { ...job('deleted'), deletedAt: '2026-10-08' }, { ...job('wrong-task'), taskCode: 'OTHER' },
    { ...job('wrong-scope'), scope: 'ITEM' }, { ...job('wrong-order'), orderId: 'order-2' }]
  let reads = 0
  let backs = 0
  let replacements = 0
  const invalidations: string[] = []
  let result: any = null
  let leaveGuard: any
  let updateGuard: any
  const requests: any[] = []
  const cachedTickets = ref<any[]>(options.cached ? [serverTickets[0]] : [])
  const store = {
    orderView: () => ({ loading: false, error: null }),
    orderTickets: (orderId: string, department: string) => cachedTickets.value.filter(row => row.orderId === orderId && row.department === department), retainOrder: () => () => {},
    loadOrder: async (orderId: string, department: string) => {
      assert.equal(orderId, 'order-1'); assert.equal(department, 'Logistics')
      reads += 1; await options.wait; cachedTickets.value = serverTickets
    },
    advanceTickets: async (payload: any) => {
      requests.push(payload)
      if (result instanceof Error) throw result
      const response = result ? await result : { kind: 'completed', advanced: payload.tickets.map(({ ticketId }: any) => ({ ticketId, status: 'In Progress', startedAt: '2026-10-08T10:00:00+07:00' })), blocked: [], skipped: [], scoreFailed: 0 }
      if (response.kind === 'completed') for (const advanced of response.advanced) {
        const ticket = cachedTickets.value.find(row => row.id === advanced.ticketId)
        if (ticket) Object.assign(ticket, { status: advanced.status, startedAt: advanced.startedAt, scannedBy: payload.scannedBy })
      }
      return response
    },
  }
  const dependencies = {
    useJobTicketStore: () => store,
    computed, ref, watch, useRoute: () => route,
    useRouter: () => ({
      push: async ({ query }: any) => { route.query = query },
      replace: async ({ query }: any) => { replacements += 1; route.query = query ?? {} },
      back: () => { backs += 1; route.query = { keep: 'yes' } },
    }),
    useCustomerStore: () => ({ customers: [] }), currentActor: () => 'staff-1',
    feedback: () => {}, primeFeedbackAudio: () => {}, filterTickets, normalizeSheetTimestamp,
    invalidate: (path: string) => { invalidations.push(path) },
    getWorkOrder: async () => ({ orderId: 'order-1', customerId: 'customer-1' }),
    listOrderImages: async () => ({ items: [
      { orderImageId: 'bag-a', imageType: 'BELONGING', quantity: 2.5, imagePath: 'https://images/not-evidence' },
      { orderImageId: 'orphan', imageType: 'WEIGHT', quantity: 99 },
    ] }),
    onActivated: () => {}, onDeactivated: () => {}, onBeforeUnmount: () => {},
    onBeforeRouteLeave: (guard: any) => { leaveGuard = guard },
    onBeforeRouteUpdate: (guard: any) => { updateGuard = guard },
    setTimeout: () => 1, clearTimeout: () => {},
  }
  const page = scope.run(() => new Function(...Object.keys(dependencies), `${code}; return useLogisticsBags(() => 'order-1');`)(...Object.values(dependencies)))!
  const ready = page.load()
  if (!options.wait) await ready
  return { page, ready, route, requests, scope, setResult: (value: any) => { result = value },
    setServerTickets: (value: any) => { serverTickets = value },
    get reads() { return reads }, get backs() { return backs }, get replacements() { return replacements }, invalidations,
    leave: (to: any) => leaveGuard(to), update: () => updateGuard() }
}

let finishCachedLoad!: () => void
const cached = await harness({ cached: true, wait: new Promise<void>(resolve => { finishCachedLoad = resolve }) })
assert.equal(cached.page.loading.value, true)
assert.deepEqual(cached.page.bags.value.map((bag: any) => bag.orderImageId), ['bag-a'])
cached.page.handleScan('bag-a')
assert.equal(cached.page.scannedTicketIds.value.size, 0)
finishCachedLoad()
await cached.ready
assert.equal(cached.page.bags.value.length, 3)
cached.scope.stop()

const local = await harness()
assert.deepEqual(local.page.bags.value.map((bag: any) => bag.orderImageId), ['bag-a', 'bag-b', 'bag-done'])
assert.equal(local.page.bags.value[0].weight, 2.5)
assert.equal(local.page.bags.value[1].weight, null)
assert.equal(local.page.bags.value[0].ticket.photoEvidenceUrl, 'https://tickets/bag-a')
assert.equal(local.page.totalWeight.value, 2.5)
local.page.handleScan('unknown')
assert.equal(local.page.notice.value.message, 'Not a bag of this order')
local.page.handleScan('bag-done')
assert.match(local.page.notice.value.message, /already scanned/)
local.page.handleScan('  https://host/b/old/b/bag-a  ')
assert.equal(local.page.scannedCount.value, 2)
assert.equal(local.page.tickets.value[0].status, 'Pending')
assert.equal(local.requests.length, 0)
local.page.handleScan('bag-a')
assert.match(local.page.notice.value.message, /already scanned/)
assert.equal(local.page.scannedTicketIds.value.size, 1)
local.page.closeScanner()
await nextTick()
assert.equal(local.requests.length, 0)
assert.equal(local.page.scannedTicketIds.value.size, 0)
assert.equal(local.page.scannedCount.value, 1)
assert.equal(local.replacements, 1)
assert.deepEqual(local.route.query, { keep: 'yes' })
local.page.openScanner()
await nextTick()
await Promise.resolve()
local.page.handleScan('bag-a')
await local.page.confirmScans()
assert.deepEqual(local.requests, [{ department: 'Logistics', fromStatus: 'Pending', scannedBy: 'staff-1', tickets: [{ ticketId: 'LOG-order-1-bag-a-LOG-BAG', orderId: 'order-1' }] }])
assert.equal(local.page.tickets.value[0].status, 'In Progress')
assert.equal(local.page.tickets.value[0].scannedBy, 'staff-1')
assert.equal(local.page.tickets.value[1].status, 'Pending')
assert.equal(local.backs, 1)
assert.deepEqual(local.invalidations, ['/api/job-tickets'])
assert.equal(local.reads, 1)
local.scope.stop()

const auto = await harness()
let resolveWrite!: (value: any) => void
const write = new Promise(resolve => { resolveWrite = resolve })
auto.setResult(write)
auto.page.handleScan('bag-a')
auto.page.handleScan('https://host/b/bag-b')
auto.page.handleScan('bag-b')
assert.equal(auto.requests.length, 1)
assert.deepEqual(auto.requests[0].tickets.map((row: any) => row.ticketId), ['LOG-order-1-bag-a-LOG-BAG', 'LOG-order-1-bag-b-LOG-BAG'])
assert.equal(auto.page.submitting.value, true)
assert.equal(auto.update(), false)
assert.equal(auto.leave({}), false)
auto.page.closeScanner()
assert.equal(auto.page.scannerOpen.value, true)
resolveWrite({ kind: 'completed', advanced: auto.requests[0].tickets.map(({ ticketId }: any) => ({ ticketId, status: 'In Progress', startedAt: 'started' })), blocked: [], skipped: [], scoreFailed: 0 })
await new Promise(resolve => setImmediate(resolve))
assert.equal(auto.page.scannerOpen.value, false)
assert.equal(auto.page.tickets.value[1].status, 'In Progress')
assert.equal(auto.page.scannedTicketIds.value.size, 0)
auto.scope.stop()

for (const failure of [
  { kind: 'write_failed', certainty: 'unknown' },
  { kind: 'write_failed', certainty: 'rejected' },
  new Error('Connection failed'),
  { kind: 'completed', advanced: [], blocked: [], skipped: [{ ticketId: 'LOG-order-1-bag-a-LOG-BAG', reason: 'status_changed' }], scoreFailed: 0 },
]) {
  const failed = await harness()
  failed.setResult(failure)
  failed.page.handleScan('bag-a')
  const server = failed.page.tickets.value.map((ticket: any) => ({ ...ticket, status: 'In Progress' }))
  failed.setServerTickets(server)
  await failed.page.confirmScans()
  assert.equal(failed.requests.length, 1)
  assert.equal(failed.reads, 2)
  assert.equal(failed.page.scannedTicketIds.value.size, 0)
  assert.equal(failed.page.tickets.value[0].status, 'In Progress')
  assert.equal(failed.page.scannerOpen.value, false)
  assert.equal(failed.page.notice.value.success, false)
  failed.scope.stop()
}

const back = await harness()
back.page.handleScan('bag-a')
back.route.query = { keep: 'yes' }
await nextTick()
assert.equal(back.page.scannedTicketIds.value.size, 0)
assert.equal(back.requests.length, 0)
back.scope.stop()

const departmentSource = readFileSync(new URL('../../../../../src/features/job-tickets/pages/DepartmentWorkPage.vue', import.meta.url), 'utf8')
const departmentScript = parse(departmentSource).descriptor.scriptSetup!.content.replace(/^import .*$/gm, '')
const departmentCode = transpileModule(departmentScript, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText
const departmentWork = await import('@/features/job-tickets/department-work')
const departmentRoute = reactive({ params: { department: 'logistics' }, query: { status: 'PENDING', group: 'item', scan: '1' } })
const destinations: any[] = []
const ticketStore = { tickets: local.page.tickets.value, loading: false, error: null, loadDepartment: async () => {}, activateDepartment: () => {}, releaseDepartment: () => {} }
const departmentDependencies = { ...departmentWork, computed, ref, watch,
  useRoute: () => departmentRoute, useRouter: () => ({ push: async (to: any) => { destinations.push(to) } }),
  useJobTicketStore: () => ticketStore, useCustomerStore: () => ({ customers: [] }),
  onActivated: () => {}, onDeactivated: () => {}, onBeforeRouteLeave: () => {}, onBeforeRouteUpdate: () => {}, onBeforeUnmount: () => {},
  localStorage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
}
const departmentScope = effectScope()
const departmentPage = departmentScope.run(() => new Function(...Object.keys(departmentDependencies), `${departmentCode}; return { grouper, fromStatus, scannerOpen, openOrder, visibleOrders, counts, expandedOrderId };`)(...Object.values(departmentDependencies)))!
assert.equal(departmentPage.grouper.value, 'order')
assert.equal(departmentPage.fromStatus.value, null)
assert.equal(departmentPage.scannerOpen.value, false)
assert.equal(departmentPage.visibleOrders.value.length, 1)
departmentPage.openOrder('order-1')
assert.deepEqual(destinations, [{ name: 'logistics-order-bags', params: { department: 'logistics', orderId: 'order-1' } }])
assert.equal(departmentPage.expandedOrderId.value, null)
departmentRoute.params.department = 'washing'
await nextTick()
assert.equal(departmentPage.grouper.value, 'item')
assert.equal(departmentPage.fromStatus.value, 'Pending')
departmentPage.openOrder('order-1')
assert.equal(departmentPage.expandedOrderId.value, 'order-1')
departmentPage.openOrder('order-1')
assert.equal(departmentPage.expandedOrderId.value, null)
assert.equal(destinations.length, 1)
departmentScope.stop()
assert.match(departmentSource, /<button v-if="!isLogistics"[^>]*@click="startOrder/)
assert.match(departmentSource, /v-if="!isLogistics && expandedOrderId === order.orderId"/)

const { jobTicketRoutes } = await import('@/features/job-tickets/routes')
const { orderRoutes } = await import('@/features/orders/routes')
assert.equal(jobTicketRoutes.find(route => route.name === 'logistics-order-bags')?.path, '/departments/:department(logistics)/:orderId')
assert.equal(jobTicketRoutes.find(route => route.name === 'logistics-order-bags')?.props, true)
assert.ok(!orderRoutes.some(route => route.name === 'order-bag-scan'))
const router = createRouter({ history: createMemoryHistory(), routes: jobTicketRoutes })
const bagRoute = router.resolve(destinations[0])
assert.equal(bagRoute.path, '/departments/logistics/order-1')
assert.equal(bagRoute.meta.parent, 'department-work')
assert.equal(bagRoute.params.department, 'logistics')
assert.equal(router.resolve({ name: 'department-work' }, bagRoute).path, '/departments/logistics')
assert.ok(!router.resolve('/departments/washing/x').matched.some(route => route.name === 'logistics-order-bags'))

const sorted = await harness()
const baseTicket = sorted.page.tickets.value[0]
const chronologicalTickets = [
  { ...baseTicket, id: 'LOG-order-1-bag-z-LOG-BAG', createdAt: '2026-10-09 09:00:00' },
  { ...baseTicket, id: 'LOG-order-1-bag-b-LOG-BAG', createdAt: 'Date(2026,9,8,9,0,0)' },
  { ...baseTicket, id: 'LOG-order-1-bag-a-LOG-BAG', createdAt: '2026-10-08T02:00:00Z' },
  { ...baseTicket, id: 'LOG-order-1-bag-early-LOG-BAG', createdAt: '2026-10-07 23:59:00' },
]
sorted.setServerTickets(chronologicalTickets)
await sorted.page.load()
assert.deepEqual(sorted.page.bags.value.map((bag: any) => bag.orderImageId), ['bag-early', 'bag-a', 'bag-b', 'bag-z'])
assert.deepEqual(sorted.page.tickets.value.map((ticket: any) => ticket.id), chronologicalTickets.map(ticket => ticket.id))
sorted.scope.stop()

assert.doesNotMatch(source + viewSource, /features\/orders|order-status-presentation|presentationFor|getWorkOrder/)
assert.match(viewSource, /count: bag\.weight, unit: 'kg'/)
assert.match(viewSource, /@click="logistics\.confirmScans"/)
for (const name of ['logistics-order-bags', 'packaging-order-bags']) assert.match(String(jobTicketRoutes.find(route => route.name === name)?.component), /pages\/OrderBagsPage\.vue/)
console.log('logistics-order-bags.dry-test: OK')
