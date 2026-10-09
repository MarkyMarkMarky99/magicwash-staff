import assert from 'node:assert/strict'
import type { z } from 'zod'
import { PackagingBagService } from '../../../../../server/modules/packaging-bags/packaging-bag.service.js'
import { packagingBagRoutes } from '../../../../../server/modules/packaging-bags/packaging-bag.module.js'
import type { PackagingBagServiceOptions } from '../../../../../server/modules/packaging-bags/packaging-bag.service.js'
import { JobTicketTransitionService } from '../../../../../server/modules/job-tickets/job-ticket-transition.service.js'
import { BagTagPrintService } from '../../../../../server/modules/bag-tag-prints/bag-tag-print.service.js'
import { packagingBagConfirmRequestSchema } from '../../../../../contracts/packaging-bags/packaging-bag-api.schema.js'
import type { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import type { orderImagesRowSchema } from '../../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import type { bagItemsRowSchema } from '../../../../../server/sheets/BagItems/BagItems.db-contract.js'
import type { workTransactionsRowSchema } from '../../../../../server/sheets/WorkTransactions/WorkTransactions.db-contract.js'
import type { BagTagPrintRequest } from '../../../../../contracts/bag-tag-prints/bag-tag-print.schema.js'

type Ticket = Partial<z.infer<typeof jobTicketsRowSchema>>
const now = () => new Date('2026-10-09T05:34:56Z')
const request = { orderId: 'order-1', createdBy: 'staff-1', bags: [
  { orderImageId: 'aabbccdd', imagePath: 'https://storage.example/a.jpg', laundryItemIds: ['tag-1', 'tag-2'] },
  { orderImageId: 'deadbeef', imagePath: 'https://storage.example/b.jpg', laundryItemIds: ['tag-3'] },
] }

function setup(failAt?: string, afterCommit = false, printerThrows = false) {
  const images: Partial<z.infer<typeof orderImagesRowSchema>>[] = []
  const items: Partial<z.infer<typeof bagItemsRowSchema>>[] = []
  const scores: Partial<z.infer<typeof workTransactionsRowSchema>>[] = []
  const tickets: Ticket[] = ['tag-1', 'tag-2', 'tag-3'].map(tag => ({
    id: `PCK-${tag}`, order_id: 'order-1', laundry_item_id: tag, scope: 'ITEM', department: 'Packaging',
    customer_id: 'customer-1', order_name: 'Order one', due_date: '2026-10-10', notes: 'Care', step_no: 3, status: 'Pending', work_minutes: 5, deleted_at: null,
  }))
  const reads = { JobTickets: 0, BagItems: 0, OrderImages: 0, OrderForm: 0, WorkTransactions: 0, Customers: 0 }
  const events: string[] = []
  const prints: BagTagPrintRequest[] = []
  let failed = false
  function shouldFail(stage: string) { return stage === failAt && !failed }
  function fail(stage: string) { failed = true; throw new Error(`Injected ${stage} failure`) }
  function append<T>(stage: string, target: T[], rows: T[]) {
    events.push(stage)
    if (shouldFail(stage)) {
      if (afterCommit) target.push(rows[0]!)
      fail(stage)
    }
    target.push(...rows)
    return rows
  }
  const ticketRepository = {
    async read(query?: { id?: string; where?: { order_id?: string } }) {
      reads.JobTickets += 1
      return tickets.filter(ticket => (!query?.id || ticket.id === query.id) && (!query?.where?.order_id || ticket.order_id === query.where.order_id))
    },
    async batchAppend(rows: Ticket[]) { return append('logistics', tickets, rows) },
    async updateMany(updates: { keyValue: string; patch: Ticket }[]) {
      const stage = updates[0]?.patch.status === 'In Progress' ? 'start' : 'complete'
      events.push(stage)
      if (shouldFail(stage) && !afterCommit) fail(stage)
      for (const update of shouldFail(stage) && afterCommit ? updates.slice(0, 1) : updates) Object.assign(tickets.find(ticket => ticket.id === update.keyValue)!, update.patch)
      if (shouldFail(stage)) fail(stage)
    },
  }
  const scoreRepository = {
    async read(query?: { where?: { job_ticket_id?: string } }) {
      reads.WorkTransactions += 1
      return query?.where ? scores.filter(row => row.job_ticket_id === query.where?.job_ticket_id) : scores
    },
    async batchAppend(rows: typeof scores) { append('earn', scores, rows) },
  }
  const printer = new BagTagPrintService({
    async orderCustomerIdReader(orderId) { reads.OrderForm += 1; throw new Error('Packaging must not read OrderForm') },
    async customerReader(id) { assert.equal(id, 'customer-1'); reads.Customers += 1; return { customerIndex: '12' } },
    async printClient(payload) {
      events.push('print')
      for (const ticket of tickets.filter(row => row.scope === 'ITEM')) assert.equal(ticket.status, 'Completed')
      assert.equal(images.length, 2)
      assert.equal(items.length, 3)
      prints.push(payload as BagTagPrintRequest)
      if (printerThrows) throw new Error('printer offline')
      return { outcome: 'accepted', data: { success: true, accepted: true, printerName: 'test', totalCount: 1 } }
    },
  })
  const options: PackagingBagServiceOptions = {
    images: () => ({ async read(query) { reads.OrderImages += 1; assert.deepEqual(query, { where: { order_id: 'order-1' } }); return images.filter(row => row.order_id === query?.where?.order_id) },
      async batchAppend(rows) { return append('images', images, rows) as z.infer<typeof orderImagesRowSchema>[] } }),
    bagItems: () => ({ async read() { reads.BagItems += 1; return items },
      async batchAppend(rows) { return append('items', items, rows) as z.infer<typeof bagItemsRowSchema>[] } }),
    tickets: () => ticketRepository,
    transition: new JobTicketTransitionService({ repository: () => ticketRepository, workTransactionRepository: () => scoreRepository,
      now }),
    printer, now,
  }
  return { service: new PackagingBagService(options), images, items, scores, tickets, events, prints, reads }
}

const originalFlag = process.env.BAG_TAG_PRINT_ENABLED
const originalBase = process.env.BAG_TAG_TRACKING_URL_BASE
const originalError = console.error
try {
  process.env.BAG_TAG_PRINT_ENABLED = 'true'
  process.env.BAG_TAG_TRACKING_URL_BASE = 'https://shop.example/b/'
  console.error = () => {}
  for (const scenario of ['wrong order', 'another bag', 'waiting', 'deleted', 'cancelled', 'different photo', 'different image type', 'different garments']) {
    const context = setup()
    if (scenario === 'wrong order') context.tickets[0]!.order_id = 'other'
    if (scenario === 'another bag') context.items.push({ bag_id: 'other', laundry_item_id: 'tag-1' })
    if (scenario === 'waiting') context.tickets.push({ id: 'IRN-tag-1', order_id: 'order-1', laundry_item_id: 'tag-1', department: 'Ironing', step_no: 2, status: 'Pending' })
    if (scenario === 'deleted') context.tickets[0]!.deleted_at = '2026-10-09 10:00:00'
    if (scenario === 'cancelled') context.tickets[0]!.status = 'Cancelled'
    if (scenario === 'different photo' || scenario === 'different image type') context.images.push({
      id: request.bags[0]!.orderImageId, order_id: request.orderId,
      image_type: scenario === 'different image type' ? 'WEIGHT' : 'BAG',
      image_path: scenario === 'different photo' ? 'https://storage.example/other.jpg' : request.bags[0]!.imagePath,
    })
    if (scenario === 'different garments') context.items.push({ bag_id: request.bags[0]!.orderImageId, order_id: request.orderId, laundry_item_id: 'other-tag' })
    await assert.rejects(context.service.confirm(request), error => error instanceof Error && 'status' in error && Number(error.status) >= 400 && Number(error.status) < 500)
    assert.deepEqual(context.events, [], scenario)
  }
  {
    const context = setup('earn', false)
    const response = await context.service.confirm(request)
    assert.deepEqual(response.bags, request.bags.map(bag => ({ orderImageId: bag.orderImageId, printed: true })), 'a failed score write does not fail Confirm or skip printing')
    assert.equal(context.scores.length, 0)
    assert.ok(context.tickets.filter(ticket => ticket.department === 'Packaging').every(ticket => ticket.status === 'Completed'))
  }
  for (const stage of ['images', 'items', 'logistics', 'complete']) {
    for (const afterCommit of [false, true]) {
      const context = setup(stage, afterCommit)
      await assert.rejects(context.service.confirm(request), /press Confirm again/)
      assert.equal(context.prints.length, 0, `${stage}: print must await every write`)
      assert.deepEqual(context.reads, { JobTickets: 1, BagItems: 1, OrderImages: 1, OrderForm: 0, WorkTransactions: 0, Customers: 0 })
      const response = await context.service.confirm(request)
      assert.deepEqual(response.bags, request.bags.map(bag => ({ orderImageId: bag.orderImageId, printed: true })))
      assert.deepEqual(context.reads, { JobTickets: 2, BagItems: 2, OrderImages: 2, OrderForm: 0, WorkTransactions: 0, Customers: 1 })
      assert.equal(context.images.length, 2, `${stage}: image retry must not duplicate`)
      assert.equal(context.items.length, 3, `${stage}: item retry must not duplicate`)
      assert.equal(context.tickets.filter(ticket => ticket.scope === 'ORDER').length, 2)
      const expectedScores = stage === 'complete' && afterCommit ? 2 : 3
      assert.equal(context.scores.length, expectedScores, `${stage}: already Completed tickets never earn on retry`)
      assert.equal(new Set(context.scores.map(score => score.job_ticket_id)).size, expectedScores)
      assert.equal(new Set(context.items.map(item => item.id)).size, 3)
      assert.equal(context.events[0], 'images')
      assert.equal(context.prints[0]?.itemCount, 2)
      assert.equal(context.prints[1]?.itemCount, 1)
      for (const print of context.prints) {
        assert.equal(print.weightKg, null)
        assert.equal(print.packedAt, '2026-10-09 12:34:56')
        assert.equal(print.qrValue, `https://shop.example/b/${print.barcodeValue}`)
        assert.equal(print.customerIndex, '12')
      }
      const before = [context.images.length, context.items.length, context.tickets.length, context.scores.length]
      await context.service.confirm(request)
      assert.deepEqual([context.images.length, context.items.length, context.tickets.length, context.scores.length], before)
    }
  }
  const lean = setup()
  await lean.service.confirm(request)
  assert.deepEqual(lean.reads, { JobTickets: 1, BagItems: 1, OrderImages: 1, OrderForm: 0, WorkTransactions: 0, Customers: 1 })
  assert.deepEqual(lean.events, ['images', 'items', 'logistics', 'complete', 'earn', 'print', 'print'])
  for (const ticket of lean.tickets.filter(ticket => ticket.department === 'Logistics')) {
    assert.equal(ticket.customer_id, 'customer-1')
    assert.equal(ticket.order_name, 'Order one')
    assert.equal(ticket.due_date, '2026-10-10')
    assert.equal(ticket.notes, 'Care')
  }
  const brokenPrinter = setup(undefined, false, true)
  assert.ok((await brokenPrinter.service.confirm(request)).bags.every(bag => !bag.printed))
  process.env.BAG_TAG_PRINT_ENABLED = 'false'
  const disabled = setup()
  assert.ok((await disabled.service.confirm(request)).bags.every(bag => !bag.printed))
  assert.equal(disabled.prints.length, 0)
  process.env.BAG_TAG_PRINT_ENABLED = 'true'
  const completed = setup()
  completed.tickets[0]!.status = 'Completed'
  completed.tickets[0]!.work_minutes = null
  assert.ok((await completed.service.confirm(request)).bags.every(bag => bag.printed))
  assert.equal(completed.events.filter(event => event === 'complete').length, 1)
  assert.equal(completed.scores.length, 2)
  for (const payload of [
    { ...request, bags: [] }, { ...request, bags: Array(21).fill(request.bags[0]) },
    { ...request, bags: [{ ...request.bags[0], laundryItemIds: [] }] },
    { ...request, bags: [{ ...request.bags[0], imagePath: 'ftp://photo.example/a' }] },
    { ...request, bags: [{ ...request.bags[0], orderImageId: '12345678' }] },
    { ...request, bags: [{ ...request.bags[0], orderImageId: '12e34567' }] },
    { ...request, bags: [{ ...request.bags[0], orderImageId: 'bad-id' }] },
    { ...request, bags: [{ ...request.bags[0], laundryItemIds: ['tag-1', 'tag-1'] }] },
    { ...request, bags: [request.bags[0], { ...request.bags[1], laundryItemIds: ['tag-1'] }] },
  ]) assert.equal(packagingBagConfirmRequestSchema.safeParse(payload).success, false)
  const unknown = await packagingBagRoutes.item!.handleRequest({ method: 'POST', body: request, params: { id: 'other' }, query: {}, headers: {} })
  assert.equal(unknown.status, 404)
  console.log('packaging-bag.dry-test: OK (validation, every partial write retry, no EARN repair, print ordering/payload/flags)')
} finally {
  console.error = originalError
  if (originalFlag === undefined) delete process.env.BAG_TAG_PRINT_ENABLED
  else process.env.BAG_TAG_PRINT_ENABLED = originalFlag
  if (originalBase === undefined) delete process.env.BAG_TAG_TRACKING_URL_BASE
  else process.env.BAG_TAG_TRACKING_URL_BASE = originalBase
}
