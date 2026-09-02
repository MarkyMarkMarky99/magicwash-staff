/**
 * Live read-model parity check. This reads Google Sheets only; it never writes.
 *
 * Example:
 * node --env-file=.env.local --import=tsx/esm tests/server/integration/orders-view-parity.ts
 */

import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  getLiveOrderById,
  type LiveOrderItem,
} from '../../../server/modules/orders/order-live.helper.js'
import { ReadQueryDTO } from '../../../server/shared/dtos/read-query.dto.js'
import { getOrdersViewRepository } from '../../../server/sheets/OrdersView/OrdersView.repository.js'
import { ordersViewRowSchema } from '../../../server/sheets/OrdersView/OrdersView.db-contract.js'

type OrdersViewRow = Partial<z.infer<typeof ordersViewRowSchema>>
type IdentifiedOrdersViewRow = OrdersViewRow & { order_id: string }

const CANDIDATE_LIMIT = 500
const SAMPLE_SIZE = 50
const CONCURRENCY = 5

function hasOrderId(row: OrdersViewRow): row is IdentifiedOrdersViewRow {
  return typeof row.order_id === 'string' && row.order_id.trim() !== ''
}

function selectSamples(rows: OrdersViewRow[]): IdentifiedOrdersViewRow[] {
  const candidates = rows.filter(hasOrderId)
  assert.ok(
    candidates.length >= SAMPLE_SIZE,
    `OrdersView returned ${candidates.length} usable rows; expected at least ${SAMPLE_SIZE}.`,
  )

  const selected: IdentifiedOrdersViewRow[] = []
  const selectedIds = new Set<string>()
  const add = (row: OrdersViewRow | undefined): void => {
    if (row === undefined || !hasOrderId(row) || selectedIds.has(row.order_id)) {
      return
    }
    selected.push(row)
    selectedIds.add(row.order_id)
  }

  add(candidates.find((row) => row.items_json === '[]'))
  add(candidates.find((row) => row.invoice_number !== null && row.invoice_number !== ''))
  add(candidates.find((row) => row.note !== null && row.note !== ''))
  add(candidates.find((row) => row.service_type !== null && row.service_type !== 'WSIR'))
  add(candidates.find((row) => row.items_json !== null && row.items_json !== '[]'))

  for (let index = 0; selected.length < SAMPLE_SIZE && index < SAMPLE_SIZE; index += 1) {
    add(candidates[Math.floor((index * candidates.length) / SAMPLE_SIZE)])
  }

  for (const candidate of candidates) {
    if (selected.length === SAMPLE_SIZE) {
      break
    }
    add(candidate)
  }

  return selected
}

const numberOrBlankSchema = z.union([z.number(), z.literal('')])

const materializedItemSchema = z.object({
  id: z.string(),
  item_id: z.string().nullable(),
  description: z.string().nullable(),
  quantity: numberOrBlankSchema.nullable(),
  price: numberOrBlankSchema.nullable(),
  credits_used: numberOrBlankSchema.nullable(),
  category: z.string().nullable(),
  service_type: z.string().nullable(),
  special_instructions: z.string().nullable(),
})

function parseViewItems(view: OrdersViewRow): LiveOrderItem[] {
  if (typeof view.items_json !== 'string') {
    assert.fail(`${view.order_id}: items_json must be a string`)
  }
  try {
    return z.array(materializedItemSchema).parse(JSON.parse(view.items_json)).map((item) => ({
      id: item.id,
      itemId: item.item_id ?? '',
      description: item.description ?? '',
      quantity: item.quantity ?? '',
      price: item.price ?? '',
      creditsUsed: item.credits_used ?? '',
      category: item.category ?? '',
      serviceType: item.service_type ?? '',
      specialInstructions: item.special_instructions ?? '',
    }))
  } catch (error) {
    assert.fail(
      `${view.order_id}: items_json cannot be read: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function buildExpectedLiveOrder(view: OrdersViewRow): Record<string, unknown> {
  return {
    orderId: view.order_id,
    customerId: view.customer_id,
    orderNumber: view.order_number,
    invoiceNumber: view.invoice_number,
    receivedDate: view.received_date,
    dueDate: view.due_date,
    serviceType: view.service_type,
    status: view.status,
    quantity: view.quantity,
    note: view.note,
    createdAt: view.created_at,
    items: parseViewItems(view),
  }
}

async function verifyRow(view: IdentifiedOrdersViewRow): Promise<void> {
  const liveOrder = await getLiveOrderById(view.order_id)
  assert.deepEqual(
    liveOrder,
    buildExpectedLiveOrder(view),
    `${view.order_id}: live helper differs from OrdersView`,
  )
}

const candidates = await getOrdersViewRepository().read(
  new ReadQueryDTO<Partial<OrdersViewRow>>({
    sort: { field: 'received_date', order: 'desc' },
    pagination: { page: 1, perPage: CANDIDATE_LIMIT },
  }),
)
const samples = selectSamples(candidates)

for (let start = 0; start < samples.length; start += CONCURRENCY) {
  await Promise.all(samples.slice(start, start + CONCURRENCY).map(verifyRow))
}

console.log(`OrdersView parity passed for ${samples.length} live orders.`)
