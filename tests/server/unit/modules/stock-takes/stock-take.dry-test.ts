import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stockTakeReportSchema } from '../../../../../contracts/stock-takes/stock-take-api.schema.js'
import { StockTakeService } from '../../../../../server/modules/stock-takes/stock-take.service.js'
import { buildTicketPlan, inspectRoute, preflight, type Scan, type Ticket } from '../../../../../server/modules/stock-takes/stock-take-plan.js'
import { computeStockTakeReport, type Entry, type Inventory, type Session } from '../../../../../server/modules/stock-takes/stock-take-report.js'
import { serviceRoutes } from '../../../../../server/modules/work-orders/job-ticket-provisioning.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import type { StockTakesRow } from '../../../../../server/sheets/StockTakes/StockTakes.repository.js'
import type { StockTakeEntriesRow } from '../../../../../server/sheets/StockTakeEntries/StockTakeEntries.repository.js'

const now = '2026-11-19 09:10:11'
const session: Session = {
  id: 'ST-1', status: 'CLOSED', openedAt: now, openedBy: 'admin', closedAt: now, closedBy: 'admin',
  appliedAt: null, appliedBy: null, notes: null,
}
const tag = 'TAG00001'
const wash: Scan = { tag, department: 'Washing', status: 'In Progress', bagId: null }
const pack: Scan = { tag, department: 'Packaging', status: 'Pending', bagId: null }
const packed: Scan = { tag, department: null, status: 'Packed', bagId: 'bag' }

function route(service: keyof typeof serviceRoutes, orderId = 'a', laundryItemId = tag): Ticket[] {
  return serviceRoutes[service].map((step, index) => ({
    id: orderId + '-' + laundryItemId + '-' + index, order_id: orderId, scope: 'ITEM', laundry_item_id: laundryItemId,
    department: step.department, task_code: step.taskCode, step_no: index + 1, status: 'Pending',
  }))
}

function scan(data: Scan, tag = data.tag): Entry {
  return { kind: 'SCAN', laundry_item_id: tag, department: data.department, status: data.status, bag_id: data.bagId }
}

function inventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    orders: [{ id: 'a', status: 'APPROVED', service_type: 'WASH' }],
    orderGarments: [{ order_id: 'a', laundry_item_id: tag }],
    photos: [], items: [{ id: tag, item_id: 'coat' }], lines: [], bags: [], images: [],
    registrationPhotos: [{ photo_type: 'REGISTRATION', laundry_item_id: tag, image_url: 'https://example.test/photo' }],
    itemTypes: [{ id: 'coat', display_name_en: 'Coat' }], tickets: route('WASH'), ...overrides,
  }
}

function resolution(tag: string, resolution: StockTakeEntriesRow['resolution'], order = 'a', reason?: string): Entry {
  return { kind: 'RESOLUTION', order_id: order, laundry_item_id: tag, resolution, reason }
}

test('expected set, dispositions, registration, membership, conflicts, and unexpected scans', () => {
  const tags = Array.from({ length: 9 }, (_, i) => 'TAG0000' + (i + 1))
  const [found, returned, offSite, lost, photoOnly, vanished, ticketOnly, closed, other] = tags as [string, string, string, string, string, string, string, string, string]
  const input = inventory({
    orders: [
      { id: 'a', status: 'PENDING', service_type: 'WASH' }, { id: 'b', status: 'PENDING', service_type: 'WASH' },
      { id: 'c', status: 'COMPLETED' }, { id: 'd', status: 'CANCELLED' },
    ],
    items: tags.filter(value => value !== vanished).map(id => ({ id, item_id: 'coat' })),
    orderGarments: [...[found, returned, offSite, lost, vanished].map(laundry_item_id => ({ order_id: 'a', laundry_item_id })),
      { order_id: 'c', laundry_item_id: closed }],
    photos: [found, returned, offSite, lost, photoOnly].map(item_id => ({ order_id: 'a', item_id })),
    tickets: [...route('WASH'), ...route('WASH', 'a', ticketOnly)],
  })
  const entries = [
    scan(wash, found), scan(wash, vanished), scan(wash, closed), scan(wash, other),
    resolution(returned, 'RETURNED', 'a', 'Received by customer'), resolution(offSite, 'OFF_SITE', 'a', 'Vendor'),
    resolution(lost, 'LOST'), resolution(photoOnly, 'KEEP_LOOKING'), resolution(ticketOnly, 'LINK_CONFIRMED'),
  ]
  const { report, plans } = computeStockTakeReport(session, input, entries)
  stockTakeReportSchema.parse(report)
  assert.deepEqual(report.orders.map(({ orderId, found, returned, offSite, expected, accounted }) =>
    [orderId, found, returned, offSite, expected, accounted]), [['a', 1, 1, 1, 6, false]])
  assert.deepEqual(report.missing.map(row => row.tag).sort(), [lost, photoOnly, ticketOnly].sort())
  assert.equal(report.orders[0]?.garments[0]?.registrationPhoto, 'https://example.test/photo')
  assert.deepEqual(report.membershipGaps.map(({ code }) => code).sort(),
    ['missing_registration', 'one_membership_source', 'one_membership_source', 'ticket_without_link'].sort())
  assert.deepEqual(report.unexpected.map(({ code }) => code), ['closed_order_only', 'no_open_order'])
  assert.equal(plans.length, 1)
  const clean = computeStockTakeReport(session, inventory(), [scan(wash)]).report
  assert.equal(clean.orders[0]?.accounted, true)
})

