import { z } from 'zod'
import {
  MAX_ORDER_ITEMS_PER_PAGE,
  orderItemResponseSchema,
} from '../../../contracts/order-items/order-item-api.schema.js'
import {
  workOrderApiContract,
} from '../../../contracts/work-orders/work-order-api.schema.js'
import { orderItemService } from '../order-items/order-item.module.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'
import { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import type { ServiceListResult } from '../../shared/services/base-crud.service.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { generateShortId } from '../../shared/utils/id.js'
import {
  orderFormFieldMap,
  orderFormMapper,
  type OrderFormApiRow,
  type OrderFormDbRow,
} from './work-order.mapping.js'

type CustomersDbRow = z.infer<typeof customersRowSchema>
type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>
type WorkOrderListQuery = z.infer<typeof workOrderApiContract.query.list>
type WorkOrderCreate = z.infer<typeof workOrderApiContract.request.create>
type WorkOrderCreateItem = WorkOrderCreate['items'][number]
type WorkOrderUpdate = z.infer<typeof workOrderApiContract.request.update>
type WorkOrderListResponse = z.infer<typeof workOrderApiContract.response.list>
type WorkOrderDetailResponse = z.infer<typeof workOrderApiContract.response.detail>
export type WorkOrderCreateResponse = z.infer<typeof workOrderApiContract.response.create>
export type OrderItemResponse = z.infer<typeof orderItemResponseSchema>

export interface OrderItemPort {
  listByOrderId(orderId: string): Promise<OrderItemResponse[]>
}

export interface OrderItemWriter {
  createMany(rows: Array<Partial<OrderItemFormsDbRow>>): Promise<void>
}

export interface WorkOrderServiceOptions {
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
  customerRepository?: () => SheetRepositoryContract<CustomersDbRow>
  orderItemPort?: OrderItemPort
  orderItemWriter?: OrderItemWriter
}

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
  never,
  OrderFormDbRow,
  typeof orderFormFieldMap
> {
  private readonly orderFormRepository: () => SheetRepositoryContract<OrderFormDbRow>
  private readonly customerRepository: () => SheetRepositoryContract<CustomersDbRow>
  private readonly orderItemPort: OrderItemPort
  private readonly orderItemWriter: OrderItemWriter

  constructor(input: WorkOrderServiceOptions = {}) {
    const orderFormRepository = input.orderFormRepository ?? getOrderFormRepository

    super({
      repository: orderFormRepository,
      api: workOrderApiContract,
      searchFields: [],
      fieldMap: orderFormFieldMap,
    })

    this.orderFormRepository = orderFormRepository
    this.customerRepository = input.customerRepository ?? getCustomersRepository
    this.orderItemPort = input.orderItemPort ?? defaultOrderItemPort
    this.orderItemWriter = input.orderItemWriter ?? orderItemService
  }

  override async list(query: unknown): Promise<ServiceListResult<WorkOrderListResponse>> {
    const result = await super.list(query)
    const customerIds = uniqueNonBlankIds(result.items.map((item) => item.customerId))
    const namesById = await this.readCustomerNames(customerIds)

    return {
      items: result.items.map((item) => ({
        ...item,
        customerName: namesById.get(item.customerId.trim()) ?? '',
      })),
      pagination: result.pagination,
    }
  }

  override async getById(id: string): Promise<WorkOrderDetailResponse> {
    const row = await super.getById(id)
    const namesById = await this.readCustomerNames([row.customerId])
    const items = await this.orderItemPort.listByOrderId(id)

    return {
      ...row,
      customerName: namesById.get(row.customerId.trim()) ?? '',
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
      hangers: data.hangers,
      bags: data.bags,
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

  private async readCustomerNames(customerIds: string[]): Promise<Map<string, string>> {
    const ids = uniqueNonBlankIds(customerIds)
    if (ids.length === 0) {
      return new Map()
    }

    const where = ids.length === 1 ? { CustomerID: ids[0] } : {}
    const rows = await this.customerRepository().read(
      new ReadQueryDTO<Partial<CustomersDbRow>>({ where }),
    )
    const namesById = new Map<string, string>()

    for (const row of rows) {
      const customerId = row.CustomerID?.trim()
      if (customerId !== undefined && customerId !== '' && !namesById.has(customerId)) {
        namesById.set(customerId, row.CustomerName ?? '')
      }
    }

    return namesById
  }
}

function uniqueNonBlankIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id !== ''))]
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
    category: item.category,
    service_type: data.serviceType,
    special_instructions: item.specialInstructions,
    created_by: data.createdBy,
  }
}
