import { z } from 'zod'
import { orderItemApiContract, orderItemResponseSchema } from '../../../contracts/order-items/order-item-api.schema.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { getPriceListRepository } from '../../sheets/PriceList/PriceList.repository.js'
import { priceListRowSchema } from '../../sheets/PriceList/PriceList.db-contract.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import {
  BaseCrudService,
  mapDbRowToApi,
  type ServiceListResult,
} from '../../shared/services/base-crud.service.js'
import { generateShortId } from '../../shared/utils/id.js'
import { isValidItemQuantity } from '../../../shared/utils/item-quantity.js'

type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>
type OrderFormDbRow = z.infer<typeof orderFormRowSchema>
type PriceListDbRow = z.infer<typeof priceListRowSchema>

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

export interface OrderItemServiceOptions {
  repository?: SheetRepositoryContract<OrderItemFormsDbRow>
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
  priceListRepository?: () => SheetRepositoryContract<PriceListDbRow>
}

export function createOrderItemId(): string {
  return generateShortId()
}

export function createOrderItemRepository(): SheetRepositoryContract<OrderItemFormsDbRow> {
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
    delete: (keyValue, deletedBy) => getOrderItemFormsRepository().delete(keyValue, deletedBy),
  }
}

const orderItemMapper = new Mapper(orderItemFieldMap)

export class OrderItemService extends BaseCrudService<
  OrderItemApiRow,
  OrderItemListQuery,
  OrderItemCreate,
  never,
  OrderItemListResponse,
  OrderItemDetailResponse,
  OrderItemCreateResponse,
  never,
  OrderItemFormsDbRow,
  typeof orderItemFieldMap
> {
  private readonly writeRepository: SheetRepositoryContract<OrderItemFormsDbRow>
  private readonly orderFormRepository: () => SheetRepositoryContract<OrderFormDbRow>
  private readonly priceListRepository: () => SheetRepositoryContract<PriceListDbRow>

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
    this.priceListRepository = input.priceListRepository ?? getPriceListRepository
  }

  override async list(query: unknown): Promise<ServiceListResult<OrderItemListResponse>> {
    const result = await super.list(query)
    const items = result.items.filter(
      (item) => typeof item.orderItemId === 'string' && item.orderItemId.trim() !== '',
    )
    const unitsByItemId = await this.readUnitsByItemId(items.map((item) => item.itemId))

    return {
      items: items.map((item) => ({
        ...item,
        unit: item.itemId === null ? null : unitsByItemId.get(item.itemId) ?? null,
      })),
      pagination: result.pagination,
    }
  }

  override async getById(id: string): Promise<OrderItemDetailResponse> {
    const item = await super.getById(id)
    const unitsByItemId = await this.readUnitsByItemId([item.itemId])
    return {
      ...item,
      unit: item.itemId === null ? null : unitsByItemId.get(item.itemId) ?? null,
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

    const unitsByItemId = await this.readUnitsByItemId([data.itemId])
    assertPriceListItemExists(data.itemId, unitsByItemId)
    const unit = data.itemId === null ? null : unitsByItemId.get(data.itemId) ?? null
    validateItemQuantity(data.quantity, unit)

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
    return { ...response, unit }
  }

  async createMany(rows: Array<Partial<OrderItemFormsDbRow>>): Promise<void> {
    const unitsByItemId = await this.readUnitsByItemId(rows.map((row) => row.item_id))
    for (const row of rows) {
      const itemId = typeof row.item_id === 'string' ? row.item_id : null
      if (typeof row.quantity !== 'number') {
        throw ApiError.validation('Invalid item quantity')
      }
      assertPriceListItemExists(itemId, unitsByItemId)
      validateItemQuantity(row.quantity, itemId === null ? null : unitsByItemId.get(itemId) ?? null)
    }
    await this.writeRepository.batchAppend(rows)
  }

  private async readUnitsByItemId(itemIds: Array<string | null | undefined>): Promise<Map<string, string | null>> {
    const requestedIds = new Set(itemIds.filter((itemId): itemId is string => typeof itemId === 'string' && itemId.trim() !== ''))
    if (requestedIds.size === 0) return new Map()

    const rows = await this.priceListRepository().read()
    return new Map(
      rows.flatMap((row) =>
        typeof row.id === 'string' && requestedIds.has(row.id)
          ? [[row.id, row.unit ?? null] as const]
          : [],
      ),
    )
  }
}

function assertPriceListItemExists(
  itemId: string | null,
  unitsByItemId: ReadonlyMap<string, string | null>,
): void {
  if (itemId !== null && !unitsByItemId.has(itemId)) {
    throw ApiError.notFound(`Price list item '${itemId}' not found`)
  }
}

function validateItemQuantity(quantity: number, unit: string | null): void {
  if (!isValidItemQuantity(quantity, unit)) {
    throw ApiError.validation(
      'kg quantity must use at most one decimal place; other units require a positive whole number',
      { fieldErrors: { quantity: ['Invalid quantity for the price-list unit'] } },
    )
  }
}

export const orderItemService = new OrderItemService()
export const orderItemRoutes = createCrudRoutes(orderItemService, orderItemApiContract)