test('legacy photo-linked garments are expected without a LaundryItems row; orders with no garments stay out', () => {
  const legacy = 'iMYAptq9'
  const input = inventory({
    orders: [{ id: 'a', status: 'APPROVED', service_type: 'WASH' }, { id: 'e', status: 'SUBMITTED' }, { id: 'p', status: 'PENDING' }],
    orderGarments: [], items: [], registrationPhotos: [],
    photos: [{ order_id: 'a', item_id: legacy, image_url: 'https://example.test/legacy' }, { order_id: 'p', item_id: null }],
    tickets: route('WASH', 'a', legacy),
  })
  const { report, plans } = computeStockTakeReport(session, input, [scan(wash, legacy)])
  stockTakeReportSchema.parse(report)
  assert.deepEqual(report.orders.map(({ orderId, found, expected, accounted }) => [orderId, found, expected, accounted]), [['a', 1, 1, true]])
  assert.equal(report.orders[0]?.garments[0]?.registrationPhoto, 'https://example.test/legacy')
  assert.equal(report.orders[0]?.garments[0]?.garmentType, null)
  assert.deepEqual(report.membershipGaps, [])
  assert.deepEqual(report.unexpected, [])
  assert.equal(plans.length, 1)
})

test('competing claims need an explicit owner and the latest confirmation wins', () => {
  const input = inventory({
    orders: [{ id: 'a', service_type: 'WASH' }, { id: 'b', service_type: 'WASH' }],
    orderGarments: [{ order_id: 'a', laundry_item_id: tag }, { order_id: 'b', laundry_item_id: tag }],
    tickets: [...route('WASH'), ...route('WASH', 'b')],
  })
  const unresolved = computeStockTakeReport(session, input, [scan(wash)])
  assert.deepEqual(unresolved.report.orders.map(order => order.found), [0, 0])
  assert.equal(unresolved.plans.length, 0)
  const confirmed = computeStockTakeReport(session, input, [scan(wash), resolution(tag, 'LINK_CONFIRMED'), resolution(tag, 'LINK_CONFIRMED', 'b')])
  assert.deepEqual(confirmed.report.orders.map(order => order.found), [0, 1])
  assert.deepEqual(confirmed.plans.map(plan => plan.orderId), ['b'])
  const conflict = computeStockTakeReport(session, inventory(), [scan(wash), scan(pack), scan(packed), scan({ ...packed, bagId: 'other' })])
  assert.deepEqual(conflict.report.conflicts.map(issue => issue.code), ['multiple_zones', 'multiple_bags'])
  assert.equal(conflict.plans.length, 0)
})

