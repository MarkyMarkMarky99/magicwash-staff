import { z } from 'zod'
import { orderItemApiContract, orderItemResponseSchema, orderItemUpdateResponseSchema, orderItemQuantityReassignSchema } from '../../../contracts/order-items/order-item-api.schema.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetBatchUpdateContract, SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import {
  BaseCrudService,
  mapDbRowToApi,
  type ServiceListResult,
} from '../../shared/services/base-crud.service.js'
import { generateShortId } from '../../shared/utils/id.js'
import { projectResponse } from '../../shared/services/crud-helpers.js'

type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>
type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

export const orderItemFieldMap = {
  id: 'orderItemId',
  order_id: 'orderId',
  item_id: 'itemId',
  description: 'description',
  quantity: 'quantity',
  price: 'price',
  credits_used: 'creditsUsed',
  timestamp: 'createdAt',
  category: 'category',
  service_type: 'serviceType',
  special_instructions: 'specialInstructions',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_item_id: 'invoiceItemId',
} as const satisfies Record<keyof OrderItemFormsDbRow & string, string>

type OrderItemApiRow = ApiRowFromFieldMap<OrderItemFormsDbRow, typeof orderItemFieldMap>
type OrderItemListQuery = z.infer<typeof orderItemApiContract.query.list>
type OrderItemCreate = z.infer<typeof orderItemApiContract.request.create>
type OrderItemListResponse = z.infer<typeof orderItemApiContract.response.list>
type OrderItemDetailResponse = z.infer<typeof orderItemApiContract.response.detail>
type OrderItemCreateResponse = z.infer<typeof orderItemApiContract.response.create>
type OrderItemUpdate = z.infer<typeof orderItemApiContract.request.update>
type OrderItemUpdateResponse = z.infer<typeof orderItemApiContract.response.update>
type OrderItemRepository = SheetRepositoryContract<OrderItemFormsDbRow> & SheetBatchUpdateContract<OrderItemFormsDbRow>

export interface OrderItemServiceOptions {
  repository?: OrderItemRepository
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
}

export function createOrderItemId(): string {
  return generateShortId()
}

export function createOrderItemRepository(): OrderItemRepository {
  return {
    read: (query) => getOrderItemFormsRepository().read(query),
    append: (row) =>
      getOrderItemFormsRepository().append({
        ...row,
        id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : createOrderItemId(),
      }),
    batchAppend: (rows) =>
      getOrderItemFormsRepository().batchAppend(
        rows.map((row) => ({
          ...row,
          id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : createOrderItemId(),
        })),
      ),
    update: (keyValue, patch) => getOrderItemFormsRepository().update(keyValue, patch),
    updateMany: (updates) => getOrderItemFormsRepository().updateMany(updates),
    delete: (keyValue, deletedBy) => getOrderItemFormsRepository().delete(keyValue, deletedBy),
  }
}

const orderItemMapper = new Mapper(orderItemFieldMap)

export class OrderItemService extends BaseCrudService<
  OrderItemApiRow,
  OrderItemListQuery,
  OrderItemCreate,
  OrderItemUpdate,
  OrderItemListResponse,
  OrderItemDetailResponse,
  OrderItemCreateResponse,
  OrderItemUpdateResponse,
  OrderItemFormsDbRow,
  typeof orderItemFieldMap
> {
  private readonly writeRepository: OrderItemRepository
  private readonly orderFormRepository: () => SheetRepositoryContract<OrderFormDbRow>

  constructor(input: OrderItemServiceOptions = {}) {
    const repository = input.repository ?? createOrderItemRepository()
    super({
      repository,
      api: orderItemApiContract,
      searchFields: [],
      fieldMap: orderItemFieldMap,
    })
    this.writeRepository = repository
    this.orderFormRepository = input.orderFormRepository ?? getOrderFormRepository
  }

  override async list(query: unknown): Promise<ServiceListResult<OrderItemListResponse>> {
    const result = await super.list(query)
    const items = result.items.filter(
      (item) => typeof item.orderItemId === 'string' && item.orderItemId.trim() !== '',
    )

    return {
      items,
      pagination: result.pagination,
    }
  }

  override async create(payload: unknown): Promise<OrderItemCreateResponse> {
    const data = parseOrThrow(orderItemApiContract.request.create, payload)
    const rows = await this.orderFormRepository().read(
      ReadQueryDTO.fromId<Partial<OrderFormDbRow>>(data.orderId),
    )
    if (rows.length === 0) {
      throw ApiError.notFound(`Resource '${data.orderId}' not found`)
    }

    const stored = await this.writeRepository.append({
      id: createOrderItemId(),
      order_id: data.orderId,
      item_id: data.itemId,
      description: data.description,
      quantity: data.quantity,
      price: data.price,
      category: null,
      service_type: rows[0]!.service_type ?? null,
      special_instructions: data.specialInstructions,
      created_by: data.createdBy,
    })

    const apiRow = mapDbRowToApi(stored, orderItemMapper, {})
    const response = Object.fromEntries(
      Object.keys(orderItemResponseSchema.shape).map((key) => [key, apiRow[key]]),
    ) as OrderItemCreateResponse
    return response
  }

  async createMany(rows: Array<Partial<OrderItemFormsDbRow>>): Promise<void> {
    for (const row of rows) {
      if (typeof row.quantity !== 'number' || !Number.isInteger(row.quantity) || row.quantity <= 0) {
        throw ApiError.validation('Invalid item quantity')
      }
    }
    await this.writeRepository.batchAppend(rows)
  }

  override async update(id: string, payload: unknown): Promise<OrderItemUpdateResponse> {
    const data = parseOrThrow(orderItemApiContract.request.update, payload)
    const safeId = id.trim()
    if (safeId === '') throw ApiError.badRequest('id is required')
    const stored = await this.writeRepository.update(safeId, {
      quantity: data.quantity,
      updated_by: data.updatedBy,
    })
    return projectResponse<OrderItemUpdateResponse>(
      mapDbRowToApi(stored, orderItemMapper, {}), orderItemUpdateResponseSchema,
    )
  }

  async reassignQuantities(payload: unknown): Promise<{ items: OrderItemUpdateResponse[] }> {
    const data = parseOrThrow(orderItemQuantityReassignSchema, payload)
    const stored = await this.writeRepository.updateMany(data.items.map((item) => ({
      keyValue: item.orderItemId,
      patch: { quantity: item.quantity, updated_by: data.updatedBy },
    })))
    return { items: stored.map((row) => projectResponse<OrderItemUpdateResponse>(
      mapDbRowToApi(row, orderItemMapper, {}), orderItemUpdateResponseSchema,
    )) }
  }
}

export const orderItemService = new OrderItemService()
const crudRoutes = createCrudRoutes(orderItemService, orderItemApiContract)
export const orderItemRoutes: GatewayModuleRoutes = {
  collection: crudRoutes.collection,
  item: new ApiHandler({
    GET: async (req) => {
      if (req.params.id === 'reassign-quantities') throw ApiError.notFound('Route not found')
      return crudRoutes.item!.handleRequest(req)
    },
    PATCH: async (req) => {
      if (req.params.id === 'reassign-quantities') throw ApiError.notFound('Route not found')
      return crudRoutes.item!.handleRequest(req)
    },
    POST: async (req) => {
      if (req.params.id !== 'reassign-quantities') throw ApiError.notFound('Route not found')
      return ok(await orderItemService.reassignQuantities(req.body))
    },
    DELETE: async (req) => crudRoutes.item!.handleRequest(req),
  }),
}
