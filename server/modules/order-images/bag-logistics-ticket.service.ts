import type { z } from 'zod'
import type { orderImageResponseSchema } from '../../../contracts/order-images/order-image-api.schema.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import type { WeightPhotoTicketServiceOptions } from './weight-photo-ticket.service.js'

export type BagLogisticsTicketServiceOptions = Pick<WeightPhotoTicketServiceOptions, 'orderFormRepository' | 'jobTicketRepository'>

export class BagLogisticsTicketService {
  private readonly orderFormRepository
  private readonly jobTicketRepository

  constructor(input: BagLogisticsTicketServiceOptions = {}) {
    this.orderFormRepository = input.orderFormRepository ?? getOrderFormRepository
    this.jobTicketRepository = input.jobTicketRepository ?? getJobTicketsRepository
  }

  async provision(image: Pick<z.infer<typeof orderImageResponseSchema>, 'orderId' | 'orderImageId' | 'imagePath' | 'createdBy'>): Promise<void> {
    const id = `LOG-${image.orderId}-${image.orderImageId}-LOG-BAG`
    const tickets = this.jobTicketRepository()
    if ((await tickets.read({ id })).some((ticket) => ticket.id === id)) return
    const headers = await this.orderFormRepository().read({ id: image.orderId })
    const header = headers[0]
    await tickets.batchAppend([buildBagLogisticsTicket(image, {
      customer_id: header?.customer_id, order_name: header?.order_name, due_date: header?.due_date, notes: header?.note,
    })])
  }
}

export function buildBagLogisticsTicket(
  image: Pick<z.infer<typeof orderImageResponseSchema>, 'orderId' | 'orderImageId' | 'imagePath' | 'createdBy'>,
  metadata?: Partial<z.infer<typeof jobTicketsRowSchema>>,
): Partial<z.infer<typeof jobTicketsRowSchema>> & { id: string } {
  const ticket: Partial<z.infer<typeof jobTicketsRowSchema>> & { id: string } = {
    id: `LOG-${image.orderId}-${image.orderImageId}-LOG-BAG`,
    order_id: image.orderId,
    laundry_item_id: '',
    scope: 'ORDER',
    task_code: 'LOG-BAG',
    department: 'Logistics',
    step_no: 0,
    customer_id: typeof metadata?.customer_id === 'string' ? metadata.customer_id.trim() : '',
    order_name: metadata?.order_name ?? null,
    due_date: metadata?.due_date ?? null,
    notes: metadata?.notes ?? null,
    special_instructions: null,
    status: 'Pending',
    started_at: null,
    completed_at: null,
    scanned_by: null,
    photo_evidence_url: image.imagePath,
    created_by: image.createdBy,
    updated_by: image.createdBy,
    work_minutes: null,
  }
  return ticket
}