test('plans every provisioned route, includes unchanged steps, and blocks backward or incomplete routes', () => {
  for (const service of Object.keys(serviceRoutes) as Array<keyof typeof serviceRoutes>) {
    const tickets = route(service)
    const forward = inspectRoute(tickets, service, pack, null, false)
    assert.ok('steps' in forward)
    const rows = buildTicketPlan(forward.steps, session.id, 'admin', now)
    assert.equal(rows.length, tickets.length)
    assert.equal(rows.at(-1)?.patch, null)
    for (const row of rows.slice(0, -1)) {
      assert.equal(JSON.parse(row.patch!).status, 'Completed')
      assert.equal(JSON.parse(row.patch!).updated_at, now)
    }
  }
  for (const [tickets, expected] of [
    [[{ ...route('WASH')[0]!, status: 'Cancelled' }, route('WASH')[1]!], 'cancelled_step'],
    [[route('WASH')[1]!], 'missing_route_step'],
    [[route('WASH')[0]!, { ...route('WASH')[1]!, status: 'Completed' }], 'backward'],
  ] as const) {
    const result = inspectRoute(tickets, 'WASH', expected === 'backward' ? wash : pack, null, false)
    assert.ok('issue' in result)
    assert.equal(result.issue, expected)
  }

  const alreadyPacked = route('WASH').map(ticket => ({ ...ticket, status: 'Completed' as const }))
  for (const verified of [true, false]) {
    const result = inspectRoute(alreadyPacked, 'WASH', packed, null, verified)
    assert.ok('steps' in result, 'a garment already packed in the system is a no-op, not backward')
    assert.ok(buildTicketPlan(result.steps, session.id, 'admin', now).every(row => row.patch === null))
  }

  const [first, last] = route('WASH')
  const tickets = [first!, { ...first!, id: 'wash2', step_no: 2 }, { ...last!, step_no: 3 }]
  const input = inventory({ tickets })
  assert.equal(computeStockTakeReport(session, input, [scan(wash)]).report.conflicts[0]?.code, 'multiple_tasks')
  const picked = computeStockTakeReport(session, input, [
    scan(wash), { ...resolution(tag, 'TASK_PICK'), job_ticket_id: first!.id }, { ...resolution(tag, 'TASK_PICK'), job_ticket_id: 'wash2' },
  ])
  assert.deepEqual(picked.plans[0]?.steps.map(step => step.status), ['Completed', 'In Progress', 'Pending'])
  assert.equal(computeStockTakeReport(session, inventory(), [scan({ ...wash, department: 'Ironing' })]).report.conflicts[0]?.code, 'zone_not_on_route')
  assert.equal(computeStockTakeReport(session, inventory({ tickets: [last!] }), [scan(wash)]).report.blocked[0]?.code, 'missing_route_step')
  assert.equal(computeStockTakeReport(session, inventory({ tickets: [first!, { ...last!, status: 'In Progress' }] }), [scan(wash)]).report.backward.length, 1)
})

test('packing verification and dispatch exceptions preserve Packaging when evidence is incomplete', () => {
  const log: Ticket = { id: 'LOG-a-bag-LOG-BAG', order_id: 'a', scope: 'ORDER', task_code: 'LOG-BAG', status: 'Pending' }
  const bag = { order_id: 'a', laundry_item_id: tag, bag_id: 'bag' }
  const image = { id: 'bag', order_id: 'a', image_path: 'path' }
  const inputs: Array<[Partial<Inventory>, Scan, string | null]> = [
    [{}, packed, null],
    [{}, { ...packed, bagId: null }, 'unreadable_bag'],
    [{ bags: [] }, packed, 'bag_link_count'],
    [{ bags: [bag, bag] }, packed, 'bag_link_count'],
    [{ bags: [{ ...bag, bag_id: 'old' }] }, packed, 'mismatched_bag'],
    [{ images: [] }, packed, 'missing_bag_image'],
    [{ tickets: route('WASH') }, packed, 'unverified_logistics'],
    [{ tickets: [...route('WASH'), { ...log, status: 'Cancelled' }] }, packed, 'unverified_logistics'],
    [{ tickets: [...route('WASH'), { ...log, status: 'In Progress' }] }, packed, 'unverified_logistics'],
  ]
  for (const [overrides, observation, code] of inputs) {
    const { report, plans } = computeStockTakeReport(session, inventory({
      bags: [bag], images: [image], tickets: [...route('WASH'), log], ...overrides,
    }), [scan(observation)])
    assert.equal(report.packingExceptions[0]?.code ?? null, code)
    assert.equal(report.dispatchExceptions.length, overrides.tickets?.at(-1)?.status === 'In Progress' ? 1 : 0)
    assert.deepEqual(plans[0]?.steps.map(step => step.status), ['Completed', code ? 'Pending' : 'Completed'])
    assert.equal(report.orders[0]?.found, 1)
  }
  const tickets = route('WASH')
  tickets.push({ ...tickets[1]!, id: 'second-package', step_no: 3 })
  const result = inspectRoute(tickets, 'WASH', packed, 'second-package', false)
  assert.ok('steps' in result)
  assert.deepEqual(result.steps.map(step => step.status), ['Completed', 'Pending', 'Pending'])
})

