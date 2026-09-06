import { z } from 'zod'
import {
  laundryPhotoApiContract,
  laundryPhotoUpdateResponseSchema,
} from '../../../contracts/laundry-photos/laundry-photo-api.schema.js'
import { getLaundryPhotosRepository } from '../../sheets/LaundryPhotos/LaundryPhotos.repository.js'
import { laundryPhotosRowSchema } from '../../sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { BaseCrudService, mapDbRowToApi } from '../../shared/services/base-crud.service.js'
import { projectResponse, requireSingleRow } from '../../shared/services/crud-helpers.js'

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
type LaundryPhotoUpdate = z.infer<typeof laundryPhotoApiContract.request.update>
type LaundryPhotoListResponse = z.infer<typeof laundryPhotoApiContract.response.list>
type LaundryPhotoDetailResponse = z.infer<typeof laundryPhotoApiContract.response.detail>
type LaundryPhotoUpdateResponse = z.infer<typeof laundryPhotoApiContract.response.update>

export interface LaundryPhotoServiceOptions {
  repository?: SheetRepositoryContract<LaundryPhotosDbRow>
  orderItemFormsRepository?: () => SheetRepositoryContract<OrderItemFormsDbRow>
}

export function createLaundryPhotoRepository(): SheetRepositoryContract<LaundryPhotosDbRow> {
  return {
    read: (query) => getLaundryPhotosRepository().read(query),
    append: (row) => getLaundryPhotosRepository().append(row),
    batchAppend: (rows) => getLaundryPhotosRepository().batchAppend(rows),
    update: (keyValue, patch) => getLaundryPhotosRepository().update(keyValue, patch),
    delete: (keyValue, deletedBy) => getLaundryPhotosRepository().delete(keyValue, deletedBy),
  }
}

const laundryPhotoMapper = new Mapper(laundryPhotoFieldMap)

export class LaundryPhotoService extends BaseCrudService<
  LaundryPhotoApiRow,
  LaundryPhotoListQuery,
  never,
  LaundryPhotoUpdate,
  LaundryPhotoListResponse,
  LaundryPhotoDetailResponse,
  never,
  LaundryPhotoUpdateResponse,
  LaundryPhotosDbRow,
  typeof laundryPhotoFieldMap
> {
  private readonly photoRepository: SheetRepositoryContract<LaundryPhotosDbRow>
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
}

export const laundryPhotoService = new LaundryPhotoService()
export const laundryPhotoRoutes = createCrudRoutes(laundryPhotoService, laundryPhotoApiContract)
