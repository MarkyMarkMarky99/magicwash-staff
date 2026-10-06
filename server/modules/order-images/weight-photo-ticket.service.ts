import type { z } from 'zod'
import type { orderImageResponseSchema } from '../../../contracts/order-images/order-image-api.schema.js'
import { normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { getStaffList } from '../../shared/auth/staff-list.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { getWorkRatesRepository } from '../../sheets/WorkRates/WorkRates.repository.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import type { OrderFormDbRow } from '../work-orders/work-order.mapping.js'
import type { JobTicketProvisioningRepository, WorkTransactionWriter } from '../work-orders/work-order.service.js'
import { readWorkRates, type WorkRateReader } from '../work-orders/work-rate-lookup.js'
import { buildCompletedTicketEarnRows } from '../work-transactions/work-transaction-earn.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'

type OrderImage = z.infer<typeof orderImageResponseSchema>

export interface WeightPhotoTicketServiceOptions {
  orderFormRepository?: () => { read(query?: ReadQueryDTO<Partial<OrderFormDbRow>>): Promise<Array<Partial<OrderFormDbRow>>> }
  jobTicketRepository?: () => JobTicketProvisioningRepository
  workRateRepository?: () => WorkRateReader
  staffReader?: typeof getStaffList
  workTransactionRepository?: () => WorkTransactionWriter
}

export class WeightPhotoTicketService {
  private readonly orderFormRepository
  private readonly jobTicketRepository
  private readonly workRateRepository
  private readonly staffReader
  private readonly workTransactionRepository

  constructor(input: WeightPhotoTicketServiceOptions = {}) {
    this.orderFormRepository = input.orderFormRepository ?? getOrderFormRepository
    this.jobTicketRepository = input.jobTicketRepository ?? getJobTicketsRepository
    this.workRateRepository = input.workRateRepository ?? getWorkRatesRepository
    this.staffReader = input.staffReader ?? getStaffList
    this.workTransactionRepository = input.workTransactionRepository ?? getWorkTransactionsRepository
  }

  async provision(image: OrderImage): Promise<void> {
    const id = `PCK-${image.orderId}-${image.orderImageId}-PCK-WEIGHT-KG`
    const tickets = this.jobTicketRepository()
    if ((await tickets.read({ id })).some((ticket) => ticket.id === id)) return
    const [headers, rates] = await Promise.all([
      this.orderFormRepository().read({ id: image.orderId }),
      readWorkRates(this.workRateRepository),
    ])
    const header = headers[0]
    const rate = rates.get('PCK-WEIGHT-KG')
    const minutes = rate?.department === 'Packaging'
      && typeof image.quantity === 'number' && Number.isFinite(image.quantity) && image.quantity > 0
      ? Math.round(image.quantity * rate.minutes * 100) / 100 : null
    const timestamp = formatBangkokTimestamp(new Date(`${normalizeSheetTimestamp(image.createdAt).replace(' ', 'T')}+07:00`))
    const ticket: Partial<z.infer<typeof jobTicketsRowSchema>> & { id: string } = {
      id,
      order_id: image.orderId,
      laundry_item_id: '',
      scope: 'ORDER',
      task_code: 'PCK-WEIGHT-KG',
      department: 'Packaging',
      step_no: 0,
      customer_id: typeof header?.customer_id === 'string' ? header.customer_id.trim() : '',
      order_name: header?.order_name ?? null,
      due_date: header?.due_date ?? null,
      special_instructions: null,
      notes: header?.note ?? null,
      status: 'Completed',
      started_at: timestamp,
      completed_at: timestamp,
      scanned_by: image.createdBy,
      updated_by: image.createdBy,
      photo_evidence_url: image.imagePath,
      created_by: image.createdBy,
      work_minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null,
    }
    await tickets.batchAppend([ticket])
    if (ticket.work_minutes === null) return
    const photographer = image.createdBy?.trim() ?? ''
    try {
      const staff = await this.staffReader()
      if (photographer === '' || ![...staff.values()].some((member) => member.staffId === photographer)) return
      const earnRows = buildCompletedTicketEarnRows([{ ...ticket, scanned_by: photographer }])
      if (earnRows.length > 0) await this.workTransactionRepository().batchAppend(earnRows)
    } catch (error) {
      console.error('Failed to save weight photo score', error)
    }
  }
}