test('preflight compares the route and untouched state and accepts only complete readback', () => {
  const tickets = route('WASH')
  const result = inspectRoute(tickets, 'WASH', wash, null, false)
  assert.ok('steps' in result)
  const rows = buildTicketPlan(result.steps, session.id, 'admin', now)
    .map((row, index) => ({ ...row, id: String(index), order_id: 'a', laundry_item_id: tag }))
  const pending = preflight(rows, tickets)
  assert.equal(pending.state, 'PLANNED')
  const saved = tickets.map(ticket => ({ ...ticket, ...pending.updates.find(update => update.keyValue === ticket.id)?.patch }))
  assert.equal(preflight(rows, saved).state, 'APPLIED')
  assert.equal(preflight(rows, [...saved, { ...saved[0]!, id: 'new' }]).state, 'SKIPPED')
  assert.equal(preflight(rows, saved.slice(1)).state, 'SKIPPED')
  assert.equal(preflight(rows, [saved[0]!, { ...saved[1]!, scanned_by: 'different' }]).state, 'SKIPPED')
  assert.equal(preflight(rows, [tickets[0]!, { ...tickets[1]!, status: 'Cancelled' }]).state, 'SKIPPED')
})

test('planned completions preserve historical actors, times, and notes', () => {
  const [first, second] = route('WASH')
  const result = inspectRoute([
    { ...first!, status: 'In Progress', started_at: '2026-11-18 11:30:00', scanned_by: 'original', notes: 'Preserve me' },
    second!,
  ], 'WASH', pack, null, false)
  assert.ok('steps' in result)
  const rows = buildTicketPlan(result.steps, session.id, 'admin', now)
  assert.deepEqual(JSON.parse(rows[0]!.patch!), {
    status: 'Completed', completed_at: now, notes: 'Preserve me\nstock-take ST-1',
    updated_at: now, updated_by: 'admin',
  })
})

function memory() {
  let header: Partial<StockTakesRow> | undefined
  const entries: Array<Partial<StockTakeEntriesRow>> = []
  const tickets = route('WASH')
  const writes: string[] = []
  let failStateSave = false
  function stored<T>(value: T): T {
    return Object.fromEntries(Object.entries(value as object).map(([key, val]) =>
      [key, typeof val === 'string' && val.startsWith("'") ? val.slice(1) : val])) as T
  }
  const service = new StockTakeService({
    now: () => new Date('2026-11-19T02:10:11Z'),
    inventory: async current => inventory({ tickets: current }),
    sessions: () => ({
      readFresh: async () => header ? [header] : [],
      append: async row => (header = stored({ ...row, opened_at: now })) as StockTakesRow,
      update: async (_, patch) => (header = { ...header, ...patch }) as StockTakesRow,
    }),
    entries: () => ({
      readFresh: async () => entries.map(row => ({ ...row })),
      batchAppend: async rows => {
        const added = rows.map(row => stored({ ...row, created_at: now })) as StockTakeEntriesRow[]
        entries.push(...added)
        return added
      },
      updateMany: async updates => {
        if (failStateSave) throw new Error('Plan-state save was interrupted')
        return updates.map(({ keyValue, patch }) => {
          const index = entries.findIndex(row => row.id === keyValue)
          assert.ok(index >= 0)
          return (entries[index] = { ...entries[index], ...patch }) as StockTakeEntriesRow
        })
      },
    }),
    tickets: () => ({
      readFresh: async () => tickets.map(row => ({ ...row })),
      updateMany: async updates => {
        writes.push('JobTickets')
        return updates.map(({ keyValue, patch }) => {
          const index = tickets.findIndex(row => row.id === keyValue)
          assert.ok(index >= 0)
          return (tickets[index] = { ...tickets[index]!, ...stored(patch) }) as never
        })
      },
    }),
  })
  return { service, entries, tickets, writes, failStateSave: (value: boolean) => { failStateSave = value } }
}

test('scan batches acknowledge duplicates and retain independent zones and bags', async () => {
  const { service, entries } = memory()
  const { id } = await service.open(null, 'admin')
  await assert.rejects(service.open(null, 'admin'))
  const normalized = { ...wash, tag: '  mwg-' + tag + ' ' }
  assert.equal((await service.scans(id, [wash, normalized, pack, packed, { ...packed, bagId: 'second' }], 'staff')).added, 4)
  assert.equal((await service.scans(id, [normalized, packed], 'staff')).added, 0)
  assert.equal((await service.scans(id, [{ ...wash, tag: '00001000' }], 'staff')).added, 1)
  assert.equal((await service.scans(id, [{ ...wash, tag: '00001000' }], 'staff')).added, 0)
  assert.equal(entries.length, 5)
  assert.equal(await service.active().then(row => row?.id), id)
  await service.close(id, 'admin')
  await assert.rejects(service.scans(id, [wash], 'staff'))
})

