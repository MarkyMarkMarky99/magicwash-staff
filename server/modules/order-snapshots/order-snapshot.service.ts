import type { z } from 'zod'
import { orderSnapshotRowSchema } from '../../../contracts/order-snapshots/order-snapshot-api.schema.js'
import { normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { orderFormMapper, type OrderFormDbRow } from '../work-orders/work-order.mapping.js'

type OrderSnapshotRow = z.infer<typeof orderSnapshotRowSchema>

export interface OrderSnapshotReader {
  read(query: ReadQueryDTO<Partial<OrderFormDbRow>>): Promise<Array<Partial<OrderFormDbRow>>>
}

export class OrderSnapshotService {
  constructor(private readonly repository: () => OrderSnapshotReader = getOrderFormRepository) {}

  async get(): Promise<OrderSnapshotRow[]> {
    const rows = await this.repository().read({
      select: ['id', 'order_number', 'customer_id', 'invoice_id', 'received_date', 'due_date', 'service_type', 'status', 'quantity', 'note', 'timestamp'],
    })
    const orders: OrderSnapshotRow[] = []
    for (const row of rows) {
      const order = orderFormMapper.toApi(row)
      if (typeof order.orderId !== 'string' || order.orderId.trim() === '') continue
      order.customerId = typeof order.customerId === 'string' ? order.customerId.trim() : ''
      order.receivedDate = normalizeSheetTimestamp(order.receivedDate).slice(0, 10) || null
      order.dueDate = normalizeSheetTimestamp(order.dueDate).slice(0, 10) || null
      order.createdAt = normalizeSheetTimestamp(order.createdAt) || null
      orders.push(Object.fromEntries(
        Object.keys(orderSnapshotRowSchema.shape).map((key) => [key, order[key] ?? null]),
      ) as OrderSnapshotRow)
    }
    return orders.sort((a, b) => {
      if (a.receivedDate !== b.receivedDate) {
        if (a.receivedDate === null) return 1
        if (b.receivedDate === null) return -1
        return b.receivedDate.localeCompare(a.receivedDate)
      }
      return a.orderId.localeCompare(b.orderId)
    })
  }
}
