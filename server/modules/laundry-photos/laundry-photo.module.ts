import { z } from 'zod'
import {
  laundryPhotoApiContract,
  laundryPhotoReassignSchema,
  laundryPhotoReassignResponseSchema,
  laundryPhotoUpdateResponseSchema,
} from '../../../contracts/laundry-photos/laundry-photo-api.schema.js'
import { getLaundryPhotosRepository } from '../../sheets/LaundryPhotos/LaundryPhotos.repository.js'
import { laundryPhotosRowSchema } from '../../sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
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
import { BaseCrudService, mapDbRowToApi } from '../../shared/services/base-crud.service.js'
import { projectResponse, requireSingleRow } from '../../shared/services/crud-helpers.js'
import { generateShortId } from '../../shared/utils/id.js'

type LaundryPhotosDbRow = z.infer<typeof laundryPhotosRowSchema>
type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>

export const laundryPhotoFieldMap = {
  id: 'laundryPhotoId',
  order_id: 'orderId',
  orderitem_id: 'orderItemId',
  item_id: 'itemId',
  image_path: 'imagePath',
  image_url: 'imageUrl',
  notes: 'notes',
  timestamp: 'createdAt',
  created_by: 'createdBy',
  updated_by: 'updatedBy',
  updated_at: 'updatedAt',
  checked: 'checked',
  is_active: 'isActive',
  file_id: 'fileId',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof LaundryPhotosDbRow & string, string>

type LaundryPhotoApiRow = ApiRowFromFieldMap<LaundryPhotosDbRow, typeof laundryPhotoFieldMap>
type LaundryPhotoListQuery = z.infer<typeof laundryPhotoApiContract.query.list>
type LaundryPhotoCreate = z.infer<typeof laundryPhotoApiContract.request.create>
type LaundryPhotoUpdate = z.infer<typeof laundryPhotoApiContract.request.update>
type LaundryPhotoListResponse = z.infer<typeof laundryPhotoApiContract.response.list>
type LaundryPhotoDetailResponse = z.infer<typeof laundryPhotoApiContract.response.detail>
type LaundryPhotoCreateResponse = z.infer<typeof laundryPhotoApiContract.response.create>
type LaundryPhotoUpdateResponse = z.infer<typeof laundryPhotoApiContract.response.update>
type LaundryPhotoReassignResponse = z.infer<typeof laundryPhotoReassignResponseSchema>
type LaundryPhotoRepository = SheetRepositoryContract<LaundryPhotosDbRow> & SheetBatchUpdateContract<LaundryPhotosDbRow>

export interface LaundryPhotoServiceOptions {
  repository?: LaundryPhotoRepository
  orderItemFormsRepository?: () => SheetRepositoryContract<OrderItemFormsDbRow>
}

export function createLaundryPhotoId(): string {
  return generateShortId()
}

function prepareLaundryPhotoAppendRow(
  row: Partial<LaundryPhotosDbRow>,
): Partial<LaundryPhotosDbRow> {
  return {
    ...row,
    id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : createLaundryPhotoId(),
  }
}

export function createLaundryPhotoRepository(): LaundryPhotoRepository {
  return {
    read: (query) => getLaundryPhotosRepository().read(query),
    append: (row) => getLaundryPhotosRepository().append(prepareLaundryPhotoAppendRow(row)),
    batchAppend: (rows) =>
      getLaundryPhotosRepository().batchAppend(rows.map(prepareLaundryPhotoAppendRow)),
    update: (keyValue, patch) => getLaundryPhotosRepository().update(keyValue, patch),
    updateMany: (updates) => getLaundryPhotosRepository().updateMany(updates),
    delete: (keyValue, deletedBy) => getLaundryPhotosRepository().delete(keyValue, deletedBy),
  }
}

const laundryPhotoMapper = new Mapper(laundryPhotoFieldMap)

export class LaundryPhotoService extends BaseCrudService<
  LaundryPhotoApiRow,
  LaundryPhotoListQuery,
  LaundryPhotoCreate,
  LaundryPhotoUpdate,
  LaundryPhotoListResponse,
  LaundryPhotoDetailResponse,
  LaundryPhotoCreateResponse,
  LaundryPhotoUpdateResponse,
  LaundryPhotosDbRow,
  typeof laundryPhotoFieldMap
> {
  private readonly photoRepository: LaundryPhotoRepository
  private readonly orderItemFormsRepository: () => SheetRepositoryContract<OrderItemFormsDbRow>

  constructor(input: LaundryPhotoServiceOptions = {}) {
    const repository = input.repository ?? createLaundryPhotoRepository()
    super({
      repository,
      api: laundryPhotoApiContract,
      searchFields: [],
      fieldMap: laundryPhotoFieldMap,
    })
    this.photoRepository = repository
    this.orderItemFormsRepository = input.orderItemFormsRepository ?? getOrderItemFormsRepository
  }

  override async update(id: string, payload: unknown): Promise<LaundryPhotoUpdateResponse> {
    const data = parseOrThrow(laundryPhotoApiContract.request.update, payload)
    const safeId = id.trim()
    if (safeId === '') {
      throw ApiError.badRequest('id is required')
    }

    const photoRows = await this.photoRepository.read(
      ReadQueryDTO.fromId<Partial<LaundryPhotosDbRow>>(safeId),
    )
    const photo = requireSingleRow(photoRows, safeId)
    const itemRows = await this.orderItemFormsRepository().read(
      ReadQueryDTO.fromId<Partial<OrderItemFormsDbRow>>(data.orderItemId),
    )
    const item = requireSingleRow(itemRows, data.orderItemId)

    if (
      typeof photo.order_id !== 'string' ||
      photo.order_id.trim() === '' ||
      typeof item.order_id !== 'string' ||
      item.order_id.trim() === ''
    ) {
      throw ApiError.badRequest('Photo and order item must belong to an order')
    }
    if (photo.order_id !== item.order_id) {
      throw ApiError.badRequest('Photo and order item belong to different orders')
    }

    // Do not patch updated_at: the Before sheet stores it as plain DD/MM/YYYY text and the
    // Sheets API request is USER_ENTERED, which would reinterpret day and month.
    const stored = await this.photoRepository.update(safeId, {
      orderitem_id: data.orderItemId,
      item_id: item.item_id,
      updated_by: data.updatedBy,
    })
    const apiRow = mapDbRowToApi(stored, laundryPhotoMapper, {})
    return projectResponse<LaundryPhotoUpdateResponse>(apiRow, laundryPhotoUpdateResponseSchema)
  }

  async reassign(payload: unknown): Promise<LaundryPhotoReassignResponse> {
    const data = parseOrThrow(laundryPhotoReassignSchema, payload)
    if (new Set(data.photoIds).size !== data.photoIds.length) {
      throw ApiError.badRequest('Duplicate photo id')
    }

    const itemRows = await this.orderItemFormsRepository().read(
      ReadQueryDTO.fromId<Partial<OrderItemFormsDbRow>>(data.orderItemId),
    )
    const item = requireSingleRow(itemRows, data.orderItemId)
    if (typeof item.order_id !== 'string' || item.order_id.trim() === '') {
      throw ApiError.badRequest('Photo and order item must belong to an order')
    }

    const stored = await this.photoRepository.updateMany(data.photoIds.map((keyValue) => ({
      keyValue,
      patch: {
        orderitem_id: data.orderItemId,
        item_id: item.item_id,
        updated_by: data.updatedBy,
      },
    })))
    const photos = stored.map((row) => projectResponse<LaundryPhotoUpdateResponse>(
      mapDbRowToApi(row, laundryPhotoMapper, {}), laundryPhotoUpdateResponseSchema,
    ))
    return { photos }
  }
}

export const laundryPhotoService = new LaundryPhotoService()
const crudRoutes = createCrudRoutes(laundryPhotoService, laundryPhotoApiContract)
export const laundryPhotoRoutes: GatewayModuleRoutes = {
  collection: crudRoutes.collection,
  item: new ApiHandler({
    GET: async (req) => {
      if (req.params.id === 'reassign') throw ApiError.notFound('Route not found')
      return crudRoutes.item!.handleRequest(req)
    },
    PATCH: async (req) => {
      if (req.params.id === 'reassign') throw ApiError.notFound('Route not found')
      return crudRoutes.item!.handleRequest(req)
    },
    POST: async (req) => {
      if (req.params.id !== 'reassign') throw ApiError.notFound('Route not found')
      return ok(await laundryPhotoService.reassign(req.body))
    },
    DELETE: async (req) => crudRoutes.item!.handleRequest(req),
  }),
}