test('apply retries a failed state save without another ticket write and cannot write WorkTransactions', async () => {
  const originalAppend = SheetRepository.prototype.append
  const originalBatchAppend = SheetRepository.prototype.batchAppend
  const originalUpdate = SheetRepository.prototype.update
  const originalUpdateMany = SheetRepository.prototype.updateMany
  let unexpectedWrites = 0
  const forbidRepositoryWrite = async (): Promise<never> => {
    unexpectedWrites++
    throw new Error('Apply must use only the injected sheet writers')
  }
  SheetRepository.prototype.append = forbidRepositoryWrite
  SheetRepository.prototype.batchAppend = forbidRepositoryWrite
  SheetRepository.prototype.update = forbidRepositoryWrite
  SheetRepository.prototype.updateMany = forbidRepositoryWrite
  try {
    const { service, entries, tickets, writes, failStateSave } = memory()
    const { id } = await service.open(null, 'admin')
    await service.scans(id, [wash], 'staff')
    await service.close(id, 'admin')
    assert.deepEqual(await service.apply(id), { applied: [], skipped: [] })
    const preview = await service.preview(id, 'admin')
    assert.equal(preview.planned[0]?.ticketCount, 2)
    failStateSave(true)
    await assert.rejects(service.apply(id), /interrupted/)
    assert.deepEqual(writes, ['JobTickets'])
    assert.equal(tickets[0]?.scanned_by, undefined)
    assert.equal(tickets[0]?.updated_at, now)
    await assert.rejects(service.cancel(id, 'admin'), /Retry Apply/)
    await assert.rejects(service.preview(id, 'admin'), /Retry Apply/)
    failStateSave(false)
    assert.deepEqual((await service.apply(id)).applied, [{ orderId: 'a', tag }])
    assert.deepEqual(writes, ['JobTickets'])
    assert.equal(unexpectedWrites, 0)
    assert.equal(entries.filter(row => row.plan_state === 'APPLIED').length, 2)
    assert.equal((await service.active())?.status, 'CLOSED')
    await assert.rejects(service.cancel(id, 'admin'), /Finish/)
    assert.equal((await service.finish(id, 'admin')).status, 'APPLIED')
    assert.equal(await service.active(), null)
    assert.equal((await service.finish(id, 'admin')).status, 'APPLIED')
  } finally {
    SheetRepository.prototype.append = originalAppend
    SheetRepository.prototype.batchAppend = originalBatchAppend
    SheetRepository.prototype.update = originalUpdate
    SheetRepository.prototype.updateMany = originalUpdateMany
  }
})

test('finish from an open count closes, plans, applies and ends in one step', async () => {
  const { service, entries, tickets, writes } = memory()
  const { id } = await service.open(null, 'admin')
  await service.scans(id, [wash], 'staff')
  assert.equal((await service.finish(id, 'admin')).status, 'APPLIED')
  assert.deepEqual(writes, ['JobTickets'])
  assert.equal(tickets.find(row => row.department === 'Washing')?.status, 'In Progress')
  assert.ok(entries.some(row => row.kind === 'PLAN' && row.plan_state === 'APPLIED'))
  assert.equal(await service.active(), null)
})

test('a resolution retires pending plans before Apply and leaves ticket writes untouched', async () => {
  const { service, entries, writes } = memory()
  const { id } = await service.open(null, 'admin')
  await service.scans(id, [wash], 'staff')
  await service.close(id, 'admin')
  await service.preview(id, 'admin')
  await service.resolutions(id, [{ orderId: 'a', tag, resolution: 'LINK_CONFIRMED' }], 'admin')
  assert.equal(entries.filter(row => row.kind === 'PLAN' && row.plan_state === 'SUPERSEDED').length, 2)
  assert.deepEqual(await service.apply(id), { applied: [], skipped: [] })
  assert.deepEqual(writes, [])
  await service.cancel(id, 'admin')
  assert.equal(await service.active(), null)
})

test('skipped plans can be replaced without applying stale patches, and zero-write plans can finish', async () => {
  const { service, entries, tickets, writes } = memory()
  const { id } = await service.open(null, 'admin')
  await service.scans(id, [wash], 'staff')
  await service.close(id, 'admin')
  await service.preview(id, 'admin')
  tickets[1]!.notes = 'External change'
  assert.deepEqual((await service.apply(id)).skipped, [{ orderId: 'a', tag }])
  assert.equal(writes.length, 0)
  assert.equal((await service.report(id)).skipped.length, 1)
  tickets[0]!.status = 'In Progress'
  assert.equal((await service.preview(id, 'admin')).planned[0]?.changeCount, 0)
  assert.equal(entries.filter(row => row.plan_state === 'SUPERSEDED').length, 2)
  assert.deepEqual((await service.apply(id)).applied, [{ orderId: 'a', tag }])
  assert.equal(writes.length, 0)
  assert.equal((await service.finish(id, 'admin')).status, 'APPLIED')
})
