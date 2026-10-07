import { z } from 'zod'
import {
  MAX_ORDER_ITEMS_PER_PAGE,
  orderItemResponseSchema,
} from '../../../contracts/order-items/order-item-api.schema.js'
import {
  workOrderApiContract,
} from '../../../contracts/work-orders/work-order-api.schema.js'
import { normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { containsKeyword, matchesCustomerKeyword, normalizeSearchKeyword } from '../../../shared/utils/customer-search.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'
import { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import { orderItemService } from '../order-items/order-item.module.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { getLaundryPhotosRepository } from '../../sheets/LaundryPhotos/LaundryPhotos.repository.js'
import { laundryPhotosRowSchema } from '../../sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { getWorkRatesRepository } from '../../sheets/WorkRates/WorkRates.repository.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { hasStartedAt } from '../job-tickets/job-ticket-started-at.js'
import type { SheetBatchUpdateContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import type { ServiceListResult } from '../../shared/services/base-crud.service.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { getStaffList, type StaffMember } from '../../shared/auth/staff-list.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { buildEarnRows } from '../work-transactions/work-transaction-earn.js'
import { generateShortId } from '../../shared/utils/id.js'
import {
  orderFormFieldMap,
  orderFormMapper,
  type OrderFormApiRow,
  type OrderFormDbRow,
} from './work-order.mapping.js'
import { buildJobTickets } from './job-ticket-provisioning.js'
import { readWorkRates, type WorkRateReader } from './work-rate-lookup.js'

type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>
type LaundryPhotosDbRow = z.infer<typeof laundryPhotosRowSchema>
type JobTicketsDbRow = z.infer<typeof jobTicketsRowSchema>
type CustomersDbRow = z.infer<typeof customersRowSchema>
type WorkOrderListQuery = z.infer<typeof workOrderApiContract.query.list>
type WorkOrderListDateField = NonNullable<WorkOrderListQuery['dateField']>
type WorkOrderCreate = z.infer<typeof workOrderApiContract.request.create>
type WorkOrderCreateItem = WorkOrderCreate['items'][number]
type WorkOrderUpdate = z.infer<typeof workOrderApiContract.request.update>
type WorkOrderListResponse = z.infer<typeof workOrderApiContract.response.list>
type WorkOrderDetailResponse = z.infer<typeof workOrderApiContract.response.detail>
export type WorkOrderCreateResponse = z.infer<typeof workOrderApiContract.response.create>
type WorkOrderUpdateResponse = z.infer<typeof workOrderApiContract.response.update>
export type OrderItemResponse = z.infer<typeof orderItemResponseSchema>

export interface OrderItemPort {
  listByOrderId(orderId: string): Promise<OrderItemResponse[]>
}

export interface OrderItemWriter {
  createMany(rows: Array<Partial<OrderItemFormsDbRow>>): Promise<void>
}

export interface LaundryPhotoReader {
  read(query?: ReadQueryDTO<Partial<LaundryPhotosDbRow>>): Promise<Array<Partial<LaundryPhotosDbRow>>>
}

export interface OrderItemReader {
  read(query?: ReadQueryDTO<Partial<OrderItemFormsDbRow>>): Promise<Array<Partial<OrderItemFormsDbRow>>>
}

export interface JobTicketProvisioningRepository {
  read(query?: ReadQueryDTO<Partial<JobTicketsDbRow>>): Promise<Array<Partial<JobTicketsDbRow>>>
  batchAppend(rows: Array<Partial<JobTicketsDbRow>>): Promise<unknown[]>
}

export interface WorkTransactionWriter {
  batchAppend(rows: Array<Partial<z.infer<typeof workTransactionsRowSchema>>>): Promise<unknown[]>
}

export type JobTicketCompletionRepository = Pick<JobTicketProvisioningRepository, 'read'> & SheetBatchUpdateContract<JobTicketsDbRow>

export interface WorkOrderServiceOptions {
  jobTicketCompletionRepository?: () => JobTicketCompletionRepository
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
  orderItemPort?: OrderItemPort
  orderItemWriter?: OrderItemWriter
  laundryPhotoRepository?: () => LaundryPhotoReader
  orderItemRepository?: () => OrderItemReader
  jobTicketRepository?: () => JobTicketProvisioningRepository
  workRateRepository?: () => WorkRateReader
  staffReader?: typeof getStaffList
  workTransactionRepository?: () => WorkTransactionWriter
  now?: () => Date
  customerRepository?: () => CustomerReader
}

export interface CustomerReader {
  read(): Promise<Array<Partial<CustomersDbRow>>>
}

// Order fields a keyword matches; customers are matched through their own fields.
const WORK_ORDER_SEARCH_FIELDS = ['orderNumber', 'invoiceNumber'] as const

const defaultOrderItemPort: OrderItemPort = {
  listByOrderId: async (orderId) => {
    const result = await orderItemService.list({
      orderId,
      page: 1,
      perPage: MAX_ORDER_ITEMS_PER_PAGE,
    })
    return result.items
  },
}

export function createOrderId(): string {
  return generateShortId()
}

export class WorkOrderService extends BaseCrudService<
  OrderFormApiRow,
  WorkOrderListQuery,
  WorkOrderCreate,
  WorkOrderUpdate,
  WorkOrderListResponse,
  WorkOrderDetailResponse,
  WorkOrderCreateResponse,
  WorkOrderUpdateResponse,
  OrderFormDbRow,
  typeof orderFormFieldMap
> {
  private readonly orderFormRepository: () => SheetRepositoryContract<OrderFormDbRow>
  private readonly orderItemPort: OrderItemPort
  private readonly orderItemWriter: OrderItemWriter
  private readonly laundryPhotoRepository: () => LaundryPhotoReader
  private readonly orderItemRepository: () => OrderItemReader
  private readonly jobTicketCompletionRepository: () => JobTicketCompletionRepository
  private readonly jobTicketRepository: () => JobTicketProvisioningRepository
  private readonly workRateRepository: () => WorkRateReader
  private readonly staffReader: typeof getStaffList
  private readonly workTransactionRepository: () => WorkTransactionWriter
  private readonly now: () => Date
  private readonly customerRepository: () => CustomerReader

  constructor(input: WorkOrderServiceOptions = {}) {
    const orderFormRepository = input.orderFormRepository ?? getOrderFormRepository

    super({
      repository: orderFormRepository,
      api: workOrderApiContract,
      searchFields: WORK_ORDER_SEARCH_FIELDS,
      fieldMap: orderFormFieldMap,
    })

    this.orderFormRepository = orderFormRepository
    this.orderItemPort = input.orderItemPort ?? defaultOrderItemPort
    this.orderItemWriter = input.orderItemWriter ?? orderItemService
    this.laundryPhotoRepository = input.laundryPhotoRepository ?? getLaundryPhotosRepository
    this.orderItemRepository = input.orderItemRepository ?? getOrderItemFormsRepository
    this.jobTicketCompletionRepository = input.jobTicketCompletionRepository ?? getJobTicketsRepository
    this.jobTicketRepository = input.jobTicketRepository ?? getJobTicketsRepository
    this.workRateRepository = input.workRateRepository ?? getWorkRatesRepository
    this.staffReader = input.staffReader ?? getStaffList
    this.workTransactionRepository = input.workTransactionRepository ?? getWorkTransactionsRepository
    this.now = input.now ?? (() => new Date())
    this.customerRepository = input.customerRepository ?? getCustomersRepository
  }

  override async list(query: unknown): Promise<ServiceListResult<WorkOrderListResponse>> {
    const { dateField = 'receivedDate', date, ...baseQuery } = parseOrThrow(workOrderApiContract.query.list, query)
    const result = date === undefined && normalizeSearchKeyword(baseQuery.keyword) === ''
      ? await super.list(baseQuery)
      : await this.listInMemory(baseQuery, dateField, date)
    const items = result.items.filter(
      (item) => typeof item.orderId === 'string' && item.orderId.trim() !== '',
    )

    return {
      items: items.map((item) => {
        const customerId = normalizeCustomerId(item.customerId)
        return {
          ...item,
          customerId,
        }
      }),
      pagination: result.pagination,
    }
  }

  // A date day is a range over timestamp cells and a keyword also matches the
  // customer's label, name, phone and address from the Customers sheet; ReadQueryDTO
  // can express neither, so this reads every matching row and filters and pages in memory.
  private async listInMemory(
    query: Omit<WorkOrderListQuery, 'dateField' | 'date'>,
    dateField: WorkOrderListDateField,
    date: string | undefined,
  ): Promise<ServiceListResult<WorkOrderListResponse>> {
    const keyword = normalizeSearchKeyword(query.keyword)
    const [rows, matchedCustomerIds] = await Promise.all([
      this.orderFormRepository().read({
        where: orderFormMapper.toDb({ customerId: query.customerId, status: query.status }) as Partial<OrderFormDbRow>,
        sort: { field: orderFormMapper.toDbField(query.sortBy), order: query.sortOrder },
      }),
      keyword === '' ? Promise.resolve(new Set<string>()) : this.readCustomerIdsMatching(keyword),
    ])
    const start = (query.page - 1) * query.perPage
    const items = rows
      .map((row) => orderFormMapper.toApi<Partial<OrderFormApiRow>>(row))
      .filter((row) => keyword === ''
        || matchedCustomerIds.has(normalizeCustomerId(row.customerId))
        || WORK_ORDER_SEARCH_FIELDS.some((field) => containsKeyword(row[field], keyword)))
      .filter((row) => date === undefined || normalizeSheetTimestamp(row[dateField]).slice(0, 10) === date)
      .slice(start, start + query.perPage)
      .map((row) => Object.fromEntries(
        Object.keys(workOrderApiContract.response.list.shape).map((field) => [field, row[field as keyof OrderFormApiRow]]),
      ) as WorkOrderListResponse)

    return { items, pagination: { page: query.page, perPage: query.perPage } }
  }

  private async readCustomerIdsMatching(keyword: string): Promise<Set<string>> {
    const customers = await this.customerRepository().read()
    return new Set(customers
      .filter((customer) => matchesCustomerKeyword({
        customerIndex: customer.CustomerIndex,
        customerName: customer.CustomerName,
        phone: customer.Phone,
        address: customer.Address,
      }, keyword))
      .map((customer) => normalizeCustomerId(customer.CustomerID))
      .filter((customerId) => customerId !== ''))
  }

  override async getById(id: string): Promise<WorkOrderDetailResponse> {
    // The header row and the items are independent sheet reads - items key off the id from the
    // URL, not off anything the header returns - so they run together instead of in sequence.
    // allSettled rather than all so a header failure still wins the error, exactly as it did when
    // the reads were sequential.
    const [rowResult, itemsResult] = await Promise.allSettled([
      super.getById(id),
      this.orderItemPort.listByOrderId(id),
    ])
    if (rowResult.status === 'rejected') throw rowResult.reason
    if (itemsResult.status === 'rejected') throw itemsResult.reason
    const row = rowResult.value
    const items = itemsResult.value
    const customerId = normalizeCustomerId(row.customerId)

    return {
      ...row,
      customerId,
      items,
    }
  }

  override async create(payload: unknown): Promise<WorkOrderCreateResponse> {
    const data = parseOrThrow(workOrderApiContract.request.create, payload)
    const orderId = createOrderId()
    const headerRow: Partial<OrderFormDbRow> = {
      id: orderId,
      customer_id: data.customerId,
      received_date: data.receivedDate,
      due_date: data.dueDate,
      service_type: data.serviceType,
      status: 'PENDING',
      quantity: data.quantity,
      note: data.note,
      created_by: data.createdBy,
      order_name: data.orderName,
      order_description: data.orderDescription,
    }

    const storedHeader = await this.orderFormRepository().append(headerRow)
    const storedApiHeader = orderFormMapper.toApi<OrderFormApiRow>(storedHeader)
    let itemsCreated = 0
    let itemsFailed = false
    let itemsError: string | null = null

    if (data.items.length > 0) {
      const itemRows = data.items.map((item) => toOrderItemRow(item, orderId, data))
      try {
        await this.orderItemWriter.createMany(itemRows)
        itemsCreated = itemRows.length
      } catch (error) {
        itemsFailed = true
        itemsError = error instanceof Error ? error.message : 'order items were not written'
      }
    }

    return {
      orderId: storedApiHeader.orderId,
      orderNumber: storedApiHeader.orderNumber,
      customerId: storedApiHeader.customerId,
      receivedDate: storedApiHeader.receivedDate,
      dueDate: storedApiHeader.dueDate,
      serviceType: storedApiHeader.serviceType,
      status: storedApiHeader.status,
      quantity: storedApiHeader.quantity,
      note: storedApiHeader.note,
      createdAt: storedApiHeader.createdAt,
      createdBy: storedApiHeader.createdBy,
      itemsRequested: data.items.length,
      itemsCreated,
      itemsFailed,
      itemsError,
    }
  }

  override async update(id: string, payload: unknown): Promise<WorkOrderUpdateResponse> {
    const updatedOrder = await super.update(id, payload)
    const request = parseOrThrow(workOrderApiContract.request.update, payload)
    const emptyProvisioning = {
      ticketsCreated: 0,
      scoreFailed: 0,
      skippedGarments: [],
      failure: null,
    }

    if (request.status !== 'APPROVED') {
      if (request.status === 'COMPLETED') {
        try {
          const repository = this.jobTicketCompletionRepository()
          const rows = await repository.read({ where: { order_id: updatedOrder.orderId } })
          const timestamp = formatBangkokTimestamp(this.now())
          const updates = rows
            .filter((row) => (row.deleted_at == null || row.deleted_at === '')
              && (row.status === 'Pending' || row.status === 'In Progress'))
            .flatMap((row) => typeof row.id === 'string' && row.id !== '' ? [{
              keyValue: row.id,
              patch: {
                status: 'Completed' as const,
                completed_at: timestamp,
                ...(!hasStartedAt(row.started_at) ? { started_at: timestamp } : {}),
                updated_by: request.updatedBy,
              },
            }] : [])
          if (updates.length > 0) await repository.updateMany(updates)
        } catch (error) {
          console.error('Failed to close open tickets for completed order', error)
        }
      }
      return { ...updatedOrder, ticketProvisioning: emptyProvisioning }
    }

    const [orderHeaderRows, photoRows, itemRows, existingTicketRows, ratesByTask, staffMembers] = await Promise.all([
      this.orderFormRepository().read({ id: updatedOrder.orderId }),
      this.laundryPhotoRepository().read({ where: { order_id: updatedOrder.orderId } }),
      this.orderItemRepository().read({ where: { order_id: updatedOrder.orderId } }),
      this.jobTicketRepository().read({ where: { order_id: updatedOrder.orderId } }),
      readWorkRates(this.workRateRepository),
      Promise.resolve().then(() => this.staffReader()).catch((error) => {
        console.error('Failed to read staff list for Tagging', error)
        return new Map<string, StaffMember>()
      }),
    ])
    const activeStaffIds = new Set([...staffMembers.values()]
      .map((member) => member.staffId)
      .filter((staffId) => staffId.trim() !== ''))
    const linesById = new Map(
      itemRows.flatMap((row) => typeof row.id === 'string' && row.id !== '' ? [[row.id, row] as const] : []),
    )
    const garments = photoRows
      .filter((photo) => photo.deleted_at == null || photo.deleted_at === '')
      .map((photo) => {
        const line = typeof photo.orderitem_id === 'string'
          ? linesById.get(photo.orderitem_id)
          : undefined
        const tagger = typeof photo.created_by === 'string' ? photo.created_by.trim() : ''
        return {
          taggedBy: activeStaffIds.has(tagger) ? tagger : null,
          laundryItemId: typeof photo.item_id === 'string' ? photo.item_id : '',
          serviceType: line === undefined ? updatedOrder.serviceType : line.service_type ?? null,
          specialInstructions: line?.special_instructions ?? null,
          photoEvidenceUrl: typeof photo.image_url === 'string' ? photo.image_url : null,
        }
      })
    const provisioning = buildJobTickets(
      {
        orderId: updatedOrder.orderId,
        customerId: updatedOrder.customerId,
        orderName: orderHeaderRows[0]?.order_name ?? null,
        dueDate: updatedOrder.dueDate,
        notes: updatedOrder.note,
        createdBy: request.updatedBy,
        completedAt: formatBangkokTimestamp(this.now()),
      },
      garments,
      existingTicketRows.flatMap((ticket) =>
        typeof ticket.id === 'string' && typeof ticket.laundry_item_id === 'string' && typeof ticket.department === 'string'
          ? [{
              id: ticket.id,
              laundryItemId: ticket.laundry_item_id,
              department: ticket.department,
              taskCode: typeof ticket.task_code === 'string' ? ticket.task_code : null,
            }]
          : [],
      ),
      ratesByTask,
    )

    if (provisioning.rows.length === 0) {
      return {
        ...updatedOrder,
        ticketProvisioning: {
          ticketsCreated: 0,
          scoreFailed: 0,
          skippedGarments: provisioning.unroutableGarments,
          failure: null,
        },
      }
    }

    try {
      await this.jobTicketRepository().batchAppend(provisioning.rows)
    } catch (error) {
      return {
        ...updatedOrder,
        ticketProvisioning: {
          ticketsCreated: 0,
          scoreFailed: 0,
          skippedGarments: provisioning.unroutableGarments,
          failure: { certainty: classifySheetWriteFailure(error).certainty },
        },
      }
    }

    const earnRows = buildEarnRows(provisioning.rows)
    let scoreFailed = 0
    if (earnRows.length > 0) {
      try {
        await this.workTransactionRepository().batchAppend(earnRows)
      } catch (error) {
        console.error('Failed to save Tagging scores', error)
        scoreFailed = earnRows.length
      }
    }
    return {
      ...updatedOrder,
      ticketProvisioning: {
        ticketsCreated: provisioning.rows.length,
        scoreFailed,
        skippedGarments: provisioning.unroutableGarments,
        failure: null,
      },
    }
  }
}

function normalizeCustomerId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toOrderItemRow(
  item: WorkOrderCreateItem,
  orderId: string,
  data: WorkOrderCreate,
): Partial<OrderItemFormsDbRow> {
  return {
    order_id: orderId,
    item_id: item.itemId,
    description: item.description,
    quantity: item.quantity,
    price: item.price,
    category: null,
    service_type: data.serviceType,
    special_instructions: item.specialInstructions,
    created_by: data.createdBy,
  }
}
